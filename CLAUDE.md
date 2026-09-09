# Orrery

An orrery is a clockwork model of a solar system — brass gears showing how every
body moves, sitting on a table *outside* the system it describes. This repository
is that model. It governs how every project in the `vaoan` constellation is built.

**It contains no application code, and it never will.** If you are about to add
some, you are in the wrong repository.

## Read first

- **The design (the authority):** `docs/specs/2026-09-06-orrery-design.md`
- **Decisions already made:** `docs/decisions/`
- **What to build next:** `docs/plans/` — Phase 2 is the current work

Nothing in this repository is implemented yet. The design is approved; Phases 0
and 1 happen in other repos. This repo is Phase 2 onward.

## The one rule that keeps this honest

> Anything in `physics/` must be true for a repository that does not exist yet.

If justifying a rule requires naming a specific project, it is not physics — it
belongs to a class, or it stays in that project. This is the check that stops one
project's opinions from quietly becoming everyone's. It is the reason this lives
in its own repository rather than inside `aeleos`.

## The constellation

| Body | Repo | Role | Class |
|---|---|---|---|
| aeleos | `vaoan/AeleOS` | star — identity provider | `next-supabase-mono` |
| libra | `vaoan/libra` | planet — store and payments | `next-supabase-mono` |
| puck | `vaoan/Puck` | planet | `next-supabase-mono` |
| eclipse-con | `vaoan/eclipse-con` | planet | `next-supabase-mono` |
| janus | `vaoan/Janus` | planet | `next-supabase-mono` |

`aeleos` is the centre of the *runtime* constellation — it owns the authoritative
`actors` table and derives one identity per human. Orrery is the centre of the
*build-time* one. They are different constellations and must not share a centre.

## Two channels, three tiers

**Channels.** Tooling ships as an npm package (`@vaoan/orrery`); AI documents ship
as a Claude Code plugin from this repo's own marketplace. Content lives in the
package — bodies keep only *pointer files* that contain a path and no policy.

**Tiers.** `physics/` binds every body. `classes/` binds an archetype. Anything
project-specific stays in the body and is never touched by sync.

The tier is an **export path**, not a directory anyone copies from:
`@vaoan/orrery/eslint/physics` versus `@vaoan/orrery/eslint/next-supabase-mono`.

## Commands the CLI will expose

```
orrery diff-eslint <repoA> <repoB>       rule-by-rule effective-config diff        (built, 2a)
orrery repo apply <owner/name>           bring a repository to policy/repository.json (built, 2e)
orrery ci <verb>                         branch-target, branch-name, pr-title, branch-sync, config-drift (built, 2e)
orrery hook <commit-msg|pre-push>        the git hooks, pointed at from .husky/    (built, 2e)
orrery release                           cut release/vYYYY.MM.DD.N from develop    (built, 2e)
orrery init --class next-supabase-mono   scaffold a new body, register it         (2d)
orrery check                             validate a body has not drifted          (2d)
orrery status                            report every body's pinned version       (2d)
orrery promote <path> --to physics       lift a local rule into the shared tier   (2d)
```

`diff-eslint` was built first. It sized the reconciliation: see
`docs/decisions/0002-eslint-reconciliation-input.md`.

## Working here

- The design document is the authority. If code and design disagree, the design
  wins until you change it deliberately and record why in `docs/decisions/`.
- Every reconciliation ruling gets a decision record. The point of this repo is
  that "why is this rule here" always has an answer.
- Prefer measuring the real repos over reasoning about them. Every number in the
  design doc came from running something against `aeleos` and `libra`, and two of
  the early conclusions were wrong until they were checked.

## Git flow, for every body and for this repository

`develop` is the default branch and takes `type/*` branches by squash. `main`
is the release line and accepts only two routes: `release/*` (merge commit,
cut by `orrery release`) and `hotfix/*` (squash, PR title type `fix`). Every
push to main is followed by an automatic merge-commit back-merge into
develop, and while main is ahead of develop, every other PR into develop is
frozen by `branch-sync`. PR titles are `type(scope): subject [GH-n]`, with
`GH-000` for work with no issue.

### When execution corners you

If executing a plan corners you into a fix you did not plan, stop. Say
explicitly that you are cornered and why, and ask the developer what to do. A
fix you need but did not plan means you misunderstood something or the plan
conflicts with itself, and that is critical for the developer to know. Never
take the hotfix route on your own judgment: a hotfix is big words, and it is
the developer's call.

## Hard-won facts worth not rediscovering

These cost real debugging during Phase 0 and apply to anything that manipulates
these repositories:

- **ts-morph's `SourceFile.move()` rewrites relative import specifiers only.**
  Non-relative ones (`@/…`, `shared/…`) are left untouched. libra has 914 of those
  against 364 relative.
- **`SourceFile.move(to)` resolves a relative `to` against the source file's own
  directory**, not the working directory. Pass absolute paths.
- **`core.ignorecase` is true on this machine.** A case-only rename needs a
  two-step `git mv` through a temporary name, and `git status` will report a clean
  tree while files sit renamed on disk. Recovery is
  `git reset --hard HEAD && git clean -fd`, never `git checkout`.
- **vitest treats `vi.mock()` at a path that does not exist as a silent no-op.**
  The suite stays green while the mock does nothing. Never take a passing suite as
  evidence that mock paths are correct.
