# ADR 0018 — Phase 2b execution rulings

**Date:** 2026-09-11
**Status:** accepted
**Spec:** docs/specs/2026-09-08-phase-2b-reconciliation-design.md
**Plan:** docs/plans/2026-09-09-phase-2b-reconciliation.md

## Why this record exists

Phase 2b's plan was executed autonomously: a controller session ran ten
tasks, each dispatched to an implementer subagent, reviewed each landing
before the next task started, and made the many small calls a plan of this
size always needs but cannot spell out in advance — how to fold a fix, which
regex to anchor, which side of a conflicting donor value to keep. Every one
of those controller decisions is a ruling made *on the owner's behalf*, not
one he was asked about at the time. This record exists so any of them can be
overturned: it lists every `Ruling:` line the execution ledger recorded, in
the order it was made, with what it costs if it turns out wrong and where the
decision now lives in the tree. Nothing here is provenance for a number —
every count belongs to a generated artefact pointed at in `## Data` below.

The owner's own rulings, given directly during execution, are quoted
verbatim below rather than summarised, because a controller's paraphrase of
an instruction is exactly the kind of drift this repository exists to catch.

## The owner's rulings during execution

**2026-09-09, resuming Task 5 after a checkpoint**, on a restart that lost his
prior ruling text: the controller applied its own recommendation per his
standing instruction to proceed from a checkpoint on the recommended path,
reporting each ruling with its cost. He did not re-issue the three residue
rulings themselves; they are the controller's, recorded under Task 5 below.

