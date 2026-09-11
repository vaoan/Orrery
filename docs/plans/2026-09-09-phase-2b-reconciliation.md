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
// Each app-scoped surface tries the donors' own consumer-facing apps (aeleos: hub, libra:
// store) before falling back to a plain apps/* wildcard: a bare wildcard sorts alphabetically
// across every app in a monorepo, and in libra that puts apps/admin ahead of apps/store even
// though store is the app whose config the donor reader is meant to sample. The bracketed
// pattern is a seed of known layouts, not policy — same spirit as CANDIDATES in
// effective-config.mjs — and it is simply skipped (no matches) for any repo without a
// hub or store app, leaving the generic fallback to do the work.
const NOT_SOURCE = /(\.test\.|\.spec\.|\.d\.ts$|(^|\/)index\.tsx?$)/;

export const SURFACES = [
  { name: "source", patterns: ["apps/{hub,store}/src/features/**/*.ts", "apps/*/src/features/**/*.ts", "apps/*/src/**/*.ts"], exclude: NOT_SOURCE },
  { name: "component", patterns: ["apps/{hub,store}/src/features/**/*.tsx", "apps/*/src/features/**/*.tsx", "apps/*/src/**/*.tsx"], exclude: NOT_SOURCE },
  { name: "unit-test", patterns: ["apps/{hub,store}/tests/**/*.test.{ts,tsx}", "apps/*/tests/**/*.test.{ts,tsx}", "apps/*/src/**/*.test.{ts,tsx}"], exclude: /(^|\/)e2e\// },
  { name: "e2e", patterns: ["apps/{hub,store}/e2e/**/*.spec.ts", "apps/{hub,store}/tests/e2e/**/*.spec.ts", "apps/*/e2e/**/*.spec.ts", "apps/*/tests/e2e/**/*.spec.ts"], exclude: /$^/ },
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
  - `EXEMPTION_KEY = /(allow|ignore|except|exempt|skip|onlyIf)/i` — UNANCHORED, matching anywhere in an
    option key, because the exemptions worth detecting sit in the middle of one: `argsIgnorePattern`,
    `allowShortCircuit`, `onlyIfContainsSeparator`. An anchored form would have matched none of them.
  - `PARAMETER_KEYS = ["entryPoint", "elements", "paths", "project", "tsconfigRootDir", "words", "packageDir"]`
    (C3 removed `patterns`: `no-restricted-imports` is now split by the restriction rule below, per surface,
    not by a single `imports.restrictedPatterns` parameter).
  - `namesProject(entry)`, `RESTRICTION_FIELD`, `splitRestrictions(rule, surface, optionsA, optionsB?, { always? })`
    — C3's token test and the split it drives: the universal subset of a `no-restricted-syntax` /
    `-imports` / `-properties` rule stays in the shared tier, the rest becomes that surface's
    `restrictions.<surface>.<field>` body parameter.
  - `PRE_RULINGS`: the table from "Verified before writing", keyed by rule, each `{ chosen | parameter, test, note, surfaces? }`. `surfaces`, when present, is the list of surfaces the pre-ruling governs; absent means everywhere.
  - `stricter(rule, a, b, surface?) => { chosen, test, note }` — the whole ordering for one conflicting rule. A surface-restricted pre-ruling applies only when `surface` is among its `surfaces`; otherwise `stricter` falls through to the ordinary ordering exactly as if the rule had no pre-ruling.

- [ ] **Step 1: Write the failing test**

```javascript
// packages/orrery/tests/reconcile-ordering.test.mjs
import { describe, it, expect } from "vitest";
import { severityOf, optionsOf, stricter, PRE_RULINGS, namesProject, splitRestrictions } from "../src/lib/reconcile/ordering.mjs";

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
  // C3: the universal half of a restriction rule is the half that names nothing project-specific.
  // A parent-relative ban (`../*`) names a shape; an alias group names a project's own module
  // layout, so it goes back to that body as a per-surface parameter.
  it("splits no-restricted-imports into the universal pattern and the surface's own parameter", () => {
    const a = ["error", { patterns: [{ group: ["../*"] }] }];
    const b = ["error", { patterns: [{ group: ["@ui/*"] }, { group: ["@shared/*"] }] }];
    const r = stricter("no-restricted-imports", a, b, "source");
    expect(r.chosen).toEqual(["error", { patterns: [{ group: ["../*"] }, { $parameter: "restrictions.source.imports" }] }]);
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
  it("rules on testing-library/no-dom-import: react's autofix is the benefit", () => {
    const r = stricter("testing-library/no-dom-import", [2], [2, "react"], "unit-test");
    expect(r.chosen).toEqual(["error", "react"]);
    expect(r.test).toBe("benefit");
  });
  it("rules on playwright/expect-expect: assertFunctionNames becomes the e2e parameter", () => {
    const r = stricter("playwright/expect-expect", [2], [2, { assertFunctionNames: ["x"] }], "e2e");
    expect(r.chosen).toEqual(["error", { assertFunctionNames: { $parameter: "e2e.assertFunctionNames" } }]);
    expect(r.test).toBe("parameter");
  });
  it("rules on no-restricted-syntax: the union of both sides minus body-data selectors, ending in the e2e parameter", () => {
    const r = stricter("no-restricted-syntax", [2], [2], "e2e");
    expect(r.test).toBe("benefit");
    const entries = r.chosen.slice(1, -1);
    const selectors = entries.map((o) => o.selector);
    const messages = entries.map((o) => o.message);

    // every selector aeleos bans, kept
    expect(selectors).toEqual(expect.arrayContaining([
      "CallExpression[callee.property.name=/^(getByRole|getAllByRole|queryByRole|queryAllByRole|findByRole|findAllByRole)$/]",
      "CallExpression[callee.property.name=/^(getByText|getAllByText|queryByText|queryAllByText|findByText|findAllByText)$/]",
      "CallExpression[callee.property.name='toContainText']",
      "CallExpression[callee.property.name='toHaveText']",
      "CallExpression[callee.property.name='locator'] Literal[value=/data-testid/]",
      "NewExpression[callee.name='Promise'] CallExpression[callee.name='setTimeout']",
    ]));
    // every selector libra bans (beyond aeleos's), kept
    expect(selectors).toEqual(expect.arrayContaining([
      "CallExpression[callee.property.name='toHaveClass']",
      "CallExpression[callee.property.name='toHaveCSS']",
      "CallExpression[callee.property.name='locator'][arguments.0.value=/^[.][a-zA-Z]/]",
      "CallExpression[callee.property.name='locator'][arguments.0.value=/class/]",
      "CallExpression[callee.name=/^(getByRole|getAllByRole|queryByRole|queryAllByRole|findByRole|findAllByRole)$/]",
      "CallExpression[callee.name=/^(getByText|getAllByText|queryByText|queryAllByText|findByText|findAllByText)$/]",
      "CallExpression[callee.property.name=/^(getByLabel|getByLabelText|getAllByLabel|getAllByLabelText|queryByLabel|queryByLabelText|queryAllByLabel|queryAllByLabelText|findByLabel|findByLabelText|findAllByLabel|findAllByLabelText)$/]",
      "CallExpression[callee.name=/^(getByLabel|getByLabelText|getAllByLabel|getAllByLabelText|queryByLabel|queryByLabelText|queryAllByLabel|queryAllByLabelText|findByLabel|findByLabelText|findAllByLabel|findAllByLabelText)$/]",
      "CallExpression[callee.property.name=/^(getByPlaceholder|getByPlaceholderText|getAllByPlaceholder|getAllByPlaceholderText|queryByPlaceholder|queryByPlaceholderText|queryAllByPlaceholder|queryAllByPlaceholderText|findByPlaceholder|findByPlaceholderText|findAllByPlaceholder|findAllByPlaceholderText)$/]",
      "CallExpression[callee.name=/^(getByPlaceholder|getByPlaceholderText|getAllByPlaceholder|getAllByPlaceholderText|queryByPlaceholder|queryByPlaceholderText|queryAllByPlaceholder|queryAllByPlaceholderText|findByPlaceholder|findByPlaceholderText|findAllByPlaceholder|findAllByPlaceholderText)$/]",
    ]));
    // aeleos's combined label/placeholder selector is subsumed by libra's two and dropped
    expect(selectors).not.toContain("CallExpression[callee.property.name=/^(getByLabel|getByLabelText|getByPlaceholder|getByPlaceholderText)$/]");
    // libra's Supabase-specific bans are body data, not in the shared list
    expect(selectors).not.toContain("Literal[value=54321]");
    expect(selectors).not.toContain("Literal[value=64321]");
    expect(selectors).not.toContain("Literal[value=/127\\.0\\.0\\.1:(54321|64321)/]");
    expect(selectors).not.toContain("CallExpression[callee.name='getLocalSupabaseEnv'], CallExpression[callee.object.name='getLocalSupabaseEnv']");
    // no message names a body file or a body-specific helper
    expect(messages.some((m) => m.includes(".claude/"))).toBe(false);
    expect(messages.some((m) => m.includes("tid("))).toBe(false);
    // the shared list ends with the e2e parameter marker
    expect(r.chosen.at(-1)).toEqual({ $parameter: "restrictions.e2e.syntax" });
  });
  it("falls through to the ordinary ordering when a surface-restricted pre-ruling's surface does not match", () => {
    const r = stricter("no-restricted-syntax", ["error", { selector: "a" }], ["error", { selector: "b" }], "source");
    // Not the e2e pre-ruling's Playwright union: the ordinary ordering handles it, which for a
    // restriction rule means the union of what names no project plus this surface's parameter.
    expect(r.test).toBe("parameter");
    expect(r.chosen).toEqual(["error", { selector: "a" }, { selector: "b" }, { $parameter: "restrictions.source.syntax" }]);
  });

  // C3: the same rule on the same two donors, judged by the token test rather than by hand.
  it("keeps the entries that name nothing project-specific and parameterises the ones that do", () => {
    const a = ["error", { selector: "WithStatement" }, { selector: "CallExpression[callee.name='readFileSync']", message: "See: shared/application/utils/fs.ts" }];
    const b = ["error", { selector: "CallExpression[callee.name='eval']" }];
    const r = stricter("no-restricted-syntax", a, b, "package");
    expect(r.test).toBe("parameter");
    expect(r.chosen).toEqual([
      "error",
      { selector: "WithStatement" },
      { selector: "CallExpression[callee.name='eval']" },
      { $parameter: "restrictions.package.syntax" },
    ]);
  });
  // S6: PR #29's ruling made i18next/no-literal-string's `mode: "all"` pre-ruling apply to
  // every surface, including `script` — flagging every string literal a CLI script contains
  // (e.g. "--version"). It is restricted to the TS surfaces that actually render user-facing
  // text: source, component, package.
  it("does not apply the i18next pre-ruling on script; falls through to the ordinary ordering", () => {
    expect(PRE_RULINGS["i18next/no-literal-string"].surfaces).toEqual(["source", "component", "package"]);
    const r = stricter("i18next/no-literal-string", ["error", { mode: "jsx-text-only" }], ["error", { mode: "all" }], "script");
    expect(r.chosen).not.toEqual(PRE_RULINGS["i18next/no-literal-string"].chosen);
  });
  it("still applies the i18next pre-ruling on source, component and package", () => {
    for (const surface of ["source", "component", "package"]) {
      const r = stricter("i18next/no-literal-string", ["error", { mode: "jsx-text-only" }], ["error", { mode: "all" }], surface);
      expect(r.chosen).toEqual(PRE_RULINGS["i18next/no-literal-string"].chosen);
    }
  });
  it("every pre-ruling names its test", () => {
    for (const [rule, ruling] of Object.entries(PRE_RULINGS)) {
      expect(["strictest", "consistency", "benefit", "parameter"]).toContain(ruling.test);
      expect(ruling.note.length, rule).toBeGreaterThan(10);
    }
  });
});

// C3, the token test itself. It is deliberately crude and errs toward the body: the cost of
// calling something project-specific that was not is that the body restates it at cut-over; the
// cost of the other mistake is one project's opinion shipped to every repository as physics.
describe("namesProject", () => {
  it.each([
    [{ selector: "WithStatement" }, false],
    [{ group: ["../*"] }, false],
    [{ group: ["./sibling"] }, false],
    [{ object: "document", property: "querySelector" }, false],
    [{ group: ["@/features/*"] }, true],
    [{ selector: "X", message: "See: shared/application/utils/featureFlagChecks.ts" }, true],
    [{ selector: "X", message: "See: .claude/rules/tailwind.md" }, true],
    [{ group: ["**/local-supabase-env*"] }, true],
    [{ selector: "Literal[value=/globals.css/]" }, true],
  ])("%j -> %s", (entry, expected) => {
    expect(namesProject(entry)).toBe(expected);
  });
});

