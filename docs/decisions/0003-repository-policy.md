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
- Applying the policy sets required approvals to 0 on both branches; a body
  that required approvals would lose that requirement. Measured 2026-09-09:
  all five bodies already require 0.
- `normaliseProtection` compares a fixed field set; `bypass_pull_request_allowances`,
  `require_last_push_approval` and `block_creations` are not compared, so
  drift there is invisible.
- The two Orrery secrets are one classic PAT with account-wide scope (owner's
  decision 2026-09-09); the reviewer recommends replacing it with two
  fine-grained tokens as a cut-over precondition.
- Bodies calling the reusable `ci.yml` get check-run names prefixed by the
  caller job (`<job> / test`), so the marker-based `requiredChecks` would name
  checks that never report; the check-name contract must be designed in
  Phase 2d before any body enables the shared CI.
- Tool-authored commits (`orrery release`'s bump) carry no agent trailers, by
  design.
- Until the GitHub App exists, the bot login is the account that owns the bot
  token, so the author check cannot distinguish the workflow from that
  account at a keyboard; the App and a `refs/heads/back-merge/**` creation
  ruleset are Phase 2d cut-over preconditions.

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
- **2026-09-09 (option B):** the back-merge goes through an intermediate
  `back-merge/<sha>` branch so "Update branch" never merges develop into main
  and strict stays on both branches; `back-merge/*` is automation-only,
  enforced by an author check now and by a GitHub App identity plus a
  creation ruleset in Phase 2d.
- **2026-09-10:** see ADR 0017 — the nightly repository-policy observation
  (point 6/7 above, and the "deferred... nightly observe stays in report
  mode" rows in the Application log) is removed. `repo apply` stays an
  on-demand command from Orrery; a body's own CI is what enforces policy
  drift against it now.