**2026-09-09**, on the `resolveEslintBin` corner (Task 6 could not land
because `NODE_PATH` let a temp-dir `eslint` resolution succeed once eslint
entered Orrery's own tree):

> "go"

**2026-09-09**, on enforcing descriptive branch names across the
constellation:

> "yes to the branch-name blocklist"

**2026-09-10**, on the corner where `--print-config` serialises a RegExp
option value as `{}`, silently losing `i18next/no-literal-string`'s
`words.exclude`/`callees.exclude` data on an adopt row:

> "go with your recommendation"

**2026-09-10**, the design change that reshaped Task 10 and produced ADR
0017:

> "i kinda dont want a tool that monitors the others. i want the others to
> get the information from this one and they take care of themselves. i do
> want the option to trigger from here to know whats up but we dont need to
> be a nightly thing"
>
> "when the other tools get the configs from this one, they should throw
> errors, right? thats the point of this tool"
>
> "remove the 2e nightly too"

**2026-09-10**, the standing reports-are-commands rule that produced the
ADR 0016 reduction and this record's own shape:

> "all reports you do must be executable with a command later. not using AI.
> be ready to also be able to read them and take action. They must be
> compatible with you."

## Controller rulings, in order made

Grouped by where in the plan's execution they fell. Each entry: what was
decided, why, what it costs if wrong, and where it lives now.

### Pre-flight

1. **The plan's nine planning rulings stand as written** (listed at the
   plan's end); any residue found at Task 5 is a corner and stops for the
   owner rather than being resolved by the controller alone. Why: the plan
   was already reviewed and approved; re-litigating its own rulings mid-run
   would be scope creep. Cost if wrong: none — procedural. Lives: plan's own
   ruling list, `docs/plans/2026-09-09-phase-2b-reconciliation.md`.
2. **Implementers work on develop-based branches and land by PR; the
   controller pulls develop between tasks; reviews read the squash diff on
   develop.** Why: keeps every task's review scoped to exactly what merged,
   never to in-flight state. Cost if wrong: none — procedural.
3. **Task 1's real-repo check must reproduce the twelve measured sample
   paths exactly; a difference is fixed in the pattern order and reported,
   never in the table.** Why: the table is a measurement, not a policy lever;
   the pattern order is the actual mechanism. Cost if wrong: a silently wrong
   surface-sample seed list. Lives: `packages/orrery/src/lib/surfaces.mjs`
   (Task 1).

### Tasks 1–4 review rulings

4. **Task 1's seed list is accepted as a pragmatic CANDIDATES set for 2a**
   (twelve measured paths, `apps/{hub,store}` patterns prepended before the
   generic `apps/*` fallback so libra's admin app sorts correctly). Why: the
   generic fallback still serves any body outside the two donors; hand-tuning
   further would over-fit to two repositories. Cost if wrong: a third body
   with an unusual app-naming scheme needs its own pattern, visible the first
   time surface sampling runs against it. Lives:
   `packages/orrery/src/lib/surfaces.mjs`.
5. **Markers are namespaced `$union` / `$fromSide` / `$parameter`, not bare
   `union`/`fromSide`.** `resolveMarkers` originally sniffed bare option keys,
   so a real ESLint rule option object carrying a key named `union` or
   `fromSide` would crash or silently be dropped instead of being treated as
   an ordinary option. A parameter marker is recognised only as a single-key
   object `{ parameter: string }`. Why: correctness — an option object and a
   marker object must never be confused, and the `$`-prefix makes that
   syntactically impossible. Cost if wrong: none (the namespacing is a pure
   safety property; nothing depended on the bare-key behaviour). Lives:
   `packages/orrery/src/lib/markers.mjs`, `packages/orrery/src/lib/reconcile/eslint.mjs`
   (`resolveMarkers`); plan Tasks 2, 3, 6, 9 amended in the same PR.
6. **Task 4 Ruling F1 (stylelint):** `undefined` means "inherit the preset's
   default" (on, for stylelint-config-standard rules); explicit `null` is a
   disable. On beats off, so the inherited default wins: `chosen = {
   $inherit: true }`, the bundle writer omits the key so the preset applies,
   test `"strictest"`, the note names the rule the donor disabled. Why: "on
   over off" is the ordering rule already in force; inherit is what "on"
   means when neither side wrote an explicit value. Cost if wrong: aeleos's
   three disabled rules come back on — which is the spec's own stated
   ordering, so "wrong" here would mean the spec itself needs revisiting.
   Lives: `packages/orrery/src/lib/reconcile/stylelint.mjs`,
   `packages/orrery/src/lib/bundle/tools.mjs` (`toolRows` skips `$inherit`
   rows).
7. **Task 4 Ruling F2 (knip):** parameter paths are kind-qualified —
   `knip.apps.extraEntries`, `knip.apps.extraProjects`,
   `knip.packages.extraEntries`, `knip.packages.extraProjects` — rather than
   one shared path. Why: apps and packages are different kinds of workspace
   member with different extension semantics; a shared path would conflate
   them. Cost if wrong: none. Lives: `classes/next-supabase-mono/schema.mjs`,
   `packages/orrery/src/lib/bundle/tools.mjs` (EXTENDERS).
8. **The `{test,spec}` glob fold is anchored** (`/\*\*\/\*\.test\.tsx?$/` and
   the `{ts,tsx}` form both fold to `**/*.{ts,tsx}`), and both-sides-off with
   different spelling (`null` vs `false`) becomes `agree` with chosen `null`
   rather than residue. Why: an unanchored substring replace turned
   `**/*.test.tsx` into `**/*.{ts,tsx}x` — a latent defect neither donor's
   data happened to trigger; the both-off case is not a real conflict, only a
   spelling difference. Cost if wrong: none. Lives:
   `packages/orrery/src/lib/reconcile/knip.mjs`.

### Task 5's three residue rulings

The corner the plan explicitly reserved ("any residue at T5 ... stops for
Heiner") arrived at Task 5's real run against both donors. Recorded in full,
literal form in `.superpowers/sdd/2026-09-09-phase-2b-reconciliation/task-5-rulings.md`
before this workspace was deleted; summarised here.

9. **`testing-library/no-dom-import` (unit-test, tier class) → `["error",
   "react"]`.** Both sides already error; the framework argument adds the
   autofix and names the right module. Cost if wrong: none — severity is
   unchanged either way. Lives: `PRE_RULINGS` in
   `packages/orrery/src/lib/reconcile/ordering.mjs`.
10. **`no-restricted-syntax` (e2e, tier physics) → a hand-written union keyed
    by selector.** Where both donors ban the same selector, aeleos's message
    is kept (it names no body file or helper); libra-only selectors keep
    their ban with the message rewritten to name no body file
    (`.claude/rules/e2e-selectors.md`) or helper (`tid`); aeleos's combined
    label/placeholder selector is dropped as subsumed by libra's two longer
    ones; libra's four Supabase entries (ports, the localhost fallback,
    `getLocalSupabaseEnv`) are body data and become the parameter
    `e2e.restrictedSyntax` (default `[]`). This is a literal union rather
    than a keyed `$union` marker because `optionsOf` strips messages and a
    physics-tier message must never name a body file. Cost if wrong: libra
    keeps its Supabase bans only if its own config sets the parameter — the
    donor's prediction must carry it, and it does. Lives: `PRE_RULINGS` in
    `packages/orrery/src/lib/reconcile/ordering.mjs`; libra's bodyConfig
    (`docs/predictions/libra.json`) sets `e2e.restrictedSyntax`.
11. **`playwright/expect-expect` (e2e, tier class) → `["error", {
    assertFunctionNames: { $parameter: "e2e.assertFunctionNames" } }]`.** A
    body's own assertion-helper names are body data. Cost if wrong: none —
    libra's six helpers live in its own config. Lives: same `PRE_RULINGS`
    block; schema gains `e2e.assertFunctionNames`.

### Task 6's rulings

12. **The `(body?) => object` contract in the plan's Interfaces is the
    authority: a generated tool function must yield the schema's own
    defaults for an omitted body.** `literal()` renders every `$parameter` in
    a tool function as an optional chain with the schema default embedded at
    generation time (`body.hooks?.preCommit ?? []`), the defaults read from
    `classes/next-supabase-mono/schema.mjs` via `withDefaults({}, schema)`
    and passed in by `writeBundle`. Why: the generated `hooks()`/`knip()`
    functions threw when called with no argument, which violated the plan's
    own interface contract and would have broken any caller (including
    `orrery check`, Phase 2d) that inspects a class's defaults without a real
    body. Cost if wrong: none — the defaults are exactly what the schema
    already declares. Lives: `packages/orrery/src/lib/bundle/eslint.mjs`
    (`literal`), `packages/orrery/src/commands/bundle.mjs`.
13. **A `chosen` row that is a `$parameter` marker AND an EXTENDERS splice
    target is consumed only by the splice, never also emitted as its own
    field.** The original objectFromRows + EXTENDERS design double-handled
    parameter rows (`knip.apps.extraEntries` appeared both as its own key and
    spliced into `entry`). Cost if wrong: none — the data still reaches
    `entry`/`project` either way; this only removes the stray duplicate key.
    Lives: `packages/orrery/src/lib/bundle/tools.mjs`.
14. **`knip.mjs` returns the class's abstract `{ apps, packages, root }`
    shape, by the plan's own design; the mapping to knip's real `workspaces`
    shape is out of scope for 2b.** Recorded, no action taken in 2b — carried
    to Phase 2d (see below).
15. **Corner: `resolveEslintBin` walks up from a directory to find
    `node_modules/eslint/package.json`, ignoring `NODE_PATH` and global
    folders**, rather than resolving via `createRequire` (which vitest's
    worker `NODE_PATH` made succeed from any temp dir once eslint entered
    Orrery's own dependency tree — a corner outside Task 6's own files,
    brought to the owner: "go"). The existing throws-when-not-installed test
    became the regression test; the mechanism is recorded as a hard-won fact
    in `CLAUDE.md`. Cost if wrong: eslint resolution silently succeeds from
    the wrong directory again. Lives:
    `packages/orrery/src/lib/effective-config.mjs`
    (`resolveEslintBin`/`findEslintManifest`); `CLAUDE.md`.

### Task 7's rulings

16. **Every pinned dependency's floor becomes the HIGHER of the two donors'
    installed versions, as a caret range** (measured against all 3,706
    non-off rule/surface pairs; only `@next/eslint-plugin-next` was
    functionally short at `^16.2.4` against aeleos's installed `16.3.0`,
    which is why `rulings.json` had silently adopted a rule the pinned
    version didn't carry). Not a corner — this executes the plan's own
    stated rule ("versions from donors"); it corrected a wrong plan
    constant, not a plan gap. Cost if wrong: a floor bump on a caret range,
    nothing structural. Lives: `packages/orrery/src/lib/bundle/plugins.mjs`
    (`dependenciesFor`), `packages/orrery/package.json`, the lockfile; a
    regression pre-check in the bundle-honesty test asserts every ruled
    ESLint rule exists in the installed plugin.
17. **The fixture body declares `eslint` as its own devDependency** (accepted
    deviation): `resolveEslintBin` walks up from the fixture, and Orrery's
    own eslint lives under `packages/orrery`, not the workspace root. Whether
    an adopted body keeps eslint as a direct devDependency, or runs Orrery's
    binary via `orrery check`, is a Phase 2d design point — recorded, not
    decided here. Cost if wrong: none in 2b; a 2d design choice either way.
    Lives: `packages/orrery/fixtures/next-supabase-mono/package.json`.

### Task 8's park

18. **`installedCommit`'s lockfile regex is parked**: it matches only pnpm's
    codeload-tarball shape for `@vaoan/orrery`, not the `git+https://...#sha`
    / `resolution: {type: git, commit}` shape. The 2b spec (lines 112–119)
    itself defers the exact pnpm subpath/install syntax to Phase 2d, and
    until cut-over every body reads `installed: null` by design, so this is
    not a functional gap yet. Cost if wrong: a wrong "not installed" note
    surfaces in an on-demand `orrery observe` run after a body adopts via the
    git+https shape — visible, not silent. Lives:
    `packages/orrery/src/lib/observe/version.mjs`. Carried to Phase 2d.

### Task 9's rulings

19. **Corner (the owner's "go with your recommendation"): a pre-ruled rule's
    options are defined once and applied on every surface where either
    donor has the rule on.** Resolved on the first conflict surface in
    `SURFACE_ORDER` and reused (or, absent a conflict surface, resolved
    against the adopt row's own sides with the absent side empty), keeping
    each surface's own severity. `PRE_RULINGS` gained an optional `surfaces`
    list so a pre-ruling scoped to e2e or unit-test never bleeds onto source
    or script. Separately: **an empty object as an ARRAY ELEMENT inside a
    rule's option object is a RegExp lost by `--print-config`, and becomes
    residue unless pre-ruled** (a bare `["error", {}]` top-level options
    object is not flagged — that is a legitimate empty-options rule). Why:
    the reconciler adopted `i18next/no-literal-string`'s `words.exclude`
    verbatim on the `source` surface (where it was pre-ruled and the
    RegExps intentionally replaced with the parameter) but adopted it
    one-sidedly, with the RegExps silently lost, on `script`/`package` (where
    no pre-ruling existed to catch it) — a measurement gap the reconciler
    could not previously detect. Cost if wrong: i18next tightens on libra's
    `source`/`script`/`package` surfaces, visible in its prediction. Lives:
    `packages/orrery/src/lib/reconcile/ordering.mjs` (`PRE_RULINGS`,
    `surfaces` field), `packages/orrery/src/lib/reconcile/eslint.mjs`
    (lost-RegExp detection).
20. **`observe` must never die on a single tool's crash.** Each tool inside
    `codeDrift` is caught individually; a crash records `{ crashed: true,
    message }` for that tool, prints `<body>: <tool> crashed: <message>` to
    stderr, marks the run failed (exit 1), and the run continues with the
    remaining tools and bodies — the report is always written. Why: an
    unhandled rejection from one tool's empty-stdout crash previously aborted
    every remaining body and produced no report at all — the opposite of
    what a diagnostic tool should do on partial failure. Cost if wrong: none.
    Lives: `packages/orrery/src/lib/observe/code.mjs`.
21. **The S1–S6 bundle-gap rulings**, made after Task 9's first real
    observation run against both donors exposed six structural gaps the
    plan's own machinery could not see until run for real:
    - **S1** — `eslint.base.mjs` sets `languageOptions.globals` per surface
      from the `globals` package: `script` gets `node`; `unit-test`/`e2e` get
      `node + browser`; `source`/`component`/`package` (type-aware, no-undef
      off by measurement) get none. Cost if wrong: a few spurious `no-undef`
      hits, visible in predictions. (A first implementation added globals to
      the TS surfaces regardless of `no-undef`'s state; a review rejected
      that as conflating ESLint globals with TypeScript's own lib globals,
      and it was reverted to the conditional form.)
    - **S2** — `STANDARD_ELEMENTS` gains a generic `{ type: "package",
      pattern: "packages/*/src", capture: ["package"] }` so the `package`
      surface, which carries boundaries rules, has an element at all. Cost if
      wrong: boundaries violations on packages until a body configures its
      own edges — visible, and the parameter exists for it.
    - **S3** — the template `tsconfig.json`'s `include` widens to
      `["apps/*/src", "apps/*/tests", "apps/*/e2e", "packages/*/src",
      "packages/*/tests"]`, matching what both donors' own per-app tsconfigs
      already include. Cost if wrong: `tsc` types test files it did not
      before — which the donors already do.
    - **S4** — `tightenedFor` uses the same comparison helper as
      `effectiveMismatches` (one comparison, with the prettier carve-out), so
      the fixture's `tightened` set is correctly near-empty by construction.
    - **S5** — the fixture's own sources became lint-clean under the bundle
      (readonly props, jsdoc params, no bare user-facing string literals) —
      the fixture is the reference body, so its second `observe` run must
      exit 0.
    - **S6** — `i18next/no-literal-string`'s pre-ruling gets `surfaces:
      ["source", "component", "package"]`; on `script`, libra's bare `[2]`
      (plugin default mode) is adopted as before. Cost if wrong: scripts
      keep default-mode i18next, which is what both donors already run.
    Lives: `packages/orrery/src/physics/eslint.base.mjs`,
    `packages/orrery/src/lib/boundaries.mjs`,
    `packages/orrery/templates/next-supabase-mono/tsconfig.json`,
    `packages/orrery/src/lib/observe/code.mjs` (`tightenedFor`),
    `packages/orrery/fixtures/next-supabase-mono/`,
    `packages/orrery/src/lib/reconcile/ordering.mjs`.
22. **`.husky/pre-commit`'s template stays a `pnpm orrery hook pre-commit`
    one-liner; the verb itself is not built in 2b.** In 2b the template is
    only byte-compared, never executed; `orrery hook` (Phase 2e) knows only
    `commit-msg` and `pre-push`. The verb belongs next to `init` in Phase 2d,
    which is the first phase that writes the template into a real body. Cost
    if wrong: one verb built later; nothing in 2b depends on it existing yet.
    Lives: `packages/orrery/templates/next-supabase-mono/.husky/pre-commit`.
    Carried to Phase 2d.

### Task 10's rulings

23. **T1 — `defaultRun` returns `{ stdout, stderr, status }`; each tool's
    parser reads the stream that tool actually uses** (stylelint and ls-lint
    write their reports to stderr even on a clean run; eslint, jscpd, cspell,
    syncpack use stdout). A crash is a non-zero exit with no parseable report
    on either stream. Cost if wrong: none — this is a factual correction
    (stylelint/ls-lint were being read from the wrong stream and reading as
    false crashes).
24. **T2 — syncpack is invoked against a body's own `.syncpackrc`** rather
    than a bundle-supplied config, because every `--config <path>` shape
    panics the installed 14.3.1 Rust binary (measured directly, both shapes
    tried). Accepted as a 2b trade-off: after adoption the body's rc *is*
    the bundle's (a pointer file), so the body-side check becomes exact; for
    the on-demand diagnostic against an unadopted donor, the syncpack result
    stays informational. Cost if wrong: a syncpack drift in an unadopted
    donor goes unreported by `observe` until adoption. Lives:
    `packages/orrery/src/lib/observe/code.mjs`. Carried to Phase 2d (a
    scratch-dir invocation shape, if the binary ever accepts one).
25. **T3 — the class's unit-test ESLint block gains `ignores:
    ["**/e2e/**"]`.** aeleos's e2e sample glob matched both the unit-test and
    e2e surface globs, leaking 28 testing-library/vitest rules onto its e2e
    surface. The fixture gained an e2e spec file in aeleos's own layout so
    the honesty test can assert the leak is gone. Cost if wrong: none — this
    closes a real double-match.
26. **T4 — `compareToPrediction` semantics**: a rule is `unexplained` only
    when it has real violations, is not in `tightened`, AND is either absent
    from the prediction's counts or exceeds the predicted count. A rule
    violated at baseline but never tightened by the bundle is recorded under
    `baseline` in the prediction and classified in ADR 0016 (donor's own
    finer override, or genuine body data) rather than flagged as
    unexplained. `tightenedFor` became settings-aware for `boundaries/*`
    (tightened whenever the class's `boundaries.elements` differ from the
    body's effective setting on that surface). `better-tailwindcss`: the
    donors disagreed on whether `settings["better-tailwindcss"]` exists at
    all (aeleos sets an entry point, libra does not); per the fallback
    instruction ("if the donors disagree in a way that needs a non-obvious
    ruling, say so and leave the base unchanged"), the hand-written base was
    left as-is — every rule already carries its own `entryPoint` option from
    the rulings, so the settings key would have been redundant. Cost if
    wrong: the failure mode this specifically avoids is a permanently "red"
    observation report that never converges — every count stays visible in
    the committed predictions either way. Lives:
    `packages/orrery/src/lib/observe/code.mjs` (`compareToPrediction`,
    `tightenedFor`); `docs/decisions/0016-observation-baseline.md`.
27. **libra's `(fatal)` eslint-parse count and boundaries-edge counts are
    body data, not bundle gaps.** 91 of 101 `(fatal)` files are
    `apps/*/e2e`/`packages/*/tests` files libra's own per-app tsconfigs
    exclude from their project (the type-aware project service uses a
    body's nearest tsconfig; the shared bundle tsconfig cannot override it);
    10 are stale `eslint-disable` directives. Ruling: libra widens its own
    per-app tsconfig includes and prunes the stale directives at cut-over
    (ruling 6 keeps per-app include/exclude in the body, by design); the
    prediction records the `(fatal)` count and `compareToPrediction`
    excludes `(fatal)` from `unexplained` by design, since it is a parse
    failure, not a rule violation. Cost if wrong: none — visible in the
    on-demand diagnostic either way. Lives:
    `docs/decisions/0016-observation-baseline.md`, `docs/predictions/libra.json`.
    Carried to Phase 2d (libra's own cut-over work).

### The design change (ADR 0017)

The owner's "no scheduled observation" ruling (quoted in full above) is
recorded as its own decision record rather than restated here in full. Its
mechanical consequences: the nightly `tooling` job and the registry
`observe` flag were dropped from Task 10's scope before they were built; the
Phase 2e nightly `.github/workflows/observe.yml` was deleted outright (not
reduced to one job); `orrery observe <body>` and `orrery repo apply` stay
on-demand commands; the committed predictions and ADR 0016 serve that
on-demand diagnostic; a body's own reusable CI job (`orrery check`, wired by
`init`) becomes the enforcement point, carried to Phase 2d. See
`docs/decisions/0017-no-scheduled-observation.md` for the full decision and
`docs/specs/2026-09-08-phase-2b-reconciliation-design.md` /
`docs/specs/2026-09-08-phase-2e-repository-policy-design.md` for the pointer
each spec now carries to it.

### The final review's closing rulings

A whole-branch review (`cd4d8d8..develop`) found five Critical and several
Important findings; the controller ruled each is the spec asserting itself
(C2–C4 restate lines already in the design document), not new scope.

28. **C1 — every generated tool file must be usable by its own tool.**
    Per-tool shape tests hand each generated config to the tool's own loader
    or documented contract (prettier's function via a `prettier.config.mjs`
    pointer template calling it, rather than a bare object the `"prettier"`
    package.json pointer field cannot hold a function for; lint-staged keys
    left as whole glob strings, never split into a nested object; syncpack
    `versionGroups` rendered as an array, matching its own JSON schema). Cost
    if wrong: none — these are pure bug fixes each tool's own loader now
    proves. Lives: `packages/orrery/tests/bundle-shapes.test.mjs`,
    `packages/orrery/src/lib/bundle/tools.mjs`,
    `packages/orrery/templates/next-supabase-mono/prettier.config.mjs`.
29. **C2 — the class renders a real boundaries base and resolver, and
    marker attributes are enforced everywhere.** aeleos's layered boundaries
    policy becomes the class base (aeleos's own `identity` element moves out
    to become aeleos's body data via `boundaries.elements`/`boundaries.allow`),
    followed by `...body.boundaries.allow`; `eslint.base.mjs` gains
    `settings["import/resolver"] = { typescript: { project: [...] } }` (both
    donors resolve import aliases); `literal`/`resolveParameters`/`matches`
    now THROW on an unknown marker attribute (this is I5, folded into C2 —
    it is the same defect class that let `boundaries/dependencies`'s `base:
    "a"` attribute silently vanish, shipping a boundaries policy with no
    base rules at all, all of which "agreed" only because they'd agreed with
    each other). Cost if wrong: boundaries violations appear in predictions
    where they did not before — which is the rule working as designed, not a
    regression. Lives: `packages/orrery/src/lib/boundaries.mjs`,
    `packages/orrery/src/physics/eslint.base.mjs`,
    `packages/orrery/src/lib/markers.mjs` (`assertMarker`).
30. **C3 — physics carries no body-named opinion.** Adopted
    `no-restricted-syntax`/`no-restricted-imports`/`no-restricted-properties`
    rows whose options named a specific path, file, or framework are
    parameterised (a universal subset stays in physics; a per-surface
    `restrictedSyntax`/`restrictedImports`/`restrictedProperties` body
    parameter, default `[]`, carries the rest); the e2e `no-restricted-syntax`
    union gets a per-rule tier override to `class` via a new
    `TIER_OVERRIDES` table in `tiers.mjs` (its content — testing-library
    selector bans — is a framework opinion, not physics); a permanent guard
    test asserts no physics row's `chosen` contains a path-like token. Cost
    if wrong: libra sets its own parameters at cut-over — visible, not
    silent. Lives: `packages/orrery/src/lib/reconcile/tiers.mjs`
    (`TIER_OVERRIDES`), `classes/next-supabase-mono/schema.mjs`
    (`restrictions.<surface>` parameters).
31. **C4 — every rule ships at `error`, never `warn`.** 158 rows that had
    landed at warn were lifted to error (test `"strictest"`, note "no rule
    ships at warn (spec)"); reconcile, bundle, and predictions rerun. Cost if
    wrong: none — the spec's sentence is explicit and unconditional. Lives:
    `packages/orrery/src/lib/reconcile/ordering.mjs`.
32. **C5 — status-aware crash detection for every tool**, not only eslint:
    exit 0 is clean; non-zero with a parseable report on the tool's own
    stream is findings; anything else is a crash. One regression test per
    tool with empty streams and a non-zero status. Cost if wrong: none.
    Lives: `packages/orrery/src/lib/observe/code.mjs` (`statusAware`).
33. **I1 — `observe` fails (not merely warns) on config errors other than
    "missing", on real local violations, and on a pointer that "differs"
    once any pointer file exists.** Cost if wrong: none — these are
    tightenings of what already counted as failure, never a loosening.
34. **I2 — a body's own `orrery.config.mjs` wins over a prediction's
    `bodyConfig` when present**; a `bodyEffective` read error is recorded
    and fails the run rather than being swallowed. Cost if wrong: none.
35. **I6 — `loadLocal` checks file existence and propagates import errors**
    rather than treating any load failure as "no local config". Cost if
    wrong: none.
36. **The `fix-` blocklist rule is scoped to `fix/` branches only.** The
    blocklist's leading-word check (`phase-`, `task-`, `step-`, `wave-`,
    `round-`, `fix-`) was type-agnostic, so `feat/fix-typos-in-readme` — a
    legitimate description — was rejected. Ruling: `fix-` is a plan label
    only when it restates the branch's own `fix/` type; the other five
    leading words stay type-agnostic (they never coincide with a real
    branch type). One test per leading word, plus both `fix-` cases. Cost if
    wrong: none. Lives: `packages/orrery/src/lib/git-flow.mjs`
    (`planLabel`).
37. **`PLAN_LABEL_PATTERN` is anchored on label+digit tokens**, not on any
    word starting with a plan-shaped prefix: `phase-2b`, `task-5`, `2b-`,
    `t5-` are rejected; `task-runner`, `round-corners` are accepted as real
    descriptions; `3d-viewer` stays rejected because `3d` is itself a
    digit-token (a real 3D-viewer branch must say `three-d-viewer` or name
    what it renders instead). Cost if wrong: none — one test per case.
    Lives: `packages/orrery/src/lib/git-flow.mjs` (`planLabel`,
    `DIGIT_TOKEN`, `LETTER_DIGIT_TOKEN`, `LABEL_WORD`).

### The reports rule's consequences

38. **ADR 0016 is reduced to decision prose that points at generated
    artefacts for every number**, rather than hand-copying per-surface
    counts, runtimes, and tightened/baseline set sizes into markdown tables.
    Why: the owner's standing rule (quoted above) — every report must be
    regenerable by a command, never by hand-copying AI output, and must
    carry a machine-readable twin. Cost if wrong: none — this is the same
    rule this very record follows. Lives:
    `docs/decisions/0016-observation-baseline.md`.

## Deviations from the spec table, recorded

- **`hooks.preCommit` is a parameter**, where the spec's tool table says
  "union of checks; parameter: none". Accepted: the checks a body's
  pre-commit hook runs beyond lint-staged are body scripts (a `pnpm test:
  smoke` or similar), which cannot be a physics union by their nature — they
  name commands the class does not know about. Lives:
  `classes/next-supabase-mono/schema.mjs` (`hooks.preCommit`).
- **`syncpack` is observed against a body's own `.syncpackrc`**, not a
  bundle-supplied config, because every `--config <path>` shape panics the
  installed Rust binary (14.3.1 and 15.3.3 both tried). See Task 10 ruling
  24 above.

## Carried to Phase 2d

The full list, as recorded during execution, lives in
`.superpowers/sdd/2026-09-09-phase-2b-reconciliation/carried-to-2d.md`
before this workspace's deletion; restated here so it survives that
deletion:

- Body-side enforcement: an `orrery check` job in the reusable `ci.yml`,
  wired by `init` (`versionDrift`, `pointerDrift`, `effectiveMismatches`) —
  ADR 0017.
- `installedCommit`'s lockfile regex knows only the codeload-tarball shape;
  the `git+https` shape waits on the install syntax (Task 8's park, ruling
  18 above).
- The `orrery hook pre-commit` verb (the template points at it; the physics
  `hooks.mjs` defines the check it should run) — ruling 22 above.
- `knip.mjs` returns the class's abstract `{ apps, packages, root }` shape;
  the mapping to knip's real `workspaces` shape is the pointer writer's job
  — ruling 14 above.
- `observe`'s syncpack run tests the body's own `.syncpackrc`; the body-side
  check becomes exact only after adoption — ruling 24 above.
- I3: non-eslint tool counts are recorded but not compared as `moved`; `tsc`
  measures the scratch tsconfig, which carries no per-app `paths` — either
  drive per-app tsconfigs into the scratch config, or drop `tsc` from
  `observe` until 2d.
- I4: keys the reconcilers silently ignore today — cspell `overrides`/
  `import`, knip `ignoreDependencies`/`ignoreBinaries`, lint-staged globs
  not of the `*.{…}` form, pre-push hook checks — stay body-local for now;
  make them residue (a loud stop) in 2d rather than a silent skip.
- I7: dead schema fields (`tsconfig.{types,exclude,paths}`, `ignore.secrets`)
  — read them, or remove them.
- I8: add the class-named eslint export `./eslint/next-supabase-mono`
  beside the plain `./eslint`, completing the tier-as-export-path contract
  the design document states.
- I9: the i18next pre-ruling drops `callees.exclude`, so
  `new Error("…")`/`console.error("…")` calls count as untranslated copy
  (libra 1,426, aeleos 796 hits in the baseline observation). Revisit as
  either a `$union` with lost-RegExp elements dropped, or a parameter.
- No-restricted-properties shape/message normalisation across surfaces (the
  Wave A re-review's out-of-scope observation).
- The React/Radix-named message on the package surface's no-restricted-*
  rows — class-shaped content that landed in physics by spirit rather than
  by the letter of the token guard (the token guard checks for path-like
  tokens, not framework names).
- libra's `queryByText` ban, restated at cut-over as body data rather than
  a physics opinion (the same C3 edge case as above, on the other side).
- The stray `fatal: not a git repository` line a vitest subprocess prints
  during pre-push — harmless, did not block a push, but worth finding which
  test spawns git outside a repository.
- Minor polish noted by the final review but not folded into Wave A/B: an
  ordinal tie silently favours `optionsA`; `EXEMPTION_KEY` matches
  `disallow*` generally rather than one named rule; a single-sided jscpd
  threshold is labelled `agree`; no-restricted-properties messages differ
  by path; body-config validation imports the class module before
  validating `class`; `report.mjs` does not name which pointer files
  differ; `donors.mjs` parses `.prettierrc` as JSON only and reads fields it
  never uses.

## Data

Every number in this record's lineage lives in a generated artefact, never
copied by hand here:

- `docs/decisions/rulings.json` and the per-tool records `docs/decisions/0004-eslint.md`
  through `0015-hooks.md` — generated by `pnpm orrery reconcile`.
- `docs/predictions/*.json` — generated by `pnpm orrery observe --predict`.
- `docs/observations/2026-09-11-tooling.{md,json}` — generated by
  `pnpm orrery observe`, the current baseline (superseding the
  `2026-09-10` pair, which PR #35 re-recorded against).
- `docs/decisions/0016-observation-baseline.md` — the baseline record,
  itself reduced to prose pointing at the observation and prediction files
  above (ruling 38 above).
- `docs/decisions/0017-no-scheduled-observation.md` — the design-change
  record for the owner's "no scheduled observation" ruling, quoted in full
  above.
