# ADR 0016 — observation baseline: aeleos and libra

**Date:** 2026-09-10
**Status:** accepted
**Spec:** docs/specs/2026-09-08-phase-2b-reconciliation-design.md
**Amended by:** ADR 0017 removes the nightly run this record's provenance
section originally described; the predictions below remain the on-demand
baseline.

## What this is

The first real recording of `orrery observe --predict` against both donors,
once the tool-report-stream, e2e-surface-overlap, and baseline-aware-
comparison fixes of PR #32 (`f9b6c9d`) landed. **These are predictions of what
adoption will surface, recorded so drift is visible. They are not rulings;
the rulings are 0004–0015.**

## Provenance

Both donors at a clean, installed checkout; nothing under either was modified
by any command below. Donor SHAs: aeleos `5e70a21`, libra `1c79de7`.

```
pnpm orrery observe Z:/Github/aeleos Z:/Github/libra --predict --report docs/observations
pnpm orrery observe Z:/Github/aeleos Z:/Github/libra --report docs/observations
```

## `baseline` classification

A rule with real violations the bundle did **not** tighten for a donor (its
pre-adoption config already matched the ruling's `chosen` value there) is
`baseline`, not `unexplained` — debt that predates Orrery. Two shapes recur:
`strictest`-tier rows where the donor was already the stricter side (aeleos's
`better-tailwindcss/*`, `unicorn/numeric-separators-style`; libra's
`sonarjs/deprecation`, `sonarjs/max-lines`, `sonarjs/prefer-read-only-props`),
and `agree`-tier rows both donors already matched, plus libra-only `adopt`
rows verbatim from libra's own pre-existing config
(`@typescript-eslint/no-magic-numbers`, `playwright/no-conditional-in-test`,
`react/no-danger`). One `parameter` row also lands `baseline`:
`playwright/expect-expect` / `e2e.assertFunctionNames` — libra's prediction
uses libra's own six real helper names, so libra's own config already
matches.

## Body data, not baseline

Ruling-5 granularity: the donors' finer per-app overrides collapse into six
surfaces (source, component, unit-test, e2e, script, package); per-app
specifics below that granularity stay in the body, never the bundle. Two
counts are excluded from `unexplained`/`baseline` entirely, as neither is a
rule violation: libra's eslint `(fatal)` count (its own per-app tsconfigs
exclude `apps/*/e2e` and `packages/*/tests`, plus stale `eslint-disable`
directives — libra's data to fix at cut-over) and TS2307 "cannot find module"
(the class's shared `tsconfig.json` carries only compiler flags per ruling 6;
per-app `paths` stay in each app's own tsconfig, so the scratch tsconfig
`observe` materialises can't resolve those imports until a donor's own
tsconfig contributes them).

## Data

The generated artefacts, not this document, carry every number:
`docs/predictions/aeleos.json`, `docs/predictions/libra.json`,
`docs/predictions/next-supabase-mono.json`;
`docs/observations/2026-09-11-tooling.{md,json}` — the current baseline,
re-recorded by PR #35 (`fix(bundle): usable tool configs, real boundaries, no
body opinion in physics`); `docs/observations/2026-09-10-tooling.{md,json}` —
the pre-#35 record, superseded by the pair above.
