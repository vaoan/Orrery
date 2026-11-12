# The starter and `themis init` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One command, `themis init portia --class next-supabase-mono`, creates a body that passes lint, typecheck, tests and CI on its first commit with no hand repair.

**Architecture:** Themis gains a git install path, a reusable body CI and `themis init`. A new repository, the starter (`vaoan/Vulkan`, a GitHub template and a registered body), carries a Next.js + Supabase app with AeleOS login (person first), generic owned resources with delegated capabilities, an audit log, and the AI-layer files. `themis init` generates a repository from the starter, rewrites names and pointers, applies repository policy and opens the registry PR.

**Tech Stack:** Node 24, pnpm 11, vitest 4 (Themis). Starter: Next.js 16, React 19, TypeScript 6, Tailwind 4, next-intl, `@clerk/nextjs`, `@supabase/supabase-js`, Supabase CLI, vitest 4, Playwright.

**Spec:** `docs/specs/2026-11-08-portia-design.md` (section "The trial"), under `docs/specs/2026-11-06-ai-layer-design.md` ("`themis init`, `check`, and the starter") and ADR 0021.

## Global Constraints

- **No npm, no tags.** Bodies install `github:vaoan/Themis#main`; a release is a merge.
- **No `warn` tier; nothing scheduled** (ADR 0017).
- **Themis is public.** Nothing shipped through it, or through the starter, holds a body's secrets, addresses or internal hosts. `me.furrycolombia.com` is already public in AeleOS's docs and may appear.
- **Themis holds no application code.** The starter is its own repository.
- **Governance is never copied into the starter.** Lint, tsconfig, prettier, hooks and CI come from `@vaoan/themis` through pointer files; product code is copied and belongs to the body.
- **The starter carries what every body repeats:** AeleOS login (person first; fursona sync and picker off until the hub is ready), `current_user_id()`, owned resources with delegated capabilities, the audit log, app shell, i18n (`es`, `en`), lint, tests, CI, AI-layer files. Nothing about calls, committees or scoring.
- **`themis init` creates no cloud projects and sets no secrets.** CI passes with no secrets.
- **Instruction budget:** at most 10,000 tokens at session start and 25,000 across a task, root `CLAUDE.md` under 200 lines, measured by `themis instructions`.
- **GitHub token:** read from `THEMIS_GH_TOKEN`, `GITHUB_TOKEN` or `GH_TOKEN`; never `gh auth login`, never `gh auth token`, never printed or stored (owner's standing rule).
- **Git flow:** `develop` default; `type/*` branches squash into it; PR titles `type(scope): subject [GH-000]`; branch descriptions say what changes.
- **Every report has a `.json` twin; decision records point at generated data.**
- **If a task corners you into an unplanned fix, stop and say so** (root `CLAUDE.md`).

## Review Focus

1. **Check names through a reusable workflow.** A caller job `ci` that `uses:` Themis's workflow reports checks as `ci / test`, not `test`. If `policy/repository.json`'s required contexts stay bare, every body PR waits forever. Task 2 pins the real names with a live run and makes the policy match.
2. **A git dependency on a subdirectory.** `@vaoan/themis` lives in `packages/themis`. pnpm must install it from `github:vaoan/Themis#main` with the subdirectory, under `--frozen-lockfile`, on CI, without auth. Task 1 measures this before anything depends on it.
3. **`themis init` half done.** The repository is created and policy then fails. A rerun must continue rather than fail on "already exists", and `--dry-run` must change nothing. Task 3 tests both.
4. **No Clerk keys in CI.** `next build` and the middleware must not crash with placeholder keys. Task 9 builds with only `.env.example` values.
5. **A delegate escalating.** Someone holding `manage-delegates` on a resource must not grant a capability they do not hold, nor make themselves owner. Task 8 tests both.
6. **A forged `actor_ref` on the picker's return.** The callback must accept only an actor in the mirror owned by the signed-in person, as `AeleOS/docs/integrating.md` ("The return leg") requires. Task 9 tests another person's actor and an unknown one.

---

### Task 1: The git install path

**Files:**
- Create: `docs/observations/2026-11-11-git-install.md` and `.json`
- Modify: `packages/themis/package.json` (only if the measurement needs it, e.g. `files`)

**Interfaces:**
- Produces: the exact dependency specifier bodies use, e.g. `"@vaoan/themis": "github:vaoan/Themis#main&path:/packages/themis"`, recorded in the observation and used verbatim by Tasks 4 and 5.

- [ ] **Step 1:** In a scratch directory outside the repo, `pnpm init`, then `pnpm add -D "github:vaoan/Themis#main&path:/packages/themis"`.
- [ ] **Step 2:** Verify `node -e "import('@vaoan/themis/eslint').then(m=>console.log(typeof m.default))"` prints `function`, and `pnpm exec themis --help` runs.
- [ ] **Step 3:** Delete `node_modules`, run `pnpm install --frozen-lockfile`, repeat Step 2.
- [ ] **Step 4:** Record pnpm version, specifier, both results and install time in the observation (`.md` and `.json`). If the specifier fails, **stop**: this is a cornering, and the owner decides.
- [ ] **Step 5:** Commit on `docs/git-install-observation`, PR into `develop`.

### Task 2: The reusable body CI

**Files:**
- Create: `.github/workflows/body-ci.yml`
- Modify: `policy/repository.json` (`requiredChecks` for bodies, if Task 2's live run shows prefixed names)
- Modify: `packages/themis/src/lib/repo-policy.mjs` and its tests, if bodies and Themis need different required checks
- Test: `packages/themis/tests/workflows.test.mjs`

**Interfaces:**
- Consumes: Task 1's specifier.
- Produces: `uses: vaoan/Themis/.github/workflows/body-ci.yml@main` with input `database: boolean` (default `false`). Jobs `test`, `branch-target`, `branch-name`, `pr-title`, `config-drift`, `branch-sync`, each running the body's own scripts: `test` runs `pnpm lint && pnpm typecheck && pnpm test`, plus `supabase start` and `pnpm test:db` when `database` is true. The themis verbs run as `pnpm themis ci <verb>` from the body's installed package.
- Produces: the required-check names a body's protection must list, as measured.

- [ ] **Step 1: Write the failing test** in `workflows.test.mjs`: `body-ci.yml` declares `on.workflow_call.inputs.database` as boolean with default false, and defines exactly the six job names above.
- [ ] **Step 2:** Run `pnpm vitest run packages/themis/tests/workflows.test.mjs`. Expected: FAIL (file missing).
- [ ] **Step 3:** Write `body-ci.yml` from `ci.yml`'s jobs, with the `test` job above.
- [ ] **Step 4:** Run the test. Expected: PASS.
- [ ] **Step 5:** After the starter exists (Task 5), read the check names its first PR reports and pin them in a test of the body policy. If they are prefixed (`ci / test`), make `repo apply` give bodies the prefixed names and keep Themis's own bare, with a test for each.
- [ ] **Step 6:** Commit on `feat/body-ci-workflow`, PR into `develop`.

### Task 3: `themis init`

**Files:**
- Create: `packages/themis/src/commands/init.mjs`, `packages/themis/src/lib/init.mjs`
- Modify: `packages/themis/src/cli.mjs` (register `init`), `packages/themis/src/lib/github.mjs` (`resolveToken`)
- Modify: root `CLAUDE.md` commands table (`init` built)
- Test: `packages/themis/tests/init.test.mjs`, `packages/themis/tests/github.test.mjs`

**Interfaces:**
- Consumes: `applyRepoPolicy` (`lib/repo-policy.mjs`), `loadPolicy`, `loadRegistry`, `createGithub`.
- Produces: `themis init <name> --class next-supabase-mono` (the body key is the lowercase name, e.g. `portia`; the repository is the capitalised name, e.g. `vaoan/Portia`, or `--repo-name`). Full form: `themis init <name> --class next-supabase-mono [--owner vaoan] [--template vaoan/Vulkan] [--role planet] [--dry-run]`. Exit 0 done, 1 failure, 2 usage.
- Produces: `planInit({ name, owner, template, klass, role, github })` returns ordered steps `{ kind: "generate-repo" | "rename" | "write-pointers" | "apply-policy" | "registry-pr", done: boolean, detail }`; `runInit(plan, deps)` executes the steps whose `done` is false.

- [ ] **Step 1: Write failing tests** with a fake github and a fake git runner:
  - `init portia` on a missing repo plans all five steps, `done: false`, in that order.
  - When `vaoan/Portia` already exists from the template, `generate-repo` is `done: true` and the rest still run.
  - `--dry-run` prints the plan and makes no write calls (the fake records none).
  - `rename` replaces `vulkan` with `portia` in `package.json` `name`, `themis.config.mjs`, the root `CLAUDE.md` title and `README.md` title, and nowhere else.
  - `write-pointers` writes each file of `packages/themis/templates/<class>/` byte for byte.
  - `registry-pr` adds `"portia": { "repo": "vaoan/Portia", "role": "planet", "class": "next-supabase-mono" }` to `registry.json` on a branch `feat/register-portia` and opens a PR titled `feat(registry): register portia [GH-000]`.
  - An unknown `--class`, a name that is not lowercase kebab-case, or a name already in the registry exits 2 with a message.
  - `resolveToken({ GH_TOKEN: "x" })` returns `"x"`; with no variables it throws, and never calls `gh`.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement. Repository generation is `POST /repos/{template}/generate` with `owner`, `name`, `private: false`, `include_all_branches: false`. Rename and pointers happen in a clone, committed as `chore(init): rename and pointers [GH-000]` on `develop` before policy is applied (policy protects `develop`). Remove the `gh auth token` fallback from `resolveToken`; add `GH_TOKEN`.
- [ ] **Step 4:** Run the tests and the whole suite. Expected: PASS.
- [ ] **Step 5:** Commit on `feat/init-command`, PR into `develop`.

### Task 4: References that do not lie, and skills and agents that load

**Why:** a body's instructions are only as good as what they point at. Stale claims cost real time here: a root `CLAUDE.md` saying "not implemented" about a built command, and a workflow pointing at a renamed secret. The owner, 2026-11-11: "crear scripts en Themis para que podamos crear reliable skills, los agentes se sientan de verdad inteligentes y las referencias funcionen bien."

**Files:**
- Create: `packages/themis/src/commands/references.mjs`, `packages/themis/src/lib/references/{extract,resolve,report}.mjs`, `packages/themis/src/commands/skills.mjs`, `packages/themis/src/lib/skills/validate.mjs`
- Modify: `packages/themis/src/cli.mjs`, `.github/workflows/body-ci.yml` (the `test` job runs both), root `CLAUDE.md` commands table
- Test: `packages/themis/tests/references*.test.mjs`, `packages/themis/tests/skills*.test.mjs`
- Create: `docs/observations/2026-11-XX-references.{md,json}` (Themis, Libra, eclipse-con)

**Interfaces:**
- Consumes: `lib/instructions/measure.mjs`'s discovery of what a body loads (root and nested `CLAUDE.md`, `.claude/rules/**`, skills, agents), so both commands read the same set.
- Produces: `themis references <bodyDir>... [--report dir] [--label name]`. It reads every instruction file a body loads, plus `docs/lessons/**`, and extracts:
  - relative Markdown links and backticked paths (a token containing `/` or ending in a known extension), resolved against the body root and then the file's own directory;
  - `pnpm <script>` mentions, checked against the root and workspace `package.json` scripts;
  - `themis <command>` mentions, checked against the CLI's registered commands;
  - skill and agent names named as `/name` or "skill `name`", checked against the body's skills, agents and enabled plugins' skill names when they are on disk.
  Glob patterns (`*`, `**`, `{}`) are checked as "matches at least one file", and URLs are not fetched. A line can opt out with a trailing `<!-- themis: example -->`. Every exception is listed in the report, with no warn tier. Exit 1 on any broken reference, 2 on usage. Reports name bodies, never local paths.
- Produces: `themis skills <bodyDir>...`, which validates each `.claude/skills/*/SKILL.md` and `.claude/agents/*.md`:
  - frontmatter parses;
  - `name` is kebab-case and matches the directory or file name;
  - `description` is present, at most 1,024 characters, and names when to use it, not just what it is;
  - the body's references pass, through the same resolver;
  - an agent's `tools`, when present, lists only known tool names;
  - the total of all descriptions fits the skill-listing budget that `themis instructions` already counts.
  Exit 1 on any failure.

- [ ] **Step 1: Write failing tests** with fixture bodies:
  - a link to a missing file fails; the same link to an existing file passes; a path relative to the file's directory passes;
  - `pnpm lint` passes when the script exists and fails when it does not; `themis frobnicate` fails;
  - a glob matching nothing fails; one matching a file passes;
  - a line ending in `<!-- themis: example -->` is skipped and shows in the report as an exception;
  - a skill whose `name` differs from its directory fails; an empty description fails; a 1,025-character description fails; an agent listing tool `Teleport` fails;
  - the report holds no absolute path.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement. Reuse the instructions discovery; do not write a second walker.
- [ ] **Step 4:** Run them and the whole suite. Expected: PASS.
- [ ] **Step 5:** Run both commands on Themis itself, then on Libra and eclipse-con (read-only checkouts), and write the observation. Fix what Themis's own instructions get wrong in this PR. For Libra and eclipse-con, list their failures and fix nothing; their fixes are their own PRs, after the owner sees the list.
- [ ] **Step 6:** Commit on `feat/references-and-skills-checks`, PR into `develop`.

### Task 5: The starter repository and its tooling

**Files (in the new repository `vaoan/Vulkan`):**
- Create: `package.json`, `pnpm-workspace.yaml`, `themis.config.mjs`, `eslint.config.mjs`, `eslint.local.mjs`, `prettier.config.mjs`, `tsconfig.json`, `.husky/commit-msg`, `.husky/pre-push`, `.github/workflows/ci.yml`, `.gitattributes`, `.gitignore`, `README.md`, `LICENSE`
- Create: `apps/web/` (Next.js 16 app router: `src/app/[locale]/layout.tsx`, `page.tsx`, `globals.css`; `next.config.ts`; `package.json`)

**Interfaces:**
- Consumes: Task 1's specifier; Task 2's `body-ci.yml`; the pointer files from `packages/themis/templates/next-supabase-mono/`.
- Produces: root scripts `lint`, `typecheck`, `test`, `test:db`, `themis` (`themis`), `dev`, `build`. `ci.yml` is the caller: one job `ci` with `uses: vaoan/Themis/.github/workflows/body-ci.yml@main`, `with: { database: true }`.

- [ ] **Step 1:** Create the repository with `gh api` (token per command) under `vaoan`, public, then `themis repo apply vaoan/Vulkan`.
- [ ] **Step 2:** Write the files. Pointer files are copied from `packages/themis/templates/next-supabase-mono/` unchanged. `themis.config.mjs` follows `fixtures/next-supabase-mono/themis.config.mjs` with `spelling: ["vulkan"]` and the web app's `globals.css` as the Tailwind entry point.
- [ ] **Step 3:** One smoke test, `apps/web/tests/home.test.tsx`: the home page renders its title in `es` and in `en`.
- [ ] **Step 4:** Run `pnpm install && pnpm lint && pnpm typecheck && pnpm test`. Expected: all pass with zero lint findings.
- [ ] **Step 5:** PR into `develop` (`feat(app): the empty shell [GH-000]`). CI green. Record the check names it reports for Task 2, Step 5.

### Task 6: i18n and the app shell

**Files (starter):**
- Create: `apps/web/src/i18n/routing.ts`, `request.ts`, `apps/web/messages/es.json`, `en.json`, `apps/web/src/middleware.ts` (shared with Task 9)
- Test: `apps/web/tests/i18n.test.ts`

**Interfaces:**
- Produces: locales `["es", "en"]`, default `es`; every user-facing text through `next-intl`; a header with the app name and a sign-in slot.

- [ ] **Step 1: Failing tests:** both message files have the same keys; `/` redirects to `/es`; `/en` renders English.
- [ ] **Step 2–4:** Run (FAIL), implement, run (PASS); `pnpm lint` clean.
- [ ] **Step 5:** PR `feat(i18n): Spanish and English from the start [GH-000]`.

### Task 7: Supabase, `current_user_id()` and the actors mirror

**Files (starter):**
- Create: `supabase/config.toml`, `supabase/migrations/<timestamp>_identity.sql`, `supabase/tests/identity.test.sql` (pgTAP), `.env.example`
- Modify: root `package.json` (`test:db` = `supabase test db`)

**Interfaces:**
- Produces, in SQL: `user_profiles(id uuid pk, identity_sub text unique not null, created_at)`; `current_user_id() returns uuid` mapping the Clerk `sub` (`auth.jwt()->>'sub'`) to `user_profiles.id`, as Libra does; `actors` mirror keyed on `actor_ref` with the fields `AeleOS/docs/integrating.md` ("The upsert") lists, plus `user_id` referencing `user_profiles`. RLS on: a person reads and writes only their own profile and actors.

- [ ] **Step 1: Failing pgTAP tests:** with a JWT `sub` of A, `current_user_id()` returns A's id; A cannot select B's actors; an actor upsert by A for B's `user_id` is refused; with no JWT, `current_user_id()` is null.
- [ ] **Step 2–4:** `pnpm test:db` (FAIL), write the migration, `pnpm test:db` (PASS).
- [ ] **Step 5:** PR `feat(db): identity and the actors mirror [GH-000]`. CI's database job green.

### Task 8: Owned resources, delegated capabilities and the audit log

**Files (starter):**
- Create: `supabase/migrations/<timestamp>_resources.sql`, `supabase/migrations/<timestamp>_audit.sql`, `supabase/tests/resources.test.sql`, `supabase/tests/audit.test.sql`, `supabase/seed/example-resource.sql` (a `notes` resource type used only by the tests and the README example), `docs/resources.md`

**Interfaces:**
- Consumes: Task 7's `user_profiles` and `current_user_id()`.
- Produces, in SQL:
  - `resource_types(key text pk, capabilities text[] not null)`: a body registers each type and its capabilities (Portia: `call` with `edit-form`, `manage-committee`, `see-scores`, `decide`, `close`). `manage-delegates` and `transfer` exist on every type.
  - `resources(type text references resource_types, id uuid, owner_id uuid references user_profiles, pk (type, id))`.
  - `resource_delegates(type, id, user_id, capabilities text[], granted_by, granted_at)`, unique on `(type, id, user_id)`, no row with `user_id = owner_id`.
  - `operators(user_id pk)`.
  - `has_capability(type text, id uuid, capability text) returns boolean`: true for the owner, for an operator, or for a delegate holding it. `security definer`, `stable`.
  - `grant_capabilities(type, id, user_id, capabilities text[])`, `revoke_capabilities(...)`, `transfer_ownership(type, id, new_owner_id)`: the only writers; RLS denies direct writes to the tables.
  - `audit.logged_actions` with `audit.enable_tracking(table)`, adapted from Libra's baseline; every grant, revoke and transfer is logged; `audit.anonymise_user(user_id)` replaces a person's id in logged rows with a fixed placeholder.
- Produces: `docs/resources.md`, one page: how a body declares a type, its capabilities, and an RLS policy that calls `has_capability`.

- [ ] **Step 1: Failing pgTAP tests:**
  - owner A has every capability on their note; stranger B has none; operator C has all;
  - A grants B `edit` → B has `edit`, not `transfer`;
  - B holding `manage-delegates` and `edit` grants D `edit` → ok; B grants D `transfer` (which B lacks) → refused; B grants B anything → refused;
  - `transfer_ownership` by A to B → B is owner, A keeps nothing unless granted; by a non-owner without `transfer` → refused;
  - a direct `insert into resource_delegates` as A → refused by RLS;
  - each grant, revoke and transfer leaves one `audit.logged_actions` row; `audit.anonymise_user(B)` leaves no row containing B's id.
- [ ] **Step 2–4:** `pnpm test:db` (FAIL), write the migrations, `pnpm test:db` (PASS).
- [ ] **Step 5:** Write `docs/resources.md`.
- [ ] **Step 6:** PR `feat(db): owned resources, delegated capabilities and the audit log [GH-000]`.

### Task 9: Login through AeleOS

**Files (starter):**
- Create: `apps/web/src/features/identity/` (`application/sync-actors.ts`, `application/accept-picker-return.ts`, `infrastructure/aeleos-client.ts`, `infrastructure/supabase-server.ts`, `presentation/sign-in-button.tsx`), `apps/web/src/app/[locale]/acting-as/route.ts`
- Modify: `apps/web/src/middleware.ts` (Clerk + next-intl), `.env.example`
- Test: `apps/web/tests/identity/*.test.ts`

**Interfaces:**
- Consumes: Task 7's tables; `AeleOS/docs/integrating.md` sections 1 and 2 (read them; they are the contract).
- Produces: the person login works with Clerk alone (`identity_sub` row created on first sign-in). `AELEOS_FURSONAS=on|off` (default `off`) switches the fursona sync and the picker; with `off`, the person is the actor and the picker route answers 404.
- Produces: `syncActors(clerkToken: string): Promise<{ synced: number }>` calling `GET https://me.furrycolombia.com/api/actors/mine` server-side with the person's own token, upserting on `actor_ref`; `acceptPickerReturn(actorRef: string): Promise<{ ok: true, actorRef } | { ok: false, reason: "unknown" | "not-yours" }>`; a Supabase server client that sends the Clerk session token (Third-Party Auth). Hub base URL from `AELEOS_HUB_URL`, default `https://me.furrycolombia.com`.

- [ ] **Step 1: Failing tests** with a fake hub and an in-memory mirror: first sign-in creates the `user_profiles` row; with `AELEOS_FURSONAS=off` no hub call is made and `/acting-as` is 404; with `on`, sync upserts by `actor_ref` and lets the hub win on its fields; a 401 from the hub surfaces as "sign in again", not as an empty list; `acceptPickerReturn` with another person's actor gives `not-yours`, with an unknown one `unknown`, with your own `ok`.
- [ ] **Step 2–4:** Run (FAIL), implement, run (PASS).
- [ ] **Step 5:** `pnpm build` with only `.env.example` values succeeds, and the middleware does not throw on a request without keys (Review Focus 4).
- [ ] **Step 6:** PR `feat(identity): sign in through AeleOS [GH-000]`.

### Task 10: The AI-layer files

**Files (starter):**
- Create: `CLAUDE.md`, `.claude/rules/*.md` (path-scoped: `apps/web/src/features/**`, `supabase/**` (including how to declare a resource type),  `apps/web/messages/**`, tests), `.claude/settings.json`, `docs/lessons/` (empty, with a README line saying what goes there)

**Interfaces:**
- Consumes: `themis instructions` (Themis stage 0).
- Produces: a root `CLAUDE.md` under 200 lines with no history in it: what the body is, commands, layout, where rules live. Rules with `paths:` only; none matches over 40% of source.

- [ ] **Step 1:** From a Themis checkout, run `pnpm themis instructions <starter> --touching vulkan=apps/web/src/features/identity/application/sync-actors.ts --report docs/observations --label starter`. Expected now: the root alone, well under budget.
- [ ] **Step 2:** Write the files.
- [ ] **Step 3:** Rerun Step 1. Expected: start ≤ 10,000 and task ≤ 25,000 tokens, no oversize, no wide rule. `pnpm themis references .` and `pnpm themis skills .` pass in Vulkan. Keep the report (`.md` + `.json`) in Themis's `docs/observations/`.
- [ ] **Step 4:** PR `docs(ai): instructions within budget [GH-000]` in the starter; a separate Themis PR for the observation.

### Task 11: Make the starter a template and register it

**Files:**
- Modify (Themis): `registry.json` (`"vulkan": { "repo": "vaoan/Vulkan", "role": "starter", "class": "next-supabase-mono" }`), `packages/themis/src/lib/registry.mjs` and tests if `role` is validated against a list
- Modify (starter): repository setting `is_template: true`

- [ ] **Step 1: Failing test** (Themis): `loadRegistry` accepts role `starter`; `themis init`'s default `--template` is the registry's single `starter` body.
- [ ] **Step 2–4:** Run (FAIL), implement, run (PASS).
- [ ] **Step 5:** `PATCH /repos/vaoan/Vulkan` with `is_template: true` (token per command).
- [ ] **Step 6:** PR `feat(registry): the starter is a body [GH-000]`.

### Task 12: The trial run — create Portia

**Files:**
- Create (Themis): `docs/observations/2026-11-XX-portia-init.md` and `.json`

- [ ] **Step 1:** `pnpm themis init portia --class next-supabase-mono --dry-run`. Expected: five steps listed, nothing written.
- [ ] **Step 2:** `pnpm themis init portia --class next-supabase-mono`. Expected: exit 0; `vaoan/Portia` exists; the registry PR is open.
- [ ] **Step 3:** Clone `vaoan/Portia`; `pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm test && pnpm build` with no edits. Expected: all pass.
- [ ] **Step 4:** Open a trivial PR in Portia (a README line); CI green with the protection's required checks satisfied.
- [ ] **Step 5:** `themis instructions` on Portia within budget.
- [ ] **Step 6:** Record each result in the observation. Any hand repair needed is a failure of trial criterion 1: list it, and stop for the owner's decision (fix forward, or delete Portia and fix Themis).
