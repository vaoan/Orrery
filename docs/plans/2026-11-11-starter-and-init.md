# The starter and `orrery init` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One command, `orrery init portia --class next-supabase-mono`, creates a body that passes lint, typecheck, tests and CI on its first commit with no hand repair.

**Architecture:** Orrery gains a git install path, a reusable body CI and `orrery init`. A new repository, the starter (`vaoan/nebula`, a GitHub template and a registered body), carries a Next.js + Supabase app with AeleOS login (person first), generic owned resources with delegated capabilities, an audit log, and the AI-layer files. `orrery init` generates a repository from the starter, rewrites names and pointers, applies repository policy and opens the registry PR.

**Tech Stack:** Node 24, pnpm 11, vitest 4 (Orrery). Starter: Next.js 16, React 19, TypeScript 6, Tailwind 4, next-intl, `@clerk/nextjs`, `@supabase/supabase-js`, Supabase CLI, vitest 4, Playwright.

**Spec:** `docs/specs/2026-11-08-portia-design.md` (section "The trial"), under `docs/specs/2026-11-06-ai-layer-design.md` ("`orrery init`, `check`, and the starter") and ADR 0021.

## Global Constraints

- **No npm, no tags.** Bodies install `github:vaoan/Orrery#main`; a release is a merge.
- **No `warn` tier; nothing scheduled** (ADR 0017).
- **Orrery is public.** Nothing shipped through it, or through the starter, holds a body's secrets, addresses or internal hosts. `me.furrycolombia.com` is already public in AeleOS's docs and may appear.
- **Orrery holds no application code.** The starter is its own repository.
- **Governance is never copied into the starter.** Lint, tsconfig, prettier, hooks and CI come from `@vaoan/orrery` through pointer files; product code is copied and belongs to the body.
- **The starter carries what every body repeats:** AeleOS login (person first; fursona sync and picker off until the hub is ready), `current_user_id()`, owned resources with delegated capabilities, the audit log, app shell, i18n (`es`, `en`), lint, tests, CI, AI-layer files. Nothing about calls, committees or scoring.
- **`orrery init` creates no cloud projects and sets no secrets.** CI passes with no secrets.
- **Instruction budget:** at most 10,000 tokens at session start and 25,000 across a task, root `CLAUDE.md` under 200 lines, measured by `orrery instructions`.
- **GitHub token:** read from `ORRERY_GH_TOKEN`, `GITHUB_TOKEN` or `GH_TOKEN`; never `gh auth login`, never `gh auth token`, never printed or stored (owner's standing rule).
- **Git flow:** `develop` default; `type/*` branches squash into it; PR titles `type(scope): subject [GH-000]`; branch descriptions say what changes.
- **Every report has a `.json` twin; decision records point at generated data.**
- **If a task corners you into an unplanned fix, stop and say so** (root `CLAUDE.md`).

## Review Focus

1. **Check names through a reusable workflow.** A caller job `ci` that `uses:` Orrery's workflow reports checks as `ci / test`, not `test`. If `policy/repository.json`'s required contexts stay bare, every body PR waits forever. Task 2 pins the real names with a live run and makes the policy match.
2. **A git dependency on a subdirectory.** `@vaoan/orrery` lives in `packages/orrery`. pnpm must install it from `github:vaoan/Orrery#main` with the subdirectory, under `--frozen-lockfile`, on CI, without auth. Task 1 measures this before anything depends on it.
3. **`orrery init` half done.** The repository is created and policy then fails. A rerun must continue rather than fail on "already exists", and `--dry-run` must change nothing. Task 3 tests both.
4. **No Clerk keys in CI.** `next build` and the middleware must not crash with placeholder keys. Task 8 builds with only `.env.example` values.
5. **A delegate escalating.** Someone holding `manage-delegates` on a resource must not grant a capability they do not hold, nor make themselves owner. Task 7 tests both.
6. **A forged `actor_ref` on the picker's return.** The callback must accept only an actor in the mirror owned by the signed-in person, as `AeleOS/docs/integrating.md` ("The return leg") requires. Task 8 tests another person's actor and an unknown one.

---

### Task 1: The git install path

**Files:**
- Create: `docs/observations/2026-11-11-git-install.md` and `.json`
- Modify: `packages/orrery/package.json` (only if the measurement needs it, e.g. `files`)

**Interfaces:**
- Produces: the exact dependency specifier bodies use, e.g. `"@vaoan/orrery": "github:vaoan/Orrery#main&path:/packages/orrery"`, recorded in the observation and used verbatim by Tasks 4 and 5.

- [ ] **Step 1:** In a scratch directory outside the repo, `pnpm init`, then `pnpm add -D "github:vaoan/Orrery#main&path:/packages/orrery"`.
- [ ] **Step 2:** Verify `node -e "import('@vaoan/orrery/eslint').then(m=>console.log(typeof m.default))"` prints `function`, and `pnpm exec orrery --help` runs.
- [ ] **Step 3:** Delete `node_modules`, run `pnpm install --frozen-lockfile`, repeat Step 2.
- [ ] **Step 4:** Record pnpm version, specifier, both results and install time in the observation (`.md` and `.json`). If the specifier fails, **stop**: this is a cornering, and the owner decides.
- [ ] **Step 5:** Commit on `docs/git-install-observation`, PR into `develop`.

### Task 2: The reusable body CI

**Files:**
- Create: `.github/workflows/body-ci.yml`
- Modify: `policy/repository.json` (`requiredChecks` for bodies, if Task 2's live run shows prefixed names)
- Modify: `packages/orrery/src/lib/repo-policy.mjs` and its tests, if bodies and Orrery need different required checks
- Test: `packages/orrery/tests/workflows.test.mjs`

**Interfaces:**
- Consumes: Task 1's specifier.
- Produces: `uses: vaoan/Orrery/.github/workflows/body-ci.yml@main` with input `database: boolean` (default `false`). Jobs `test`, `branch-target`, `branch-name`, `pr-title`, `config-drift`, `branch-sync`, each running the body's own scripts: `test` runs `pnpm lint && pnpm typecheck && pnpm test`, plus `supabase start` and `pnpm test:db` when `database` is true. The orrery verbs run as `pnpm orrery ci <verb>` from the body's installed package.
- Produces: the required-check names a body's protection must list, as measured.

- [ ] **Step 1: Write the failing test** in `workflows.test.mjs`: `body-ci.yml` declares `on.workflow_call.inputs.database` as boolean with default false, and defines exactly the six job names above.
- [ ] **Step 2:** Run `pnpm vitest run packages/orrery/tests/workflows.test.mjs`. Expected: FAIL (file missing).
- [ ] **Step 3:** Write `body-ci.yml` from `ci.yml`'s jobs, with the `test` job above.
- [ ] **Step 4:** Run the test. Expected: PASS.
- [ ] **Step 5:** After the starter exists (Task 4), read the check names its first PR reports and pin them in a test of the body policy. If they are prefixed (`ci / test`), make `repo apply` give bodies the prefixed names and keep Orrery's own bare, with a test for each.
- [ ] **Step 6:** Commit on `feat/body-ci-workflow`, PR into `develop`.

### Task 3: `orrery init`

**Files:**
- Create: `packages/orrery/src/commands/init.mjs`, `packages/orrery/src/lib/init.mjs`
- Modify: `packages/orrery/src/cli.mjs` (register `init`), `packages/orrery/src/lib/github.mjs` (`resolveToken`)
- Modify: root `CLAUDE.md` commands table (`init` built)
- Test: `packages/orrery/tests/init.test.mjs`, `packages/orrery/tests/github.test.mjs`

**Interfaces:**
- Consumes: `applyRepoPolicy` (`lib/repo-policy.mjs`), `loadPolicy`, `loadRegistry`, `createGithub`.
- Produces: `orrery init <name> --class next-supabase-mono [--owner vaoan] [--template vaoan/nebula] [--role planet] [--dry-run]`. Exit 0 done, 1 failure, 2 usage.
- Produces: `planInit({ name, owner, template, klass, role, github })` returns ordered steps `{ kind: "generate-repo" | "rename" | "write-pointers" | "apply-policy" | "registry-pr", done: boolean, detail }`; `runInit(plan, deps)` executes the steps whose `done` is false.

- [ ] **Step 1: Write failing tests** with a fake github and a fake git runner:
  - `init portia` on a missing repo plans all five steps, `done: false`, in that order.
  - When `vaoan/portia` already exists from the template, `generate-repo` is `done: true` and the rest still run.
  - `--dry-run` prints the plan and makes no write calls (the fake records none).
  - `rename` replaces `nebula` with `portia` in `package.json` `name`, `orrery.config.mjs`, the root `CLAUDE.md` title and `README.md` title, and nowhere else.
  - `write-pointers` writes each file of `packages/orrery/templates/<class>/` byte for byte.
  - `registry-pr` adds `"portia": { "repo": "vaoan/portia", "role": "planet", "class": "next-supabase-mono" }` to `registry.json` on a branch `feat/register-portia` and opens a PR titled `feat(registry): register portia [GH-000]`.
  - An unknown `--class`, a name that is not lowercase kebab-case, or a name already in the registry exits 2 with a message.
  - `resolveToken({ GH_TOKEN: "x" })` returns `"x"`; with no variables it throws, and never calls `gh`.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement. Repository generation is `POST /repos/{template}/generate` with `owner`, `name`, `private: false`, `include_all_branches: false`. Rename and pointers happen in a clone, committed as `chore(init): rename and pointers [GH-000]` on `develop` before policy is applied (policy protects `develop`). Remove the `gh auth token` fallback from `resolveToken`; add `GH_TOKEN`.
- [ ] **Step 4:** Run the tests and the whole suite. Expected: PASS.
- [ ] **Step 5:** Commit on `feat/init-command`, PR into `develop`.

### Task 4: The starter repository and its tooling

**Files (in the new repository `vaoan/nebula`):**
- Create: `package.json`, `pnpm-workspace.yaml`, `orrery.config.mjs`, `eslint.config.mjs`, `eslint.local.mjs`, `prettier.config.mjs`, `tsconfig.json`, `.husky/commit-msg`, `.husky/pre-push`, `.github/workflows/ci.yml`, `.gitattributes`, `.gitignore`, `README.md`, `LICENSE`
- Create: `apps/web/` (Next.js 16 app router: `src/app/[locale]/layout.tsx`, `page.tsx`, `globals.css`; `next.config.ts`; `package.json`)

**Interfaces:**
- Consumes: Task 1's specifier; Task 2's `body-ci.yml`; the pointer files from `packages/orrery/templates/next-supabase-mono/`.
- Produces: root scripts `lint`, `typecheck`, `test`, `test:db`, `orrery` (`orrery`), `dev`, `build`. `ci.yml` is the caller: one job `ci` with `uses: vaoan/Orrery/.github/workflows/body-ci.yml@main`, `with: { database: true }`.

- [ ] **Step 1:** Create the repository with `gh api` (token per command) under `vaoan`, public, then `orrery repo apply vaoan/nebula`.
- [ ] **Step 2:** Write the files. Pointer files are copied from `packages/orrery/templates/next-supabase-mono/` unchanged. `orrery.config.mjs` follows `fixtures/next-supabase-mono/orrery.config.mjs` with `spelling: ["nebula"]` and the web app's `globals.css` as the Tailwind entry point.
- [ ] **Step 3:** One smoke test, `apps/web/tests/home.test.tsx`: the home page renders its title in `es` and in `en`.
- [ ] **Step 4:** Run `pnpm install && pnpm lint && pnpm typecheck && pnpm test`. Expected: all pass with zero lint findings.
- [ ] **Step 5:** PR into `develop` (`feat(app): the empty shell [GH-000]`). CI green. Record the check names it reports for Task 2, Step 5.

### Task 5: i18n and the app shell

**Files (starter):**
- Create: `apps/web/src/i18n/routing.ts`, `request.ts`, `apps/web/messages/es.json`, `en.json`, `apps/web/src/middleware.ts` (shared with Task 7)
- Test: `apps/web/tests/i18n.test.ts`

**Interfaces:**
- Produces: locales `["es", "en"]`, default `es`; every user-facing text through `next-intl`; a header with the app name and a sign-in slot.

- [ ] **Step 1: Failing tests:** both message files have the same keys; `/` redirects to `/es`; `/en` renders English.
- [ ] **Step 2–4:** Run (FAIL), implement, run (PASS); `pnpm lint` clean.
- [ ] **Step 5:** PR `feat(i18n): Spanish and English from the start [GH-000]`.

### Task 6: Supabase, `current_user_id()` and the actors mirror

**Files (starter):**
- Create: `supabase/config.toml`, `supabase/migrations/<timestamp>_identity.sql`, `supabase/tests/identity.test.sql` (pgTAP), `.env.example`
- Modify: root `package.json` (`test:db` = `supabase test db`)

**Interfaces:**
- Produces, in SQL: `user_profiles(id uuid pk, identity_sub text unique not null, created_at)`; `current_user_id() returns uuid` mapping the Clerk `sub` (`auth.jwt()->>'sub'`) to `user_profiles.id`, as Libra does; `actors` mirror keyed on `actor_ref` with the fields `AeleOS/docs/integrating.md` ("The upsert") lists, plus `user_id` referencing `user_profiles`. RLS on: a person reads and writes only their own profile and actors.

- [ ] **Step 1: Failing pgTAP tests:** with a JWT `sub` of A, `current_user_id()` returns A's id; A cannot select B's actors; an actor upsert by A for B's `user_id` is refused; with no JWT, `current_user_id()` is null.
- [ ] **Step 2–4:** `pnpm test:db` (FAIL), write the migration, `pnpm test:db` (PASS).
- [ ] **Step 5:** PR `feat(db): identity and the actors mirror [GH-000]`. CI's database job green.

### Task 7: Owned resources, delegated capabilities and the audit log

**Files (starter):**
- Create: `supabase/migrations/<timestamp>_resources.sql`, `supabase/migrations/<timestamp>_audit.sql`, `supabase/tests/resources.test.sql`, `supabase/tests/audit.test.sql`, `supabase/seed/example-resource.sql` (a `notes` resource type used only by the tests and the README example), `docs/resources.md`

**Interfaces:**
- Consumes: Task 6's `user_profiles` and `current_user_id()`.
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

### Task 8: Login through AeleOS

**Files (starter):**
- Create: `apps/web/src/features/identity/` (`application/sync-actors.ts`, `application/accept-picker-return.ts`, `infrastructure/aeleos-client.ts`, `infrastructure/supabase-server.ts`, `presentation/sign-in-button.tsx`), `apps/web/src/app/[locale]/acting-as/route.ts`
- Modify: `apps/web/src/middleware.ts` (Clerk + next-intl), `.env.example`
- Test: `apps/web/tests/identity/*.test.ts`

**Interfaces:**
- Consumes: Task 6's tables; `AeleOS/docs/integrating.md` sections 1 and 2 (read them; they are the contract).
- Produces: the person login works with Clerk alone (`identity_sub` row created on first sign-in). `AELEOS_FURSONAS=on|off` (default `off`) switches the fursona sync and the picker; with `off`, the person is the actor and the picker route answers 404.
- Produces: `syncActors(clerkToken: string): Promise<{ synced: number }>` calling `GET https://me.furrycolombia.com/api/actors/mine` server-side with the person's own token, upserting on `actor_ref`; `acceptPickerReturn(actorRef: string): Promise<{ ok: true, actorRef } | { ok: false, reason: "unknown" | "not-yours" }>`; a Supabase server client that sends the Clerk session token (Third-Party Auth). Hub base URL from `AELEOS_HUB_URL`, default `https://me.furrycolombia.com`.

- [ ] **Step 1: Failing tests** with a fake hub and an in-memory mirror: first sign-in creates the `user_profiles` row; with `AELEOS_FURSONAS=off` no hub call is made and `/acting-as` is 404; with `on`, sync upserts by `actor_ref` and lets the hub win on its fields; a 401 from the hub surfaces as "sign in again", not as an empty list; `acceptPickerReturn` with another person's actor gives `not-yours`, with an unknown one `unknown`, with your own `ok`.
- [ ] **Step 2–4:** Run (FAIL), implement, run (PASS).
- [ ] **Step 5:** `pnpm build` with only `.env.example` values succeeds, and the middleware does not throw on a request without keys (Review Focus 4).
- [ ] **Step 6:** PR `feat(identity): sign in through AeleOS [GH-000]`.

### Task 9: The AI-layer files

**Files (starter):**
- Create: `CLAUDE.md`, `.claude/rules/*.md` (path-scoped: `apps/web/src/features/**`, `supabase/**` (including how to declare a resource type),  `apps/web/messages/**`, tests), `.claude/settings.json`, `docs/lessons/` (empty, with a README line saying what goes there)

**Interfaces:**
- Consumes: `orrery instructions` (Orrery stage 0).
- Produces: a root `CLAUDE.md` under 200 lines with no history in it: what the body is, commands, layout, where rules live. Rules with `paths:` only; none matches over 40% of source.

- [ ] **Step 1:** From an Orrery checkout, run `pnpm orrery instructions <starter> --touching nebula=apps/web/src/features/identity/application/sync-actors.ts --report docs/observations --label starter`. Expected now: the root alone, well under budget.
- [ ] **Step 2:** Write the files.
- [ ] **Step 3:** Rerun Step 1. Expected: start ≤ 10,000 and task ≤ 25,000 tokens, no oversize, no wide rule. Keep the report (`.md` + `.json`) in Orrery's `docs/observations/`.
- [ ] **Step 4:** PR `docs(ai): instructions within budget [GH-000]` in the starter; a separate Orrery PR for the observation.

### Task 10: Make the starter a template and register it

**Files:**
- Modify (Orrery): `registry.json` (`"nebula": { "repo": "vaoan/nebula", "role": "starter", "class": "next-supabase-mono" }`), `packages/orrery/src/lib/registry.mjs` and tests if `role` is validated against a list
- Modify (starter): repository setting `is_template: true`

- [ ] **Step 1: Failing test** (Orrery): `loadRegistry` accepts role `starter`; `orrery init`'s default `--template` is the registry's single `starter` body.
- [ ] **Step 2–4:** Run (FAIL), implement, run (PASS).
- [ ] **Step 5:** `PATCH /repos/vaoan/nebula` with `is_template: true` (token per command).
- [ ] **Step 6:** PR `feat(registry): the starter is a body [GH-000]`.

### Task 11: The trial run — create Portia

**Files:**
- Create (Orrery): `docs/observations/2026-11-XX-portia-init.md` and `.json`

- [ ] **Step 1:** `pnpm orrery init portia --class next-supabase-mono --dry-run`. Expected: five steps listed, nothing written.
- [ ] **Step 2:** `pnpm orrery init portia --class next-supabase-mono`. Expected: exit 0; `vaoan/portia` exists; the registry PR is open.
- [ ] **Step 3:** Clone `vaoan/portia`; `pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm test && pnpm build` with no edits. Expected: all pass.
- [ ] **Step 4:** Open a trivial PR in Portia (a README line); CI green with the protection's required checks satisfied.
- [ ] **Step 5:** `orrery instructions` on Portia within budget.
- [ ] **Step 6:** Record each result in the observation. Any hand repair needed is a failure of trial criterion 1: list it, and stop for the owner's decision (fix forward, or delete Portia and fix Orrery).
