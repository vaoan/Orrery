# Phase 2a — CLI skeleton and `orrery diff-eslint`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the `@vaoan/orrery` package with a working CLI, and implement `orrery diff-eslint`, which produces an exact rule-by-rule comparison of two repositories' effective ESLint configurations.

**Architecture:** A pnpm workspace with one package, `packages/orrery`. The CLI is a thin `bin` dispatching to per-command modules. `diff-eslint` shells out to each target repo's own `eslint --print-config` — the only way to get a *resolved* config, since both repos build theirs programmatically — parses the two JSON blobs, and buckets every rule into agree / one-sided / conflict.

**Tech Stack:** Node ≥24, pnpm, ESM `.mjs`, vitest. No dependency on ts-morph or ESLint itself — `diff-eslint` invokes the ESLint already installed in each target repo.

**Spec:** `docs/specs/2026-09-06-orrery-design.md` — see "eslint reconciliation needs a tool"

## Global Constraints

- Node `>=24`; pnpm as the package manager, matching the rest of the constellation.
- ESM only. Source files are `.mjs` under `packages/orrery/`.
- **This repository contains no application code.** Only the governance tool and its assets.
- The boundary rule, from the spec: anything destined for `physics/` must be true for a repository that does not exist yet.
- `diff-eslint` must not require the target repositories to be modified, and must not write anything into them.
- Both donor repos exist locally: `Z:/Github/libra` (1,854-line `eslint.config.mjs`) and `Z:/Github/aeleos` (850 lines). They share 13 of ~18 plugins.

## Why this is built first

Thirteen shared plugins does not imply thirteen shared rule configurations. Both repos use `sonarjs`, `unicorn`, and `boundaries`, possibly at different severities and with different options. Diffing 2,704 lines of config by hand is where this project would quietly die, so the reconciliation gets a tool before it gets an opinion.

`eslint --print-config <file>` emits the fully resolved configuration for one file, including everything inherited and overridden. Running it on a comparable file in each repo and diffing the JSON turns an unbounded judgement call into a finite list.

---

### Task 1: Workspace skeleton and CLI entry point

A walking skeleton: `orrery --help` runs and is tested. Everything later hangs off this.

**Files:**
- Create: `package.json` (workspace root)
- Create: `pnpm-workspace.yaml`
- Create: `packages/orrery/package.json`
- Create: `packages/orrery/bin/orrery.mjs`
- Create: `packages/orrery/src/cli.mjs`
- Create: `vitest.config.mjs`
- Test: `packages/orrery/tests/cli.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `run(argv: string[]) => Promise<number>` from `src/cli.mjs` — parses argv, dispatches to a command module, returns a process exit code. Exported so tests drive it without spawning.

- [ ] **Step 1: Write the failing test**

```javascript
// packages/orrery/tests/cli.test.mjs
import { describe, it, expect, vi } from "vitest";
import { run } from "../src/cli.mjs";

describe("run", () => {
  it("prints usage and exits 0 for --help", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const code = await run(["--help"]);
    expect(code).toBe(0);
    expect(log.mock.calls.flat().join("\n")).toContain("orrery diff-eslint");
    log.mockRestore();
  });

  it("prints usage and exits 0 with no arguments", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    expect(await run([])).toBe(0);
    log.mockRestore();
  });

  it("exits 2 on an unknown command", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const code = await run(["nonsense"]);
    expect(code).toBe(2);
    expect(error.mock.calls.flat().join("\n")).toContain("unknown command");
    error.mockRestore();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run packages/orrery/tests/cli.test.mjs`
Expected: FAIL — cannot resolve `../src/cli.mjs`

- [ ] **Step 3: Write the workspace files**

`pnpm-workspace.yaml`:

```yaml
packages:
  - "packages/*"
```

Root `package.json`:

```json
{
  "name": "orrery-workspace",
  "private": true,
  "type": "module",
  "engines": { "node": ">=24" },
  "scripts": {
    "test": "vitest run",
    "orrery": "node packages/orrery/bin/orrery.mjs"
  },
  "devDependencies": { "vitest": "^4.1.5" }
}
```

`packages/orrery/package.json`:

```json
{
  "name": "@vaoan/orrery",
  "version": "0.0.0",
  "type": "module",
  "engines": { "node": ">=24" },
  "bin": { "orrery": "./bin/orrery.mjs" },
  "exports": { ".": "./src/cli.mjs" },
  "files": ["bin", "src"]
}
```

`vitest.config.mjs`:

```javascript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "node", include: ["packages/*/tests/**/*.test.mjs"] },
});
```

- [ ] **Step 4: Write the CLI**

`packages/orrery/src/cli.mjs`:

```javascript
const USAGE = `orrery — constellation governance

Usage:
  orrery diff-eslint <repoA> <repoB> [--file <relative-path>] [--json]

Commands:
  diff-eslint   compare two repositories' effective ESLint configurations
`;

