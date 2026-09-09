# ADR 0003 — one repository policy, applied by command

**Date:** 2026-09-08
**Status:** accepted
**Spec:** docs/specs/2026-09-08-phase-2e-repository-policy-design.md

Every repository in the constellation runs the two-branch flow defined in
`policy/repository.json`, applied by `orrery repo apply`. Orrery was the first
repository brought to policy, on 2026-09-08, before any body.

| Setting | Value | Deciding test |
|---|---|---|
| default branch | develop | consistency: libra, Puck, Janus already |
| routes into main | release/*, hotfix/* only | strictest: a hotfix is big words |
| feature merge | squash | consistency: every repo already allows it |
| release merge | merge commit | benefit: main keeps develop's commits intact |
| back-merge | merge commit, automatic | strictest: a squash would leave main "ahead" forever |
| rebase merge | disabled | strictest: rewrites history |
| approvals | 0, PR required | benefit: bots merge unattended; checks are the gate |
| squash title / body | PR title / PR body | strictest: the validated title, not "commit or PR title" |
| linear history | off on both | consistency: both branches take merge commits by design |
| signatures | not required | ruled 2026-09-08 |

The policy file is the record of the values; this ADR is the record of why.

## Known limits

- **Push restrictions are undetectable.** Task 3 normalises `restrictions` to
  `null` on both the policy side and the read-back side, so drift in push
  restrictions cannot be seen by `orrery repo apply`. Push restrictions exist
  only on organisation-owned repositories, and `vaoan` is a personal account,
  so the field cannot drift today. Revisit this if the constellation moves to
  an organisation.
- **Branch protection requires a public repository on this account.**
  GitHub's free personal plan refuses to protect a branch on a private
  repository (403 "Upgrade to GitHub Pro or make this repository public").
  Task 4 hit this against the fixture repository, which was made public for
  that reason. A future private body needs GitHub Pro, or to be made public,
  before `orrery repo apply` can protect it.

## Application log

| Body | Date | Status | Detail |
|---|---|---|---|
| Orrery | 2026-09-08 | applied | develop created from main, settings, protection, 11 labels; required checks added after PR #2 merged: 5 on main, 6 on develop |
| aeleos | 2026-09-09 | deferred | 16 operations (dry run 2026-09-09; apply deferred to the production cut-over by the owner's decision; nightly observe stays in report mode) |
| libra | 2026-09-09 | deferred | 14 operations (dry run 2026-09-09; apply deferred to the production cut-over by the owner's decision; nightly observe stays in report mode) |
| Puck | 2026-09-09 | deferred | 14 operations (dry run 2026-09-09; apply deferred to the production cut-over by the owner's decision; nightly observe stays in report mode) |
| eclipse-con | 2026-09-09 | deferred | 16 operations (dry run 2026-09-09; apply deferred to the production cut-over by the owner's decision; nightly observe stays in report mode) |
| Janus | 2026-09-09 | deferred | 14 operations (dry run 2026-09-09; apply deferred to the production cut-over by the owner's decision; nightly observe stays in report mode) |

The flow was exercised end to end on Orrery before any body: release v2026.09.09.1 (PR #7, merge commit), hotfix through main (PR #9), automatic back-merge (PR #8).

## Amendments

- **2026-09-09:** main now receives only `release/*` and `hotfix/*`; `fix/*`
  moved to develop alongside `feat/*`, and a `hotfix/*` PR's title carries
  type `fix`. Reason: the first real release exposed that the back-merge PR
  failed two checks, and the agent hot-fixed through main without asking. The
  owner tightened the route to the two branch types above and added the rule
  that an agent cornered into an unplanned fix must stop and ask instead of
  taking the hotfix route on its own judgment.
