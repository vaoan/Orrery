import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

// Ranked by how likely the file is to sit under the repo's main rule set rather
// than an override block. A config printed for a test file or a config file
// would understate the shared surface. Neither donor repo has an `index.ts`
// under `apps/*/src`; the app root layout is the file every Next.js body has.
// This list is a pragmatic seed of layouts seen in the constellation, not
// policy — it is only ever consulted when `--file` is absent; `--file` is
// authoritative and is never second-guessed against it.
const CANDIDATES = [
  "apps/store/src/app/layout.tsx",
  "apps/hub/src/app/[locale]/layout.tsx",
  "apps/store/src/proxy.ts",
  "apps/hub/src/proxy.ts",
  "packages/shared/src/index.ts",
  "packages/identity/src/index.ts",
  "src/index.ts",
];

export function pickSampleFile(repoDirectory, preferred) {
  // An explicit --file that does not exist must fail loudly, not fall back to
  // a candidate: silently substituting a different file would hide a typo
  // behind a config that looks plausible but was not the one asked for.
  if (preferred) {
    if (fs.existsSync(path.join(repoDirectory, preferred))) return preferred;
    throw new Error(`preferred sample file does not exist in ${repoDirectory}: ${preferred}`);
  }

  const tried = [];
  for (const candidate of CANDIDATES) {
    tried.push(candidate);
    if (fs.existsSync(path.join(repoDirectory, candidate))) return candidate;
  }

  throw new Error(
    `no sample file found in ${repoDirectory}; tried: ${tried.join(", ")}`
  );
}

// Spawning `pnpm` directly fails on Windows (`pnpm` is a .cmd shim: ENOENT
// without a shell), and a shell would concatenate the arguments unescaped.
// Resolving the target repo's own ESLint and running it with this process's
// Node avoids both, and works under hoisted and isolated node_modules alike.
//
// This walks `node_modules/eslint` up from repoDirectory by hand instead of
// asking Node's own resolver (createRequire/require.resolve): that resolver
// also consults NODE_PATH and the global folders, and those are never the
// repo's eslint. A hoisted `node_modules/.pnpm/node_modules` sitting on
// NODE_PATH (vitest's workers set it) would otherwise be found before this
// function ever gets to say the repo has none installed.
function findEslintManifest(repoDirectory) {
  let dir = path.resolve(repoDirectory);
  while (true) {
    const candidate = path.join(dir, "node_modules/eslint/package.json");
    if (fs.existsSync(candidate)) return candidate;

    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

export function resolveEslintBin(repoDirectory) {
  const manifestPath = findEslintManifest(repoDirectory);
  if (!manifestPath) {
    throw new Error(`eslint is not installed in ${repoDirectory}; run pnpm install there first`);
  }

  const { bin } = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

  let binPath;
  if (typeof bin === "string") {
    binPath = bin;
  } else if (bin && typeof bin === "object" && typeof bin.eslint === "string") {
    binPath = bin.eslint;
  } else {
    throw new Error(`${manifestPath} has no eslint bin entry`);
  }

  return path.join(path.dirname(manifestPath), binPath);
}

function defaultExec(repoDirectory, relativeFile) {
  try {
    return execFileSync(
      process.execPath,
      [resolveEslintBin(repoDirectory), "--print-config", relativeFile],
      { cwd: repoDirectory, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
    );
  } catch (error) {
    throw new Error(`eslint --print-config failed in ${repoDirectory}: ${error.message}`);
  }
}

export function readEffectiveConfig(repoDirectory, relativeFile, exec = defaultExec) {
  const raw = exec(repoDirectory, relativeFile);

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(
      `could not parse eslint --print-config output from ${repoDirectory} for ${relativeFile}`
    );
  }
}
