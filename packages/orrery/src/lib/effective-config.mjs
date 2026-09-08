import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";

// Ranked by how likely the file is to sit under the repo's main rule set rather
// than an override block. A config printed for a test file or a config file
// would understate the shared surface. Neither donor repo has an `index.ts`
// under `apps/*/src`; the app root layout is the file every Next.js body has.
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
  const tried = [];

  for (const candidate of [preferred, ...CANDIDATES].filter(Boolean)) {
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
export function resolveEslintBin(repoDirectory) {
  const require = createRequire(path.join(repoDirectory, "package.json"));

  let manifestPath;
  try {
    manifestPath = require.resolve("eslint/package.json");
  } catch {
    throw new Error(`eslint is not installed in ${repoDirectory}; run pnpm install there first`);
  }

  const { bin } = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  return path.join(path.dirname(manifestPath), typeof bin === "string" ? bin : bin.eslint);
}

function defaultExec(repoDirectory, relativeFile) {
  return execFileSync(
    process.execPath,
    [resolveEslintBin(repoDirectory), "--print-config", relativeFile],
    { cwd: repoDirectory, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
  );
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
