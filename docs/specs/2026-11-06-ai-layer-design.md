# The AI layer — making Claude competent in every body

**Status:** approved by the owner on 2026-11-06; stage order amended by ADR 0021
**Date:** 2026-11-06
**Amends:** `docs/specs/2026-09-06-themis-design.md` (see "What this changes")

## Intent

The owner reports that Claude feels unreliable and unprofessional across their
projects, and that this is why Themis exists. Themis so far governs repositories:
eslint, tsconfig, CI, branch policy. Channel 2 of the design, the Claude Code
plugin, and `themis init` were never built. That is the half this design builds.

The owner also wants one thing a new project can start from. Their first idea was
to turn Themis into a Next.js project and copy it. They then chose this route: Themis
stays a governor, and it creates new projects from a separate starter.

## What was measured

All measured 2026-11-06 on this machine. Figures are claims about that day.

| Finding | Evidence |
|---|---|
| Libra loads far over budget per session; the figure is in `docs/observations/2026-11-06-instructions-baseline.md` | 31 rule files, none with `paths:`, 252,501 bytes, plus a 314-line root `CLAUDE.md` |
| eclipse-con has the same shape, smaller | 21 rule files, none with `paths:`, 33,544 bytes, plus a 340-line root |
| AeleOS already solved loading | 11 of 12 rules scoped, 146-line root, skills, invariant re-injection, load logging. Its spec projected 80,200 → ~8,000 tokens at session start |
| Themis has none of it | One `CLAUDE.md`, no rules, no skills, no hooks. Its root also says "Nothing in this repository is implemented yet" beside a table of built commands |
| Sessions start in the wrong place | 560 of 859 of the owner's messages on this machine are in sessions started from `~`. Some were not development; much was unichat |
| The owner acts as QA | Most of the 20 strongest correction signals are "why doesn't X work", found by the owner. InstaTray has 0 test files of 47. Keyword filter, small sample |
| unichat and InstaTray sit outside Themis today | Java (296 and 22 `.java` files), no root `package.json`, not in the registry |
| Learning is already attempted, per repo | AeleOS `docs/lessons/`; unichat `.claude/mistakes.md` (75 lines). Neither reaches another repository |

**Not measured:** Themis's own sessions (3 messages on this machine; the work
happened elsewhere). The cause of "feels dumb" is inferred from these, not proved.
Published guidance on learning loops is anecdote; no benchmark was found.

## Goals

1. A session in any body starts with a small instruction load and gets the rest
   when it touches the relevant files. This is measured, not asserted.
2. Claude cannot commit, push, or open a pull request unless the body's checks ran
   on exactly that code.
3. A mistake becomes a machine check where possible, so it stops costing context.
4. All of this reaches every body from one place, including non-Node ones, and a fix
   lands everywhere.
5. A new project starts with all of it from one command.

## Non-goals

- Automatic rule writing. Claude proposes; a person reviews.
- Rewriting Themis, or moving it to Next.js.
- Designing the starter's contents here. That is a separate design (see Stage 6).
- Tooling adoption by existing bodies. ESLint and the rest, the currency gate, and
  bump PRs stay in phase 2d, on their own schedule.

## Anti-goals

This has failed, even if it works technically, when:

- Instruction volume grows, only somewhere new.
- The verification hooks nag until people disable them.
- One project's opinions reach `physics/`. The boundary rule still applies.
- A broken hook stops work in every body at once.

## Constraints already decided

These come from accepted records and are not reopened here.

- **No npm, no tags.** Bodies install `github:vaoan/Themis#main`; a release is a
  merge. The 2026-09-06 design's npm versioning and version-parity test are
  superseded by this (phase 2b design, "Decisions taken during the brainstorm").
- **No `warn` tier and no grace period** (same source).
- **Nothing scheduled.** Observation is on demand (ADR 0017). Every mining or
  reporting command here is one a person runs.
- **Themis is public.** Nothing shipped through it may contain a body's secrets,
  addresses, or internal hosts.
- **Reports are generated** with a `.json` twin beside the `.md`.
- **Documented platform facts:** a plugin can ship skills, agents, hooks, and MCP
  servers. It does not load a `CLAUDE.md`, and rules are not a documented plugin
  component. The skill listing is budgeted at 1% of the context window, and
  overflow drops the least-invoked descriptions. Stop hooks fire whenever Claude
  finishes responding, not only at the end of a task.

## Approaches

| | What | Trade-off |
|---|---|---|
| **A. Themis as the kit** | Themis ships the AI layer; `themis init` creates bodies from a separate starter | Longest. The only one where a fix reaches every body |
| B. A Next.js template repo | Copy it for each project | Fast, but leaves existing bodies as they are, and each copy diverges at once |
| C. Fix each repo by hand | Port AeleOS's pattern one by one | Immediate, but repeats the work and the drift returns |

