# Stage 0: Instruction Load Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Measure the instruction load of Libra and eclipse-con, cut it to budget without losing knowledge, and hand the owner a before-and-after to judge.

**Architecture:** A static `orrery instructions` command reports what a body loads at session start and across a task. It runs before and after hand-reorganising each body's `.claude/rules/` and root `CLAUDE.md`. Stages 1 to 6 are deliberately not planned here: the design pauses after this stage for the owner's judgment.

**Tech Stack:** Node 24 ESM, vitest, `picomatch` (new explicit dependency of `packages/orrery`), git.

**Spec:** `docs/specs/2026-11-06-ai-layer-design.md`

## Global Constraints

- Budget, at bytes ÷ 3: at most 10,000 tokens at session start; at most 25,000 in a task touching one vertical slice.
- Root `CLAUDE.md` under 200 lines; rule files under 100 lines.
- A rule whose `paths:` globs match over 40% of a body's tracked source files counts as unscoped. (Plan's reading of the spec's "most of the source"; `**/*.tsx` is 49% of Libra's `.ts/.tsx/.mjs/.css` files and must not pass as scoped.)
- Knowledge is kept. Duplicates may be deleted only if listed in the PR.
- Reports are generated, with a `.json` twin beside the `.md`. Orrery is public, so committed reports contain file names and numbers, never a body's paragraph text.
- Commits and PRs follow each repository's own flow. In Orrery: squash into `develop`, titles `type(scope): subject [GH-000]`, branch descriptions say what changes.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; PR bodies end with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- **The owner merges Libra and eclipse-con PRs.** eclipse-con deploys on push to `main` unless only ignored paths changed.
- If execution corners you into an unplanned fix, stop and ask (root `CLAUDE.md`).

## Review Focus

