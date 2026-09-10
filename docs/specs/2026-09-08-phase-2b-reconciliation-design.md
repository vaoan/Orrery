# Phase 2b — Reconciliation: one bundle, observed drift

**Date:** 2026-09-08
**Status:** approved design, awaiting plan
**Extends:** `docs/specs/2026-09-06-orrery-design.md` (Reconciliation, CI, Testing)
**Input:** `docs/decisions/0002-eslint-reconciliation-input.md` (the Phase 2a measurement)

## What this phase produces

A single installable bundle of every tooling opinion the constellation holds,
generated once from aeleos and libra under a fixed ruling order, plus a command
that observes every body from Orrery and reports how far each has drifted from
the bundle. No body is modified. No code is fixed. Nothing is synchronised.

The proof that the bundle is right is a body's own tools running against the
bundle with nothing copied into the body, reporting exactly the violations the
ruling table predicts and nothing else.

## Principles this phase is built on

These were stated during the brainstorm and bind every decision below.

1. **Strictest wins.** When two configurations disagree, the ruling order is:
   the stricter option; if strictness is undefined, the option more consistent
   with the rest of the rule set and the other bodies; otherwise the option
   that most benefits the code. The cost of fixing existing violations is never
   a reason to relax a rule.
2. **Everything is shared unless it names one specific file.** A rule is either
   true for every repository, true for a kind of repository, or an exception
   for a named file. There is no fourth category. A body keeps only its data:
   paths, package names, element types, spelling words, ignore lists.
3. **Orrery is never blocked by a body.** Orrery is the centre of planning. It
   observes and rules; bodies obey or go red. A body is blocked until it runs
   the latest Orrery and its CI passes.
4. **Deterministic tooling, tested on its own.** Every enforcement is a script
   with a test that would fail if it lied. AI is not in the enforcement loop;
   an AI review layer for what scripts cannot express is a later, separate
   concern.
5. **As little manual as possible.** The bundle is generated, not authored.
   Rollout is a bot. The only human decisions are the tie-breaks the ordering
   cannot settle, and they are recorded.

## Vocabulary, by use case

| Design-doc word | Plain meaning | Example |
|---|---|---|
| physics | rules for every repository, including one that does not exist yet | `sonarjs/cognitive-complexity` at 15 |
| class | rules for one kind of repository; today the only class is `next-supabase-mono` | `@next/next/no-html-link-for-pages` |
| parameter | a shared rule with a body-specific value | Tailwind's `entryPoint`, the boundaries element map |
| local | an exception for a named file | aeleos relaxing one rule for `apps/hub/tests/retry-fetch.test.ts` |

The boundaries policy is the worked example: both donors have `app`,
`features`, `shared` and a `proxy.ts`, and both forbid `shared` importing from
`features`. aeleos additionally splits a feature into `domain`, `application`
and `presentation` layers. Under strictest-wins the layered policy is the class
rule, and each body's extra element types (`identity` in aeleos, `mocks` and
`shared-layouts` in libra) and their paths are parameters.

## The body surface

A body owns exactly one file with content, and pointer files with none.

### `orrery.config.mjs`

```js
export default {
  class: "next-supabase-mono",
  workspacePackages: ["@aeleos/identity"],
  floatingPeers: ["@supabase/supabase-js"],
  tailwind: { entryPoint: "apps/hub/src/app/globals.css" },
  boundaries: {
    elements: [{ type: "identity", pattern: "packages/identity/src/**" }],
    allow: [{ from: "feature", to: "identity" }],
  },
  spelling: ["aeleos", "clerk", "supabase"],
  ignore: { duplication: ["supabase/**"], secrets: [".secrets"] },
};
```

The schema is declared by the class. There is no field for a severity, a
threshold, or a rule name: a body can add data and add rules, never loosen a
shared rule. `orrery observe` fails a body whose config carries a field the
class does not declare.

### Pointer files

Each is written once by `orrery init` (Phase 2d) and verified byte-for-byte by
`orrery observe`. In this phase they exist only in the fixture body.