const COMMANDS = {
  "diff-eslint": async (argv) => (await import("./commands/diff-eslint.mjs")).default(argv),
};

export async function run(argv) {
  const [command, ...rest] = argv;

  if (!command || command === "--help" || command === "-h") {
    console.log(USAGE);
    return 0;
  }

  const handler = COMMANDS[command];
  if (!handler) {
    console.error(`unknown command: ${command}\n\n${USAGE}`);
    return 2;
  }

  return handler(rest);
}
```

`packages/orrery/bin/orrery.mjs`:

```javascript
#!/usr/bin/env node
import { run } from "../src/cli.mjs";

process.exitCode = await run(process.argv.slice(2));
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm vitest run packages/orrery/tests/cli.test.mjs`
Expected: PASS — 3 tests

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-workspace.yaml vitest.config.mjs packages/
git commit -m "feat(cli): workspace skeleton and orrery command dispatcher"
```

---

### Task 2: Effective-config extraction

Wraps `eslint --print-config` in each target repository. Isolated from the diff logic so the diff can be tested against fixtures without running ESLint.

**Files:**
- Create: `packages/orrery/src/lib/effective-config.mjs`
- Test: `packages/orrery/tests/effective-config.test.mjs`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces:
  - `pickSampleFile(repoDir: string, preferred?: string) => string` — repo-relative path of a file to print the config for. Tries `preferred`, then a ranked list of likely paths, and throws a message naming what it tried if none exist.
  - `resolveEslintBin(repoDir: string) => string` — absolute path of the `eslint` bin script installed in `repoDir`, resolved with Node's own resolution from that directory, and throws a message naming the repo when eslint is not installed there.
  - `readEffectiveConfig(repoDir: string, relativeFile: string, exec?) => object` — runs the target repo's own ESLint with `--print-config <file>` (spawned with the current Node binary, no shell) in `repoDir` and returns the parsed JSON. `exec` is injectable for tests.

Why not `pnpm exec eslint`: on Windows `pnpm` is a `.cmd` shim, so `execFileSync("pnpm", …)` fails with ENOENT unless `shell: true` is set, and a shell concatenates the arguments unescaped (Node warns with DEP0190). Resolving the repo's eslint and running it with `process.execPath` avoids both, and works under libra's hoisted and aeleos's isolated `node_modules` alike. Verified 2026-09-07 on this machine.

- [ ] **Step 1: Write the failing test**