1. A rule with malformed frontmatter, or `paths:` not starting on line 1: Claude Code loads it unscoped, so the report must count it at session start and not as scoped.
2. A rule file with CRLF line endings: its `paths:` must still parse.
3. `@imports` that are cyclic, missing, inside a code fence, or more than four hops deep (AeleOS's `apps/hub/CLAUDE.md` is only `@AGENTS.md`): the report must not crash or count fenced ones, and must follow only four hops.
4. A `--touching` path that does not exist: AeleOS measured that a read of a nonexistent path still triggers nested loads, so measure it by path and do not fail.
5. A body that is not a git repository or has no `CLAUDE.md`: report this per body and keep going with the other bodies, exiting 1.

---

### Task 1: Record the decision

**Files:**
- Create: `docs/decisions/0019-ai-layer.md`
- Modify: `docs/specs/2026-09-06-orrery-design.md:3` (status), `CLAUDE.md` (the "Nothing in this repository is implemented yet" paragraph and the commands table)
- Commit as well: `docs/specs/2026-11-06-ai-layer-design.md`, this plan

**Interfaces:** Produces the record later work cites. No code.

- [ ] **Step 1: Branch from an up-to-date `develop`**

Run: `git fetch origin && git switch -c docs/ai-layer-design origin/develop`

- [ ] **Step 2: Write ADR 0019**

Follow ADR 0017's shape. Decision: Orrery builds the AI layer per the spec. Quote the owner's three decisions from the spec's "The owner's decisions". Consequences: the spec's "What this changes" table, by pointer and not by copy.

- [ ] **Step 3: Correct the stale statements**

`docs/specs/2026-09-06-orrery-design.md:3` becomes `**Status:** approved; amended by ADR 0019, partly implemented`. In root `CLAUDE.md`, replace the "Nothing in this repository is implemented yet" paragraph with one line pointing to the spec and this plan as current work. Trimming the root is stage 1, not here.

- [ ] **Step 4: Verify, commit, and open the PR**

Run: `pnpm test`
Expected: all pass.

```bash
git add docs/decisions/0019-ai-layer.md docs/specs docs/plans/2026-11-06-stage-0-instruction-load.md CLAUDE.md
git commit -m "docs(decisions): the AI layer design and its stage 0 plan [GH-000]"
git push -u origin docs/ai-layer-design
gh pr create --base develop --fill
```

Expected: `orrery ci` checks green. The owner or the executor merges by squash.

---

### Task 2: `orrery instructions`

**Files:**
- Create: `packages/orrery/src/lib/instructions/measure.mjs`, `packages/orrery/src/lib/instructions/report.mjs`, `packages/orrery/src/commands/instructions.mjs`
- Modify: `packages/orrery/src/cli.mjs` (USAGE, COMMANDS), `packages/orrery/package.json` (`picomatch`), `pnpm-lock.yaml`, `CLAUDE.md` (commands table)
- Test: `packages/orrery/tests/instructions.test.mjs`, `packages/orrery/tests/instructions-command.test.mjs`

**Interfaces:**
- Produces, in `measure.mjs`:
  - `BUDGET = { startup: 10000, task: 25000 }`, `WIDE_GLOB_SHARE = 0.4`, `tokens(bytes) = Math.ceil(bytes / 3)`
  - `parseRule(text: string) -> { paths: string[] | null }`, where `null` means unscoped
  - `measureBody(dir: string, { touching?: string[], base?: string, allowLost?: string[] }) -> BodyMeasure`
  - `BodyMeasure = { body, sha, startup: { tokens, files: [{ path, bytes, reason }] }, task: { tokens, added: [{ path, bytes, reason }] } | null, wideRules: [{ path, share }], over: { startup: boolean, task: boolean }, oversize: [{ path, lines, limit }], skills: { count, descriptionTokens }, lost: string[] | null, error?: string }`
  - `reason` is one of `root`, `unscoped-rule`, `wide-rule`, `import`, `nested`, `path-rule`
- Produces, in `report.mjs`: `renderInstructions(measures: BodyMeasure[], { date, label, command }) -> { md: string, json: object }`. `command` is the invocation, shown in the md's header and kept in the json. `json` carries `lostCount` and never `lost`.
- Command: `orrery instructions <bodyDir>... [--touching body=path]... [--base <ref>] [--allow-lost <file.json>] [--report <dir>] [--label <name>]`. Exit 1 if any body has `error`, is over budget, has `oversize` entries, or has `lost` not allowed. Prints `lost` paragraphs to stdout only. Body name is the directory's basename in lower case.

**Loading model,** as documented and as AeleOS measured it:
- At start: root `CLAUDE.md`, `CLAUDE.local.md` if tracked, and every `.claude/rules/**/*.md` that is unscoped or wide. Add `@imports` of each.
- For a `--touching` path, in addition: `CLAUDE.md` in each directory from the file's up to the root, and each rule whose `paths:` match. Add their imports. Files count once across a task.
- Before measuring size, strip block-level HTML comments. Imports resolve relative to the importing file, skip code spans and fences, stop at four hops, and ignore cycles and missing targets.
- Source files for `share` are `git ls-files` with extensions `ts tsx js jsx mjs cjs css java py go rs`.
- `oversize`: root `CLAUDE.md` at 200 lines or more, or a rule at 100 lines or more.
- `skills`: count `.claude/skills/*/SKILL.md`, and bytes ÷ 3 of `description` plus `when_to_use`. Reported only, not in the budget, since the listing has its own cap.
- `lost` (only with `--base`): blank-line-delimited paragraphs of at least 40 characters, whitespace-normalised, from root `CLAUDE.md` and `.claude/rules/**` at `base`, that appear in no tracked or staged `.md` in the working tree and are not in `allowLost`.

- [ ] **Step 1: Branch, then write the failing tests**

Once Task 1 is merged: `git fetch origin && git switch -c feat/instructions-command origin/develop`.

Build fixtures with `git init` in `fs.mkdtempSync`, as `tests/observe-*.test.mjs` do. Normalise nothing in fixtures except where the case says CRLF.

```js
it("counts an unscoped rule at start and a scoped one only when touched", () => {
  // CLAUDE.md "x"; rules a.md unscoped, b.md paths ["src/**"]; src/f.ts
  const m = measureBody(dir, { touching: ["src/f.ts"] });
  expect(m.startup.files.map(f => f.path)).toEqual(["CLAUDE.md", ".claude/rules/a.md"]);
  expect(m.task.added.map(f => [f.path, f.reason])).toEqual([[".claude/rules/b.md", "path-rule"]]);
});
it("treats a glob matching over 40% of source as unscoped", () => { /* 5 of 10 files match; reason "wide-rule", wideRules[0].share === 0.5 */ });
it("keeps a glob matching exactly 40% scoped", () => { /* 4 of 10 */ });
it("treats frontmatter not on line 1 or malformed as unscoped", () => {
  expect(parseRule("\n---\npaths:\n  - a\n---\n").paths).toBeNull();
  expect(parseRule("---\npaths: [\n---\n").paths).toBeNull();
});
it("parses paths from a CRLF file, a YAML list, and a comma string", () => {
  expect(parseRule("---\r\npaths:\r\n  - a/**\r\n---\r\n").paths).toEqual(["a/**"]);
  expect(parseRule("---\npaths: a/**, b/**\n---\n").paths).toEqual(["a/**", "b/**"]);
});
it("follows imports four hops, ignoring fences, cycles and missing targets", () => { /* chain of 6: exactly 4 imported; a<->b cycle terminates; fenced @x not counted */ });
it("counts a file once across a task", () => { /* import also a nested file */ });
it("loads nested notes for a touching path that does not exist", () => { /* src/CLAUDE.md, touching src/none.ts → nested */ });
it("strips block HTML comments before measuring", () => { /* bytes exclude comment */ });
it("flags budgets and oversize at the exact limits", () => { /* 30,000 bytes = 10,000 tokens not over; 30,001 over; 199 lines fine; 200 oversize */ });
it("reports a paragraph as lost unless it moved verbatim or is allowed", () => { /* commit base; move one paragraph to docs/lessons/a.md, delete another; lost has only the deleted; allowLost empties it */ });
it("reports a non-git directory and a missing CLAUDE.md as error", () => { /* measureBody returns { error } */ });
```

In `instructions-command.test.mjs`:

```js
it("writes md and json twins named by date and label", () => { /* --report dir --label baseline → <date>-instructions-baseline.{md,json} */ });
it("never writes paragraph text to the report", () => { /* a lost paragraph's text is absent from both files, json.lostCount === 1 */ });
it("exits 1 when one body errors and still reports the other", () => {});
it("exits 0 when within budget", () => {});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run packages/orrery/tests/instructions`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement the three modules and wire `cli.mjs`**

Run `pnpm --filter @vaoan/orrery add picomatch`. Follow `commands/observe.mjs`' shape: `parseArgs`, injectable defaults, `USAGE`. Use `execFileSync("git", ["-C", dir, ...])`. Parse frontmatter by hand; do not add a YAML dependency.

- [ ] **Step 4: Run them and watch them pass**

Run: `pnpm vitest run packages/orrery/tests/instructions`
Expected: PASS.

- [ ] **Step 5: Run on AeleOS as a sanity check against a known shape**

Run: `pnpm orrery instructions ~/Documents/GitHub/AeleOS --touching aeleos=apps/hub/src/features/actors/domain/x.ts`
Expected: root plus few files at start, near AeleOS's ~8,000-token projection; the 767-line `actors/CLAUDE.md` and `apps/hub/AGENTS.md` under `nested` or `import`. If far off, the loading model is wrong: stop and find out why. Do not commit this output.

- [ ] **Step 6: Verify and commit**

Add `orrery instructions <body>...` to root `CLAUDE.md`'s commands table, marked `(built, stage 0)`.

Run: `pnpm test`
Expected: all pass.

```bash
git add packages/orrery pnpm-lock.yaml CLAUDE.md
git commit -m "feat(instructions): report what a body loads at session start and across a task [GH-000]"
```

---

### Task 3: Record the baseline

**Files:**
- Create: `docs/observations/2026-11-06-instructions-baseline.{md,json}` (date is the day it runs)

**Interfaces:** Consumes `orrery instructions`. Produces the "before" that Task 6 compares against. **Must complete before any Libra or eclipse-con change.**

- [ ] **Step 1: Bring both bodies current**

Run in each: `git switch <default> && git pull --ff-only && git status -sb`
Expected: clean. Libra's default is `develop`, eclipse-con's is `main`. If not clean, stop and ask.

- [ ] **Step 2: Generate**

```bash
SUN=$(git -C ~/Documents/GitHub/eclipse-con ls-files 'apps/sunfest2027/src/**/*.tsx' | head -1)
pnpm orrery instructions ~/Documents/GitHub/Libra ~/Documents/GitHub/eclipse-con \
  --touching libra=apps/store/src/features/cart/presentation/components/CartDrawer.tsx \
  --touching libra=apps/store/src/features/cart/application/groupBySeller.ts \
  --touching libra=apps/store/src/features/cart/domain/constants.ts \
  --touching libra=apps/admin/tests/ActivityRow.test.tsx \
  --touching libra=apps/admin/e2e/audit-log.spec.ts \
  --touching eclipse-con=apps/moonfest2026/src/features/analytics/domain/consent.ts \
  --touching eclipse-con=apps/links/src/App.test.tsx \
  --touching "eclipse-con=$SUN" \
  --report docs/observations --label baseline
```

Expected: exit 1, because both are over budget. Libra's start is near 88,700 tokens (252,501 + 13,587 bytes ÷ 3), and eclipse-con's near 16,700. A figure far from these means the loading model is wrong: stop and find out why. Reuse these exact flags in Task 6.

- [ ] **Step 3: Commit, PR, merge**

```bash
git add docs/observations/*-instructions-baseline.*
git commit -m "feat(instructions): the baseline before stage 0 [GH-000]"
git push -u origin feat/instructions-command
gh pr create --base develop --fill
```

Expected: checks green; squash-merged before Task 4 starts.

---

### Task 4: Libra

**Files (in `~/Documents/GitHub/Libra`, branch `docs/scope-claude-rules` from `origin/develop`):**
- Modify: `.claude/rules/*.md`, `CLAUDE.md`
- Create: `docs/lessons/<rule-name>.md`, `.claude/skills/{supabase-wipe,code-review-standards,git-workflow}/SKILL.md`
- Modify: live references to any rule file that leaves `.claude/rules/`

**Interfaces:** Consumes `orrery instructions --base origin/develop`. Check `.claude/skills/` for an existing skill of the same name first; if one exists, merge into it rather than overwrite.

**The dispositions.** The method is AeleOS's. For every rule: `git mv` the full text to `docs/lessons/<name>.md`, so nothing is lost and history follows. Then write what stays, under 100 lines: imperative one-liners, each with a one-clause reason and a link to the lesson. Keeping the same path in `.claude/rules/` means existing references still resolve.

| Rule | Becomes | `paths:` |
|---|---|---|
| `testing` | scoped | `**/*.test.{ts,tsx,mjs}`, `**/tests/**`, `**/__tests__/**`, `**/vitest.*` |
| `e2e-selectors` | scoped | `**/e2e/**`, `**/*.spec.ts`, `**/playwright*` |
| `storybook` | scoped | `**/*.stories.tsx`, `**/.storybook/**` |
| `tailwind` | scoped | `**/presentation/**/*.tsx`, `packages/ui/**`, `**/*.css` |
| `css-consistency` | scoped | `**/*.css`, `scripts/check-css-sync.mjs` |
| `component-patterns` | scoped | `**/presentation/**/*.tsx`, `packages/ui/**`, `packages/app-components/**` |
| `one-component-per-file` | scoped | same as `component-patterns` |
| `url-state` | scoped | `apps/*/src/features/*/application/**` |
| `architecture` | scoped | `apps/*/src/features/*/index.ts`, `apps/*/src/features/*/domain/**`, `apps/*/src/features/*/infrastructure/**`, `scripts/check-feature-boundaries.mjs` |
| `monorepo-architecture` | scoped | `packages/**/package.json`, `apps/*/package.json`, `pnpm-workspace.yaml`, `turbo.json` |
| `checkout-stock-integrity` | scoped | `apps/store/**/checkout/**`, `apps/payments/**`, `supabase/migrations/**` |
| `generated-code-policy` | scoped | `packages/api/**`, `orval.config.ts` |
| `mcp-standards` | scoped | `.claude/tools/**`, `.mcp.json` |
| `ai-docs-dry` | scoped | `.claude/**`, `CLAUDE.md` |
| `build-checks` | scoped | `scripts/**`, `turbo.json`, `.github/workflows/**`, `.husky/**` |
| `supabase-wipe` | skill | |
| `code-review-standards` | skill | |
| `git-workflow` | skill, plus one root line | |
| `git-safety`, `commit-policy`, `multi-agent-persistence` | root invariants, one line each, plus lesson | |
| `solid-principles`, `dry-principle`, `kiss-principle`, `single-source-of-truth`, `no-hardcoding`, `portability`, `libraries-over-manual-code`, `mcp-first`, `naming-conventions`, `telegram-notifications` | one root line each, plus lesson | |

Read each file before moving it. The table is decided from names and layout, and a rule's real subject overrides it; note any such change in the PR. `build-checks`' `scripts/**` and `tailwind`'s `presentation` globs are the likeliest to come out wide.

- [ ] **Step 1: Do the moves in one commit, unchanged**

`git mv` each rule to `docs/lessons/`. No content edits, so the diff stays reviewable as pure renames.

Run: `pnpm --dir ~/Documents/GitHub/Orrery orrery instructions ~/Documents/GitHub/Libra --base origin/develop`
Expected: `lost` empty.

- [ ] **Step 2: Write the scoped rules and skills, in a second commit**

Add `paths:` starting on line 1. Skills need a non-empty `description` and a link to the lesson. Procedures keep their full steps.

- [ ] **Step 3: Rewrite root `CLAUDE.md` under 200 lines**

Keep: what Libra is, the invariants, commands, an index to rules, skills, and lessons. Move the structure tree, stack lists, and pattern tutorials to `docs/lessons/project-overview.md` verbatim first. The line "This document ... can be used as a template" goes, because Orrery now holds that job.

- [ ] **Step 4: Fix references that no longer resolve**

Run: `git grep -nE '\.claude/rules/(git-workflow|git-safety|commit-policy|multi-agent-persistence|solid-principles|dry-principle|kiss-principle|single-source-of-truth|no-hardcoding|portability|libraries-over-manual-code|mcp-first|naming-conventions|telegram-notifications|supabase-wipe|code-review-standards)' -- ':!.ai-context' ':!docs/superpowers' ':!docs/lessons' ':!supabase/migrations-archive' ':!tests/legacy'`

Point each hit at `docs/lessons/<name>.md`. Historical records in the excluded paths stay as written.

- [ ] **Step 5: Measure until within budget**

Run: `pnpm --dir ~/Documents/GitHub/Orrery orrery instructions ~/Documents/GitHub/Libra --base origin/develop` plus Task 3's `--touching libra=` flags.
Expected: exit 0. For each deliberately deleted duplicate, add it to an allow-list JSON kept outside the repo and list it in the PR body. Narrow any `wideRules` globs rather than raising the threshold.

- [ ] **Step 6: Run Libra's own checks and open the PR**

Let `.husky/pre-commit` run on each commit; CI runs the rest. Do not use `--no-verify`.

```bash
gh pr create --base develop --title "docs(claude): scope rules and shrink the session-start load [GH-000]" --body "<before and after tokens; deleted duplicates; table deviations>"
```

Expected: checks green. **Stop for the owner to merge.**

---

### Task 5: eclipse-con

**Files (in `~/Documents/GitHub/eclipse-con`, branch `docs/scope-claude-rules` from `origin/main`):**
- Modify: `.claude/rules/*.md`, `CLAUDE.md`
- Create: `docs/lessons/<rule-name>.md`
- Leave as written: the two historical specs under `docs/superpowers/specs/` that name `.claude/rules`

**Interfaces:** Same as Task 4. Rules here are already short (at most 88 lines), so nothing needs condensing: scoped rules just gain `paths:`. The start is about 16,700 tokens, so scoping and trimming the 340-line root should meet the budget.

| Rule | Becomes | `paths:` |
|---|---|---|
| `testing` | scoped | `**/*.test.{ts,tsx}`, `**/vitest.*` |
| `i18n-testing` | scoped | `**/*.test.tsx`, `**/locales/**` |
| `i18n` | scoped | `**/locales/**`, `**/presentation/**/*.tsx`, `apps/*/src/components/**` |
| `e2e-selectors` | scoped | `**/e2e/**`, `**/*.spec.ts` |
| `tailwind` | scoped | `**/presentation/**/*.tsx`, `apps/*/src/components/**`, `**/*.css` |
| `component-patterns`, `one-component-per-file` | scoped | `**/presentation/**/*.tsx`, `apps/*/src/components/**` |
| `architecture` | scoped | `apps/*/src/features/*/index.ts`, `apps/*/src/features/*/domain/**`, `apps/*/src/features/*/infrastructure/**` |
| `analytics-tracking` | scoped | `apps/*/src/features/analytics/**` |
| `jsdoc` | scoped | `packages/**/*.ts`, `apps/*/src/features/*/domain/**` |
| `build-checks` | scoped | `scripts/**`, `.github/workflows/**`, `.husky/**` |
| `git-safety`, `git-workflow`, `code-review-standards` | one root line each, plus lesson | |
| `solid-principles`, `dry-principle`, `kiss-principle`, `single-source-of-truth`, `no-hardcoding`, `portability`, `naming-conventions` | one root line each, plus lesson | |

The layout differs from Libra: `apps/sunfest2027` keeps components in `src/components/`, which the globs above cover; check `apps/links` and `apps/moonfest2026` and correct them if needed. Leave `AGENTS.md` and `.claude/config.toml` alone; they serve Codex, and rule moves may leave `AGENTS.md` links stale, which Step 2 catches.

- [ ] **Step 1: Do the moves unchanged, then add `paths:` and root lines**

As Task 4 Steps 1 and 2. Root rule lines keep what `CLAUDE.md`'s "Git Safety" section already says, without repeating it.

- [ ] **Step 2: Rewrite root under 200 lines and fix references**

Move the per-site Quick Reference sections to `docs/lessons/project-overview.md` verbatim first. Keep the active site's commands in the root. Run `git grep -n '\.claude/rules/' -- ':!docs/superpowers' ':!docs/lessons'` and repoint any hit to a moved file, `AGENTS.md` included.

- [ ] **Step 3: Measure until within budget**

Run: `pnpm --dir ~/Documents/GitHub/Orrery orrery instructions ~/Documents/GitHub/eclipse-con --base origin/main` plus Task 3's `--touching eclipse-con=` flags.
Expected: exit 0.

- [ ] **Step 4: Open the PR**

```bash
gh pr create --base main --title "docs(claude): scope rules and shrink the session-start load" --body "<before and after tokens; deletions; deviations>"
```

Expected: **Stop for the owner to merge.** The Sunfest deploy ignores `docs/**` and `**/*.md`, so this should not deploy; if the diff touches anything else, say so in the PR.

---

### Task 6: Prove it live and hand over

**Files:**
- Create: `docs/observations/<date>-instructions-after.{md,json}`

**Interfaces:** Consumes Task 3's commands, run against both PR branches (or merged defaults).

- [ ] **Step 1: Confirm with real sessions that the static model is right**

For each body, from its root, with a hook writing to the scratchpad and nothing written to the repository:

```bash
claude -p "Read <one of the --touching files> and reply OK" \
  --settings '{"hooks":{"InstructionsLoaded":[{"hooks":[{"type":"command","command":"cat >> $LOG"}]}]}}'
```

Expected: `load_reason: session_start` files equal the report's `startup.files`; the matching rule arrives with `path_glob_match`. Any difference means the report is wrong: stop and ask, rather than adjusting numbers.

- [ ] **Step 2: Generate the "after" report**

Task 3's command with `--label after`.
Expected: exit 0.

- [ ] **Step 3: Commit via PR into Orrery `develop`**

Branch `docs/stage-0-instruction-results`, title `docs(observations): instruction load after stage 0 [GH-000]`.

- [ ] **Step 4: Stop and hand over to the owner**

Report before-and-after tokens per body, and ask the owner to use Libra for about five real sessions and judge. Stage 1 is not planned until they do.