| File | Content |
|---|---|
| `eslint.config.mjs` | one line re-exporting `@vaoan/orrery/eslint` |
| `eslint.local.mjs` | additions and named-file exceptions only; merged last |
| `tsconfig.json` | one `extends` of the class tsconfig |
| `package.json` → `prettier` | the package's prettier export |
| `stylelint.config.mjs`, `knip.json`, `.jscpd.json`, `cspell.json`, `.syncpackrc.json`, `.secretlintrc.json`, `.ls-lint.yml`, lint-staged | one-line pointers, or wrapped by `orrery check` where the tool has no `extends` |
| `.husky/pre-commit` | `pnpm orrery hook pre-commit` |
| `.github/workflows/ci.yml` | five lines: `uses: vaoan/Orrery/.github/workflows/ci.yml@main` |

Every export in the bundle is a function. The pointer calls it with the body's
config, which the loader finds by walking up from the working directory to the
nearest `orrery.config.mjs`.

## CI: structure in YAML, logic in the package

Recorded here because it shaped the body surface; built in Phase 2d.

- **Facts that decide it.** `vaoan` is a personal GitHub account, not an
  organisation, so org-level required workflows are unavailable. Orrery was
  made public on 2026-09-08 so the five public bodies can call its reusable
  workflow and install the package straight from the repository.
- **No npm, no tags: the latest is Orrery's `main`.** Bodies depend on the
  package as `"@vaoan/orrery": "github:vaoan/Orrery#main"` with the
  `packages/orrery` subpath. pnpm records the exact commit it installed in the
  lockfile, so installs stay reproducible, and "latest" means the head of
  `main`. A release is a merge to `main`; nothing leaves GitHub and no npm
  account or scope is needed. The version in `package.json` is kept for humans
  and changelogs, not for resolution. The exact pnpm subpath syntax is
  verified in the Phase 2d plan.
- **Orrery holds `.github/workflows/ci.yml`** defining jobs, caching and the
  matrix. Bodies reference it at `@main`, so a change to job layout reaches
  every body on its next run with no bump.
- **Every job step is one verb**: `orrery ci lint`, `orrery ci typecheck`,
  `orrery ci test`. Verbs carry the logic and the tests.
- **The currency gate.** `orrery ci` first compares the installed
  `@vaoan/orrery` commit with the head of Orrery's `main` and fails with
  "bump to X" if the body is behind. Every pull request in that body is blocked
  until the bump lands. Orrery's own merge to `main` runs `observe` against all
  bodies for information and is never held back by the result.
- **The bump.** On every merge to Orrery's `main`, a job opens a bump PR in
  each body with automerge. Green, it merges unattended. Red, the code fix goes into that
  same PR while the currency gate holds everything else; main stays green.
- **Deployment stays in each body's own YAML**, because environments and cloud
  credentials belong to the body.
- No rule ever ships at `warn`. The design doc's grace period is not used.

## `orrery reconcile`

Reads the two donors, applies the ruling order, and writes the ruling records
and the bundle. It runs once; afterwards the bundle is the truth and the donors
are never consulted again. `diff-eslint` becomes its first sub-step.

### Measurement surfaces

eslint is resolved per kind of file, one sample each, which is what covers
aeleos's 18 and libra's 43 file-scoped override blocks:

| Kind | Sample (aeleos / libra) |
|---|---|
| source | `apps/hub/src/features/session/…ts` / `apps/store/src/features/cart/…ts` |
| component | `apps/hub/src/app/[locale]/layout.tsx` / `apps/store/src/app/layout.tsx` |
| unit test | `**/*.test.ts` under `apps/*/tests` or `src/test` |
| e2e | `**/e2e/**/*.spec.ts` |
| script | `scripts/*.mjs` |
| config | `eslint.config.mjs` |

Exact sample paths are verified on disk when the plan is written, not assumed.

The other tools have static configs and are read directly.

### What "stricter" means per tool

