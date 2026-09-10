# ADR 0016 — observation baseline: aeleos and libra

**Date:** 2026-09-10
**Status:** accepted
**Spec:** docs/specs/2026-09-08-phase-2b-reconciliation-design.md
**Amended by:** ADR 0017 removes the nightly run this record's provenance section
originally described; the predictions below remain the on-demand baseline.

## What this is

The first real recording of `orrery observe --predict` against both donors, once
the tool-report-stream, e2e-surface-overlap, and baseline-aware-comparison fixes
of PR #32 (`f9b6c9d`) landed. It captures what adoption will surface — counts,
not verdicts. **These are predictions of what adoption will surface, recorded so
drift is visible. They are not rulings; the rulings are 0004–0015.**

## Provenance

Both donors at a clean, installed checkout; nothing under either was modified
by any command below.

| | aeleos | libra |
|---|---|---|
| HEAD (before and after) | `5e70a21bda1333f8bedffb775c64fba96074ae96` | `1c79de7225efc2a5241d2c940ba213a4444e6df9` |
| `git status --short` (before and after) | `?? docs/superpowers/plans/2026-09-08-drop-target-legibility.md`, `?? docs/superpowers/specs/2026-09-07-drop-target-legibility-design.md` (pre-existing, unrelated to this task) | clean |

Commands, both exit 0:

```
pnpm orrery observe Z:/Github/aeleos Z:/Github/libra --predict --report docs/observations
pnpm orrery observe Z:/Github/aeleos Z:/Github/libra --report docs/observations
```

`bodyConfig` written into each prediction file before the `--predict` run (the
real entry points `observe` cannot infer before a body has its own
`orrery.config.mjs`):

- **aeleos:** `class: "next-supabase-mono"`, `tailwind.entryPoint:
  "apps/hub/src/app/globals.css"`. No `e2e` parameters — aeleos's own e2e
  selector/assertion conventions became the `chosen` value directly (see ADR
  0004/rulings.json's `no-restricted-syntax`/e2e row), not a parameter.
- **libra:** `class: "next-supabase-mono"`, `tailwind.entryPoint:
  "apps/store/src/app/globals.css"`, plus the two parameters the rulings named
  as libra's own body data: `e2e.restrictedSyntax` (the four Supabase-specific
  entries from the `b` side of the `no-restricted-syntax`/e2e row — the
  `Literal[value=54321]`, `Literal[value=64321]`, the `127.0.0.1:(54321|64321)`
  fallback, and the `getLocalSupabaseEnv` ban) and `e2e.assertFunctionNames`
  (the six names from the `b` side of the `playwright/expect-expect`/e2e row:
  `expectVisible`, `expectHidden`, `expectAuthenticatedAcrossApps`,
  `createProduct`, `createPaymentMethod`, `setPermissions`).

## Runtime

| run | wall clock |
|---|---|
| `--predict`, both donors, all 7 tools | 4m38.3s |
| check (no `--predict`), both donors, all 7 tools | 4m3.8s |

Both runs exit **0** for both donors: zero eslint effective-config mismatches on
every surface, zero unexplained violations.

## Per-surface eslint tightened counts

Of the ruled eslint rows for that surface (a rule × surface row with a `chosen`
value and a `tier`), how many differ from the donor's own pre-adoption effective
config for that surface (and so the bundle actually changes something there):

| surface | ruled rows | aeleos tightened | libra tightened |
|---|---|---|---|
| source | 631 | 53 | 61 |
| component | 640 | 54 | 62 |
| unit-test | 189 | 15 | 59 |
| e2e | 197 | 25 | 51 |
| script | 144 | 62 | 61 |
| package | 616 | 116 | 51 |
| **total distinct rules tightened** | — | **157** | **134** |

(The per-surface numbers don't sum to the total: a rule tightened on one
surface and already matching on another counts once in the flat `tightened`
list `observe --predict` writes.) aeleos's `package` surface tightens the most
(116) — the class's `package`-surface conventions (boundaries, workspace
import rules) are the surface furthest from what a single-app-shaped donor
config already enforced. libra's `unit-test` and `e2e` surfaces tighten far
more than aeleos's (59 vs. 15, 51 vs. 25) — libra's own config was thinner on
those surfaces before adoption.

## Predicted violations per tool per donor

| tool | aeleos | libra |
|---|---|---|
| eslint | 2682 across 33 rules | 6551 across 41 rules |
| tsc | 1327 across 17 TS codes | 1491 across 16 TS codes |
| stylelint | 10 | 274 |
| jscpd | 14 clones | 91 clones |
| cspell | 0 | 0 |
| ls-lint | 0 | 401 |
| syncpack | 0 | 0 |

## The three known expectations, checked

1. **"libra shows `unicorn/filename-case` violations in the hundreds (Phase 0's
   codemod was never run)."** Confirmed: 396. Also visible independently
   through `ls-lint`'s own kebab-case check (401 file-level failures — a
   superset, since ls-lint flags a file once per naming violation regardless of
   how many eslint messages that produces).
