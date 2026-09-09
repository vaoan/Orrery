# Phase 2b — Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate the constellation's tooling bundle once from aeleos and libra under the strictest-wins ordering, record every ruling, and prove the bundle by observing both donors read-only: their own tools, a config that only imports the bundle, and exactly the predicted violations.

**Architecture:** Pure reconcilers per tool turn two parsed configs into ruling rows `{ tool, surface, key, a, b, chosen, test, tier }`; a record writer turns rows into one decision file per tool; a bundle writer turns rows into generated config code under `physics/` and `classes/next-supabase-mono/`, every export a function of the body's `orrery.config.mjs`. `orrery observe` runs a body's tools against a scratch config that imports the bundle and compares effective config to the rows and violations to a committed prediction. Everything that touches a donor is read-only.

**Tech Stack:** Node ≥24 (`fs.globSync`, built-in `fetch`), pnpm, ESM `.mjs`, vitest. The bundle's plugins become dependencies of `packages/orrery` (the design doc's intent: they leave every body's devDependencies).

**Spec:** `docs/specs/2026-09-08-phase-2b-reconciliation-design.md`

## Global Constraints

- Node `>=24`; pnpm; ESM only; `.mjs` source under `packages/orrery/`. This repository contains no application code.
- **No body is modified.** Every command that touches `Z:/Github/aeleos` or `Z:/Github/libra` is read-only: `--print-config`, running a tool with `--config` pointing into Orrery, `git rev-parse`. Never `pnpm install`, never a write, never a git command that changes state, in a donor.
- **Ruling order:** stricter wins; if strictness is undefined, the more consistent option; then the option that benefits the code most. Project data (paths, element types, words, aliases) is a parameter, never a ruling.
- **Everything is shared unless it names one specific file.** Local means a named-file exception in `eslint.local.mjs`.
- **Deterministic:** every reconciler is a pure function; every generated file is byte-stable across runs (sorted keys, fixed order).
- **Flow:** every task is a branch from `origin/develop`, one PR into develop, squash auto-merge after the six checks. Commit subjects are conventional; the two trailer lines close every commit message:
  `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01NUi5KvdndoSSt5xHuiuYVK`.
- **When cornered, stop and ask** (CLAUDE.md). A needed fix that is not in this plan is a plan defect.

## Verified before writing (2026-09-09)

- Sample files exist and resolve, per surface, in both donors (counts are `rules, on`):

| surface | aeleos | libra |
|---|---|---|
| source | `apps/hub/src/features/actors/application/use-fursona-editor.ts` (966, 502) | `apps/store/src/features/cart/application/groupBySeller.ts` (611, 498) |
| component | `apps/hub/src/features/actors/presentation/actor-tile.tsx` (976, 511) | `apps/store/src/features/auth/presentation/components/ProtectedRoute.tsx` (619, 506) |
| unit-test | `apps/hub/tests/actor-content.test.ts` (539, 148) | `apps/store/tests/AccordionItem.test.tsx` (142, 105) |
| e2e | `apps/hub/tests/e2e/a11y.spec.ts` (538, 147) | `apps/store/e2e/accessibility.spec.ts` (158, 121) |
| script | `scripts/aeleos-project.mjs` (440, 79) | `scripts/backup-prod.mjs` (96, 82) |
| package | `packages/identity/src/actors.ts` (883, 425) | `packages/api/src/auth/token.ts` (611, 498) |

  The app-router layout resolves to the same rule set as `component` in both donors, so it is not a separate surface.
- `fs.globSync` exists on Node v24.19.0.
- Every tool in the set accepts an explicit config path: eslint `-c … --no-config-lookup` (out-of-tree config with plugins resolved from the body, type-aware parsing across the boundary: proven by spike), stylelint `--config`, knip `-c`, jscpd `-c`, cspell `lint -c`, ls-lint `-config` (single dash), syncpack `lint --config`; tsconfig `extends` resolves `@vaoan/orrery/tsconfig` through a package `exports` entry.
- Plugin prefixes present across the two effective configs: core, `@next/next`, `@tanstack/query`, `@typescript-eslint`, `better-tailwindcss`, `boundaries`, `i18next`, `import`, `jsdoc`, `jsx-a11y`, `react`, `react-hooks`, `security`, `sonarjs`, `tsdoc`, `unicorn`, `unused-imports`. Every one is placed in the tier map of Task 3.
- Pre-rulings for the conflicts where strictness alone does not decide, from the real values in ADR 0002:

| rule | ruling | test |
|---|---|---|
| `unicorn/number-literal-case` | `["error", { hexadecimalValue: "uppercase" }]` | consistency: plugin default; four of five bodies |
| `unicorn/numeric-separators-style` | libra's options | strictest: aeleos adds `hexadecimal.onlyIfContainsSeparator: true`, an exemption |
| `@typescript-eslint/no-unused-vars` | `["error"]` | strictest: no `_` exemption |
| `i18next/no-literal-string` | mode `all`; `jsx-attributes.include` = union; `ignoreAttribute` = libra's list; `words.exclude` = body parameter | strictest on mode and attributes; benefit on `ignoreAttribute` (attribute names such as `className` are not user-facing text); brand words are data |
| `no-restricted-imports` | physics keeps the `../*` pattern (aeleos); alias patterns (`@ui/*`, `@shared/*`) are body parameters | `../*` is true for any repository; aliases name one repository's packages |
| `no-restricted-properties` | agree | the two differ only in `message`; messages are ignored when comparing |
| `boundaries/dependencies`, `boundaries/elements` | class rule with aeleos's layered policy; extra element types and paths are body parameters | strictest: aeleos's layering; data is data |
| `better-tailwindcss/*` | stricter severity; `entryPoint` is a body parameter; `allowMultiline` dropped | strictest: no exemption |
| `sonarjs/no-duplicate-string` | `["error", { threshold: 2, ignoreStrings: <union> }]` | strictest on threshold; benefit on `ignoreStrings` (both exempt machine strings, not code) |

---

## File structure

```
packages/orrery/
├── src/lib/surfaces.mjs                 SURFACES, findSurfaceSamples(repoDir, overrides)
├── src/lib/reconcile/
│   ├── ordering.mjs                     severityRank, ORDINAL_OPTIONS, EXEMPTION_KEY, PARAMETER_KEYS, PRE_RULINGS, stricter()
│   ├── eslint.mjs                       reconcileEslint(effectiveA, effectiveB) -> rows
│   ├── tiers.mjs                        TIER_BY_PLUGIN, tierOf(rule)
│   ├── tsconfig.mjs                     reconcileTsconfig(a, b) -> rows
│   ├── stylelint.mjs                    reconcileStylelint(a, b) -> rows
│   ├── simple.mjs                       reconcilePrettier, reconcileSecretlint, reconcileJscpd, reconcileCspell, reconcileLintStaged, reconcileHook
│   ├── knip.mjs                         reconcileKnip(a, b) -> rows
│   └── syncpack.mjs                     reconcileSyncpack(a, b) -> rows
├── src/lib/donors.mjs                   readDonor(repoDir, samples, exec?) -> { sha, eslint: {surface: config}, tsconfig, stylelint, ... }
├── src/lib/records.mjs                  renderRecord(tool, rows, provenance) -> markdown
├── src/lib/bundle/
│   ├── eslint.mjs                       renderEslintTier(tier, rows) -> source text
│   ├── files.mjs                        renderJsonExport(...), renderFunctionExport(...)
│   └── write.mjs                        writeBundle(rows, provenance, outDir)
├── src/lib/body-config.mjs              loadBodyConfig(cwd), validateBodyConfig(config, schema), mergeLocal(config, local)
├── src/lib/observe/
│   ├── version.mjs                      versionDrift(bodyDir, run)
│   ├── pointers.mjs                     pointerDrift(bodyDir, templates)
│   └── code.mjs                         codeDrift(bodyDir, bundleDir, prediction, exec)
├── src/commands/reconcile.mjs           orrery reconcile <repoA> <repoB> [--sample surface=path] [--out <dir>]
├── src/commands/observe.mjs             orrery observe <bodyDir>... [--predict] [--report <dir>]
├── physics/                             generated by reconcile; committed
├── classes/next-supabase-mono/          generated by reconcile; committed; schema.mjs hand-written
└── templates/next-supabase-mono/        pointer files init will write; observe compares bytes
fixtures/next-supabase-mono/             the fixture body
docs/decisions/0004-eslint.md … 0014-*.md   generated ruling records
docs/predictions/<body>.json             committed predictions
docs/observations/<date>-tooling.md      observation reports
```

Rows are the single shape every reconciler emits:

```javascript
// { tool: "eslint", surface: "source" | "component" | "unit-test" | "e2e" | "script" | "package" | "*",
//   key: "sonarjs/cognitive-complexity", a: <value|null>, b: <value|null>,
//   chosen: <value> | { $parameter: "tailwind.entryPoint" } | null,
//   test: "agree" | "adopt" | "inert" | "strictest" | "consistency" | "benefit" | "parameter" | "residue",
//   tier: "physics" | "class" | "local" | null, note: "" }
```

`chosen` markers (`$union`, `$fromSide`, `$parameter`) are namespaced with a `$` prefix so an ordinary
rule option happening to be named `union`, `fromSide`, or `parameter` can never be mistaken for one.

---

### Task 1: Surfaces and the donor reader

**Files:**
- Create: `packages/orrery/src/lib/surfaces.mjs`
- Create: `packages/orrery/src/lib/donors.mjs`
- Test: `packages/orrery/tests/surfaces.test.mjs`
- Test: `packages/orrery/tests/donors.test.mjs`

**Interfaces:**
- Consumes: `readEffectiveConfig(repoDir, file, exec?)` from `src/lib/effective-config.mjs` (Phase 2a).
- Produces:
  - `SURFACES`: ordered array of `{ name, patterns: string[], exclude: RegExp }`.
  - `findSurfaceSamples(repoDir, overrides = {}) => { [surface]: relativePath }` — deterministic: for each surface, the first path in sorted `globSync` order across the patterns that does not match `exclude`; an override wins and must exist; throws naming the surface and patterns tried when nothing matches.
  - `readDonor(repoDir, samples, exec?) => Promise<Donor>` where `Donor = { dir, sha, eslint: { [surface]: effectiveConfig }, tsconfig, stylelint, prettier, secretlint, jscpd, cspell, knip, syncpack, lintStaged, hooks: { preCommit, prePush } }`; each non-eslint field is the parsed file or `null` when absent; JSONC (cspell) is parsed with comments stripped; `.mjs` configs (stylelint) are imported as modules; `.ls-lint.yml` is read as text (ls-lint is generated, not reconciled).

- [ ] **Step 1: Write the failing tests**

```javascript
// packages/orrery/tests/surfaces.test.mjs
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { SURFACES, findSurfaceSamples } from "../src/lib/surfaces.mjs";

let repo;
const touch = (rel) => {
  fs.mkdirSync(path.join(repo, path.dirname(rel)), { recursive: true });
  fs.writeFileSync(path.join(repo, rel), "");
};
beforeEach(() => { repo = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-surf-")); });
afterEach(() => fs.rmSync(repo, { recursive: true, force: true }));

describe("SURFACES", () => {
  it("names the six surfaces in a fixed order", () => {
    expect(SURFACES.map((s) => s.name)).toEqual(["source", "component", "unit-test", "e2e", "script", "package"]);
  });
});

describe("findSurfaceSamples", () => {
  it("picks the first sorted match per surface and skips tests, barrels and declarations", () => {
    touch("apps/z/src/features/b/z.ts");
    touch("apps/a/src/features/a/index.ts");
    touch("apps/a/src/features/a/types.d.ts");
    touch("apps/a/src/features/a/use-thing.test.ts");
    touch("apps/a/src/features/a/use-thing.ts");
    touch("apps/a/src/features/a/tile.tsx");
    touch("apps/a/tests/one.test.ts");
    touch("apps/a/e2e/home.spec.ts");
    touch("scripts/build.mjs");
    touch("packages/core/src/index.ts");
    touch("packages/core/src/thing.ts");
    expect(findSurfaceSamples(repo)).toEqual({
      source: "apps/a/src/features/a/use-thing.ts",
      component: "apps/a/src/features/a/tile.tsx",
      "unit-test": "apps/a/tests/one.test.ts",
      e2e: "apps/a/e2e/home.spec.ts",
      script: "scripts/build.mjs",
      package: "packages/core/src/thing.ts",
    });
  });

  it("finds e2e specs under tests/e2e as well", () => {
    touch("apps/hub/tests/e2e/a11y.spec.ts");
    expect(findSurfaceSamples(repo, { source: null, component: null, "unit-test": null, script: null, package: null }).e2e).toBe("apps/hub/tests/e2e/a11y.spec.ts");
  });

  it("honours an override and requires it to exist", () => {
    touch("apps/a/src/features/a/x.ts");
    touch("custom/file.ts");
    const r = findSurfaceSamples(repo, { source: "custom/file.ts", component: null, "unit-test": null, e2e: null, script: null, package: null });
    expect(r.source).toBe("custom/file.ts");
    expect(() => findSurfaceSamples(repo, { source: "custom/missing.ts", component: null, "unit-test": null, e2e: null, script: null, package: null })).toThrow(/override .*custom\/missing\.ts.* does not exist/);
  });

  it("throws naming the surface and the patterns when nothing matches", () => {
    expect(() => findSurfaceSamples(repo)).toThrow(/no sample for surface "source".*apps\/\*\/src\/features/);
  });

  it("uses forward slashes on every platform", () => {
    touch("apps/a/src/features/a/x.ts");
    const r = findSurfaceSamples(repo, { component: null, "unit-test": null, e2e: null, script: null, package: null });
    expect(r.source).not.toContain("\\");
  });
});
```

```javascript
// packages/orrery/tests/donors.test.mjs
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { readDonor, stripJsonComments } from "../src/lib/donors.mjs";

let repo;
const write = (rel, text) => {
  fs.mkdirSync(path.join(repo, path.dirname(rel)), { recursive: true });
  fs.writeFileSync(path.join(repo, rel), text);
};
beforeEach(() => { repo = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-donor-")); });
afterEach(() => fs.rmSync(repo, { recursive: true, force: true }));

describe("stripJsonComments", () => {
  it("removes line and block comments but not slashes inside strings", () => {
    const text = '{ // c\n "a": "http://x", /* b */ "b": 1 }';
    expect(JSON.parse(stripJsonComments(text))).toEqual({ a: "http://x", b: 1 });
  });
});

describe("readDonor", () => {
  it("reads one effective eslint config per surface and every static config, null when absent", async () => {
    write("tsconfig.base.json", '{"compilerOptions":{"strict":true}}');
    write("cspell.json", '{ "version": "0.2", // words\n "words": ["orrery"] }');
    write(".jscpd.json", '{"threshold":5}');
    write("knip.json", '{"workspaces":{}}');
    write(".syncpackrc.json", '{"versionGroups":[]}');
    write(".secretlintrc.json", '{"rules":[]}');
    write("package.json", '{"name":"x","prettier":{"endOfLine":"auto"},"lint-staged":{"*.ts":["eslint"]}}');
    write(".husky/pre-commit", "pnpm lint-staged\n");
    write("stylelint.config.mjs", 'export default { rules: { "color-no-invalid-hex": true } };');
    const exec = (dir, file) => JSON.stringify({ rules: { [`for:${file}`]: ["error"] } });
    const run = (cmd, args) => (args[0] === "rev-parse" ? "abc1234\n" : "");
    const donor = await readDonor(repo, { source: "a.ts", component: "b.tsx" }, { exec, run });
    expect(donor.sha).toBe("abc1234");
    expect(donor.eslint.source.rules["for:a.ts"]).toEqual(["error"]);
    expect(donor.eslint.component.rules["for:b.tsx"]).toEqual(["error"]);
    expect(donor.tsconfig.compilerOptions.strict).toBe(true);
    expect(donor.cspell.words).toEqual(["orrery"]);
    expect(donor.jscpd.threshold).toBe(5);
    expect(donor.knip.workspaces).toEqual({});
    expect(donor.syncpack.versionGroups).toEqual([]);
    expect(donor.secretlint.rules).toEqual([]);
    expect(donor.prettier).toEqual({ endOfLine: "auto" });
    expect(donor.lintStaged).toEqual({ "*.ts": ["eslint"] });
    expect(donor.hooks.preCommit).toBe("pnpm lint-staged\n");
    expect(donor.hooks.prePush).toBeNull();
    expect(donor.stylelint.rules["color-no-invalid-hex"]).toBe(true);
  });

  it("prefers tsconfig.base.json over tsconfig.json and .prettierrc over the package.json key", async () => {
    write("tsconfig.json", '{"compilerOptions":{"strict":false}}');
    write("tsconfig.base.json", '{"compilerOptions":{"strict":true}}');
    write(".prettierrc", '{"endOfLine":"lf"}');
    write("package.json", '{"name":"x","prettier":{"endOfLine":"auto"}}');
    const donor = await readDonor(repo, {}, { exec: () => "{}", run: () => "sha" });
    expect(donor.tsconfig.compilerOptions.strict).toBe(true);
    expect(donor.prettier).toEqual({ endOfLine: "lf" });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run packages/orrery/tests/surfaces.test.mjs packages/orrery/tests/donors.test.mjs`
Expected: FAIL — cannot resolve the two modules

- [ ] **Step 3: Write the implementation**

```javascript
// packages/orrery/src/lib/surfaces.mjs
import fs from "node:fs";
import path from "node:path";

// The six kinds of file whose resolved eslint config differs in the donors. Patterns are
// the layouts seen in the constellation; an override on the command line is authoritative.
const NOT_SOURCE = /(\.test\.|\.spec\.|\.d\.ts$|(^|\/)index\.tsx?$)/;

export const SURFACES = [
  { name: "source", patterns: ["apps/*/src/features/**/*.ts", "apps/*/src/**/*.ts"], exclude: NOT_SOURCE },
  { name: "component", patterns: ["apps/*/src/features/**/*.tsx", "apps/*/src/**/*.tsx"], exclude: NOT_SOURCE },
  { name: "unit-test", patterns: ["apps/*/tests/**/*.test.{ts,tsx}", "apps/*/src/**/*.test.{ts,tsx}"], exclude: /(^|\/)e2e\// },
  { name: "e2e", patterns: ["apps/*/e2e/**/*.spec.ts", "apps/*/tests/e2e/**/*.spec.ts"], exclude: /$^/ },
  { name: "script", patterns: ["scripts/*.mjs"], exclude: /\.d\.mts$/ },
  { name: "package", patterns: ["packages/*/src/**/*.ts"], exclude: NOT_SOURCE },
];

const toPosix = (p) => p.split(path.sep).join("/");

export function findSurfaceSamples(repoDirectory, overrides = {}) {
  const samples = {};
  for (const surface of SURFACES) {
    const override = overrides[surface.name];
    if (override === null) continue; // caller opted out of this surface (tests only)
    if (override) {
      if (!fs.existsSync(path.join(repoDirectory, override))) {
        throw new Error(`override for surface "${surface.name}" (${override}) does not exist in ${repoDirectory}`);
      }
      samples[surface.name] = toPosix(override);
      continue;
    }
    let found;
    for (const pattern of surface.patterns) {
      const matches = fs
        .globSync(pattern, { cwd: repoDirectory, exclude: (name) => name.includes("node_modules") })
        .map(toPosix)
        .filter((p) => !surface.exclude.test(p))
        .sort();
      if (matches.length > 0) { found = matches[0]; break; }
    }
    if (!found) {
      throw new Error(`no sample for surface "${surface.name}" in ${repoDirectory}; tried ${surface.patterns.join(", ")}`);
    }
    samples[surface.name] = found;
  }
  return samples;
}
```

```javascript
// packages/orrery/src/lib/donors.mjs
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { readEffectiveConfig } from "./effective-config.mjs";

export function stripJsonComments(text) {
  let out = "";
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];
    if (inString) {
      out += c;
      if (c === "\\") { out += next ?? ""; i++; continue; }
      if (c === '"') inString = false;
      continue;
    }
    if (c === '"') { inString = true; out += c; continue; }
    if (c === "/" && next === "/") { while (i < text.length && text[i] !== "\n") i++; out += "\n"; continue; }
    if (c === "/" && next === "*") { i += 2; while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++; i++; continue; }
    out += c;
  }
  return out;
}

const readText = (dir, rel) => (fs.existsSync(path.join(dir, rel)) ? fs.readFileSync(path.join(dir, rel), "utf8") : null);
const readJson = (dir, rel) => { const t = readText(dir, rel); return t === null ? null : JSON.parse(stripJsonComments(t)); };
const firstJson = (dir, rels) => { for (const rel of rels) { const v = readJson(dir, rel); if (v !== null) return v; } return null; };

async function importConfig(dir, rels) {
  for (const rel of rels) {
    const file = path.join(dir, rel);
    if (!fs.existsSync(file)) continue;
    const mod = await import(pathToFileURL(file).href + `?t=${Date.now()}`);
    return mod.default ?? mod;
  }
  return null;
}

function defaultRun(command, args, cwd) {
  return execFileSync(command, args, { cwd, encoding: "utf8" });
}

export async function readDonor(repoDirectory, samples, { exec, run = defaultRun } = {}) {
  const sha = run("git", ["rev-parse", "--short", "HEAD"], repoDirectory).trim();
  const eslint = {};
  for (const [surface, file] of Object.entries(samples)) {
    eslint[surface] = readEffectiveConfig(repoDirectory, file, exec);
  }
  const pkg = readJson(repoDirectory, "package.json") ?? {};
  return {
    dir: repoDirectory,
    sha,
    eslint,
    tsconfig: firstJson(repoDirectory, ["tsconfig.base.json", "tsconfig.json"]),
    stylelint: await importConfig(repoDirectory, ["stylelint.config.mjs", "stylelint.config.js"]),
    prettier: firstJson(repoDirectory, [".prettierrc", ".prettierrc.json"]) ?? pkg.prettier ?? null,
    secretlint: readJson(repoDirectory, ".secretlintrc.json"),
    jscpd: readJson(repoDirectory, ".jscpd.json"),
    cspell: readJson(repoDirectory, "cspell.json"),
    knip: readJson(repoDirectory, "knip.json"),
    syncpack: readJson(repoDirectory, ".syncpackrc.json"),
    lintStaged: pkg["lint-staged"] ?? null,
    lsLint: readText(repoDirectory, ".ls-lint.yml"),
    hooks: { preCommit: readText(repoDirectory, ".husky/pre-commit"), prePush: readText(repoDirectory, ".husky/pre-push") },
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run packages/orrery/tests/surfaces.test.mjs packages/orrery/tests/donors.test.mjs`
Expected: PASS — 6 + 3 tests

- [ ] **Step 5: Real-repo check, read-only**

Run from `Z:\Github\Orrery`:

```
node -e "import('./packages/orrery/src/lib/surfaces.mjs').then(m => { for (const r of ['Z:/Github/aeleos','Z:/Github/libra']) console.log(r, JSON.stringify(m.findSurfaceSamples(r), null, 1)); })"
```

Expected: the twelve paths in the "Verified before writing" table, exactly. If a path differs, the pattern order is wrong; fix the pattern, not the table, and record the actual path.

- [ ] **Step 6: Commit and land**

```bash
git checkout -b feat/2b-surfaces origin/develop
git add packages/orrery/src/lib/surfaces.mjs packages/orrery/src/lib/donors.mjs packages/orrery/tests/surfaces.test.mjs packages/orrery/tests/donors.test.mjs
git commit -m "feat(reconcile): surfaces and the donor reader [GH-000]"
git push -u origin HEAD
gh pr create --base develop --title "feat(reconcile): surfaces and the donor reader [GH-000]" --body "Task 1 of the 2b plan."
gh pr merge --squash --auto
```

---

### Task 2: The ordering: severity, ordinal options, exemptions, parameters, pre-rulings

Pure functions that decide one eslint rule. This is where the spec's ruling order lives; every branch has a test.

**Files:**
- Create: `packages/orrery/src/lib/reconcile/ordering.mjs`
- Test: `packages/orrery/tests/reconcile-ordering.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `severityOf(value) => "off"|"warn"|"error"`, `optionsOf(value) => any[]` (trailing empty objects stripped, `message` keys removed at any depth).
  - `ORDINAL_OPTIONS`: `{ [rule]: { at: index | key, lower: boolean } }` — which option is ordinal and whether lower is stricter.
  - `EXEMPTION_KEY = /^(allow|ignore|except|exempt|skip)/i`; `PARAMETER_KEYS = ["entryPoint", "elements", "patterns", "paths", "project", "tsconfigRootDir", "words", "packageDir"]`.
  - `PRE_RULINGS`: the table from "Verified before writing", keyed by rule, each `{ chosen | parameter, test, note }`.
  - `stricter(rule, a, b) => { chosen, test, note }` — the whole ordering for one conflicting rule.

- [ ] **Step 1: Write the failing test**

```javascript
// packages/orrery/tests/reconcile-ordering.test.mjs
import { describe, it, expect } from "vitest";
import { severityOf, optionsOf, stricter, PRE_RULINGS } from "../src/lib/reconcile/ordering.mjs";

