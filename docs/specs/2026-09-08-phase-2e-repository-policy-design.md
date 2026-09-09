# Phase 2e — Repository policy: one git flow, applied by a command

**Date:** 2026-09-08
**Status:** approved design, awaiting plan
**Extends:** `docs/specs/2026-09-06-orrery-design.md` (CI, in three directions)
**Sibling:** `docs/specs/2026-09-08-phase-2b-reconciliation-design.md` (the tooling bundle)
**Order:** runs before 2b. Its first application is Orrery itself.

## What this phase produces

One git flow for every repository in the constellation, Orrery included,
written as a policy file and applied by a command. Branch structure,
protection, merge methods, naming, titles, and the checks that enforce them
are the same everywhere, from a project's first commit onward. Drift in any of
them is observed nightly from Orrery and corrected.

Orrery is a template for new projects. A project born through `orrery init`
is on the flow and protected before its second commit exists.

## Principles

Inherited from the 2b spec and applied here: strictest wins; everything is
shared unless it is one repository's data; Orrery is never blocked by a body;
deterministic enforcement, tested on its own; as little manual as possible.

The flow was chosen for being predictable. Where predictability and
convenience conflict, predictability wins, and the spec says so at each point.

## The flow

Measured 2026-09-08: libra, Puck and Janus run a two-branch flow with
`develop` default and `main` as the release line; aeleos runs trunk-only with
squash auto-merge on open; Orrery and eclipse-con have no protection at all.
libra's flow is adopted everywhere, tightened.

### Branches

| Branch | Role | Protected |
|---|---|---|
| `main` | the release line; what production and every body's "latest" point at | yes |
| `develop` | the default branch; where all work lands | yes |
| `type/short-kebab-description` | one branch per change; deleted on merge | no |
| `release/vYYYY.MM.DD.N` | cut from develop by `orrery release`; the only planned route into main | no |
| `hotfix/short-kebab-description` | a hotfix; the only unplanned route into main; its title type is fix | no |