```javascript
// packages/orrery/tests/effective-config.test.mjs
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  pickSampleFile,
  readEffectiveConfig,
  resolveEslintBin,
} from "../src/lib/effective-config.mjs";

let repo;
beforeEach(() => {
  repo = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-"));
  fs.mkdirSync(path.join(repo, "apps/store/src/app"), { recursive: true });
});
afterEach(() => fs.rmSync(repo, { recursive: true, force: true }));

describe("pickSampleFile", () => {
  it("returns the preferred file when it exists", () => {
    fs.writeFileSync(path.join(repo, "apps/store/src/a.ts"), "");
    expect(pickSampleFile(repo, "apps/store/src/a.ts")).toBe("apps/store/src/a.ts");
  });

  it("falls back to the first existing candidate", () => {
    fs.writeFileSync(path.join(repo, "apps/store/src/app/layout.tsx"), "");
    expect(pickSampleFile(repo)).toBe("apps/store/src/app/layout.tsx");
  });

  it("throws naming what it tried when nothing matches", () => {
    expect(() => pickSampleFile(repo)).toThrow(/no sample file found/i);
  });
});

describe("resolveEslintBin", () => {
  it("returns the bin script of the eslint installed in the repo", () => {
    const pkg = path.join(repo, "node_modules/eslint");
    fs.mkdirSync(path.join(pkg, "bin"), { recursive: true });
    fs.writeFileSync(
      path.join(pkg, "package.json"),
      JSON.stringify({ name: "eslint", version: "0.0.0", bin: { eslint: "./bin/eslint.js" } })
    );
    fs.writeFileSync(path.join(pkg, "bin/eslint.js"), "");
    expect(resolveEslintBin(repo)).toBe(path.join(pkg, "bin/eslint.js"));
  });

  it("throws naming the repo when eslint is not installed there", () => {
    expect(() => resolveEslintBin(repo)).toThrow(/eslint is not installed/i);
  });
});

describe("readEffectiveConfig", () => {
  it("parses the JSON that eslint prints", () => {
    const fakeExec = () => JSON.stringify({ rules: { "no-var": ["error"] } });
    const config = readEffectiveConfig(repo, "apps/store/src/a.ts", fakeExec);
    expect(config.rules["no-var"]).toEqual(["error"]);
  });

  it("throws a message naming the repo when eslint output is not JSON", () => {
    const fakeExec = () => "ELIFECYCLE something went wrong";
    expect(() => readEffectiveConfig(repo, "a.ts", fakeExec)).toThrow(/could not parse/i);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run packages/orrery/tests/effective-config.test.mjs`
Expected: FAIL — cannot resolve `../src/lib/effective-config.mjs`

- [ ] **Step 3: Write the implementation**

```javascript
// packages/orrery/src/lib/effective-config.mjs
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run packages/orrery/tests/effective-config.test.mjs`
Expected: PASS — 7 tests

- [ ] **Step 5: Commit**

```bash
git add packages/orrery/src/lib/effective-config.mjs packages/orrery/tests/effective-config.test.mjs
git commit -m "feat(diff-eslint): extract a repository's effective eslint config"
```

---

### Task 3: The rule diff

Pure logic over two config objects. This is the piece that turns 2,704 lines into a finite decision list, so it gets the most careful tests.

**Files:**
- Create: `packages/orrery/src/lib/rule-diff.mjs`
- Test: `packages/orrery/tests/rule-diff.test.mjs`

**Interfaces:**
- Consumes: config objects shaped like `readEffectiveConfig`'s return (Task 2).
- Produces: `diffRules(a: object, b: object) => { agree: string[], onlyA: string[], onlyB: string[], conflict: Array<{rule: string, a: unknown, b: unknown}> }`.

Bucket meanings, which drive the reconciliation:
- **agree** → goes to `physics/` or the shared class config unchanged.
- **onlyA / onlyB** → one repo has an opinion the other lacks; adopting it is a cheap win.
- **conflict** → both have an opinion and they differ; each needs a ruling and a decision record.

Severity is compared normalised (`0`/`1`/`2` are equivalent to `"off"`/`"warn"`/`"error"`), because the two repos write severities differently and a spurious conflict list is worse than none.

- [ ] **Step 1: Write the failing test**

