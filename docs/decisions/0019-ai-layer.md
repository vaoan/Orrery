# ADR 0019 — the AI layer

**Date:** 2026-11-06
**Status:** accepted
**Spec:** docs/specs/2026-11-06-ai-layer-design.md
**Plan:** docs/plans/2026-11-06-stage-0-instruction-load.md

## Decision

Themis builds the AI layer as the spec describes it: the build-time system that
makes Claude competent in every body. It amends
`docs/specs/2026-09-06-themis-design.md`.

The owner, 2026-11-06, took three decisions, each on a recommendation put to
them. Verbatim from the spec's "The owner's decisions":

> 1. **The AI layer installs without the tooling.** Adopting ESLint as well would
>    mean a large cleanup per body; the 2026-09-11 observation predicts over 2,000
>    violations in AeleOS alone. A new body created by `themis init <name>` gets both,
>    because it starts with nothing to clean up.
> 2. **unichat and InstaTray are in scope, for the AI layer only.** Consequently the
>    plugin is self-contained, needs Node on the machine but no npm install in the
>    repository, and takes its configuration from a file that is not `package.json`.
> 3. **Verification blocks at delivery.** It blocks commit, push, and pull request,
>    and adds one reminder per session. It does not block every response.

## Consequences

- **What this changes in older documents** is the spec's "What this changes"
  table. This record points to it and does not copy it.
- `docs/specs/2026-09-06-themis-design.md` carries the status line
  "approved; amended by ADR 0019, partly implemented".
- Root `CLAUDE.md` no longer says nothing is implemented; it points to the spec
  and the stage 0 plan as current work. Trimming the root is stage 1.
- Later work on the AI layer cites this record for why it exists.
