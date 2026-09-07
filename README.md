# orrery

Constellation governance. Shared tooling, configuration, and AI documents for
every repository in the `vaoan` constellation.

An orrery is a clockwork model of a solar system — brass gears showing how every
body moves, sitting on a table *outside* the system it describes. This repository
is that model. It governs how projects are built. It contains no application code.

## Status

Design approved, not yet implemented.
See [`docs/specs/2026-09-06-orrery-design.md`](docs/specs/2026-09-06-orrery-design.md).

## The bodies

| Body | Repo | Role | Class |
|---|---|---|---|
| aeleos | `vaoan/AeleOS` | star | `next-supabase-mono` |
| libra | `vaoan/libra` | planet | `next-supabase-mono` |
| puck | `vaoan/Puck` | planet | `next-supabase-mono` |
| eclipse-con | `vaoan/eclipse-con` | planet | `next-supabase-mono` |
| janus | `vaoan/Janus` | planet | `next-supabase-mono` |

## How it works

Two delivery channels, three tiers.

**Channels.** Tooling ships as an npm package (`@vaoan/orrery`); AI documents
ship as a Claude Code plugin from this repo's marketplace. Content lives in the
package — bodies keep only small pointer files that contain a path and no policy.

**Tiers.** `physics/` applies to every body without exception. `classes/` applies
to an archetype, such as `next-supabase-mono`. Anything project-specific stays in
the body and is never touched.

The boundary rule: anything in `physics/` must be true for a repository that does
not exist yet. If justifying a rule requires naming a specific project, it is not
physics.

## Commands

```
orrery init --class next-supabase-mono   scaffold a new body, register it
orrery check                             validate a body has not drifted
orrery status                            report every body's pinned version
orrery promote <path> --to physics       lift a local rule into the shared tier
```

## Decisions

Reconciliation rulings live in [`docs/decisions/`](docs/decisions/).
