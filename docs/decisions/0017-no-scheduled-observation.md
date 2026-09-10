# ADR 0017 — no scheduled observation

**Date:** 2026-09-10
**Status:** accepted
**Spec:** docs/specs/2026-09-08-phase-2b-reconciliation-design.md,
docs/specs/2026-09-08-phase-2e-repository-policy-design.md

## Decision

The owner, 2026-09-10, verbatim:

> "i kinda dont want a tool that monitors the others. i want the others to get
> the information from this one and they take care of themselves. i do want
> the option to trigger from here to know whats up but we dont need to be a
> nightly thing"
>
> "when the other tools get the configs from this one, they should throw
> errors, right? thats the point of this tool"
>
> "remove the 2e nightly too"

Orrery does not run a scheduled job of any kind against the bodies. Nothing in
this repository polls the constellation on a timer.

## Consequences

- **No scheduled job of any kind in Orrery.** Both the nightly `tooling`
  observation planned in the 2b spec (Task 10, `.github/workflows/observe.yml`
  cloning every registered body and running `orrery observe` against it) and
  the 2e nightly repository-policy observation (the same workflow's
  `repository-policy` job, running `orrery repo apply --dry-run` against every
  body) are removed. `.github/workflows/observe.yml` is deleted outright, not
  reduced to one job — there is no job left to keep it for.
- **Orrery is the source; bodies fail on their own.** A body's lint config
  *is* the bundle it pulls from Orrery (`@vaoan/orrery/eslint`, `/tsconfig`,
  `/stylelint`, …) — that dependency is itself the enforcement, the same way a
  body already fails its own build on a real type error without Orrery
  watching for it. Orrery does not need to also watch the body from outside
  for the same drift its own config already causes the body to catch.
- **A body's own CI gains a drift-check job.** The reusable `ci.yml` every
  body calls (`vaoan/Orrery/.github/workflows/ci.yml@main`) gains a job, built
  in Phase 2d as `orrery check` and wired into a body by `orrery init`, that
  fails the body's own PR when: the pinned `@vaoan/orrery` version is behind
  (`versionDrift`), a pointer file was hand-edited instead of regenerated
  (`pointerDrift`), or the body's effective config no longer equals the
  rulings on some surface (`effectiveMismatches`). All three functions already
  exist in `packages/orrery/src/lib/observe/`; Phase 2d wires them into a
  command a body's own CI runs against itself, rather than Orrery running them
  against a clone from outside.
- **`orrery observe <body>` and `orrery repo apply` stay as on-demand
  commands**, run from Orrery, locally or via `workflow_dispatch`, exactly as
  built in Phase 2a/2b/2e. Nothing about their implementation changes — only
  the removal of a timer that used to call them automatically.
- **The committed predictions (`docs/predictions/*.json`, ADR 0016) serve the
  on-demand diagnostic** a developer or the owner runs by hand when they want
  to know "what's up" — the option the owner explicitly kept — without Orrery
  polling for it.
- `registry.json` carries no `observe` field. It was proposed (2b plan, Task
  10, ruling 8: "The nightly tooling observation clones only bodies flagged
  `observe: true`...") only to gate which bodies the now-removed nightly job
  would clone; with no nightly job, there is nothing to gate.

## Pointers left in older documents

Rather than rewrite the 2b and 2e spec/ADR text that described the nightly (a
record of what was actually decided and built at the time), each place that
describes it now carries a one-line "Amended by ADR 0017" pointer to this
record:

- `docs/specs/2026-09-08-phase-2b-reconciliation-design.md` — the `orrery
  observe` section's "nightly and on every Orrery PR" paragraph.
- `docs/specs/2026-09-08-phase-2e-repository-policy-design.md` — the "Drift in
  any of them is observed nightly from Orrery and corrected" paragraph.
- `docs/decisions/0003-repository-policy.md` — a new `## Amendments` entry
  (the table's historical "deferred... nightly observe stays in report mode"
  rows are left as the record of what was actually applied on those dates).

`docs/plans/2026-09-08-phase-2e-repository-policy.md` (Task 12, already
executed) is left untouched — it is the historical plan record for a task
that ran and merged before this decision, not a live spec.
