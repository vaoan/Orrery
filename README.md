# Themis

Constellation governance. Shared tooling, configuration, and AI documents for
every repository in the `vaoan` constellation.

Themis is the Titan of divine law and order: she keeps what is right, and why it
is right, from outside the quarrels she settles. This repository is that law. It
governs how projects are built. It contains no application code.

## Status

Design approved and partly built: see the commands table in `CLAUDE.md`. Named Themis until ADR 0022.

- **Design:** [`docs/specs/2026-09-06-themis-design.md`](docs/specs/2026-09-06-themis-design.md)
- **Next work:** [`docs/plans/2026-09-07-phase-2a-diff-eslint.md`](docs/plans/2026-09-07-phase-2a-diff-eslint.md) — CLI skeleton and `themis diff-eslint`, the tool that sizes the reconciliation
- **Decisions:** [`docs/decisions/`](docs/decisions/)

Phase 0 (libra's kebab-case migration) is [vaoan/libra#413](https://github.com/vaoan/Libra/pull/413).

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

**Channels.** Tooling ships as an npm package (`@vaoan/themis`); AI documents
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
themis init --class next-supabase-mono   scaffold a new body, register it
themis check                             validate a body has not drifted
themis status                            report every body's pinned version
themis promote <path> --to physics       lift a local rule into the shared tier
```

## Decisions

Reconciliation rulings live in [`docs/decisions/`](docs/decisions/).