describe("severityOf / optionsOf", () => {
  it("normalises numbers and strings and strips trailing empties and messages", () => {
    expect(severityOf(2)).toBe("error");
    expect(severityOf(["warn"])).toBe("warn");
    expect(optionsOf(["error", {}])).toEqual([]);
    expect(optionsOf(["error", { message: "x", object: "document" }])).toEqual([{ object: "document" }]);
    expect(optionsOf(["error", { patterns: [{ group: ["../*"], message: "no" }] }])).toEqual([{ patterns: [{ group: ["../*"] }] }]);
  });
});

describe("stricter: severity", () => {
  it("picks the higher severity when options agree", () => {
    expect(stricter("x", ["warn", { a: 1 }], ["error", { a: 1 }])).toEqual({ chosen: ["error", { a: 1 }], test: "strictest", note: "severity error over warn" });
  });
  it("treats off versus error as a severity flip, keeping the on side's options", () => {
    expect(stricter("sonarjs/deprecation", ["off"], ["error"]).chosen).toEqual(["error"]);
  });
});

describe("stricter: ordinal options", () => {
  it("takes the lower threshold and the higher severity independently", () => {
    const r = stricter("sonarjs/cyclomatic-complexity", ["off", { threshold: 10 }], ["error", { threshold: 15 }]);
    expect(r.chosen).toEqual(["error", { threshold: 10 }]);
    expect(r.test).toBe("strictest");
  });
  it("handles a positional ordinal option", () => {
    expect(stricter("sonarjs/cognitive-complexity", ["error", 20], ["error", 15]).chosen).toEqual(["error", 15]);
  });
  it("takes the lower maximum for max-lines family", () => {
    expect(stricter("sonarjs/max-lines", ["off", { maximum: 1000 }], ["error", { maximum: 400 }]).chosen).toEqual(["error", { maximum: 400 }]);
    expect(stricter("sonarjs/nested-control-flow", ["off", { maximumNestingLevel: 3 }], ["error", { maximumNestingLevel: 4 }]).chosen).toEqual(["error", { maximumNestingLevel: 3 }]);
  });
});

describe("stricter: exemptions", () => {
  it("prefers the side without exemption keys", () => {
    const r = stricter("@typescript-eslint/no-unused-vars", ["error"], ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }]);
    expect(r.chosen).toEqual(["error"]);
    expect(r.test).toBe("strictest");
    expect(r.note).toMatch(/no exemption/);
  });
  it("prefers allow-false over allow-true and drops an allow key one side lacks", () => {
    expect(stricter("x", ["error", { allowMultiline: true }], ["error"]).chosen).toEqual(["error"]);
    expect(stricter("x", ["error", { allowShortCircuit: true }], ["error", { allowShortCircuit: false }]).chosen).toEqual(["error", { allowShortCircuit: false }]);
  });
  it("prefers the side without a nested onlyIfContainsSeparator exemption", () => {
    const a = ["error", { hexadecimal: { minimumDigits: 0, groupLength: 2, onlyIfContainsSeparator: true } }];
    const b = ["error", { hexadecimal: { minimumDigits: 0, groupLength: 2 } }];
    expect(stricter("unicorn/numeric-separators-style", a, b).chosen).toEqual(b);
  });
});

describe("stricter: parameters", () => {
  it("marks project data as a parameter and keeps the stricter severity", () => {
    const r = stricter("better-tailwindcss/no-conflicting-classes", ["error"], ["error", { entryPoint: "apps/store/src/app/globals.css" }]);
    expect(r.chosen).toEqual(["error", { entryPoint: { $parameter: "tailwind.entryPoint" } }]);
    expect(r.test).toBe("parameter");
  });
  it("splits no-restricted-imports into the universal pattern and alias parameters", () => {
    const a = ["error", { patterns: [{ group: ["../*"] }] }];
    const b = ["error", { patterns: [{ group: ["@ui/*"] }, { group: ["@shared/*"] }] }];
    const r = stricter("no-restricted-imports", a, b);
    expect(r.chosen).toEqual(["error", { patterns: [{ group: ["../*"] }, { $parameter: "imports.restrictedPatterns" }] }]);
    expect(r.test).toBe("parameter");
  });
});