**The owner chose A** on 2026-11-06. Its first stages deliver C's quick results.

## The owner's decisions

Taken 2026-11-06, each on a recommendation put to the owner:

1. **The AI layer installs without the tooling.** Adopting ESLint as well would
   mean a large cleanup per body; the 2026-09-11 observation predicts over 2,000
   violations in AeleOS alone. A new body created by `themis init <name>` gets both,
   because it starts with nothing to clean up.
2. **unichat and InstaTray are in scope, for the AI layer only.** Consequently the
   plugin is self-contained, needs Node on the machine but no npm install in the
   repository, and takes its configuration from a file that is not `package.json`.
3. **Verification blocks at delivery.** It blocks commit, push, and pull request,
   and adds one reminder per session. It does not block every response.

## Design

### Where an instruction lives

The rule that governs everything else. Take the first row that works.

| Order | Mechanism | Loads | Use for |
|---|---|---|---|
| 1 | Test, lint, or CI check | Never | Anything a machine can decide |
| 2 | Hook | Never, runs always | Must hold, and needs the session's state |
| 3 | Root `CLAUDE.md` | Every session | What this is, invariants, commands, an index of pointers |
| 4 | Rule with `paths:` | On a matching file | A constraint on some files |
| 5 | Skill | On invocation | A multi-step procedure |
| 6 | `docs/lessons/` | Never automatically | Why a rule exists: the incident, dated |

Each rule line links to its lesson, as AeleOS does. Limits: root under 200 lines,
rule files under 100 lines, and unscoped rules are an exception that needs a reason.