```javascript
// packages/orrery/tests/rule-diff.test.mjs
import { describe, it, expect } from "vitest";
import { diffRules } from "../src/lib/rule-diff.mjs";

const cfg = (rules) => ({ rules });

describe("diffRules", () => {
  it("buckets an identical rule as agreeing", () => {
    const d = diffRules(cfg({ "no-var": ["error"] }), cfg({ "no-var": ["error"] }));
    expect(d.agree).toEqual(["no-var"]);
    expect(d.conflict).toEqual([]);
  });

  it("treats numeric and string severities as equal", () => {
    const d = diffRules(cfg({ "no-var": [2] }), cfg({ "no-var": ["error"] }));
    expect(d.agree).toEqual(["no-var"]);
  });

  it("buckets a rule only one side sets", () => {
    const d = diffRules(cfg({ "no-var": ["error"] }), cfg({}));
    expect(d.onlyA).toEqual(["no-var"]);
    expect(d.onlyB).toEqual([]);
  });

  it("buckets differing severities as a conflict carrying both values", () => {
    const d = diffRules(cfg({ "no-var": ["error"] }), cfg({ "no-var": ["warn"] }));
    expect(d.conflict).toEqual([{ rule: "no-var", a: ["error"], b: ["warn"] }]);
  });

  it("treats differing options at equal severity as a conflict", () => {
    const a = cfg({ "unicorn/filename-case": ["error", { case: "kebabCase" }] });
    const b = cfg({ "unicorn/filename-case": ["error", { case: "camelCase" }] });
    expect(diffRules(a, b).conflict).toHaveLength(1);
  });

  it("ignores key order inside options", () => {
    const a = cfg({ r: ["error", { x: 1, y: 2 }] });
    const b = cfg({ r: ["error", { y: 2, x: 1 }] });
    expect(diffRules(a, b).agree).toEqual(["r"]);
  });

  it("treats a rule switched off on one side as a conflict, not agreement", () => {
    const d = diffRules(cfg({ "no-var": ["off"] }), cfg({ "no-var": ["error"] }));
    expect(d.conflict).toHaveLength(1);
    expect(d.agree).toEqual([]);
  });

  it("returns empty buckets for two empty configs", () => {
    expect(diffRules(cfg({}), cfg({}))).toEqual({ agree: [], onlyA: [], onlyB: [], conflict: [] });
  });

  it("sorts every bucket so output is stable across runs", () => {
    const d = diffRules(cfg({ b: ["error"], a: ["error"] }), cfg({ a: ["error"], b: ["error"] }));
    expect(d.agree).toEqual(["a", "b"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run packages/orrery/tests/rule-diff.test.mjs`
Expected: FAIL — cannot resolve `../src/lib/rule-diff.mjs`

- [ ] **Step 3: Write the implementation**

```javascript
// packages/orrery/src/lib/rule-diff.mjs

const SEVERITY = { 0: "off", 1: "warn", 2: "error", off: "off", warn: "warn", error: "error" };

/**
 * `eslint --print-config` emits every rule as an array whose head is the
 * severity, but the two repositories write severities differently — one uses
 * numbers, the other strings. Normalising first keeps the conflict list free of
 * differences that are not real, which matters because every conflict costs a
 * human ruling.
 */
function normalise(entry) {
  const value = Array.isArray(entry) ? entry : [entry];
  const [severity, ...options] = value;
  return JSON.stringify([SEVERITY[severity] ?? severity, ...options], sortedKeys);
}

// Stable stringify: option objects that differ only in key order are the same
// configuration.
function sortedKeys(_key, value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((k) => [k, value[k]]));
}

export function diffRules(a, b) {
  const rulesA = a.rules ?? {};
  const rulesB = b.rules ?? {};

  const agree = [];
  const onlyA = [];
  const onlyB = [];
  const conflict = [];

  for (const rule of Object.keys(rulesA)) {
    if (!(rule in rulesB)) {
      onlyA.push(rule);
    } else if (normalise(rulesA[rule]) === normalise(rulesB[rule])) {
      agree.push(rule);
    } else {
      conflict.push({ rule, a: rulesA[rule], b: rulesB[rule] });
    }
  }

  for (const rule of Object.keys(rulesB)) {
    if (!(rule in rulesA)) onlyB.push(rule);
  }

  const byName = (x, y) => x.localeCompare(y);
  return {
    agree: agree.sort(byName),
    onlyA: onlyA.sort(byName),
    onlyB: onlyB.sort(byName),
    conflict: conflict.sort((x, y) => byName(x.rule, y.rule)),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run packages/orrery/tests/rule-diff.test.mjs`