`type` is one of `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `chore`,
`revert`. The description is kebab-case. Any other name is rejected by the
pre-push hook and again by CI, so a bad name never reaches a pull request.

### Routes and merge methods

| From | Into | Method | Why |
|---|---|---|---|
| `type/*` | `develop` | squash | one commit per change; its message is the PR title; develop reads as a changelog |
| `release/*` | `main` | merge commit | main keeps develop's squashed commits intact; a release is one mergeable point |
| `hotfix/*` | `main` | squash | a hotfix is one commit; its title carries type fix |
| `main` | `develop` | merge commit, automatic | the back-merge; a squash would create a different commit and main would stay "ahead" forever |

Rebase merging is disabled everywhere: it rewrites history and defeats the
freshness rule. A `type/*` branch targeting `main`, or a `release/*` or
`hotfix/*` branch targeting `develop`, fails the Branch Target check.

### The back-merge and the develop freeze

This is the sequence the flow exists to guarantee. It is deliberately
cumbersome; quality outranks convenience.

1. A `hotfix/*` or `release/*` PR merges into main. main now has commits
   develop lacks.
2. A workflow opens the back-merge PR from main into develop immediately, with
   automerge on. Green, it merges within minutes.
3. While main has any commit develop lacks, **every PR into develop fails the
   `branch-sync` check**. Nothing in the feature PR can fix it; the message
   names the open back-merge PR and says it must land first.
4. When the back-merge lands, GitHub's "require branches to be up to date"
   setting refuses to merge any PR whose branch lacks develop's new head. Each
   author updates from develop, CI reruns, and they continue.
5. The only human moment is a back-merge that conflicts. It is resolved once,
   inside that PR. The next release carries the resolution back to main.

`branch-sync` is one command: fetch, then `git rev-list --count
origin/develop..origin/main` must be zero.

### Pull request titles

Conventional, checked by CI on open and on every edit:

```
type(scope): subject [GH-n]
```

- `type` is the same set as branch types and **must equal the branch's type**.
  A `fix/*` branch with a `feat:` title is rejected; a `hotfix/*` branch
  carries a `fix` title.
- `subject` is at most 80 characters.
- Exactly one `[GH-n]`. `GH-000` is the explicit marker for on-the-fly work
  with no issue. Any other number must resolve to an existing issue in that
  repository, checked by CI, so a typo cannot pass as a reference.

Squash merges use the PR title as the commit message, which is what makes
develop's history a changelog.

### Local commits

A `commit-msg` hook checks every local commit against the same conventional
format, so the history inside a PR is readable before it is squashed. The
`pre-push` hook checks the branch name and runs the union of both donors'
pre-push checks. Both hooks ship in the bundle as `orrery hook <name>` and the
body's `.husky/` files are one-line pointers, verified by `observe`.

### Reviews and protection

Applied identically to `main` and `develop` on every repository:

| Setting | Value | Why |
|---|---|---|
| required approvals | 0 | bots (bump, back-merge) must merge unattended; the checks are the gate |
| required status checks | every shared CI job, strict (branch must be up to date) | the freeze in step 4 |
| conversation resolution | required | a human blocks by commenting |
| linear history | off on both | main takes release merge commits; develop takes back-merge merge commits; squash is enforced by the allowed-methods setting instead |
| enforce for admins | on | the owner is not exempt |
| force push, deletion | forbidden | |
| signed commits | not required | decided 2026-09-08; the per-machine key setup was not worth it |
| allowed merge methods | squash, merge | rebase disabled |
| delete branch on merge | on | |
| auto-merge | allowed | |

CODEOWNERS is not used for enforcement; with one owner it would only block
the bots. The Puck PR template is adopted for every repo, generated from the
policy so the route table in it cannot drift from the checks.

### Releases

`orrery release` on a body computes the next `vYYYY.MM.DD.N`, cuts
`release/` from develop, adds the version bump commit, and opens the PR into
main. When that PR merges, a workflow creates the GitHub Release from the
title, as libra does today. Nothing cuts a release on a schedule: a release
is the one deliberate moment in the flow. For Orrery, a release is what moves
"the latest" that every body must run.

## The repository policy file

`policy/repository.json` in Orrery is the single source for everything above
that is a setting rather than a file: default branch, the two protection rule
sets, merge methods, delete-on-merge, auto-merge, the label set, the PR
template, and the list of required check names. It is versioned like the
bundle. A change to it is a normal PR in Orrery.

## `orrery repo apply <owner/name>`

Applies the policy file to one repository through the GitHub API:

1. Creates `develop` from `main` if it is missing, and sets it as default.
2. Writes the protection rules on `main` and `develop`.
3. Sets merge methods, delete-on-merge, and auto-merge.
4. Creates or updates labels and the PR template.

Idempotent: against a repository already in the state it changes nothing and
says so. Its output is a diff of what it changed. Its test runs against a
throwaway repository it creates and deletes under a fixed name.

It runs at three moments:

- **Birth.** `orrery init` scaffolds, pushes, then runs `repo apply`.
- **Nightly, from Orrery,** against every body in the registry. This is the
  fourth drift alongside version, pointer and code. It re-applies rather than
  only reporting, and the observation report lists what it corrected.
- **On demand,** when the policy file changes.

Changing protection needs a token with admin rights. Orrery's CI holds that
one personal access token as its only secret. Bodies never see it.

## CI checks this phase adds

All are verbs on `orrery ci`, tested with fixture repositories, and required
on `develop` and `main` through the policy file:

| Verb | What it checks |
|---|---|
| `branch-target` | the head branch's type may target this base |
| `branch-name` | `type/short-kebab-description` or `release/vYYYY.MM.DD.N` |
| `pr-title` | conventional; type equals branch type; `[GH-n]` present and real, or `GH-000` |
| `branch-sync` | main has no commit develop lacks (PRs into develop only) |
| `config-drift` | libra's existing step: tooling files differ from the base only if this PR changed them |

The reusable `ci.yml` in Orrery, which bodies reference at `@main`, gains the
jobs that run these. The back-merge and release-creation workflows also live
in Orrery and are referenced the same way.

## Testing

- Each verb has unit tests on fixture repositories built in a temp directory:
  a fix landed on main must fail `branch-sync`; a merge-commit back-merge must
  make it pass; a squash back-merge must leave it failing (the trap the spec
  names). Bad and good branch names, titles, and targets are enumerated.
- `repo apply` is tested against a real throwaway repository, created and
  deleted by the test, asserting idempotence on the second run.
- The hooks are tested by running them as processes against a temp git repo.
- Every bug gets a regression test, sabotage-verified.

## Scope and order

1. The policy file and `repo apply`, tested against a throwaway repository.
2. Apply to Orrery itself: create develop, protect both branches, set merge
   methods. From this point every Orrery PR follows the flow.
3. The CI verbs and the reusable `ci.yml` jobs, the back-merge workflow, the
   release-creation workflow.
4. The `commit-msg` and `pre-push` hooks in the bundle.
5. `orrery release`.
6. `repo apply` wired into the nightly observation.
7. **Apply to the five bodies.** Deferred 2026-09-09 by the owner to the
   production cut-over that closes the whole programme; until then the
   nightly observation runs in report mode and Orrery is kept ready.

**Done when** Orrery runs on the flow with every check required, `repo apply`
is idempotent against every registered repository, and the fixture repository
integration test brings a bare repository to policy and finds nothing to
change on the second run (the `init`-born fixture is Phase 2d's criterion).

Deferred: `init` itself, the registry, and the bump bot remain in 2d; this
phase gives them the policy file and the commands they call.

## Decisions taken during the brainstorm

- Two branches everywhere, Orrery included. "Orrery is for everyone."
- Squash into develop; merge commits for releases; squash for fixes with an
  automatic merge-commit back-merge.
- The develop freeze while a back-merge is open, accepted as cumbersome and
  worth it.
- Zero approvals, all checks required, conversations resolved, admins bound.
- `[GH-n]` kept, must be real; `GH-000` marks on-the-fly work.
- Signatures not required.
- Releases cut by a command, never by a schedule.
- 2e runs before 2b and is applied to Orrery first.
- Amended 2026-09-09: main only receives `release/*` and `hotfix/*`; `fix/*`
  lands on develop. A hotfix is big words. And: when execution corners the
  agent into an unplanned fix, it stops and asks; a needed fix means a
  misunderstanding or a plan conflict.
- Amended 2026-09-09: the bodies are not touched until the production
  cut-over; every phase leaves Orrery ready and proven read-only.
