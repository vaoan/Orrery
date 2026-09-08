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
| routes into main | release/*, fix/* only | strictest: predictable release line |
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