describe("splitRestrictions", () => {
  it("returns null for a rule that is not a restriction rule", () => {
    expect(splitRestrictions("no-var", "source", [])).toBeNull();
  });

  it("leaves an adopt row alone when nothing in it names a project", () => {
    expect(splitRestrictions("no-restricted-syntax", "source", [{ selector: "WithStatement" }])).toBeNull();
  });

  it("splits an adopt row that does, naming the surface's own parameter", () => {
    expect(splitRestrictions("no-restricted-syntax", "unit-test", [{ selector: "X", message: "see docs/a.md" }, { selector: "WithStatement" }])).toEqual([
      { selector: "WithStatement" },
      { $parameter: "restrictions.unit-test.syntax" },
    ]);
  });

  it("keeps no-restricted-imports's options-object shape", () => {
    expect(splitRestrictions("no-restricted-imports", "e2e", [{ patterns: [{ group: ["**/local-supabase-env*"] }] }])).toEqual([
      { patterns: [{ $parameter: "restrictions.e2e.imports" }] },
    ]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run packages/orrery/tests/reconcile-ordering.test.mjs`
Expected: FAIL — cannot resolve `../src/lib/reconcile/ordering.mjs`

- [ ] **Step 3: Write the implementation**

```javascript
// The ruling order for one eslint rule: stricter wins; if strictness is undefined, the
// pre-ruled consistency/benefit table; project data is a parameter; anything left is residue.

const SEVERITY = { 0: "off", 1: "warn", 2: "error", off: "off", warn: "warn", error: "error" };
const RANK = { off: 0, warn: 1, error: 2 };

export const severityOf = (value) => SEVERITY[Array.isArray(value) ? value[0] : value] ?? "off";

export const isEmptyObject = (v) => v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0;

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
export const PARAMETER_KEYS = ["entryPoint", "elements", "paths", "project", "tsconfigRootDir", "words", "packageDir"];

const PARAMETER_NAME = {
  entryPoint: "tailwind.entryPoint",
  elements: "boundaries.elements",
  rules: "boundaries.allow",
  words: "i18n.excludedWords",
};

// C3, the one rule: physics must be true for a repository that does not exist yet, and
// `no-restricted-syntax`/`-imports`/`-properties` are core rules — physics by plugin — whose whole
// content is whatever a project decided to ban. aeleos's and libra's entries name their own files
// (`shared/application/utils/featureFlagChecks.ts`), their own modules (`**/local-supabase-env*`)
// and their own conventions (`.claude/rules/tailwind.md`); shipping those to every body is one
// project's opinion wearing physics's clothes.
//
// The token test that decides: an option entry is project-specific when its JSON carries a path
// separator, a source-file extension, the `@/` alias prefix, or `.claude` — including inside a
// `message`, since a message that cites a path cites a project. Purely relative specifiers
// (`../*`, `./x`) are stripped before the test: banning a parent-relative import names a shape,
// not a project, and that ban is the one genuinely universal entry both donors carry.
const RELATIVE_PREFIX = /\.{1,2}\//g;
const PROJECT_TOKEN = /@\/|\.claude|\.(?:ts|tsx|js|jsx|mjs|cjs|json|md|css|ya?ml)\b|\//;
export const namesProject = (entry) => PROJECT_TOKEN.test(JSON.stringify(entry ?? null).replaceAll(RELATIVE_PREFIX, ""));

// Which body parameter each restriction rule's leftovers become. The parameter is per surface —
// what a body bans in a unit test is not what it bans in a script — so the full path is
// `restrictions.<surface>.<field>`.
export const RESTRICTION_FIELD = { "no-restricted-syntax": "syntax", "no-restricted-imports": "imports", "no-restricted-properties": "properties" };

const dedupe = (entries) => {
  const seen = new Set();
  return entries.filter((e) => { const k = JSON.stringify(e); if (seen.has(k)) return false; seen.add(k); return true; });
};

// Splits one restriction rule's options into the universal subset that stays in the shared tier and
// a `$parameter` marker that carries the rest back to the body that wanted it. `no-restricted-
// imports` takes one options OBJECT ({ paths, patterns }); the other two take a flat list of
// entries — both reduce to "a list of entries and where to put them back".
//
// `always` is the difference between the two call sites. From `parameterise` (a conflict: the two
// donors ban different things) the answer is always the union plus the parameter, because there is
// no stricter side to pick. From the adopt/agree pass the split only happens when something in the
// options really is project-specific: a restriction both donors agree on, naming nothing of their
// own, is physics and stays whole.
export function splitRestrictions(rule, surface, optionsA, optionsB = [], { always = false } = {}) {
  const field = RESTRICTION_FIELD[rule];
  if (!field) return null;
  const parameter = { $parameter: `restrictions.${surface}.${field}` };
  if (rule === "no-restricted-imports") {
    const objects = [optionsA[0], optionsB[0]].filter((o) => o && typeof o === "object" && !Array.isArray(o));
    const patterns = dedupe(objects.flatMap((o) => o.patterns ?? []));
    const paths = dedupe(objects.flatMap((o) => o.paths ?? []));
    if (!always && !patterns.some(namesProject) && !paths.some(namesProject)) return null;
    const keptPaths = paths.filter((p) => !namesProject(p));
    return [{ ...(keptPaths.length ? { paths: keptPaths } : {}), patterns: [...patterns.filter((p) => !namesProject(p)), parameter] }];
  }
  const entries = dedupe([...optionsA, ...optionsB]);
  if (!always && !entries.some(namesProject)) return null;
  return [...entries.filter((e) => !namesProject(e)), parameter];
}

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
    surfaces: ["source", "component", "package"],
    note: "mode all and the union of checked attributes are strictest; ignoreAttribute keeps libra's list because attribute names such as className are not user-facing text; excluded words are body data; restricted to the TS surfaces that render user-facing text — on script, mode all flagged every string literal a script contains (e.g. \"--version\")",
  },
  "sonarjs/no-duplicate-string": {
    chosen: ["error", { threshold: 2, ignoreStrings: { $union: "ignoreStrings", join: "|" } }],
    test: "benefit",
    note: "threshold 2 is strictest; ignoreStrings is the union because both sides exempt machine strings (MIME types, CSS variables, Tailwind classes), not code",
  },
  // C2: the base is RENDERED, not implied. The old shape said `{ $parameter: "boundaries.allow",
  // base: "a" }` — an attribute nothing implemented, silently dropped, so the class shipped a
  // `default: "disallow"` policy with no allowed edges at all and every check agreed with it.
  // `$fromSide: "a"` puts aeleos's layered policy into the row's own `chosen`, where rulings.json
  // records it and the honesty check compares it; `withoutElementType` lifts out aeleos's own
  // `identity` element, which is aeleos body data and comes back through its
  // `boundaries.elements`/`boundaries.allow` at cut-over; `boundaries.allow` appends whatever a
  // body adds on top.
  "boundaries/dependencies": {
    chosen: ["error", { default: "disallow", rules: [{ $fromSide: "a", withoutElementType: "identity" }, { $parameter: "boundaries.allow" }] }],
    test: "parameter",
    note: "aeleos's layered policy (domain/application/presentation) is the class base because it is stricter, with its own identity element lifted out as aeleos body data; each body's extra element types and their allowed edges are appended",
  },
  "boundaries/elements": {
    chosen: [{ $parameter: "boundaries.elements" }],
    test: "parameter",
    note: "element paths are body data on top of the class's standard app/features/shared/proxy layout",
  },
  "testing-library/no-dom-import": {
    chosen: ["error", "react"],
    test: "benefit",
    surfaces: ["unit-test"],
    note: "both sides error; the framework argument adds the autofix to @testing-library/react and names the right module in the report, and every body in the class renders React",
  },
  "no-restricted-syntax": {
    surfaces: ["e2e"],
    chosen: ["error",
      { selector: "CallExpression[callee.property.name=/^(getByRole|getAllByRole|queryByRole|queryAllByRole|findByRole|findAllByRole)$/]", message: "Use getByTestId in E2E tests. Role queries couple the test to the accessible name, which is translated." },
      { selector: "CallExpression[callee.name=/^(getByRole|getAllByRole|queryByRole|queryAllByRole|findByRole|findAllByRole)$/]", message: "Use getByTestId in E2E tests. Role queries couple the test to the accessible name, which is translated." },
      { selector: "CallExpression[callee.property.name=/^(getByText|getAllByText|queryByText|queryAllByText|findByText|findAllByText)$/]", message: "Use getByTestId in E2E tests. Text queries break the moment a string is translated." },
      { selector: "CallExpression[callee.name=/^(getByText|getAllByText|queryByText|queryAllByText|findByText|findAllByText)$/]", message: "Use getByTestId in E2E tests. Text queries break the moment a string is translated." },
      { selector: "CallExpression[callee.property.name=/^(getByLabel|getByLabelText|getAllByLabel|getAllByLabelText|queryByLabel|queryByLabelText|queryAllByLabel|queryAllByLabelText|findByLabel|findByLabelText|findAllByLabel|findAllByLabelText)$/]", message: "Use getByTestId in E2E tests. Labels are translated." },
      { selector: "CallExpression[callee.name=/^(getByLabel|getByLabelText|getAllByLabel|getAllByLabelText|queryByLabel|queryByLabelText|queryAllByLabel|queryAllByLabelText|findByLabel|findByLabelText|findAllByLabel|findAllByLabelText)$/]", message: "Use getByTestId in E2E tests. Labels are translated." },
      { selector: "CallExpression[callee.property.name=/^(getByPlaceholder|getByPlaceholderText|getAllByPlaceholder|getAllByPlaceholderText|queryByPlaceholder|queryByPlaceholderText|queryAllByPlaceholder|queryAllByPlaceholderText|findByPlaceholder|findByPlaceholderText|findAllByPlaceholder|findAllByPlaceholderText)$/]", message: "Use getByTestId in E2E tests. Placeholders are translated." },
      { selector: "CallExpression[callee.name=/^(getByPlaceholder|getByPlaceholderText|getAllByPlaceholder|getAllByPlaceholderText|queryByPlaceholder|queryByPlaceholderText|queryAllByPlaceholder|queryAllByPlaceholderText|findByPlaceholder|findByPlaceholderText|findAllByPlaceholder|findAllByPlaceholderText)$/]", message: "Use getByTestId in E2E tests. Placeholders are translated." },
      { selector: "CallExpression[callee.property.name='toContainText']", message: "Do not assert translated text in E2E tests. Use toBeVisible()." },
      { selector: "CallExpression[callee.property.name='toHaveText']", message: "Do not assert translated text in E2E tests. Use toBeVisible()." },
      { selector: "CallExpression[callee.property.name='toHaveClass']", message: "Do not assert CSS classes in E2E tests; they are styling details that rename freely. Expose the state as an ARIA or data attribute and assert that." },
      { selector: "CallExpression[callee.property.name='toHaveCSS']", message: "Do not assert computed styles in E2E tests. Expose the state as an ARIA or data attribute and assert that." },
      { selector: "CallExpression[callee.property.name='locator'][arguments.0.value=/^[.][a-zA-Z]/]", message: "Do not select by CSS class in E2E tests. Use getByTestId, or an attribute selector." },
      { selector: "CallExpression[callee.property.name='locator'][arguments.0.value=/class/]", message: "Do not select by class attribute in E2E tests. Use getByTestId, or an attribute selector." },
      { selector: "CallExpression[callee.property.name='locator'] Literal[value=/data-testid/]", message: "Use page.getByTestId('id') rather than a raw attribute selector." },
      { selector: "NewExpression[callee.name='Promise'] CallExpression[callee.name='setTimeout']", message: "No unconditional setTimeout-based waits. Wait for a condition, or justify this exact line with eslint-disable-next-line and a comment." },
      { $parameter: "restrictions.e2e.syntax" },
    ],
    test: "benefit",
    note: "the union of both sides' bans is stricter than either; messages are aeleos's where both ban a selector and are rewritten to name no body file or helper elsewhere; aeleos's combined label/placeholder selector is subsumed by libra's two; libra's Supabase port and helper bans are body data and become the restrictions.e2e.syntax parameter",
  },
  "playwright/expect-expect": {
    chosen: ["error", { assertFunctionNames: { $parameter: "e2e.assertFunctionNames" } }],
    test: "parameter",
    surfaces: ["e2e"],
    note: "the rule stays error; the names of a body's own assertion helpers are body data, default empty as the rule's own default",
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

// `rawA`/`rawB` are the two sides' options WITH their messages: `optionsOf` strips every `message`,
// and a message that cites a project file is exactly the evidence the restriction token test reads.
function parameterise(rule, optionsA, optionsB, surface, rawA = optionsA, rawB = optionsB) {
  // C3: a restriction rule's conflict is never "one side is stricter" — the two donors simply ban
  // different things. The union of what names no project stays shared; the rest goes back to the
  // body it belongs to, per surface.
  const restrictions = splitRestrictions(rule, surface, rawA, rawB, { always: true });
  if (restrictions) return restrictions;
  const [oa = {}, ob = {}] = [optionsA[0], optionsB[0]];
  if (typeof oa !== "object" || typeof ob !== "object") return null;
  const keys = new Set([...Object.keys(oa), ...Object.keys(ob)]);
  const param = [...keys].find((k) => PARAMETER_KEYS.includes(k));
  if (!param) return null;
  const merged = { ...oa, ...ob };
  merged[param] = { $parameter: PARAMETER_NAME[param] ?? param };
  for (const k of Object.keys(merged)) if (k !== param && EXEMPTION_KEY.test(k)) delete merged[k];
  return [merged];
}

// `surface` is optional: a pre-ruling with no `surfaces` list applies regardless of it; one
// that names surfaces applies only when `surface` is among them, and otherwise falls through
// to the ordinary ordering below exactly as if the rule had no pre-ruling at all.
export function stricter(rule, a, b, surface) {
  const sevA = severityOf(a);
  const sevB = severityOf(b);
  const severity = RANK[sevA] >= RANK[sevB] ? sevA : sevB;
  const optionsA = optionsOf(a);
  const optionsB = optionsOf(b);
  const sameOptions = JSON.stringify(optionsA) === JSON.stringify(optionsB);

  const preRuling = PRE_RULINGS[rule];
  if (preRuling && (!preRuling.surfaces || preRuling.surfaces.includes(surface))) return { ...preRuling };

  if (sameOptions) {
    return { chosen: [severity, ...optionsA], test: "strictest", note: `severity ${severity} over ${sevA === severity ? sevB : sevA}` };
  }
  if (sevA === "off" && optionsA.length === 0) return { chosen: [severity, ...optionsB], test: "strictest", note: "switched on" };
  if (sevB === "off" && optionsB.length === 0) return { chosen: [severity, ...optionsA], test: "strictest", note: "switched on" };

  const rawOptions = (value) => (Array.isArray(value) ? value.slice(1) : []);
  const parameterised = parameterise(rule, optionsA, optionsB, surface, rawOptions(a), rawOptions(b));
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
import { reconcileEslint, resolveMarkers, withoutElementType } from "../src/lib/reconcile/eslint.mjs";
import { literal } from "../src/lib/bundle/eslint.mjs";
import { assertMarker } from "../src/lib/markers.mjs";

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

  it("resolves union and fromSide markers from the pre-rulings against both sides' options", () => {
    const a = { source: cfg({ "sonarjs/no-duplicate-string": [0, { threshold: 3, ignoreStrings: "application/json" }] }) };
    const b = { source: cfg({ "sonarjs/no-duplicate-string": [2, { threshold: 2, ignoreStrings: "var\\(--x\\)|text-[a-z-]+" }] }) };
    const [r] = reconcileEslint(a, b);
    expect(r.chosen).toEqual(["error", { threshold: 2, ignoreStrings: "application/json|text-[a-z-]+|var\\(--x\\)" }]);
    expect(r.test).toBe("benefit");
  });

  it("leaves ordinary option keys named union, fromSide or parameter untouched", () => {
    const a = { source: cfg({ "unicorn/x": ["error", { union: ["a", "b"], fromSide: "left", parameter: 1, other: 2 }] }) };
    const b = { source: cfg({ "unicorn/x": ["warn", { union: ["a", "b"], fromSide: "left", parameter: 1, other: 2 }] }) };
    expect(() => reconcileEslint(a, b)).not.toThrow();
    const [r] = reconcileEslint(a, b);
    expect(r.chosen).toEqual(["error", { union: ["a", "b"], fromSide: "left", parameter: 1, other: 2 }]);
    expect(r.test).toBe("strictest");
  });

  describe("a pre-ruled key's adopt rows", () => {
    it("takes the pre-ruling's resolved options from the first conflict surface, keeping its own severity and test", () => {
      const a = { component: cfg({ "i18next/no-literal-string": [2, { mode: "jsx-text-only", "jsx-attributes": { include: ["alt", "title"] } }] }) };
      const b = {
        component: cfg({ "i18next/no-literal-string": [2, { mode: "all", "jsx-attributes": { include: ["alt", "label"] }, ignoreAttribute: ["className"], words: { exclude: ["y"] } }] }),
        source: cfg({ "i18next/no-literal-string": [2, { mode: "all", ignoreAttribute: ["className"], words: { exclude: ["y"] }, callees: { exclude: ["z"] } }] }),
      };
      const rows = reconcileEslint(a, b);
      const component = rows.find((r) => r.surface === "component" && r.key === "i18next/no-literal-string");
      const source = rows.find((r) => r.surface === "source" && r.key === "i18next/no-literal-string");
      expect(component.test).toBe("benefit");
      expect(source.test).toBe("benefit");
      expect(source.chosen[0]).toBe("error");
      expect(source.chosen.slice(1)).toEqual(component.chosen.slice(1));
      expect(source.chosen[1]).not.toHaveProperty("callees");
      expect(source.note).toMatch(/one-sided on this surface, options from the class ruling$/);
    });

    it("stays a plain adopt row outside a surface-restricted pre-ruling's declared surfaces", () => {
      const a = { source: cfg({ "no-restricted-syntax": [2, { selector: "Foo", message: "bar" }] }) };
      const b = { source: cfg({}) };
      const [r] = reconcileEslint(a, b);
      expect(r.test).toBe("adopt");
      expect(r.chosen).toEqual([2, { selector: "Foo", message: "bar" }]);
    });

    it("resolves markers against its own two sides when the rule never conflicts anywhere, unioning against the absent side's empty list", () => {
      const a = { package: cfg({ "sonarjs/no-duplicate-string": [2, { threshold: 3, ignoreStrings: "abc" }] }) };
      const b = {};
      const [r] = reconcileEslint(a, b);
      expect(r.test).toBe("benefit");
      expect(r.chosen).toEqual(["error", { threshold: 2, ignoreStrings: "abc" }]);
    });

    it("falls back to the present side's own value when a fromSide marker points at the absent side", () => {
      const a = { source: cfg({ "i18next/no-literal-string": [2, { mode: "all", ignoreAttribute: ["className"] }] }) };
      const b = {};
      const [r] = reconcileEslint(a, b);
      expect(r.chosen[1].ignoreAttribute).toEqual(["className"]);
    });

    // S6: the pre-ruling is restricted to source/component/package; on script it never applies,
    // so a one-sided rule is adopted verbatim, the same as any other rule with no pre-ruling.
    it("does not apply the i18next pre-ruling on script; the present side's bare value is adopted verbatim", () => {
      const a = {};
      const b = { script: cfg({ "i18next/no-literal-string": [2] }) };
      const [r] = reconcileEslint(a, b);
      expect(r.test).toBe("adopt");
      expect(r.chosen).toEqual([2]);
    });

    it("omits a fromSide key neither side has, rather than emitting null", () => {
      const a = { package: cfg({ "i18next/no-literal-string": [2, { mode: "all" }] }) };
      const b = {};
      const [r] = reconcileEslint(a, b);
      expect(r.chosen[1]).not.toHaveProperty("ignoreAttribute");
      expect(r.chosen[1]["jsx-attributes"]).toEqual({ include: [] });
      expect(r.chosen[1]).not.toHaveProperty("callees");
    });
  });

  describe("lost RegExp detection", () => {
    it("turns a row whose options still hold a RegExp lost by --print-config into residue", () => {
      const a = { source: cfg({ "unicorn/fake-rule": [2, { exclude: [{}, "x"] }] }) };
      const b = {};
      const [r] = reconcileEslint(a, b);
      expect(r.test).toBe("residue");
      expect(r.chosen).toBeNull();
      expect(r.note).toBe("an option holds a RegExp that --print-config serialises as {}; needs a pre-ruling");
    });

    it("does not flag a bare empty options object", () => {
      const a = { source: cfg({ "unicorn/fake-rule": [2, {}] }) };
      const b = {};
      const [r] = reconcileEslint(a, b);
      expect(r.test).toBe("adopt");
      expect(r.chosen).toEqual([2, {}]);
    });
  });

  // C4 — the spec's CI section: "No rule ever ships at warn." Whichever test decided the row, a
  // decided severity of warn becomes error. An inert row has no severity to lift.
  describe("no rule ships at warn", () => {
    it("lifts a rule both donors agree to run at warn", () => {
      const a = { source: cfg({ "no-console": ["warn"] }) };
      const b = { source: cfg({ "no-console": [1] }) };
      const [r] = reconcileEslint(a, b);
      expect(r.chosen).toEqual(["error"]);
      expect(r.test).toBe("strictest");
      expect(r.note).toContain("no rule ships at warn (spec)");
    });

    it("lifts a rule adopted at warn from one donor, options and all", () => {
      const a = { source: cfg({ "sonarjs/max-lines": [1, { maximum: 400 }] }) };
      const b = {};
      const [r] = reconcileEslint(a, b);
      expect(r.chosen).toEqual(["error", { maximum: 400 }]);
      expect(r.test).toBe("strictest");
      expect(r.note).toContain("no rule ships at warn (spec)");
    });

    it("leaves an off rule and an inert row alone", () => {
      const a = { source: cfg({ "no-console": ["off"], "unicorn/x": ["off"] }) };
      const b = { source: cfg({ "no-console": ["off"] }) };
      const rows = reconcileEslint(a, b);
      const by = Object.fromEntries(rows.map((r) => [r.key, r]));
      expect(by["no-console"].chosen).toEqual(["off"]);
      expect(by["unicorn/x"]).toMatchObject({ test: "inert", chosen: null });
    });
  });

  // C2: the boundaries base is a value in the row, not an attribute nobody reads.
  describe("boundaries/dependencies renders aeleos's policy as the base", () => {
    const aeleosRules = [
      { from: { type: "app" }, allow: { to: { type: ["app", "shared", "identity"] } } },
      { from: { type: "shared" }, allow: { to: [{ type: "shared" }, { type: "identity" }] } },
      { from: { type: "identity" }, allow: { to: { type: "identity" } } },
    ];
    const a = { source: cfg({ "boundaries/dependencies": [2, { default: "disallow", rules: aeleosRules }] }) };
    const b = { source: cfg({ "boundaries/dependencies": [2, { default: "disallow", rules: [{ from: { type: "feature" }, allow: { to: { type: ["shared"] } } }] }] }) };

    it("puts the base rules in the row's own chosen, identity lifted out, body edges last", () => {
      const [r] = reconcileEslint(a, b);
      expect(r.test).toBe("parameter");
      expect(r.chosen[1].rules).toEqual([
        { from: { type: "app" }, allow: { to: { type: ["app", "shared"] } } },
        { from: { type: "shared" }, allow: { to: [{ type: "shared" }] } },
        { $parameter: "boundaries.allow" },
      ]);
    });

    it("renders as a spread of the base followed by the body's own edges", () => {
      const [r] = reconcileEslint(a, b);
      expect(literal(r.chosen)).toContain("...body.boundaries.allow");
      expect(literal(r.chosen)).toContain('"from": { "type": "app" }');
    });
  });

  describe("withoutElementType", () => {
    it("drops a rule whose from names only that type and narrows every to that mentions it", () => {
      expect(withoutElementType([
        { from: { type: "identity" }, allow: { to: { type: "identity" } } },
        { from: { type: "app" }, allow: { to: { type: ["app", "identity"] } } },
        { from: { type: "app" }, allow: { to: { type: "identity" } } },
        { from: { type: ["app", "identity"] }, allow: { to: { type: ["shared"] } } },
      ], "identity")).toEqual([
        { from: { type: "app" }, allow: { to: { type: ["app"] } } },
        { from: { type: ["app"] }, allow: { to: { type: ["shared"] } } },
      ]);
    });

    it("returns a non-array unchanged", () => {
      expect(withoutElementType(undefined, "identity")).toBeUndefined();
    });
  });

  // C2/I5: a marker attribute nobody implements used to be dropped in silence — which is exactly
  // how `{ $parameter: "boundaries.allow", base: "a" }` shipped a policy with no base at all.
  describe("unknown marker attributes throw", () => {
    it("assertMarker names the attribute", () => {
      expect(() => assertMarker({ $parameter: "x", base: "a" })).toThrow(/base/);
      expect(() => assertMarker({ $parameter: "x", base: "a" })).toThrow(/\$parameter/);
    });

    it("throws on an unknown marker key", () => {
      expect(() => assertMarker({ $whatever: "x" })).toThrow(/unknown marker/);
    });

    it("accepts the markers and attributes that are implemented", () => {
      expect(assertMarker({ $parameter: "a.b" })).toBe("$parameter");
      expect(assertMarker({ $union: "k", join: "|" })).toBe("$union");
      expect(assertMarker({ $fromSide: "a", withoutElementType: "identity" })).toBe("$fromSide");
      expect(assertMarker({ selector: "X" })).toBeNull();
    });

    it("resolveMarkers throws", () => {
      expect(() => resolveMarkers(["error", { x: { $parameter: "x", base: "a" } }], [], [])).toThrow(/base/);
    });

    it("literal throws", () => {
      expect(() => literal(["error", { $parameter: "x", base: "a" }])).toThrow(/base/);
    });
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
// class's layout. `@stylistic`, `babel`, `standard` appear only as `off` from
// eslint-config-prettier and are physics: a formatting rule turned off is true of any repository.
// `vue` and `flowtype` reach the donors the same way, but they are class — a Vue or Flow codebase
// is an archetype, and physics may not assume one exists.
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

// A rule the plugin alone cannot place. `no-restricted-syntax` is a core rule, so physics by
// plugin -- but the e2e pre-ruling's chosen is the union of both donors' Playwright and
// testing-library selector bans, which mean nothing where no browser test runs. Keyed by surface
// first, because the same rule is physics on one surface and class on another.
export const TIER_OVERRIDES = { e2e: { "no-restricted-syntax": "class" } };

export function pluginOf(rule) {
  if (!rule.includes("/")) return "core";
  return rule.slice(0, rule.lastIndexOf("/"));
}

export function tierOf(rule, surface) {
  const override = TIER_OVERRIDES[surface]?.[rule];
  if (override) return override;
  const plugin = pluginOf(rule);
  const tier = TIER_BY_PLUGIN[plugin];
  if (!tier) throw new Error(`unknown plugin "${plugin}" for rule ${rule}; add it to TIER_BY_PLUGIN with a boundary-rule justification`);
  return tier;
}
```

```javascript
import { diffRules } from "../rule-diff.mjs";
import { SURFACES } from "../surfaces.mjs";
import { stricter, optionsOf, severityOf, PRE_RULINGS, isEmptyObject, splitRestrictions, RESTRICTION_FIELD } from "./ordering.mjs";
import { tierOf } from "./tiers.mjs";
import { assertMarker } from "../markers.mjs";

const SURFACE_ORDER = SURFACES.map((s) => s.name);
const compare = (x, y) => (x < y ? -1 : x > y ? 1 : 0);

// True when a rule's PRE_RULINGS entry governs the given surface: an entry with no `surfaces`
// list applies everywhere; one that names surfaces applies only on those.
function preRulingApplies(rule, surface) {
  const preRuling = PRE_RULINGS[rule];
  return !!preRuling && (!preRuling.surfaces || preRuling.surfaces.includes(surface));
}

// A pre-ruled rule's options are defined once. Find, for each pre-ruled rule, the resolved
// options (severity stripped) of the first surface in SURFACE_ORDER where the two donors
// actually conflict on it and the pre-ruling applies there. A rule with no such surface is
// absent from the map; its adopt rows resolve the markers against their own two sides instead
// (see reconcileEslint's `adopt`).
function firstConflictOptions(eslintA, eslintB, surfaces) {
  const found = {};
  for (const surface of surfaces) {
    const a = eslintA[surface] ?? { rules: {} };
    const b = eslintB[surface] ?? { rules: {} };
    const { conflict } = diffRules(a, b);
    for (const { rule } of conflict) {
      if (found[rule] || !preRulingApplies(rule, surface)) continue;
      const ruling = stricter(rule, a.rules[rule], b.rules[rule], surface);
      const resolved = resolveMarkers(ruling.chosen, optionsOf(a.rules[rule]), optionsOf(b.rules[rule]));
      found[rule] = { options: resolved.slice(1), test: ruling.test, note: ruling.note };
    }
  }
  return found;
}

// An empty object that is an element of an array nested inside an option object is a RegExp
// that `eslint --print-config` serialised away (see effective-config.mjs); a bare `{}` sitting
// at an options position itself just means "no options" and is not a loss.
export function hasLostRegExp(chosen) {
  if (!Array.isArray(chosen)) return false;
  const scan = (v) => {
    if (Array.isArray(v)) return v.some(isEmptyObject) || v.some(scan);
    if (v && typeof v === "object") return Object.values(v).some(scan);
    return false;
  };
  return chosen.slice(1).some(scan);
}

// C3, the agree/adopt half (the conflict half is `parameterise` in ordering.mjs): a row that copies
// one donor's restriction rule verbatim -- or that copies a value both donors happen to share --
// carries whatever that donor decided to ban, paths, messages and all. Split it the same way, so
// there is one answer to "what may a restricted-* rule say in a shared tier" rather than two.
// Rows a pre-ruling governs are left alone: their options are hand-written here, not donor data,
// and the e2e union's own selectors legitimately contain regular expressions full of slashes.
function parameteriseRestrictions(r) {
  if (r.tool !== "eslint" || r.chosen === null || !RESTRICTION_FIELD[r.key]) return;
  if (preRulingApplies(r.key, r.surface)) return;
  // The row's OWN entries, not `optionsOf`'s: `optionsOf` strips every `message`, and a message
  // that cites a project file ("See: shared/application/utils/featureFlagChecks.ts") is exactly
  // the evidence the token test is looking for.
  const split = splitRestrictions(r.key, r.surface, Array.isArray(r.chosen) ? r.chosen.slice(1) : []);
  if (!split) return;
  r.chosen = [severityOf(r.chosen), ...split];
  r.test = "parameter";
  r.note = `${r.note ? `${r.note}; ` : ""}the entries naming a project path, file or helper are that body's own and become the restrictions.${r.surface}.${RESTRICTION_FIELD[r.key]} parameter`;
}

// C4 -- the spec's CI section: "No rule ever ships at warn." A warning is a rule nobody has to
// obey, and a shared tier full of them is a shared tier that does not bind. Every decided severity
// of warn becomes error, whichever test decided it; an inert row (a rule one side turns off and the
// other never names) has no severity to lift.
function liftWarn(r) {
  if (r.chosen === null || r.test === "inert" || severityOf(r.chosen) !== "warn") return;
  r.chosen = Array.isArray(r.chosen) ? ["error", ...r.chosen.slice(1)] : "error";
  r.test = "strictest";
  r.note = r.note ? `${r.note}; no rule ships at warn (spec)` : "no rule ships at warn (spec)";
}

// C2: lift one eslint-plugin-boundaries element type out of a policy borrowed from a donor. An
// element matcher is either a `{ type }` object (the type itself a string or a list), a bare
// string, or an array of either, and it appears under `from`, `allow.to` and `disallow.to`.
// Lifting a type means: drop any rule whose `from` named only that type, drop the type from every
// `to` it appears in, and drop a rule whose `to` named nothing else.
function narrowMatcher(matcher, type) {
  if (Array.isArray(matcher)) {
    const kept = matcher.map((m) => narrowMatcher(m, type)).filter((m) => m !== undefined);
    return kept.length ? kept : undefined;
  }
  if (typeof matcher === "string") return matcher === type ? undefined : matcher;
  if (!matcher || typeof matcher !== "object" || !("type" in matcher)) return matcher;
  const narrowed = Array.isArray(matcher.type) ? matcher.type.filter((t) => t !== type) : matcher.type === type ? [] : matcher.type;
  if (Array.isArray(narrowed) && narrowed.length === 0) return undefined;
  return { ...matcher, type: narrowed };
}

export function withoutElementType(rules, type) {
  if (!Array.isArray(rules)) return rules;
  const out = [];
  for (const rule of rules) {
    const from = rule?.from === undefined ? undefined : narrowMatcher(rule.from, type);
    if (rule?.from !== undefined && from === undefined) continue;
    const next = { ...rule, ...(from === undefined ? {} : { from }) };
    for (const side of ["allow", "disallow"]) {
      if (next[side] === undefined) continue;
      const hasTo = next[side] !== null && typeof next[side] === "object" && !Array.isArray(next[side]) && next[side].to !== undefined;
      const to = narrowMatcher(hasTo ? next[side].to : next[side], type);
      if (to === undefined) delete next[side];
      else next[side] = hasTo ? { ...next[side], to } : to;
    }
    if (next.allow === undefined && next.disallow === undefined) continue;
    out.push(next);
  }
  return out;
}

export function reconcileEslint(eslintA, eslintB) {
  const surfaces = [...new Set([...Object.keys(eslintA), ...Object.keys(eslintB)])].sort(
    (x, y) => SURFACE_ORDER.indexOf(x) - SURFACE_ORDER.indexOf(y)
  );
  const preResolved = firstConflictOptions(eslintA, eslintB, surfaces);
  const rows = [];

  for (const surface of surfaces) {
    const a = eslintA[surface] ?? { rules: {} };
    const b = eslintB[surface] ?? { rules: {} };
    const d = diffRules(a, b);
    const row = (key, extra) => ({ tool: "eslint", surface, key, a: a.rules[key] ?? null, b: b.rules[key] ?? null, note: "", ...extra });

    // A one-sided (adopt) row for a rule the pre-rulings govern takes the pre-ruling's chosen
    // options rather than the raw value it would otherwise copy verbatim, keeping its own
    // severity. Options come from the first conflict surface if one exists anywhere for this
    // rule; otherwise the markers resolve against this row's own two sides (the absent side
    // reading as empty).
    const adopt = (rule, value, side) => {
      if (!preRulingApplies(rule, surface)) return row(rule, { chosen: value, test: "adopt", tier: tierOf(rule, surface) });
      const preRuling = PRE_RULINGS[rule];
      const cached = preResolved[rule];
      const options = cached
        ? cached.options
        : resolveMarkers(preRuling.chosen, optionsOf(side === "a" ? value : undefined), optionsOf(side === "b" ? value : undefined)).slice(1);
      const test = cached ? cached.test : preRuling.test;
      const note = `${cached ? cached.note : preRuling.note}; one-sided on this surface, options from the class ruling`;
      return row(rule, { chosen: [severityOf(value), ...options], test, tier: tierOf(rule, surface), note });
    };

    for (const key of d.agree) rows.push(row(key, { chosen: a.rules[key], test: "agree", tier: tierOf(key, surface) }));
    for (const { rule, value } of d.onlyA) rows.push(adopt(rule, value, "a"));
    for (const { rule, value } of d.onlyB) rows.push(adopt(rule, value, "b"));
    for (const rule of [...d.offOnlyA, ...d.offOnlyB]) rows.push(row(rule, { chosen: null, test: "inert", tier: null }));
    for (const { rule } of d.conflict) {
      const { chosen, test, note } = stricter(rule, a.rules[rule], b.rules[rule], surface);
      rows.push(row(rule, { chosen: resolveMarkers(chosen, optionsOf(a.rules[rule]), optionsOf(b.rules[rule])), test, tier: tierOf(rule, surface), note }));
    }
  }

  // A RegExp lost by --print-config is residue unless the row's options came from a pre-ruling
  // (whose options are hand-written, never donor data, and so cannot carry a lost RegExp).
  for (const r of rows) {
    if (!preRulingApplies(r.key, r.surface) && hasLostRegExp(r.chosen)) {
      r.test = "residue";
      r.chosen = null;
      r.note = "an option holds a RegExp that --print-config serialises as {}; needs a pre-ruling";
    }
  }

  for (const r of rows) {
    liftWarn(r);
    parameteriseRestrictions(r);
  }

  return rows.sort((x, y) => SURFACE_ORDER.indexOf(x.surface) - SURFACE_ORDER.indexOf(y.surface) || compare(x.key, y.key));
}

// Pre-rulings carry markers that need both sides' real values: { $union: "key" } (the union of
// that key's arrays from both sides; `join` turns it into one string), { $fromSide: "a"|"b" }
// (that side's value, falling back to the other side's when the named side lacks the key, and
// omitting the key entirely when neither side has it). { $parameter } markers survive: the
// bundle writer turns them into body config reads. Markers are namespaced with a `$` prefix so a
// plugin's own option object can never be mistaken for one — `union`, `fromSide` and `parameter`
// are all names real ESLint rule options use. `assertMarker` (src/lib/markers.mjs) rejects a marker
// attribute nobody implements, so a pre-ruling can never quietly mean less than it says.
const OMIT = Symbol("omit");

export function resolveMarkers(value, optionsA, optionsB) {
  const at = (options, key) => key.split(".").reduce((o, k) => o?.[k], options[0] ?? {});
  const walk = (v, keyPath) => {
    if (Array.isArray(v)) {
      // A marker that resolves to a list SPLICES into the array it sits in, the same way `literal`
      // spreads a `$parameter` marker in an array position: the boundaries base is one marker
      // standing for nine rule entries, followed by whatever the body adds.
      return v.flatMap((x) => {
        const resolved = walk(x, keyPath);
        return assertMarker(x) && Array.isArray(resolved) ? resolved : [resolved];
      });
    }
    if (v && typeof v === "object") {
      assertMarker(v);
      if ("$union" in v) {
        const both = [].concat(at(optionsA, v.$union) ?? [], at(optionsB, v.$union) ?? []);
        const items = v.join ? both.flatMap((s) => String(s).split(v.join)) : both;
        const unique = [...new Set(items)].sort();
        return v.join ? unique.join(v.join) : unique;
      }
      if ("$fromSide" in v) {
        const [primarySide, fallbackSide] = v.$fromSide === "a" ? [optionsA, optionsB] : [optionsB, optionsA];
        const primary = at(primarySide, keyPath);
        const taken = primary !== undefined ? primary : at(fallbackSide, keyPath);
        if (taken === undefined) return OMIT;
        return v.withoutElementType ? withoutElementType(taken, v.withoutElementType) : taken;
      }
      const entries = Object.entries(v)
        .map(([k, x]) => [k, walk(x, keyPath ? `${keyPath}.${k}` : k)])
        .filter(([, x]) => x !== OMIT);
      return Object.fromEntries(entries);
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
import { reconcileKnip, normaliseEntry } from "../src/lib/reconcile/knip.mjs";
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
  it("settles both sides disabling a rule, however they spelled it, as agreement", () => {
    const r = by(reconcileStylelint({ rules: { x: null } }, { rules: { x: false } }));
    expect(r["rules.x"]).toMatchObject({ test: "agree", chosen: null });
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
  it("folds every test-file glob form to the shared pattern without corrupting .tsx", () => {
    expect(normaliseEntry("tests/**/*.test.tsx")).toBe("tests/**/*.{ts,tsx}");
    expect(normaliseEntry("tests/**/*.test.ts")).toBe("tests/**/*.{ts,tsx}");
    expect(normaliseEntry("tests/**/*.test.{ts,tsx}")).toBe("tests/**/*.{ts,tsx}");
    expect(normaliseEntry("tests/**/*.{test,spec}.{ts,tsx}")).toBe("tests/**/*.{ts,tsx}");
    expect(normaliseEntry("src/**/*.tsx")).toBe("src/**/*.tsx");
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
    // Both off, just spelled differently (null versus false): they agree on the outcome.
    if (sa === "off" && sb === "off") { rows.push(row("stylelint", k, { ...base, chosen: null, test: "agree", note: "both sides disable the rule" })); continue; }
    if (key === "at-rule-no-unknown" && Array.isArray(va) && Array.isArray(vb)) {
      const merged = [true, { ...(va[1] ?? {}), ...(vb[1] ?? {}), ignoreAtRules: union(va[1]?.ignoreAtRules ?? [], vb[1]?.ignoreAtRules ?? []) }];
      rows.push(row("stylelint", k, { ...base, chosen: merged, test: "benefit", note: "union of Tailwind at-rules: every one listed exists in the framework and must parse" }));
      continue;
    }
    rows.push(row("stylelint", k, { ...base, chosen: null, test: "residue", note: "two different non-null values" }));
  }
  return rows;
}
```

```javascript
// packages/orrery/src/lib/reconcile/knip.mjs
import { row, union } from "./simple.mjs";

// Every test-file glob form, whichever extension spelling a donor wrote, folds to the one
// shared pattern. Each match is end-anchored ($) so it only fires on the glob's actual
// suffix — a plain string search would treat "**/*.test.ts" as a substring of
// "**/*.test.tsx" and truncate it into a corrupted glob ("**/*.{ts,tsx}x").
// The App Router entry convention ("…/app/**/*.tsx") is the one non-test form real donors
// disagree on spelling (one writes it without .ts); it folds too, anchored the same way so
// an unrelated "**/*.tsx" glob elsewhere in a body's own entries is left alone.
export const normaliseEntry = (e) =>
  e
    .replace(/\*\*\/\*\.test\.ts$/, "**/*.{ts,tsx}")
    .replace(/\*\*\/\*\.test\.tsx$/, "**/*.{ts,tsx}")
    .replace(/\*\*\/\*\.test\.\{ts,tsx\}$/, "**/*.{ts,tsx}")
    .replace(/\*\*\/\*\.\{test,spec\}\.\{ts,tsx\}$/, "**/*.{ts,tsx}")
    .replace(/app\/\*\*\/\*\.tsx$/, "app/**/*.{ts,tsx}");
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
import { fileURLToPath } from "node:url";
import reconcile from "../src/commands/reconcile.mjs";
import { hasLostRegExp } from "../src/lib/reconcile/eslint.mjs";
import { isEmptyObject, namesProject } from "../src/lib/reconcile/ordering.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

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

  it("guards the committed rulings.json: no eslint row's chosen options hold a RegExp lost by --print-config", () => {
    const rulings = JSON.parse(fs.readFileSync(path.join(root, "docs/decisions/rulings.json"), "utf8"));
    // The detector itself is the one reconcileEslint uses, imported rather than restated: a guard
    // that re-implements what it guards can only ever prove its own copy right.
    expect(isEmptyObject({})).toBe(true);
    const offenders = rulings.rows.filter((r) => r.tool === "eslint" && hasLostRegExp(r.chosen)).map((r) => `${r.surface} ${r.key}`);
    expect(offenders).toEqual([]);
  });

  // C3, the permanent guard for the one rule: nothing in `physics/` may name a path, a file, an
  // alias or a project convention, because physics must be true for a repository that does not
  // exist yet. The token list is `namesProject`'s (src/lib/reconcile/ordering.mjs): a path
  // separator, a source-file extension, `@/`, or `.claude`, with purely relative specifiers
  // (`../*`) stripped first because a parent-relative ban names a shape and not a project.
  //
  // Three rows carry a token and are not a project reference. Each is named here with why, so the
  // exemption is a decision and not a hole, and an exemption that stops being needed shows up as a
  // failure of its own:
  const EXEMPT = new Map([
    ["eslint sonarjs/no-duplicate-string", "the MIME type application/json and the CSS/Tailwind class patterns in ignoreStrings are machine strings, not paths"],
    ["secretlint rules", "an npm package id (@secretlint/secretlint-rule-preset-recommend), not a path in a repository"],
    ["ls-lint ls", "a workspace directory layout of globs (apps/*/src, packages/*/tests) that names no project's files"],
  ]);

  it("guards the committed rulings.json: no physics row names a path, a file, an alias or a project convention", () => {
    const rulings = JSON.parse(fs.readFileSync(path.join(root, "docs/decisions/rulings.json"), "utf8"));
    const flagged = rulings.rows.filter((r) => r.tier === "physics" && r.chosen !== null && namesProject(r.chosen));
    const offenders = [...new Set(flagged.map((r) => `${r.tool} ${r.key}`))].filter((k) => !EXEMPT.has(k));
    expect(offenders, "a physics row carrying a project token; parameterise it or record an exemption with its reason").toEqual([]);
  });

  it("keeps every physics-token exemption earning its place", () => {
    const rulings = JSON.parse(fs.readFileSync(path.join(root, "docs/decisions/rulings.json"), "utf8"));
    const flagged = new Set(rulings.rows.filter((r) => r.tier === "physics" && r.chosen !== null && namesProject(r.chosen)).map((r) => `${r.tool} ${r.key}`));
    const stale = [...EXEMPT.keys()].filter((k) => !flagged.has(k));
    expect(stale, "an exemption no row needs any more; delete it").toEqual([]);
  });

  // C4, the spec's CI section: "No rule ever ships at warn."
  it("guards the committed rulings.json: no eslint row ships at warn", () => {
    const rulings = JSON.parse(fs.readFileSync(path.join(root, "docs/decisions/rulings.json"), "utf8"));
    const warned = rulings.rows
      .filter((r) => r.tool === "eslint" && Array.isArray(r.chosen) && (r.chosen[0] === "warn" || r.chosen[0] === 1))
      .map((r) => `${r.surface} ${r.key}`);
    expect(warned).toEqual([]);
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
  - `@vaoan/orrery/stylelint`, `/jscpd`, `/cspell`, `/knip`, `/syncpack`, `/lint-staged`, `/prettier`, `/secretlint`, `/ls-lint` → functions `(body?) => object`.
    Decision: EVERY one of them returns an OBJECT, ls-lint included — the generator has one rendering
    path (`literal`) and one contract, and a tool whose own file format is not JSON is serialised at
    the point of use: `materialise` (src/lib/observe/scratch.mjs) turns ls-lint's `{ ls: { <dir>: {
    <ext>: <rule> } } }` into the YAML the binary reads. Returning a pre-formatted string here would
    put a second, hand-written renderer inside the generated bundle, where nothing could diff it
    against the rulings.
  - `@vaoan/orrery/prettier` is consumed through a `prettier.config.mjs` POINTER, not through
    package.json's `"prettier"` key (C1): the export is a function, as the spec requires of every
    export, and a package.json pointer hands prettier the module itself — an options object that is a
    function, which prettier rejects. The pointer calls it.
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
  i18n: { type: "object", fields: { excludedWords: { type: "string[]", default: [] } } },
  e2e: { type: "object", fields: { assertFunctionNames: { type: "string[]", default: [] } } },
  // C3: what a body bans with no-restricted-syntax / -imports / -properties is that body's own
  // opinion, and it differs per surface — a Supabase port ban belongs in e2e, an arbitrary-Tailwind
  // ban in components. The shared tiers keep only the entries that name nothing project-specific
  // and splice these in after them. A body adds bans here; it can never remove a shared one.
  restrictions: {
    type: "object",
    fields: Object.fromEntries(
      ["source", "component", "package", "unit-test", "e2e", "script"].map((surface) => [
        surface,
        { type: "object", fields: { syntax: { type: "object[]", default: [] }, imports: { type: "object[]", default: [] }, properties: { type: "object[]", default: [] } } },
      ])
    ),
  },
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
import { pathToFileURL, fileURLToPath } from "node:url";
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

  // Regression: a generated tool function must satisfy `(body?) => object` — calling it with no
  // argument must still return the schema's defaults, not throw on an intermediate undefined key
  // and not silently return `undefined` where the schema promises `[]` or `{}`. `literal`'s
  // `defaults` argument is what makes that true: supplied, a `$parameter` renders as an optional
  // chain with its default embedded, both as a plain field and as an array-extending spread.
  it("renders a $parameter as an optional chain with its embedded default when defaults are supplied", () => {
    expect(literal({ $parameter: "hooks.preCommit" }, "", { hooks: { preCommit: [] } })).toBe("body.hooks?.preCommit ?? []");
    expect(literal({ $parameter: "knip.root" }, "", { knip: { root: {} } })).toBe("body.knip?.root ?? {}");
    expect(literal({ $parameter: "workspacePackages" }, "", { workspacePackages: [] })).toBe("body.workspacePackages ?? []");
    expect(literal(["a", { $parameter: "ignore.spelling" }], "", { ignore: { spelling: [] } })).toBe('["a", ...(body.ignore?.spelling ?? [])]');
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

describe("renderFunction — EXTENDERS collision regression", () => {
  // knip's EXTENDERS entries "apps.entry" and "packages.entry" share a leaf name ("entry") under
  // different parents. A textual splice keyed only on the leaf name (the brief's original
  // regex-based implementation) finds the first "entry": [ occurrence for both, nesting
  // packages' extension inside apps' fallback instead of extending its own field. The fix
  // addresses each field by its full path, so each extends only its own parameter.
  it("extends apps.entry from knip.apps.extraEntries and packages.entry from knip.packages.extraEntries, not each other", () => {
    const rows = [
      { tool: "knip", surface: "*", key: "apps.entry", chosen: ["src/app/**/*.ts"], tier: "class", test: "benefit" },
      { tool: "knip", surface: "*", key: "packages.entry", chosen: ["tests/**/*.ts"], tier: "class", test: "benefit" },
    ];
    const src = renderFunction("knip", rows, provenance);
    expect(src).toContain('"entry": ["src/app/**/*.ts", ...(body.knip?.apps?.extraEntries ?? [])]');
    expect(src).toContain('"entry": ["tests/**/*.ts", ...(body.knip?.packages?.extraEntries ?? [])]');
    expect(src).not.toContain("[, ...");
  });
});

describe("renderFunction — EXTENDER-target rows are not also emitted as fields", () => {
  // knip's reconciler emits a parameter row for the exact path an EXTENDERS entry targets — e.g.
  // "apps.extraEntries" with `chosen: { $parameter: "knip.apps.extraEntries" }` — because that
  // parameter is meaningful in its own right. In the generated bundle it is not: the parameter
  // belongs only in the spread `applyExtenders` already adds to `entry`/`project`. Rendering it
  // again as a field of its own is redundant data with no place in the class's knip shape.
  it("omits extraEntries/extraProjects as fields while keeping the entry/project spreads", () => {
    const rows = [
      { tool: "knip", surface: "*", key: "apps.entry", chosen: ["src/app/**/*.ts"], tier: "class", test: "benefit" },
      { tool: "knip", surface: "*", key: "apps.extraEntries", chosen: { $parameter: "knip.apps.extraEntries" }, tier: "class", test: "parameter" },
      { tool: "knip", surface: "*", key: "apps.project", chosen: ["src/**/*.ts"], tier: "class", test: "benefit" },
      { tool: "knip", surface: "*", key: "apps.extraProjects", chosen: { $parameter: "knip.apps.extraProjects" }, tier: "class", test: "parameter" },
      { tool: "knip", surface: "*", key: "packages.entry", chosen: ["tests/**/*.ts"], tier: "class", test: "benefit" },
      { tool: "knip", surface: "*", key: "packages.extraEntries", chosen: { $parameter: "knip.packages.extraEntries" }, tier: "class", test: "parameter" },
      { tool: "knip", surface: "*", key: "packages.project", chosen: [], tier: "class", test: "benefit" },
      { tool: "knip", surface: "*", key: "packages.extraProjects", chosen: { $parameter: "knip.packages.extraProjects" }, tier: "class", test: "parameter" },
    ];
    const src = renderFunction("knip", rows, provenance);
    // "extraEntries"/"extraProjects" legitimately appear inside the spread reads
    // (body.knip?.apps?.extraEntries); what must never appear is either as a JSON field key.
    expect(src).not.toContain('"extraEntries":');
    expect(src).not.toContain('"extraProjects":');
    expect(src).toContain('"entry": ["src/app/**/*.ts", ...(body.knip?.apps?.extraEntries ?? [])]');
    expect(src).toContain('"project": ["src/**/*.ts", ...(body.knip?.apps?.extraProjects ?? [])]');
    expect(src).toContain('"entry": ["tests/**/*.ts", ...(body.knip?.packages?.extraEntries ?? [])]');
    expect(src).toContain('"project": [...(body.knip?.packages?.extraProjects ?? [])]');
  });
});

describe("generated tool functions satisfy (body?) => object", () => {
  // Real-data regression for the same contract: build the actual bundle from the committed
  // rulings.json and prove every generated physics/class tool function tolerates a missing
  // argument — this is what surfaced the bug (the brief's own given tests don't exercise two
  // EXTENDERS entries sharing a leaf, and none of them call a generated function with no body).
  it("returns an object from every generated tool function called with no argument", async () => {
    const rulingsPath = fileURLToPath(new URL("../../../docs/decisions/rulings.json", import.meta.url));
    const rulings = JSON.parse(fs.readFileSync(rulingsPath, "utf8"));
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-contract-"));
    fs.mkdirSync(path.join(dir, "classes/next-supabase-mono"), { recursive: true });
    fs.writeFileSync(path.join(dir, "classes/next-supabase-mono/schema.mjs"), "export default {};");
    fs.writeFileSync(path.join(dir, "classes/next-supabase-mono/eslint.base.mjs"), "export default {};");
    writeBundle(rulings, dir);

    const files = [
      "physics/hooks.mjs", "physics/syncpack.mjs", "physics/lint-staged.mjs", "physics/ls-lint.mjs", "physics/prettier.mjs", "physics/secretlint.mjs",
      "classes/next-supabase-mono/knip.mjs", "classes/next-supabase-mono/cspell.mjs", "classes/next-supabase-mono/jscpd.mjs", "classes/next-supabase-mono/stylelint.mjs",
    ];
    for (const file of files) {
      const mod = await import(pathToFileURL(path.join(dir, file)).href);
      const result = mod.default();
      expect(result, `${file} default()`).toBeTypeOf("object");
      expect(result, `${file} default()`).not.toBeNull();
      if (file === "classes/next-supabase-mono/knip.mjs") {
        // extraEntries/extraProjects are EXTENDERS targets, consumed by the entry/project
        // spreads — they must never surface as fields of their own on apps/packages.
        expect(Object.keys(result.apps).sort()).toEqual(["entry", "project"]);
        expect(Object.keys(result.packages).sort()).toEqual(["entry", "project"]);
      }
    }
    fs.rmSync(dir, { recursive: true, force: true });
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

describe("packages/orrery/package.json declares every dependency the bundle needs", () => {
  // The generated physics/class eslint files import a plugin module per rule prefix they carry,
  // and the materialised tool configs load the tools themselves. `dependenciesFor` is the single
  // list of what that comes to; the package manifest must be a superset of it, or the bundle
  // imports something the package never asked for — which is exactly how
  // "@next/next/no-location-assign-relative-destination" broke every real run.
  it("declares at least dependenciesFor(every prefix in the committed rulings.json)", () => {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
    const rulings = JSON.parse(fs.readFileSync(path.join(root, "docs/decisions/rulings.json"), "utf8"));
    const manifest = JSON.parse(fs.readFileSync(path.join(root, "packages/orrery/package.json"), "utf8"));
    const prefixes = [...new Set(
      rulings.rows
        .filter((r) => r.tool === "eslint" && r.tier && r.chosen !== null)
        .map((r) => (r.key.includes("/") ? r.key.slice(0, r.key.lastIndexOf("/")) : "core"))
    )].filter((p) => PLUGIN_SOURCES[p]);
    const needed = dependenciesFor(prefixes);
    const missing = Object.keys(needed).filter((name) => !(name in manifest.dependencies));
    expect(missing, "packages/orrery/package.json is missing a dependency the bundle imports").toEqual([]);
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
  "@typescript-eslint": { module: "typescript-eslint", name: "tseslint", member: "tseslint.plugin", version: "^8.65.0" },
  sonarjs: { module: "eslint-plugin-sonarjs", name: "sonarjs", member: "sonarjs", version: "^4.2.0" },
  unicorn: { module: "eslint-plugin-unicorn", name: "unicorn", member: "unicorn", version: "^64.0.0" },
  security: { module: "eslint-plugin-security", name: "security", member: "security", version: "^4.0.1" },
  "unused-imports": { module: "eslint-plugin-unused-imports", name: "unusedImports", member: "unusedImports", version: "^4.4.1" },
  jsdoc: { module: "eslint-plugin-jsdoc", name: "jsdoc", member: "jsdoc", version: "^64.1.0" },
  tsdoc: { module: "eslint-plugin-tsdoc", name: "tsdoc", member: "tsdoc", version: "^0.5.2" },
  boundaries: { module: "eslint-plugin-boundaries", name: "boundaries", member: "boundaries", version: "^6.0.2" },
  "@next/next": { module: "@next/eslint-plugin-next", name: "next", member: "next", version: "^16.3.0" },
  react: { module: "eslint-plugin-react", name: "react", member: "react", version: "^7.37.5" },
  "react-hooks": { module: "eslint-plugin-react-hooks", name: "reactHooks", member: "reactHooks", version: "^7.1.1" },
  "jsx-a11y": { module: "eslint-plugin-jsx-a11y", name: "jsxA11y", member: "jsxA11y", version: "^6.10.2" },
  "better-tailwindcss": { module: "eslint-plugin-better-tailwindcss", name: "betterTailwindcss", member: "betterTailwindcss", version: "^4.7.0" },
  "@tanstack/query": { module: "@tanstack/eslint-plugin-query", name: "tanstackQuery", member: "tanstackQuery", version: "^5.100.5" },
  i18next: { module: "eslint-plugin-i18next", name: "i18next", member: "i18next", version: "^6.1.5" },
  "testing-library": { module: "eslint-plugin-testing-library", name: "testingLibrary", member: "testingLibrary", version: "^7.16.2" },
  playwright: { module: "eslint-plugin-playwright", name: "playwright", member: "playwright", version: "^2.11.0" },
  vitest: { module: "@vitest/eslint-plugin", name: "vitest", member: "vitest", version: "^1.6.27" },
  import: { module: "eslint-plugin-import", name: "importPlugin", member: "importPlugin", version: "^2.32.0" },
};

// Prefixes that appear only as `off` (from eslint-config-prettier) and have no plugin of their own.
export const PRETTIER_OFF_PREFIXES = ["@stylistic", "@stylistic/js", "@stylistic/ts", "@stylistic/jsx", "vue", "flowtype", "babel", "@babel", "standard"];

export const TOOL_DEPENDENCIES = {
  eslint: "^9.39.5", "@eslint/js": "^10.0.1", "eslint-config-prettier": "^10.1.8", typescript: "^6.0.3",
  // C2: eslint-plugin-boundaries resolves every specifier through the `import/resolver` setting the
  // class declares; without this resolver an aliased `@/...` import is an unknown element and the
  // dependency graph is decorative. Version: aeleos's, the only donor that had it.
  "eslint-import-resolver-typescript": "^4.4.5",
  stylelint: "^17.14.1", "stylelint-config-standard": "^40.0.0", "stylelint-config-tailwindcss": "^1.0.1",
  knip: "^6.31.0", jscpd: "^4.2.5", cspell: "^10.0.1", syncpack: "^14.3.1", secretlint: "^12.3.1", "@secretlint/secretlint-rule-preset-recommend": "^12.3.1",
  "@ls-lint/ls-lint": "^2.3.1", "lint-staged": "^16.4.0", prettier: "^3.9.6",
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
import { assertMarker } from "../markers.mjs";

const header = (p, record) => `// GENERATED by orrery reconcile from ${p.a.name} ${p.a.sha} and ${p.b.name} ${p.b.sha} on ${p.date}.\n// Record: docs/decisions/${record}. Edit by hand only through a pull request that also updates the record;\n// the donors are never consulted again.\n`;

// Stable source rendering: sorted keys, parameters as body reads, spreads for parameter arrays.
//
// `defaults` is optional and controls how a `$parameter` marker reads: omitted (the eslint
// tiers' own call sites), it renders a bare chain — `body.hooks.preCommit` — because the class
// eslint file always runs `body` through `withDefaults` before a rules function ever sees it.
// Supplied (every tool function in `tools.mjs`, whose default export a caller may invoke with no
// argument at all), it renders an optional chain with the schema default embedded at generation
// time — `body.hooks?.preCommit ?? []` — so the generated function still honours its `(body?) =>
// object` contract. One mechanism, one code path; the caller's `defaults` argument is what
// switches between the two behaviours.
function pathValue(source, dotted) {
  return dotted.split(".").reduce((o, k) => o?.[k], source);
}

// A parameter path's segments are not all identifiers: `restrictions.unit-test.syntax` names a
// real surface, and `body.restrictions.unit-test.syntax` is a subtraction, not a read (it parsed,
// ran, and threw "test is not defined" inside the generated physics file). A segment that is not a
// valid identifier is rendered as a bracket access.
const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function accessChain(path, optional) {
  return path
    .split(".")
    .map((key, i) => {
      const dot = i === 0 || !optional ? "." : "?.";
      return IDENTIFIER.test(key) ? `${dot}${key}` : `${i === 0 || !optional ? "" : "?."}[${JSON.stringify(key)}]`;
    })
    .join("");
}

function renderParameter(path, defaults) {
  if (defaults === undefined) return `body${accessChain(path, false)}`;
  return `body${accessChain(path, true)} ?? ${literal(pathValue(defaults, path))}`;
}

export function literal(value, indent = "", defaults) {
  assertMarker(value);
  if (value && typeof value === "object" && !Array.isArray(value) && "$parameter" in value) return renderParameter(value.$parameter, defaults);
  if (Array.isArray(value)) {
    const parts = value.map((v) => {
      assertMarker(v);
      if (v && typeof v === "object" && !Array.isArray(v) && "$parameter" in v) {
        const rendered = renderParameter(v.$parameter, defaults);
        return defaults === undefined ? `...${rendered}` : `...(${rendered})`;
      }
      return literal(v, indent, defaults);
    });
    return `[${parts.join(", ")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.keys(value).sort().map((k) => `${JSON.stringify(k)}: ${literal(value[k], indent, defaults)}`);
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
  return `${header(provenance, "0004-eslint.md")}import fs from "node:fs";
import path from "node:path";
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

// I6: "the body has no eslint.local.mjs" is a question for the filesystem, not for the module
// loader. ERR_MODULE_NOT_FOUND is also what a local file that imports something missing throws, so
// catching it here reported a broken local override as an absent one and lint carried on without
// it. Existence is checked; every import error propagates.
async function loadLocal(root) {
  const file = path.join(root, "eslint.local.mjs");
  if (!fs.existsSync(file)) return [];
  return (await import(pathToFileURL(file).href)).default ?? [];
}

export default async function eslintConfig(explicitBody) {
  const { root, config } = explicitBody ? { root: explicitBody.root ?? process.cwd(), config: explicitBody } : await loadBodyConfig(process.cwd());
  const body = withDefaults(config, schema);
  const blocks = ORDER.map((surface) => ({
    name: \`orrery/next-supabase-mono/\${surface}\`,
    files: SURFACE_FILES[surface],
    // The unit-test globs (**/*.test.{ts,tsx}, **/tests/**/*.{ts,tsx}) also match aeleos's
    // apps/*/tests/e2e/*.spec.ts layout — a flat-config block with overlapping "files" still
    // applies, so without this the e2e surface would additionally pick up unit-test's
    // testing-library/vitest rules. The e2e block below (ORDER runs after unit-test) still
    // applies its own rules to that path; this block just steps aside for it.
    ...(surface === "unit-test" ? { ignores: ["**/e2e/**"] } : {}),
    ...base(surface, body, root),
    plugins: PLUGINS,
    rules: { ...physics.rules[surface](body), ...classRules[surface](body) },
  }));
  return [...blocks, prettier, ...(await loadLocal(root))];
}
`;
}
```

T3 amendment (this round — `fix/observe-streams-surfaces-and-baseline`): `SURFACE_FILES.unit-test`'s own globs (`**/*.test.{ts,tsx}`, `**/tests/**/*.{ts,tsx}`) also match aeleos's e2e layout, `apps/*/tests/e2e/*.spec.ts` — a flat-config block with overlapping `files` still applies regardless of another block's own `files`/`ignores`, so a file under `apps/*/tests/e2e/` picked up both the `unit-test` block's `testing-library`/`vitest` rules (which should never apply to e2e specs) and the `e2e` block's own rules. Found running `orrery observe` with `--tools eslint` against aeleos for real: 28 `testing-library/*`/`vitest/*` rules present and on in aeleos's e2e effective config, none of them named by any ruling for that surface. The fix is the `unit-test` block's `ignores: ["**/e2e/**"]` above — `ORDER` runs `e2e` after `unit-test`, so the `e2e` block still applies its own rules to the same path; `unit-test` just steps aside for it. `renderClassEslint`'s `SURFACE_FILES` map itself is unchanged (T3 is a rendering-time addition to the generated `blocks` array, not a glob change).

```javascript
// packages/orrery/src/lib/bundle/tools.mjs
import { literal } from "./eslint.mjs";
import { withDefaults } from "../body-config.mjs";
import schema from "../../../classes/next-supabase-mono/schema.mjs";

// Every generated tool function's contract is `(body?) => object`: called with no argument, it
// must still return the schema's defaults. This is that fallback body, computed once; `literal`
// uses it to embed each `$parameter`'s default alongside its optional-chain read.
const DEFAULT_BODY = withDefaults({}, schema);

const header = (p, record) => `// GENERATED by orrery reconcile from ${p.a.name} ${p.a.sha} and ${p.b.name} ${p.b.sha} on ${p.date}. Record: docs/decisions/${record}.\n`;
const jsonHeader = (p, record) => `GENERATED by orrery reconcile from ${p.a.name} ${p.a.sha} and ${p.b.name} ${p.b.sha} on ${p.date}. Record: docs/decisions/${record}.`;

// C1: a row key is a dotted path into the tool's config object — except when the key is itself a
// glob, and lint-staged's keys always are. `*.{cjs,js,jsx,mjs,ts,tsx}` split on "." produced
// `{ "*": { "{cjs,js,jsx,mjs,ts,tsx}": [...] } }`: a nested object where lint-staged requires a
// command list, so the generated physics/lint-staged.mjs was a config lint-staged refuses. A key
// carrying any glob metacharacter is one literal segment, never a path.
const GLOB_KEY = /[*{},?[\]]/;
const segmentsOf = (key) => (GLOB_KEY.test(key) ? [key] : key.split("."));
const setPath = (target, dotted, value) => { const keys = segmentsOf(dotted); let o = target; for (const k of keys.slice(0, -1)) o = o[k] ??= {}; o[keys.at(-1)] = value; };
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
// A ruling row can name an EXTENDERS target directly (knip's reconciler emits `apps.extraEntries`
// etc. as their own parameter rows). That parameter is consumed by `applyExtenders`'s splice —
// rendering it again as a field of its own would be both redundant and not part of the class's
// shape for that tool. `objectFromRows` skips exactly those rows; every other `$parameter` row
// (knip.root, cspell's `words` via `spelling`, syncpack's `workspacePackages`) is untouched.
const EXTENDER_TARGETS = new Set(Object.values(EXTENDERS));
const isExtenderTargetRow = (r) => r.chosen && typeof r.chosen === "object" && "$parameter" in r.chosen && EXTENDER_TARGETS.has(r.chosen.$parameter);

function objectFromRows(tool, rows) {
  const out = {};
  for (const r of toolRows(rows, tool)) {
    if (isExtenderTargetRow(r)) continue;
    setPath(out, r.key, r.chosen);
  }
  return out;
}

// Splice an EXTENDERS entry into the array it extends, addressed by its full nested path (not
// just the leaf key name) so two fields that share a leaf name under different parents — knip's
// apps.entry and packages.entry — extend the right one. The plain `$parameter` marker is the
// same one a ruling's `chosen` carries directly (e.g. syncpack's `floatingPeers`); `literal`'s
// `defaults` argument is what renders either of them as an optionally-chained read with its
// schema default, so there is one mechanism for "this field is body data," not two.
function applyExtenders(tool, out) {
  for (const [key, param] of Object.entries(EXTENDERS)) {
    const [t, ...rest] = key.split(".");
    if (t !== tool) continue;
    const leaf = rest.at(-1);
    let node = out;
    for (const segment of rest.slice(0, -1)) node = node?.[segment];
    if (Array.isArray(node?.[leaf])) node[leaf] = [...node[leaf], { $parameter: param }];
  }
}

export function renderStylelint(rows, provenance, defaults = DEFAULT_BODY) {
  const value = objectFromRows("stylelint", rows);
  return `${header(provenance, "0006-stylelint.md")}export default function stylelint(body = {}) {\n  return ${literal(value, "", defaults)};\n}\n`;
}

const RECORD = { prettier: "0007-prettier.md", secretlint: "0008-secretlint.md", jscpd: "0009-jscpd.md", cspell: "0010-cspell.md", "ls-lint": "0011-ls-lint.md", knip: "0012-knip.md", syncpack: "0013-syncpack.md", "lint-staged": "0014-lint-staged.md", hooks: "0015-hooks.md" };

// C1: a few tools want an ARRAY where the rulings address entries by a readable label. syncpack's
// own schema (node_modules/syncpack/schema.json, and libra's committed .syncpackrc.json) declares
// `versionGroups` as an array of group objects; the rulings key each group by what it is
// ("versionGroups.workspace", "versionGroups.floatingPeers") so the record reads as a record and
// each group keeps its own a/b provenance. This is the one place the two meet: the labelled map
// collapses to the array the tool reads, in the rulings' own row order.
const SHAPES = {
  syncpack: (out) => (out.versionGroups ? { ...out, versionGroups: Object.values(out.versionGroups) } : out),
};

export function renderFunction(tool, rows, provenance, defaults = DEFAULT_BODY) {
  const rendered = objectFromRows(tool, rows);
  const value = SHAPES[tool] ? SHAPES[tool](rendered) : rendered;
  applyExtenders(tool, value);
  const source = literal(value, "", defaults);
  const name = tool.replace(/-([a-z])/g, (m, c) => c.toUpperCase());
  return `${header(provenance, RECORD[tool])}export default function ${name}(body = {}) {\n  return ${source};\n}\n`;
}
```

(Shipped as of Task 6 fix round 2. Three corrections from the design above, all found by
measuring the real repos rather than by re-reading the code: the original `EXTENDERS` splice
matched a leaf key name textually — `"apps.entry"` and `"packages.entry"` both end in `entry`, so
the second substitution re-matched the first's already-rewritten text and nested `packages`'s
extension inside `apps`'s fallback instead of extending its own field; every `$parameter` read
(not just the array-extending ones) must satisfy the exported functions' documented `(body?) =>
object` contract — calling `hooks()` or `knip()` with no argument threw on an intermediate
`undefined` key (`body.hooks.preCommit`) rather than returning the schema's default; and a
ruling row can name an EXTENDERS target directly (knip's reconciler emits `apps.extraEntries` as
its own parameter row, alongside the `apps.entry` row `applyExtenders` already extends from that
same parameter) — `objectFromRows` rendered that row as a field of its own too, which is not part
of the class's knip shape and duplicates data already in the spread. `applyExtenders` now
addresses each field by its full nested path; `literal`'s `defaults` argument renders every
`$parameter` — plain field or array-extending spread alike — as an optional chain with its schema
default embedded, for any caller that supplies one; and `objectFromRows` skips any row whose
`$parameter` names an EXTENDERS target, since that parameter's only place in the generated output
is the spread. `renderObject` from the design above was dead code once the splice moved and was
dropped.)

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
import { createRequire } from "node:module";
import globals from "globals";
import tseslint from "typescript-eslint";

// The resolver is named by ABSOLUTE PATH, not by the short name "typescript". eslint-module-utils
// (which eslint-plugin-boundaries and eslint-plugin-import both resolve through) loads a named
// resolver from the linted FILE's own package directory, or from its own directory inside the
// store — never from Orrery's. Under pnpm's isolated layout that means a body which does not
// itself depend on eslint-import-resolver-typescript silently gets no resolver at all, every
// aliased import becomes an unplaceable element, and boundaries reports nothing while looking
// healthy. Orrery ships the resolver, so Orrery is the one that can say where it is.
const RESOLVER = createRequire(import.meta.url).resolve("eslint-import-resolver-typescript");

const STANDARD_ELEMENTS = [
  { type: "proxy", mode: "file", pattern: "apps/*/src/proxy.ts" },
  // The capture list is load-bearing, not decoration. The class's boundaries policy allows a barrel
  // to reach only into its OWN feature, written as `{{ from.captured.feature }}`, and its layered
  // rules match on `layer`. Captures bind to the pattern's `*` groups IN ORDER, and the class's
  // patterns lead with `apps/*` where a single body's own config names its one app — so the app
  // wildcard must be named too, or `feature` binds to the app name and `layer` to the feature, and
  // every layered edge matches nothing.
  { type: "feature-barrel", mode: "file", pattern: "apps/*/src/features/*/{index,public}.ts", capture: ["app", "feature"] },
  { type: "feature", pattern: "apps/*/src/features/*/*", capture: ["app", "feature", "layer"] },
  { type: "shared", pattern: "apps/*/src/shared/*", capture: ["app", "layer"] },
  { type: "app", pattern: ["apps/*/src/app", "apps/*/src/app/**"] },
  { type: "package", pattern: "packages/*/src", capture: ["package"] },
];

// Both donors turn `no-undef` off on source/component/package (rulings.json: agree, chosen
// [0, ...]) — the TypeScript compiler catches undefined identifiers there, not eslint, and
// type-aware parsing resolves `window`/`process`/etc. through TypeScript's own lib types, not
// through eslint's `no-undef`/globals machinery. Declaring globals for those three surfaces was
// dead weight with no rule left to consume it, so S1 (PR #31 review) drops it there. `script`
// keeps `no-undef` on (adopted from aeleos) and so still needs `globals.node`; `unit-test`/`e2e`
// keep both node and browser for the test-runner and DOM globals their assertions reference.
const SURFACE_GLOBALS = {
  script: { ...globals.node },
  "unit-test": { ...globals.node, ...globals.browser },
  e2e: { ...globals.node, ...globals.browser },
};

export default function base(surface, body, root) {
  const typescript = surface !== "script";
  return {
    languageOptions: {
      ...(typescript ? { parser: tseslint.parser, parserOptions: { projectService: true, tsconfigRootDir: root } } : {}),
      ecmaVersion: 2023,
      sourceType: "module",
      // ESLint's own flat-config validator requires an object here, not undefined — `?? {}` for
      // the three surfaces S1 dropped from SURFACE_GLOBALS above, not an omitted key.
      globals: SURFACE_GLOBALS[surface] ?? {},
    },
    settings: {
      react: { version: "detect" },
      // C2. **Without this the boundaries graph is decorative.** eslint-plugin-boundaries asks the
      // `import/resolver` settings where a specifier points; with none configured, every `@/...`
      // import — which is how both donors reach anything that is not a sibling — comes back as an
      // unknown element, and an import the rule cannot place is an import it cannot police. The
      // TypeScript resolver reads the `paths` the compiler reads, so `@/` means the same thing to
      // the linter that it means to the build. Only the TypeScript surfaces have a project to
      // read; `script` is plain JavaScript.
      ...(typescript ? { "import/resolver": { [RESOLVER]: { alwaysTryTypes: true, noWarnOnMultipleProjects: true, project: ["apps/*/tsconfig.json", "packages/*/tsconfig.json"] } } } : {}),
      "boundaries/elements": [...STANDARD_ELEMENTS, ...body.boundaries.elements],
      "boundaries/include": ["apps/*/src/**/*", "packages/*/src/**/*"],
    },
  };
}
```

S1/S2 amendment (this round): both `no-undef` and the missing `package` boundaries element were gaps the first `orrery observe` run against the fixture and libra exposed — `globals` was added to `packages/orrery/package.json` dependencies (it was not there when Task 6 first landed).

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

Paste the printed object into `packages/orrery/package.json` `dependencies`, then `pnpm install` at the root. Then prove the generated class config loads: `node -e "import('./packages/orrery/classes/next-supabase-mono/eslint.mjs').then(m => m.default({ class: 'next-supabase-mono', tailwind: { entryPoint: 'x.css' }, root: process.cwd() })).then(c => console.log(c.length, 'blocks'))"` prints `7 blocks` (six surfaces, prettier, and zero local). If the import throws on a plugin's export shape (a plugin whose default export is not the plugin object), fix the `member` expression in `plugins.mjs` and note it.

- [ ] **Step 6: Commit and land**

```bash
git checkout -b feat/2b-bundle origin/develop
git add packages/orrery/src/lib/bundle packages/orrery/src/lib/body-config.mjs packages/orrery/src/commands/bundle.mjs packages/orrery/src/cli.mjs packages/orrery/classes packages/orrery/physics packages/orrery/package.json pnpm-lock.yaml packages/orrery/tests/bundle.test.mjs packages/orrery/tests/body-config.test.mjs
git commit -m "feat(bundle): generated physics and class tiers, the body-config loader, the class schema [GH-000]"
git push -u origin HEAD && gh pr create --base develop --title "feat(bundle): generated tiers, body-config loader and class schema [GH-000]" --body "Task 6 of the 2b plan." && gh pr merge --squash --auto
```

S1 amendment, PR #31 review (this round — `fix/observe-streams-surfaces-and-baseline`): `SURFACE_GLOBALS` dropped its `source`/`component`/`package` entries outright rather than setting them to `{ ...globals.browser, ...globals.node }`. Both donors turn `no-undef` off on those three surfaces (rulings.json: agree, chosen `[0, ...]`), and type-aware parsing resolves `window`/`process`/etc. through TypeScript's own lib types, not eslint's globals machinery — so there was no rule left on those surfaces to consume a globals declaration, and declaring one was dead weight the PR #31 review caught. `base()`'s `languageOptions.globals` now reads `SURFACE_GLOBALS[surface] ?? {}` (`?? {}`, not left `undefined`): ESLint's own flat-config validator rejects `languageOptions.globals: undefined` outright (`Key "globals": Expected an object`), so the three surfaces that no longer have a `SURFACE_GLOBALS` entry still need an empty object, not a missing key. `script` keeps `globals.node` (adopted from aeleos, `no-undef` still on there); `unit-test`/`e2e` keep both. `packages/orrery/tests/eslint-base.test.mjs`'s three `source`/`component`/`package` cases were inverted to assert absence instead of presence.

The same PR #31 review flagged two comment-vs-plan mismatches in `packages/orrery/src/lib/observe/code.mjs`, fixed in the same commit as the T1–T4 work below: `ruledValueMatches`'s closing comment pointed at itself ("They did: see `ruledValueMatches` below") instead of at `tightenedFor`, the actual sibling function the S4 carve-out has to agree with; and `tightenedFor`'s own comment picked up a stray line-wrap versus this plan's mirror. Both are cosmetic — no behaviour changed — but `tightenedFor`'s comment is superseded anyway by the T4b addition below.

---

### Task 7: The fixture body and the bundle-honesty test

A minimal `next-supabase-mono` body inside this repository, wired to the bundle through the workspace. Its effective eslint config per surface must equal the ruling rows; that test is what keeps the generated bundle honest after anyone edits it by hand.

**Files:**
- Modify: `pnpm-workspace.yaml` — add `fixtures/*`
- Create: `fixtures/next-supabase-mono/package.json`, `orrery.config.mjs`, `eslint.config.mjs`, `eslint.local.mjs`, `tsconfig.json`, `apps/web/src/features/thing/application/use-thing.ts`, `apps/web/src/features/thing/presentation/thing-tile.tsx`, `apps/web/src/app/layout.tsx`, `apps/web/src/app/globals.css`, `apps/web/tests/use-thing.test.ts`, `apps/web/e2e/home.spec.ts`, `packages/core/src/thing.ts`, `scripts/build.mjs`
- Create: `packages/orrery/templates/next-supabase-mono/` — the pointer files `init` will write: `eslint.config.mjs`, `eslint.local.mjs`, `tsconfig.json`, `.husky/commit-msg`, `.husky/pre-push`, `.husky/pre-commit`, `.github/workflows/ci.yml` (7 files: the "three pointer files" of Step 1 below are `eslint.config.mjs`, `eslint.local.mjs`, and `tsconfig.json`); the fixture's copies are byte-identical to these
- Test: `packages/orrery/tests/bundle-honesty.test.mjs`
- Test: `packages/orrery/tests/fixture-pointers.test.mjs`

**Interfaces:**
- Consumes: the generated bundle (Task 6), `readEffectiveConfig` (2a), `rulings.json` (Task 5).
- Produces: `fixtures/next-supabase-mono` as the body that does not exist yet; `templates/` as the byte source of truth for pointers, which `observe`'s pointer drift (Task 8) compares against.

- [ ] **Step 1: Write the fixture**

`fixtures/next-supabase-mono/package.json`:
```json
{ "name": "fixture-next-supabase-mono", "private": true, "type": "module", "devDependencies": { "@vaoan/orrery": "workspace:*", "eslint": "^9.39.5" }, "prettier": "@vaoan/orrery/prettier" }
```

Accepted deviation from the original sketch (fix round 1): `eslint` is a direct fixture devDependency, at the same range `@vaoan/orrery` itself depends on. `readEffectiveConfig` resolves the ESLint binary by walking `node_modules/eslint` up from the *target* directory on disk, never through Node's own resolver — real bodies (aeleos, libra) satisfy this because each installs its own `eslint` at its own repo root. The fixture's root is `fixtures/next-supabase-mono`, one level below Orrery's own root; `@vaoan/orrery`'s `eslint` lives under `packages/orrery`, which is not an ancestor of the fixture, so without this the walk finds nothing and every `--print-config` call fails with "eslint is not installed". Declaring `eslint` directly on the fixture mirrors what every real body already needs.

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

`tsconfig.json`: `{ "extends": "@vaoan/orrery/tsconfig", "include": ["apps/*/src", "apps/*/tests", "apps/*/e2e", "packages/*/src", "packages/*/tests"] }`

S3 amendment (this round): both donors' per-app tsconfigs include `**/*.ts`, so tests and e2e sit inside their own project — the original two-entry include left the fixture's e2e/unit-test files "not found by the project service". The include list above is what both the template and the fixture's own copy carry now (still byte-identical); `packages/orrery/src/lib/observe/scratch.mjs`'s `tsconfigInclude` default (Task 9) was widened to match.

Source files are two to five lines each, valid TypeScript and TSX that violate nothing; `globals.css` is `@import "tailwindcss";`.

S5 amendment (this round): the first real `orrery observe` run found the fixture was not actually clean — `sonarjs/prefer-read-only-props` (component/source props must be `readonly`), `jsdoc/require-param` (an `@param` tag per parameter), and `i18next/no-literal-string` (`mode: "all"` flags every string literal, including a template literal's static text). `layout.tsx`'s and `thing-tile.tsx`'s prop types gained `readonly`; `use-thing.ts` and `thing.ts` gained a full `@param`/`@returns` JSDoc block and moved their `"thing-"` prefix into an `UPPER_CASE` module constant (`THING_LABEL_PREFIX`) — eslint-plugin-i18next exempts a literal assigned to an all-uppercase identifier as machine data, not user-facing copy, so the template literal's own quasis carry no literal text once the prefix is interpolated in. No file gained an eslint-disable comment.

Templates: copy the three pointer files (`eslint.config.mjs`, `eslint.local.mjs`, `tsconfig.json`) and the three `.husky` hooks (`pnpm orrery hook <name>` one-liners) and the five-line `ci.yml` caller (`uses: vaoan/Orrery/.github/workflows/ci.yml@main`) into `packages/orrery/templates/next-supabase-mono/` with the same relative paths — 7 files, matching `fixture-pointers.test.mjs`'s `files.length >= 7`.

- [ ] **Step 2: Write the failing tests**

```javascript
// packages/orrery/tests/bundle-honesty.test.mjs
// The generated bundle must produce, for the fixture body, exactly the rulings for every surface.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readEffectiveConfig } from "../src/lib/effective-config.mjs";
import { severityOf } from "../src/lib/reconcile/ordering.mjs";
import { effectiveMismatches } from "../src/lib/observe/code.mjs";
import { PLUGIN_SOURCES } from "../src/lib/bundle/plugins.mjs";
import { withDefaults } from "../src/lib/body-config.mjs";
import schema from "../classes/next-supabase-mono/schema.mjs";
import { builtinRules } from "eslint/use-at-your-own-risk";

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
const rawBody = (await import(path.join(fixture, "orrery.config.mjs").replace(/^([A-Za-z]):/, "file:///$1:"))).default;
// The real bundle always reads a schema-defaulted body (`withDefaults`, in body-config.mjs) — a
// $parameter such as "e2e.assertFunctionNames" or "i18n.excludedWords" that the fixture's
// orrery.config.mjs leaves unset resolves to the schema's default ([]), never to `undefined`.
// Reading the raw, un-defaulted config here would make `read()` return `undefined` for anything
// the fixture omits, which JSON.stringify then silently drops — a false "want": {} that does not
// reflect what the generator actually renders.
const body = withDefaults(rawBody, schema);

// The honesty comparison itself (canonical key-order-independent matching, the subset "actual can
// carry a schema-filled default `want` never spelled out" slack, the eslint-config-prettier
// exemption) lives in src/lib/observe/code.mjs's effectiveMismatches — this is the same function
// `orrery observe` runs against a real body, so there is one comparison, not two.
describe.each(Object.entries(SAMPLES))("surface %s", (surface, file) => {
  const effective = readEffectiveConfig(fixture, file);
  const mismatches = effectiveMismatches(effective.rules, rulings.rows, surface, body);

  it("carries every ruled rule with the ruled value", () => {
    expect(mismatches.filter((m) => !m.endsWith("not in the rulings and not off"))).toEqual([]);
  }, 120_000);

  it("carries no rule the rulings do not name, except eslint-config-prettier's offs", () => {
    expect(mismatches.filter((m) => m.endsWith("not in the rulings and not off"))).toEqual([]);
  }, 120_000);
});

// T3: aeleos's own e2e layout nests under apps/*/tests/e2e/, not apps/*/e2e/ — and the
// unit-test surface's own globs (**/*.test.{ts,tsx}, **/tests/**/*.{ts,tsx}) match that path too.
// A flat-config block with overlapping "files" still applies regardless of "ignores" on another
// block, so without the unit-test block's own "ignores": ["**/e2e/**"] (SURFACE_FILES /
// renderClassEslint in src/lib/bundle/eslint.mjs) this file would carry both the e2e surface's
// rules and the unit-test surface's testing-library/vitest ones. Checked as its own surface
// sample, separately from SAMPLES.e2e above, specifically because it is the layout that broke.
describe("surface e2e (aeleos's nested apps/*/tests/e2e/ layout)", () => {
  const file = "apps/web/tests/e2e/smoke.spec.ts";
  const effective = readEffectiveConfig(fixture, file);
  const mismatches = effectiveMismatches(effective.rules, rulings.rows, "e2e", body);

  it("carries every ruled rule with the ruled value", () => {
    expect(mismatches.filter((m) => !m.endsWith("not in the rulings and not off"))).toEqual([]);
  }, 120_000);

  it("carries no rule the rulings do not name, except eslint-config-prettier's offs", () => {
    expect(mismatches.filter((m) => m.endsWith("not in the rulings and not off"))).toEqual([]);
  }, 120_000);

  it("carries no testing-library/* or vitest/* rule that is on", () => {
    const on = Object.entries(effective.rules)
      .filter(([key, value]) => (key.startsWith("testing-library/") || key.startsWith("vitest/")) && severityOf(value) !== "off")
      .map(([key]) => key);
    expect(on).toEqual([]);
  }, 120_000);
});

// Regression pre-check: a ruling can name a rule that does not exist in the plugin version the
// bundle actually ships (this is exactly how "@next/next/no-location-assign-relative-destination"
// broke every real ESLint run before packages/orrery/package.json caught up to the version the
// ruling was measured against). This checks rule *existence* against the installed plugins
// directly — no fixture, no --print-config — so it fails fast and names the exact rule and plugin,
// rather than surfacing as an opaque `eslint --print-config` crash inside the surface tests above.
const coreRules = builtinRules;
const pluginRulesCache = new Map();
async function rulesForPrefix(prefix) {
  if (pluginRulesCache.has(prefix)) return pluginRulesCache.get(prefix);
  const source = PLUGIN_SOURCES[prefix];
  if (!source) { pluginRulesCache.set(prefix, undefined); return undefined; }
  // import.meta.resolve, not a bare `import(source.module)`: Vite/Vitest's SSR module graph
  // intercepts bare specifiers under "@vitest/*" (colliding with its own internal packages) and
  // resolves them against the workspace root instead of this file's real location, throwing
  // MODULE_NOT_FOUND for "@vitest/eslint-plugin" even though it is genuinely installed.
  // import.meta.resolve follows real Node ESM resolution from this file's own path and sidesteps it.
  const mod = await import(import.meta.resolve(source.module));
  const base = mod.default ?? mod;
  const memberPath = source.member === source.name ? [] : source.member.slice(source.name.length + 1).split(".");
  let plugin = base;
  for (const part of memberPath) plugin = plugin?.[part];
  const rules = plugin?.rules;
  pluginRulesCache.set(prefix, rules);
  return rules;
}

const ruledKeys = [...new Set(
  rulings.rows
    .filter((r) => r.tool === "eslint" && r.tier && r.chosen !== null && severityOf(r.chosen) !== "off")
    .map((r) => r.key)
)];

describe("every ruled, non-off eslint rule exists in the plugin the bundle ships", () => {
  it.each(ruledKeys)("%s", async (key) => {
    const slash = key.lastIndexOf("/");
    if (slash === -1) {
      expect(coreRules.has(key), `core rule "${key}" does not exist in the installed eslint`).toBe(true);
      return;
    }
    const prefix = key.slice(0, slash);
    const ruleName = key.slice(slash + 1);
    const rules = await rulesForPrefix(prefix);
    expect(rules, `"${key}": no plugin mapping (or no rules export) for prefix "${prefix}" in PLUGIN_SOURCES`).toBeTruthy();
    expect(ruleName in rules, `"${key}": "${ruleName}" does not exist in plugin "${prefix}" (module "${PLUGIN_SOURCES[prefix]?.module}")`).toBe(true);
  });
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

T3 amendment (this round — `fix/observe-streams-surfaces-and-baseline`): added `fixtures/next-supabase-mono/apps/web/tests/e2e/smoke.spec.ts` — aeleos's own nested e2e layout (`apps/*/tests/e2e/`, not the fixture's existing `apps/*/e2e/`), Playwright-style, lint-clean. `packages/orrery/tests/bundle-honesty.test.mjs` gained a second describe block, `"surface e2e (aeleos's nested apps/*/tests/e2e/ layout)"`, checking that file's effective config with `effectiveMismatches` the same way `SAMPLES.e2e` (`apps/web/e2e/home.spec.ts`) already is, plus an explicit assertion that no `testing-library/*` or `vitest/*` rule is on for it — the exact shape of the T3 defect this file exists to catch. Kept as a second, separately-labelled describe block rather than a second key in `SAMPLES`, since `SAMPLES` is a plain object keyed by surface name and both files are surface `"e2e"`.

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
import { fileURLToPath } from "node:url";
import { versionDrift, installedCommit } from "../src/lib/observe/version.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const fixture = path.join(root, "fixtures/next-supabase-mono");

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
  it("reports not installed for the real fixture body, which predates the cut-over", () => {
    expect(versionDrift(fixture, { run })).toEqual({ installed: null, latest, behind: false, note: "body does not depend on @vaoan/orrery yet" });
  });
});
```

```javascript
// packages/orrery/tests/observe-pointers.test.mjs
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pointerDrift, localOverrideViolations } from "../src/lib/observe/pointers.mjs";
import schema from "../classes/next-supabase-mono/schema.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const realTemplates = path.join(root, "packages/orrery/templates/next-supabase-mono");
const fixture = path.join(root, "fixtures/next-supabase-mono");

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
  it("reports the real fixture body as fully current against the real templates", async () => {
    const r = await pointerDrift(fixture, realTemplates, schema);
    expect(r.files.every((f) => f.state === "identical")).toBe(true);
    expect(r.local).toEqual([]);
    expect(r.config).toEqual([]);
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

// This machine checks out CRLF (core.autocrlf=true; see CLAUDE.md), so a byte-for-byte
// comparison would report drift on line endings alone. Normalise before comparing.
const normalizeLineEndings = (buf) => buf.toString("utf8").replace(/\r\n/g, "\n");

export async function pointerDrift(bodyDir, templatesDir, schema) {
  const files = listFiles(templatesDir).map((rel) => {
    const target = path.join(bodyDir, rel);
    if (!fs.existsSync(target)) return { path: rel, state: "missing" };
    const same = normalizeLineEndings(fs.readFileSync(target)) === normalizeLineEndings(fs.readFileSync(path.join(templatesDir, rel)));
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
  - `compareToPrediction(observed, prediction) => { unexplained: string[], baseline: { [rule]: number }, moved: [{ rule, was, now }], newRules: string[] }` — a rule with violations that is not in `prediction.tightened` is `unexplained` only when it is absent from the prediction's counts or above its predicted count; otherwise it is `baseline` (violated at the baseline, recorded, informational). Count changes on an already-tightened rule are `moved`, informational.
  - `codeDrift(bodyDir, { bundleDir, bodyConfig, rows, prediction, samples, run, exec, scratchDir, tools }) => { eslint: { mismatches, violations, comparison }, tsc: { errors }, stylelint: { count }, jscpd: { clones }, cspell: { issues }, "ls-lint": { errors }, syncpack: { mismatches } }`.
  - `renderObservation(results)` → one markdown per run with a table per body.

- [ ] **Step 1: Write the failing tests**

```javascript
// packages/orrery/tests/observe-code.test.mjs
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { materialise } from "../src/lib/observe/scratch.mjs";
import { effectiveMismatches, violationsByRule, compareToPrediction, binField, codeDrift, tightenedFor, matches } from "../src/lib/observe/code.mjs";
import { resolveEslintBin } from "../src/lib/effective-config.mjs";

// Every path used in these tests is derived from the test file's own location (never a literal
// drive path): CI runs on Linux, where a hard-coded "Z:/..." string is not absolute at all —
// `path.resolve` silently prepends the runner's cwd to it instead of erroring, producing a
// plausible-looking but wrong path that only fails once something tries to load a module there.
const PACKAGE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGE_DIR_POSIX = PACKAGE_DIR.split(path.sep).join("/");
// A body directory that need not exist: every test below either fully overrides the tool
// functions materialise would otherwise import (so it never touches bodyDir on disk) or mocks
// `run`/`codeDrift`'s subprocess calls outright. `path.resolve("fake-body")` is absolute and
// cross-platform on both Windows and Linux, unlike a literal drive path.
const FAKE_BODY = path.resolve("fake-body");
const FAKE_BODY_POSIX = FAKE_BODY.split(path.sep).join("/");

describe("materialise", () => {
  let scratch;
  beforeEach(() => { scratch = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-scratch-")); });
  afterEach(() => fs.rmSync(scratch, { recursive: true, force: true }));

  it("writes one config per tool that imports the bundle by absolute path and passes the body config", async () => {
    const bundleDir = PACKAGE_DIR;
    const files = await materialise(FAKE_BODY, { class: "next-supabase-mono", tailwind: { entryPoint: "g.css" } }, scratch, { bundleDir, functions: { stylelint: () => ({ rules: {} }), jscpd: () => ({ threshold: 4 }), cspell: () => ({ words: [] }), lsLint: () => "ls:\n", syncpack: () => ({ versionGroups: [] }), tsconfigInclude: ["apps/*/src"] } });
    const eslint = fs.readFileSync(files.eslint, "utf8");
    const eslintEntryUrl = pathToFileURL(`${PACKAGE_DIR_POSIX}/classes/next-supabase-mono/eslint.mjs`).href;
    expect(eslint).toContain(`import orrery from ${JSON.stringify(eslintEntryUrl)}`);
    expect(eslint).toContain(`"root": ${JSON.stringify(FAKE_BODY_POSIX)}`);
    expect(eslint).toContain('"entryPoint": "g.css"');
    expect(JSON.parse(fs.readFileSync(files.tsconfig, "utf8"))).toEqual({
      extends: `${PACKAGE_DIR_POSIX}/classes/next-supabase-mono/tsconfig.json`,
      include: [`${FAKE_BODY_POSIX}/apps/*/src`],
      compilerOptions: { noEmit: true },
    });
    expect(JSON.parse(fs.readFileSync(files.jscpd, "utf8")).threshold).toBe(4);
    expect(fs.readFileSync(files.lsLint, "utf8")).toBe("ls:\n");
  });

  // A real body's tree carries generated build output the bundle itself never excludes (real
  // usage only ever runs it through lint-staged, against staged files). observe's own
  // violations pass is the one caller that sweeps the whole tree; found against libra, where
  // omitting this OOM-crashed the eslint child process parsing `.next`'s generated webpack
  // chunks (see task-9-report.md "Real runs").
  it("ignores generated/build directories in the materialised eslint config", async () => {
    const bundleDir = PACKAGE_DIR;
    const files = await materialise(FAKE_BODY, { class: "next-supabase-mono", tailwind: { entryPoint: "g.css" } }, scratch, { bundleDir, functions: { stylelint: () => ({}), jscpd: () => ({}), cspell: () => ({}), lsLint: () => "ls:\n", syncpack: () => ({}), tsconfigInclude: [] } });
    const eslint = fs.readFileSync(files.eslint, "utf8");
    for (const pattern of ["**/.next/**", "**/.turbo/**", "**/dist/**", "**/build/**", "**/coverage/**", "**/node_modules/**"]) {
      expect(eslint).toContain(JSON.stringify(pattern));
    }
    expect(eslint).toMatch(/export default \[\{ ignores: \[/);
  });

  // Regression for the bug fixed in this round: bodyRoot used to be `posix(bodyDir)` without a
  // `path.resolve` first. A relative bodyDir then flowed, unresolved, into the eslint scratch
  // config's `root` and the tsconfig's `include` paths — root becomes `tsconfigRootDir` in
  // parserOptions (eslint.base.mjs), which typescript-eslint's project service needs absolute;
  // relative, it silently fails to associate any file with a TS project (a parse-level "fatal"
  // message per file, not a config error — see task-9-report.md's "Why this is blocked" #1).
  it("resolves a relative bodyDir to absolute before writing it as root / into tsconfig include", async () => {
    const bundleDir = PACKAGE_DIR;
    const absoluteBody = FAKE_BODY;
    const relativeBody = path.relative(process.cwd(), absoluteBody);
    const files = await materialise(relativeBody, { class: "next-supabase-mono", tailwind: { entryPoint: "g.css" } }, scratch, {
      bundleDir,
      functions: { stylelint: () => ({}), jscpd: () => ({}), cspell: () => ({}), lsLint: () => "ls:\n", syncpack: () => ({}), tsconfigInclude: ["apps/*/src"] },
    });
    const eslint = fs.readFileSync(files.eslint, "utf8");
    const rootMatch = /"root": "([^"]+)"/.exec(eslint);
    expect(rootMatch, "eslint scratch config has no root field").toBeTruthy();
    expect(path.isAbsolute(rootMatch[1])).toBe(true);
    expect(rootMatch[1]).toBe(absoluteBody.split(path.sep).join("/"));

    const tsconfig = JSON.parse(fs.readFileSync(files.tsconfig, "utf8"));
    for (const include of tsconfig.include) expect(path.isAbsolute(include)).toBe(true);
  });

  // Minor: exercise the YAML emitter against the real physics/ls-lint.mjs object, not a stub.
  it("serialises the real physics ls-lint config to nested YAML", async () => {
    const bundleDir = PACKAGE_DIR;
    const lsLintModule = await import(pathToFileURL(path.join(bundleDir, "physics/ls-lint.mjs")).href);
    const real = lsLintModule.default();
    const files = await materialise(FAKE_BODY, { class: "next-supabase-mono", tailwind: { entryPoint: "g.css" } }, scratch, { bundleDir });
    const yaml = fs.readFileSync(files.lsLint, "utf8");
    expect(yaml.startsWith("ls:\n")).toBe(true);
    for (const [pattern, rules] of Object.entries(real.ls)) {
      expect(yaml).toContain(`  ${pattern}:`);
      for (const [ext, rule] of Object.entries(rules)) expect(yaml).toContain(`    ${ext}: ${rule}`);
    }
  });

  // S3: both donors' per-app tsconfigs include `**/*.ts`, so tests and e2e files sit inside
  // their own project — the fixture's e2e/unit-test files were "not found by the project
  // service" until the default (and the template's own include list) covered those directories
  // too. A body that does not override `tsconfig.include` gets this default.
  it("defaults tsconfig include to source, tests and e2e for both apps and packages when the body does not override it", async () => {
    const bundleDir = PACKAGE_DIR;
    const files = await materialise(FAKE_BODY, { class: "next-supabase-mono", tailwind: { entryPoint: "g.css" } }, scratch, { bundleDir });
    const tsconfig = JSON.parse(fs.readFileSync(files.tsconfig, "utf8"));
    expect(tsconfig.include).toEqual(
      ["apps/*/src", "apps/*/tests", "apps/*/e2e", "packages/*/src", "packages/*/tests"].map((i) => `${FAKE_BODY_POSIX}/${i}`)
    );
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

// S4: tightenedFor must use the same comparison as effectiveMismatches (severity + options
// matching, with the eslint-config-prettier carve-out), not a raw norm(own) !== norm(chosen)
// check — a body whose own value for a prettier-off rule merely differs from `chosen` (the
// bundle can never actually enforce that rule; eslint-config-prettier always turns it off last)
// must never be reported as tightened.
describe("tightenedFor", () => {
  const body = {};
  it("never reports a rule eslint-config-prettier always turns off as tightened, even when the body's own value differs from chosen", () => {
    const rows = [{ tool: "eslint", surface: "source", key: "quotes", chosen: ["error", "single"], tier: "physics", test: "agree" }];
    const bodyEffective = { source: { rules: { quotes: ["error", "double"] } } };
    expect(tightenedFor(rows, bodyEffective, body)).toEqual([]);
  });

  it("still reports tightened for a non-prettier rule whose body value differs from chosen", () => {
    const rows = [{ tool: "eslint", surface: "source", key: "no-var", chosen: ["error"], tier: "physics", test: "agree" }];
    const bodyEffective = { source: { rules: { "no-var": ["off"] } } };
    expect(tightenedFor(rows, bodyEffective, body)).toEqual(["no-var"]);
  });

  it("reports nothing when the body's own value already matches chosen", () => {
    const rows = [{ tool: "eslint", surface: "source", key: "no-var", chosen: ["error"], tier: "physics", test: "agree" }];
    const bodyEffective = { source: { rules: { "no-var": ["error"] } } };
    expect(tightenedFor(rows, bodyEffective, body)).toEqual([]);
  });
});

// T4b: a boundaries/* rule reads settings["boundaries/elements"] to know what an "element" is —
// not its own rule options — so two sides can carry an identical `chosen` value and still behave
// differently. `classEffectiveBySurface` (the class bundle's own real effective config, the same
// object codeDrift's eslint pass already computes per surface via readEffectiveConfig) lets
// tightenedFor catch that case too.
describe("tightenedFor / boundaries settings-awareness (T4b)", () => {
  const body = {};
  const rows = [{ tool: "eslint", surface: "source", key: "boundaries/no-unknown", chosen: ["error"], tier: "class", test: "agree" }];

  it("reports a boundaries/* rule tightened when the class's settings differ from the body's own, even though the rule value already matches", () => {
    const bodyEffective = { source: { rules: { "boundaries/no-unknown": ["error"] }, settings: { "boundaries/elements": [{ type: "app" }] } } };
    const classEffective = { source: { settings: { "boundaries/elements": [{ type: "app" }, { type: "package" }] } } };
    expect(tightenedFor(rows, bodyEffective, body, classEffective)).toEqual(["boundaries/no-unknown"]);
  });

  it("does not report a boundaries/* rule tightened when the settings are the same modulo key order (canonicalised)", () => {
    const bodyEffective = { source: { rules: { "boundaries/no-unknown": ["error"] }, settings: { "boundaries/elements": [{ type: "app", capture: ["x"] }] } } };
    const classEffective = { source: { settings: { "boundaries/elements": [{ capture: ["x"], type: "app" }] } } };
    expect(tightenedFor(rows, bodyEffective, body, classEffective)).toEqual([]);
  });

  it("ignores settings entirely for a non-boundaries rule", () => {
    const nonBoundaryRows = [{ tool: "eslint", surface: "source", key: "no-var", chosen: ["error"], tier: "physics", test: "agree" }];
    const bodyEffective = { source: { rules: { "no-var": ["error"] }, settings: { "boundaries/elements": [{ type: "app" }] } } };
    const classEffective = { source: { settings: { "boundaries/elements": [{ type: "package" }] } } };
    expect(tightenedFor(nonBoundaryRows, bodyEffective, body, classEffective)).toEqual([]);
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

  // T4a: baseline semantics. A rule with violations that the prediction did not tighten is only
  // "unexplained" when it is new (absent from prediction.counts) or worse (more violations now
  // than predicted); at or below its predicted count, it is "baseline" — known, informational,
  // not a failure.
  describe("baseline semantics (T4a)", () => {
    it("a baseline rule (violated, not tightened) at its predicted count is baseline, not unexplained", () => {
      const prediction = { tightened: [], counts: { "sonarjs/prefer-read-only-props": 10 } };
      const r = compareToPrediction({ "sonarjs/prefer-read-only-props": 10 }, prediction);
      expect(r.unexplained).toEqual([]);
      expect(r.baseline).toEqual(["sonarjs/prefer-read-only-props"]);
    });

    it("a baseline rule below its predicted count is baseline, not unexplained", () => {
      const prediction = { tightened: [], counts: { "sonarjs/prefer-read-only-props": 10 } };
      const r = compareToPrediction({ "sonarjs/prefer-read-only-props": 4 }, prediction);
      expect(r.unexplained).toEqual([]);
      expect(r.baseline).toEqual(["sonarjs/prefer-read-only-props"]);
    });

    it("a baseline rule above its predicted count is unexplained, not baseline", () => {
      const prediction = { tightened: [], counts: { "sonarjs/prefer-read-only-props": 10 } };
      const r = compareToPrediction({ "sonarjs/prefer-read-only-props": 11 }, prediction);
      expect(r.unexplained).toEqual(["sonarjs/prefer-read-only-props"]);
      expect(r.baseline).toEqual([]);
    });

    it("a rule with no predicted count at all is unexplained", () => {
      const prediction = { tightened: [], counts: {} };
      const r = compareToPrediction({ "boundaries/no-unknown": 1 }, prediction);
      expect(r.unexplained).toEqual(["boundaries/no-unknown"]);
      expect(r.baseline).toEqual([]);
    });

    it("a tightened rule is neither baseline nor unexplained, no matter its count", () => {
      const prediction = { tightened: ["no-var"], counts: { "no-var": 2 } };
      const r = compareToPrediction({ "no-var": 50 }, prediction);
      expect(r.unexplained).toEqual([]);
      expect(r.baseline).toEqual([]);
    });
  });
});

// Each of these packages' bin field points somewhere different in its own tree (stylelint:
// "bin/stylelint.mjs", syncpack: "./index.cjs", @ls-lint/ls-lint's bin key is the short
// "ls-lint", not its scoped package name): binField must read the field, not assume a layout.
describe("binField", () => {
  it.each([
    ["eslint", "eslint"],
    ["typescript", "tsc"],
    ["stylelint", "stylelint"],
    ["jscpd", "jscpd"],
    ["cspell", "cspell"],
    ["@ls-lint/ls-lint", "ls-lint"],
    ["syncpack", "syncpack"],
  ])("%s resolves to an existing file", (pkg, binName) => {
    const resolved = binField(pkg, binName);
    expect(fs.existsSync(resolved), `${resolved} does not exist`).toBe(true);
  });
});

describe("codeDrift", () => {
  // F1: eslint is the one binary the rulings and the honesty comparison are measured against,
  // so it is resolved the mandated way — resolveEslintBin, from packages/orrery — not through
  // the generic binField used for the other six tools.
  it("resolves eslint via resolveEslintBin from packages/orrery, not binField", async () => {
    const calls = [];
    const run = (command, args) => { calls.push(args); return { stdout: "[]", stderr: "", status: 0 }; };
    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-observe-test-"));
    try {
      await codeDrift(FAKE_BODY, { rows: [], bodyConfig: {}, samples: {}, bodyEffective: {}, tools: ["eslint"], run, scratchDir: scratch });
    } finally {
      fs.rmSync(scratch, { recursive: true, force: true });
    }
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0]).toContain(resolveEslintBin(PACKAGE_DIR));
  });

  // F2: a tool crashing must never take the whole observation down. Inject a `run` that throws
  // (as a subprocess spawn failure would) for one tool only.
  it("catches a tool crash as { crashed: true, message }, and the other tools still run", async () => {
    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-observe-test-"));
    try {
      const run = (command, args) => {
        if (args.some((a) => typeof a === "string" && a.endsWith("stylelint.config.mjs"))) {
          throw new Error("boom");
        }
        return { stdout: "[]", stderr: "", status: 0 };
      };
      const result = await codeDrift(FAKE_BODY, { rows: [], bodyConfig: {}, samples: {}, bodyEffective: {}, tools: ["stylelint", "cspell"], run, scratchDir: scratch });
      expect(result.stylelint).toEqual({ crashed: true, message: "boom" });
      expect(result.cspell).toEqual({ issues: 0 });
    } finally {
      fs.rmSync(scratch, { recursive: true, force: true });
    }
  });

  // T1 regression: the installed stylelint and @ls-lint/ls-lint write their real report to
  // stderr, not stdout, even on a non-zero exit with real findings — the old stdout-only read
  // (`defaultRun`'s execFileSync catch) turned every one of those findings into a false
  // "crashed". A `run` stub standing in for that real shape (status 1, the report on stderr,
  // nothing on stdout) must still produce counts.
  it("reads stylelint's report from stderr, not stdout, even at a non-zero exit", async () => {
    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-observe-test-"));
    try {
      const run = () => ({ stdout: "", stderr: JSON.stringify([{ warnings: [{}, {}] }, { warnings: [{}] }]), status: 2 });
      const result = await codeDrift(FAKE_BODY, { rows: [], bodyConfig: {}, samples: {}, bodyEffective: {}, tools: ["stylelint"], run, scratchDir: scratch });
      expect(result.stylelint).toEqual({ count: 3 });
    } finally {
      fs.rmSync(scratch, { recursive: true, force: true });
    }
  });

  it("reads ls-lint's report from stderr, not stdout, even at a non-zero exit", async () => {
    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-observe-test-"));
    try {
      const stderr = "apps/web/src/BadName.ts failed for `.ts` rules: kebabcase\napps/web/src/Other.ts failed for `.ts` rules: kebabcase\n";
      const run = () => ({ stdout: "", stderr, status: 1 });
      const result = await codeDrift(FAKE_BODY, { rows: [], bodyConfig: {}, samples: {}, bodyEffective: {}, tools: ["ls-lint"], run, scratchDir: scratch });
      expect(result["ls-lint"]).toEqual({ errors: 2 });
    } finally {
      fs.rmSync(scratch, { recursive: true, force: true });
    }
  });

  // T1 regression, the other direction: eslint's report stays on stdout, as before — this must
  // not regress when the other tools move to stderr.
  it("still reads eslint's violations report from stdout", async () => {
    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-observe-test-"));
    try {
      const eslintJson = JSON.stringify([{ filePath: "a.ts", messages: [{ ruleId: "no-var" }] }]);
      const run = () => ({ stdout: eslintJson, stderr: "some unrelated plugin warning\n", status: 1 });
      const result = await codeDrift(FAKE_BODY, { rows: [], bodyConfig: {}, samples: {}, bodyEffective: {}, tools: ["eslint"], run, scratchDir: scratch });
      expect(result.eslint.violations).toEqual({ "no-var": 1 });
    } finally {
      fs.rmSync(scratch, { recursive: true, force: true });
    }
  });

  // Minor: a scratch directory codeDrift creates itself (no scratchDir passed) is its own to
  // clean up; one the caller passed in is the caller's to keep (tests read its files).
  it("removes a scratch directory it creates itself, but not one the caller passed", async () => {
    const calls = [];
    const run = (command, args) => { calls.push(args); return { stdout: "[]", stderr: "", status: 0 }; };
    await codeDrift(FAKE_BODY, { rows: [], bodyConfig: {}, samples: {}, bodyEffective: {}, tools: ["eslint"], run });
    const ownScratchDir = path.dirname(calls[0][calls[0].indexOf("-c") + 1]);
    expect(fs.existsSync(ownScratchDir)).toBe(false);

    const passedScratch = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-observe-owned-"));
    try {
      await codeDrift(FAKE_BODY, { rows: [], bodyConfig: {}, samples: {}, bodyEffective: {}, tools: ["eslint"], run, scratchDir: passedScratch });
      expect(fs.existsSync(passedScratch)).toBe(true);
    } finally {
      fs.rmSync(passedScratch, { recursive: true, force: true });
    }
  });

  // T2: the installed syncpack (packages/orrery/node_modules/syncpack, a Rust binary) panics on
  // every `--config` invocation that has real work to do — reproduced directly against the
  // binary, not just through this code path (see this fix's report). The adopted shape drops
  // --config and relies on cosmiconfig-style discovery from the body's own root, exactly how
  // both donors' own package.json scripts invoke it. This is the one real (non-stubbed) run in
  // this file: it proves the fixture gets a parseable result through codeDrift's actual
  // invocation, not a mocked stand-in for one.
  it("runs the real syncpack against the fixture through codeDrift's own invocation and gets a parseable result, not crashed", async () => {
    const fixture = path.resolve(PACKAGE_DIR, "../../fixtures/next-supabase-mono");
    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-observe-test-"));
    try {
      const result = await codeDrift(fixture, {
        rows: [],
        bodyConfig: { class: "next-supabase-mono", tailwind: { entryPoint: "apps/web/src/app/globals.css" } },
        samples: {},
        bodyEffective: {},
        tools: ["syncpack"],
        scratchDir: scratch,
      });
      expect(result.syncpack).toBeTruthy();
      expect(result.syncpack.crashed).toBeFalsy();
      expect(typeof result.syncpack.mismatches).toBe("number");
    } finally {
      fs.rmSync(scratch, { recursive: true, force: true });
    }
  }, 30_000);
});

// C5: crash detection is status-aware for EVERY tool, not just the two whose parser happens to
// throw. Each of these tools exits non-zero on findings as well as on a crash, and each parser
// answers "no findings" when handed something that is not its report — so a panic, an OOM kill or
// a bad config used to be recorded as a clean run. One pair per tool: an empty-stream exit 2 is a
// crash; a real report at exit 1 is findings.
describe("codeDrift: a non-zero exit with no report is a crash, not a clean run", () => {
  const withScratch = async (fn) => {
    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-observe-crash-"));
    try {
      return await fn(scratch);
    } finally {
      fs.rmSync(scratch, { recursive: true, force: true });
    }
  };

  const drift = (tool, run, scratch) =>
    codeDrift(FAKE_BODY, { rows: [], bodyConfig: {}, samples: {}, bodyEffective: {}, tools: [tool], run, scratchDir: scratch });

  const CRASHED = { stdout: "", stderr: "", status: 2 };

  // The real report each tool writes when it really did find something, at its own exit code 1 and
  // on its own stream — measured shapes, the same ones the T1 stream tests above use.
  const REPORTS = {
    eslint: { run: () => ({ stdout: JSON.stringify([{ filePath: "a.ts", messages: [{ ruleId: "no-var" }] }]), stderr: "", status: 1 }), expect: (r) => expect(r.eslint.violations).toEqual({ "no-var": 1 }) },
    tsc: { run: () => ({ stdout: "apps/web/src/a.ts(1,1): error TS2307: Cannot find module.\n", stderr: "", status: 1 }), expect: (r) => expect(r.tsc).toEqual({ errors: { TS2307: 1 } }) },
    stylelint: { run: () => ({ stdout: "", stderr: JSON.stringify([{ warnings: [{}, {}] }]), status: 1 }), expect: (r) => expect(r.stylelint).toEqual({ count: 2 }) },
    cspell: { run: () => ({ stdout: "apps/web/src/a.ts:3:5 - Unknown word (teh)\n", stderr: "", status: 1 }), expect: (r) => expect(r.cspell).toEqual({ issues: 1 }) },
    "ls-lint": { run: () => ({ stdout: "", stderr: "apps/web/src/BadName.ts failed for `.ts` rules: kebabcase\n", status: 1 }), expect: (r) => expect(r["ls-lint"]).toEqual({ errors: 1 }) },
    syncpack: { run: () => ({ stdout: "", stderr: "\u2718 react 18.0.0 != 19.0.0\n", status: 1 }), expect: (r) => expect(r.syncpack).toEqual({ mismatches: 1 }) },
  };

  it.each(Object.keys(REPORTS))("%s: exit 2 with empty streams is crashed", async (tool) => {
    await withScratch(async (scratch) => {
      const result = await drift(tool, () => CRASHED, scratch);
      expect(result[tool].crashed, JSON.stringify(result[tool])).toBe(true);
      expect(result[tool].message).toContain(tool);
    });
  });

  it.each(Object.keys(REPORTS))("%s: a real report at exit 1 is findings", async (tool) => {
    await withScratch(async (scratch) => {
      const result = await drift(tool, REPORTS[tool].run, scratch);
      expect(result[tool].crashed, JSON.stringify(result[tool])).toBeUndefined();
      REPORTS[tool].expect(result);
    });
  });

  // jscpd is the one tool whose report is a FILE (-o), not a stream: the file is the evidence.
  it("jscpd: exit 2 with no report file written is crashed", async () => {
    await withScratch(async (scratch) => {
      const result = await drift("jscpd", () => CRASHED, scratch);
      expect(result.jscpd.crashed, JSON.stringify(result.jscpd)).toBe(true);
      expect(result.jscpd.message).toContain("jscpd");
    });
  });

  it("jscpd: a report file at exit 1 is findings", async () => {
    await withScratch(async (scratch) => {
      const run = () => {
        fs.writeFileSync(path.join(scratch, "jscpd-report.json"), JSON.stringify({ statistics: { total: { clones: 4 } } }));
        return { stdout: "", stderr: "", status: 1 };
      };
      const result = await drift("jscpd", run, scratch);
      expect(result.jscpd).toEqual({ clones: 4 });
    });
  });

  // The other direction: a clean run is a clean run, whatever its streams hold.
  it("reads exit 0 as clean for every tool", async () => {
    await withScratch(async (scratch) => {
      const result = await codeDrift(FAKE_BODY, {
        rows: [], bodyConfig: {}, samples: {}, bodyEffective: {},
        tools: ["eslint", "tsc", "stylelint", "cspell", "ls-lint", "syncpack"],
        run: () => ({ stdout: "", stderr: "", status: 0 }),
        scratchDir: scratch,
      });
      expect(Object.values(result).some((r) => r?.crashed)).toBe(false);
      expect(result.eslint.violations).toEqual({});
      expect(result.syncpack).toEqual({ mismatches: 0 });
    });
  });
});

// Minor: `apps packages scripts` is the class's shape, not every body's.
describe("codeDrift: eslint's sweep tolerates a directory the body does not have", () => {
  it("passes --no-error-on-unmatched-pattern", async () => {
    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-observe-unmatched-"));
    const calls = [];
    try {
      await codeDrift(FAKE_BODY, {
        rows: [], bodyConfig: {}, samples: {}, bodyEffective: {}, tools: ["eslint"],
        run: (command, args) => { calls.push(args); return { stdout: "[]", stderr: "", status: 0 }; },
        scratchDir: scratch,
      });
    } finally {
      fs.rmSync(scratch, { recursive: true, force: true });
    }
    const sweep = calls.find((a) => a.includes("apps") && a.includes("packages") && a.includes("scripts"));
    expect(sweep).toBeTruthy();
    expect(sweep).toContain("--no-error-on-unmatched-pattern");
  });
});

// C2/I5: `matches` is the third reader of a marker, and it used to ignore an attribute it did not
// understand exactly as the other two did.
describe("matches rejects an unknown marker attribute", () => {
  it("throws naming the attribute", () => {
    expect(() => matches({ a: 1 }, { $parameter: "x", base: "a" })).toThrow(/base/);
  });
});
```

```javascript
// packages/orrery/tests/observe-command.test.mjs
import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import observe, { pointerFailures } from "../src/commands/observe.mjs";

// Cross-platform, and its basename is literally "x" (what every assertion below expects the
// command to derive) — a hard-coded "Z:/..." string is not absolute on the Linux CI runner, and
// path.basename on it there would not give "x" the way it does on Windows.
const FAKE_BODY = path.resolve("x");

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
    const code = await observe([FAKE_BODY, "--report", report], fakeDeps());
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
    const code = await observe([FAKE_BODY, "--report", report], fakeDeps({ codeDrift: async () => ({ eslint: { mismatches: ["no-var: missing"], violations: { "react/x": 3 } } }) }));
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
    expect(await observe([FAKE_BODY, "--predict", "--report", report], deps)).toBe(0);
    expect(deps.writePrediction).toHaveBeenCalledWith("x", expect.objectContaining({ tightened: expect.any(Array), counts: { "no-var": 2 } }));
    fs.rmSync(report, { recursive: true, force: true });
    q.restore();
  });

  it("without a prediction and without --predict exits 1 saying so", async () => {
    const q = quiet();
    const report = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-obs-"));
    expect(await observe([FAKE_BODY, "--report", report], fakeDeps({ loadPrediction: () => null }))).toBe(1);
    expect(q.out()).toMatch(/no prediction for x; run with --predict/);
    fs.rmSync(report, { recursive: true, force: true });
    q.restore();
  });

  // F2: codeDrift catches a tool crash per tool (tested directly in observe-code.test.mjs); the
  // command must still surface it — fail the exit code, print which tool crashed and why, and
  // write the report regardless, with the other tools' results intact.
  it("exits 1 and still writes the report when a tool crashed, with the other tools' results present", async () => {
    const q = quiet();
    const report = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-obs-"));
    const code = await observe(
      [FAKE_BODY, "--report", report],
      fakeDeps({ codeDrift: async () => ({ eslint: { crashed: true, message: "boom" }, stylelint: { count: 0 } }) })
    );
    expect(code).toBe(1);
    expect(q.out()).toMatch(/x: eslint crashed: boom/);
    const files = fs.readdirSync(report);
    const reportFile = files.find((f) => f.endsWith("-tooling.json"));
    expect(reportFile).toBeTruthy();
    const written = JSON.parse(fs.readFileSync(path.join(report, reportFile), "utf8"));
    expect(written[0].code.eslint).toEqual({ crashed: true, message: "boom" });
    expect(written[0].code.stylelint).toEqual({ count: 0 });
    const md = fs.readFileSync(path.join(report, files.find((f) => f.endsWith("-tooling.md"))), "utf8");
    expect(md).toContain("eslint: crashed — boom");
    fs.rmSync(report, { recursive: true, force: true });
    q.restore();
  });

  // I1: pointer drift is drift. A body whose eslint.config.mjs no longer matches the template it
  // points at, whose eslint.local.mjs breaks the named-files rule, or whose orrery.config.mjs the
  // schema rejects, is a body that has drifted — the run must fail, not mention it in a report
  // nobody reads. `config: ["missing"]` alone stays a pass: that is a body before adoption.
  it("exits 1 when orrery.config.mjs is present but invalid", async () => {
    const q = quiet();
    const report = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-obs-"));
    const code = await observe([FAKE_BODY, "--report", report], fakeDeps({
      pointerDrift: async () => ({ files: [{ path: "eslint.config.mjs", state: "missing" }], local: [], config: ["unknown field nonsense"] }),
    }));
    expect(code).toBe(1);
    expect(q.out()).toMatch(/orrery\.config\.mjs is invalid: unknown field nonsense/);
    fs.rmSync(report, { recursive: true, force: true });
    q.restore();
  });

  it("exits 1 on any eslint.local.mjs violation", async () => {
    const q = quiet();
    const report = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-obs-"));
    const code = await observe([FAKE_BODY, "--report", report], fakeDeps({
      pointerDrift: async () => ({ files: [{ path: "eslint.config.mjs", state: "missing" }], local: ["entry 0: has no files; a local entry must name the files it applies to"], config: ["missing"] }),
    }));
    expect(code).toBe(1);
    expect(q.out()).toMatch(/eslint\.local\.mjs: entry 0/);
    fs.rmSync(report, { recursive: true, force: true });
    q.restore();
  });

  it("exits 1 on a pointer that differs once the body has any pointer file", async () => {
    const q = quiet();
    const report = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-obs-"));
    const code = await observe([FAKE_BODY, "--report", report], fakeDeps({
      pointerDrift: async () => ({ files: [{ path: "eslint.config.mjs", state: "identical" }, { path: "tsconfig.json", state: "differs" }], local: [], config: ["missing"] }),
    }));
    expect(code).toBe(1);
    expect(q.out()).toMatch(/tsconfig\.json differs from the template/);
    fs.rmSync(report, { recursive: true, force: true });
    q.restore();
  });

  // Both donors are pre-adoption bodies with an eslint.config.mjs and a .husky/pre-commit of their
  // own at exactly the template's paths: every pointer reads `differs`, none reads `identical`.
  // That is not drift, it is a body that has not adopted Orrery yet.
  it("does not fail a body with its own files at the template paths and no adopted pointer", async () => {
    const q = quiet();
    const report = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-obs-"));
    const code = await observe([FAKE_BODY, "--report", report], fakeDeps({
      pointerDrift: async () => ({ files: [{ path: "eslint.config.mjs", state: "differs" }, { path: ".husky/pre-commit", state: "differs" }, { path: "tsconfig.json", state: "missing" }], local: [], config: ["missing"] }),
    }));
    expect(code).toBe(0);
    fs.rmSync(report, { recursive: true, force: true });
    q.restore();
  });

  it("does not fail an un-adopted body whose pointer files are all simply missing", async () => {
    const q = quiet();
    const report = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-obs-"));
    const code = await observe([FAKE_BODY, "--report", report], fakeDeps({
      pointerDrift: async () => ({ files: [{ path: "eslint.config.mjs", state: "missing" }, { path: "tsconfig.json", state: "missing" }], local: [], config: ["missing"] }),
    }));
    expect(code).toBe(0);
    fs.rmSync(report, { recursive: true, force: true });
    q.restore();
  });

  // I2: a body's own config wins over the prediction's record of what it used to be.
  it("prefers the body's own orrery.config.mjs over the prediction's bodyConfig", async () => {
    const q = quiet();
    const body = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-body-"));
    const report = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-obs-"));
    fs.writeFileSync(path.join(body, "orrery.config.mjs"), 'export default { class: "next-supabase-mono", spelling: ["fromthebody"] };\n');
    let seen;
    const deps = fakeDeps({
      loadPrediction: () => ({ tightened: ["no-var"], counts: { "no-var": 2 }, bodyConfig: { class: "next-supabase-mono", spelling: ["fromtheprediction"] } }),
      codeDrift: async (dir, options) => { seen = options.bodyConfig; return { eslint: { mismatches: [], violations: { "no-var": 2 } } }; },
    });
    expect(await observe([body, "--report", report], deps)).toBe(0);
    expect(seen.spelling).toEqual(["fromthebody"]);
    fs.rmSync(report, { recursive: true, force: true });
    fs.rmSync(body, { recursive: true, force: true });
    q.restore();
  });

  it("records a failure to read the body's own effective config and fails the run", async () => {
    const q = quiet();
    const report = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-obs-"));
    const code = await observe([FAKE_BODY, "--report", report], fakeDeps({
      readEffectiveConfig: () => { throw new Error("eslint --print-config failed"); },
    }));
    expect(code).toBe(1);
    expect(q.out()).toMatch(/could not read the body's own effective config/);
    const files = fs.readdirSync(report);
    const written = JSON.parse(fs.readFileSync(path.join(report, files.find((f) => f.endsWith("-tooling.json"))), "utf8"));
    expect(written[0].bodyEffectiveError[0]).toContain("eslint --print-config failed");
    fs.rmSync(report, { recursive: true, force: true });
    q.restore();
  });
});

describe("pointerFailures", () => {
  it("treats an un-adopted body as no failure at all", () => {
    expect(pointerFailures({ files: [{ path: "a", state: "missing" }], local: [], config: ["missing"] })).toEqual([]);
    expect(pointerFailures({ files: [{ path: "a", state: "differs" }], local: [], config: ["missing"] })).toEqual([]);
  });
  it("names every kind of drift at once", () => {
    const failures = pointerFailures({
      files: [{ path: "a", state: "identical" }, { path: "b", state: "differs" }],
      local: ["entry 0: bad"],
      config: ["missing", "tailwind.entryPoint is required"],
    });
    expect(failures).toHaveLength(3);
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

// A real body's tree carries generated/build output the bundle itself never excludes (it is
// normally only ever run through lint-staged, against staged files — a bulk sweep never
// happens in real usage). observe's own violations pass is the one caller that walks the
// whole tree (`apps packages scripts`), and without this it tries to parse libra's `.next`
// webpack chunks — megabyte-sized generated JS — and OOMs the eslint child process. This is a
// scratch-invocation concern, not a rulings/bundle one: it never touches the generated bundle
// or rulings.json, only what observe's own materialised config additionally ignores.
const GLOBAL_IGNORES = ["**/.next/**", "**/.turbo/**", "**/dist/**", "**/build/**", "**/coverage/**", "**/out/**", "**/.vercel/**", "**/node_modules/**"];

// Emits a small subset of YAML: nested plain objects and arrays of strings, no quoting or
// folding. That is all any of the physics/class tool functions ever return (ls-lint's `{ ls: {
// pattern: { ext: rule } } }` shape), so a dependency for the full spec would be unused weight.
function toYaml(value, indent = "") {
  if (Array.isArray(value)) return value.map((v) => `${indent}- ${v}`).join("\n") + "\n";
  if (value && typeof value === "object") {
    return Object.entries(value)
      .map(([k, v]) => (v && typeof v === "object" ? `${indent}${k}:\n${toYaml(v, indent + "  ")}` : `${indent}${k}: ${v}`))
      .join("\n") + "\n";
  }
  return `${indent}${value}\n`;
}

// One materialised config per tool, in a scratch directory, importing the bundle by absolute
// `file://` URL and passing the body config plus the resolved `root`. Nothing is written into
// the body: every path here is under `scratchDir`.
export async function materialise(bodyDir, bodyConfig, scratchDir, { bundleDir, functions } = {}) {
  const bundle = posix(path.resolve(bundleDir));
  const klass = `${bundle}/classes/next-supabase-mono`;
  // Resolved to absolute, like bundleDir above: this becomes `tsconfigRootDir` in the
  // materialised eslint config's parserOptions, which typescript-eslint's project service needs
  // absolute to find the body's tsconfig — a relative root here silently fails to associate any
  // file with a TS project, which ESLint reports as a parse-level fatal error on every file that
  // needs type information, not as a config problem.
  const bodyRoot = posix(path.resolve(bodyDir));
  const fns = functions ?? {
    stylelint: (await import(pathToFileURL(`${klass}/stylelint.mjs`).href)).default,
    jscpd: (await import(pathToFileURL(`${klass}/jscpd.mjs`).href)).default,
    cspell: (await import(pathToFileURL(`${klass}/cspell.mjs`).href)).default,
    lsLint: (await import(pathToFileURL(`${bundle}/physics/ls-lint.mjs`).href)).default,
    syncpack: (await import(pathToFileURL(`${bundle}/physics/syncpack.mjs`).href)).default,
    tsconfigInclude: bodyConfig.tsconfig?.include?.length
      ? bodyConfig.tsconfig.include
      : ["apps/*/src", "apps/*/tests", "apps/*/e2e", "packages/*/src", "packages/*/tests"],
  };
  const body = { ...bodyConfig, root: bodyRoot };
  const write = (name, text) => {
    const f = path.join(scratchDir, name);
    fs.writeFileSync(f, text);
    return f;
  };
  return {
    eslint: write(
      "eslint.config.mjs",
      `import orrery from ${JSON.stringify(pathToFileURL(`${klass}/eslint.mjs`).href)};\n` +
        `const config = await orrery(${JSON.stringify(body, null, 2)});\n` +
        `export default [{ ignores: ${JSON.stringify(GLOBAL_IGNORES)} }, ...config];\n`
    ),
    tsconfig: write(
      "tsconfig.json",
      JSON.stringify(
        { extends: `${klass}/tsconfig.json`, include: fns.tsconfigInclude.map((i) => `${bodyRoot}/${i}`), compilerOptions: { noEmit: true } },
        null,
        2
      )
    ),
    stylelint: write("stylelint.config.mjs", `export default ${JSON.stringify(fns.stylelint(body), null, 2)};\n`),
    jscpd: write("jscpd.json", JSON.stringify(fns.jscpd(body), null, 2)),
    cspell: write("cspell.json", JSON.stringify(fns.cspell(body), null, 2)),
    lsLint: write(".ls-lint.yml", typeof fns.lsLint(body) === "string" ? fns.lsLint(body) : toYaml(fns.lsLint(body))),
    syncpack: write("syncpack.json", JSON.stringify(fns.syncpack(body), null, 2)),
  };
}
```

Amendments folded into the block above (previously undocumented drift from the landed source, plus this round's S3/S4 fixes):
- `GLOBAL_IGNORES` and the `export default [{ ignores: GLOBAL_IGNORES }, ...config]` wrapper (landed with Task 9 originally; never mirrored here until now) — without it, observe's whole-tree violations sweep tries to parse a real body's generated output (libra's `.next` webpack chunks OOM'd the eslint child process).
- S3 (this round): `tsconfigInclude`'s default widened from `["apps/*/src", "packages/*/src"]` to `["apps/*/src", "apps/*/tests", "apps/*/e2e", "packages/*/src", "packages/*/tests"]`, matching the template's own `tsconfig.json` include list.

```javascript
// packages/orrery/src/lib/observe/code.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import prettierConfig from "eslint-config-prettier";
import { optionsOf, severityOf } from "../reconcile/ordering.mjs";
import { readEffectiveConfig, resolveEslintBin } from "../effective-config.mjs";
import { materialise } from "./scratch.mjs";
import { assertMarker } from "../markers.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(here, "../../..");

// Reads the executable a package's own package.json advertises, rather than hard-coding a
// relative path: those paths are not consistent across packages (stylelint's is
// "bin/stylelint.mjs", syncpack's is "./index.cjs", @ls-lint/ls-lint's bin key is the short
// "ls-lint", not its scoped package name) and drift with every dependency bump. Found directly
// under packages/orrery/node_modules — Orrery's own tools, per the observe ruling — rather than
// through Node's resolver: some of these packages' "exports" maps do not expose "./package.json"
// as a subpath at all, which createRequire(...).resolve refuses outright.
export function binField(pkg, binName = pkg) {
  const manifestPath = path.join(packageDir, "node_modules", pkg, "package.json");
  if (!fs.existsSync(manifestPath)) throw new Error(`${pkg} is not installed in ${packageDir}; run pnpm install there first`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const short = pkg.includes("/") ? pkg.slice(pkg.lastIndexOf("/") + 1) : pkg;
  const rel =
    typeof manifest.bin === "string"
      ? manifest.bin
      : (manifest.bin?.[binName] ?? manifest.bin?.[short] ?? manifest.bin?.[manifest.name] ?? Object.values(manifest.bin ?? {})[0]);
  if (!rel) throw new Error(`${pkg} has no bin entry in ${manifestPath}`);
  return path.join(path.dirname(manifestPath), rel);
}

// eslint-config-prettier's own rules are appended last, unconditionally (no `files` filter), by
// design — it is meant to win over any earlier config for the formatting rules it lists,
// regardless of tier. A rule the rulings named as active but that also appears in this list can
// never actually fire; the only honest expectation for it is that it really is "off" in the
// effective config.
const prettierOffKeys = new Set(Object.keys(prettierConfig.rules));

const read = (body, dotted) => dotted.split(".").reduce((o, k) => o?.[k], body);

// C2/I5: `assertMarker` rejects a marker attribute nobody implements. This function and `matches`
// below are two of the three readers that used to drop `base: "a"` in silence, which is how the
// class shipped a boundaries policy with no base and every check agreed with it.
function resolveParameters(value, body) {
  if (Array.isArray(value)) {
    return value.flatMap((v) => {
      assertMarker(v);
      return v && typeof v === "object" && !Array.isArray(v) && "$parameter" in v ? (read(body, v.$parameter) ?? []) : [resolveParameters(v, body)];
    });
  }
  if (value && typeof value === "object") {
    assertMarker(value);
    return "$parameter" in value ? read(body, value.$parameter) : Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolveParameters(v, body)]));
  }
  return value;
}

// Canonical (key-order-independent) JSON, for readable mismatch messages only: ESLint's own
// effective config and the ruling's `chosen` value are semantically the same object with the
// keys inserted in different orders.
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, v]) => [k, canonical(v)]));
  }
  return value;
}
const norm = (v) => JSON.stringify(canonical([severityOf(v), ...optionsOf(v)]));

// `want` matches `actual` when every key/value `want` names is present in `actual`
// (recursively), order-independent; `actual` may carry additional keys `want` does not mention.
// That slack is real, not a loophole: a rule's own JSON-schema can fill in a default the ruling
// never had to spell out once ESLint validates the option object, so the fully-resolved `actual`
// is a superset of the minimal `chosen` literal by construction, not by the bundle misrendering
// the ruling.
export function matches(actual, want) {
  if (Array.isArray(want)) return Array.isArray(actual) && actual.length === want.length && want.every((w, i) => matches(actual[i], w));
  if (want && typeof want === "object") {
    assertMarker(want);
    return !!actual && typeof actual === "object" && !Array.isArray(actual) && Object.entries(want).every(([k, v]) => matches(actual[k], v));
  }
  return Object.is(actual, want);
}

// What the bundle actually renders for a ruled rule, given the body: an eslint-config-prettier
// key is always "off" in the real effective config regardless of what `chosen` says — the
// prettier block is appended last, with no `files` filter, so it always wins that rule, options
// and all: the options an earlier tier set do not necessarily clear just because the severity
// does, so only severity is checked for these keys, never options. Every comparison against
// "what the bundle produces" — the honesty check against a real effective config, and observe's
// own "did the bundle tighten this rule" check against a body's own pre-bundle effective
// config — must agree on that carve-out, or they drift apart. (They did: see `tightenedFor`
// below — S4.)
function ruledValueMatches(actualValue, row, body) {
  if (actualValue === undefined) return false;
  if (prettierOffKeys.has(row.key)) return severityOf(actualValue) === "off";
  const want = resolveParameters(row.chosen, body);
  return severityOf(actualValue) === severityOf(want) && matches(optionsOf(actualValue), optionsOf(want));
}

// The honesty comparison (originally in tests/bundle-honesty.test.mjs): every rule the rulings
// name for this surface must be present in the effective config with the ruled value (or, for a
// rule eslint-config-prettier always turns off, must actually be off); every other rule the
// effective config carries must be off, or it is an undisclosed extra.
export function effectiveMismatches(effectiveRules, rows, surface, body) {
  const out = [];
  const expected = rows.filter((r) => r.tool === "eslint" && r.surface === surface && r.chosen !== null && r.tier);
  const named = new Set();
  for (const r of expected) {
    named.add(r.key);
    const actual = effectiveRules[r.key];
    if (actual === undefined) { out.push(`${r.key}: missing`); continue; }
    if (!ruledValueMatches(actual, r, body)) {
      if (prettierOffKeys.has(r.key)) out.push(`${r.key}: got ${norm(actual)} want ["off"] (eslint-config-prettier always wins this rule)`);
      else out.push(`${r.key}: got ${norm(actual)} want ${norm(resolveParameters(r.chosen, body))}`);
    }
  }
  for (const [key, value] of Object.entries(effectiveRules)) if (!named.has(key) && severityOf(value) !== "off") out.push(`${key}: not in the rulings and not off`);
  return out;
}

export function violationsByRule(eslintJson) {
  const counts = {};
  for (const file of JSON.parse(eslintJson)) for (const m of file.messages) { const k = m.ruleId ?? "(fatal)"; counts[k] = (counts[k] ?? 0) + 1; }
  return Object.fromEntries(Object.entries(counts).sort(([x], [y]) => (x < y ? -1 : 1)));
}

// A rule with violations that the prediction did not `tighten` is either `baseline` (already
// known at or below the count `--predict` last recorded — informational, not a failure) or
// `unexplained` (absent from the prediction entirely, or worse than what was recorded — a defect
// in Orrery or a body that is not clean under its own config). Count changes on an
// already-tightened rule are `moved`, informational. A tightened rule the prediction never saw
// before is `new`. A tightened rule with zero violations now is `resolved`: the body fixed it, or
// it never fired.
export function compareToPrediction(observed, prediction) {
  const tightened = new Set(prediction.tightened);
  const baseline = [];
  const unexplained = [];
  for (const [rule, n] of Object.entries(observed)) {
    if (rule === "(fatal)" || tightened.has(rule)) continue;
    const predicted = prediction.counts[rule];
    (predicted === undefined || n > predicted ? unexplained : baseline).push(rule);
  }
  const moved = Object.entries(observed)
    .filter(([r, n]) => prediction.counts[r] !== undefined && prediction.counts[r] !== n)
    .map(([r, n]) => ({ rule: r, was: prediction.counts[r], now: n }));
  const newRules = Object.keys(observed).filter((r) => tightened.has(r) && prediction.counts[r] === undefined);
  const resolved = prediction.tightened.filter((r) => observed[r] === undefined);
  return { unexplained, baseline, moved, newRules, resolved };
}

// Which rules the bundle tightens for this body: every ruled rule whose value differs from what
// the body's own effective config has for that surface (or that the body lacks entirely) — the
// same `ruledValueMatches` effectiveMismatches uses against a real effective config. A rule
// eslint-config-prettier always turns off is excluded outright, not compared:
// its real effective value is always "off" regardless of `chosen` or of the body's own value, so
// it can never contribute a new violation the bundle didn't already produce — reporting it
// "tightened" was always spurious, however the body's own pre-bundle value happened to compare.
//
// T4b: a `boundaries/*` rule can carry an identical `chosen` value (severity + options) on both
// sides and still behave differently, because boundaries rules read `settings["boundaries/elements"]`
// — not the rule's own options — to know what an "element" is. `classEffectiveBySurface` is the
// class bundle's own real effective config per surface (the same `readEffectiveConfig` call
// `codeDrift`'s eslint pass already makes against the materialised scratch config, threaded
// through here rather than recomputed); a body whose own `boundaries/elements` setting differs
// from the class's — canonicalised, so key order never matters — is tightened for every
// `boundaries/*` rule even when the rule value itself already matched.
export function tightenedFor(rows, bodyEffectiveBySurface, body, classEffectiveBySurface = {}) {
  const out = new Set();
  for (const r of rows) {
    if (r.tool !== "eslint" || r.chosen === null || !r.tier || prettierOffKeys.has(r.key)) continue;
    const own = bodyEffectiveBySurface[r.surface]?.rules?.[r.key];
    if (!ruledValueMatches(own, r, body)) { out.add(r.key); continue; }
    if (r.key.startsWith("boundaries/")) {
      const classElements = JSON.stringify(canonical(classEffectiveBySurface[r.surface]?.settings?.["boundaries/elements"]));
      const ownElements = JSON.stringify(canonical(bodyEffectiveBySurface[r.surface]?.settings?.["boundaries/elements"]));
      if (classElements !== ownElements) out.add(r.key);
    }
  }
  return [...out].sort();
}

// T1: every tool here exits non-zero on findings (not just on a real crash), and which stream
// carries the report is a per-tool fact, not a universal one — measured against the installed
// binaries (see code.mjs's callers below and the report this fix shipped with): eslint, tsc,
// jscpd and cspell write to stdout; stylelint, ls-lint and syncpack write to stderr, even on a
// clean, zero-exit run. `defaultRun` no longer picks a stream itself (execFileSync's old
// stdout-only catch silently dropped every stylelint/ls-lint finding into a "crashed" report,
// since neither ever had anything on stdout to fall back to) — it hands the caller both streams
// plus the exit status and lets each tool's own attempt block read the one that is actually its
// report. `spawnSync` never throws on a non-zero exit (only on a real spawn failure, e.g. a
// missing binary), so a genuine crash is: `result.error` (thrown here), or a tool's own parser
// failing to make sense of the stream it reads (JSON.parse throwing on a panic trace, for
// instance) — `attempt` below still catches either as `{ crashed: true, message }`.
function defaultRun(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  if (result.error) throw result.error;
  return { stdout: result.stdout ?? "", stderr: result.stderr ?? "", status: result.status };
}

// Runs Orrery's own tool binaries — never the body's — against the body, read-only: `cwd` is the
// body directory, every `--config`/`-c` points into `scratchDir`. The ruling made in planning is
// that this proves the bundle against the plugins it actually ships, which is exactly a body's
// situation after adoption (the plugins live in Orrery's devDependencies, not the body's).
// syncpack is the one exception (T2): its installed binary panics on `--config` whenever there is
// real work to do, on every version tried, so it runs against whatever config the body's own root
// discovers (its own `.syncpackrc*` if it has one, syncpack's built-in defaults if it does not) —
// the same invocation both donors' own `package.json` scripts use, not the class-rendered one.
//
// Every tool runs inside its own try/catch: observe's job is to report drift across every tool
// and every body, and a single tool crashing (a bad rule config, a missing binary, a body file
// eslint chokes on) must not take the rest of the run down with it. A caught failure becomes
// `{ crashed: true, message }` for that tool's entry — the caller (the observe command) is the
// one that prints it and fails the run, since it is the one that knows which body this was.
// C5: every tool here exits non-zero on FINDINGS as well as on a crash, so the exit status alone
// cannot tell the two apart — and every parser here answers "no findings" when handed something
// that is not its report at all (a panic trace, an empty stream after an OOM), which observe then
// recorded as a clean run. Six of the seven tools read that way.
//
// The rule, per tool: status 0 is a clean run and its report — empty or not — is parsed as it
// stands. A non-zero status is findings ONLY if the tool's own stream really carries its own
// report: it parses, and `evidence` recognises at least one finding in it. Anything else throws,
// and `attempt` turns that into `{ crashed: true, message }` for that tool's entry.
function statusAware(tool, result, { stream, parse, evidence }) {
  const text = result?.[stream] ?? "";
  if (result?.status === 0) return parse(text);
  let parsed;
  try {
    parsed = parse(text);
  } catch (error) {
    throw new Error(`${tool} exited ${result?.status} and its ${stream} is not a ${tool} report: ${error.message}`);
  }
  if (!evidence(text, parsed)) {
    throw new Error(`${tool} exited ${result?.status} with no findings on its ${stream}; that is a crash, not a report`);
  }
  return parsed;
}

function attempt(results, tool, fn) {
  try {
    results[tool] = fn();
  } catch (error) {
    results[tool] = { crashed: true, message: error.message };
  }
}

export async function codeDrift(bodyDir, { rows, bodyConfig, samples, bodyEffective, tools = ["eslint", "tsc", "stylelint", "jscpd", "cspell", "ls-lint", "syncpack"], run = defaultRun, exec, scratchDir }) {
  // Only clean up a scratch directory this call created itself: a caller that passed its own
  // scratchDir may still want it afterward (tests inspect its files).
  const ownScratch = scratchDir === undefined;
  const dir = scratchDir ?? fs.mkdtempSync(path.join(os.tmpdir(), "orrery-observe-"));
  try {
    const files = await materialise(bodyDir, bodyConfig, dir, { bundleDir: packageDir });
    const results = {};
    const node = process.execPath;

    if (tools.includes("eslint")) {
      attempt(results, "eslint", () => {
        // Orrery's own eslint, resolved from packages/orrery — never the body's — per the
        // planning ruling: this is the one binary the rulings and the honesty comparison are
        // measured against, so it is resolved the mandated way (resolveEslintBin), not through
        // the generic binField used for the other tools below.
        const eslintBin = resolveEslintBin(packageDir);
        // eslint's own report — --print-config here, -f json below — is on stdout (measured
        // against the installed binary; see this fix's report).
        const execWithScratch = exec ?? ((execDir, file) => run(node, [eslintBin, "-c", files.eslint, "--no-config-lookup", "--print-config", file], execDir).stdout);
        const mismatches = [];
        const classEffective = {};
        for (const [surface, file] of Object.entries(samples)) {
          const effective = readEffectiveConfig(bodyDir, file, execWithScratch);
          classEffective[surface] = effective;
          mismatches.push(...effectiveMismatches(effective.rules ?? {}, rows, surface, bodyConfig).map((m) => `${surface} ${m}`));
        }
        // Type-aware linting loads the body's whole TypeScript program into memory; a real
        // monorepo (libra: ~1,100 source files) can exceed Node's default old-space ceiling
        // during this one full-tree sweep (found running this against libra: an OOM crash, not
        // a lint finding). The per-surface --print-config calls above are single small files
        // and do not need it.
        // Minor: `apps packages scripts` is the class's shape, not every body's — a body with no
        // scripts/ directory is not an error, it is a body with no scripts.
        const result = run(node, ["--max-old-space-size=6144", eslintBin, "-c", files.eslint, "--no-config-lookup", "--no-error-on-unmatched-pattern", "-f", "json", "apps", "packages", "scripts"], bodyDir);
        const violations = statusAware("eslint", result, {
          stream: "stdout",
          parse: (text) => violationsByRule(text || "[]"),
          evidence: (text, counts) => Object.keys(counts).length > 0,
        });
        return { mismatches, violations, tightened: tightenedFor(rows, bodyEffective ?? {}, bodyConfig, classEffective) };
      });
    }

    if (tools.includes("tsc")) {
      attempt(results, "tsc", () => {
        // tsc's own report is on stdout.
        const result = run(node, [binField("typescript", "tsc"), "-p", files.tsconfig, "--pretty", "false"], bodyDir);
        const errors = statusAware("tsc", result, {
          stream: "stdout",
          parse: (text) => {
            const counts = {};
            for (const m of text.matchAll(/error (TS\d+):/g)) counts[m[1]] = (counts[m[1]] ?? 0) + 1;
            return counts;
          },
          evidence: (text, counts) => Object.keys(counts).length > 0,
        });
        return { errors };
      });
    }

    if (tools.includes("stylelint")) {
      attempt(results, "stylelint", () => {
        // The installed stylelint (packages/orrery/node_modules/stylelint) writes its `-f json`
        // report to stderr, even on a clean, zero-exit run — never stdout. The old stdout-only
        // read silently turned every real stylelint finding into a false "crashed".
        const result = run(node, [binField("stylelint"), "--config", files.stylelint, "-f", "json", "**/*.css"], bodyDir);
        return {
          count: statusAware("stylelint", result, {
            stream: "stderr",
            parse: (text) => JSON.parse(text || "[]").reduce((n, f) => n + f.warnings.length, 0),
            evidence: (text, count) => count > 0,
          }),
        };
      });
    }

    if (tools.includes("jscpd")) {
      attempt(results, "jscpd", () => {
        // jscpd's own report is the file it writes via -o; the console text run() returns is
        // only ever used to prove the process itself didn't crash.
        const result = run(node, [binField("jscpd"), "-c", files.jscpd, "-r", "json", "-o", dir, "."], bodyDir);
        const reportFile = path.join(dir, "jscpd-report.json");
        // jscpd's own report is the file it writes via -o, so that file IS the evidence: a
        // non-zero exit with no report written is a crash, not a duplication finding.
        return {
          clones: statusAware("jscpd", result, {
            stream: "stdout",
            parse: () => (fs.existsSync(reportFile) ? (JSON.parse(fs.readFileSync(reportFile, "utf8")).statistics?.total?.clones ?? 0) : 0),
            evidence: () => fs.existsSync(reportFile),
          }),
        };
      });
    }

    if (tools.includes("cspell")) {
      attempt(results, "cspell", () => {
        // cspell's own report is on stdout.
        const result = run(node, [binField("cspell"), "lint", "-c", files.cspell, "--no-progress", "--no-summary", "**/*.{ts,tsx,md}"], bodyDir);
        return {
          issues: statusAware("cspell", result, {
            stream: "stdout",
            parse: (text) => text.split(/\r?\n/).filter((l) => /:\d+:\d+ - /.test(l)).length,
            evidence: (text, issues) => issues > 0,
          }),
        };
      });
    }

    if (tools.includes("ls-lint")) {
      attempt(results, "ls-lint", () => {
        // The installed @ls-lint/ls-lint writes its findings to stderr ("<path> failed for
        // `<ext>` rules: <rule>", one per line — no hyphen in the rule name despite the rule
        // being configured as "kebab-case"), not stdout; matched against "failed for" rather
        // than a specific rule name so any rule this config ever turns on is counted, not just
        // kebab-case.
        const result = run(node, [binField("@ls-lint/ls-lint", "ls-lint"), "-config", files.lsLint], bodyDir);
        return {
          errors: statusAware("ls-lint", result, {
            stream: "stderr",
            parse: (text) => text.split(/\r?\n/).filter((l) => l.includes("failed for")).length,
            evidence: (text, errors) => errors > 0,
          }),
        };
      });
    }

    if (tools.includes("syncpack")) {
      attempt(results, "syncpack", () => {
        // T2: the installed syncpack (a Rust binary wrapped by a thin Node launcher — packages/
        // orrery/node_modules/syncpack) panics with a clap arg-definition mismatch ("Mismatch
        // between definition and access of `config`") whenever --config is combined with any
        // invocation that actually has a package.json to process — reproduced on both the
        // installed 14.3.1 and a from-npm 15.3.3, with a trivial config and with the real
        // rendered one, so no --config shape works and no version fixes it (see this fix's
        // report). Both donors' own package.json scripts invoke it the same way this now does:
        // plain `syncpack lint`, cwd at the body's own root, config found by cosmiconfig-style
        // discovery from there. The report — real findings and the clean "no issues" banner
        // alike — is on stderr.
        const result = run(node, [binField("syncpack"), "lint"], bodyDir);
        return {
          mismatches: statusAware("syncpack", result, {
            stream: "stderr",
            parse: (text) => (text.match(/✘/g) ?? []).length,
            evidence: (text, mismatches) => mismatches > 0,
          }),
        };
      });
    }

    return results;
  } finally {
    if (ownScratch) fs.rmSync(dir, { recursive: true, force: true });
  }
}
```

`binField(pkg, binName)` (in `code.mjs`) reads each package's real `bin` field from its `package.json` under `packages/orrery/node_modules/<pkg>/` — not `createRequire(...).resolve`, which `jscpd` and `cspell` both refuse for `./package.json` (their `exports` maps don't expose it) — used for every tool except eslint. eslint itself is resolved via `resolveEslintBin` (`../effective-config.mjs`), from the `packages/orrery` directory: it is the one binary the rulings and the honesty comparison are measured against, so it gets the mandated resolver, not the generic one. Every tool block in `codeDrift` runs inside its own try/catch (`attempt`): a crash becomes `{ crashed: true, message }` for that tool's entry instead of aborting the run; `observe.mjs` prints `<body>: <tool> crashed: <message>`, fails the exit code, and still writes the report (`report.mjs` renders a crashed entry as `- <tool>: crashed — <message>`). A `scratchDir` `codeDrift` creates for itself (none passed in) is removed in a `finally`; one the caller passed stays, since the caller may still want to inspect it.

Amendments folded into the `code.mjs` block above (previously undocumented drift from the landed source, plus this round's S4 fix):
- The `--max-old-space-size=6144` argument on the whole-tree violations sweep's node invocation (landed with Task 9 originally; never mirrored here until now) — type-aware linting loads the body's entire TypeScript program into memory, and libra's ~1,100 source files exceeded Node's default old-space ceiling and OOM'd the child process. The per-surface `--print-config` calls are unaffected (single small files) and do not carry the flag.
- S4 (this round): `tightenedFor` used to compare a body's own pre-bundle rule value straight against `chosen` (`norm(own) !== norm(resolveParameters(r.chosen, body))`), not the ruled-value comparison `effectiveMismatches` uses. That meant a rule eslint-config-prettier always turns off — whose real effective value in the bundle is always `"off"`, never `chosen` — was reported "tightened" whenever a body's own value for it merely differed from `chosen` (seven such rules, observed against libra). `ruledValueMatches` is now the one comparison both functions call; `tightenedFor` also excludes `prettierOffKeys` outright rather than comparing against them, since an always-off rule can never contribute a new violation regardless of what the body's own value happens to be.

```javascript
// packages/orrery/src/lib/observe/report.mjs
// One markdown document per observation run, with a section per body.
export function renderObservation(results, date) {
  const lines = [`# Tooling observation — ${date}`, ""];
  for (const r of results) {
    lines.push(`## ${r.name} (${r.dir}${r.sha ? ` @ ${r.sha}` : ""})`, "");
    lines.push(`- version: ${r.version.note}`);
    lines.push(
      `- pointers: ${r.pointers.files.filter((f) => f.state === "identical").length} identical, ${r.pointers.files.filter((f) => f.state === "differs").length} differ, ${r.pointers.files.filter((f) => f.state === "missing").length} missing; local ${r.pointers.local.length} violation(s); config ${r.pointers.config.join(", ") || "valid"}`
    );
    if (r.code?.eslint?.crashed) {
      lines.push(`- eslint: crashed — ${r.code.eslint.message}`);
    } else if (r.code?.eslint) {
      lines.push(`- eslint effective config: ${r.code.eslint.mismatches.length === 0 ? "matches the rulings on every surface" : `${r.code.eslint.mismatches.length} mismatch(es)`}`);
      lines.push("", "| rule | violations |", "|---|---|");
      for (const [rule, n] of Object.entries(r.code.eslint.violations)) lines.push(`| ${rule} | ${n} |`);
      if (r.comparison) {
        lines.push(
          "",
          `unexplained: ${r.comparison.unexplained.join(", ") || "none"}; baseline: ${r.comparison.baseline.join(", ") || "none"}; moved: ${r.comparison.moved.map((m) => `${m.rule} ${m.was}→${m.now}`).join(", ") || "none"}; new: ${r.comparison.newRules.join(", ") || "none"}; resolved: ${r.comparison.resolved.join(", ") || "none"}`
        );
      }
    }
    for (const tool of ["tsc", "stylelint", "jscpd", "cspell", "ls-lint", "syncpack"]) {
      if (!r.code?.[tool]) continue;
      lines.push(r.code[tool].crashed ? `- ${tool}: crashed — ${r.code[tool].message}` : `- ${tool}: ${JSON.stringify(r.code[tool])}`);
    }
    if (r.code?.eslint?.mismatches?.length) {
      lines.push("", "### eslint mismatches", "");
      for (const m of r.code.eslint.mismatches) lines.push(`- ${m}`);
    }
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
  loadPrediction: (name) => {
    const f = path.join(repoRoot, "docs/predictions", `${name}.json`);
    return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : null;
  },
  writePrediction: (name, prediction) => {
    const dir = path.join(repoRoot, "docs/predictions");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(prediction, null, 2) + "\n");
  },
  today: () => new Date().toISOString().slice(0, 10),
};

// I2: a body that HAS an orrery.config.mjs is governed by it, full stop. The prediction's
// `bodyConfig` is a record of what a body's parameters were when the prediction was taken —
// useful before adoption, when the body has no config of its own, and wrong the moment it does:
// observing a body against parameters it no longer holds proves nothing about the body.
// Before adoption the order is: the prediction's recorded parameters, else the schema defaults
// with a placeholder tailwind entry point good enough to run the bundle against.
async function resolveBodyConfig(bodyDir, prediction) {
  const configFile = path.join(bodyDir, "orrery.config.mjs");
  if (fs.existsSync(configFile)) return { config: (await loadBodyConfig(bodyDir)).config, source: "the body's own orrery.config.mjs" };
  if (prediction?.bodyConfig) return { config: prediction.bodyConfig, source: "the prediction's recorded bodyConfig" };
  return { config: { class: "next-supabase-mono", tailwind: { entryPoint: "apps/*/src/app/globals.css" } }, source: "the schema defaults" };
}

// I1: a pointer file that a body has but that no longer matches the template, a local override
// that breaks the "named files only" rule, and an orrery.config.mjs the schema rejects are all
// drift the run must FAIL on, not merely mention in the report. The one state that is not a
// failure is `["missing"]` — a body before adoption has no config of its own and no pointer files
// yet, and observing it is exactly what `--predict` is for. A `differs` only counts once the body
// has at least one pointer file the template actually placed there, which is what separates "has
// not adopted Orrery" from "adopted Orrery and drifted": a body before adoption has an
// eslint.config.mjs and a .husky/pre-commit of its very own, at exactly the paths the templates
// use, and every one of them reads as `differs` — measured against both donors, where nothing is
// `identical` at all. One identical pointer is the evidence that the body was adopted, and from
// then on a pointer that stops matching is drift the run must fail on. The remaining hole is small
// and deliberate: a body that drifts EVERY pointer at once reads as un-adopted again.
export function pointerFailures(pointers) {
  const failures = [];
  const config = pointers?.config ?? [];
  const configErrors = config.filter((e) => e !== "missing");
  if (configErrors.length > 0) failures.push(`orrery.config.mjs is invalid: ${configErrors.join("; ")}`);
  for (const violation of pointers?.local ?? []) failures.push(`eslint.local.mjs: ${violation}`);
  const files = pointers?.files ?? [];
  if (files.some((f) => f.state === "identical")) {
    for (const f of files.filter((f) => f.state === "differs")) failures.push(`${f.path} differs from the template it points at`);
  }
  return failures;
}

export default async function observe(argv, deps = {}) {
  const d = { ...defaults, ...deps };
  let values, positionals;
  try {
    ({ values, positionals } = parseArgs({
      args: argv,
      options: {
        predict: { type: "boolean", default: false },
        report: { type: "string", default: path.join(repoRoot, "docs/observations") },
        tools: { type: "string" },
        surface: { type: "string" },
      },
      allowPositionals: true,
    }));
  } catch (error) {
    console.error(`${error.message}\n${USAGE}`);
    return 2;
  }
  if (positionals.length === 0) {
    console.error(USAGE);
    return 2;
  }

  const rulings = d.loadRulings();
  const templates = path.join(repoRoot, "packages/orrery/templates/next-supabase-mono");
  const results = [];
  let failed = false;

  for (const bodyDir of positionals) {
    const name = path.basename(bodyDir).toLowerCase();
    let sha = null;
    try {
      sha = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: bodyDir, encoding: "utf8" }).trim();
    } catch {
      // Not a git checkout (e.g. a test fixture path) — sha stays null.
    }

    const version = d.versionDrift(bodyDir);
    const pointers = await d.pointerDrift(bodyDir, templates, schema);

    const prediction = d.loadPrediction(name);
    const resolved = await resolveBodyConfig(bodyDir, prediction);
    const bodyConfig = withDefaults(resolved.config, schema);

    const pointerProblems = pointerFailures(pointers);
    if (pointerProblems.length > 0) {
      failed = true;
      console.error(`${name}: pointer drift:\n  ${pointerProblems.join("\n  ")}`);
    }

    const samples = values.surface
      ? Object.fromEntries(Object.entries(d.findSurfaceSamples(bodyDir)).filter(([s]) => s === values.surface))
      : d.findSurfaceSamples(bodyDir);

    // I2: the body's own effective config is what "did the bundle tighten this rule" is measured
    // against. Swallowing a failure to read it and substituting `{ rules: {} }` does not degrade
    // gracefully — it reports every ruled rule as tightened, which reads as a clean run with a
    // large prediction, so the failure disappears into a number nobody can check.
    const bodyEffective = {};
    const bodyEffectiveError = [];
    for (const [surface, file] of Object.entries(samples)) {
      try {
        bodyEffective[surface] = d.readEffectiveConfig(bodyDir, file);
      } catch (error) {
        bodyEffective[surface] = { rules: {} };
        bodyEffectiveError.push(`${surface} (${file}): ${error.message}`);
      }
    }
    if (bodyEffectiveError.length > 0) {
      failed = true;
      console.error(`${name}: could not read the body's own effective config:\n  ${bodyEffectiveError.join("\n  ")}`);
    }

    const code = await d.codeDrift(bodyDir, { rows: rulings.rows, bodyConfig, samples, bodyEffective, tools: values.tools?.split(",") });
    const entry = { name, dir: bodyDir, sha, version, pointers, code, bodyConfigSource: resolved.source, ...(bodyEffectiveError.length ? { bodyEffectiveError } : {}) };

    // A tool crashing (codeDrift catches per tool) never aborts the run: report it, fail the
    // exit code, and keep going — the report below is written regardless, crash included.
    for (const [tool, result] of Object.entries(code)) {
      if (result?.crashed) {
        failed = true;
        console.error(`${name}: ${tool} crashed: ${result.message}`);
      }
    }

    if (values.predict) {
      const tightened = code.eslint?.tightened ?? [];
      const counts = code.eslint?.violations ?? {};
      // T4a: everything violated but not tightened is recorded as this run's baseline —
      // informational, not a failure — so a later, non-predict run can tell "already known, no
      // worse than this" (baseline) from "new, or got worse" (unexplained).
      const tightenedSet = new Set(tightened);
      const baseline = Object.fromEntries(Object.entries(counts).filter(([r]) => r !== "(fatal)" && !tightenedSet.has(r)));
      d.writePrediction(name, {
        body: name,
        sha,
        generatedAt: d.today(),
        bodyConfig,
        tightened,
        counts,
        baseline,
        tools: Object.fromEntries(Object.entries(code).filter(([t]) => t !== "eslint")),
      });
      console.log(`${name}: prediction written`);
    } else if (!prediction) {
      console.error(`${name}: no prediction for ${name}; run with --predict to record one`);
      failed = true;
    } else if (code.eslint && !code.eslint.crashed) {
      entry.comparison = compareToPrediction(code.eslint.violations, prediction);
      if (code.eslint.mismatches.length) {
        failed = true;
        console.error(`${name}: eslint effective config mismatch(es):\n  ${code.eslint.mismatches.join("\n  ")}`);
      }
      if (entry.comparison.unexplained.length) {
        failed = true;
        console.error(`${name}: unexplained violations from rules the rulings did not tighten: ${entry.comparison.unexplained.join(", ")}`);
      }
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
Expected: PASS — 5 + 5 tests. As implemented, `observe-code.test.mjs` grew a `codeDrift`
describe block (F1/F2/the scratch-dir-cleanup minor) and two more `materialise` cases (F4's
relative-`bodyDir` regression, and the real-`physics/ls-lint.mjs` YAML minor) — 17 tests total
— and `observe-command.test.mjs` grew a crash-surfacing case — 6 total. `tests/bundle-honesty.test.mjs`
(Task 7) is amended in the same commit to call `effectiveMismatches` from `code.mjs` instead of
duplicating the comparison — one comparison, not two — with no change in its own case count (650).

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

T1/T2/T4 amendment (this round — `fix/observe-streams-surfaces-and-baseline`, corner report at `.superpowers/sdd/2026-09-09-phase-2b-reconciliation/corner-observe-fixes-report.md`): the first full-tool `observe` run against both real donors (task-10-report.md) found three tool crashes and two semantic gaps this task fixes.

**T1 — `defaultRun` returns streams, not a string.** `execFileSync`'s stdout-only catch (`if (typeof error.stdout === "string" && error.stdout.length) return error.stdout; throw error;`) assumed every tool's report lands on stdout. Measured against the installed binaries (real runs, not documentation): eslint, tsc, jscpd and cspell write their report to stdout; **stylelint and `@ls-lint/ls-lint` write to stderr, even on a clean, zero-exit run** — the old code turned every real stylelint/ls-lint finding into a false `{ crashed: true }`. `defaultRun` now uses `spawnSync` (which never throws on a non-zero exit, only on a real spawn failure) and returns `{ stdout, stderr, status }` unconditionally; each tool's `attempt` block reads the one stream that is actually its report — eslint/tsc/jscpd/cspell read `.stdout`, stylelint/ls-lint read `.stderr`. A genuine crash is still `{ crashed: true, message }`: either `result.error` (a real spawn failure, thrown by `defaultRun`), or a tool's own parser (`JSON.parse` for eslint/stylelint) failing on whatever its stream actually held — a panic trace is not valid JSON, so it still surfaces as a crash rather than a silent zero. ls-lint's own message format is `"<path> failed for \`<ext>\` rules: kebabcase"` (no hyphen, despite the rule being configured as `"kebab-case"`) — the count now matches on `"failed for"` generically, not the old (never-matching) `"kebab-case"` substring, so it counts any rule this config turns on, not just this one. Unrelated to the stream bug but found running the fixture proof for T1: stylelint's config resolution falls back to `cwd` (`stylelint/lib/utils/getModulePath.mjs`) to resolve a named `extends` — the same reason it worked at all against the donors, who have `stylelint-config-standard`/`stylelint-config-tailwindcss` installed as their own devDependencies — but the fixture didn't have either installed, so its own stylelint run failed at config-resolution, before ever reaching the stream question. `fixtures/next-supabase-mono/package.json` gained both as devDependencies (same ranges `packages/orrery/package.json` uses, `^40.0.0`/`^1.0.1`), `pnpm install --filter fixture-next-supabase-mono` at the root.

**T2 — syncpack has no working `--config` shape.** The installed syncpack (`packages/orrery/node_modules/syncpack`, a Rust binary wrapped by a thin Node launcher) panics with a clap arg-definition mismatch (`Mismatch between definition and access of \`config\`. Could not downcast...`) whenever `--config` is combined with an invocation that has any real package.json to process — reproduced against the fixture, against both donors, with a trivial config and with the real rendered one, on the installed 14.3.1 and (fetched fresh from npm for comparison) on 15.3.3. It only ever succeeds as a true no-op (zero packages discovered) — every earlier-looking "success" during this investigation turned out to be exactly that. `--config` at the top level (`syncpack --config <file> lint`) is not even accepted (clap: `unexpected argument '--config' found`). `--source` with an absolute path, or a relative path containing `..`, silently discovers nothing (no error, just zero packages) — only a path relative to `cwd` with no `..` segments works. Both donors' own `package.json` scripts invoke it as plain `syncpack lint`, cwd at the repo root, config found by the binary's own cosmiconfig-style discovery from there — the shape this task adopts. Since both donors declare `"syncpack": "^14.3.1"`, the same range Orrery already runs, there is no different version to pin to; T2's "no shape works → pin and record" fallback bottoms out at: no shape and no version fixes `--config`, so `codeDrift`'s syncpack block drops `--config` entirely and runs `syncpack lint` with `cwd: bodyDir`. This is a real, reported trade: for a body with its own `.syncpackrc*` (both donors), syncpack now checks the body's **own** current config, not Orrery's class-rendered one — every other tool in `codeDrift` runs Orrery's own rendered config against the body; syncpack cannot, and this is why. Its report is on stderr (`✓ No issues found` / a list of `✘` mismatches), confirmed against the installed binary the same way as T1.

**T4a — baseline vs. unexplained.** `compareToPrediction` used to call every violated, non-tightened rule `unexplained` outright. That is wrong for a rule a body was already violating when its prediction was recorded and still is, no worse — a real but known condition, not a new defect. A rule is now `unexplained` only when it has violations, is not in `prediction.tightened`, **and** is either absent from `prediction.counts` or worse than what was predicted; at or below its predicted count, it is `baseline` (a new field on `compareToPrediction`'s return, alongside `unexplained`/`moved`/`newRules`/`resolved`) — informational, does not fail the run. `--predict` (`observe.mjs`) now also writes `baseline: { [rule]: count }` into the prediction itself — every violated, non-tightened rule at prediction time, verbatim — so a later run has something to compare against; `renderObservation` (`report.mjs`) prints it alongside the other four. Proven against real data: this is exactly the `boundaries/no-unknown` situation task-10-report.md flagged as "anticipated but unmechanised" — see T4b below for the other half of that fix.

**T4b — `tightenedFor` becomes settings-aware for `boundaries/*`.** A `boundaries/*` rule reads `settings["boundaries/elements"]`, not its own rule options, to know what an "element" is — so a body and the class bundle can carry byte-identical `chosen` values for `boundaries/no-unknown` and still disagree in practice, because the body's own `boundaries/elements` (or its absence) differs from what the class renders (`STANDARD_ELEMENTS` plus `body.boundaries.elements`, `eslint.base.mjs`). `tightenedFor` gains a fourth, optional parameter, `classEffectiveBySurface` (default `{}`, so every existing 3-arg call site is unaffected) — the class bundle's own real effective config per surface, from the exact same `readEffectiveConfig` call `codeDrift`'s eslint pass already makes against the materialised scratch config (threaded through, not recomputed). For every `boundaries/*` row, even one whose `ruledValueMatches` check already passed, `tightenedFor` now also compares `canonical(classEffectiveBySurface[surface]?.settings?.["boundaries/elements"])` against the body's own (JSON-stringified, so key order never matters) and marks it tightened on any difference. Proven against libra for real: `boundaries/no-unknown` and `boundaries/no-unknown-files` both moved from task-10-report.md's "unexplained" list into `tightened` on this run, with no ruling needed to special-case them.

**T4c — `better-tailwindcss` settings, measured.** aeleos's own effective config carries `settings["better-tailwindcss"] = { entryPoint: "apps/hub/src/app/globals.css" }`; libra's carries no `settings["better-tailwindcss"]` at all (`undefined`) — the donors disagree on whether this key should exist, and the class bundle currently sets neither (matching libra, differing from aeleos only by omission). Every rule that needs an entry point already carries its own `entryPoint` option directly (`classes/next-supabase-mono/eslint.mjs`'s `better-tailwindcss/*` rules), so aeleos's settings-level entry point is redundant with what its own per-rule options already say — not a functional gap. Per this task's own instruction ("if the donors disagree in a way that needs a non-obvious ruling, say so and leave the base unchanged for that key"): left `eslint.base.mjs` unchanged for `settings["better-tailwindcss"]`; no schema parameter added.

**S1 amendment, PR #31 review (globals):** see Task 6's amendment above — `packages/orrery/classes/next-supabase-mono/eslint.base.mjs` and its test, not this task's files, but landed in the same commit as T1–T4.

---

### Task 10: Predictions for aeleos and libra, the observation report, CI wiring

Re-scoped 2026-09-10 by the owner (see ADR 0017): *"i kinda dont want a tool
that monitors the others. i want the others to get the information from this
one and they take care of themselves. i do want the option to trigger from
here to know whats up but we dont need to be a nightly thing"* … *"remove the
2e nightly too."* There is no nightly `tooling` job (Step 2, below, is
withdrawn) and no 2e nightly repository-policy job either — `.github/workflows/observe.yml`
is deleted outright. `orrery observe` and `orrery repo apply` stay on-demand
commands, run from Orrery; a body's own CI (Phase 2d's `orrery check`, wired
by `init`) is what enforces drift against a body going forward.

**Files:**
- Create by running: `docs/predictions/aeleos.json`, `docs/predictions/libra.json`, `docs/observations/<date>-tooling.md` and `.json`
- Delete: `.github/workflows/observe.yml` — no scheduled job of any kind ships from Orrery (ADR 0017)
- Modify: `.github/workflows/ci.yml` — nothing new: the `test` job already runs the bundle-honesty and fixture tests
- Create: `docs/decisions/0016-observation-baseline.md` — the first observation of both donors, counts per tool, and the sentence that these are predictions, not rulings
- Create: `docs/decisions/0017-no-scheduled-observation.md` — the owner's decision that Orrery runs no scheduled job; a body's own CI enforces drift against itself instead
- Modify: `docs/specs/2026-09-08-phase-2b-reconciliation-design.md`, `docs/specs/2026-09-08-phase-2e-repository-policy-design.md`, `docs/decisions/0003-repository-policy.md` — a one-line "Amended by ADR 0017" pointer under each nightly-observation paragraph; the historical text otherwise unchanged
- Test: `packages/orrery/tests/workflows.test.mjs` — replace the `observe.yml` `tooling`/`repository-policy` assertions with one assertion that the file does not exist

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

- [ ] **Step 2: Remove the 2e nightly**

Withdrawn by the owner (ADR 0017): no nightly `tooling` job is added, and the
existing 2e nightly repository-policy job goes with it. Delete
`.github/workflows/observe.yml` outright — there is no job left in it to keep.
`registry.json` gets no `observe` field; it stays the plain constellation map
(`repo`, `role`, `class` per body), nothing gating which bodies a scheduled
job would clone, because there is no scheduled job.

Replace `workflows.test.mjs`'s `.github/workflows/observe.yml` describe block
(both its `tooling`-job assertions from the withdrawn Step 2 above and the 2e
`repository-policy` assertions that shipped in Phase 2e) with one assertion:
the file does not exist. Every other assertion in the file (ci.yml,
back-merge.yml, release.yml, the PR template) is unchanged.

- [ ] **Step 3: The baseline record**

`docs/decisions/0016-observation-baseline.md`: date, both donor SHAs, per-surface eslint tightened counts, total predicted violations per tool per donor, the three known expectations confirmed or not, and the sentence: "These are predictions of what adoption will surface, recorded so drift is visible. They are not rulings; the rulings are 0004–0015."

- [ ] **Step 4: Commit and land**

```bash
git checkout -b feat/donor-predictions-and-nightly-observation origin/develop
git add docs/predictions docs/observations docs/decisions/0016-observation-baseline.md docs/decisions/0017-no-scheduled-observation.md docs/specs/2026-09-08-phase-2b-reconciliation-design.md docs/specs/2026-09-08-phase-2e-repository-policy-design.md docs/decisions/0003-repository-policy.md packages/orrery/tests/workflows.test.mjs docs/plans/2026-09-09-phase-2b-reconciliation.md
git rm .github/workflows/observe.yml
git commit -m "feat(observe): donor predictions, baseline record, and the end of scheduled observation [GH-000]"
git push -u origin HEAD && gh pr create --base develop --title "feat(observe): donor predictions, baseline record, and the end of scheduled observation [GH-000]" --body "Task 10 of the 2b plan, re-scoped 2026-09-10 (ADR 0017): no nightly job." && gh pr merge --squash --auto
```

---

### Task 11: the close-wave fixes (amended 2026-09-11)

The whole-branch review found five Critical defects and the controller ruled on each. Every one is
the spec asserting itself against what the first pass actually shipped, so they are amendments to
this plan rather than new scope. The blocks above are already rewritten to the fixed code; this
section carries the files the wave ADDED and the reasoning behind each ruling.

**C1 — a generated tool file must be usable by its own tool.** Three were not. `setPath` split a
lint-staged key on its own `.` (`*.{cjs,js,…}` became `{ "*": { "{cjs,js,…}": […] } }`, a nested
object where lint-staged wants a command list), syncpack's `versionGroups` rendered as an object
where syncpack's own schema — and libra's committed `.syncpackrc.json` — says array, and prettier
was pointed at through package.json's `"prettier"` key, which resolves to the generated MODULE
whose default export is a function. The fixes: a key carrying a glob metacharacter is one literal
segment; a per-tool `SHAPES` step collapses the rulings' labelled `versionGroups` map into the
array the tool reads, in row order, so the record keeps each group's own a/b provenance; and the
prettier pointer becomes a `prettier.config.mjs` template file that CALLS the function. The
standing guard is a test that hands each generated file to the tool's own loader or validator.

**C2 — boundaries must be real.** Four things each made `boundaries/dependencies` report nothing
while looking healthy, and all four were true at once: the pre-ruling's `base: "a"` attribute was
read by nothing and silently dropped, so the class shipped `default: "disallow"` with no allowed
edges at all; there was no `import/resolver`, so every `@/…` specifier was an unplaceable
"external" element the rule skips by design; the resolver, once added, is loaded by
eslint-module-utils from the LINTED FILE's package directory, which under pnpm cannot see Orrery's
copy — so it is named by absolute path; and the element `capture` lists bound `feature`/`layer` to
the `apps/*` wildcard, so every layered edge matched nothing. The base is now a `$fromSide: "a"`
marker with `withoutElementType: "identity"`, which puts aeleos's nine layered rules into the row's
own `chosen` where `rulings.json` records them and the honesty check compares them, and lifts
aeleos's own `identity` element out as aeleos body data. Result, measured: 5 violations on aeleos,
496 on libra — the rule working.

**C3 — physics carries no body-named opinion.** `no-restricted-syntax` / `-imports` /
`-properties` are core rules, so physics by plugin, and their whole content is whatever a project
decided to ban. See `namesProject` and `splitRestrictions` in `ordering.mjs` for the token test and
`parameteriseRestrictions` in `reconcile/eslint.mjs` for the agree/adopt half. The e2e
`no-restricted-syntax` union is Playwright-shaped, so `TIER_OVERRIDES` in `tiers.mjs` places it in
the class. A permanent guard over `rulings.json` fails on any physics row carrying a project token,
with three named exemptions and their reasons.

**C4 — no rule ships at warn** (the spec's CI section). 156 rows did. `liftWarn` in
`reconcile/eslint.mjs` lifts every decided warn to error; inert rows have no severity to lift.

**C5 — crash detection is status-aware for every tool.** Each of the seven exits non-zero on
findings as well as on a crash, and each parser answers "no findings" when handed something that is
not its report, so six of them read a panic or an OOM kill as a clean run. `statusAware` in
`observe/code.mjs` is the rule: status 0 parses as it stands; a non-zero status is findings only if
the tool's own stream carries its own report AND that report shows at least one finding; anything
else throws into `attempt`'s `{ crashed: true, message }`.

- [ ] **Step 1: The marker contract**

Markers used to be read by four functions that each ignored an attribute they did not understand.
That is how `base: "a"` shipped. `assertMarker` is the one definition of what a marker may say, and
`literal`, `resolveParameters`, `matches` and `resolveMarkers` all call it.

```javascript
// packages/orrery/src/lib/markers.mjs
// Markers are the hand-written stand-ins a ruling's `chosen` carries where a real value cannot be
// written down at reconcile time: `{ $parameter }` (body data, resolved by the bundle writer and
// by observe), `{ $union }` (both donors' arrays merged, resolved in reconcile), `{ $fromSide }`
// (one donor's value, likewise). Every marker key is `$`-prefixed so a plugin's own option object
// can never be mistaken for one — `union`, `parameter` and `fromSide` are all names real ESLint
// rule options use.
//
// C2/I5: a marker attribute nobody implements used to be dropped in silence. `boundaries/
// dependencies` carried `{ $parameter: "boundaries.allow", base: "a" }`, meaning "aeleos's layered
// policy is the base"; `literal`, `resolveParameters` and `matches` all ignored `base`, so the
// generated class shipped a boundaries policy with NO base rules at all and every check agreed
// with it, because they agreed with each other. Every consumer of a marker now runs `assertMarker`
// first, so an attribute no one implements is a loud error at the first place it is read rather
// than a silently narrower policy.
export const MARKER_ATTRIBUTES = {
  // The body-config path this value is read from. No further attributes.
  $parameter: [],
  // The option key whose arrays both donors contribute to. `join` turns the union back into one
  // delimited string (sonarjs/no-duplicate-string's `ignoreStrings`).
  $union: ["join"],
  // The named donor's own value for the key this marker sits at. `withoutElementType` strips one
  // eslint-plugin-boundaries element type out of the borrowed policy — the donor's own element
  // (aeleos's `identity`) is body data, so it leaves the class base and returns as that body's
  // `boundaries.elements`/`boundaries.allow`.
  $fromSide: ["withoutElementType"],
};

const MARKER_KEYS = Object.keys(MARKER_ATTRIBUTES);

// Throws on any `$`-prefixed key that is not a known marker, on two markers in one object, and on
// any extra key beside a marker that the marker does not define. Returns the marker key, or null
// when `value` is an ordinary object (or not an object at all).
export function assertMarker(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const keys = Object.keys(value);
  const dollar = keys.filter((k) => k.startsWith("$"));
  if (dollar.length === 0) return null;
  if (dollar.length > 1) throw new Error(`marker object carries more than one marker key: ${dollar.join(", ")}`);
  const [marker] = dollar;
  if (!MARKER_KEYS.includes(marker)) throw new Error(`unknown marker "${marker}"; known markers are ${MARKER_KEYS.join(", ")}`);
  const extra = keys.filter((k) => k !== marker && !MARKER_ATTRIBUTES[marker].includes(k));
  if (extra.length > 0) {
    throw new Error(`marker ${marker} carries unknown attribute${extra.length > 1 ? "s" : ""} ${extra.map((k) => `"${k}"`).join(", ")}; ${marker} understands ${MARKER_ATTRIBUTES[marker].length ? MARKER_ATTRIBUTES[marker].join(", ") : "no other attribute"}`);
  }
  return marker;
}
```


- [ ] **Step 2: The shape tests (C1)**

```javascript
// packages/orrery/tests/bundle-shapes.test.mjs
// C1: every generated tool file must be usable BY ITS OWN TOOL. The bundle tests next door prove
// the generator renders what the rulings say; they cannot see that the rendered shape is one the
// tool refuses — a `prettier` pointer that resolves to a function, a lint-staged key split on its
// own "." into a nested object, a syncpack `versionGroups` object where the schema says array.
// Each case here hands the committed generated output to the tool's own loader or validator, or
// (where a tool exposes neither) to the exact structural contract its documentation states.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import prettierApi from "prettier";
import stylelintApi from "stylelint";

import prettierConfig from "../physics/prettier.mjs";
import lintStagedConfig from "../physics/lint-staged.mjs";
import syncpackConfig from "../physics/syncpack.mjs";
import lsLintConfig from "../physics/ls-lint.mjs";
import secretlintConfig from "../physics/secretlint.mjs";
import hooksConfig from "../physics/hooks.mjs";
import stylelintConfigFn from "../classes/next-supabase-mono/stylelint.mjs";
import cspellConfigFn from "../classes/next-supabase-mono/cspell.mjs";
import jscpdConfigFn from "../classes/next-supabase-mono/jscpd.mjs";
import knipConfigFn from "../classes/next-supabase-mono/knip.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(here, "..");

const tempDir = (name) => fs.mkdtempSync(path.join(os.tmpdir(), "orrery-shape-" + name + "-"));

describe("prettier", () => {
  // prettier.resolveConfig is prettier's own loader: it discovers the config the way the CLI and
  // every editor integration do, and it is what a `prettier.config.mjs` pointer has to satisfy.
  // A bare `"prettier": "@vaoan/orrery/prettier"` package.json pointer resolves to the generated
  // MODULE — whose default export is a function, per the spec's "every export is a function" —
  // and prettier then has an options object that is a function, which it does not accept.
  it("accepts the generated config through prettier.resolveConfig", async () => {
    const dir = tempDir("prettier");
    try {
      const target = pathToFileURL(path.join(packageDir, "physics/prettier.mjs")).href;
      fs.writeFileSync(path.join(dir, "prettier.config.mjs"), "import prettier from " + JSON.stringify(target) + ";\nexport default prettier();\n");
      fs.writeFileSync(path.join(dir, "sample.ts"), "export const a = 1;\n");
      const resolved = await prettierApi.resolveConfig(path.join(dir, "sample.ts"), { editorconfig: false });
      expect(resolved, "prettier.resolveConfig returned no options object").toBeTypeOf("object");
      expect(resolved).not.toBeNull();
      expect(typeof resolved).not.toBe("function");
      expect(resolved).toMatchObject(prettierConfig());
      // And the options it resolved must actually drive a format call.
      await expect(prettierApi.format("export  const a=1", { ...resolved, parser: "typescript" })).resolves.toBeTypeOf("string");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  // The pointer file is the deliverable, not the module: it is what `orrery init` copies into a
  // body, so it is a template file and the fixture carries it byte-identically.
  it("ships a prettier.config.mjs pointer that calls the function", () => {
    const pointer = fs.readFileSync(path.join(packageDir, "templates/next-supabase-mono/prettier.config.mjs"), "utf8");
    expect(pointer).toContain('import prettier from "@vaoan/orrery/prettier"');
    expect(pointer).toContain("export default prettier();");
  });
});

describe("lint-staged", () => {
  // lint-staged exposes no public validator, so this is its documented contract: the config is a
  // flat map of one glob to one command or a list of commands. A key split on "." (the old
  // setPath) produces `{ "*": { "{cjs,js,…}": [...] } }` — a nested object value, which
  // lint-staged reports as an invalid configuration and refuses to run.
  it("is a flat map of glob strings to a command or list of commands", () => {
    const config = lintStagedConfig();
    expect(Object.keys(config).length).toBeGreaterThan(0);
    for (const [glob, commands] of Object.entries(config)) {
      expect(typeof glob, "key " + JSON.stringify(glob)).toBe("string");
      expect(glob, "a lint-staged key is a whole glob, never a fragment of one split on a dot").toMatch(/\./);
      expect(Array.isArray(commands) || typeof commands === "string", "value of " + glob + " must be a string or string[]").toBe(true);
      for (const command of Array.isArray(commands) ? commands : [commands]) expect(typeof command, "command under " + glob).toBe("string");
    }
    expect(Object.keys(config), "the '*' fragment key is the split-on-dot bug").not.toContain("*");
  });
});

describe("syncpack", () => {
  // syncpack ships its own JSON schema (node_modules/syncpack/schema.json, the one a .syncpackrc's
  // "$schema" points at). Read the declared type of each top-level key from it and check the
  // generated config against that, rather than restating the shape here.
  const schema = JSON.parse(fs.readFileSync(path.join(packageDir, "node_modules/syncpack/schema.json"), "utf8"));
  const rcFile = schema.definitions[schema.$ref.split("/").pop()];

  it("renders every key with the type syncpack's own schema declares", () => {
    const config = syncpackConfig();
    for (const [key, value] of Object.entries(config)) {
      const declared = rcFile.properties[key];
      expect(declared, 'syncpack\'s schema has no property "' + key + '"').toBeTruthy();
      if (declared.type === "array") expect(Array.isArray(value), key + " must be an array").toBe(true);
      if (declared.type === "object") expect(Array.isArray(value), key + " must be an object").toBe(false);
    }
  });

  it("renders versionGroups as an array of group objects, libra's own .syncpackrc shape", () => {
    const config = syncpackConfig();
    expect(Array.isArray(config.versionGroups)).toBe(true);
    expect(config.versionGroups.length).toBeGreaterThan(0);
    for (const group of config.versionGroups) {
      expect(group).toBeTypeOf("object");
      expect(Array.isArray(group)).toBe(false);
      expect(Array.isArray(group.dependencies), "every group names the dependencies it governs").toBe(true);
    }
  });
});

describe("stylelint", () => {
  it("lints a trivial stylesheet with the generated config without throwing", async () => {
    const config = stylelintConfigFn({ tailwind: { entryPoint: "apps/web/src/app/globals.css" } });
    const result = await stylelintApi.lint({ code: "a {\n  color: red;\n}\n", config, cwd: packageDir });
    expect(result.results).toHaveLength(1);
    expect(result.results[0].invalidOptionWarnings, JSON.stringify(result.results[0].invalidOptionWarnings)).toEqual([]);
  }, 60_000);
});

describe("cspell", () => {
  // cspell's documented config shape: a "version" string, "language" string, and array fields.
  it("renders the documented cspell config keys with their documented types", () => {
    const config = cspellConfigFn();
    expect(config.version).toBeTypeOf("string");
    expect(config.language).toBeTypeOf("string");
    expect(Array.isArray(config.words)).toBe(true);
    expect(Array.isArray(config.ignorePaths)).toBe(true);
    expect(config.allowCompoundWords).toBeTypeOf("boolean");
  });
});

describe("jscpd", () => {
  it("renders the documented jscpd config keys with their documented types", () => {
    const config = jscpdConfigFn();
    expect(config.threshold).toBeTypeOf("number");
    expect(Array.isArray(config.format)).toBe(true);
    expect(Array.isArray(config.reporters)).toBe(true);
    expect(Array.isArray(config.ignore)).toBe(true);
  });
});

describe("ls-lint", () => {
  // ls-lint's documented shape: a top-level "ls" map of directory glob to { extension: rule }.
  it("renders a top-level ls map of directory glob to extension rules", () => {
    const config = lsLintConfig();
    expect(Object.keys(config)).toEqual(["ls"]);
    for (const [dir, rules] of Object.entries(config.ls)) {
      expect(dir).toBeTypeOf("string");
      expect(rules).toBeTypeOf("object");
      for (const [ext, rule] of Object.entries(rules)) {
        expect(ext.startsWith("."), dir + " rule key " + ext + " must be a file extension").toBe(true);
        expect(rule).toBeTypeOf("string");
      }
    }
  });
});

describe("secretlint and knip and hooks", () => {
  it("renders secretlint's documented rules array", () => {
    const config = secretlintConfig();
    expect(Array.isArray(config.rules)).toBe(true);
    for (const rule of config.rules) expect(rule.id).toBeTypeOf("string");
  });
  it("renders knip's workspace shape with entry/project arrays", () => {
    const config = knipConfigFn();
    for (const key of ["apps", "packages"]) {
      expect(Array.isArray(config[key].entry), key + ".entry").toBe(true);
      expect(Array.isArray(config[key].project), key + ".project").toBe(true);
    }
  });
  it("renders the hooks map with a pre-commit entry", () => {
    const config = hooksConfig();
    expect(config["pre-commit"]).toBeTypeOf("object");
    expect(Array.isArray(config["pre-commit"].checks)).toBe(true);
  });
});
```


- [ ] **Step 3: The boundaries test (C2)**

Deliberately NOT in `fixtures/next-supabase-mono`: the fixture is the body every other check
observes and predicts against, and a permanent violation living in it would have to be carried as a
known entry in its prediction forever, where it would look exactly like a real regression the day
one appeared.

```javascript
// packages/orrery/tests/boundaries-policy.test.mjs
// C2: the boundaries graph must actually place an aliased import and actually refuse a forbidden
// edge. Three things could each make `boundaries/dependencies` report nothing while looking
// healthy, and all three were true at once: a policy with no base rules (the `base: "a"` attribute
// nothing read), no `import/resolver` at all (so every `@/...` specifier was an unplaceable
// "external" element the rule skips), and capture lists that bound `feature`/`layer` to the wrong
// wildcard (so every layered edge matched nothing). The rule reported zero on both donors and
// every check agreed with it.
//
// This runs the real ESLint binary over a temporary body — rather than putting the forbidden
// import into fixtures/next-supabase-mono. The fixture is the body every other check observes and
// predicts against, and it is meant to be clean: a deliberate violation living in it would have to
// be carried as a "known" entry in the fixture's prediction forever, where it would look exactly
// like a real regression the day one appeared. A temporary body says the same thing louder and
// leaves the fixture honest.
//
// It is a SPAWNED run, with the body as the child's cwd, exactly as `orrery observe` invokes it:
// eslint-import-resolver-typescript globs its `project` option against `process.cwd()`, so an
// in-process ESLint API call (whose `cwd` option does not change the process's own) finds no
// tsconfig and resolves no alias — which is the very failure this test exists to catch.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL, fileURLToPath } from "node:url";
import { resolveEslintBin } from "../src/lib/effective-config.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(here, "..");

let dir;

const write = (rel, text) => {
  const file = path.join(dir, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
};

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-boundaries-"));
  // eslint-plugin-import's `order` rule walks up for the nearest package.json to classify an
  // import as external; a directory with none crashes it before boundaries ever runs.
  write("package.json", JSON.stringify({ name: "boundaries-probe", private: true, type: "module" }, null, 2));
  const compilerOptions = { module: "esnext", moduleResolution: "bundler", target: "es2022", strict: true, noEmit: true };
  write("tsconfig.json", JSON.stringify({ compilerOptions, include: ["apps/*/src"] }, null, 2));
  // The per-app tsconfig is what `import/resolver`'s `project: ["apps/*/tsconfig.json", ...]`
  // reads, and its `paths` is what makes `@/` mean anything at all.
  write("apps/web/tsconfig.json", JSON.stringify({ compilerOptions: { ...compilerOptions, baseUrl: ".", paths: { "@/*": ["src/*"] } }, include: ["src"] }, null, 2));
  write("apps/web/src/features/thing/application/use-thing.ts", "export const useThing = () => 1;\n");
  write("apps/web/src/shared/domain/helper.ts", "export const helper = () => 2;\n");
  write("apps/web/src/shared/application/allowed.ts", 'import { helper } from "@/shared/domain/helper";\nexport const allowed = () => helper();\n');
  // aeleos's layered policy, which the class carries as its base, allows shared -> shared and
  // never shared -> feature: a shared module that reaches into a feature inverts the layering.
  write("apps/web/src/shared/application/forbidden.ts", 'import { useThing } from "@/features/thing/application/use-thing";\nexport const forbidden = () => useThing();\n');
  const klass = pathToFileURL(path.join(packageDir, "classes/next-supabase-mono/eslint.mjs")).href;
  const body = { class: "next-supabase-mono", root: dir.split(path.sep).join("/"), tailwind: { entryPoint: "apps/web/src/app/globals.css" } };
  write(
    "eslint.config.mjs",
    `import orrery from ${JSON.stringify(klass)};\nexport default await orrery(${JSON.stringify(body, null, 2)});\n`
  );
});

afterAll(() => {
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
});

const boundariesMessages = (file) => {
  const result = spawnSync(
    process.execPath,
    [resolveEslintBin(packageDir), "-c", path.join(dir, "eslint.config.mjs"), "--no-config-lookup", "-f", "json", file],
    { cwd: dir, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
  );
  if (result.error) throw result.error;
  if (!result.stdout.trim()) throw new Error(`eslint produced no report (status ${result.status}): ${result.stderr}`);
  return JSON.parse(result.stdout)
    .flatMap((r) => r.messages)
    .filter((m) => m.ruleId === "boundaries/dependencies");
};

describe("boundaries/dependencies against the generated class config", () => {
  it("reports exactly one violation for a shared module importing a feature through @/", () => {
    const messages = boundariesMessages("apps/web/src/shared/application/forbidden.ts");
    expect(messages.map((m) => m.message)).toHaveLength(1);
    expect(messages[0].message).toMatch(/"shared"/);
    expect(messages[0].message).toMatch(/"feature"/);
  }, 180_000);

  it("reports none for an allowed shared -> shared import through @/", () => {
    expect(boundariesMessages("apps/web/src/shared/application/allowed.ts")).toEqual([]);
  }, 180_000);
});
```


- [ ] **Step 4: The bundle command's own exit codes**

```javascript
// packages/orrery/tests/bundle-command.test.mjs
import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import bundle from "../src/commands/bundle.mjs";

const quiet = () => {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  return { out: () => [...log.mock.calls, ...error.mock.calls].flat().join("\n"), restore: () => { log.mockRestore(); error.mockRestore(); } };
};

const provenance = { date: "2026-09-09", a: { name: "aeleos", sha: "aaa1111" }, b: { name: "libra", sha: "bbb2222" } };
const row = (extra) => ({ tool: "eslint", surface: "source", key: "no-var", a: null, b: null, chosen: ["error"], test: "agree", tier: "physics", note: "", ...extra });

const packageDir = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-bundle-cmd-"));
  fs.mkdirSync(path.join(dir, "classes/next-supabase-mono"), { recursive: true });
  fs.writeFileSync(path.join(dir, "classes/next-supabase-mono/schema.mjs"), "export default {};");
  fs.writeFileSync(path.join(dir, "classes/next-supabase-mono/eslint.base.mjs"), "export default {};");
  return dir;
};

describe("orrery bundle", () => {
  it("exits 0 and lists every file it wrote", async () => {
    const q = quiet();
    const dir = packageDir();
    const rulings = path.join(dir, "rulings.json");
    fs.writeFileSync(rulings, JSON.stringify({ provenance, rows: [row({})] }));
    expect(await bundle(["--rulings", rulings, "--package", dir])).toBe(0);
    expect(q.out()).toContain("physics/eslint.mjs");
    expect(fs.existsSync(path.join(dir, "physics/eslint.mjs"))).toBe(true);
    fs.rmSync(dir, { recursive: true, force: true });
    q.restore();
  });

  // The residue refusal: a rulings file with an unresolved row is not something to bundle around.
  // Generating from it would ship a shared tier that quietly omits whatever nobody ruled on.
  it("exits 1 and refuses to write anything when a row is residue", async () => {
    const q = quiet();
    const dir = packageDir();
    const rulings = path.join(dir, "rulings.json");
    fs.writeFileSync(rulings, JSON.stringify({ provenance, rows: [row({}), row({ key: "unicorn/x", chosen: null, test: "residue", tier: "physics" })] }));
    expect(await bundle(["--rulings", rulings, "--package", dir])).toBe(1);
    expect(q.out()).toMatch(/carries 1 residue row\(s\); resolve them before bundling/);
    expect(fs.existsSync(path.join(dir, "physics/eslint.mjs"))).toBe(false);
    fs.rmSync(dir, { recursive: true, force: true });
    q.restore();
  });

  it("exits 1 when the rulings file cannot be read", async () => {
    const q = quiet();
    const dir = packageDir();
    expect(await bundle(["--rulings", path.join(dir, "nope.json"), "--package", dir])).toBe(1);
    expect(q.out().length).toBeGreaterThan(0);
    fs.rmSync(dir, { recursive: true, force: true });
    q.restore();
  });

  it("exits 2 on an unknown flag", async () => {
    const q = quiet();
    expect(await bundle(["--nonsense"])).toBe(2);
    expect(q.out()).toContain("usage: orrery bundle");
    q.restore();
  });
});
```


- [ ] **Step 5: The pointer file prettier now needs (C1)**

`packages/orrery/templates/next-supabase-mono/prettier.config.mjs`, carried byte-identically by the
fixture, with the `"prettier": "@vaoan/orrery/prettier"` key dropped from the fixture's
`package.json`:

```javascript
import prettier from "@vaoan/orrery/prettier";
export default prettier();
```

- [ ] **Step 6: Rerun the pipeline**

`reconcile` → `bundle` → the bundle/honesty/shape/pointer tests → the fixture's `observe --predict`
and check run → both donors' `observe --predict` and check run. The records, `rulings.json`, the
generated tiers, the predictions and the observation are all committed from that rerun.

## Done when

- `pnpm test` passes: the 214 tests of Phase 2e plus this plan's. Verified 2026-09-09 by extracting every code block into a scratch copy of the package and running it: 85 new unit-level tests pass (299 total with 2e's) before the three environment-bound files (bundle-honesty, fixture-pointers, workflows additions), which run only once the fixture, the bundle and the workflow exist. Report the observed count.
- `orrery reconcile Z:/Github/aeleos Z:/Github/libra` exits 0 with no residue; twelve records and `rulings.json` are committed; every ruling has a row.
- `orrery bundle` regenerates `physics/` and `classes/next-supabase-mono/` byte-identically from the committed rulings (a test runs it into a temp dir and diffs against the committed files).
- `orrery observe Z:/Github/aeleos Z:/Github/libra` exits 0: effective config equals the rulings on every surface for both donors, and every violation comes from a rule the rulings tightened for that body, or is recorded `baseline`. The predictions are committed, alongside ADR 0016 (the baseline record) and ADR 0017 (no scheduled job; see below).
- No body was modified: `git -C Z:/Github/aeleos status --short` and the same for libra are empty at the end, and both HEADs are the SHAs recorded in the predictions.
- No scheduled workflow ships from Orrery: `.github/workflows/observe.yml` does not exist. `orrery observe` and `orrery repo apply` remain on-demand commands.

## Rulings made while planning, for the controller to confirm or overturn

1. `observe` runs Orrery's tool binaries and plugins against the body, not the body's own; after adoption that is the body's exact situation. The body's `node_modules` is still needed for type-aware parsing.
2. `import/*` rules are placed in the class, not physics, because neither donor depends on `eslint-plugin-import` directly; the rules arrive through `eslint-config-next`.
3. `off` agreements from `eslint-config-prettier`'s prefixes (`@stylistic`, `vue`, `flowtype`, …) are not emitted individually; the class appends `eslint-config-prettier` last, which is where both donors get them.
4. Language options and plugin settings (parser, project service, React version, boundaries elements) are hand-written in `eslint.base.mjs`, not generated: rows cover rules, and both donors agree on these.
5. The class's surface globs are fixed conventions (`apps/*/src/**/*.ts`, `**/*.test.{ts,tsx}`, …), not derived from the donors' 61 override blocks; the six measured surfaces are what those blocks reduce to.
6. tsconfig per-app data (`types`, `include`, `paths`) stays in each app's own tsconfig under the class `extends`; the bundle carries only compiler flags.
7. The fixture body is a pnpm workspace package so its pointer files resolve `@vaoan/orrery` the way a body will.
8. ~~The nightly tooling observation clones only bodies flagged `observe: true` in the registry until the cut-over records predictions for the other three.~~ Overturned 2026-09-10 (ADR 0017): there is no nightly tooling observation, so nothing needs a registry flag to gate it. `registry.json` carries no `observe` field.
9. A `residue` row at reconcile time stops the executor: pre-rulings are added only after the owner has seen the row, per the stop-when-cornered rule.