Expected: PASS — 9 tests

- [ ] **Step 5: Commit**

```bash
git add packages/orrery/src/lib/rule-diff.mjs packages/orrery/tests/rule-diff.test.mjs
git commit -m "feat(diff-eslint): bucket rules into agree, one-sided and conflict"
```

---

### Task 4: Wire the command and run it against the real repositories

Joins Tasks 2 and 3 into `orrery diff-eslint`, then runs it against `libra` and `AeleOS` and commits the result as the reconciliation's input.

**Files:**
- Create: `packages/orrery/src/commands/diff-eslint.mjs`
- Test: `packages/orrery/tests/diff-eslint.test.mjs`
- Create: `docs/decisions/0002-eslint-reconciliation-input.md`

**Interfaces:**
- Consumes: `pickSampleFile`, `readEffectiveConfig` (Task 2); `diffRules` (Task 3); dispatched from `src/cli.mjs` (Task 1).
- Produces: default export `(argv: string[]) => Promise<number>` returning an exit code — `0` on success, `2` on bad arguments, `1` when a repository's config could not be read.

- [ ] **Step 1: Write the failing test**

```javascript
// packages/orrery/tests/diff-eslint.test.mjs
import { describe, it, expect, vi } from "vitest";
import diffEslint from "../src/commands/diff-eslint.mjs";

describe("diff-eslint command", () => {
  it("exits 2 when fewer than two repositories are given", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await diffEslint(["only-one"])).toBe(2);
    error.mockRestore();
  });

  it("prints a count for every bucket", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const code = await diffEslint(["a", "b"], {
      pickSampleFile: () => "src/index.ts",
      readEffectiveConfig: (dir) =>
        dir === "a"
          ? { rules: { shared: ["error"], onlyInA: ["error"], clash: ["error"] } }
          : { rules: { shared: ["error"], onlyInB: ["error"], clash: ["warn"] } },
    });
    const out = log.mock.calls.flat().join("\n");
    expect(code).toBe(0);
    expect(out).toMatch(/agree\s+1/);
    expect(out).toMatch(/conflict\s+1/);
    expect(out).toContain("clash");
    log.mockRestore();
  });

  it("emits machine-readable JSON with --json", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await diffEslint(["a", "b", "--json"], {
      pickSampleFile: () => "src/index.ts",
      readEffectiveConfig: () => ({ rules: { shared: ["error"] } }),
    });
    expect(JSON.parse(log.mock.calls.flat().join("\n")).agree).toEqual(["shared"]);
    log.mockRestore();
  });

  it("exits 1 with a clear message when a config cannot be read", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const code = await diffEslint(["a", "b"], {
      pickSampleFile: () => "src/index.ts",
      readEffectiveConfig: () => { throw new Error("boom"); },
    });
    expect(code).toBe(1);
    expect(error.mock.calls.flat().join("\n")).toContain("boom");
    error.mockRestore();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run packages/orrery/tests/diff-eslint.test.mjs`
Expected: FAIL — cannot resolve `../src/commands/diff-eslint.mjs`

- [ ] **Step 3: Write the implementation**