**Instruction budget,** in tokens at bytes ÷ 3 (AeleOS's conversion), counting the
body's own files and anything the plugin injects:

- At most 10,000 at session start.
- At most 25,000 in a task touching one vertical slice, read from the load log.
- A glob matching most of the source (`**/*`, `**/*.ts`) counts as unscoped.

Both numbers come from AeleOS's estimates and may be revised on measurement.

### Measuring it

Port from AeleOS and generalise:

- `InstructionsLoaded` hook, logging each load to a git-ignored directory.
- `themis instructions <body>...`: a report of cost per session, with a `.json` twin.
  It combines a static estimate, which works on a fresh clone, with the log.
- Re-injection of the invariants block after compaction (`SessionStart`, matcher
  `compact`), so the root can stay small.
- `check-agent-notes`, in `themis check`: a file changing under a note or a rule's
  `paths:` requires that note or rule to change too, and a glob that can match
  nothing fails.

### Proof of done

The diagnosis's main finding, and the part with the most risk of annoying people.

**Declaring.** A body lists its checks in `.claude/themis.json`, as `verify: [commands]`,
with optional `verifyIgnore` globs (default `**/*.md`, `docs/**`). This is a fast set,
aimed at under five minutes, that excludes anything needing services not normally
running. The rest stays in CI. Node, Java, or anything else works, since these are just
commands.

**Running.** `themis-verify`, a plugin executable, runs them. On success it writes a
stamp holding the fingerprint. The fingerprint is a hash of the content of tracked and
untracked non-ignored files, minus `verifyIgnore`. `HEAD` is not part of it, so
committing does not invalidate it.

**The gate** is a `PreToolUse` hook on Bash, for `git commit`, `git push`, and
`gh pr create`:

| Situation | Result |
|---|---|
| No `.claude/themis.json`, or no `verify` | Allow |
| Fingerprint matches the stamp | Allow |
| Only ignored files changed since the last commit | Allow |
| Otherwise | Block, telling Claude to run `themis-verify` |
| Internal error in the hook | Allow, and log |

**The reminder** is a Stop hook. A `SessionStart` hook records a baseline fingerprint,
so a tree already dirty at launch and a purely conversational session never trigger it.
The first time Claude stops with the fingerprint differing from both baseline and
stamp, it blocks once, telling Claude to say from then on whether each result it reports
was verified. It never fires again that session, and it respects `stop_hook_active`.

**Boundaries:**

- Only Claude's tool calls are gated. The owner's own terminal is untouched, and that
  is the route when `verify` cannot pass. There is no `warn` tier and no flag Claude can
  set to skip the gate.
- Command matching catches ordinary forms and is not a security boundary. Wrapped or
  aliased commands may pass; bodies with tooling still have their git `pre-push` hook.
- **Every hook fails open.** With no version pinning, a hook bug reaches every body on
  merge, and this is the guard against the anti-goal.
- A body should adopt with a green `verify`. If its suite is red, declare a narrower
  set and say so in the adoption PR.

**What this does not prove.** It proves the commands ran green, not that the feature
works; much of what the owner found was visible only on screen. So:

- `next-supabase-mono`'s default `verify` includes the browser suite when the change
  touches UI. Selecting by path is left to the builder.
- AeleOS's `picture-proof` becomes a class skill and `sabotage-verify` a physics
  skill. Every bug gets a regression test seen red against the original fault.
- InstaTray has no tests, so its `verify` starts as a build, which proves little. The
  adoption PR says so. Writing tests there is that body's own work.

### Learning from mistakes

1. **Capture.** A `/lesson` skill records the mistake, its cause, and what would
   have caught it, as one dated file in `docs/lessons/`. Never loaded automatically.
2. **Harden.** The skill walks the table above from the top and proposes the highest
   mechanism that can hold the lesson. If it is a check, the check must be seen
   failing on the original fault. If it is a rule, one line with a link.
3. **Mine, on demand.** `themis corrections <body>...` generalises the transcript
   script behind this design: it lists messages where a person corrected Claude,
   with a `.json` twin. A person reads it and runs `/lesson` on what matters.
   Transcripts stay on the machine, and the report is git-ignored because it quotes
   private messages.
4. **Share.** A lesson true for a repository that does not exist yet goes to Themis as
   a reviewed PR, through `themis promote` once stage 5 builds it and by hand before.
5. **Prune.** `themis instructions` flags rules that have not loaded across the
   logged sessions. A person decides whether to delete them.

Rejected for now: a Stop hook that spawns a headless Claude after each session to
propose edits (Pulumi's pattern). It costs money every session, and nobody has shown
it pays back. It can be added later without changing the rest.

### Starting in the right place

A session started from `~` gets no project settings, rules, or skills at launch.
`themis setup` adds one user-level `SessionStart` hook: when the working directory
is the home directory, it tells Claude to say so if the task belongs to a project.
It is one line of context and blocks nothing. The command is idempotent and shows
the change before writing to `~/.claude/settings.json`.

### Channel 2: the plugin

Built as the 2026-09-06 design lays out: `.claude-plugin/` and `plugin/` in this
repository, enabled per body through `.claude/settings.json`.

**Self-contained.** Hooks, `themis-verify`, and the check that runs inside a body ship
in the plugin and import nothing from `packages/themis`, so a Java repository needs
only Node on the machine. Commands that look across bodies (`themis instructions`,
`themis corrections`, `themis init`) stay in the CLI, run from a Themis checkout.

**Ship little.** The listing budget is real, and this owner already runs many
plugins, so descriptions compete. Version one ships at most about ten skills, each
with a reason recorded. Moving Libra's 38 skills wholesale is dropped; each skill
must now earn a place.

**How rules reach a body is unproved, so it gets tested first.** In order:

1. A plugin skill with `paths:`. The docs say it loads "automatically" on matching
   files and that plugin skills accept the field, but not whether the body is
   injected or only offered. Test it live with the `InstructionsLoaded` log and a
   canary line.
2. Failing that, a hook that adds context when a matching file is read.
3. Failing that, `themis init` writes `.claude/rules/` files as generated copies,
   marked as generated, and `themis check` fails on any difference. This is the
   least good because it copies, but it is checked.

Which one wins is recorded in a decision record before skills are written.

**Universal invariants** have no natural path, and a plugin cannot ship a `CLAUDE.md`,
so a plugin `SessionStart` hook (matchers `startup` and `compact`) injects them. They
count against the budget, so they stay very short.

**Shared content comes from the donors.** Libra's generic rules (SOLID, DRY, testing,
git) and AeleOS's are reconciled in stage 4, each with a decision record, under the
boundary rule. Stage 0 only trims Libra's copies. It does not decide what is shared.

### `themis init`, `check`, and the starter

- `themis init <name> --class next-supabase-mono` creates a repository from the
  starter's GitHub template, writes pointers from `packages/themis/templates/`,
  enables the plugin, applies repository policy with the existing `repo apply`, and
  opens the registry PR.
- `themis init --adopt` adds the AI layer alone to an existing repository: enables the
  plugin, writes `.claude/themis.json`, and registers the body as AI-only. Adoption
  stays a PR in that body.
- The registry records what a body has adopted, so AI-only bodies are excluded from
  anything that assumes the tooling. They use `class: null`, as Themis does.
- `themis-check`, in the plugin, validates the instruction budget and agent notes.
  `themis check` adds pointer validation for bodies with the tooling.
- `themis status` reports what each body has adopted. `themis promote` is built here.
- A new body's tooling needs the git install path and the reusable `ci.yml`, both
  unbuilt in phase 2d. Stage 5 builds those two. The currency gate and bump PRs stay
  in 2d.

**The dividing line for the starter:** governance is never copied. It stays in the
package and the plugin. Product code (the app, components, icons) is copied on
purpose and belongs to the new project from that day.

The starter is its own repository and a registered body, so Themis still holds no
application code. Its contents get a separate design. Known input: Libra, AeleOS, and
eclipse-con all use `lucide-react`, eclipse-con uses `shadcn`, and Libra has
`packages/ui`.

## Stages

Each stage is usable alone and has its own acceptance. The owner can stop at any.

| # | Stage | Where | Accepted when |
|---|---|---|---|
| 0 | Record the baseline first. Then Libra and eclipse-con: scope rules, move incidents to lessons, root under 200 lines. Knowledge is kept; duplicates may be deleted, listed in the PR | Those repos | Budget met when measured, and every removed paragraph is either elsewhere or listed as a duplicate |
| 1 | Themis on itself: trim root, fix stale claims, add `packages/themis/CLAUDE.md`, rules, invariants | This repo | Budget met; a fresh session answers "how do I add a command" correctly from what loads |
| 2 | `themis-verify`, the gate, and the reminder. Built here, trialled in unichat, where the owner actually works | This repo, unichat | All branches tested and sabotage-verified; a week of real use in unichat with no disabling |
| 3 | `/lesson`, `themis corrections`, the log half of `themis instructions` (its static half shipped in stage 0) | This repo | A real mistake goes from capture to a failing check |
| 4 | Plugin: rule-delivery test, reconcile shared content, move stages 1–3's generic parts out | This repo | A scratch repository, and one with no `package.json`, get hooks and skills by enabling the plugin alone |
| 5 | `init`, `check`, `status`, `promote`, git install path, reusable `ci.yml`. AI-layer adoption in order: AeleOS, Libra, eclipse-con, unichat, InstaTray. Puck and Janus when cloned on this machine | This repo, then bodies | `init` on the fixture passes `check`, lint, and typecheck; each adoption PR meets the budget; AeleOS drops its local copies of hooks and keeps its tier 3 |
| 6 | The starter, after its own brainstorm and design | New repo | Its own design decides |

**Stage 0 is the test of the diagnosis.** It comes first because it is independent and
cheap. After about five real sessions in Libra, the owner judges whether Claude is
better, with the before-and-after load figures to hand. This is a pause for the owner's
decision, not an automatic gate. If it is no better, the diagnosis is at least partly
wrong and stages 1 onward get reconsidered.

## Testing

- All hook logic lives in tested functions, called from thin hook entry points, as
  in AeleOS. Every branch of the Stop decision is tested, including fail-open.
- `claude plugin validate` in CI, plus a check that skills have non-empty descriptions.
- Skill triggering is tested with `claude plugin eval` where it is worth it.
- Line endings are normalised in any test that reads a file (hard-won fact).

## What this changes

Recorded in a new decision record, the first task of the plan:

| 2026-09-06 design says | Now |
|---|---|
| Convert 31 rules to skills | Rules stay rules, scoped by path; procedures become skills. Delivery is decided by test |
| Move 38 skills and 7 MCP servers to the plugin | At most about ten skills to start. MCP servers stay where they are until a body needs them shared |
| `themis init` writes pointers | It also creates from the starter; `--adopt` adds the AI layer alone to existing repositories |
| Every body adopts the whole package | The AI layer and the tooling adopt separately; a body may be AI-only and non-Node |
| Phase 2, then Phase 3 | Stages above; the reconciliation already built stays as is |
| Status: not yet implemented | Corrected when the root `CLAUDE.md` is |

Unchanged: the tiers, the boundary rule, no application code, the registry, the git
flow, on-demand observation.

## Left to the builder

- The fingerprint's implementation and the log's on-disk format.
- The exact shape of the registry's adoption field and of `.claude/themis.json`.
- How `verify` selects the browser suite by path.
- `themis corrections`' signal phrases, starting from this design's script.
- Which skills fill the first ten, within the boundary rule, with reasons recorded.
- Task breakdown inside each stage.

## Calls made without the owner

Reviewable, each easily changed:

- The budgets: 10,000 tokens at start and 25,000 in a task.
- `verify` as a fast set under five minutes, with the rest in CI.
- `.claude/themis.json` as the configuration file, separate from `themis.config.mjs`.
- "Nothing lost" meaning knowledge rather than bytes.
- About five sessions in Libra before the owner judges stage 0.
- The Stop reminder's wording: from then on, say whether results were verified.
- Trialling the hooks in unichat rather than Themis, which sees little use here.
- No automatic reflection hook.
- Stage 0 first, and the adoption order.
- `themis setup` for the home-directory note.