describe("stricter: pre-rulings and residue", () => {
  it("applies a pre-ruling for a non-ordinal tie", () => {
    const r = stricter("unicorn/number-literal-case", ["error", { hexadecimalValue: "lowercase" }], ["error", { hexadecimalValue: "uppercase" }]);
    expect(r.chosen).toEqual(["error", { hexadecimalValue: "uppercase" }]);
    expect(r.test).toBe("consistency");
  });
  it("returns residue when nothing decides", () => {
    const r = stricter("some/rule", ["error", { style: "a" }], ["error", { style: "b" }]);
    expect(r.chosen).toBeNull();
    expect(r.test).toBe("residue");
  });
  it("every pre-ruling names its test", () => {
    for (const [rule, ruling] of Object.entries(PRE_RULINGS)) {
      expect(["strictest", "consistency", "benefit", "parameter"]).toContain(ruling.test);
      expect(ruling.note.length, rule).toBeGreaterThan(10);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run packages/orrery/tests/reconcile-ordering.test.mjs`
Expected: FAIL — cannot resolve `../src/lib/reconcile/ordering.mjs`

- [ ] **Step 3: Write the implementation**

```javascript
// packages/orrery/src/lib/reconcile/ordering.mjs
// The ruling order for one eslint rule: stricter wins; if strictness is undefined, the
// pre-ruled consistency/benefit table; project data is a parameter; anything left is residue.

const SEVERITY = { 0: "off", 1: "warn", 2: "error", off: "off", warn: "warn", error: "error" };
const RANK = { off: 0, warn: 1, error: 2 };

export const severityOf = (value) => SEVERITY[Array.isArray(value) ? value[0] : value] ?? "off";

const isEmptyObject = (v) => v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0;

function stripMessages(value) {
  if (Array.isArray(value)) return value.map(stripMessages);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).filter(([k]) => k !== "message").map(([k, v]) => [k, stripMessages(v)]));
  }
  return value;
}

export function optionsOf(value) {
  const options = (Array.isArray(value) ? value.slice(1) : []).map(stripMessages);
  while (options.length > 0 && isEmptyObject(options.at(-1))) options.pop();
  return options;
}

export const ORDINAL_OPTIONS = {
  "sonarjs/cognitive-complexity": { at: 0, lower: true },
  "sonarjs/cyclomatic-complexity": { at: "threshold", lower: true },
  "sonarjs/expression-complexity": { at: "max", lower: true },
  "sonarjs/max-lines": { at: "maximum", lower: true },
  "sonarjs/max-lines-per-function": { at: "maximum", lower: true },
  "sonarjs/nested-control-flow": { at: "maximumNestingLevel", lower: true },
  "sonarjs/no-nested-functions": { at: "threshold", lower: true },
  "sonarjs/no-duplicate-string": { at: "threshold", lower: true },
  "max-params": { at: 0, lower: true },
  "max-depth": { at: 0, lower: true },
  "complexity": { at: 0, lower: true },
};

// Anywhere in the key: `argsIgnorePattern`, `allowShortCircuit`, `onlyIfContainsSeparator` all count.
export const EXEMPTION_KEY = /(allow|ignore|except|exempt|skip|onlyIf)/i;
export const PARAMETER_KEYS = ["entryPoint", "elements", "patterns", "paths", "project", "tsconfigRootDir", "words", "packageDir"];

const PARAMETER_NAME = {
  entryPoint: "tailwind.entryPoint",
  elements: "boundaries.elements",
  rules: "boundaries.allow",
  patterns: "imports.restrictedPatterns",
  words: "i18n.excludedWords",
};

export const PRE_RULINGS = {
  "unicorn/number-literal-case": {
    chosen: ["error", { hexadecimalValue: "uppercase" }],
    test: "consistency",
    note: "strictness undefined; uppercase is the plugin default and what four of five bodies run",
  },
  "i18next/no-literal-string": {
    chosen: ["error", {
      mode: "all",
      "should-validate-template": true,
      "jsx-attributes": { include: { $union: "jsx-attributes.include" } },
      ignoreAttribute: { $fromSide: "b" },
      words: { exclude: { $parameter: "i18n.excludedWords" } },
    }],
    test: "benefit",
    note: "mode all and the union of checked attributes are strictest; ignoreAttribute keeps libra's list because attribute names such as className are not user-facing text; excluded words are body data",
  },
  "sonarjs/no-duplicate-string": {
    chosen: ["error", { threshold: 2, ignoreStrings: { $union: "ignoreStrings", join: "|" } }],
    test: "benefit",
    note: "threshold 2 is strictest; ignoreStrings is the union because both sides exempt machine strings (MIME types, CSS variables, Tailwind classes), not code",
  },
  "boundaries/dependencies": {
    chosen: ["error", { default: "disallow", rules: { $parameter: "boundaries.allow", base: "a" } }],
    test: "parameter",
    note: "aeleos's layered policy (domain/application/presentation) is the class base because it is stricter; each body's extra element types and their allowed edges are parameters",
  },
  "boundaries/elements": {
    chosen: [{ $parameter: "boundaries.elements", base: "class" }],
    test: "parameter",
    note: "element paths are body data on top of the class's standard app/features/shared/proxy layout",
  },
};

const resolve = (options, ordinal) => (typeof ordinal.at === "number" ? options[ordinal.at] : options[0]?.[ordinal.at]);
const withOrdinal = (options, ordinal, value) => {
  const copy = options.map((o) => (o && typeof o === "object" ? { ...o } : o));
  if (typeof ordinal.at === "number") copy[ordinal.at] = value;
  else copy[0] = { ...(copy[0] ?? {}), [ordinal.at]: value };
  return copy;
};

// Returns "a" | "b" | "equal" | undefined (undefined = incomparable).
function exemptionOrder(a, b) {
  if (a === undefined && b === undefined) return "equal";
  if (isEmptyObject(a) || a === undefined) return typeof b === "object" && b !== null && hasExemption(b) ? "a" : undefined;
  if (isEmptyObject(b) || b === undefined) return typeof a === "object" && a !== null && hasExemption(a) ? "b" : undefined;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return undefined;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let winner = "equal";
  for (const key of keys) {
    let local;
    const va = a[key];
    const vb = b[key];
    if (JSON.stringify(va) === JSON.stringify(vb)) continue;
    if (EXEMPTION_KEY.test(key)) {
      if (typeof va === "boolean" || typeof vb === "boolean") local = (va ?? false) === false ? "a" : (vb ?? false) === false ? "b" : undefined;
      else local = va === undefined || (Array.isArray(va) && va.length === 0) ? "a" : vb === undefined || (Array.isArray(vb) && vb.length === 0) ? "b" : undefined;
    } else if (va && vb && typeof va === "object" && typeof vb === "object" && !Array.isArray(va)) {
      local = exemptionOrder(va, vb);
    }
    if (local === undefined) return undefined;
    if (local === "equal") continue;
    if (winner === "equal") winner = local;
    else if (winner !== local) return undefined;
  }
  return winner;
}

const hasExemption = (o) => Object.keys(o).some((k) => EXEMPTION_KEY.test(k) || (o[k] && typeof o[k] === "object" && !Array.isArray(o[k]) && hasExemption(o[k])));

function parameterise(rule, optionsA, optionsB) {
  const [oa = {}, ob = {}] = [optionsA[0], optionsB[0]];
  if (typeof oa !== "object" || typeof ob !== "object") return null;
  const keys = new Set([...Object.keys(oa), ...Object.keys(ob)]);
  const param = [...keys].find((k) => PARAMETER_KEYS.includes(k));
  if (!param) return null;
  if (rule === "no-restricted-imports") {
    const universal = [...(oa.patterns ?? []), ...(ob.patterns ?? [])].filter((p) => (p.group ?? []).some((g) => g.startsWith("../")));
    return [{ patterns: [...universal, { $parameter: PARAMETER_NAME.patterns }] }];
  }
  const merged = { ...oa, ...ob };
  merged[param] = { $parameter: PARAMETER_NAME[param] ?? param };
  for (const k of Object.keys(merged)) if (k !== param && EXEMPTION_KEY.test(k)) delete merged[k];
  return [merged];
}

export function stricter(rule, a, b) {
  const sevA = severityOf(a);
  const sevB = severityOf(b);
  const severity = RANK[sevA] >= RANK[sevB] ? sevA : sevB;
  const optionsA = optionsOf(a);
  const optionsB = optionsOf(b);
  const sameOptions = JSON.stringify(optionsA) === JSON.stringify(optionsB);

  if (PRE_RULINGS[rule]) return { ...PRE_RULINGS[rule] };

  if (sameOptions) {
    return { chosen: [severity, ...optionsA], test: "strictest", note: `severity ${severity} over ${sevA === severity ? sevB : sevA}` };
  }
  if (sevA === "off" && optionsA.length === 0) return { chosen: [severity, ...optionsB], test: "strictest", note: "switched on" };
  if (sevB === "off" && optionsB.length === 0) return { chosen: [severity, ...optionsA], test: "strictest", note: "switched on" };

  const parameterised = parameterise(rule, optionsA, optionsB);
  if (parameterised) return { chosen: [severity, ...parameterised], test: "parameter", note: "project data becomes a body parameter; the stricter severity is kept" };

  const ordinal = ORDINAL_OPTIONS[rule];
  if (ordinal) {
    const va = resolve(optionsA, ordinal);
    const vb = resolve(optionsB, ordinal);
    if (typeof va === "number" && typeof vb === "number") {
      const value = ordinal.lower ? Math.min(va, vb) : Math.max(va, vb);
      const base = value === va ? optionsA : optionsB;
      return { chosen: [severity, ...withOrdinal(base, ordinal, value)], test: "strictest", note: `${typeof ordinal.at === "number" ? "value" : ordinal.at} ${value} is the ${ordinal.lower ? "lower" : "higher"} bound` };
    }
    if (typeof va === "number" && vb === undefined) return { chosen: [severity, ...optionsA], test: "strictest", note: "only one side bounds it" };
    if (typeof vb === "number" && va === undefined) return { chosen: [severity, ...optionsB], test: "strictest", note: "only one side bounds it" };
  }

  const order = exemptionOrder(optionsA[0], optionsB[0]);
  if (order === "a") return { chosen: [severity, ...optionsA], test: "strictest", note: "no exemption over an exemption" };
  if (order === "b") return { chosen: [severity, ...optionsB], test: "strictest", note: "no exemption over an exemption" };

  return { chosen: null, test: "residue", note: "strictness undefined and no pre-ruling; needs a consistency or benefit ruling" };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run packages/orrery/tests/reconcile-ordering.test.mjs`
Expected: PASS — 14 tests

- [ ] **Step 5: Commit and land**

```bash
git checkout -b feat/2b-ordering origin/develop
git add packages/orrery/src/lib/reconcile/ordering.mjs packages/orrery/tests/reconcile-ordering.test.mjs
git commit -m "feat(reconcile): the ruling order for one eslint rule [GH-000]"
git push -u origin HEAD && gh pr create --base develop --title "feat(reconcile): the ruling order for one eslint rule [GH-000]" --body "Task 2 of the 2b plan." && gh pr merge --squash --auto
```

---

### Task 3: Tiers and the eslint reconciler

**Files:**
- Create: `packages/orrery/src/lib/reconcile/tiers.mjs`
- Create: `packages/orrery/src/lib/reconcile/eslint.mjs`
- Test: `packages/orrery/tests/reconcile-tiers.test.mjs`
- Test: `packages/orrery/tests/reconcile-eslint.test.mjs`

**Interfaces:**
- Consumes: `diffRules` (2a `rule-diff.mjs`); `stricter`, `severityOf` (Task 2).
- Produces:
  - `TIER_BY_PLUGIN` and `tierOf(rule) => "physics" | "class"`; throws on an unknown plugin prefix so a new plugin cannot slip in unplaced.
  - `reconcileEslint(eslintA, eslintB) => rows` where `eslintA/B = { [surface]: effectiveConfig }`; one row per `(surface, rule)`; `agree` rows carry the shared value; `adopt` rows carry the one side's value; `inert` rows (off on one side, absent on the other) carry `chosen: null` and `tier: null`; conflicts go through `stricter`.

- [ ] **Step 1: Write the failing tests**

```javascript
// packages/orrery/tests/reconcile-tiers.test.mjs
import { describe, it, expect } from "vitest";
import { tierOf, TIER_BY_PLUGIN } from "../src/lib/reconcile/tiers.mjs";

describe("tierOf", () => {
  it.each([
    ["no-var", "physics"], ["@typescript-eslint/no-unused-vars", "physics"], ["sonarjs/cognitive-complexity", "physics"],
    ["unicorn/filename-case", "physics"], ["security/detect-object-injection", "physics"], ["unused-imports/no-unused-imports", "physics"],
    ["import/no-cycle", "class"], ["jsdoc/require-jsdoc", "physics"], ["tsdoc/syntax", "physics"], ["boundaries/dependencies", "class"],
    ["@next/next/no-img-element", "class"], ["react/jsx-key", "class"], ["react-hooks/exhaustive-deps", "class"], ["jsx-a11y/alt-text", "class"],
    ["better-tailwindcss/no-conflicting-classes", "class"], ["@tanstack/query/exhaustive-deps", "class"], ["i18next/no-literal-string", "class"],
    ["testing-library/no-node-access", "class"], ["playwright/no-skipped-test", "class"], ["vitest/no-focused-tests", "class"],
  ])("%s -> %s", (rule, tier) => { expect(tierOf(rule)).toBe(tier); });

  it("throws on an unknown plugin so nothing lands unplaced", () => {
    expect(() => tierOf("mystery/rule")).toThrow(/unknown plugin "mystery"/);
  });

  it("places boundaries in the class because the layout it names is the class's layout", () => {
    expect(TIER_BY_PLUGIN.boundaries).toBe("class");
  });
});
```

```javascript
// packages/orrery/tests/reconcile-eslint.test.mjs
import { describe, it, expect } from "vitest";
import { reconcileEslint } from "../src/lib/reconcile/eslint.mjs";

const cfg = (rules) => ({ rules });

describe("reconcileEslint", () => {
  it("emits one row per surface and rule with the deciding test", () => {
    const a = { source: cfg({ "no-var": ["error"], "sonarjs/cognitive-complexity": ["error", 20], "jsdoc/require-jsdoc": ["error"], "@stylistic/semi": ["off"] }) };
    const b = { source: cfg({ "no-var": [2], "sonarjs/cognitive-complexity": ["error", 15], "react/jsx-key": ["error"] }) };
    const rows = reconcileEslint(a, b);
    const by = Object.fromEntries(rows.map((r) => [r.key, r]));
    expect(by["no-var"]).toMatchObject({ surface: "source", test: "agree", chosen: ["error"], tier: "physics" });
    expect(by["sonarjs/cognitive-complexity"]).toMatchObject({ test: "strictest", chosen: ["error", 15], tier: "physics" });
    expect(by["jsdoc/require-jsdoc"]).toMatchObject({ test: "adopt", chosen: ["error"], tier: "physics", a: ["error"], b: null });
    expect(by["react/jsx-key"]).toMatchObject({ test: "adopt", chosen: ["error"], tier: "class" });
    expect(by["@stylistic/semi"]).toMatchObject({ test: "inert", chosen: null, tier: null });
  });

  it("keeps surfaces separate", () => {
    const a = { source: cfg({ "no-var": ["error"] }), "unit-test": cfg({ "no-var": ["off"] }) };
    const b = { source: cfg({ "no-var": ["error"] }), "unit-test": cfg({ "no-var": ["error"] }) };
    const rows = reconcileEslint(a, b);
    expect(rows.filter((r) => r.key === "no-var").map((r) => [r.surface, r.test])).toEqual([["source", "agree"], ["unit-test", "strictest"]]);
  });

  it("is sorted by surface order then rule name so output is stable", () => {
    const a = { "unit-test": cfg({ b: ["error"] }), source: cfg({ z: ["error"], a: ["error"] }) };
    const b = { "unit-test": cfg({ b: ["error"] }), source: cfg({ z: ["error"], a: ["error"] }) };
    expect(reconcileEslint(a, b).map((r) => `${r.surface}:${r.key}`)).toEqual(["source:a", "source:z", "unit-test:b"]);
  });

  it("marks residue rows with tier still assigned", () => {
    const a = { source: cfg({ "some/x": ["error", { style: "a" }] }) };
    const b = { source: cfg({ "some/x": ["error", { style: "b" }] }) };
    expect(() => reconcileEslint(a, b)).toThrow(/unknown plugin "some"/);
    const rows = reconcileEslint({ source: cfg({ "unicorn/x": ["error", { style: "a" }] }) }, { source: cfg({ "unicorn/x": ["error", { style: "b" }] }) });
    expect(rows[0]).toMatchObject({ test: "residue", chosen: null, tier: "physics" });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run packages/orrery/tests/reconcile-tiers.test.mjs packages/orrery/tests/reconcile-eslint.test.mjs`
Expected: FAIL — cannot resolve the two modules

- [ ] **Step 3: Write the implementation**

```javascript
// packages/orrery/src/lib/reconcile/tiers.mjs
// The boundary rule: physics is true for a repository that does not exist yet; a plugin that
// needs Next.js, React, Tailwind, TanStack Query, i18n, Playwright or Vitest to make sense is class.
// `boundaries` is class because the element layout it encodes (app/features/shared/proxy) is the
// class's layout. `@stylistic`, `vue`, `flowtype`, `babel`, `standard` appear only as `off` from
// eslint-config-prettier; they are placed so an explicit shared `off` has a home.
export const TIER_BY_PLUGIN = {
  core: "physics",
  "@typescript-eslint": "physics",
  sonarjs: "physics",
  unicorn: "physics",
  security: "physics",
  "unused-imports": "physics",
  // `import/*` rules reach both donors through eslint-config-next, which bundles eslint-plugin-import;
  // neither donor depends on the plugin directly, so the rules live where the plugin arrives.
  import: "class",
  jsdoc: "physics",
  tsdoc: "physics",
  "@stylistic": "physics",
  "@stylistic/js": "physics",
  "@stylistic/ts": "physics",
  "@stylistic/jsx": "physics",
  standard: "physics",
  babel: "physics",
  "@babel": "physics",
  boundaries: "class",
  "@next/next": "class",
  react: "class",
  "react-hooks": "class",
  "jsx-a11y": "class",
  "better-tailwindcss": "class",
  "@tanstack/query": "class",
  i18next: "class",
  "testing-library": "class",
  playwright: "class",
  vitest: "class",
  vue: "class",
  flowtype: "class",
};

export function pluginOf(rule) {
  if (!rule.includes("/")) return "core";
  return rule.slice(0, rule.lastIndexOf("/"));
}

export function tierOf(rule) {
  const plugin = pluginOf(rule);
  const tier = TIER_BY_PLUGIN[plugin];
  if (!tier) throw new Error(`unknown plugin "${plugin}" for rule ${rule}; add it to TIER_BY_PLUGIN with a boundary-rule justification`);
  return tier;
}
```

```javascript
// packages/orrery/src/lib/reconcile/eslint.mjs
import { diffRules } from "../rule-diff.mjs";
import { SURFACES } from "../surfaces.mjs";
import { stricter, optionsOf } from "./ordering.mjs";
import { tierOf } from "./tiers.mjs";

const SURFACE_ORDER = SURFACES.map((s) => s.name);
const compare = (x, y) => (x < y ? -1 : x > y ? 1 : 0);

export function reconcileEslint(eslintA, eslintB) {
  const rows = [];
  const surfaces = [...new Set([...Object.keys(eslintA), ...Object.keys(eslintB)])].sort(
    (x, y) => SURFACE_ORDER.indexOf(x) - SURFACE_ORDER.indexOf(y)
  );
  for (const surface of surfaces) {
    const a = eslintA[surface] ?? { rules: {} };
    const b = eslintB[surface] ?? { rules: {} };
    const d = diffRules(a, b);
    const row = (key, extra) => ({ tool: "eslint", surface, key, a: a.rules[key] ?? null, b: b.rules[key] ?? null, note: "", ...extra });
    for (const key of d.agree) rows.push(row(key, { chosen: a.rules[key], test: "agree", tier: tierOf(key) }));
    for (const { rule, value } of d.onlyA) rows.push(row(rule, { chosen: value, test: "adopt", tier: tierOf(rule) }));
    for (const { rule, value } of d.onlyB) rows.push(row(rule, { chosen: value, test: "adopt", tier: tierOf(rule) }));
    for (const rule of [...d.offOnlyA, ...d.offOnlyB]) rows.push(row(rule, { chosen: null, test: "inert", tier: null }));
    for (const { rule } of d.conflict) {
      const { chosen, test, note } = stricter(rule, a.rules[rule], b.rules[rule]);
      rows.push(row(rule, { chosen: resolveMarkers(chosen, optionsOf(a.rules[rule]), optionsOf(b.rules[rule])), test, tier: tierOf(rule), note }));
    }
  }
  return rows.sort((x, y) => SURFACE_ORDER.indexOf(x.surface) - SURFACE_ORDER.indexOf(y.surface) || compare(x.key, y.key));
}

// Pre-rulings carry markers that need both sides' real values: { $union: "key" } (the union of
// that key's arrays from both sides; `join` turns it into one string), { $fromSide: "a"|"b" }.
// { $parameter } markers survive: the bundle writer turns them into body config reads.
export function resolveMarkers(value, optionsA, optionsB) {
  const at = (options, key) => key.split(".").reduce((o, k) => o?.[k], options[0] ?? {});
  const walk = (v, keyPath) => {
    if (Array.isArray(v)) return v.map((x, i) => walk(x, keyPath));
    if (v && typeof v === "object") {
      if ("$union" in v) {
        const both = [].concat(at(optionsA, v.$union) ?? [], at(optionsB, v.$union) ?? []);
        const items = v.join ? both.flatMap((s) => String(s).split(v.join)) : both;
        const unique = [...new Set(items)].sort();
        return v.join ? unique.join(v.join) : unique;
      }
      if ("$fromSide" in v) return at(v.$fromSide === "a" ? optionsA : optionsB, keyPath) ?? null;
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x, keyPath ? `${keyPath}.${k}` : k)]));
    }
    return v;
  };
  return value === null ? null : walk(value, "");
}
```

Add to the test file, inside `describe("reconcileEslint")`:

```javascript
  it("resolves union and fromSide markers from the pre-rulings against both sides' options", () => {
    const a = { source: cfg({ "sonarjs/no-duplicate-string": [0, { threshold: 3, ignoreStrings: "application/json" }] }) };
    const b = { source: cfg({ "sonarjs/no-duplicate-string": [2, { threshold: 2, ignoreStrings: "var\\(--x\\)|text-[a-z-]+" }] }) };
    const [r] = reconcileEslint(a, b);
    expect(r.chosen).toEqual(["error", { threshold: 2, ignoreStrings: "application/json|text-[a-z-]+|var\\(--x\\)" }]);
    expect(r.test).toBe("benefit");
  });
```

and change the import line to `import { reconcileEslint } from "../src/lib/reconcile/eslint.mjs";` plus `import { optionsOf } from "./ordering.mjs";` at the top of `eslint.mjs` (it is already imported there for the resolver).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run packages/orrery/tests/reconcile-tiers.test.mjs packages/orrery/tests/reconcile-eslint.test.mjs`
Expected: PASS — 22 + 5 tests (the four above plus the marker-resolution test added below)

- [ ] **Step 5: Commit and land**

```bash
git checkout -b feat/2b-eslint-reconcile origin/develop
git add packages/orrery/src/lib/reconcile/tiers.mjs packages/orrery/src/lib/reconcile/eslint.mjs packages/orrery/tests/reconcile-tiers.test.mjs packages/orrery/tests/reconcile-eslint.test.mjs
git commit -m "feat(reconcile): tier placement and the eslint reconciler [GH-000]"
git push -u origin HEAD && gh pr create --base develop --title "feat(reconcile): tier placement and the eslint reconciler [GH-000]" --body "Task 3 of the 2b plan." && gh pr merge --squash --auto
```

---

### Task 4: The non-eslint reconcilers

Each tool has its own meaning of "stricter" (spec table). Every reconciler is pure, takes the two donors' parsed configs, and emits rows with `tool` set and `surface: "*"`.

**Files:**
- Create: `packages/orrery/src/lib/reconcile/tsconfig.mjs`
- Create: `packages/orrery/src/lib/reconcile/stylelint.mjs`
- Create: `packages/orrery/src/lib/reconcile/simple.mjs`
- Create: `packages/orrery/src/lib/reconcile/knip.mjs`
- Create: `packages/orrery/src/lib/reconcile/syncpack.mjs`
- Test: `packages/orrery/tests/reconcile-tools.test.mjs`

**Interfaces:**
- Consumes: nothing from other tasks except the row shape.
- Produces: `reconcileTsconfig(a, b)`, `reconcileStylelint(a, b)`, `reconcilePrettier(a, b)`, `reconcileSecretlint(a, b)`, `reconcileJscpd(a, b)`, `reconcileCspell(a, b)`, `reconcileLintStaged(a, b)`, `reconcileHooks(a, b)`, `reconcileLsLint()`, `reconcileKnip(a, b)`, `reconcileSyncpack(a, b)`; each `=> rows`. A `null` donor config means "absent", which yields `adopt` rows for the other side.

- [ ] **Step 1: Write the failing test**

```javascript
// packages/orrery/tests/reconcile-tools.test.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, it, expect } from "vitest";
import { reconcileTsconfig } from "../src/lib/reconcile/tsconfig.mjs";
import { reconcileStylelint } from "../src/lib/reconcile/stylelint.mjs";
import { reconcilePrettier, reconcileSecretlint, reconcileJscpd, reconcileCspell, reconcileLintStaged, reconcileHooks, reconcileLsLint } from "../src/lib/reconcile/simple.mjs";
import { reconcileKnip } from "../src/lib/reconcile/knip.mjs";
import { reconcileSyncpack } from "../src/lib/reconcile/syncpack.mjs";

const by = (rows) => Object.fromEntries(rows.map((r) => [r.key, r]));

// Real donor checkouts, siblings of this repo on disk. Not part of any package; read-only,
// and absent in CI, where the assertion is skipped rather than faked.
const here = path.dirname(fileURLToPath(import.meta.url));
const aeleosStylelintPath = path.resolve(here, "../../../../aeleos/stylelint.config.mjs");
const libraStylelintPath = path.resolve(here, "../../../../libra/stylelint.config.mjs");
const hasStylelintDonors = fs.existsSync(aeleosStylelintPath) && fs.existsSync(libraStylelintPath);

describe("tsconfig", () => {
  it("turns strictness flags on, compares enums case-insensitively, and parameterises paths", () => {
    const a = { compilerOptions: { target: "ES2023", module: "ESNext", strict: true, noUnusedLocals: false, types: ["node"] }, include: ["tests/**/*.ts"] };
    const b = { compilerOptions: { target: "ES2023", module: "esnext", strict: true, noUnusedLocals: true, jsx: "react-jsx", lib: ["dom", "esnext"], ignoreDeprecations: "6.0" } };
    const r = by(reconcileTsconfig(a, b));
    expect(r["compilerOptions.strict"]).toMatchObject({ test: "agree", chosen: true, tier: "physics" });
    expect(r["compilerOptions.noUnusedLocals"]).toMatchObject({ test: "strictest", chosen: true, tier: "physics" });
    expect(r["compilerOptions.module"]).toMatchObject({ test: "agree", chosen: "esnext", tier: "physics" });
    expect(r["compilerOptions.jsx"]).toMatchObject({ test: "adopt", chosen: "react-jsx", tier: "class" });
    expect(r["compilerOptions.lib"]).toMatchObject({ test: "adopt", tier: "class" });
    expect(r["compilerOptions.ignoreDeprecations"]).toMatchObject({ test: "adopt", tier: "class" });
    expect(r["compilerOptions.types"]).toMatchObject({ test: "parameter", chosen: { $parameter: "tsconfig.types" } });
    expect(r["include"]).toMatchObject({ test: "parameter" });
  });
  it("treats skipLibCheck false as stricter and allowJs false as stricter", () => {
    const r = by(reconcileTsconfig({ compilerOptions: { skipLibCheck: true, allowJs: true } }, { compilerOptions: { skipLibCheck: false, allowJs: false } }));
    expect(r["compilerOptions.skipLibCheck"].chosen).toBe(false);
    expect(r["compilerOptions.allowJs"].chosen).toBe(false);
  });
  it("leaves a differing enum as residue", () => {
    const r = by(reconcileTsconfig({ compilerOptions: { target: "ES2022" } }, { compilerOptions: { target: "ES2023" } }));
    expect(r["compilerOptions.target"]).toMatchObject({ test: "residue", chosen: null });
  });
});

describe("stylelint", () => {
  it("switches a rule on when either side has it on, unions extends, and unions ignoreAtRules", () => {
    const a = { extends: ["stylelint-config-standard"], rules: { "no-duplicate-selectors": null, "selector-attribute-name-disallowed-list": [["class"]], "at-rule-no-unknown": [true, { ignoreAtRules: ["tailwind", "utility"] }] } };
    const b = { extends: ["stylelint-config-standard", "stylelint-config-tailwindcss"], rules: { "no-duplicate-selectors": true, "at-rule-no-unknown": [true, { ignoreAtRules: ["tailwind", "theme"] }] } };
    const r = by(reconcileStylelint(a, b));
    expect(r["rules.no-duplicate-selectors"]).toMatchObject({ test: "strictest", chosen: true, tier: "class" });
    expect(r["rules.selector-attribute-name-disallowed-list"]).toMatchObject({ test: "adopt", chosen: [["class"]] });
    expect(r["rules.at-rule-no-unknown"]).toMatchObject({ test: "benefit", chosen: [true, { ignoreAtRules: ["tailwind", "theme", "utility"] }] });
    expect(r["extends"]).toMatchObject({ test: "strictest", chosen: ["stylelint-config-standard", "stylelint-config-tailwindcss"] });
  });
  it("leaves two different non-null values as residue", () => {
    const r = by(reconcileStylelint({ rules: { x: "a" } }, { rules: { x: "b" } }));
    expect(r["rules.x"]).toMatchObject({ test: "residue" });
  });
  it("treats an explicit null against an absent key as the preset's on, not residue", () => {
    const r = by(reconcileStylelint({ rules: { "no-duplicate-selectors": null } }, { rules: {} }));
    expect(r["rules.no-duplicate-selectors"]).toMatchObject({ test: "strictest", chosen: { $inherit: true } });
  });
  it("and the mirror with sides swapped", () => {
    const r = by(reconcileStylelint({ rules: {} }, { rules: { "no-duplicate-selectors": null } }));
    expect(r["rules.no-duplicate-selectors"]).toMatchObject({ test: "strictest", chosen: { $inherit: true } });
  });
  it.skipIf(!hasStylelintDonors)("has no residue against the real donors' stylelint configs", async () => {
    const aeleosConfig = (await import(pathToFileURL(aeleosStylelintPath).href)).default;
    const libraConfig = (await import(pathToFileURL(libraStylelintPath).href)).default;
    const rows = reconcileStylelint(aeleosConfig, libraConfig);
    expect(rows.some((r) => r.test === "residue")).toBe(false);
  });
});

describe("simple tools", () => {
  it("prettier and secretlint agree when identical and are physics", () => {
    expect(by(reconcilePrettier({ endOfLine: "auto" }, { endOfLine: "auto" })).endOfLine).toMatchObject({ test: "agree", tier: "physics" });
    expect(by(reconcileSecretlint({ rules: [{ id: "x" }] }, { rules: [{ id: "x" }] })).rules).toMatchObject({ test: "agree", tier: "physics" });
    expect(by(reconcilePrettier({ endOfLine: "auto" }, { endOfLine: "lf" })).endOfLine).toMatchObject({ test: "residue" });
  });
  it("jscpd takes the lower threshold, unions formats, and unions ignores as class data", () => {
    const r = by(reconcileJscpd({ threshold: 5, format: ["typescript"], ignore: ["**/scripts/**", "**/tests/**"] }, { threshold: 4, format: ["typescript", "tsx"], ignore: ["**/.next/**", "**/tests/**"] }));
    expect(r.threshold).toMatchObject({ test: "strictest", chosen: 4, tier: "physics" });
    expect(r.format).toMatchObject({ test: "strictest", chosen: ["tsx", "typescript"] });
    expect(r.ignore).toMatchObject({ test: "benefit", chosen: ["**/.next/**", "**/scripts/**", "**/tests/**"], tier: "class" });
  });
  it("cspell lifts the identical header, unions ignorePaths, and parameterises words", () => {
    const r = by(reconcileCspell({ version: "0.2", language: "en,en-GB", allowCompoundWords: true, ignorePaths: ["node_modules"], words: ["aeleos"] }, { version: "0.2", language: "en,en-GB", allowCompoundWords: true, ignorePaths: ["node_modules", ".next"], words: ["libra"] }));
    expect(r.version).toMatchObject({ test: "agree", tier: "physics" });
    expect(r.ignorePaths).toMatchObject({ test: "benefit", chosen: [".next", "node_modules"], tier: "class" });
    expect(r.words).toMatchObject({ test: "parameter", chosen: { $parameter: "spelling" } });
  });
  it("lint-staged unions extensions per group and keeps the more specific secretlint invocation", () => {
    const r = by(reconcileLintStaged(
      { "*.{ts,tsx,js,jsx,mjs}": ["prettier --check", "eslint --max-warnings=0 --no-warn-ignored", "secretlint --no-glob"], "*.{json,md}": ["prettier --check"] },
      { "*.{ts,tsx,js,jsx,mjs,cjs}": ["prettier --check", "eslint --max-warnings=0 --no-warn-ignored", "secretlint"], "*.{json,md,css,yml,yaml}": ["prettier --check"] }
    ));
    expect(r["*.{cjs,js,jsx,mjs,ts,tsx}"]).toMatchObject({ test: "strictest", chosen: ["prettier --check", "eslint --max-warnings=0 --no-warn-ignored", "secretlint --no-glob"], tier: "physics" });
    expect(r["*.{css,json,md,yaml,yml}"]).toMatchObject({ test: "strictest", chosen: ["prettier --check"] });
  });
  it("hooks: pre-commit is lint-staged plus each body's own checks as a parameter", () => {
    const r = by(reconcileHooks({ preCommit: "pnpm lint-staged --concurrent false --no-stash --no-revert\npnpm check:docs --staged\npnpm check:agent-notes --staged\n" }, { preCommit: "pnpm lint-staged --concurrent false --no-stash --no-revert\npnpm sherif\npnpm syncpack:lint\n" }));
    expect(r["pre-commit.lint-staged"]).toMatchObject({ test: "agree", chosen: "pnpm lint-staged --concurrent false --no-stash --no-revert", tier: "physics" });
    expect(r["pre-commit.checks"]).toMatchObject({ test: "parameter", chosen: { $parameter: "hooks.preCommit" }, a: ["pnpm check:docs --staged", "pnpm check:agent-notes --staged"], b: ["pnpm sherif", "pnpm syncpack:lint"] });
  });
  it("ls-lint is generated from ADR 0001, not reconciled", () => {
    const [row] = reconcileLsLint();
    expect(row).toMatchObject({ tool: "ls-lint", key: "ls", test: "strictest", tier: "physics" });
    expect(row.chosen["apps/*/src"][".ts"]).toBe("kebab-case");
    expect(row.chosen["apps/*/tests"][".tsx"]).toBe("kebab-case");
    expect(row.note).toMatch(/ADR 0001/);
  });
});

describe("knip", () => {
  it("keeps entries common to every app workspace as class defaults and the rest as body parameters", () => {
    const a = { workspaces: { "apps/hub": { entry: ["src/app/**/*.tsx", "src/features/*/index.ts", "tests/**/*.test.{ts,tsx}"] }, "packages/identity": { entry: ["tests/**/*.ts"] } } };
    const b = { workspaces: { "apps/store": { entry: ["src/app/**/*.{ts,tsx}", "src/features/*/index.ts", "src/shared/infrastructure/i18n/request.ts", "tests/**/*.{ts,tsx}"] }, "apps/admin": { entry: ["src/app/**/*.{ts,tsx}", "src/features/*/index.ts", "src/shared/infrastructure/i18n/request.ts", "tests/**/*.{ts,tsx}"] } } };
    const r = by(reconcileKnip(a, b));
    expect(r["apps.entry"]).toMatchObject({ test: "benefit", chosen: ["src/app/**/*.{ts,tsx}", "src/features/*/index.ts", "tests/**/*.{ts,tsx}"], tier: "class" });
    expect(r["apps.extraEntries"]).toMatchObject({ test: "parameter", chosen: { $parameter: "knip.apps.extraEntries" } });
    expect(r["apps.extraEntries"].b).toContain("src/shared/infrastructure/i18n/request.ts");
  });
  it("folds test-only package entries into the shared pattern", () => {
    const a = { workspaces: { "packages/identity": { entry: ["tests/**/*.test.ts"] } } };
    const b = { workspaces: { "packages/shared": { entry: ["tests/**/*.{ts,tsx}"] } } };
    const r = by(reconcileKnip(a, b));
    expect(r["packages.entry"]).toMatchObject({ chosen: ["tests/**/*.{ts,tsx}"] });
  });
});

describe("syncpack", () => {
  it("recognises the shared two-group policy and parameterises its data", () => {
    const a = { versionGroups: [{ packages: ["**"], dependencies: ["@aeleos/identity"], dependencyTypes: ["prod", "dev"], pinVersion: "workspace:*" }, { dependencies: ["@supabase/supabase-js"], dependencyTypes: ["peer"], isIgnored: true }] };
    const b = { versionGroups: [{ packages: ["**"], dependencies: ["api", "shared"], dependencyTypes: ["prod", "dev"], pinVersion: "workspace:*" }, { dependencies: ["react", "react-dom"], dependencyTypes: ["peer"], isIgnored: true }] };
    const r = by(reconcileSyncpack(a, b));
    expect(r["versionGroups.workspace"]).toMatchObject({ test: "agree", tier: "physics" });
    expect(r["versionGroups.workspace.dependencies"]).toMatchObject({ test: "parameter", chosen: { $parameter: "workspacePackages" } });
    expect(r["versionGroups.floatingPeers.dependencies"]).toMatchObject({ test: "parameter", chosen: { $parameter: "floatingPeers" } });
  });
  it("leaves a third group as residue", () => {
    const extra = { versionGroups: [{ packages: ["**"], dependencies: ["x"], dependencyTypes: ["prod", "dev"], pinVersion: "workspace:*" }, { dependencies: ["y"], dependencyTypes: ["peer"], isIgnored: true }, { label: "odd", dependencies: ["z"] }] };
    expect(reconcileSyncpack(extra, extra).some((r) => r.test === "residue")).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run packages/orrery/tests/reconcile-tools.test.mjs`
Expected: FAIL — cannot resolve the modules

- [ ] **Step 3: Write the implementations**

Shared helpers live at the top of `simple.mjs` and are imported by the others.

```javascript
// packages/orrery/src/lib/reconcile/simple.mjs
export const row = (tool, key, extra) => ({ tool, surface: "*", key, a: null, b: null, chosen: null, test: "agree", tier: "physics", note: "", ...extra });
export const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);
export const union = (...lists) => [...new Set(lists.flat().filter((v) => v !== undefined && v !== null))].sort();

// Two identical values agree; one absent adopts the other; two different values are residue.
export function liftKey(tool, key, a, b, tier = "physics") {
  if (a === undefined && b === undefined) return null;
  if (same(a, b)) return row(tool, key, { a, b, chosen: a, test: "agree", tier });
  if (a === undefined) return row(tool, key, { a: null, b, chosen: b, test: "adopt", tier });
  if (b === undefined) return row(tool, key, { a, b: null, chosen: a, test: "adopt", tier });
  return row(tool, key, { a, b, chosen: null, test: "residue", tier, note: "values differ and the tool has no strictness order for this key" });
}

const liftAll = (tool, a, b, tier) =>
  union(Object.keys(a ?? {}), Object.keys(b ?? {})).map((key) => liftKey(tool, key, a?.[key], b?.[key], tier)).filter(Boolean);

export const reconcilePrettier = (a, b) => liftAll("prettier", a, b, "physics");
export const reconcileSecretlint = (a, b) => liftAll("secretlint", a, b, "physics");

export function reconcileJscpd(a, b) {
  const rows = [];
  a ??= {}; b ??= {};
  const thresholds = [a.threshold, b.threshold].filter((t) => typeof t === "number");
  if (thresholds.length) rows.push(row("jscpd", "threshold", { a: a.threshold ?? null, b: b.threshold ?? null, chosen: Math.min(...thresholds), test: thresholds.length === 2 && a.threshold !== b.threshold ? "strictest" : "agree", note: "lower threshold is stricter" }));
  for (const key of ["format", "reporters"]) {
    if (a[key] || b[key]) rows.push(row("jscpd", key, { a: a[key] ?? null, b: b[key] ?? null, chosen: union(a[key] ?? [], b[key] ?? []), test: same(a[key], b[key]) ? "agree" : "strictest", note: "checking more formats is stricter" }));
  }
  if (a.ignore || b.ignore) rows.push(row("jscpd", "ignore", { a: a.ignore ?? null, b: b.ignore ?? null, chosen: union(a.ignore ?? [], b.ignore ?? []), test: "benefit", tier: "class", note: "the union: every excluded path is generated or framework boilerplate, not our code; body extras via ignore.duplication" }));
  for (const key of union(Object.keys(a), Object.keys(b)).filter((k) => !["threshold", "format", "reporters", "ignore"].includes(k))) {
    rows.push(liftKey("jscpd", key, a[key], b[key], "class"));
  }
  return rows;
}

export function reconcileCspell(a, b) {
  const rows = [];
  a ??= {}; b ??= {};
  for (const key of ["version", "language", "allowCompoundWords"]) {
    const r = liftKey("cspell", key, a[key], b[key], "physics");
    if (r) rows.push(r);
  }
  for (const key of ["ignorePaths", "flagWords", "ignoreWords"]) {
    if (a[key] || b[key]) rows.push(row("cspell", key, { a: a[key] ?? null, b: b[key] ?? null, chosen: union(a[key] ?? [], b[key] ?? []), test: "benefit", tier: "class", note: "union of paths that are generated or vendored" }));
  }
  rows.push(row("cspell", "words", { a: a.words ?? null, b: b.words ?? null, chosen: { $parameter: "spelling" }, test: "parameter", tier: "class", note: "a project's vocabulary is its data" }));
  return rows;
}

const parseGlob = (glob) => { const m = /^\*\.\{([^}]+)\}$/.exec(glob); return m ? m[1].split(",").map((s) => s.trim()) : null; };
const toolName = (command) => command.split(" ")[0];

export function reconcileLintStaged(a, b) {
  a ??= {}; b ??= {};
  const groups = new Map(); // key: sorted extension list -> commands
  const merge = (glob, commands) => {
    const exts = parseGlob(glob);
    if (!exts) return;
    const overlapping = [...groups.keys()].find((k) => k.some((e) => exts.includes(e)));
    const key = overlapping ? union(overlapping, exts) : union(exts);
    const existing = overlapping ? groups.get(overlapping) : [];
    if (overlapping) groups.delete(overlapping);
    const merged = [...existing];
    for (const command of commands) {
      const i = merged.findIndex((c) => toolName(c) === toolName(command));
      if (i === -1) merged.push(command);
      else if (command.length > merged[i].length) merged[i] = command; // the more specific invocation
    }
    groups.set(key, merged);
  };
  for (const [glob, commands] of Object.entries(a)) merge(glob, commands);
  for (const [glob, commands] of Object.entries(b)) merge(glob, commands);
  return [...groups.entries()].map(([exts, commands]) => row("lint-staged", `*.{${exts.join(",")}}`, { a, b, chosen: commands, test: "strictest", tier: "physics", note: "union of extensions and commands; for one tool the more specific invocation wins" }));
}

const hookLines = (text) => (text ?? "").split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#") && !/^(echo|exit|if|fi|then|\[|set )/.test(l) && !l.startsWith("STAGED") && !l.startsWith("HAS_"));

export function reconcileHooks(a, b) {
  const la = hookLines(a?.preCommit);
  const lb = hookLines(b?.preCommit);
  const lintStagedA = la.find((l) => l.includes("lint-staged"));
  const lintStagedB = lb.find((l) => l.includes("lint-staged"));
  const rows = [];
  rows.push(liftKey("hooks", "pre-commit.lint-staged", lintStagedA, lintStagedB, "physics"));
  rows.push(row("hooks", "pre-commit.checks", { a: la.filter((l) => l !== lintStagedA), b: lb.filter((l) => l !== lintStagedB), chosen: { $parameter: "hooks.preCommit" }, test: "parameter", tier: "physics", note: "the hook runs lint-staged for everyone, then each body's own staged checks" }));
  return rows.filter(Boolean);
}

export function reconcileLsLint() {
  const kebab = { ".ts": "kebab-case", ".tsx": "kebab-case", ".js": "kebab-case", ".mjs": "kebab-case", ".css": "kebab-case", ".json": "kebab-case" };
  const ls = { "apps/*/src": kebab, "apps/*/tests": kebab, "apps/*/test": kebab, "apps/*/e2e": kebab, "packages/*/src": kebab, "packages/*/tests": kebab, scripts: { ".mjs": "kebab-case", ".html": "kebab-case" }, tests: { ".ts": "kebab-case" } };
  return [row("ls-lint", "ls", { chosen: ls, test: "strictest", tier: "physics", note: "kebab-case everywhere per ADR 0001; coverage extends to tests and e2e where 298 violations accumulated unobserved" })];
}
```

```javascript
// packages/orrery/src/lib/reconcile/tsconfig.mjs
import { row, same } from "./simple.mjs";

// true is stricter
const STRICT_TRUE = ["strict", "noUncheckedIndexedAccess", "noImplicitOverride", "noUnusedLocals", "noUnusedParameters", "verbatimModuleSyntax", "forceConsistentCasingInFileNames", "isolatedModules", "exactOptionalPropertyTypes", "noFallthroughCasesInSwitch", "noImplicitReturns", "noPropertyAccessFromIndexSignature", "noImplicitAny", "strictNullChecks"];
// false is stricter
const STRICT_FALSE = ["allowJs", "skipLibCheck"];
// capabilities: true when either side needs it; class tier
const CAPABILITY = ["esModuleInterop", "resolveJsonModule", "incremental", "noEmit", "allowSyntheticDefaultImports", "declaration", "sourceMap"];
const PHYSICS_ENUM = ["target", "module", "moduleResolution"];
const CLASS_ENUM = ["jsx", "lib", "ignoreDeprecations", "moduleDetection", "jsxImportSource"];
const PARAMETER = ["types", "paths", "baseUrl", "rootDir", "outDir", "typeRoots", "plugins"];
const PARAMETER_TOP = ["include", "exclude", "files", "references"];

const norm = (v) => (typeof v === "string" ? v.toLowerCase() : Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x.toLowerCase() : x)).sort() : v);

export function reconcileTsconfig(a, b) {
  const ca = a?.compilerOptions ?? {};
  const cb = b?.compilerOptions ?? {};
  const rows = [];
  const keys = [...new Set([...Object.keys(ca), ...Object.keys(cb)])].sort();
  for (const key of keys) {
    const va = ca[key];
    const vb = cb[key];
    const k = `compilerOptions.${key}`;
    const base = { a: va ?? null, b: vb ?? null };
    if (STRICT_TRUE.includes(key) || STRICT_FALSE.includes(key)) {
      const strictValue = STRICT_TRUE.includes(key);
      const chosen = va === strictValue || vb === strictValue ? strictValue : (va ?? vb);
      const test = same(va, vb) ? "agree" : va === undefined || vb === undefined ? (chosen === strictValue ? "strictest" : "adopt") : "strictest";
      rows.push(row("tsconfig", k, { ...base, chosen, test, tier: "physics", note: `${strictValue} is stricter` }));
    } else if (CAPABILITY.includes(key)) {
      rows.push(row("tsconfig", k, { ...base, chosen: va === true || vb === true ? true : (va ?? vb), test: same(va, vb) ? "agree" : "benefit", tier: "class", note: "a capability either side needs" }));
    } else if (PHYSICS_ENUM.includes(key) || CLASS_ENUM.includes(key)) {
      const tier = PHYSICS_ENUM.includes(key) ? "physics" : "class";
      if (va === undefined || vb === undefined) rows.push(row("tsconfig", k, { ...base, chosen: va ?? vb, test: "adopt", tier }));
      else if (same(norm(va), norm(vb))) rows.push(row("tsconfig", k, { ...base, chosen: norm(va), test: "agree", tier }));
      else rows.push(row("tsconfig", k, { ...base, chosen: null, test: "residue", tier, note: "differing enum with no strictness order" }));
    } else if (PARAMETER.includes(key)) {
      rows.push(row("tsconfig", k, { ...base, chosen: { $parameter: `tsconfig.${key}` }, test: "parameter", tier: "class", note: "per-app data" }));
    } else {
      rows.push(row("tsconfig", k, { ...base, chosen: null, test: "residue", tier: "class", note: "compiler option not classified; add it to tsconfig.mjs" }));
    }
  }
  for (const key of PARAMETER_TOP) {
    if (a?.[key] !== undefined || b?.[key] !== undefined) rows.push(row("tsconfig", key, { a: a?.[key] ?? null, b: b?.[key] ?? null, chosen: { $parameter: `tsconfig.${key}` }, test: "parameter", tier: "class", note: "per-app data" }));
  }
  return rows;
}
```

```javascript
// packages/orrery/src/lib/reconcile/stylelint.mjs
import { row, same, union } from "./simple.mjs";

// "off" is an explicit disable (null or false); "absent" is the key not being written at all,
// which leaves whatever `extends` set defaults to in force. The two used to be conflated —
// an explicit disable against an absent key looked identical to "neither side cares" and
// fell through to residue instead of the inherit ruling below.
const state = (v) => (v === undefined ? "absent" : v === null || v === false ? "off" : "on");

export function reconcileStylelint(a, b) {
  const rows = [];
  a ??= {}; b ??= {};
  if (a.extends || b.extends) rows.push(row("stylelint", "extends", { a: a.extends ?? null, b: b.extends ?? null, chosen: union([].concat(a.extends ?? []), [].concat(b.extends ?? [])), test: same(a.extends, b.extends) ? "agree" : "strictest", tier: "class", note: "more presets check more" }));
  const ra = a.rules ?? {};
  const rb = b.rules ?? {};
  for (const key of union(Object.keys(ra), Object.keys(rb))) {
    const va = ra[key];
    const vb = rb[key];
    const k = `rules.${key}`;
    const base = { a: va === undefined ? null : va, b: vb === undefined ? null : vb, tier: "class" };
    if (same(va, vb)) { rows.push(row("stylelint", k, { ...base, chosen: va, test: "agree" })); continue; }
    const sa = state(va);
    const sb = state(vb);
    // Explicit off against absent: the preset's own default (on) is stricter than the one
    // side that disabled it, so the bundle omits the key rather than writing `false`/`null`
    // and lets `extends` supply the rule.
    if (sa === "off" && sb === "absent") { rows.push(row("stylelint", k, { ...base, chosen: { $inherit: true }, test: "strictest", note: "a disabled a preset rule; the preset's default (on) is stricter, so the bundle omits the key and the preset applies" })); continue; }
    if (sb === "off" && sa === "absent") { rows.push(row("stylelint", k, { ...base, chosen: { $inherit: true }, test: "strictest", note: "b disabled a preset rule; the preset's default (on) is stricter, so the bundle omits the key and the preset applies" })); continue; }
    // On against absent: the side that wrote the rule adopts as-is.
    if (sa === "on" && sb === "absent") { rows.push(row("stylelint", k, { ...base, chosen: va, test: "adopt" })); continue; }
    if (sb === "on" && sa === "absent") { rows.push(row("stylelint", k, { ...base, chosen: vb, test: "adopt" })); continue; }
    // On against an explicit off: on wins outright.
    if (sa === "off" && sb === "on") { rows.push(row("stylelint", k, { ...base, chosen: vb, test: "strictest", note: "on over off" })); continue; }
    if (sb === "off" && sa === "on") { rows.push(row("stylelint", k, { ...base, chosen: va, test: "strictest", note: "on over off" })); continue; }
    if (key === "at-rule-no-unknown" && Array.isArray(va) && Array.isArray(vb)) {
      const merged = [true, { ...(va[1] ?? {}), ...(vb[1] ?? {}), ignoreAtRules: union(va[1]?.ignoreAtRules ?? [], vb[1]?.ignoreAtRules ?? []) }];
      rows.push(row("stylelint", k, { ...base, chosen: merged, test: "benefit", note: "union of Tailwind at-rules: every one listed exists in the framework and must parse" }));
      continue;
    }
    rows.push(row("stylelint", k, { ...base, chosen: null, test: "residue", note: (va === null || vb === null) ? "explicit off versus a non-boolean value" : "two different non-null values" }));
  }
  return rows;
}
```

```javascript
// packages/orrery/src/lib/reconcile/knip.mjs
import { row, union } from "./simple.mjs";

const normaliseEntry = (e) => e.replace("**/*.tsx", "**/*.{ts,tsx}").replace("**/*.test.{ts,tsx}", "**/*.{ts,tsx}").replace("**/*.test.ts", "**/*.{ts,tsx}");
const appWorkspaces = (config) => Object.entries(config?.workspaces ?? {}).filter(([name]) => name.startsWith("apps/"));
const packageWorkspaces = (config) => Object.entries(config?.workspaces ?? {}).filter(([name]) => name.startsWith("packages/"));

function common(workspaces, field) {
  const lists = workspaces.map(([, ws]) => (ws[field] ?? []).map(normaliseEntry));
  if (lists.length === 0) return [];
  return lists.reduce((acc, list) => acc.filter((e) => list.includes(e))).sort();
}

export function reconcileKnip(a, b) {
  const rows = [];
  for (const [kind, pick] of [["apps", appWorkspaces], ["packages", packageWorkspaces]]) {
    const all = [...pick(a), ...pick(b)];
    if (all.length === 0) continue;
    for (const field of ["entry", "project"]) {
      const shared = common(all, field);
      const extrasA = Object.fromEntries(pick(a).map(([n, ws]) => [n, (ws[field] ?? []).map(normaliseEntry).filter((e) => !shared.includes(e))]));
      const extrasB = Object.fromEntries(pick(b).map(([n, ws]) => [n, (ws[field] ?? []).map(normaliseEntry).filter((e) => !shared.includes(e))]));
      rows.push(row("knip", `${kind}.${field}`, { a: extrasA, b: extrasB, chosen: shared, test: "benefit", tier: "class", note: `${field} patterns every ${kind} workspace in both donors shares; the class convention` }));
      const flatA = union(...Object.values(extrasA));
      const flatB = union(...Object.values(extrasB));
      const extraName = { entry: "extraEntries", project: "extraProjects" }[field];
      if (flatA.length || flatB.length) rows.push(row("knip", `${kind}.${extraName}`, { a: flatA, b: flatB, chosen: { $parameter: `knip.${kind}.${extraName}` }, test: "parameter", tier: "class", note: "workspace-specific entries are body data" }));
    }
  }
  const root = (c) => c?.workspaces?.["."];
  if (root(a) || root(b)) rows.push(row("knip", "root", { a: root(a) ?? null, b: root(b) ?? null, chosen: { $parameter: "knip.root" }, test: "parameter", tier: "class", note: "the root workspace lists a body's own scripts and tests" }));
  return rows;
}
```

```javascript
// packages/orrery/src/lib/reconcile/syncpack.mjs
import { row, same } from "./simple.mjs";

const shape = (group) => { const { dependencies, label, ...rest } = group; return rest; };
const WORKSPACE = { packages: ["**"], dependencyTypes: ["prod", "dev"], pinVersion: "workspace:*" };
const PEERS = { dependencyTypes: ["peer"], isIgnored: true };

export function reconcileSyncpack(a, b) {
  const rows = [];
  const ga = a?.versionGroups ?? [];
  const gb = b?.versionGroups ?? [];
  const find = (groups, target) => groups.find((g) => same(shape(g), target));
  const wa = find(ga, WORKSPACE); const wb = find(gb, WORKSPACE);
  const pa = find(ga, PEERS); const pb = find(gb, PEERS);
  if (wa && wb) {
    rows.push(row("syncpack", "versionGroups.workspace", { a: shape(wa), b: shape(wb), chosen: WORKSPACE, test: "agree", tier: "physics", note: "workspace packages are reached by protocol, never by version" }));
    rows.push(row("syncpack", "versionGroups.workspace.dependencies", { a: wa.dependencies, b: wb.dependencies, chosen: { $parameter: "workspacePackages" }, test: "parameter", tier: "physics" }));
  }
  if (pa && pb) {
    rows.push(row("syncpack", "versionGroups.floatingPeers", { a: shape(pa), b: shape(pb), chosen: PEERS, test: "agree", tier: "physics", note: "peer dependencies in packages may float wider than apps pin" }));
    rows.push(row("syncpack", "versionGroups.floatingPeers.dependencies", { a: pa.dependencies, b: pb.dependencies, chosen: { $parameter: "floatingPeers" }, test: "parameter", tier: "physics" }));
  }
  for (const [side, groups] of [["a", ga], ["b", gb]]) {
    for (const g of groups) if (g !== wa && g !== wb && g !== pa && g !== pb) rows.push(row("syncpack", `versionGroups.${g.label ?? "unlabelled"}`, { [side]: g, chosen: null, test: "residue", tier: "physics", note: "a version group outside the two shared rules" }));
  }
  return rows;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run packages/orrery/tests/reconcile-tools.test.mjs`
Expected: PASS — 14 tests

- [ ] **Step 5: Commit and land**

```bash
git checkout -b feat/2b-tool-reconcilers origin/develop
git add packages/orrery/src/lib/reconcile/ packages/orrery/tests/reconcile-tools.test.mjs
git commit -m "feat(reconcile): tsconfig, stylelint, jscpd, cspell, lint-staged, hooks, ls-lint, knip, syncpack [GH-000]"
git push -u origin HEAD && gh pr create --base develop --title "feat(reconcile): the non-eslint reconcilers [GH-000]" --body "Task 4 of the 2b plan." && gh pr merge --squash --auto
```

---

### Task 5: Ruling records, `orrery reconcile`, and the real run

**Files:**
- Create: `packages/orrery/src/lib/records.mjs`
- Create: `packages/orrery/src/commands/reconcile.mjs`
- Modify: `packages/orrery/src/cli.mjs` (register `reconcile`; usage lines)
- Test: `packages/orrery/tests/records.test.mjs`
- Test: `packages/orrery/tests/reconcile-command.test.mjs`
- Create by running: `docs/decisions/rulings.json`, `docs/decisions/0004-eslint.md` … `docs/decisions/0015-hooks.md`

**Interfaces:**
- Consumes: `findSurfaceSamples`, `readDonor` (Task 1); every reconciler (Tasks 3–4).
- Produces:
  - `renderRecord({ number, tool, rows, provenance }) => markdown` — `provenance = { a: { name, dir, sha, samples }, b: {...}, date }`.
  - `RECORD_NUMBERS`: `{ eslint: 4, tsconfig: 5, stylelint: 6, prettier: 7, secretlint: 8, jscpd: 9, cspell: 10, "ls-lint": 11, knip: 12, syncpack: 13, "lint-staged": 14, hooks: 15 }`.
  - `orrery reconcile <repoA> <repoB> [--sample surface=path]... [--out docs/decisions] [--json]` — runs every reconciler, writes `rulings.json` (all rows plus provenance) and one record per tool; prints per-tool counts by test; exits `1` listing every `residue` row, `0` when there is none. Residue means the ordering needs a pre-ruling, which is a corner: stop and ask.

- [ ] **Step 1: Write the failing tests**

```javascript
// packages/orrery/tests/records.test.mjs
import { describe, it, expect } from "vitest";
import { renderRecord, RECORD_NUMBERS } from "../src/lib/records.mjs";

const provenance = { date: "2026-09-09", a: { name: "aeleos", dir: "Z:/Github/aeleos", sha: "aaa1111", samples: { source: "a.ts" } }, b: { name: "libra", dir: "Z:/Github/libra", sha: "bbb2222", samples: { source: "b.ts" } } };

describe("renderRecord", () => {
  const rows = [
    { tool: "eslint", surface: "source", key: "no-var", a: ["error"], b: [2], chosen: ["error"], test: "agree", tier: "physics", note: "" },
    { tool: "eslint", surface: "source", key: "sonarjs/max-lines", a: [0, { maximum: 1000 }], b: [2, { maximum: 400 }], chosen: ["error", { maximum: 400 }], test: "strictest", tier: "physics", note: "maximum 400 is the lower bound" },
    { tool: "eslint", surface: "source", key: "@stylistic/semi", a: ["off"], b: null, chosen: null, test: "inert", tier: null, note: "" },
    { tool: "eslint", surface: "unit-test", key: "x/y", a: ["error", { s: 1 }], b: ["error", { s: 2 }], chosen: null, test: "residue", tier: "physics", note: "needs a ruling" },
  ];
  const md = renderRecord({ number: 4, tool: "eslint", rows, provenance });

  it("has the ADR header, provenance and counts", () => {
    expect(md).toMatch(/^# ADR 0004 — eslint reconciliation/);
    expect(md).toContain("**Status:** accepted");
    expect(md).toContain("aeleos `aaa1111`");
    expect(md).toContain("| agree | 1 |");
    expect(md).toContain("| residue | 1 |");
  });

  it("has one table per surface with the two values, the ruling and the test", () => {
    expect(md).toContain("## source");
    expect(md).toContain("| `sonarjs/max-lines` | `[0,{\"maximum\":1000}]` | `[2,{\"maximum\":400}]` | `[\"error\",{\"maximum\":400}]` | strictest | physics | maximum 400 is the lower bound |");
    expect(md).not.toContain("## unit-test\n\n| key");
  });

  it("lists inert rules compactly and residue under its own heading", () => {
    expect(md).toContain("## Inert (off on one side, absent on the other)");
    expect(md).toContain("`@stylistic/semi`");
    expect(md).toContain("## Residue — needs a ruling");
    expect(md).toContain("`x/y`");
  });

  it("numbers every tool", () => {
    expect(RECORD_NUMBERS.eslint).toBe(4);
    expect(Object.keys(RECORD_NUMBERS)).toHaveLength(12);
  });
});
```

```javascript
// packages/orrery/tests/reconcile-command.test.mjs
import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import reconcile from "../src/commands/reconcile.mjs";