2. **"aeleos shows stylelint findings in `globals.css`."** Confirmed: aeleos's
   10 stylelint findings are concentrated in `apps/hub/src/app/globals.css`
   (`no-descending-specificity`, `no-duplicate-selectors`,
   `property-no-vendor-prefix`) and `docs/design/iterations/frame.css`.
3. **"both show sonarjs threshold violations."** Confirmed: aeleos tightens
   `sonarjs/cognitive-complexity`, `sonarjs/max-lines-per-function`, and
   others (physics rows where aeleos's own config was looser); libra's own
   `sonarjs/cyclomatic-complexity` and `sonarjs/expression-complexity` are
   tightened for the same reason (rows where libra was the looser side).

## `baseline` — violated, but not created by adoption

A rule with real violations that the bundle did **not** tighten for that donor
(the donor's own pre-adoption config already matched the ruling's `chosen`
value on that surface) is `baseline`, not `unexplained`: `compareToPrediction`
(PR #32) only flags a rule `unexplained` when it's absent from the prediction's
`baseline`/`counts` or newly above the recorded count. Every `baseline` rule
below is debt that already existed under the donor's **own** rule before Orrery
ever touched it — adoption doesn't create it, it just means every file in the
tree gets linted for the first time in one pass instead of piecemeal.

**aeleos** (3 rules, 257 violations):

| rule | count | why it's baseline |
|---|---|---|
| `better-tailwindcss/enforce-consistent-class-order` | 110 | aeleos was the stricter side (`strictest`, rulings row `a=[1] b=[0]`); the ruling adopted aeleos's own value, so aeleos's own config already enforced it |
| `better-tailwindcss/no-unknown-classes` | 140 | same — aeleos strictest (`a=[2] b=[0]`), ruling is aeleos's own value |
| `unicorn/numeric-separators-style` | 7 | physics `strictest`; aeleos's own options (with `hexadecimal.onlyIfContainsSeparator: true`) are the stricter, chosen side |

**libra** (12 rules, 341 violations):

| rule | count | why it's baseline |
|---|---|---|
| `@typescript-eslint/no-magic-numbers` | 34 | libra-only rule, `adopt`; the ruling is libra's own existing config verbatim |
| `playwright/expect-expect` | 2 | `parameter`; `e2e.assertFunctionNames` in libra's prediction is libra's own six real helper names, so libra's own config already matches |
| `playwright/no-conditional-in-test` | 8 | libra-only rule, `adopt` |
| `react/no-danger` | 1 | libra-only rule, `adopt` |
| `sonarjs/deprecation` | 3 | physics `strictest`; libra was the stricter side (`a=[0] b=[2]`) |
| `sonarjs/different-types-comparison` | 23 | physics `agree`; both donors already had it |
| `sonarjs/function-return-type` | 1 | physics `agree` |
| `sonarjs/max-lines` | 1 | physics `strictest`; libra's 400-line threshold is stricter than aeleos's 1000 |
| `sonarjs/no-alphabetical-sort` | 5 | physics `agree` |
| `sonarjs/no-selector-parameter` | 1 | physics `agree` |
| `sonarjs/prefer-read-only-props` | 244 | physics `strictest`; libra was the stricter side (`a=[0] b=[2]`) |
| `sonarjs/prefer-regexp-exec` | 3 | physics `agree` |

## Body data, not baseline: libra's `(fatal)` count and TS2307

Two more counts are recorded but explicitly excluded from both the
`unexplained`/`baseline` eslint comparison and the tightened-rule accounting,
because they aren't rule violations at all:

- **libra's eslint `(fatal)` count — 101.** `compareToPrediction` excludes the
  `(fatal)` bucket from "unexplained" by design (`code.mjs`'s
  `violationsByRule`: a message with no `ruleId` — a parse/type-information
  failure ESLint can't attribute to a rule — buckets under the literal key
  `"(fatal)"`). It comes from two body-data causes already known before this
  run: libra's own per-app tsconfigs excluding `apps/*/e2e` and
  `packages/*/tests` (91 of the 101 — type-aware rules can't parse a file
  outside any tsconfig's `include`) and ten stale `eslint-disable` directives
  (10) referencing rules the bundle no longer disables the same way. Both are
  libra's own data to fix at the cut-over, not a bundle defect.
- **TS2307 ("cannot find module") — 880 of aeleos's 1327 tsc errors, 1283 of
  libra's 1491.** `tsc` isn't gated by `compareToPrediction` at all (that
  function only ever looked at `code.eslint`), so this doesn't fail the check
  run, but it's real signal: the class's shared `tsconfig.json` carries only
  compiler flags (planning ruling 6 — per-app `types`/`include`/`paths` stay
  in each app's own tsconfig, under the class `extends`). Until each donor's
  per-app tsconfig contributes its own `paths` (workspace package aliases,
  `@/`-style roots), the scratch tsconfig `observe` materialises can't resolve
  those imports — this is the same shape of body data as the `(fatal)` count
  above, not a new problem.