| Tool | Stricter is | Data, becomes a parameter |
|---|---|---|
| eslint | `error` > `warn` > `off`; a lower threshold; an option that forbids more; no exemption over an exemption | entry points, element maps, restricted-import patterns |
| tsconfig | a flag on over off; libra's base has six flags aeleos lacks | paths, per-app `include` |
| stylelint | a rule on over off; aeleos's four added rules join; its three disabled standard rules come back on | none |
| ls-lint | kebab-case only, per ADR 0001; coverage extends to tests | none; globs are class-level |
| jscpd | the lower threshold (both are 5); Next.js boilerplate exclusions are class-level | extra ignores |
| prettier, secretlint | identical today; lifted | ignore lists |
| cspell | the header is identical; lifted | words, ignore paths |
| knip | class-level entry conventions for `apps/*` and `packages/*` | extra entries per workspace |
| syncpack | the two shared rules, per the design doc | workspace packages, floating peers |
| lint-staged, husky | the union of checks both hooks run | none |

Where the ordering yields a combination stricter than either donor, that is the
ruling. It is expected that both donors gain violations.

### Ruling records

One file per tool, `docs/decisions/00NN-<tool>.md`, generated. Each holds a
table with one row per rule: aeleos value, libra value, chosen value, deciding
test (`strictest`, `consistency`, `benefit`, `parameter`, `local`). Rows that
needed the consistency or benefit test get a paragraph. Two are already known:

- `@typescript-eslint/no-unused-vars`: no `_` exemption. An exemption is less
  strict than none. Mechanical.
- `unicorn/number-literal-case`: uppercase hex. Strictness is undefined; the
  plugin default and four of the five bodies are uppercase. Consistency.

The Phase 2a measurement stands as the record of the input: 530 agree, 35 and
20 real one-sided opinions, 356 and 14 inert off-only rules, 55 conflicts, of
which 36 flip on severity alone and 7 are ordinal thresholds.

### Bundle layout

```
packages/orrery/
├── physics/
│   ├── eslint.mjs           core, @typescript-eslint, sonarjs, unicorn, security,
│   │                        unused-imports, import, jsdoc, tsdoc, boundaries (param)
│   ├── tsconfig.json        the strict compiler flags
│   ├── prettier.json  secretlint.json  ls-lint.yml  syncpack.mjs  lint-staged.mjs
│   └── hooks/pre-commit.mjs
├── classes/next-supabase-mono/
│   ├── eslint.mjs           next, react, react-hooks, jsx-a11y, better-tailwindcss (param),
│   │                        @tanstack/query, i18next, testing-library, playwright, vitest
│   ├── tsconfig.json        extends ../../physics/tsconfig.json; DOM lib, JSX
│   ├── stylelint.mjs  jscpd.json  cspell.json  knip.mjs  vitest.mjs
│   └── schema.mjs           the fields orrery.config.mjs may carry
└── src/
    ├── load-body-config.mjs walks up to orrery.config.mjs; merges eslint.local.mjs last
    └── commands/reconcile.mjs, observe.mjs
```

Each eslint file is organised by kind of file, one block per surface, matching
the measurement. Every generated file starts with a header naming the two donor
commits it came from and a pointer to its ruling record. After generation it is
ordinary config code: edited by hand, released by version.

Plugin placement follows the boundary rule: a plugin that needs Next.js, React,
Tailwind, TanStack Query, i18n, Playwright or Vitest to make sense is class;
everything else is physics.

## `orrery observe`

Run from Orrery against checkouts of the bodies: locally the directories under
`Z:\Github`, in Orrery's CI five fresh clones, nightly and on every Orrery PR.
It never blocks a release. It writes `docs/observations/<date>.md` and a JSON
alongside. Three drifts, each its own script:

*Amended by ADR 0017 (2026-09-10): no nightly run of `orrery observe`; it stays
an on-demand command from Orrery, and a body's own CI enforces the same three
drifts against itself.*

- **Version drift.** The commit of `@vaoan/orrery` recorded in the body's
  lockfile against the head of Orrery's `main`, read with `git ls-remote`.
- **Pointer drift.** Pointer files byte-identical to what `init` writes;
  `eslint.local.mjs` contains only additions and named-file exceptions;
  `orrery.config.mjs` carries only declared fields.
