# ADR 0021 — Portia is the trial of the starter

**Date:** 2026-11-08
**Status:** accepted
**Spec:** docs/specs/2026-11-08-portia-design.md
**Amends:** the stage order in docs/specs/2026-11-06-ai-layer-design.md (ADR 0019)

## Decision

Themis builds a minimal starter and `themis init` before AI-layer stages 1 to 4,
cut to what one new body needs, and creates Portia with them as the first body.
Portia is the test of whether a body born under Themis comes out right.

The owner chose this on 2026-11-08, from three approaches put to them (the
spec's "Approaches considered"):

> vamos con C y probamos si lo que hicimos en themis funcionó. Si no, borramos
> portia y arreglamos lo que necesitemos en themis.

and on 2026-11-11:

> Mi interes es que Themis funcione perfecto

## Consequences

- Parts of stages 5 and 6 come first: `themis init` without `--adopt`, `check`,
  `status` or `promote`; the git install path; the reusable `ci.yml`; a thin
  starter. The rest of stages 5 and 6 keeps its place.
- Stages 1 to 4 are unchanged, and stage 1 still waits on the owner's Libra trial.
- If Portia does not come out right, it is deleted, Themis is fixed, and Portia is
  recreated from the spec, which is written to survive that.
- The spec's "How the trial is judged" is the acceptance for this decision.