const quiet = () => {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  return { out: () => [...log.mock.calls, ...error.mock.calls].flat().join("\n"), restore: () => { log.mockRestore(); error.mockRestore(); } };
};

const donor = (name, rules) => ({ dir: `/${name}`, sha: name.slice(0, 7), eslint: { source: { rules } }, tsconfig: { compilerOptions: { strict: true } }, stylelint: null, prettier: { endOfLine: "auto" }, secretlint: null, jscpd: null, cspell: null, knip: null, syncpack: null, lintStaged: null, lsLint: null, hooks: { preCommit: null, prePush: null } });

describe("orrery reconcile", () => {
  it("exits 2 without two repositories", async () => {
    const q = quiet();
    expect(await reconcile(["only"])).toBe(2);
    expect(q.out()).toContain("usage: orrery reconcile <repoA> <repoB>");
    q.restore();
  });

  it("writes rulings.json and one record per tool, and exits 0 with no residue", async () => {
    const q = quiet();
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-rec-"));
    const code = await reconcile(["/a", "/b", "--out", out], {
      findSurfaceSamples: () => ({ source: "x.ts" }),
      readDonor: async (dir) => donor(dir === "/a" ? "aeleos1" : "libra11", { "no-var": ["error"] }),
    });
    expect(code).toBe(0);
    const rulings = JSON.parse(fs.readFileSync(path.join(out, "rulings.json"), "utf8"));
    expect(rulings.provenance.a.sha).toBe("aeleos1");
    expect(rulings.rows.some((r) => r.tool === "eslint" && r.key === "no-var" && r.test === "agree")).toBe(true);
    expect(fs.existsSync(path.join(out, "0004-eslint.md"))).toBe(true);
    expect(fs.existsSync(path.join(out, "0005-tsconfig.md"))).toBe(true);
    expect(q.out()).toMatch(/eslint\s+agree 1/);
    fs.rmSync(out, { recursive: true, force: true });
    q.restore();
  });

  it("exits 1 and names every residue row", async () => {
    const q = quiet();
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-rec-"));
    const code = await reconcile(["/a", "/b", "--out", out], {
      findSurfaceSamples: () => ({ source: "x.ts" }),
      readDonor: async (dir) => donor(dir, { "unicorn/x": ["error", { style: dir === "/a" ? "a" : "b" }] }),
    });
    expect(code).toBe(1);
    expect(q.out()).toMatch(/residue.*eslint source unicorn\/x/s);
    fs.rmSync(out, { recursive: true, force: true });
    q.restore();
  });

  it("passes --sample overrides through", async () => {
    const q = quiet();
    let seen;
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-rec-"));
    await reconcile(["/a", "/b", "--out", out, "--sample", "source=custom.ts", "--sample", "e2e=e.spec.ts"], {
      findSurfaceSamples: (dir, overrides) => { seen = overrides; return { source: "custom.ts" }; },
      readDonor: async (dir) => donor(dir, {}),
    });
    expect(seen).toEqual({ source: "custom.ts", e2e: "e.spec.ts" });
    fs.rmSync(out, { recursive: true, force: true });
    q.restore();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run packages/orrery/tests/records.test.mjs packages/orrery/tests/reconcile-command.test.mjs`
Expected: FAIL — cannot resolve the modules

- [ ] **Step 3: Write the implementation**

```javascript
// packages/orrery/src/lib/records.mjs
export const RECORD_NUMBERS = { eslint: 4, tsconfig: 5, stylelint: 6, prettier: 7, secretlint: 8, jscpd: 9, cspell: 10, "ls-lint": 11, knip: 12, syncpack: 13, "lint-staged": 14, hooks: 15 };

const TESTS = ["agree", "adopt", "strictest", "consistency", "benefit", "parameter", "inert", "residue"];
const cell = (v) => (v === null || v === undefined ? "—" : "`" + JSON.stringify(v).replaceAll("|", "\\|") + "`");
const pad = (n) => String(n).padStart(4, "0");

export function renderRecord({ number, tool, rows, provenance }) {
  const counts = Object.fromEntries(TESTS.map((t) => [t, rows.filter((r) => r.test === t).length]));
  const lines = [];
  lines.push(`# ADR ${pad(number)} — ${tool} reconciliation`);
  lines.push("");
  lines.push(`**Date:** ${provenance.date}`);
  lines.push("**Status:** accepted");
  lines.push("**Spec:** docs/specs/2026-09-08-phase-2b-reconciliation-design.md");
  lines.push(`**Generated by:** \`orrery reconcile\` from ${provenance.a.name} \`${provenance.a.sha}\` and ${provenance.b.name} \`${provenance.b.sha}\`. Do not edit by hand; re-run and re-commit.`);
  lines.push("");
  lines.push("Ruling order: stricter wins; if strictness is undefined, the more consistent option; then the option that benefits the code most. Project data is a parameter. `a` is " + provenance.a.name + ", `b` is " + provenance.b.name + ".");
  lines.push("");
  if (tool === "eslint") {
    lines.push("| surface | " + provenance.a.name + " sample | " + provenance.b.name + " sample |");
    lines.push("|---|---|---|");
    for (const s of Object.keys(provenance.a.samples)) lines.push(`| ${s} | \`${provenance.a.samples[s]}\` | \`${provenance.b.samples[s] ?? "—"}\` |`);
    lines.push("");
  }
  lines.push("| test | rows |");
  lines.push("|---|---|");
  for (const t of TESTS) lines.push(`| ${t} | ${counts[t]} |`);
  lines.push("");
  const surfaces = [...new Set(rows.map((r) => r.surface))];
  for (const surface of surfaces) {
    const table = rows.filter((r) => r.surface === surface && r.test !== "inert" && r.test !== "residue");
    if (table.length === 0) continue;
    lines.push(`## ${surface}`);
    lines.push("");
    lines.push(`| key | ${provenance.a.name} | ${provenance.b.name} | ruling | test | tier | note |`);
    lines.push("|---|---|---|---|---|---|---|");
    for (const r of table) lines.push(`| \`${r.key}\` | ${cell(r.a)} | ${cell(r.b)} | ${cell(r.chosen)} | ${r.test} | ${r.tier ?? "—"} | ${r.note} |`);
    lines.push("");
  }
  const inert = rows.filter((r) => r.test === "inert");
  if (inert.length) {
    lines.push("## Inert (off on one side, absent on the other)");
    lines.push("");
    lines.push("Behaviourally identical to absent on both sides; not emitted into the bundle.");
    lines.push("");
    for (const surface of surfaces) {
      const list = inert.filter((r) => r.surface === surface);
      if (list.length) lines.push(`- **${surface}:** ` + list.map((r) => "`" + r.key + "`").join(", "));
    }
    lines.push("");
  }
  const residue = rows.filter((r) => r.test === "residue");
  if (residue.length) {
    lines.push("## Residue — needs a ruling");
    lines.push("");
    for (const r of residue) lines.push(`- ${r.surface} \`${r.key}\`: ${provenance.a.name} ${cell(r.a)}, ${provenance.b.name} ${cell(r.b)} — ${r.note}`);
    lines.push("");
  }
  return lines.join("\n");
}
```

```javascript
// packages/orrery/src/commands/reconcile.mjs
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { findSurfaceSamples as realFind } from "../lib/surfaces.mjs";
import { readDonor as realReadDonor } from "../lib/donors.mjs";
import { reconcileEslint } from "../lib/reconcile/eslint.mjs";
import { reconcileTsconfig } from "../lib/reconcile/tsconfig.mjs";
import { reconcileStylelint } from "../lib/reconcile/stylelint.mjs";
import { reconcilePrettier, reconcileSecretlint, reconcileJscpd, reconcileCspell, reconcileLintStaged, reconcileHooks, reconcileLsLint } from "../lib/reconcile/simple.mjs";
import { reconcileKnip } from "../lib/reconcile/knip.mjs";
import { reconcileSyncpack } from "../lib/reconcile/syncpack.mjs";
import { renderRecord, RECORD_NUMBERS } from "../lib/records.mjs";

const USAGE = "usage: orrery reconcile <repoA> <repoB> [--sample surface=path]... [--out <dir>] [--json]";

const TOOLS = [
  ["eslint", (a, b) => reconcileEslint(a.eslint, b.eslint)],
  ["tsconfig", (a, b) => reconcileTsconfig(a.tsconfig, b.tsconfig)],
  ["stylelint", (a, b) => reconcileStylelint(a.stylelint, b.stylelint)],
  ["prettier", (a, b) => reconcilePrettier(a.prettier, b.prettier)],
  ["secretlint", (a, b) => reconcileSecretlint(a.secretlint, b.secretlint)],
  ["jscpd", (a, b) => reconcileJscpd(a.jscpd, b.jscpd)],
  ["cspell", (a, b) => reconcileCspell(a.cspell, b.cspell)],
  ["ls-lint", () => reconcileLsLint()],
  ["knip", (a, b) => reconcileKnip(a.knip, b.knip)],
  ["syncpack", (a, b) => reconcileSyncpack(a.syncpack, b.syncpack)],
  ["lint-staged", (a, b) => reconcileLintStaged(a.lintStaged, b.lintStaged)],
  ["hooks", (a, b) => reconcileHooks(a.hooks, b.hooks)],
];

export default async function reconcile(argv, deps = {}) {
  const { findSurfaceSamples = realFind, readDonor = realReadDonor, today = new Date() } = deps;
  let values, positionals;
  try {
    ({ values, positionals } = parseArgs({ args: argv, options: { sample: { type: "string", multiple: true, default: [] }, out: { type: "string", default: "docs/decisions" }, json: { type: "boolean", default: false } }, allowPositionals: true }));
  } catch (error) {
    console.error(`${error.message}\n${USAGE}`);
    return 2;
  }
  const [repoA, repoB] = positionals;
  if (!repoA || !repoB) { console.error(USAGE); return 2; }

  const overrides = {};
  for (const s of values.sample) {
    const [surface, file] = s.split("=");
    if (!surface || !file) { console.error(`bad --sample ${s}; expected surface=path\n${USAGE}`); return 2; }
    overrides[surface] = file;
  }

  try {
    const samplesA = findSurfaceSamples(repoA, overrides);
    const samplesB = findSurfaceSamples(repoB, overrides);
    const a = await readDonor(repoA, samplesA);
    const b = await readDonor(repoB, samplesB);
    const name = (dir) => path.basename(dir).toLowerCase();
    const provenance = { date: today.toISOString().slice(0, 10), a: { name: name(repoA), dir: repoA, sha: a.sha, samples: samplesA }, b: { name: name(repoB), dir: repoB, sha: b.sha, samples: samplesB } };

    const rows = [];
    fs.mkdirSync(values.out, { recursive: true });
    for (const [tool, run] of TOOLS) {
      const toolRows = run(a, b).map((r) => ({ ...r, tool }));
      rows.push(...toolRows);
      fs.writeFileSync(path.join(values.out, `${String(RECORD_NUMBERS[tool]).padStart(4, "0")}-${tool}.md`), renderRecord({ number: RECORD_NUMBERS[tool], tool, rows: toolRows, provenance }) + "\n");
      const counts = {};
      for (const r of toolRows) counts[r.test] = (counts[r.test] ?? 0) + 1;
      console.log(`${tool.padEnd(12)}${Object.entries(counts).map(([t, n]) => `${t} ${n}`).join("  ")}`);
    }
    fs.writeFileSync(path.join(values.out, "rulings.json"), JSON.stringify({ provenance, rows }, null, 2) + "\n");
    if (values.json) console.log(JSON.stringify({ provenance, rows }, null, 2));

    const residue = rows.filter((r) => r.test === "residue");
    if (residue.length > 0) {
      console.error(`\nresidue — ${residue.length} row(s) need a ruling before the bundle can be generated:`);
      for (const r of residue) console.error(`  ${r.tool} ${r.surface} ${r.key}: ${JSON.stringify(r.a)} vs ${JSON.stringify(r.b)}`);
      return 1;
    }
    return 0;
  } catch (error) {
    console.error(error.message);
    return 1;
  }
}
```

Register in `cli.mjs` like the other commands, with usage `  orrery reconcile <repoA> <repoB> [--sample surface=path]... [--out <dir>]` and `  reconcile     generate the ruling records and rulings.json from two donor repositories`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run packages/orrery/tests/records.test.mjs packages/orrery/tests/reconcile-command.test.mjs packages/orrery/tests/cli.test.mjs`
Expected: PASS — 4 + 4 new tests

- [ ] **Step 5: The real run, read-only**

```
pnpm orrery reconcile Z:/Github/aeleos Z:/Github/libra --out docs/decisions
```

Expected: twelve records written, `rulings.json` written, per-tool counts printed, exit 0. **If it exits 1 with residue, stop.** Residue means a rule the ordering cannot decide and that the pre-ruling table does not cover. Do not add a pre-ruling on your own judgment: report the residue rows verbatim and reply BLOCKED; the controller brings each one to the owner with the consistency and benefit arguments, and the ruling lands in `PRE_RULINGS` (Task 2's file) with its note before the run is repeated. Expected eslint totals from ADR 0002 on the `component` surface: agree 530, adopt 55, inert 370, and 55 conflicts split between strictest, parameter, consistency and benefit; the other five surfaces produce their own counts, record them in the report.

- [ ] **Step 6: Commit and land**

```bash
git checkout -b feat/2b-reconcile-records origin/develop
git add packages/orrery/src/lib/records.mjs packages/orrery/src/commands/reconcile.mjs packages/orrery/src/cli.mjs packages/orrery/tests/records.test.mjs packages/orrery/tests/reconcile-command.test.mjs docs/decisions/rulings.json docs/decisions/00*.md
git commit -m "feat(reconcile): ruling records and rulings.json from the two donors [GH-000]"
git push -u origin HEAD && gh pr create --base develop --title "feat(reconcile): ruling records and rulings.json from the two donors [GH-000]" --body "Task 5 of the 2b plan. Twelve generated records; no residue." && gh pr merge --squash --auto
```

---

### Task 6: The bundle: generated tiers, the body-config loader, the class schema

The rows become code. Physics exports rules and plugins per surface; the class assembles runnable configs (language options, surface globs, physics rules plus class rules, then `eslint.local.mjs`) as a function of the body's config. The non-eslint tools export functions returning plain config objects. Everything generated carries a header naming the donor commits and its record.

**Files:**
- Create: `packages/orrery/src/lib/bundle/plugins.mjs` — plugin prefix → import source; the dependency list
- Create: `packages/orrery/src/lib/bundle/eslint.mjs` — `renderPhysicsEslint(rows, provenance)`, `renderClassEslint(rows, provenance)`
- Create: `packages/orrery/src/lib/bundle/tools.mjs` — `renderTsconfig`, `renderStylelint`, `renderJson(tool)`, `renderFunction(tool)`
- Create: `packages/orrery/src/lib/bundle/write.mjs` — `writeBundle(rulings, packageDir)`
- Create: `packages/orrery/src/lib/body-config.mjs` — `loadBodyConfig(cwd)`, `validateBodyConfig(config, schema)`, `resolveParameter(config, path)`
- Create: `packages/orrery/classes/next-supabase-mono/schema.mjs` — hand-written: the fields a body may declare, with defaults
- Create: `packages/orrery/classes/next-supabase-mono/eslint.base.mjs` — hand-written: language options and settings per surface
- Modify: `packages/orrery/package.json` — `exports` for every tier path; `dependencies` for eslint, the plugins, and the tools
- Create: `packages/orrery/src/commands/bundle.mjs` — `orrery bundle [--rulings docs/decisions/rulings.json]`; registered in `cli.mjs`
- Test: `packages/orrery/tests/bundle.test.mjs`, `packages/orrery/tests/body-config.test.mjs`
- Create by running: `packages/orrery/physics/*`, `packages/orrery/classes/next-supabase-mono/*` (generated files only)

**Interfaces:**
- Consumes: `rulings.json` (Task 5): `{ provenance, rows }`.
- Produces:
  - `@vaoan/orrery/eslint` → `classes/next-supabase-mono/eslint.mjs` default export `(body?) => FlatConfig[]`; when `body` is omitted it calls `loadBodyConfig(process.cwd())`.
  - `@vaoan/orrery/eslint/physics` → `physics/eslint.mjs` exporting `PLUGINS` and `rules(surface, body)`.
  - `@vaoan/orrery/tsconfig` → `classes/next-supabase-mono/tsconfig.json` (extends `../../physics/tsconfig.json`).
  - `@vaoan/orrery/stylelint`, `/jscpd`, `/cspell`, `/knip`, `/syncpack`, `/lint-staged`, `/prettier`, `/secretlint`, `/ls-lint` → functions `(body?) => object` (prettier and secretlint are constants; ls-lint returns a YAML string).
  - `loadBodyConfig(cwd)`: walks up to the nearest `orrery.config.mjs`, imports it, validates it against the class schema, returns `{ root, config }`; throws naming unknown fields.
  - `resolveParameter(config, "tailwind.entryPoint")` reads a dotted path with the schema default when absent.
  - The class schema (hand-written, the only non-generated policy file in the class):

```javascript
// packages/orrery/classes/next-supabase-mono/schema.mjs
// The fields a body's orrery.config.mjs may carry. No field can hold a severity, a threshold
// or a rule name: a body adds data and adds rules, never loosens a shared rule.
export default {
  class: { type: "string", required: true, enum: ["next-supabase-mono"] },
  workspacePackages: { type: "string[]", default: [] },
  floatingPeers: { type: "string[]", default: [] },
  tailwind: { type: "object", fields: { entryPoint: { type: "string", required: true } } },
  boundaries: {
    type: "object",
    fields: {
      elements: { type: "object[]", default: [] },   // extra { type, pattern, mode? } on top of app/features/shared/proxy
      allow: { type: "object[]", default: [] },      // extra { from, to } edges
    },
  },
  imports: { type: "object", fields: { restrictedPatterns: { type: "object[]", default: [] } } },
  i18n: { type: "object", fields: { excludedWords: { type: "string[]", default: [] } } },
  spelling: { type: "string[]", default: [] },
  ignore: { type: "object", fields: { duplication: { type: "string[]", default: [] }, secrets: { type: "string[]", default: [] }, spelling: { type: "string[]", default: [] } } },
  knip: { type: "object", fields: { apps: { type: "object", fields: { extraEntries: { type: "string[]", default: [] }, extraProjects: { type: "string[]", default: [] } } }, packages: { type: "object", fields: { extraEntries: { type: "string[]", default: [] }, extraProjects: { type: "string[]", default: [] } } }, root: { type: "object", default: {} } } },
  tsconfig: { type: "object", fields: { types: { type: "string[]", default: [] }, include: { type: "string[]", default: [] }, exclude: { type: "string[]", default: ["node_modules"] }, paths: { type: "object", default: {} } } },
  hooks: { type: "object", fields: { preCommit: { type: "string[]", default: [] } } },
};
```

- [ ] **Step 1: Write the failing tests**

```javascript
// packages/orrery/tests/body-config.test.mjs
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadBodyConfig, validateBodyConfig, resolveParameter } from "../src/lib/body-config.mjs";
import schema from "../classes/next-supabase-mono/schema.mjs";

let dir;
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-body-")); });
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe("validateBodyConfig", () => {
  it("accepts a config that only carries declared fields", () => {
    expect(validateBodyConfig({ class: "next-supabase-mono", tailwind: { entryPoint: "apps/x/src/app/globals.css" }, spelling: ["x"] }, schema)).toEqual([]);
  });
  it("rejects unknown fields, wrong types, and a missing required field", () => {
    const errors = validateBodyConfig({ class: "next-supabase-mono", rules: { "no-var": "off" }, spelling: "x", tailwind: {} }, schema);
    expect(errors).toContain("unknown field rules");
    expect(errors).toContain("spelling must be string[]");
    expect(errors).toContain("tailwind.entryPoint is required");
  });
  it("rejects an unknown class", () => {
    expect(validateBodyConfig({ class: "node-lib" }, schema)).toContain("class must be one of next-supabase-mono");
  });
});

describe("loadBodyConfig", () => {
  it("walks up from a nested directory, validates, and returns the root", async () => {
    fs.writeFileSync(path.join(dir, "orrery.config.mjs"), 'export default { class: "next-supabase-mono", tailwind: { entryPoint: "apps/a/src/app/globals.css" } };');
    fs.mkdirSync(path.join(dir, "apps/a/src"), { recursive: true });
    const { root, config } = await loadBodyConfig(path.join(dir, "apps/a/src"));
    expect(fs.realpathSync(root)).toBe(fs.realpathSync(dir));
    expect(config.tailwind.entryPoint).toBe("apps/a/src/app/globals.css");
  });
  it("throws naming the field when the config is invalid", async () => {
    fs.writeFileSync(path.join(dir, "orrery.config.mjs"), 'export default { class: "next-supabase-mono", tailwind: { entryPoint: "x" }, severity: "error" };');
    await expect(loadBodyConfig(dir)).rejects.toThrow(/unknown field severity/);
  });
  it("throws when no config is found", async () => {
    await expect(loadBodyConfig(dir)).rejects.toThrow(/no orrery\.config\.mjs found/);
  });
});

describe("resolveParameter", () => {
  it("reads a dotted path and falls back to the schema default", () => {
    const config = { class: "next-supabase-mono", tailwind: { entryPoint: "g.css" } };
    expect(resolveParameter(config, "tailwind.entryPoint", schema)).toBe("g.css");
    expect(resolveParameter(config, "spelling", schema)).toEqual([]);
    expect(resolveParameter(config, "boundaries.allow", schema)).toEqual([]);
    expect(resolveParameter(config, "tsconfig.exclude", schema)).toEqual(["node_modules"]);
  });
});
```

```javascript
// packages/orrery/tests/bundle.test.mjs
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PLUGIN_SOURCES, dependenciesFor } from "../src/lib/bundle/plugins.mjs";
import { renderPhysicsEslint, renderClassEslint, literal } from "../src/lib/bundle/eslint.mjs";
import { renderTsconfig, renderStylelint, renderFunction } from "../src/lib/bundle/tools.mjs";
import { writeBundle } from "../src/lib/bundle/write.mjs";

const provenance = { date: "2026-09-09", a: { name: "aeleos", sha: "aaa1111" }, b: { name: "libra", sha: "bbb2222" } };
const row = (extra) => ({ tool: "eslint", surface: "source", key: "no-var", a: null, b: null, chosen: ["error"], test: "agree", tier: "physics", note: "", ...extra });

describe("literal", () => {
  it("renders parameters as body reads and everything else as stable JSON", () => {
    expect(literal(["error", { entryPoint: { $parameter: "tailwind.entryPoint" } }])).toBe('["error", { "entryPoint": body.tailwind.entryPoint }]');
    expect(literal(["error", { patterns: [{ group: ["../*"] }, { $parameter: "imports.restrictedPatterns" }] }])).toBe('["error", { "patterns": [{ "group": ["../*"] }, ...body.imports.restrictedPatterns] }]');
    expect(literal({ b: 1, a: [2] })).toBe('{ "a": [2], "b": 1 }');
  });
});

describe("renderPhysicsEslint", () => {
  it("emits plugin imports, one rules object per surface, and no off-only rules", () => {
    const rows = [
      row({ key: "no-var" }),
      row({ key: "sonarjs/cognitive-complexity", chosen: ["error", 15], test: "strictest" }),
      row({ key: "@stylistic/semi", chosen: ["off"], test: "agree" }),
      row({ key: "@typescript-eslint/no-unused-vars", surface: "unit-test", chosen: ["off"], test: "strictest" }),
      row({ key: "react/jsx-key", tier: "class" }),
      row({ key: "unicorn/x", chosen: null, test: "inert", tier: null }),
    ];
    const src = renderPhysicsEslint(rows, provenance);
    expect(src).toMatch(/^\/\/ GENERATED by orrery reconcile from aeleos aaa1111 and libra bbb2222 on 2026-09-09/);
    expect(src).toContain('import sonarjs from "eslint-plugin-sonarjs";');
    expect(src).toContain('export const PLUGINS = { "@typescript-eslint": tseslint.plugin, sonarjs };');
    expect(src).toContain('source: (body) => ({\n    "no-var": ["error"],\n    "sonarjs/cognitive-complexity": ["error", 15],\n  })');
    expect(src).toContain('"unit-test": (body) => ({\n    "@typescript-eslint/no-unused-vars": ["off"],\n  })');
    expect(src).not.toContain("@stylistic/semi");
    expect(src).not.toContain("react/jsx-key");
    expect(src).not.toContain("unicorn/x");
  });
});

describe("renderClassEslint", () => {
  it("emits blocks per surface with base language options, physics rules, class rules, and local last", () => {
    const rows = [row({ key: "no-var" }), row({ key: "react/jsx-key", tier: "class" }), row({ key: "better-tailwindcss/no-conflicting-classes", tier: "class", chosen: ["error", { entryPoint: { $parameter: "tailwind.entryPoint" } }], test: "parameter" })];
    const src = renderClassEslint(rows, provenance);
    expect(src).toContain('import physics from "../../physics/eslint.mjs";');
    expect(src).toContain('import base from "./eslint.base.mjs";');
    expect(src).toContain('files: SURFACE_FILES[surface]');
    expect(src).toContain('rules: { ...physics.rules[surface](body), ...classRules[surface](body) }');
    expect(src).toContain('"better-tailwindcss/no-conflicting-classes": ["error", { "entryPoint": body.tailwind.entryPoint }]');
    expect(src).toContain("...(await loadLocal(root))");
    expect(src).toMatch(/export default async function eslintConfig\(explicitBody\)/);
  });
});

describe("renderTsconfig / renderStylelint / renderFunction", () => {
  it("splits tsconfig into physics flags and a class file that extends it", () => {
    const rows = [
      { tool: "tsconfig", surface: "*", key: "compilerOptions.strict", chosen: true, tier: "physics", test: "agree" },
      { tool: "tsconfig", surface: "*", key: "compilerOptions.jsx", chosen: "react-jsx", tier: "class", test: "adopt" },
      { tool: "tsconfig", surface: "*", key: "compilerOptions.types", chosen: { $parameter: "tsconfig.types" }, tier: "class", test: "parameter" },
    ];
    const { physics, klass } = renderTsconfig(rows, provenance);
    expect(JSON.parse(physics)).toEqual({ $comment: expect.stringContaining("GENERATED"), compilerOptions: { strict: true } });
    expect(JSON.parse(klass)).toEqual({ $comment: expect.stringContaining("GENERATED"), extends: "../../physics/tsconfig.json", compilerOptions: { jsx: "react-jsx" } });
  });
  it("renders stylelint as a function of the body", () => {
    const rows = [{ tool: "stylelint", surface: "*", key: "extends", chosen: ["stylelint-config-standard"], tier: "class", test: "agree" }, { tool: "stylelint", surface: "*", key: "rules.no-duplicate-selectors", chosen: true, tier: "class", test: "strictest" }];
    const src = renderStylelint(rows, provenance);
    expect(src).toContain('export default function stylelint(body = {}) {');
    expect(src).toContain('"extends": ["stylelint-config-standard"]');
    expect(src).toContain('"no-duplicate-selectors": true');
  });
  it("renders a generic tool as a function with parameters spliced in", () => {
    const rows = [{ tool: "cspell", surface: "*", key: "version", chosen: "0.2", tier: "physics", test: "agree" }, { tool: "cspell", surface: "*", key: "words", chosen: { $parameter: "spelling" }, tier: "class", test: "parameter" }, { tool: "cspell", surface: "*", key: "ignorePaths", chosen: ["node_modules"], tier: "class", test: "benefit" }];
    const src = renderFunction("cspell", rows, provenance);
    expect(src).toContain('export default function cspell(body = {}) {');
    expect(src).toContain('"version": "0.2"');
    expect(src).toContain('"words": body.spelling');
    expect(src).toContain('"ignorePaths": ["node_modules", ...(body.ignore?.spelling ?? [])]');
  });
});

describe("writeBundle", () => {
  it("writes every generated file under the package and nothing else", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-bundle-"));
    fs.mkdirSync(path.join(dir, "classes/next-supabase-mono"), { recursive: true });
    fs.writeFileSync(path.join(dir, "classes/next-supabase-mono/schema.mjs"), "export default {};");
    fs.writeFileSync(path.join(dir, "classes/next-supabase-mono/eslint.base.mjs"), "export default {};");
    const rulings = { provenance, rows: [row({ key: "no-var" }), { tool: "tsconfig", surface: "*", key: "compilerOptions.strict", chosen: true, tier: "physics", test: "agree" }, { tool: "prettier", surface: "*", key: "endOfLine", chosen: "auto", tier: "physics", test: "agree" }] };
    const written = writeBundle(rulings, dir);
    expect(written.map((p) => p.replaceAll("\\", "/")).sort()).toEqual([
      "classes/next-supabase-mono/cspell.mjs", "classes/next-supabase-mono/eslint.mjs", "classes/next-supabase-mono/jscpd.mjs", "classes/next-supabase-mono/knip.mjs", "classes/next-supabase-mono/stylelint.mjs", "classes/next-supabase-mono/tsconfig.json",
      "physics/eslint.mjs", "physics/hooks.mjs", "physics/lint-staged.mjs", "physics/ls-lint.mjs", "physics/prettier.mjs", "physics/secretlint.mjs", "physics/syncpack.mjs", "physics/tsconfig.json",
    ]);
    expect(fs.readFileSync(path.join(dir, "physics/prettier.mjs"), "utf8")).toContain('"endOfLine": "auto"');
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run packages/orrery/tests/body-config.test.mjs packages/orrery/tests/bundle.test.mjs`
Expected: FAIL — cannot resolve the modules

- [ ] **Step 3: Write the implementation**

```javascript
// packages/orrery/src/lib/bundle/plugins.mjs
// Where each rule prefix's plugin comes from. `member` is the expression that yields the plugin
// object after `import <name> from "<module>"`. Versions are the donors' (libra's where they differ).
export const PLUGIN_SOURCES = {
  "@typescript-eslint": { module: "typescript-eslint", name: "tseslint", member: "tseslint.plugin", version: "^8.59.0" },
  sonarjs: { module: "eslint-plugin-sonarjs", name: "sonarjs", member: "sonarjs", version: "^4.0.3" },
  unicorn: { module: "eslint-plugin-unicorn", name: "unicorn", member: "unicorn", version: "^64.0.0" },
  security: { module: "eslint-plugin-security", name: "security", member: "security", version: "^4.0.1" },
  "unused-imports": { module: "eslint-plugin-unused-imports", name: "unusedImports", member: "unusedImports", version: "^4.4.1" },
  jsdoc: { module: "eslint-plugin-jsdoc", name: "jsdoc", member: "jsdoc", version: "^64.1.0" },
  tsdoc: { module: "eslint-plugin-tsdoc", name: "tsdoc", member: "tsdoc", version: "^0.5.2" },
  boundaries: { module: "eslint-plugin-boundaries", name: "boundaries", member: "boundaries", version: "^6.0.2" },
  "@next/next": { module: "@next/eslint-plugin-next", name: "next", member: "next", version: "16.2.4" },
  react: { module: "eslint-plugin-react", name: "react", member: "react", version: "^7.37.0" },
  "react-hooks": { module: "eslint-plugin-react-hooks", name: "reactHooks", member: "reactHooks", version: "^7.1.1" },
  "jsx-a11y": { module: "eslint-plugin-jsx-a11y", name: "jsxA11y", member: "jsxA11y", version: "^6.10.0" },
  "better-tailwindcss": { module: "eslint-plugin-better-tailwindcss", name: "betterTailwindcss", member: "betterTailwindcss", version: "^4.4.1" },
  "@tanstack/query": { module: "@tanstack/eslint-plugin-query", name: "tanstackQuery", member: "tanstackQuery", version: "^5.100.5" },
  i18next: { module: "eslint-plugin-i18next", name: "i18next", member: "i18next", version: "^6.1.4" },
  "testing-library": { module: "eslint-plugin-testing-library", name: "testingLibrary", member: "testingLibrary", version: "^7.16.2" },
  playwright: { module: "eslint-plugin-playwright", name: "playwright", member: "playwright", version: "^2.11.0" },
  vitest: { module: "@vitest/eslint-plugin", name: "vitest", member: "vitest", version: "^1.6.16" },
  import: { module: "eslint-plugin-import", name: "importPlugin", member: "importPlugin", version: "^2.31.0" },
};

// Prefixes that appear only as `off` (from eslint-config-prettier) and have no plugin of their own.
export const PRETTIER_OFF_PREFIXES = ["@stylistic", "@stylistic/js", "@stylistic/ts", "@stylistic/jsx", "vue", "flowtype", "babel", "@babel", "standard"];

export const TOOL_DEPENDENCIES = {
  eslint: "^9.39.4", "@eslint/js": "^10.0.1", "eslint-config-prettier": "^10.1.5", typescript: "^6.0.3",
  stylelint: "^17.9.1", "stylelint-config-standard": "^40.0.0", "stylelint-config-tailwindcss": "^1.0.1",
  knip: "^6.7.0", jscpd: "^4.0.9", cspell: "^10.0.0", syncpack: "^14.3.1", secretlint: "^12.3.1", "@secretlint/secretlint-rule-preset-recommend": "^12.3.1",
  "@ls-lint/ls-lint": "^2.3.1", "lint-staged": "^16.4.0", prettier: "^3.8.3",
};

export function dependenciesFor(prefixes) {
  const deps = { ...TOOL_DEPENDENCIES };
  for (const prefix of prefixes) {
    const source = PLUGIN_SOURCES[prefix];
    if (source) deps[source.module] = source.version;
  }
  return Object.fromEntries(Object.entries(deps).sort(([x], [y]) => (x < y ? -1 : 1)));
}
```

```javascript
// packages/orrery/src/lib/bundle/eslint.mjs
import { SURFACES } from "../surfaces.mjs";
import { PLUGIN_SOURCES, PRETTIER_OFF_PREFIXES } from "./plugins.mjs";
import { pluginOf } from "../reconcile/tiers.mjs";

const header = (p, record) => `// GENERATED by orrery reconcile from ${p.a.name} ${p.a.sha} and ${p.b.name} ${p.b.sha} on ${p.date}.\n// Record: docs/decisions/${record}. Edit by hand only through a pull request that also updates the record;\n// the donors are never consulted again.\n`;

// Stable source rendering: sorted keys, parameters as body reads, spreads for parameter arrays.
export function literal(value, indent = "") {
  if (value && typeof value === "object" && !Array.isArray(value) && "$parameter" in value) return `body.${value.$parameter}`;
  if (Array.isArray(value)) {
    const parts = value.map((v) => (v && typeof v === "object" && !Array.isArray(v) && "$parameter" in v ? `...body.${v.$parameter}` : literal(v, indent)));
    return `[${parts.join(", ")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.keys(value).sort().map((k) => `${JSON.stringify(k)}: ${literal(value[k], indent)}`);
    return entries.length ? `{ ${entries.join(", ")} }` : "{}";
  }
  return JSON.stringify(value);
}

const severity = (chosen) => (Array.isArray(chosen) ? chosen[0] : chosen);
const isOff = (chosen) => severity(chosen) === "off" || severity(chosen) === 0;

function rulesBySurface(rows, tier) {
  const out = {};
  for (const surface of SURFACES.map((s) => s.name)) out[surface] = [];
  for (const r of rows) {
    if (r.tool !== "eslint" || r.tier !== tier || r.chosen === null) continue;
    if (isOff(r.chosen) && PRETTIER_OFF_PREFIXES.includes(pluginOf(r.key))) continue; // eslint-config-prettier supplies these
    (out[r.surface] ??= []).push(r);
  }
  return out;
}

function renderRules(bySurface) {
  return Object.entries(bySurface)
    .map(([surface, rows]) => {
      const body = rows.map((r) => `    ${JSON.stringify(r.key)}: ${literal(r.chosen)},`).join("\n");
      return `  ${/^[a-z]+$/.test(surface) ? surface : JSON.stringify(surface)}: (body) => ({\n${body}\n  }),`;
    })
    .join("\n");
}

function prefixesIn(bySurface) {
  return [...new Set(Object.values(bySurface).flat().map((r) => pluginOf(r.key)))].filter((p) => p !== "core" && PLUGIN_SOURCES[p]).sort();
}

const imports = (prefixes) => prefixes.map((p) => `import ${PLUGIN_SOURCES[p].name} from ${JSON.stringify(PLUGIN_SOURCES[p].module)};`).join("\n");
const pluginMap = (prefixes) => `{ ${prefixes.map((p) => (PLUGIN_SOURCES[p].member === p ? p : `${JSON.stringify(p)}: ${PLUGIN_SOURCES[p].member}`)).join(", ")} }`;

export function renderPhysicsEslint(rows, provenance) {
  const bySurface = rulesBySurface(rows, "physics");
  const prefixes = prefixesIn(bySurface);
  return `${header(provenance, "0004-eslint.md")}${imports(prefixes)}\n\nexport const PLUGINS = ${pluginMap(prefixes)};\n\n// Rules true for any repository, per kind of file. Consumed by a class, never by a body directly.\nexport const rules = {\n${renderRules(bySurface)}\n};\n\nexport default { PLUGINS, rules };\n`;
}

export function renderClassEslint(rows, provenance) {
  const bySurface = rulesBySurface(rows, "class");
  const prefixes = prefixesIn(bySurface);
  return `${header(provenance, "0004-eslint.md")}import path from "node:path";
import { pathToFileURL } from "node:url";
import prettier from "eslint-config-prettier";
${imports(prefixes)}
import physics from "../../physics/eslint.mjs";
import base from "./eslint.base.mjs";
import schema from "./schema.mjs";
import { loadBodyConfig, withDefaults } from "../../src/lib/body-config.mjs";

export const SURFACE_FILES = {
  source: ["apps/*/src/**/*.ts"],
  component: ["apps/*/src/**/*.tsx"],
  package: ["packages/*/src/**/*.{ts,tsx}"],
  "unit-test": ["**/*.test.{ts,tsx}", "**/tests/**/*.{ts,tsx}"],
  e2e: ["**/e2e/**/*.{ts,tsx}"],
  script: ["scripts/**/*.{js,mjs,cjs}"],
};
const ORDER = ["source", "component", "package", "unit-test", "e2e", "script"];

export const PLUGINS = { ...physics.PLUGINS, ...${pluginMap(prefixes)} };

const classRules = {
${renderRules(bySurface)}
};

async function loadLocal(root) {
  const file = path.join(root, "eslint.local.mjs");
  try { return (await import(pathToFileURL(file).href)).default ?? []; } catch (error) { if (error.code === "ERR_MODULE_NOT_FOUND") return []; throw error; }
}

export default async function eslintConfig(explicitBody) {
  const { root, config } = explicitBody ? { root: explicitBody.root ?? process.cwd(), config: explicitBody } : await loadBodyConfig(process.cwd());
  const body = withDefaults(config, schema);
  const blocks = ORDER.map((surface) => ({
    name: \`orrery/next-supabase-mono/\${surface}\`,
    files: SURFACE_FILES[surface],
    ...base(surface, body, root),
    plugins: PLUGINS,
    rules: { ...physics.rules[surface](body), ...classRules[surface](body) },
  }));
  return [...blocks, prettier, ...(await loadLocal(root))];
}
`;
}
```

```javascript
// packages/orrery/src/lib/bundle/tools.mjs
import { literal } from "./eslint.mjs";

const header = (p, record) => `// GENERATED by orrery reconcile from ${p.a.name} ${p.a.sha} and ${p.b.name} ${p.b.sha} on ${p.date}. Record: docs/decisions/${record}.\n`;
const jsonHeader = (p, record) => `GENERATED by orrery reconcile from ${p.a.name} ${p.a.sha} and ${p.b.name} ${p.b.sha} on ${p.date}. Record: docs/decisions/${record}.`;

const setPath = (target, dotted, value) => { const keys = dotted.split("."); let o = target; for (const k of keys.slice(0, -1)) o = o[k] ??= {}; o[keys.at(-1)] = value; };
// an $inherit ruling means: omit the key so the preset's default applies
const toolRows = (rows, tool) => rows.filter((r) => r.tool === tool && r.chosen !== null && r.test !== "inert" && !(r.chosen && typeof r.chosen === "object" && "$inherit" in r.chosen));

export function renderTsconfig(rows, provenance) {
  const physics = { $comment: jsonHeader(provenance, "0005-tsconfig.md"), compilerOptions: {} };
  const klass = { $comment: jsonHeader(provenance, "0005-tsconfig.md"), extends: "../../physics/tsconfig.json", compilerOptions: {} };
  for (const r of toolRows(rows, "tsconfig")) {
    if (r.chosen && typeof r.chosen === "object" && "$parameter" in r.chosen) continue; // per-app data stays in the app's tsconfig
    setPath(r.tier === "physics" ? physics : klass, r.key, r.chosen);
  }
  return { physics: JSON.stringify(physics, null, 2) + "\n", klass: JSON.stringify(klass, null, 2) + "\n" };
}

// Body parameters that extend a generated list rather than replace it.
const EXTENDERS = { "cspell.ignorePaths": "ignore.spelling", "jscpd.ignore": "ignore.duplication", "secretlint.ignore": "ignore.secrets", "knip.apps.entry": "knip.apps.extraEntries", "knip.apps.project": "knip.apps.extraProjects", "knip.packages.entry": "knip.packages.extraEntries", "knip.packages.project": "knip.packages.extraProjects" };

function objectFromRows(tool, rows) {
  const out = {};
  for (const r of toolRows(rows, tool)) setPath(out, r.key, r.chosen);
  return out;
}

function renderObject(tool, value, prefix = "") {
  return literal(value).replace(/\[([^\]]*)\]/g, (m, inner, offset, whole) => m); // literal already renders parameters
}

export function renderStylelint(rows, provenance) {
  const value = objectFromRows("stylelint", rows);
  return `${header(provenance, "0006-stylelint.md")}export default function stylelint(body = {}) {\n  return ${literal(value)};\n}\n`;
}

const RECORD = { prettier: "0007-prettier.md", secretlint: "0008-secretlint.md", jscpd: "0009-jscpd.md", cspell: "0010-cspell.md", "ls-lint": "0011-ls-lint.md", knip: "0012-knip.md", syncpack: "0013-syncpack.md", "lint-staged": "0014-lint-staged.md", hooks: "0015-hooks.md" };

export function renderFunction(tool, rows, provenance) {
  const value = objectFromRows(tool, rows);
  let source = literal(value);
  for (const [key, param] of Object.entries(EXTENDERS)) {
    const [t, ...rest] = key.split(".");
    if (t !== tool) continue;
    const jsonKey = JSON.stringify(rest.at(-1)) + ": [";
    if (source.includes(jsonKey)) {
      source = source.replace(new RegExp(`${jsonKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\]]*)\\]`), (m, inner) => `${jsonKey}${inner}, ...(body.${param.split(".").join("?.")} ?? [])]`);
    }
  }
  const name = tool.replace(/-([a-z])/g, (m, c) => c.toUpperCase());
  return `${header(provenance, RECORD[tool])}export default function ${name}(body = {}) {\n  return ${source};\n}\n`;
}
```

```javascript
// packages/orrery/src/lib/bundle/write.mjs
import fs from "node:fs";
import path from "node:path";
import { renderPhysicsEslint, renderClassEslint } from "./eslint.mjs";
import { renderTsconfig, renderStylelint, renderFunction } from "./tools.mjs";

const PHYSICS_FUNCTIONS = ["prettier", "secretlint", "ls-lint", "syncpack", "lint-staged", "hooks"];
const CLASS_FUNCTIONS = ["jscpd", "cspell", "knip"];

export function writeBundle({ provenance, rows }, packageDir) {
  const written = [];
  const put = (rel, text) => { const file = path.join(packageDir, rel); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); written.push(rel); };
  put("physics/eslint.mjs", renderPhysicsEslint(rows, provenance));
  put("classes/next-supabase-mono/eslint.mjs", renderClassEslint(rows, provenance));
  const ts = renderTsconfig(rows, provenance);
  put("physics/tsconfig.json", ts.physics);
  put("classes/next-supabase-mono/tsconfig.json", ts.klass);
  put("classes/next-supabase-mono/stylelint.mjs", renderStylelint(rows, provenance));
  for (const tool of PHYSICS_FUNCTIONS) put(`physics/${tool}.mjs`, renderFunction(tool, rows, provenance));
  for (const tool of CLASS_FUNCTIONS) put(`classes/next-supabase-mono/${tool}.mjs`, renderFunction(tool, rows, provenance));
  return written;
}
```

```javascript
// packages/orrery/src/lib/body-config.mjs
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const typeOk = (value, type) => {
  if (type === "string") return typeof value === "string";
  if (type === "string[]") return Array.isArray(value) && value.every((v) => typeof v === "string");
  if (type === "object[]") return Array.isArray(value) && value.every((v) => v && typeof v === "object");
  if (type === "object") return value && typeof value === "object" && !Array.isArray(value);
  return false;
};

export function validateBodyConfig(config, schema, prefix = "") {
  const errors = [];
  for (const key of Object.keys(config ?? {})) if (!schema[key]) errors.push(`unknown field ${prefix}${key}`);
  for (const [key, spec] of Object.entries(schema)) {
    const value = config?.[key];
    const name = `${prefix}${key}`;
    if (value === undefined) { if (spec.required) errors.push(`${name} is required`); continue; }
    if (!typeOk(value, spec.type)) { errors.push(`${name} must be ${spec.type}`); continue; }
    if (spec.enum && !spec.enum.includes(value)) errors.push(`${name} must be one of ${spec.enum.join(", ")}`);
    if (spec.fields) errors.push(...validateBodyConfig(value, spec.fields, `${name}.`));
  }
  return errors;
}

export function withDefaults(config, schema) {
  const out = {};
  for (const [key, spec] of Object.entries(schema)) {
    const value = config?.[key];
    if (spec.fields) out[key] = withDefaults(value ?? {}, spec.fields);
    else out[key] = value === undefined ? structuredClone(spec.default) : value;
  }
  return out;
}

export function resolveParameter(config, dotted, schema) {
  return dotted.split(".").reduce((o, k) => o?.[k], withDefaults(config, schema));
}

export async function loadBodyConfig(startDir) {
  let dir = path.resolve(startDir);
  for (;;) {
    const file = path.join(dir, "orrery.config.mjs");
    if (fs.existsSync(file)) {
      const config = (await import(pathToFileURL(file).href)).default;
      const schema = (await import(`../../classes/${config?.class ?? "next-supabase-mono"}/schema.mjs`)).default;
      const errors = validateBodyConfig(config, schema);
      if (errors.length) throw new Error(`invalid ${file}:\n  ${errors.join("\n  ")}`);
      return { root: dir, config };
    }
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error(`no orrery.config.mjs found from ${startDir} upward`);
    dir = parent;
  }
}
```

```javascript
// packages/orrery/classes/next-supabase-mono/eslint.base.mjs
// Hand-written: what every block needs besides rules. Language options come from the donors'
// effective configs (both use typescript-eslint's parser with the project service); settings
// are what the React and boundaries plugins need to resolve elements and versions.
import tseslint from "typescript-eslint";

const STANDARD_ELEMENTS = [
  { type: "proxy", mode: "file", pattern: "apps/*/src/proxy.ts" },
  { type: "feature-barrel", mode: "file", pattern: "apps/*/src/features/*/{index,public}.ts" },
  { type: "feature", pattern: "apps/*/src/features/*/*", capture: ["feature", "layer"] },
  { type: "shared", pattern: "apps/*/src/shared/*", capture: ["layer"] },
  { type: "app", pattern: ["apps/*/src/app", "apps/*/src/app/**"] },
];

export default function base(surface, body, root) {
  const typescript = surface !== "script";
  return {
    languageOptions: typescript
      ? { parser: tseslint.parser, parserOptions: { projectService: true, tsconfigRootDir: root }, ecmaVersion: 2023, sourceType: "module" }
      : { ecmaVersion: 2023, sourceType: "module" },
    settings: {
      react: { version: "detect" },
      "boundaries/elements": [...STANDARD_ELEMENTS, ...body.boundaries.elements],
      "boundaries/include": ["apps/*/src/**/*", "packages/*/src/**/*"],
    },
  };
}
```

`packages/orrery/package.json` gains:

```json
"exports": {
  ".": "./src/cli.mjs",
  "./eslint": "./classes/next-supabase-mono/eslint.mjs",
  "./eslint/physics": "./physics/eslint.mjs",
  "./tsconfig": "./classes/next-supabase-mono/tsconfig.json",
  "./tsconfig/physics": "./physics/tsconfig.json",
  "./stylelint": "./classes/next-supabase-mono/stylelint.mjs",
  "./jscpd": "./classes/next-supabase-mono/jscpd.mjs",
  "./cspell": "./classes/next-supabase-mono/cspell.mjs",
  "./knip": "./classes/next-supabase-mono/knip.mjs",
  "./prettier": "./physics/prettier.mjs",
  "./secretlint": "./physics/secretlint.mjs",
  "./ls-lint": "./physics/ls-lint.mjs",
  "./syncpack": "./physics/syncpack.mjs",
  "./lint-staged": "./physics/lint-staged.mjs",
  "./hooks": "./physics/hooks.mjs",
  "./schema": "./classes/next-supabase-mono/schema.mjs"
},
"files": ["bin", "src", "physics", "classes", "templates"],
```

and `dependencies` from `dependenciesFor(prefixes present in rulings.json)` — write them with a small one-off `node -e` and commit the result; `pnpm install` must succeed at the root (this pulls the plugins into Orrery's node_modules, which the fixture body and `observe` rely on).

`packages/orrery/src/commands/bundle.mjs`: `orrery bundle [--rulings docs/decisions/rulings.json] [--package packages/orrery]` reads the rulings, calls `writeBundle`, prints the written paths, exits 0; exit 1 if the rulings contain residue. Register in `cli.mjs`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run packages/orrery/tests/body-config.test.mjs packages/orrery/tests/bundle.test.mjs`
Expected: PASS — 7 + 7 tests

- [ ] **Step 5: Generate the bundle for real and install its dependencies**

```
pnpm orrery bundle
node -e "import('./packages/orrery/src/lib/bundle/plugins.mjs').then(m => { const r = JSON.parse(require('fs').readFileSync('docs/decisions/rulings.json','utf8')); const prefixes = [...new Set(r.rows.filter(x => x.tool==='eslint' && x.tier).map(x => x.key.includes('/') ? x.key.slice(0, x.key.lastIndexOf('/')) : 'core'))]; console.log(JSON.stringify(m.dependenciesFor(prefixes), null, 2)); })"
```

Paste the printed object into `packages/orrery/package.json` `dependencies`, then `pnpm install` at the root. Then prove the generated class config loads: `node -e "import('./packages/orrery/classes/next-supabase-mono/eslint.mjs').then(m => m.default({ class: 'next-supabase-mono', tailwind: { entryPoint: 'x.css' }, root: process.cwd() })).then(c => console.log(c.length, 'blocks'))"` prints `8 blocks` (six surfaces, prettier, and zero local). If the import throws on a plugin's export shape (a plugin whose default export is not the plugin object), fix the `member` expression in `plugins.mjs` and note it.

- [ ] **Step 6: Commit and land**

```bash
git checkout -b feat/2b-bundle origin/develop
git add packages/orrery/src/lib/bundle packages/orrery/src/lib/body-config.mjs packages/orrery/src/commands/bundle.mjs packages/orrery/src/cli.mjs packages/orrery/classes packages/orrery/physics packages/orrery/package.json pnpm-lock.yaml packages/orrery/tests/bundle.test.mjs packages/orrery/tests/body-config.test.mjs
git commit -m "feat(bundle): generated physics and class tiers, the body-config loader, the class schema [GH-000]"
git push -u origin HEAD && gh pr create --base develop --title "feat(bundle): generated tiers, body-config loader and class schema [GH-000]" --body "Task 6 of the 2b plan." && gh pr merge --squash --auto
```

---

### Task 7: The fixture body and the bundle-honesty test

A minimal `next-supabase-mono` body inside this repository, wired to the bundle through the workspace. Its effective eslint config per surface must equal the ruling rows; that test is what keeps the generated bundle honest after anyone edits it by hand.

**Files:**
- Modify: `pnpm-workspace.yaml` — add `fixtures/*`
- Create: `fixtures/next-supabase-mono/package.json`, `orrery.config.mjs`, `eslint.config.mjs`, `eslint.local.mjs`, `tsconfig.json`, `apps/web/src/features/thing/application/use-thing.ts`, `apps/web/src/features/thing/presentation/thing-tile.tsx`, `apps/web/src/app/layout.tsx`, `apps/web/src/app/globals.css`, `apps/web/tests/use-thing.test.ts`, `apps/web/e2e/home.spec.ts`, `packages/core/src/thing.ts`, `scripts/build.mjs`
- Create: `packages/orrery/templates/next-supabase-mono/` — the pointer files `init` will write: `eslint.config.mjs`, `tsconfig.json`, `.husky/commit-msg`, `.husky/pre-push`, `.husky/pre-commit`, `.github/workflows/ci.yml`; the fixture's copies are byte-identical to these
- Test: `packages/orrery/tests/bundle-honesty.test.mjs`
- Test: `packages/orrery/tests/fixture-pointers.test.mjs`

**Interfaces:**
- Consumes: the generated bundle (Task 6), `readEffectiveConfig` (2a), `rulings.json` (Task 5).
- Produces: `fixtures/next-supabase-mono` as the body that does not exist yet; `templates/` as the byte source of truth for pointers, which `observe`'s pointer drift (Task 8) compares against.

- [ ] **Step 1: Write the fixture**

`fixtures/next-supabase-mono/package.json`:
```json
{ "name": "fixture-next-supabase-mono", "private": true, "type": "module", "devDependencies": { "@vaoan/orrery": "workspace:*" }, "prettier": "@vaoan/orrery/prettier" }
```

`orrery.config.mjs`:
```javascript
export default {
  class: "next-supabase-mono",
  workspacePackages: ["core"],
  floatingPeers: [],
  tailwind: { entryPoint: "apps/web/src/app/globals.css" },
  boundaries: { elements: [], allow: [] },
  spelling: ["orrery"],
};
```

`eslint.config.mjs` (a pointer, byte-identical to the template):
```javascript
import orrery from "@vaoan/orrery/eslint";
export default await orrery();
```

`eslint.local.mjs`: `export default [];`

`tsconfig.json`: `{ "extends": "@vaoan/orrery/tsconfig", "include": ["apps/*/src", "packages/*/src"] }`

Source files are two to five lines each, valid TypeScript and TSX that violate nothing; `globals.css` is `@import "tailwindcss";`.

Templates: copy the three pointer files and the three `.husky` hooks (`pnpm orrery hook <name>` one-liners) and the five-line `ci.yml` caller (`uses: vaoan/Orrery/.github/workflows/ci.yml@main`) into `packages/orrery/templates/next-supabase-mono/` with the same relative paths.

- [ ] **Step 2: Write the failing tests**

```javascript
// packages/orrery/tests/bundle-honesty.test.mjs
// The generated bundle must produce, for the fixture body, exactly the rulings for every surface.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readEffectiveConfig } from "../src/lib/effective-config.mjs";
import { optionsOf, severityOf } from "../src/lib/reconcile/ordering.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const fixture = path.join(root, "fixtures/next-supabase-mono");
const rulings = JSON.parse(fs.readFileSync(path.join(root, "docs/decisions/rulings.json"), "utf8"));
const SAMPLES = {
  source: "apps/web/src/features/thing/application/use-thing.ts",
  component: "apps/web/src/features/thing/presentation/thing-tile.tsx",
  "unit-test": "apps/web/tests/use-thing.test.ts",
  e2e: "apps/web/e2e/home.spec.ts",
  script: "scripts/build.mjs",
  package: "packages/core/src/thing.ts",
};
const body = (await import(path.join(fixture, "orrery.config.mjs").replace(/^([A-Za-z]):/, "file:///$1:"))).default;

const resolveParameters = (value) => {
  if (Array.isArray(value)) return value.flatMap((v) => (v && typeof v === "object" && "$parameter" in v ? (read(v.$parameter) ?? []) : [resolveParameters(v)]));
  if (value && typeof value === "object") return "$parameter" in value ? read(value.$parameter) : Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolveParameters(v)]));
  return value;
};
const read = (dotted) => dotted.split(".").reduce((o, k) => o?.[k], body);
const norm = (v) => JSON.stringify([severityOf(v), ...optionsOf(v)]);

describe.each(Object.entries(SAMPLES))("surface %s", (surface, file) => {
  const effective = readEffectiveConfig(fixture, file);
  const expected = rulings.rows.filter((r) => r.tool === "eslint" && r.surface === surface && r.chosen !== null && r.tier);

  it("carries every ruled rule with the ruled value", () => {
    const misses = [];
    for (const r of expected) {
      const actual = effective.rules[r.key];
      if (actual === undefined) { misses.push(`${r.key}: missing`); continue; }
      const want = resolveParameters(r.chosen);
      if (norm(actual) !== norm(want)) misses.push(`${r.key}: got ${norm(actual)} want ${norm(want)}`);
    }
    expect(misses).toEqual([]);
  }, 120_000);

  it("carries no rule the rulings do not name, except eslint-config-prettier's offs", () => {
    const named = new Set(expected.map((r) => r.key));
    const extras = Object.entries(effective.rules).filter(([k, v]) => !named.has(k) && severityOf(v) !== "off").map(([k]) => k);
    expect(extras).toEqual([]);
  }, 120_000);
});
```

```javascript
// packages/orrery/tests/fixture-pointers.test.mjs
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const templates = path.join(root, "packages/orrery/templates/next-supabase-mono");
const fixture = path.join(root, "fixtures/next-supabase-mono");

describe("fixture pointer files", () => {
  // readdirSync, not globSync: fs.glob skips dot-prefixed paths such as .husky by default.
  const files = fs.readdirSync(templates, { recursive: true, withFileTypes: true }).filter((d) => d.isFile()).map((d) => path.relative(templates, path.join(d.parentPath, d.name)).split(path.sep).join("/"));
  it("exist as templates", () => { expect(files.length).toBeGreaterThanOrEqual(7); });
  it.each(files)("%s is byte-identical between template and fixture", (rel) => {
    expect(fs.readFileSync(path.join(fixture, rel))).toEqual(fs.readFileSync(path.join(templates, rel)));
  });
  it("templates carry no policy: no rule names, no severities", () => {
    for (const rel of files) {
      const text = fs.readFileSync(path.join(templates, rel), "utf8");
      expect(text, rel).not.toMatch(/"error"|"warn"|"off"|rules:/);
    }
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm vitest run packages/orrery/tests/fixture-pointers.test.mjs packages/orrery/tests/bundle-honesty.test.mjs`
Expected: FAIL — templates missing; then, once the fixture exists, the honesty test reports every mismatch by rule. Each mismatch is a real defect in the generator (a parameter not resolved, a surface glob that does not match the sample, a plugin export shape); fix the generator, not the test, and never edit `rulings.json` by hand.

- [ ] **Step 4: Make them pass**

`pnpm install` after adding the workspace entry so the fixture links `@vaoan/orrery`. Run the honesty test; expect it to be green for all six surfaces. Record in the report the runtime per surface.

- [ ] **Step 5: Commit and land**

```bash
git checkout -b feat/2b-fixture-body origin/develop
git add pnpm-workspace.yaml pnpm-lock.yaml fixtures packages/orrery/templates packages/orrery/tests/bundle-honesty.test.mjs packages/orrery/tests/fixture-pointers.test.mjs
git commit -m "feat(fixture): the fixture body, the pointer templates, and the bundle-honesty test [GH-000]"
git push -u origin HEAD && gh pr create --base develop --title "feat(fixture): fixture body, pointer templates, bundle-honesty test [GH-000]" --body "Task 7 of the 2b plan." && gh pr merge --squash --auto
```

---

### Task 8: `orrery observe`, part one: version drift and pointer drift

**Files:**
- Create: `packages/orrery/src/lib/observe/version.mjs`
- Create: `packages/orrery/src/lib/observe/pointers.mjs`
- Test: `packages/orrery/tests/observe-version.test.mjs`
- Test: `packages/orrery/tests/observe-pointers.test.mjs`

**Interfaces:**
- Consumes: `validateBodyConfig` (Task 6); the templates directory (Task 7).
- Produces:
  - `versionDrift(bodyDir, { run, remote = "https://github.com/vaoan/Orrery.git" }) => { installed: sha | null, latest: sha, behind: boolean, note }` — `installed` is the commit recorded for `@vaoan/orrery` in `pnpm-lock.yaml` (`null` when the body does not depend on it yet, which is every body before the cut-over); `latest` is `git ls-remote <remote> refs/heads/main`.
  - `pointerDrift(bodyDir, templatesDir, schema) => { files: [{ path, state: "identical" | "differs" | "missing" }], local: string[], config: string[] }` — `local` lists violations in `eslint.local.mjs` (an entry without `files`, or a `files` pattern containing `*`), `config` lists schema errors in `orrery.config.mjs` or `["missing"]`.

- [ ] **Step 1: Write the failing tests**

```javascript
// packages/orrery/tests/observe-version.test.mjs
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { versionDrift, installedCommit } from "../src/lib/observe/version.mjs";

let dir;
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-ver-")); });
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));
const latest = "0123456789abcdef0123456789abcdef01234567";
const run = () => `${latest}\trefs/heads/main\n`;

describe("installedCommit", () => {
  it("finds the git-resolved commit of @vaoan/orrery in a pnpm lockfile", () => {
    const lock = `packages:\n  '@vaoan/orrery@https://codeload.github.com/vaoan/Orrery/tar.gz/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa':\n    resolution: {tarball: https://codeload.github.com/vaoan/Orrery/tar.gz/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa}\n`;
    expect(installedCommit(lock)).toBe("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
  });
  it("returns null when the lockfile does not mention it", () => {
    expect(installedCommit("packages:\n  react@19.0.0:\n")).toBeNull();
  });
});

describe("versionDrift", () => {
  it("reports not installed before adoption, with the latest still resolved", () => {
    fs.writeFileSync(path.join(dir, "pnpm-lock.yaml"), "packages: {}\n");
    expect(versionDrift(dir, { run })).toEqual({ installed: null, latest, behind: false, note: "body does not depend on @vaoan/orrery yet" });
  });
  it("reports behind when the installed commit is not the latest", () => {
    fs.writeFileSync(path.join(dir, "pnpm-lock.yaml"), "  '@vaoan/orrery@https://codeload.github.com/vaoan/Orrery/tar.gz/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb':\n");
    const r = versionDrift(dir, { run });
    expect(r.behind).toBe(true);
    expect(r.installed).toBe("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
  });
  it("reports current when they match", () => {
    fs.writeFileSync(path.join(dir, "pnpm-lock.yaml"), `  '@vaoan/orrery@https://codeload.github.com/vaoan/Orrery/tar.gz/${latest}':\n`);
    expect(versionDrift(dir, { run }).behind).toBe(false);
  });
  it("asks git for exactly the main ref of the remote", () => {
    fs.writeFileSync(path.join(dir, "pnpm-lock.yaml"), "");
    let args;
    versionDrift(dir, { run: (c, a) => { args = [c, ...a]; return run(); } });
    expect(args).toEqual(["git", "ls-remote", "https://github.com/vaoan/Orrery.git", "refs/heads/main"]);
  });
});
```

```javascript
// packages/orrery/tests/observe-pointers.test.mjs
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pointerDrift, localOverrideViolations } from "../src/lib/observe/pointers.mjs";
import schema from "../classes/next-supabase-mono/schema.mjs";

let body, templates;
const put = (root, rel, text) => { fs.mkdirSync(path.join(root, path.dirname(rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); };
beforeEach(() => {
  body = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-ptr-body-"));
  templates = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-ptr-tpl-"));
  put(templates, "eslint.config.mjs", 'import orrery from "@vaoan/orrery/eslint";\nexport default await orrery();\n');
  put(templates, ".husky/pre-push", "pnpm orrery hook pre-push\n");
});
afterEach(() => { fs.rmSync(body, { recursive: true, force: true }); fs.rmSync(templates, { recursive: true, force: true }); });

describe("localOverrideViolations", () => {
  it("accepts named-file exceptions and rejects globs and entries without files", () => {
    expect(localOverrideViolations([{ files: ["apps/hub/tests/retry-fetch.test.ts"], rules: { "no-await-in-loop": "off" } }])).toEqual([]);
    expect(localOverrideViolations([{ files: ["apps/**/*.ts"], rules: {} }])).toEqual(['entry 0: files pattern "apps/**/*.ts" is not a named file']);
    expect(localOverrideViolations([{ rules: { "no-var": "off" } }])).toEqual(["entry 0: has no files; a local entry must name the files it applies to"]);
  });
});

describe("pointerDrift", () => {
  it("reports identical, differs and missing per template file, and validates local and config", async () => {
    put(body, "eslint.config.mjs", 'import orrery from "@vaoan/orrery/eslint";\nexport default await orrery();\n');
    put(body, ".husky/pre-push", "pnpm orrery hook pre-push\necho extra\n");
    put(body, "eslint.local.mjs", 'export default [{ files: ["apps/**/*.ts"], rules: {} }];');
    put(body, "orrery.config.mjs", 'export default { class: "next-supabase-mono", tailwind: { entryPoint: "x.css" }, severity: 1 };');
    const r = await pointerDrift(body, templates, schema);
    expect(r.files).toEqual([{ path: ".husky/pre-push", state: "differs" }, { path: "eslint.config.mjs", state: "identical" }]);
    expect(r.local).toEqual(['entry 0: files pattern "apps/**/*.ts" is not a named file']);
    expect(r.config).toEqual(["unknown field severity"]);
  });
  it("reports missing pointers and a missing config for a body not yet adopted", async () => {
    const r = await pointerDrift(body, templates, schema);
    expect(r.files.every((f) => f.state === "missing")).toBe(true);
    expect(r.config).toEqual(["missing"]);
    expect(r.local).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run packages/orrery/tests/observe-version.test.mjs packages/orrery/tests/observe-pointers.test.mjs`
Expected: FAIL — cannot resolve the modules

- [ ] **Step 3: Write the implementation**

```javascript
// packages/orrery/src/lib/observe/version.mjs
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const defaultRun = (command, args) => execFileSync(command, args, { encoding: "utf8" });

// pnpm records a git dependency as '<name>@https://codeload.github.com/<owner>/<repo>/tar.gz/<sha>'.
export function installedCommit(lockText) {
  const m = /@vaoan\/orrery@[^\n]*?vaoan\/Orrery\/tar\.gz\/([0-9a-f]{40})/.exec(lockText ?? "");
  return m ? m[1] : null;
}

export function versionDrift(bodyDir, { run = defaultRun, remote = "https://github.com/vaoan/Orrery.git" } = {}) {
  const lockFile = path.join(bodyDir, "pnpm-lock.yaml");
  const installed = installedCommit(fs.existsSync(lockFile) ? fs.readFileSync(lockFile, "utf8") : "");
  const latest = run("git", ["ls-remote", remote, "refs/heads/main"]).split(/\s/)[0];
  if (!installed) return { installed: null, latest, behind: false, note: "body does not depend on @vaoan/orrery yet" };
  return { installed, latest, behind: installed !== latest, note: installed === latest ? "current" : `behind main (${installed.slice(0, 7)} installed, ${latest.slice(0, 7)} latest)` };
}
```

```javascript
// packages/orrery/src/lib/observe/pointers.mjs
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { validateBodyConfig } from "../body-config.mjs";

export function localOverrideViolations(entries) {
  const violations = [];
  (entries ?? []).forEach((entry, i) => {
    if (!Array.isArray(entry.files) || entry.files.length === 0) { violations.push(`entry ${i}: has no files; a local entry must name the files it applies to`); return; }
    for (const f of entry.files) if (typeof f !== "string" || /[*?{}\[\]]/.test(f)) violations.push(`entry ${i}: files pattern ${JSON.stringify(f)} is not a named file`);
  });
  return violations;
}

// readdirSync, not globSync: fs.glob skips dot-prefixed paths such as .husky by default.
const listFiles = (root) => fs.readdirSync(root, { recursive: true, withFileTypes: true }).filter((d) => d.isFile()).map((d) => path.relative(root, path.join(d.parentPath, d.name)).split(path.sep).join("/")).sort();

async function importDefault(file) {
  return (await import(pathToFileURL(file).href + `?t=${Date.now()}`)).default;
}

export async function pointerDrift(bodyDir, templatesDir, schema) {
  const files = listFiles(templatesDir).map((rel) => {
    const target = path.join(bodyDir, rel);
    if (!fs.existsSync(target)) return { path: rel, state: "missing" };
    const same = fs.readFileSync(target).equals(fs.readFileSync(path.join(templatesDir, rel)));
    return { path: rel, state: same ? "identical" : "differs" };
  });
  const localFile = path.join(bodyDir, "eslint.local.mjs");
  const local = fs.existsSync(localFile) ? localOverrideViolations(await importDefault(localFile)) : [];
  const configFile = path.join(bodyDir, "orrery.config.mjs");
  const config = fs.existsSync(configFile) ? validateBodyConfig(await importDefault(configFile), schema) : ["missing"];
  return { files, local, config };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run packages/orrery/tests/observe-version.test.mjs packages/orrery/tests/observe-pointers.test.mjs`
Expected: PASS — 6 + 3 tests

- [ ] **Step 5: Commit and land**

```bash
git checkout -b feat/2b-observe-drifts origin/develop
git add packages/orrery/src/lib/observe packages/orrery/tests/observe-version.test.mjs packages/orrery/tests/observe-pointers.test.mjs
git commit -m "feat(observe): version drift and pointer drift [GH-000]"
git push -u origin HEAD && gh pr create --base develop --title "feat(observe): version drift and pointer drift [GH-000]" --body "Task 8 of the 2b plan." && gh pr merge --squash --auto
```

---

### Task 9: `orrery observe`, part two: code drift and the command

The proof. A scratch directory inside the OS temp holds one materialised config per tool, each importing the bundle with the body's config; Orrery's own tool binaries run with `cwd` at the body and `--config` pointing at the scratch. Nothing is written into the body. For eslint the effective config per surface sample is compared to the rulings rule for rule, and the violations are compared to the body's committed prediction.

**Ruling made in planning:** the observe run uses Orrery's tool binaries (and therefore Orrery's plugins, the ones the bundle depends on), not the body's. After adoption that is exactly a body's situation, since the plugins leave its devDependencies. Type-aware parsing still needs the body's `node_modules` for its own dependencies' types, so the runner installs the body's dependencies in its clone with `pnpm install --frozen-lockfile` (Task 10); locally the donors are already installed.

**Files:**
- Create: `packages/orrery/src/lib/observe/scratch.mjs` — `materialise(bodyDir, bodyConfig, scratchDir) => { eslint, tsconfig, stylelint, jscpd, cspell, lsLint, syncpack }` paths
- Create: `packages/orrery/src/lib/observe/code.mjs` — `effectiveMismatches(...)`, `violationsByRule(...)`, `compareToPrediction(...)`, `codeDrift(...)`
- Create: `packages/orrery/src/lib/observe/report.mjs` — `renderObservation(results) => markdown`
- Create: `packages/orrery/src/commands/observe.mjs` — `orrery observe <bodyDir>... [--predict] [--report docs/observations] [--tools eslint,tsc,...] [--surface <name>]`; registered in `cli.mjs`
- Test: `packages/orrery/tests/observe-code.test.mjs`, `packages/orrery/tests/observe-command.test.mjs`

**Interfaces:**
- Consumes: `findSurfaceSamples` (Task 1), `readEffectiveConfig`/`resolveEslintBin` (2a), the bundle exports (Task 6), `versionDrift`/`pointerDrift` (Task 8), `rulings.json`.
- Produces:
  - `materialise` writes `eslint.config.mjs` (`import orrery from "<abs class eslint.mjs>"; export default await orrery({ ...config, root: "<bodyDir>" });`), `tsconfig.json` (`extends` the class tsconfig by absolute path, `include` from the body's tsconfig parameter, `compilerOptions.noEmit`), `stylelint.config.mjs`, `jscpd.json`, `cspell.json`, `.ls-lint.yml`, `syncpack.json` by calling each bundle function with the body config and serialising.
  - `effectiveMismatches(effectiveRules, rows, bodyConfig) => string[]` — the honesty comparison from Task 7, reused: every ruled rule present with its resolved value; extras that are not `off`.
  - `violationsByRule(eslintJsonOutput) => { [rule]: count }`.
  - `compareToPrediction(observed, prediction) => { unexplained: string[], moved: [{ rule, was, now }], newRules: string[] }` — a rule with violations that is not in `prediction.tightened` is `unexplained` (a defect in Orrery or a body that is not clean under its own config); count changes are `moved`, informational.
  - `codeDrift(bodyDir, { bundleDir, bodyConfig, rows, prediction, samples, run, exec, scratchDir, tools }) => { eslint: { mismatches, violations, comparison }, tsc: { errors }, stylelint: { count }, jscpd: { clones }, cspell: { issues }, "ls-lint": { errors }, syncpack: { mismatches } }`.
  - `renderObservation(results)` → one markdown per run with a table per body.

- [ ] **Step 1: Write the failing tests**

```javascript
// packages/orrery/tests/observe-code.test.mjs
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { materialise } from "../src/lib/observe/scratch.mjs";
import { effectiveMismatches, violationsByRule, compareToPrediction } from "../src/lib/observe/code.mjs";

describe("materialise", () => {
  let scratch;
  beforeEach(() => { scratch = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-scratch-")); });
  afterEach(() => fs.rmSync(scratch, { recursive: true, force: true }));

  it("writes one config per tool that imports the bundle by absolute path and passes the body config", async () => {
    const bundleDir = "Z:/Github/Orrery/packages/orrery";
    const files = await materialise("Z:/Github/x", { class: "next-supabase-mono", tailwind: { entryPoint: "g.css" } }, scratch, { bundleDir, functions: { stylelint: () => ({ rules: {} }), jscpd: () => ({ threshold: 4 }), cspell: () => ({ words: [] }), lsLint: () => "ls:\n", syncpack: () => ({ versionGroups: [] }), tsconfigInclude: ["apps/*/src"] } });
    const eslint = fs.readFileSync(files.eslint, "utf8");
    expect(eslint).toContain('import orrery from "file:///Z:/Github/Orrery/packages/orrery/classes/next-supabase-mono/eslint.mjs"');
    expect(eslint).toContain('"root": "Z:/Github/x"');
    expect(eslint).toContain('"entryPoint": "g.css"');
    expect(JSON.parse(fs.readFileSync(files.tsconfig, "utf8"))).toEqual({ extends: "Z:/Github/Orrery/packages/orrery/classes/next-supabase-mono/tsconfig.json", include: ["Z:/Github/x/apps/*/src"], compilerOptions: { noEmit: true } });
    expect(JSON.parse(fs.readFileSync(files.jscpd, "utf8")).threshold).toBe(4);
    expect(fs.readFileSync(files.lsLint, "utf8")).toBe("ls:\n");
  });
});

describe("effectiveMismatches", () => {
  const rows = [
    { tool: "eslint", surface: "source", key: "no-var", chosen: ["error"], tier: "physics", test: "agree" },
    { tool: "eslint", surface: "source", key: "better-tailwindcss/x", chosen: ["error", { entryPoint: { $parameter: "tailwind.entryPoint" } }], tier: "class", test: "parameter" },
    { tool: "eslint", surface: "source", key: "unicorn/inert", chosen: null, tier: null, test: "inert" },
  ];
  const body = { tailwind: { entryPoint: "g.css" } };
  it("passes when every ruled rule matches and extras are only offs", () => {
    expect(effectiveMismatches({ "no-var": [2], "better-tailwindcss/x": ["error", { entryPoint: "g.css" }], "@stylistic/semi": ["off"] }, rows, "source", body)).toEqual([]);
  });
  it("names a missing rule, a wrong value, and an unexpected on rule", () => {
    expect(effectiveMismatches({ "no-var": ["warn"], "extra/rule": ["error"] }, rows, "source", body)).toEqual([
      'no-var: got ["warn"] want ["error"]',
      "better-tailwindcss/x: missing",
      "extra/rule: not in the rulings and not off",
    ]);
  });
});

describe("violationsByRule / compareToPrediction", () => {
  const output = JSON.stringify([{ filePath: "a.ts", messages: [{ ruleId: "no-var" }, { ruleId: "no-var" }, { ruleId: "sonarjs/max-lines" }] }, { filePath: "b.ts", messages: [{ ruleId: null, fatal: true, message: "parse" }] }]);
  it("counts violations per rule and parse errors separately", () => {
    expect(violationsByRule(output)).toEqual({ "no-var": 2, "sonarjs/max-lines": 1, "(fatal)": 1 });
  });
  it("classifies unexplained, moved and new rules against a prediction", () => {
    const prediction = { tightened: ["no-var", "sonarjs/max-lines", "unicorn/x"], counts: { "no-var": 5, "sonarjs/max-lines": 1 } };
    const r = compareToPrediction({ "no-var": 2, "sonarjs/max-lines": 1, "react/jsx-key": 3 }, prediction);
    expect(r.unexplained).toEqual(["react/jsx-key"]);
    expect(r.moved).toEqual([{ rule: "no-var", was: 5, now: 2 }]);
    expect(r.newRules).toEqual([]);
    expect(r.resolved).toEqual(["unicorn/x"]);
  });
});
```

```javascript
// packages/orrery/tests/observe-command.test.mjs
import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import observe from "../src/commands/observe.mjs";

const quiet = () => { const log = vi.spyOn(console, "log").mockImplementation(() => {}); const error = vi.spyOn(console, "error").mockImplementation(() => {}); return { out: () => [...log.mock.calls, ...error.mock.calls].flat().join("\n"), restore: () => { log.mockRestore(); error.mockRestore(); } }; };

const fakeDeps = (overrides = {}) => ({
  findSurfaceSamples: () => ({ source: "a.ts" }),
  readEffectiveConfig: () => ({ rules: {} }),
  versionDrift: () => ({ installed: null, latest: "abc", behind: false, note: "not yet" }),
  pointerDrift: async () => ({ files: [{ path: "eslint.config.mjs", state: "missing" }], local: [], config: ["missing"] }),
  codeDrift: async () => ({ eslint: { mismatches: [], violations: { "no-var": 2 }, comparison: { unexplained: [], moved: [], newRules: [], resolved: [] } } }),
  loadRulings: () => ({ provenance: {}, rows: [] }),
  loadPrediction: () => ({ tightened: ["no-var"], counts: { "no-var": 2 } }),
  writePrediction: vi.fn(),
  ...overrides,
});

describe("orrery observe", () => {
  it("exits 2 without a body", async () => {
    const q = quiet();
    expect(await observe([])).toBe(2);
    expect(q.out()).toContain("usage: orrery observe <bodyDir>...");
    q.restore();
  });

  it("writes a report and exits 0 when nothing is unexplained", async () => {
    const q = quiet();
    const report = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-obs-"));
    const code = await observe(["Z:/Github/x", "--report", report], fakeDeps());
    expect(code).toBe(0);
    const files = fs.readdirSync(report);
    expect(files.some((f) => f.endsWith("-tooling.md"))).toBe(true);
    expect(files.some((f) => f.endsWith("-tooling.json"))).toBe(true);
    expect(fs.readFileSync(path.join(report, files.find((f) => f.endsWith("-tooling.md"))), "utf8")).toContain("| no-var | 2 |");
    fs.rmSync(report, { recursive: true, force: true });
    q.restore();
  });

  it("exits 1 when a rule violation is unexplained by the prediction or the effective config mismatches", async () => {
    const q = quiet();
    const report = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-obs-"));
    // The command computes the comparison itself from the violations: react/x is not in the prediction's tightened set.
    const code = await observe(["Z:/Github/x", "--report", report], fakeDeps({ codeDrift: async () => ({ eslint: { mismatches: ["no-var: missing"], violations: { "react/x": 3 } } }) }));
    expect(code).toBe(1);
    expect(q.out()).toMatch(/mismatch.*no-var: missing/s);
    expect(q.out()).toMatch(/unexplained.*react\/x/s);
    fs.rmSync(report, { recursive: true, force: true });
    q.restore();
  });

  it("with --predict writes the prediction from the observed violations and does not compare", async () => {
    const q = quiet();
    const deps = fakeDeps({ loadPrediction: () => null });
    const report = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-obs-"));
    expect(await observe(["Z:/Github/x", "--predict", "--report", report], deps)).toBe(0);
    expect(deps.writePrediction).toHaveBeenCalledWith("x", expect.objectContaining({ tightened: expect.any(Array), counts: { "no-var": 2 } }));
    fs.rmSync(report, { recursive: true, force: true });
    q.restore();
  });

  it("without a prediction and without --predict exits 1 saying so", async () => {
    const q = quiet();
    const report = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-obs-"));
    expect(await observe(["Z:/Github/x", "--report", report], fakeDeps({ loadPrediction: () => null }))).toBe(1);
    expect(q.out()).toMatch(/no prediction for x; run with --predict/);
    fs.rmSync(report, { recursive: true, force: true });
    q.restore();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run packages/orrery/tests/observe-code.test.mjs packages/orrery/tests/observe-command.test.mjs`
Expected: FAIL — cannot resolve the modules

- [ ] **Step 3: Write the implementation**

```javascript
// packages/orrery/src/lib/observe/scratch.mjs
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const posix = (p) => p.replaceAll("\\", "/");

export async function materialise(bodyDir, bodyConfig, scratchDir, { bundleDir, functions } = {}) {
  const bundle = posix(path.resolve(bundleDir));
  const klass = `${bundle}/classes/next-supabase-mono`;
  const fns = functions ?? {
    stylelint: (await import(pathToFileURL(`${klass}/stylelint.mjs`).href)).default,
    jscpd: (await import(pathToFileURL(`${klass}/jscpd.mjs`).href)).default,
    cspell: (await import(pathToFileURL(`${klass}/cspell.mjs`).href)).default,
    lsLint: (await import(pathToFileURL(`${bundle}/physics/ls-lint.mjs`).href)).default,
    syncpack: (await import(pathToFileURL(`${bundle}/physics/syncpack.mjs`).href)).default,
    tsconfigInclude: bodyConfig.tsconfig?.include ?? ["apps/*/src", "packages/*/src"],
  };
  const body = { ...bodyConfig, root: posix(bodyDir) };
  const write = (name, text) => { const f = path.join(scratchDir, name); fs.writeFileSync(f, text); return f; };
  return {
    eslint: write("eslint.config.mjs", `import orrery from ${JSON.stringify(pathToFileURL(`${klass}/eslint.mjs`).href)};\nexport default await orrery(${JSON.stringify(body, null, 2)});\n`),
    tsconfig: write("tsconfig.json", JSON.stringify({ extends: `${klass}/tsconfig.json`, include: fns.tsconfigInclude.map((i) => `${posix(bodyDir)}/${i}`), compilerOptions: { noEmit: true } }, null, 2)),
    stylelint: write("stylelint.config.mjs", `export default ${JSON.stringify(fns.stylelint(body), null, 2)};\n`),
    jscpd: write("jscpd.json", JSON.stringify(fns.jscpd(body), null, 2)),
    cspell: write("cspell.json", JSON.stringify(fns.cspell(body), null, 2)),
    lsLint: write(".ls-lint.yml", typeof fns.lsLint(body) === "string" ? fns.lsLint(body) : toYaml(fns.lsLint(body))),
    syncpack: write("syncpack.json", JSON.stringify(fns.syncpack(body), null, 2)),
  };
}

function toYaml(value, indent = "") {
  if (typeof value !== "object" || value === null) return String(value);
  return Object.entries(value).map(([k, v]) => (typeof v === "object" ? `${indent}${k}:\n${toYaml(v, indent + "  ")}` : `${indent}${k}: ${v}`)).join("\n") + "\n";
}
```

```javascript
// packages/orrery/src/lib/observe/code.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { optionsOf, severityOf } from "../reconcile/ordering.mjs";
import { readEffectiveConfig } from "../effective-config.mjs";
import { materialise } from "./scratch.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(here, "../../..");
const requireFromOrrery = createRequire(path.join(packageDir, "package.json"));
const binOf = (pkg, rel) => path.join(path.dirname(requireFromOrrery.resolve(`${pkg}/package.json`)), rel);

const norm = (v) => JSON.stringify([severityOf(v), ...optionsOf(v)]);
const read = (body, dotted) => dotted.split(".").reduce((o, k) => o?.[k], body);
const resolveParameters = (value, body) => {
  if (Array.isArray(value)) return value.flatMap((v) => (v && typeof v === "object" && !Array.isArray(v) && "$parameter" in v ? read(body, v.$parameter) ?? [] : [resolveParameters(v, body)]));
  if (value && typeof value === "object") return "$parameter" in value ? read(body, value.$parameter) : Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolveParameters(v, body)]));
  return value;
};

export function effectiveMismatches(effectiveRules, rows, surface, body) {
  const out = [];
  const expected = rows.filter((r) => r.tool === "eslint" && r.surface === surface && r.chosen !== null && r.tier);
  const named = new Set();
  for (const r of expected) {
    named.add(r.key);
    const actual = effectiveRules[r.key];
    if (actual === undefined) { out.push(`${r.key}: missing`); continue; }
    const want = resolveParameters(r.chosen, body);
    if (norm(actual) !== norm(want)) out.push(`${r.key}: got ${norm(actual)} want ${norm(want)}`);
  }
  for (const [key, value] of Object.entries(effectiveRules)) if (!named.has(key) && severityOf(value) !== "off") out.push(`${key}: not in the rulings and not off`);
  return out;
}

export function violationsByRule(eslintJson) {
  const counts = {};
  for (const file of JSON.parse(eslintJson)) for (const m of file.messages) { const k = m.ruleId ?? "(fatal)"; counts[k] = (counts[k] ?? 0) + 1; }
  return Object.fromEntries(Object.entries(counts).sort(([x], [y]) => (x < y ? -1 : 1)));
}

export function compareToPrediction(observed, prediction) {
  const tightened = new Set(prediction.tightened);
  const unexplained = Object.keys(observed).filter((r) => r !== "(fatal)" && !tightened.has(r));
  const moved = Object.entries(observed).filter(([r, n]) => prediction.counts[r] !== undefined && prediction.counts[r] !== n).map(([r, n]) => ({ rule: r, was: prediction.counts[r], now: n }));
  const newRules = Object.keys(observed).filter((r) => tightened.has(r) && prediction.counts[r] === undefined);
  // Tightened rules with no violations now: either the body fixed them or they never fired.
  const resolved = prediction.tightened.filter((r) => observed[r] === undefined);
  return { unexplained, moved, newRules, resolved };
}

// Which rules the bundle tightens for this body: every ruled rule whose value differs from what
// the body's own effective config has for that surface (or that the body lacks).
export function tightenedFor(rows, bodyEffectiveBySurface, body) {
  const out = new Set();
  for (const r of rows) {
    if (r.tool !== "eslint" || r.chosen === null || !r.tier) continue;
    const own = bodyEffectiveBySurface[r.surface]?.rules?.[r.key];
    if (own === undefined || norm(own) !== norm(resolveParameters(r.chosen, body))) out.add(r.key);
  }
  return [...out].sort();
}

function defaultRun(command, args, cwd) {
  try { return execFileSync(command, args, { cwd, encoding: "utf8", maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] }); }
  catch (error) { if (typeof error.stdout === "string" && error.stdout.length) return error.stdout; throw error; } // linters exit 1 with findings
}

export async function codeDrift(bodyDir, { rows, bodyConfig, samples, bodyEffective, tools = ["eslint", "tsc", "stylelint", "jscpd", "cspell", "ls-lint", "syncpack"], run = defaultRun, exec, scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-observe-")) }) {
  const files = await materialise(bodyDir, bodyConfig, scratchDir, { bundleDir: packageDir });
  const results = {};
  const node = process.execPath;
  if (tools.includes("eslint")) {
    const eslintBin = binOf("eslint", "bin/eslint.js");
    const execWithScratch = exec ?? ((dir, file) => run(node, [eslintBin, "-c", files.eslint, "--no-config-lookup", "--print-config", file], dir));
    const mismatches = [];
    for (const [surface, file] of Object.entries(samples)) {
      const effective = readEffectiveConfig(bodyDir, file, execWithScratch);
      mismatches.push(...effectiveMismatches(effective.rules ?? {}, rows, surface, bodyConfig).map((m) => `${surface} ${m}`));
    }
    const json = run(node, [eslintBin, "-c", files.eslint, "--no-config-lookup", "-f", "json", "apps", "packages", "scripts"], bodyDir);
    results.eslint = { mismatches, violations: violationsByRule(json), tightened: tightenedFor(rows, bodyEffective ?? {}, bodyConfig) };
  }
  if (tools.includes("tsc")) {
    const out = run(node, [binOf("typescript", "bin/tsc"), "-p", files.tsconfig, "--pretty", "false"], bodyDir);
    const counts = {};
    for (const m of out.matchAll(/error (TS\d+):/g)) counts[m[1]] = (counts[m[1]] ?? 0) + 1;
    results.tsc = { errors: counts };
  }
  if (tools.includes("stylelint")) {
    const out = run(node, [binOf("stylelint", "bin/stylelint.mjs"), "--config", files.stylelint, "-f", "json", "**/*.css"], bodyDir);
    results.stylelint = { count: JSON.parse(out || "[]").reduce((n, f) => n + f.warnings.length, 0) };
  }
  if (tools.includes("jscpd")) {
    const out = run(node, [binOf("jscpd", "bin/jscpd"), "-c", files.jscpd, "-r", "json", "-o", scratchDir, "."], bodyDir);
    const reportFile = path.join(scratchDir, "jscpd-report.json");
    results.jscpd = { clones: fs.existsSync(reportFile) ? JSON.parse(fs.readFileSync(reportFile, "utf8")).statistics?.total?.clones ?? 0 : 0 };
  }
  if (tools.includes("cspell")) {
    const out = run(node, [binOf("cspell", "bin.mjs"), "lint", "-c", files.cspell, "--no-progress", "--no-summary", "**/*.{ts,tsx,md}"], bodyDir);
    results.cspell = { issues: out.split(/\r?\n/).filter((l) => /:\d+:\d+ - /.test(l)).length };
  }
  if (tools.includes("ls-lint")) {
    const out = run(binOf("@ls-lint/ls-lint", "bin/ls-lint" + (process.platform === "win32" ? ".exe" : "")), ["-config", files.lsLint], bodyDir);
    results["ls-lint"] = { errors: out.split(/\r?\n/).filter((l) => l.includes("kebab-case")).length };
  }
  if (tools.includes("syncpack")) {
    const out = run(node, [binOf("syncpack", "dist/bin.js"), "lint", "--config", files.syncpack], bodyDir);
    results.syncpack = { mismatches: (out.match(/✘/g) ?? []).length };
  }
  return results;
}
```

The `binOf` relative paths (`bin/stylelint.mjs`, `bin/jscpd`, `bin.mjs` for cspell, `bin/ls-lint`, `dist/bin.js` for syncpack) are read from each package's `bin` field in `package.json`; the implementer replaces the literal with `binField(pkg)` that reads it, and adds a test that each resolves to an existing file after `pnpm install`.

```javascript
// packages/orrery/src/lib/observe/report.mjs
export function renderObservation(results, date) {
  const lines = [`# Tooling observation — ${date}`, ""];
  for (const r of results) {
    lines.push(`## ${r.name} (${r.dir}${r.sha ? ` @ ${r.sha}` : ""})`, "");
    lines.push(`- version: ${r.version.note}`);
    lines.push(`- pointers: ${r.pointers.files.filter((f) => f.state === "identical").length} identical, ${r.pointers.files.filter((f) => f.state === "differs").length} differ, ${r.pointers.files.filter((f) => f.state === "missing").length} missing; local ${r.pointers.local.length} violation(s); config ${r.pointers.config.join(", ") || "valid"}`);
    if (r.code?.eslint) {
      lines.push(`- eslint effective config: ${r.code.eslint.mismatches.length === 0 ? "matches the rulings on every surface" : r.code.eslint.mismatches.length + " mismatch(es)"}`);
      lines.push("", "| rule | violations |", "|---|---|");
      for (const [rule, n] of Object.entries(r.code.eslint.violations)) lines.push(`| ${rule} | ${n} |`);
      if (r.comparison) {
        lines.push("", `unexplained: ${r.comparison.unexplained.join(", ") || "none"}; moved: ${r.comparison.moved.map((m) => `${m.rule} ${m.was}→${m.now}`).join(", ") || "none"}; new: ${r.comparison.newRules.join(", ") || "none"}; resolved: ${r.comparison.resolved.join(", ") || "none"}`);
      }
    }
    for (const tool of ["tsc", "stylelint", "jscpd", "cspell", "ls-lint", "syncpack"]) if (r.code?.[tool]) lines.push(`- ${tool}: ${JSON.stringify(r.code[tool])}`);
    if (r.code?.eslint?.mismatches?.length) { lines.push("", "### eslint mismatches", ""); for (const m of r.code.eslint.mismatches) lines.push(`- ${m}`); }
    lines.push("");
  }
  return lines.join("\n");
}
```

```javascript
// packages/orrery/src/commands/observe.mjs
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { findSurfaceSamples } from "../lib/surfaces.mjs";
import { readEffectiveConfig } from "../lib/effective-config.mjs";
import { versionDrift as realVersionDrift } from "../lib/observe/version.mjs";
import { pointerDrift as realPointerDrift } from "../lib/observe/pointers.mjs";
import { codeDrift as realCodeDrift, compareToPrediction } from "../lib/observe/code.mjs";
import { renderObservation } from "../lib/observe/report.mjs";
import { loadBodyConfig, withDefaults } from "../lib/body-config.mjs";
import schema from "../../classes/next-supabase-mono/schema.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../../..");
const USAGE = "usage: orrery observe <bodyDir>... [--predict] [--report <dir>] [--tools a,b] [--surface <name>]";

const defaults = {
  findSurfaceSamples,
  readEffectiveConfig,
  versionDrift: realVersionDrift,
  pointerDrift: realPointerDrift,
  codeDrift: realCodeDrift,
  loadRulings: () => JSON.parse(fs.readFileSync(path.join(repoRoot, "docs/decisions/rulings.json"), "utf8")),
  loadPrediction: (name) => { const f = path.join(repoRoot, "docs/predictions", `${name}.json`); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : null; },
  writePrediction: (name, prediction) => { const dir = path.join(repoRoot, "docs/predictions"); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(prediction, null, 2) + "\n"); },
  today: () => new Date().toISOString().slice(0, 10),
};

export default async function observe(argv, deps = {}) {
  const d = { ...defaults, ...deps };
  let values, positionals;
  try {
    ({ values, positionals } = parseArgs({ args: argv, options: { predict: { type: "boolean", default: false }, report: { type: "string", default: path.join(repoRoot, "docs/observations") }, tools: { type: "string" }, surface: { type: "string" } }, allowPositionals: true }));
  } catch (error) { console.error(`${error.message}\n${USAGE}`); return 2; }
  if (positionals.length === 0) { console.error(USAGE); return 2; }

  const rulings = d.loadRulings();
  const templates = path.join(repoRoot, "packages/orrery/templates/next-supabase-mono");
  const results = [];
  let failed = false;
  for (const bodyDir of positionals) {
    const name = path.basename(bodyDir).toLowerCase();
    let sha = null;
    try { sha = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: bodyDir, encoding: "utf8" }).trim(); } catch {}
    const version = d.versionDrift(bodyDir);
    const pointers = await d.pointerDrift(bodyDir, templates, schema);
    // Before adoption a body has no orrery.config.mjs: observe uses the body's parameters from
    // docs/predictions/<name>.json when present, else the schema defaults with a placeholder entry point.
    const prediction = d.loadPrediction(name);
    const bodyConfig = withDefaults(prediction?.bodyConfig ?? (fs.existsSync(path.join(bodyDir, "orrery.config.mjs")) ? (await loadBodyConfig(bodyDir)).config : { class: "next-supabase-mono", tailwind: { entryPoint: "apps/*/src/app/globals.css" } }), schema);
    const samples = values.surface ? Object.fromEntries(Object.entries(d.findSurfaceSamples(bodyDir)).filter(([s]) => s === values.surface)) : d.findSurfaceSamples(bodyDir);
    const bodyEffective = {};
    for (const [surface, file] of Object.entries(samples)) { try { bodyEffective[surface] = d.readEffectiveConfig(bodyDir, file); } catch { bodyEffective[surface] = { rules: {} }; } }
    const code = await d.codeDrift(bodyDir, { rows: rulings.rows, bodyConfig, samples, bodyEffective, tools: values.tools?.split(",") });
    const entry = { name, dir: bodyDir, sha, version, pointers, code };
    if (values.predict) {
      d.writePrediction(name, { body: name, sha, generatedAt: d.today(), bodyConfig, tightened: code.eslint?.tightened ?? [], counts: code.eslint?.violations ?? {}, tools: Object.fromEntries(Object.entries(code).filter(([t]) => t !== "eslint")) });
      console.log(`${name}: prediction written`);
    } else if (!prediction) {
      console.error(`${name}: no prediction for ${name}; run with --predict to record one`);
      failed = true;
    } else if (code.eslint) {
      entry.comparison = compareToPrediction(code.eslint.violations, prediction);
      if (code.eslint.mismatches.length) { failed = true; console.error(`${name}: eslint effective config mismatch(es):\n  ${code.eslint.mismatches.join("\n  ")}`); }
      if (entry.comparison.unexplained.length) { failed = true; console.error(`${name}: unexplained violations from rules the rulings did not tighten: ${entry.comparison.unexplained.join(", ")}`); }
    }
    results.push(entry);
  }
  fs.mkdirSync(values.report, { recursive: true });
  const stem = path.join(values.report, `${d.today()}-tooling`);
  fs.writeFileSync(`${stem}.md`, renderObservation(results, d.today()) + "\n");
  fs.writeFileSync(`${stem}.json`, JSON.stringify(results, null, 2) + "\n");
  console.log(`report: ${stem}.md`);
  return failed ? 1 : 0;
}
```

Register `observe` in `cli.mjs` with usage `  orrery observe <bodyDir>... [--predict] [--report <dir>]` and `  observe       version, pointer and code drift of a body against the bundle, read-only`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run packages/orrery/tests/observe-code.test.mjs packages/orrery/tests/observe-command.test.mjs`
Expected: PASS — 5 + 5 tests

- [ ] **Step 5: First real observation, eslint only, one surface, on the fixture then on libra**

```
pnpm orrery observe fixtures/next-supabase-mono --predict --tools eslint --report .superpowers/observe
pnpm orrery observe fixtures/next-supabase-mono --tools eslint --report .superpowers/observe
pnpm orrery observe Z:/Github/libra --predict --tools eslint --surface source --report .superpowers/observe
```

Expected: the fixture's second run exits 0 with zero mismatches and zero unexplained. libra's run writes `docs/predictions/libra.json` (do not commit it yet; Task 10 records the full predictions) and prints the rule counts. If the eslint run against libra fails to parse (type information), the cause is the scratch config's `tsconfigRootDir`; check it equals libra's root and that libra's `node_modules` is installed. Runtime is minutes; note it.

- [ ] **Step 6: Commit and land**

```bash
git checkout -b feat/2b-observe-code origin/develop
git add packages/orrery/src/lib/observe packages/orrery/src/commands/observe.mjs packages/orrery/src/cli.mjs packages/orrery/tests/observe-code.test.mjs packages/orrery/tests/observe-command.test.mjs
git commit -m "feat(observe): code drift against the bundle and the observe command [GH-000]"
git push -u origin HEAD && gh pr create --base develop --title "feat(observe): code drift against the bundle and the observe command [GH-000]" --body "Task 9 of the 2b plan." && gh pr merge --squash --auto
```

---

### Task 10: Predictions for aeleos and libra, the observation report, CI wiring

**Files:**
- Create by running: `docs/predictions/aeleos.json`, `docs/predictions/libra.json`, `docs/observations/<date>-tooling.md` and `.json`
- Modify: `.github/workflows/observe.yml` — a second job `tooling` that clones every registered body at its default branch, installs it, and runs `orrery observe` in report mode
- Modify: `.github/workflows/ci.yml` — nothing new: the `test` job already runs the bundle-honesty and fixture tests
- Modify: `docs/decisions/0003-repository-policy.md`? No. Create `docs/decisions/0016-observation-baseline.md`: the first observation of both donors, counts per tool, and the sentence that these are predictions, not rulings
- Test: `packages/orrery/tests/workflows.test.mjs` — assertions for the `tooling` job

**Interfaces:** consumes everything above; produces the committed predictions the spec calls for.

- [ ] **Step 1: Record the predictions for both donors**

Both donors must be at a clean, installed checkout; record their SHAs. Then:

```
pnpm orrery observe Z:/Github/aeleos Z:/Github/libra --predict --report docs/observations
```

Expected: `docs/predictions/aeleos.json` and `libra.json` with `bodyConfig` (the parameters `observe` inferred: for the donors the real entry points are `apps/hub/src/app/globals.css` and `apps/store/src/app/globals.css`; pass them by writing a minimal `bodyConfig` into each prediction file before the run, then re-run; record which), `tightened` (the rule set the bundle changes for that body), and `counts`. Then the check run:

```
pnpm orrery observe Z:/Github/aeleos Z:/Github/libra --report docs/observations
```

Expected: exit 0, zero effective-config mismatches on every surface for both donors, zero unexplained rules. Any mismatch is a bundle defect: fix the generator or the ordering (through the loop, with a test), regenerate with `orrery bundle`, and repeat. Any unexplained rule is either a bundle defect or a donor that is not clean under its own config; report which with the evidence before deciding.

Known expectations from the spec: libra shows `unicorn/filename-case` violations in the hundreds (Phase 0's codemod was never run); aeleos shows stylelint findings in `globals.css`; both show sonarjs threshold violations.

- [ ] **Step 2: Extend the nightly**

Add to `.github/workflows/observe.yml` a job `tooling` after `repository-policy`:

```yaml
  tooling:
    name: tooling observation
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
        with:
          ref: develop
      - uses: pnpm/action-setup@v4
        with:
          version: 11
      - uses: actions/setup-node@v5
        with:
          node-version: 24
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - name: Clone and install every registered body
        run: |
          mkdir -p bodies
          for repo in $(node -e 'const r=require("./registry.json");console.log(Object.values(r.bodies).filter(b=>b.class).map(b=>b.repo).join(" "))'); do
            name=$(basename "$repo" | tr '[:upper:]' '[:lower:]')
            git clone --depth 1 "https://github.com/$repo.git" "bodies/$name"
            (cd "bodies/$name" && pnpm install --frozen-lockfile --ignore-scripts) || echo "::warning::install failed for $repo"
          done
      - name: Observe
        run: |
          set +e
          pnpm -s orrery observe $(ls -d bodies/*/) --report docs/observations
          echo "status=$?" >> "$GITHUB_OUTPUT"
        id: observe
      - name: Publish the report
        run: cat docs/observations/$(date -u +%F)-tooling.md
      - name: Fail on a bundle defect
        if: steps.observe.outputs.status != '0'
        run: exit 1
```

Read-only towards the bodies: the clones are the runner's, never pushed. `--ignore-scripts` keeps a body's `prepare` (husky) from running in the clone. A body with no prediction file fails the step by design; the predictions for Puck, eclipse-con and Janus are recorded in the cut-over, so until then those three are excluded by adding `"observe": false` to their registry entries and filtering on it in the `node -e` (add that field and the filter; document it in the registry's `$comment`).

Extend `workflows.test.mjs` with: "the tooling job clones bodies read-only and never pushes them" expecting `git clone --depth 1`, `--ignore-scripts`, `orrery observe`, and NOT `git push` within the `tooling` job text.

- [ ] **Step 3: The baseline record**

`docs/decisions/0016-observation-baseline.md`: date, both donor SHAs, per-surface eslint tightened counts, total predicted violations per tool per donor, the three known expectations confirmed or not, and the sentence: "These are predictions of what adoption will surface, recorded so drift is visible. They are not rulings; the rulings are 0004–0015."

- [ ] **Step 4: Commit and land**

```bash
git checkout -b feat/2b-predictions origin/develop
git add docs/predictions docs/observations docs/decisions/0016-observation-baseline.md .github/workflows/observe.yml registry.json packages/orrery/tests/workflows.test.mjs
git commit -m "feat(observe): predictions for aeleos and libra, baseline record, nightly tooling observation [GH-000]"
git push -u origin HEAD && gh pr create --base develop --title "feat(observe): donor predictions, baseline record, nightly tooling observation [GH-000]" --body "Task 10 of the 2b plan." && gh pr merge --squash --auto
```

---

## Done when

- `pnpm test` passes: the 214 tests of Phase 2e plus this plan's. Verified 2026-09-09 by extracting every code block into a scratch copy of the package and running it: 85 new unit-level tests pass (299 total with 2e's) before the three environment-bound files (bundle-honesty, fixture-pointers, workflows additions), which run only once the fixture, the bundle and the workflow exist. Report the observed count.
- `orrery reconcile Z:/Github/aeleos Z:/Github/libra` exits 0 with no residue; twelve records and `rulings.json` are committed; every ruling has a row.
- `orrery bundle` regenerates `physics/` and `classes/next-supabase-mono/` byte-identically from the committed rulings (a test runs it into a temp dir and diffs against the committed files).
- `orrery observe Z:/Github/aeleos Z:/Github/libra` exits 0: effective config equals the rulings on every surface for both donors, and every violation comes from a rule the rulings tightened for that body. The predictions are committed.
- No body was modified: `git -C Z:/Github/aeleos status --short` and the same for libra are empty at the end, and both HEADs are the SHAs recorded in the predictions.

## Rulings made while planning, for the controller to confirm or overturn

1. `observe` runs Orrery's tool binaries and plugins against the body, not the body's own; after adoption that is the body's exact situation. The body's `node_modules` is still needed for type-aware parsing.
2. `import/*` rules are placed in the class, not physics, because neither donor depends on `eslint-plugin-import` directly; the rules arrive through `eslint-config-next`.
3. `off` agreements from `eslint-config-prettier`'s prefixes (`@stylistic`, `vue`, `flowtype`, …) are not emitted individually; the class appends `eslint-config-prettier` last, which is where both donors get them.
4. Language options and plugin settings (parser, project service, React version, boundaries elements) are hand-written in `eslint.base.mjs`, not generated: rows cover rules, and both donors agree on these.
5. The class's surface globs are fixed conventions (`apps/*/src/**/*.ts`, `**/*.test.{ts,tsx}`, …), not derived from the donors' 61 override blocks; the six measured surfaces are what those blocks reduce to.
6. tsconfig per-app data (`types`, `include`, `paths`) stays in each app's own tsconfig under the class `extends`; the bundle carries only compiler flags.
7. The fixture body is a pnpm workspace package so its pointer files resolve `@vaoan/orrery` the way a body will.
8. The nightly tooling observation clones only bodies flagged `observe: true` in the registry until the cut-over records predictions for the other three.
9. A `residue` row at reconcile time stops the executor: pre-rulings are added only after the owner has seen the row, per the stop-when-cornered rule.