- **Code drift.** The body's own tools run with a config that only imports the
  bundle. Two comparisons: the effective config against the ruling table, which
  must match rule for rule; and the reported violations against the committed
  prediction for that body.

A prediction is a file per body under `docs/predictions/<body>.json`: the
donor commit it was made from, and for each tool the set of rules the ruling
table tightened for that body, with the violation count observed at that
commit. A violation from a rule outside the set is a defect in Orrery. A count
that moves is drift, reported, never a failure. Before adoption, code drift is
the whole proof. After adoption the body's CI enforces; `observe` is the
cross-constellation view.

Known predictions before any run: libra will show 677 file-naming violations,
because Phase 0's codemod was merged but never executed; aeleos will show
stylelint violations in `globals.css` from the three standard rules it had
disabled; both will show sonarjs threshold violations.

## Testing Orrery

- **Unit, with fixtures.** Each tool's ordering on two small configs with a
  known ruling; the config loader; the local-override checker; each drift
  script. Every bug gets a regression test, sabotage-verified.
- **Fixture body**, `fixtures/next-supabase-mono/`: a minimal skeleton with
  pointer files, `orrery.config.mjs`, a source file, a component, a test, an
  e2e file, a script. Three tests: the bundle's effective config per kind of
  file equals the ruling table (keeps the generated bundle honest after hand
  edits); `observe` on the clean fixture reports zero drift; one broken variant
  per drift kind is caught.
- **Real bodies.** `observe` against aeleos and libra with the committed
  predictions, from fresh clones in CI.
- **No flakiness.** Anything touching a real body pins the donor commit and
  reports movement rather than failing on it. Spawn paths are tested against a
  fake tool binary, as `diff-eslint` already is.

## Scope and order

In this phase, in build order:

1. `reconcile` for eslint across the six kinds of file; then tsconfig,
   stylelint, prettier, ls-lint, jscpd, cspell, knip, syncpack, secretlint,
   lint-staged, husky.
2. The ruling records.
3. The bundle, the loader, the class schema.
4. The fixture body and its three tests.
5. `observe` with the three drifts, and the predictions for aeleos and libra.
6. All of it wired into Orrery's own CI.

**Done when** `observe` against aeleos and libra reports exactly the predicted
violations and nothing else, every ruling has a row in a record, and the suite
is green.

Deferred:

- **2c** — the Claude plugin channel: skills, the 31 rule files, MCP servers,
  version-parity test.
- **2d** — the git install path from `main`, the reusable `ci.yml`, the
  `orrery ci` verbs and currency gate, `init`/`status`/`promote`, the
  registry, bump-PR automation.
- **2e** — repository policy: branch flow, naming, titles, protection, merge
  methods, hooks, releases, and `orrery repo apply`. Designed the same day in
  `docs/specs/2026-09-08-phase-2e-repository-policy-design.md`. **2e runs
  before 2b** and is applied to Orrery first, so the 2b work lands through
  the flow every body will use.
- **3** — touching any body.
- **Later brainstorm** — architecture and shared types across bodies, which
  need a mechanism other than config files.

## Decisions taken during the brainstorm

- Orrery made public (2026-09-08), after a scan of all tracked files and the
  full history found no secrets, addresses or internal hosts.
- No grace period; no rule at `warn`.
- No npm, no tags. Bodies install from the public repository's `main`; a
  release is a merge. Chosen because publishing packages was an unwanted
  obligation, fixed versions are what the constellation must avoid, and the
  public repository already provides everything the install needs.
- The bundle is generated once, then owned as code. Generation, not authorship,
  because readability is handled by structure and record pointers, and hand
  authoring was the manual step to remove.
- Ruling records are one file per tool with a row per rule, not one file per
  rule.
- Deploy workflows stay in the bodies.

## Carried over from Phase 2a, not blocking

`orrery diff-eslint --help` exits 2; "no sample file" exits 1 rather than 2;
`pickSampleFile(dir, "")` falls through silently; `packageManager` and
`license` before the first body installs from `main`; a real-ESLint fixture for
`defaultExec` belongs with the fixture body above.