```javascript
// packages/orrery/src/commands/diff-eslint.mjs
import { parseArgs } from "node:util";
import * as effective from "../lib/effective-config.mjs";
import { diffRules } from "../lib/rule-diff.mjs";

export default async function diffEslint(argv, deps = effective) {
  const { values, positionals } = parseArgs({
    args: argv,
    options: { file: { type: "string" }, json: { type: "boolean", default: false } },
    allowPositionals: true,
  });

  const [repoA, repoB] = positionals;
  if (!repoA || !repoB) {
    console.error("usage: orrery diff-eslint <repoA> <repoB> [--file <path>] [--json]");
    return 2;
  }

  let configA, configB;
  try {
    configA = deps.readEffectiveConfig(repoA, deps.pickSampleFile(repoA, values.file));
    configB = deps.readEffectiveConfig(repoB, deps.pickSampleFile(repoB, values.file));
  } catch (error) {
    console.error(error.message);
    return 1;
  }

  const result = diffRules(configA, configB);

  if (values.json) {
    console.log(JSON.stringify(result, null, 2));
    return 0;
  }

  console.log(`agree     ${result.agree.length}`);
  console.log(`only ${repoA}  ${result.onlyA.length}`);
  console.log(`only ${repoB}  ${result.onlyB.length}`);
  console.log(`conflict  ${result.conflict.length}`);

  if (result.conflict.length > 0) {
    console.log("\nconflicts — each needs a ruling and a decision record:");
    for (const { rule, a, b } of result.conflict) {
      console.log(`  ${rule}\n    ${repoA}: ${JSON.stringify(a)}\n    ${repoB}: ${JSON.stringify(b)}`);
    }
  }

  return 0;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run packages/orrery/tests/diff-eslint.test.mjs`
Expected: PASS — 4 tests

- [ ] **Step 5: Run the whole suite**

Run: `pnpm test`
Expected: PASS — 23 tests across 4 files

- [ ] **Step 6: Run it against the real repositories**

```bash
pnpm orrery diff-eslint Z:/Github/aeleos Z:/Github/libra --json > .superpowers/sdd/2026-09-07-phase-2a-diff-eslint/eslint-diff.json
pnpm orrery diff-eslint Z:/Github/aeleos Z:/Github/libra
```

Both repos must have `node_modules` installed for `eslint --print-config` to work; run `pnpm install` in each first if needed (both were installed on 2026-09-07). `pickSampleFile` resolves to `apps/hub/src/app/[locale]/layout.tsx` for aeleos and `apps/store/src/app/layout.tsx` for libra; pass `--file` only if that changes. Expect roughly one minute per repo — aeleos's `--print-config` took 60 s on 2026-09-07 and reported 976 rules. The JSON file lands in the plan's git-ignored workspace, not in the tree; the decision record is the committed artifact.

- [ ] **Step 7: Record the result**

Write `docs/decisions/0002-eslint-reconciliation-input.md` containing the four bucket counts, the full conflict list, and — for each conflict — nothing more than the two values. Do **not** rule on the conflicts in this task; the rulings are the next plan's work, and mixing measurement with judgement is how the numbers stop being trustworthy.

- [ ] **Step 8: Commit**

```bash
git add packages/orrery/src/commands/diff-eslint.mjs packages/orrery/tests/diff-eslint.test.mjs docs/decisions/0002-eslint-reconciliation-input.md
git commit -m "feat(diff-eslint): wire the command and record the reconciliation input"
```

---

## Done when

- `pnpm test` passes.
- `pnpm orrery diff-eslint Z:/Github/aeleos Z:/Github/libra` prints four bucket counts and an itemised conflict list.
- `docs/decisions/0002-eslint-reconciliation-input.md` records the measurement, with no rulings in it.

## Next

**Phase 2b — reconciliation.** Rule on each conflict from 0002, populate `physics/` and `classes/next-supabase-mono/`, and write a decision record per ruling. The boundary rule decides tier placement: anything requiring a project's name to justify is not physics.

**Phase 2c — the plugin channel.** `.claude-plugin/marketplace.json` and `plugin.json`, convert libra's 31 rule files to skills, move its 38 skills and 7 MCP servers in, and add the version-parity test that keeps the npm and marketplace versions from drifting apart.

**Phase 2d — registry, CLI verbs, CI.** `registry.json`, `init`/`check`/`status`/`promote`, the consumer matrix, and the fixture repo.
