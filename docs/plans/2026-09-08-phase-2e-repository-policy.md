# Phase 2e — Repository policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One git flow for every repository, written as a policy file, applied by `orrery repo apply`, enforced by `orrery ci` verbs and hooks, and exercised first on Orrery itself.

**Architecture:** A small GitHub REST client with an injectable `fetch`; a policy file plus a pure planner that turns "current repo state versus policy" into a list of operations, so idempotence is a property of the planner and is unit-tested with fakes; the CI verbs are pure functions over strings and injected runners, dispatched by one `orrery ci` command that reads the Actions event file; workflows in Orrery carry job structure only and call the verbs.

**Tech Stack:** Node ≥24 (built-in `fetch`), pnpm, ESM `.mjs`, vitest, husky 9. No new runtime dependencies in `packages/orrery`.

**Spec:** `docs/specs/2026-09-08-phase-2e-repository-policy-design.md`

## Global Constraints

- Node `>=24`; pnpm; ESM only; source files are `.mjs` under `packages/orrery/`.
- This repository contains no application code. Only the governance tool and its assets.
- Deterministic enforcement: every verb is a script with a test that would fail if it lied. No AI in the loop.
- Strictest wins; where strictness is undefined, consistency; then benefit.
- Branch types: `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `chore`, `revert`; plus `release/vYYYY.MM.DD.N`.
- PR title: `type(scope): subject [GH-n]`, subject ≤ 80 characters, exactly one tag, `GH-000` means no issue.
- Routes: `type/*` → `develop` (squash); `release/*` → `main` (merge); `fix/*` → `main` (squash); `main` → `develop` (merge commit, automatic). Rebase disabled.
- Protection on `main` and `develop`: 0 approvals but a PR required; strict required checks; conversation resolution; admins bound; no force push or deletion; linear history off on both; signatures not required.
- Squash commit title is the PR title, body is the PR body (ruled during planning: both donors use "commit or PR title", which is unpredictable; the PR title is what the checks validated).
- No body other than Orrery is modified before Task 13's explicit confirmation.
- Every commit message ends with:
  `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` and
  `Claude-Session: https://claude.ai/code/session_01NUi5KvdndoSSt5xHuiuYVK`.

## Verified before writing (2026-09-08)

- The local `gh` token has scopes `gist, read:org, read:packages, repo, workflow`. `repo` is enough to create a repository, set protection and settings on repositories `vaoan` owns, and open PRs. It has no `delete_repo`, so the integration test uses a persistent fixture repository, `vaoan/orrery-policy-fixture`, reset before each run rather than deleted.
- `GET /repos/{o}/{r}` returns `default_branch, allow_squash_merge, allow_merge_commit, allow_rebase_merge, delete_branch_on_merge, allow_auto_merge, allow_update_branch, squash_merge_commit_title, squash_merge_commit_message`. Both donors today: `COMMIT_OR_PR_TITLE` / `COMMIT_MESSAGES`, `allow_update_branch: false`.
- `GET /repos/{o}/{r}/branches/{b}/protection` returns keys `required_status_checks, enforce_admins, required_pull_request_reviews, required_linear_history, allow_force_pushes, allow_deletions, required_conversation_resolution, required_signatures, lock_branch, allow_fork_syncing, block_creations`, each boolean one as `{ enabled }`.
- Secrets: aeleos has `GH_TOKEN`; libra and Orrery have none for bots. PRs opened with the default `GITHUB_TOKEN` do not trigger `pull_request` workflows, so bot PRs need a personal token; aeleos already does this.
- Regexes below were run against real branch and title samples from libra, Puck and Orrery; results are recorded in each test.

---

### Task 1: GitHub REST client

**Files:**
- Create: `packages/orrery/src/lib/github.mjs`
- Test: `packages/orrery/tests/github.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `resolveToken(env = process.env, runGh = defaultRunGh) => string` — `ORRERY_GH_TOKEN`, then `GITHUB_TOKEN`, then `gh auth token`; throws naming all three when none yields a token.
  - `createGithub({ token, fetchImpl = fetch, baseUrl = "https://api.github.com" }) => { request(method, path, body?) => Promise<{ status, data }> }` — JSON in and out; `404` resolves to `{ status: 404, data: null }`; any other status ≥ 400 throws `GithubError` with `status` and the response `message`.

- [ ] **Step 1: Write the failing test**

```javascript
// packages/orrery/tests/github.test.mjs
import { describe, it, expect } from "vitest";
import { createGithub, resolveToken, GithubError } from "../src/lib/github.mjs";

const jsonResponse = (status, body) => ({
  status,
  ok: status < 400,
  json: async () => body,
  text: async () => JSON.stringify(body),
});

describe("resolveToken", () => {
  it("prefers ORRERY_GH_TOKEN over GITHUB_TOKEN over gh", () => {
    expect(resolveToken({ ORRERY_GH_TOKEN: "a", GITHUB_TOKEN: "b" }, () => "c")).toBe("a");
    expect(resolveToken({ GITHUB_TOKEN: "b" }, () => "c")).toBe("b");
    expect(resolveToken({}, () => "c\n")).toBe("c");
  });

  it("throws naming every source when none yields a token", () => {
    expect(() => resolveToken({}, () => "")).toThrow(/ORRERY_GH_TOKEN.*GITHUB_TOKEN.*gh auth token/s);
  });
});

describe("createGithub", () => {
  it("sends JSON with the token and parses the response", async () => {
    const calls = [];
    const fetchImpl = async (url, init) => {
      calls.push({ url, init });
      return jsonResponse(200, { ok: true });
    };
    const gh = createGithub({ token: "t", fetchImpl });
    const result = await gh.request("PATCH", "/repos/vaoan/x", { allow_auto_merge: true });
    expect(result).toEqual({ status: 200, data: { ok: true } });
    expect(calls[0].url).toBe("https://api.github.com/repos/vaoan/x");
    expect(calls[0].init.method).toBe("PATCH");
    expect(calls[0].init.headers.Authorization).toBe("Bearer t");
    expect(JSON.parse(calls[0].init.body)).toEqual({ allow_auto_merge: true });
  });

  it("resolves 404 to null data instead of throwing", async () => {
    const gh = createGithub({ token: "t", fetchImpl: async () => jsonResponse(404, { message: "Not Found" }) });
    expect(await gh.request("GET", "/repos/vaoan/x/branches/develop")).toEqual({ status: 404, data: null });
  });

  it("throws GithubError carrying status and message on other failures", async () => {
    const gh = createGithub({ token: "t", fetchImpl: async () => jsonResponse(422, { message: "Validation Failed" }) });
    await expect(gh.request("PUT", "/x")).rejects.toMatchObject({ status: 422, message: /Validation Failed/ });
    await expect(gh.request("PUT", "/x")).rejects.toBeInstanceOf(GithubError);
  });

  it("treats 204 as success with null data", async () => {
    const gh = createGithub({ token: "t", fetchImpl: async () => ({ status: 204, ok: true, json: async () => { throw new Error("no body"); }, text: async () => "" }) });
    expect(await gh.request("DELETE", "/x")).toEqual({ status: 204, data: null });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run packages/orrery/tests/github.test.mjs`
Expected: FAIL — cannot resolve `../src/lib/github.mjs`

- [ ] **Step 3: Write the implementation**

```javascript
// packages/orrery/src/lib/github.mjs
import { execFileSync } from "node:child_process";

export class GithubError extends Error {
  constructor(status, message, path) {
    super(`GitHub ${status} on ${path}: ${message}`);
    this.name = "GithubError";
    this.status = status;
  }
}

function defaultRunGh() {
  try {
    // `gh` is a real binary on every platform, not a .cmd shim, so no shell.
    return execFileSync("gh", ["auth", "token"], { encoding: "utf8" });
  } catch {
    return "";
  }
}

export function resolveToken(env = process.env, runGh = defaultRunGh) {
  const token = env.ORRERY_GH_TOKEN || env.GITHUB_TOKEN || runGh().trim();
  if (!token) {
    throw new Error(
      "no GitHub token: set ORRERY_GH_TOKEN or GITHUB_TOKEN, or log in with gh so `gh auth token` works"
    );
  }
  return token;
}

export function createGithub({ token, fetchImpl = fetch, baseUrl = "https://api.github.com" }) {
  async function request(method, path, body) {
    const response = await fetchImpl(baseUrl + path, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (response.status === 404) return { status: 404, data: null };
    if (response.status === 204) return { status: 204, data: null };

    if (response.status >= 400) {
      let message = "";
      try {
        message = (await response.json()).message ?? "";
      } catch {
        message = await response.text();
      }
      throw new GithubError(response.status, message, path);
    }

    return { status: response.status, data: await response.json() };
  }

  return { request };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run packages/orrery/tests/github.test.mjs`
Expected: PASS — 6 tests

- [ ] **Step 5: Commit**

```bash
git add packages/orrery/src/lib/github.mjs packages/orrery/tests/github.test.mjs
git commit -m "feat(github): minimal REST client with injectable fetch and token resolution"
```

---

### Task 2: The repository policy file and its loader

**Files:**
- Create: `policy/repository.json`
- Create: `packages/orrery/src/lib/policy.mjs`
- Test: `packages/orrery/tests/policy.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `loadPolicy(path = defaultPolicyPath) => object` — parses the JSON and throws with every validation error joined if `validatePolicy` returns any.
  - `validatePolicy(policy) => string[]` — empty when valid.
  - `defaultPolicyPath` — absolute path to `policy/repository.json` at the repository root (two levels above `packages/orrery/src/lib`).
  - The policy shape, relied on by Tasks 3–13:

```jsonc
{
  "defaultBranch": "develop",
  "protectedBranches": ["main", "develop"],
  "settings": { /* PATCH /repos body */ },
  "protection": { "main": { /* PUT protection body minus contexts */ }, "develop": { ... } },
  "requiredChecks": { "main": ["..."], "develop": ["..."] },
  "sharedCiMarker": "# orrery-ci",
  "labels": [{ "name": "...", "color": "hex", "description": "..." }]
}
```

- [ ] **Step 1: Write the policy file**

```json
{
  "$comment": "The constellation's repository policy. Applied by `orrery repo apply`. Spec: docs/specs/2026-09-08-phase-2e-repository-policy-design.md",
  "defaultBranch": "develop",
  "protectedBranches": ["main", "develop"],
  "settings": {
    "allow_squash_merge": true,
    "allow_merge_commit": true,
    "allow_rebase_merge": false,
    "delete_branch_on_merge": true,
    "allow_auto_merge": true,
    "allow_update_branch": true,
    "squash_merge_commit_title": "PR_TITLE",
    "squash_merge_commit_message": "PR_BODY"
  },
  "protection": {
    "main": {
      "enforce_admins": true,
      "required_pull_request_reviews": {
        "dismiss_stale_reviews": true,
        "require_code_owner_reviews": false,
        "required_approving_review_count": 0
      },
      "restrictions": null,
      "required_linear_history": false,
      "allow_force_pushes": false,
      "allow_deletions": false,
      "required_conversation_resolution": true,
      "lock_branch": false,
      "allow_fork_syncing": false
    },
    "develop": {
      "enforce_admins": true,
      "required_pull_request_reviews": {
        "dismiss_stale_reviews": true,
        "require_code_owner_reviews": false,
        "required_approving_review_count": 0
      },
      "restrictions": null,
      "required_linear_history": false,
      "allow_force_pushes": false,
      "allow_deletions": false,
      "required_conversation_resolution": true,
      "lock_branch": false,
      "allow_fork_syncing": false
    }
  },
  "requiredChecks": {
    "main": ["test", "branch-target", "branch-name", "pr-title", "config-drift"],
    "develop": ["test", "branch-target", "branch-name", "pr-title", "config-drift", "branch-sync"]
  },
  "sharedCiMarker": "# orrery-ci",
  "labels": [
    { "name": "feat", "color": "0e8a16", "description": "A new capability" },
    { "name": "fix", "color": "d73a4a", "description": "A bug fix" },
    { "name": "docs", "color": "0075ca", "description": "Documentation only" },
    { "name": "refactor", "color": "cfd3d7", "description": "No behaviour change" },
    { "name": "perf", "color": "fbca04", "description": "Performance" },
    { "name": "test", "color": "bfd4f2", "description": "Tests only" },
    { "name": "chore", "color": "ededed", "description": "Tooling and maintenance" },
    { "name": "revert", "color": "000000", "description": "Reverts a previous change" },
    { "name": "release", "color": "5319e7", "description": "A release branch into main" },
    { "name": "back-merge", "color": "c5def5", "description": "Automatic merge of main into develop" },
    { "name": "orrery", "color": "1d76db", "description": "Opened by Orrery automation" }
  ]
}
```

- [ ] **Step 2: Write the failing test**

```javascript
// packages/orrery/tests/policy.test.mjs
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadPolicy, validatePolicy, defaultPolicyPath } from "../src/lib/policy.mjs";

describe("the committed policy", () => {
  it("loads and validates", () => {
    const policy = loadPolicy();
    expect(policy.defaultBranch).toBe("develop");
    expect(policy.protectedBranches).toEqual(["main", "develop"]);
    expect(policy.settings.allow_rebase_merge).toBe(false);
    expect(policy.requiredChecks.develop).toContain("branch-sync");
    expect(policy.requiredChecks.main).not.toContain("branch-sync");
  });

  it("lives at the repository root", () => {
    expect(defaultPolicyPath.replaceAll("\\", "/")).toMatch(/\/policy\/repository\.json$/);
  });
});

describe("validatePolicy", () => {
  const valid = () => JSON.parse(fs.readFileSync(defaultPolicyPath, "utf8"));

  it("accepts the committed policy", () => {
    expect(validatePolicy(valid())).toEqual([]);
  });

  it("requires every protected branch to have protection and required checks", () => {
    const p = valid();
    delete p.protection.develop;
    delete p.requiredChecks.develop;
    expect(validatePolicy(p)).toEqual([
      "protection.develop is missing",
      "requiredChecks.develop is missing",
    ]);
  });

  it("requires the default branch to be protected", () => {
    const p = valid();
    p.defaultBranch = "trunk";
    expect(validatePolicy(p)).toContain("defaultBranch trunk is not in protectedBranches");
  });

  it("rejects a rebase-merge setting of true", () => {
    const p = valid();
    p.settings.allow_rebase_merge = true;
    expect(validatePolicy(p)).toContain("settings.allow_rebase_merge must be false");
  });

  it("rejects labels without a six-hex colour", () => {
    const p = valid();
    p.labels.push({ name: "x", color: "red", description: "" });
    expect(validatePolicy(p)).toContain("label x has an invalid colour: red");
  });
});

describe("loadPolicy", () => {
  it("throws listing every error for an invalid file", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-policy-"));
    const file = path.join(dir, "bad.json");
    fs.writeFileSync(file, JSON.stringify({ defaultBranch: "x", protectedBranches: [], settings: {}, protection: {}, requiredChecks: {}, labels: [] }));
    expect(() => loadPolicy(file)).toThrow(/defaultBranch x is not in protectedBranches/);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm vitest run packages/orrery/tests/policy.test.mjs`
Expected: FAIL — cannot resolve `../src/lib/policy.mjs`

- [ ] **Step 4: Write the implementation**

```javascript
// packages/orrery/src/lib/policy.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const defaultPolicyPath = path.resolve(here, "../../../../policy/repository.json");

const HEX_COLOUR = /^[0-9a-f]{6}$/i;

export function validatePolicy(policy) {
  const errors = [];
  const branches = Array.isArray(policy.protectedBranches) ? policy.protectedBranches : [];

  if (!branches.includes(policy.defaultBranch)) {
    errors.push(`defaultBranch ${policy.defaultBranch} is not in protectedBranches`);
  }
  for (const branch of branches) {
    if (!policy.protection?.[branch]) errors.push(`protection.${branch} is missing`);
    if (!Array.isArray(policy.requiredChecks?.[branch])) errors.push(`requiredChecks.${branch} is missing`);
  }
  if (policy.settings?.allow_rebase_merge !== false) {
    errors.push("settings.allow_rebase_merge must be false");
  }
  for (const label of policy.labels ?? []) {
    if (!HEX_COLOUR.test(label.color ?? "")) {
      errors.push(`label ${label.name} has an invalid colour: ${label.color}`);
    }
  }
  return errors;
}

export function loadPolicy(file = defaultPolicyPath) {
  const policy = JSON.parse(fs.readFileSync(file, "utf8"));
  const errors = validatePolicy(policy);
  if (errors.length > 0) {
    throw new Error(`invalid policy ${file}:\n  ${errors.join("\n  ")}`);
  }
  return policy;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm vitest run packages/orrery/tests/policy.test.mjs`
Expected: PASS — 8 tests

- [ ] **Step 6: Commit**

```bash
git add policy/repository.json packages/orrery/src/lib/policy.mjs packages/orrery/tests/policy.test.mjs
git commit -m "feat(policy): the constellation repository policy and its loader"
```

---

### Task 3: The repository planner and applier

Pure planner, so idempotence is a unit-tested property, then an applier that executes the plan through the client.

**Files:**
- Create: `packages/orrery/src/lib/repo-policy.mjs`
- Test: `packages/orrery/tests/repo-policy.test.mjs`

**Interfaces:**
- Consumes: `createGithub(...).request` (Task 1); the policy shape (Task 2).
- Produces:
  - `readRepoState(github, repo) => Promise<State>` where `State = { settings, defaultBranch, branches: { [name]: sha|null }, protection: { [name]: NormalisedProtection|null }, labels: Array<{name,color,description}>, sharedCi: boolean }`.
  - `normaliseProtection(apiResponse) => object` — GET shape to PUT shape (unwraps `{ enabled }`, keeps `required_status_checks.contexts` sorted).
  - `desiredProtection(policy, branch, state) => object` — the PUT body: policy protection plus `required_status_checks: { strict: true, contexts }`, where contexts are the policy's list when `state.sharedCi` is true and otherwise the branch's existing contexts (or `[]`).
  - `planRepoChanges(state, policy) => Op[]` with `Op` one of `{ kind: "create-branch", name, fromSha }`, `{ kind: "update-settings", patch }`, `{ kind: "set-default-branch", name }`, `{ kind: "set-protection", branch, body }`, `{ kind: "create-label", label }`, `{ kind: "update-label", label }`.
  - `applyRepoPolicy(github, repo, policy, { dryRun = false } = {}) => Promise<{ ops, applied }>` — executes each op in order; `applied` is `[]` on dry run.

- [ ] **Step 1: Write the failing test**

```javascript
// packages/orrery/tests/repo-policy.test.mjs
import { describe, it, expect } from "vitest";
import { loadPolicy } from "../src/lib/policy.mjs";
import {
  normaliseProtection,
  desiredProtection,
  planRepoChanges,
  readRepoState,
  applyRepoPolicy,
} from "../src/lib/repo-policy.mjs";

const policy = loadPolicy();

const apiProtection = (contexts) => ({
  required_status_checks: { strict: true, contexts, checks: contexts.map((c) => ({ context: c })) },
  enforce_admins: { enabled: true },
  required_pull_request_reviews: {
    dismiss_stale_reviews: true,
    require_code_owner_reviews: false,
    required_approving_review_count: 0,
  },
  required_linear_history: { enabled: false },
  allow_force_pushes: { enabled: false },
  allow_deletions: { enabled: false },
  required_conversation_resolution: { enabled: true },
  required_signatures: { enabled: false },
  lock_branch: { enabled: false },
  allow_fork_syncing: { enabled: false },
  block_creations: { enabled: false },
});

const compliantState = () => ({
  settings: { ...policy.settings },
  defaultBranch: "develop",
  branches: { main: "aaa", develop: "bbb" },
  protection: {
    main: normaliseProtection(apiProtection(policy.requiredChecks.main)),
    develop: normaliseProtection(apiProtection(policy.requiredChecks.develop)),
  },
  labels: policy.labels.map((l) => ({ ...l })),
  sharedCi: true,
});

describe("normaliseProtection", () => {
  it("unwraps enabled flags and sorts contexts", () => {
    const n = normaliseProtection(apiProtection(["z", "a"]));
    expect(n.enforce_admins).toBe(true);
    expect(n.required_status_checks).toEqual({ strict: true, contexts: ["a", "z"] });
    expect(n.required_signatures).toBeUndefined();
    expect(n.restrictions).toBeNull();
  });
});

describe("desiredProtection", () => {
  it("uses the policy's checks when the repo runs the shared CI", () => {
    const body = desiredProtection(policy, "develop", { ...compliantState(), sharedCi: true });
    expect(body.required_status_checks.contexts).toEqual([...policy.requiredChecks.develop].sort());
  });

  it("keeps the repo's existing checks when it does not run the shared CI", () => {
    const state = compliantState();
    state.sharedCi = false;
    state.protection.develop.required_status_checks.contexts = ["Quality Checks", "Unit Tests"];
    const body = desiredProtection(policy, "develop", state);
    expect(body.required_status_checks.contexts).toEqual(["Quality Checks", "Unit Tests"]);
  });

  it("uses no checks for an unprotected branch off the shared CI", () => {
    const state = compliantState();
    state.sharedCi = false;
    state.protection.main = null;
    expect(desiredProtection(policy, "main", state).required_status_checks.contexts).toEqual([]);
  });
});

describe("planRepoChanges", () => {
  it("plans nothing for a compliant repository", () => {
    expect(planRepoChanges(compliantState(), policy)).toEqual([]);
  });

  it("creates develop from main and makes it default when develop is missing", () => {
    const state = compliantState();
    state.branches.develop = null;
    state.protection.develop = null;
    state.defaultBranch = "main";
    const kinds = planRepoChanges(state, policy).map((op) => op.kind);
    expect(kinds).toEqual(["create-branch", "set-default-branch", "set-protection"]);
    expect(planRepoChanges(state, policy)[0]).toEqual({ kind: "create-branch", name: "develop", fromSha: "aaa" });
  });

  it("patches only the settings that differ", () => {
    const state = compliantState();
    state.settings.allow_rebase_merge = true;
    state.settings.squash_merge_commit_title = "COMMIT_OR_PR_TITLE";
    const [op] = planRepoChanges(state, policy);
    expect(op).toEqual({
      kind: "update-settings",
      patch: { allow_rebase_merge: false, squash_merge_commit_title: "PR_TITLE" },
    });
  });

  it("re-sets protection when one field differs", () => {
    const state = compliantState();
    state.protection.main.required_conversation_resolution = false;
    const ops = planRepoChanges(state, policy);
    expect(ops).toHaveLength(1);
    expect(ops[0].kind).toBe("set-protection");
    expect(ops[0].branch).toBe("main");
    expect(ops[0].body.required_conversation_resolution).toBe(true);
  });

  it("creates missing labels and updates ones whose colour or description differs", () => {
    const state = compliantState();
    state.labels = state.labels.filter((l) => l.name !== "orrery");
    state.labels.find((l) => l.name === "fix").color = "ffffff";
    const ops = planRepoChanges(state, policy);
    expect(ops.map((o) => [o.kind, o.label.name])).toEqual([
      ["update-label", "fix"],
      ["create-label", "orrery"],
    ]);
  });

  it("leaves labels the policy does not name alone", () => {
    const state = compliantState();
    state.labels.push({ name: "wontfix", color: "ffffff", description: "" });
    expect(planRepoChanges(state, policy)).toEqual([]);
  });
});

describe("readRepoState", () => {
  it("assembles state from the five endpoints and detects the shared CI marker", async () => {
    const answers = {
      "GET /repos/vaoan/x": { status: 200, data: { default_branch: "main", allow_squash_merge: true, allow_merge_commit: true, allow_rebase_merge: true, delete_branch_on_merge: false, allow_auto_merge: false, allow_update_branch: false, squash_merge_commit_title: "COMMIT_OR_PR_TITLE", squash_merge_commit_message: "COMMIT_MESSAGES" } },
      "GET /repos/vaoan/x/branches/main": { status: 200, data: { commit: { sha: "aaa" } } },
      "GET /repos/vaoan/x/branches/develop": { status: 404, data: null },
      "GET /repos/vaoan/x/branches/main/protection": { status: 404, data: null },
      "GET /repos/vaoan/x/branches/develop/protection": { status: 404, data: null },
      "GET /repos/vaoan/x/labels?per_page=100": { status: 200, data: [{ name: "bug", color: "d73a4a", description: "x" }] },
      "GET /repos/vaoan/x/contents/.github/workflows/ci.yml": { status: 200, data: { content: Buffer.from("# orrery-ci\nname: ci\n").toString("base64"), encoding: "base64" } },
    };
    const github = { request: async (m, p) => answers[`${m} ${p}`] ?? { status: 404, data: null } };
    const state = await readRepoState(github, "vaoan/x");
    expect(state.defaultBranch).toBe("main");
    expect(state.branches).toEqual({ main: "aaa", develop: null });
    expect(state.protection).toEqual({ main: null, develop: null });
    expect(state.labels).toEqual([{ name: "bug", color: "d73a4a", description: "x" }]);
    expect(state.sharedCi).toBe(true);
    expect(state.settings.allow_rebase_merge).toBe(true);
  });

  it("reports sharedCi false when ci.yml is absent or lacks the marker", async () => {
    const github = { request: async (m, p) => (p.endsWith("/repos/vaoan/x") ? { status: 200, data: { default_branch: "main" } } : { status: 404, data: null }) };
    expect((await readRepoState(github, "vaoan/x")).sharedCi).toBe(false);
  });
});

describe("applyRepoPolicy", () => {
  it("executes the planned operations in order and is a no-op the second time", async () => {
    const calls = [];
    let created = false;
    const github = {
      request: async (m, p, body) => {
        calls.push([m, p]);
        if (m === "GET" && p === "/repos/vaoan/x") return { status: 200, data: { default_branch: created ? "develop" : "main", ...policy.settings, allow_rebase_merge: created ? false : true } };
        if (m === "GET" && p === "/repos/vaoan/x/branches/main") return { status: 200, data: { commit: { sha: "aaa" } } };
        if (m === "GET" && p === "/repos/vaoan/x/branches/develop") return created ? { status: 200, data: { commit: { sha: "aaa" } } } : { status: 404, data: null };
        if (m === "GET" && p.endsWith("/protection")) return created ? { status: 200, data: apiProtection(policy.requiredChecks[p.includes("/main/") ? "main" : "develop"]) } : { status: 404, data: null };
        if (m === "GET" && p.startsWith("/repos/vaoan/x/labels")) return { status: 200, data: created ? policy.labels : [] };
        if (m === "GET" && p.includes("/contents/")) return { status: 200, data: { content: Buffer.from("# orrery-ci").toString("base64"), encoding: "base64" } };
        if (m === "POST" && p === "/repos/vaoan/x/git/refs") { created = true; return { status: 201, data: {} }; }
        return { status: 200, data: {} };
      },
    };
    const first = await applyRepoPolicy(github, "vaoan/x", policy);
    expect(first.ops.map((o) => o.kind)).toEqual([
      "create-branch", "update-settings", "set-default-branch", "set-protection", "set-protection",
      ...policy.labels.map(() => "create-label"),
    ]);
    expect(first.applied).toHaveLength(first.ops.length);
    expect(calls).toContainEqual(["POST", "/repos/vaoan/x/git/refs"]);
    expect(calls).toContainEqual(["PUT", "/repos/vaoan/x/branches/develop/protection"]);

    const second = await applyRepoPolicy(github, "vaoan/x", policy);
    expect(second.ops).toEqual([]);
  });

  it("plans but does not execute on dry run", async () => {
    const calls = [];
    const github = {
      request: async (m, p) => {
        calls.push(m);
        if (m === "GET" && p === "/repos/vaoan/x") return { status: 200, data: { default_branch: "main", ...policy.settings } };
        if (m === "GET" && p === "/repos/vaoan/x/branches/main") return { status: 200, data: { commit: { sha: "aaa" } } };
        return { status: 404, data: null };
      },
    };
    const result = await applyRepoPolicy(github, "vaoan/x", policy, { dryRun: true });
    expect(result.ops.length).toBeGreaterThan(0);
    expect(result.applied).toEqual([]);
    expect(calls.every((m) => m === "GET")).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run packages/orrery/tests/repo-policy.test.mjs`
Expected: FAIL — cannot resolve `../src/lib/repo-policy.mjs`

- [ ] **Step 3: Write the implementation**

```javascript
// packages/orrery/src/lib/repo-policy.mjs

const PROTECTION_FLAGS = [
  "enforce_admins",
  "required_linear_history",
  "allow_force_pushes",
  "allow_deletions",
  "required_conversation_resolution",
  "lock_branch",
  "allow_fork_syncing",
];

const REVIEW_FIELDS = ["dismiss_stale_reviews", "require_code_owner_reviews", "required_approving_review_count"];

const unwrap = (value) => (value && typeof value === "object" && "enabled" in value ? value.enabled : value);

/** GET shape -> PUT shape, so state and policy compare field for field. */
export function normaliseProtection(api) {
  if (!api) return null;
  const reviews = api.required_pull_request_reviews ?? null;
  const normalised = {
    required_status_checks: {
      strict: Boolean(api.required_status_checks?.strict),
      contexts: [...(api.required_status_checks?.contexts ?? [])].sort(),
    },
    required_pull_request_reviews: reviews
      ? Object.fromEntries(REVIEW_FIELDS.map((f) => [f, reviews[f] ?? (f === "required_approving_review_count" ? 0 : false)]))
      : null,
    restrictions: null,
  };
  for (const flag of PROTECTION_FLAGS) normalised[flag] = Boolean(unwrap(api[flag]));
  return normalised;
}

export function desiredProtection(policy, branch, state) {
  const contexts = state.sharedCi
    ? [...policy.requiredChecks[branch]].sort()
    : [...(state.protection[branch]?.required_status_checks?.contexts ?? [])].sort();

  return {
    ...policy.protection[branch],
    required_status_checks: { strict: true, contexts },
  };
}

const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Order matters: a branch must exist before it can be default or protected.
export function planRepoChanges(state, policy) {
  const ops = [];
  const sourceSha = state.branches.main;

  for (const branch of policy.protectedBranches) {
    if (state.branches[branch] === null && branch !== "main") {
      ops.push({ kind: "create-branch", name: branch, fromSha: sourceSha });
    }
  }

  const patch = {};
  for (const [key, value] of Object.entries(policy.settings)) {
    if (state.settings[key] !== value) patch[key] = value;
  }
  if (Object.keys(patch).length > 0) ops.push({ kind: "update-settings", patch });

  if (state.defaultBranch !== policy.defaultBranch) {
    ops.push({ kind: "set-default-branch", name: policy.defaultBranch });
  }

  for (const branch of policy.protectedBranches) {
    const body = desiredProtection(policy, branch, state);
    const current = state.protection[branch];
    if (!current || !sameJson(normaliseProtection({ ...current, required_status_checks: current.required_status_checks, ...Object.fromEntries(PROTECTION_FLAGS.map((f) => [f, { enabled: current[f] }])) }), normaliseProtection({ ...body, ...Object.fromEntries(PROTECTION_FLAGS.map((f) => [f, { enabled: body[f] }])) }))) {
      ops.push({ kind: "set-protection", branch, body });
    }
  }

  const byName = new Map(state.labels.map((l) => [l.name, l]));
  for (const label of policy.labels) {
    const existing = byName.get(label.name);
    if (!existing) ops.push({ kind: "create-label", label });
    else if (existing.color.toLowerCase() !== label.color.toLowerCase() || (existing.description ?? "") !== label.description) {
      ops.push({ kind: "update-label", label });
    }
  }

  return ops;
}

export async function readRepoState(github, repo, policy = { protectedBranches: ["main", "develop"], sharedCiMarker: "# orrery-ci" }) {
  const base = `/repos/${repo}`;
  const { data: repoData } = await github.request("GET", base);
  if (!repoData) throw new Error(`repository ${repo} not found or not accessible`);

  const branches = {};
  const protection = {};
  for (const branch of policy.protectedBranches) {
    const { data: b } = await github.request("GET", `${base}/branches/${branch}`);
    branches[branch] = b?.commit?.sha ?? null;
    const { data: p } = await github.request("GET", `${base}/branches/${branch}/protection`);
    protection[branch] = normaliseProtection(p);
  }

  const { data: labels } = await github.request("GET", `${base}/labels?per_page=100`);

  const { data: ci } = await github.request("GET", `${base}/contents/.github/workflows/ci.yml`);
  const ciText = ci?.content ? Buffer.from(ci.content, ci.encoding ?? "base64").toString("utf8") : "";
  const sharedCi = ciText.includes(policy.sharedCiMarker ?? "# orrery-ci");

  const settings = {};
  for (const key of ["allow_squash_merge", "allow_merge_commit", "allow_rebase_merge", "delete_branch_on_merge", "allow_auto_merge", "allow_update_branch", "squash_merge_commit_title", "squash_merge_commit_message"]) {
    settings[key] = repoData[key];
  }

  return {
    settings,
    defaultBranch: repoData.default_branch,
    branches,
    protection,
    labels: (labels ?? []).map(({ name, color, description }) => ({ name, color, description: description ?? "" })),
    sharedCi,
  };
}

async function execute(github, repo, op) {
  const base = `/repos/${repo}`;
  switch (op.kind) {
    case "create-branch":
      return github.request("POST", `${base}/git/refs`, { ref: `refs/heads/${op.name}`, sha: op.fromSha });
    case "update-settings":
      return github.request("PATCH", base, op.patch);
    case "set-default-branch":
      return github.request("PATCH", base, { default_branch: op.name });
    case "set-protection":
      return github.request("PUT", `${base}/branches/${op.branch}/protection`, op.body);
    case "create-label":
      return github.request("POST", `${base}/labels`, op.label);
    case "update-label":
      return github.request("PATCH", `${base}/labels/${encodeURIComponent(op.label.name)}`, {
        new_name: op.label.name,
        color: op.label.color,
        description: op.label.description,
      });
    default:
      throw new Error(`unknown operation ${op.kind}`);
  }
}

export async function applyRepoPolicy(github, repo, policy, { dryRun = false } = {}) {
  const state = await readRepoState(github, repo, policy);
  const ops = planRepoChanges(state, policy);
  const applied = [];
  if (dryRun) return { ops, applied };

  for (const op of ops) {
    await execute(github, repo, op);
    applied.push(op);
  }
  return { ops, applied };
}
```

The `set-protection` comparison in `planRepoChanges` re-normalises both sides through `normaliseProtection` so that a policy body and a stored state compare on identical shapes. Keep it as one expression; the reviewer should confirm a compliant state plans zero ops (the first `planRepoChanges` test).

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run packages/orrery/tests/repo-policy.test.mjs`
Expected: PASS — 14 tests

- [ ] **Step 5: Commit**

```bash
git add packages/orrery/src/lib/repo-policy.mjs packages/orrery/tests/repo-policy.test.mjs
git commit -m "feat(repo-policy): plan and apply the repository policy idempotently"
```

---

### Task 4: `orrery repo apply` command and the fixture-repository integration test

**Files:**
- Create: `packages/orrery/src/commands/repo.mjs`
- Modify: `packages/orrery/src/cli.mjs` (add `repo` to `COMMANDS` and to `USAGE`)
- Test: `packages/orrery/tests/repo-command.test.mjs`
- Test: `packages/orrery/tests/repo-apply.integration.test.mjs`
- Modify: `vitest.config.mjs` (integration tests run only when `ORRERY_FIXTURE_REPO` is set)

**Interfaces:**
- Consumes: `applyRepoPolicy`, `readRepoState` (Task 3); `loadPolicy` (Task 2); `createGithub`, `resolveToken` (Task 1).
- Produces: default export `(argv, deps) => Promise<number>`; `orrery repo apply <owner/name> [--dry-run] [--policy <file>]`. Prints one line per operation, `nothing to change` when idempotent. Exit `0` on success, `2` on bad arguments, `1` on API failure.

- [ ] **Step 1: Create the fixture repository once**

Run from `Z:\Github\Orrery`:

```bash
gh repo create vaoan/orrery-policy-fixture --private --description "Throwaway target for orrery repo apply tests; reset by the test, never used for anything else" --clone=false
gh api -X PUT repos/vaoan/orrery-policy-fixture/contents/README.md -f message="chore: seed [GH-000]" -f content="$(printf '# orrery-policy-fixture\n' | base64)"
```

Expected: the repository exists with one commit on `main`. Record its name in the report.

- [ ] **Step 2: Write the failing command test**

```javascript
// packages/orrery/tests/repo-command.test.mjs
import { describe, it, expect, vi } from "vitest";
import repo from "../src/commands/repo.mjs";

describe("orrery repo apply", () => {
  it("exits 2 without a subcommand or repository", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await repo([])).toBe(2);
    expect(await repo(["apply"])).toBe(2);
    expect(error.mock.calls.flat().join("\n")).toContain("usage: orrery repo apply <owner/name>");
    error.mockRestore();
  });

  it("prints each operation and exits 0", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const code = await repo(["apply", "vaoan/x"], {
      loadPolicy: () => ({}),
      createGithub: () => ({}),
      resolveToken: () => "t",
      applyRepoPolicy: async () => ({
        ops: [{ kind: "create-branch", name: "develop", fromSha: "aaa" }, { kind: "set-protection", branch: "main", body: {} }],
        applied: [{ kind: "create-branch" }, { kind: "set-protection" }],
      }),
    });
    expect(code).toBe(0);
    const out = log.mock.calls.flat().join("\n");
    expect(out).toContain("create-branch develop");
    expect(out).toContain("set-protection main");
    log.mockRestore();
  });

  it("says nothing to change when the plan is empty", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await repo(["apply", "vaoan/x"], { loadPolicy: () => ({}), createGithub: () => ({}), resolveToken: () => "t", applyRepoPolicy: async () => ({ ops: [], applied: [] }) });
    expect(log.mock.calls.flat().join("\n")).toContain("nothing to change");
    log.mockRestore();
  });

  it("passes --dry-run through and labels the output", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    let seen;
    await repo(["apply", "vaoan/x", "--dry-run"], { loadPolicy: () => ({}), createGithub: () => ({}), resolveToken: () => "t", applyRepoPolicy: async (_g, _r, _p, opts) => { seen = opts; return { ops: [{ kind: "update-settings", patch: {} }], applied: [] }; } });
    expect(seen).toEqual({ dryRun: true });
    expect(log.mock.calls.flat().join("\n")).toContain("dry run");
    log.mockRestore();
  });

  it("exits 1 with the API message on failure", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const code = await repo(["apply", "vaoan/x"], { loadPolicy: () => ({}), createGithub: () => ({}), resolveToken: () => "t", applyRepoPolicy: async () => { throw new Error("GitHub 403 on /x: Resource not accessible"); } });
    expect(code).toBe(1);
    expect(error.mock.calls.flat().join("\n")).toContain("Resource not accessible");
    error.mockRestore();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm vitest run packages/orrery/tests/repo-command.test.mjs`
Expected: FAIL — cannot resolve `../src/commands/repo.mjs`

- [ ] **Step 4: Write the command and register it**

```javascript
// packages/orrery/src/commands/repo.mjs
import { parseArgs } from "node:util";
import { createGithub as realCreateGithub, resolveToken as realResolveToken } from "../lib/github.mjs";
import { loadPolicy as realLoadPolicy } from "../lib/policy.mjs";
import { applyRepoPolicy as realApplyRepoPolicy } from "../lib/repo-policy.mjs";

const USAGE = "usage: orrery repo apply <owner/name> [--dry-run] [--policy <file>]";

const describeOp = (op) => {
  switch (op.kind) {
    case "create-branch": return `create-branch ${op.name} from ${op.fromSha.slice(0, 7)}`;
    case "update-settings": return `update-settings ${Object.keys(op.patch).join(", ")}`;
    case "set-default-branch": return `set-default-branch ${op.name}`;
    case "set-protection": return `set-protection ${op.branch}`;
    case "create-label": return `create-label ${op.label.name}`;
    case "update-label": return `update-label ${op.label.name}`;
    default: return op.kind;
  }
};

export default async function repo(argv, deps = {}) {
  const {
    loadPolicy = realLoadPolicy,
    createGithub = realCreateGithub,
    resolveToken = realResolveToken,
    applyRepoPolicy = realApplyRepoPolicy,
  } = deps;

  let values, positionals;
  try {
    ({ values, positionals } = parseArgs({
      args: argv,
      options: { "dry-run": { type: "boolean", default: false }, policy: { type: "string" } },
      allowPositionals: true,
    }));
  } catch (error) {
    console.error(`${error.message}\n${USAGE}`);
    return 2;
  }

  const [subcommand, target] = positionals;
  if (subcommand !== "apply" || !target || !target.includes("/")) {
    console.error(USAGE);
    return 2;
  }

  try {
    const policy = loadPolicy(values.policy);
    const github = createGithub({ token: resolveToken() });
    const { ops } = await applyRepoPolicy(github, target, policy, { dryRun: values["dry-run"] });

    if (ops.length === 0) {
      console.log(`${target}: nothing to change`);
      return 0;
    }
    console.log(`${target}: ${values["dry-run"] ? "dry run, would apply" : "applied"} ${ops.length} operation(s)`);
    for (const op of ops) console.log(`  ${describeOp(op)}`);
    return 0;
  } catch (error) {
    console.error(error.message);
    return 1;
  }
}
```

In `packages/orrery/src/cli.mjs`, add to `COMMANDS`:

```javascript
  repo: async (argv) => (await import("./commands/repo.mjs")).default(argv),
```

and add to `USAGE`, under `Usage:` and `Commands:` respectively:

```
  orrery repo apply <owner/name> [--dry-run] [--policy <file>]
```
```
  repo apply    bring a repository's branches, protection, settings and labels to policy
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm vitest run packages/orrery/tests/repo-command.test.mjs packages/orrery/tests/cli.test.mjs`
Expected: PASS — 5 new tests, the cli tests still green

- [ ] **Step 6: Write the integration test against the fixture repository**

```javascript
// packages/orrery/tests/repo-apply.integration.test.mjs
// Runs only when ORRERY_FIXTURE_REPO is set (for example vaoan/orrery-policy-fixture).
// It resets the fixture to a pre-policy state, applies the policy twice, and asserts
// the second run is a no-op. It never touches any other repository.
import { describe, it, expect, beforeAll } from "vitest";
import { createGithub, resolveToken } from "../src/lib/github.mjs";
import { loadPolicy } from "../src/lib/policy.mjs";
import { applyRepoPolicy, readRepoState } from "../src/lib/repo-policy.mjs";

const repo = process.env.ORRERY_FIXTURE_REPO;

describe.skipIf(!repo)("orrery repo apply against the fixture repository", () => {
  const policy = loadPolicy();
  let github;

  async function reset() {
    const base = `/repos/${repo}`;
    for (const branch of ["main", "develop"]) {
      try { await github.request("DELETE", `${base}/branches/${branch}/protection`); } catch (e) { if (e.status !== 404) throw e; }
    }
    await github.request("PATCH", base, { default_branch: "main" });
    try { await github.request("DELETE", `${base}/git/refs/heads/develop`); } catch (e) { if (e.status !== 422 && e.status !== 404) throw e; }
    await github.request("PATCH", base, {
      allow_squash_merge: true, allow_merge_commit: true, allow_rebase_merge: true,
      delete_branch_on_merge: false, allow_auto_merge: false, allow_update_branch: false,
      squash_merge_commit_title: "COMMIT_OR_PR_TITLE", squash_merge_commit_message: "COMMIT_MESSAGES",
    });
    const { data: labels } = await github.request("GET", `${base}/labels?per_page=100`);
    for (const label of labels ?? []) {
      if (policy.labels.some((l) => l.name === label.name)) {
        await github.request("DELETE", `${base}/labels/${encodeURIComponent(label.name)}`);
      }
    }
  }

  beforeAll(async () => {
    github = createGithub({ token: resolveToken() });
    await reset();
  }, 60_000);

  it("brings the repository to policy, then finds nothing to change", async () => {
    const first = await applyRepoPolicy(github, repo, policy);
    expect(first.ops.map((o) => o.kind)).toContain("create-branch");
    expect(first.ops.map((o) => o.kind)).toContain("set-protection");
    expect(first.applied).toHaveLength(first.ops.length);

    const state = await readRepoState(github, repo, policy);
    expect(state.defaultBranch).toBe("develop");
    expect(state.settings.allow_rebase_merge).toBe(false);
    expect(state.settings.squash_merge_commit_title).toBe("PR_TITLE");
    expect(state.protection.main.enforce_admins).toBe(true);
    expect(state.protection.develop.required_conversation_resolution).toBe(true);
    // The fixture has no shared ci.yml, so no required contexts are imposed.
    expect(state.protection.develop.required_status_checks.contexts).toEqual([]);

    const second = await applyRepoPolicy(github, repo, policy);
    expect(second.ops).toEqual([]);
  }, 120_000);
});
```

- [ ] **Step 7: Run the integration test for real**

Run (PowerShell): `$env:ORRERY_FIXTURE_REPO="vaoan/orrery-policy-fixture"; pnpm vitest run packages/orrery/tests/repo-apply.integration.test.mjs`
Expected: PASS — 1 test. Then run the whole suite without the variable and confirm the file reports as skipped, not failed.

- [ ] **Step 8: Commit**

```bash
git add packages/orrery/src/commands/repo.mjs packages/orrery/src/cli.mjs packages/orrery/tests/repo-command.test.mjs packages/orrery/tests/repo-apply.integration.test.mjs
git commit -m "feat(repo): orrery repo apply, with a fixture-repository integration test"
```

---

### Task 5: Apply the policy to Orrery itself, first pass

Orrery has no `ci.yml` yet, so this pass creates `develop`, sets it default, applies settings and protection with no required checks. Task 9 adds the checks once the workflow exists.

**Files:** none created. This task is an operation plus a record.

- [ ] **Step 1: Dry run**

Run: `pnpm orrery repo apply vaoan/Orrery --dry-run`
Expected: lists `create-branch develop`, `update-settings …`, `set-default-branch develop`, `set-protection main`, `set-protection develop`, and eleven `create-label` lines. Paste the output into the report.

- [ ] **Step 2: Apply**

Run: `pnpm orrery repo apply vaoan/Orrery`
Expected: the same operations, applied. Then `pnpm orrery repo apply vaoan/Orrery` again prints `vaoan/Orrery: nothing to change`.

- [ ] **Step 3: Move the working branch onto the flow**

The current work branch was cut from `main` before `develop` existed. Retarget it:

```bash
git fetch origin
git branch --set-upstream-to=origin/develop
git rev-list --count origin/develop..HEAD   # the branch's own commits; expected > 0
git rev-list --count origin/main..origin/develop  # expected 0: develop was just created from main
```

From this point every PR in this plan targets `develop`. Record in the ledger that Orrery is on the flow as of this commit.

- [ ] **Step 4: Commit a decision record**

Create `docs/decisions/0003-repository-policy.md`:

```markdown
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
```

```bash
git add docs/decisions/0003-repository-policy.md
git commit -m "docs(adr): 0003 one repository policy, applied by command"
```

---

### Task 6: Git-flow checks as pure functions

**Files:**
- Create: `packages/orrery/src/lib/git-flow.mjs`
- Test: `packages/orrery/tests/git-flow.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces (all synchronous unless noted; every check returns `{ ok: boolean, reason: string }` with `reason` empty when ok):
  - `TYPES = ["feat","fix","docs","refactor","perf","test","chore","revert"]`
  - `BRANCH_PATTERN`, `RELEASE_PATTERN`, `TITLE_PATTERN`, `COMMIT_PATTERN` (exported regexes)
  - `branchType(name) => type | "release" | null`
  - `checkBranchName(name)`
  - `checkBranchTarget(head, base)`
  - `parsePrTitle(title) => { type, scope, subject, issue } | null`
  - `checkPrTitle(title, headBranch, { issueExists }) => Promise<Result>` where `issueExists(number) => Promise<boolean>`
  - `checkCommitMessage(message)`
  - `checkBranchSync({ run }) => Promise<Result & { behind: number }>` — `run(cmd, args) => string`
  - `checkConfigDrift({ run, baseRef, headSha, files }) => Promise<Result & { stale: string[], intentional: string[] }>`

- [ ] **Step 1: Write the failing test**

```javascript
// packages/orrery/tests/git-flow.test.mjs
import { describe, it, expect } from "vitest";
import {
  TYPES, branchType, checkBranchName, checkBranchTarget, parsePrTitle, checkPrTitle,
  checkCommitMessage, checkBranchSync, checkConfigDrift,
} from "../src/lib/git-flow.mjs";

describe("branch names", () => {
  it.each([
    ["feat/phase-2a-diff-eslint", true],
    ["release/v2026.09.05.1", true],
    ["docs/repo-boilerplate-spec", true],
    ["chore/node24-actions", true],
    ["fix/Deploy-Image-Prune-Field-Separator", false], // PascalCase, real libra branch
    ["release/GH-000_v2026.05.27.1", false],          // real libra branch, wrong shape
    ["feat/two--dashes", false],
    ["feature/x", false],
    ["main", false],
    ["develop", false],
  ])("%s -> %s", (name, ok) => {
    expect(checkBranchName(name).ok).toBe(ok);
  });

  it("names the rule in the reason", () => {
    expect(checkBranchName("Feature/X").reason).toMatch(/type\/short-kebab-description/);
    expect(checkBranchName("Feature/X").reason).toContain(TYPES.join("|"));
  });

  it("extracts the type", () => {
    expect(branchType("fix/a")).toBe("fix");
    expect(branchType("release/v2026.09.08.1")).toBe("release");
    expect(branchType("main")).toBeNull();
  });
});

describe("branch targets", () => {
  it.each([
    ["feat/x", "develop", true],
    ["fix/x", "main", true],
    ["fix/x", "develop", true],
    ["release/v2026.09.08.1", "main", true],
    ["main", "develop", true],                 // the back-merge
    ["feat/x", "main", false],
    ["docs/x", "main", false],
    ["release/v2026.09.08.1", "develop", false],
    ["develop", "main", false],                // never merge develop directly
  ])("%s -> %s : %s", (head, base, ok) => {
    expect(checkBranchTarget(head, base).ok).toBe(ok);
  });

  it("explains which branches may target main", () => {
    expect(checkBranchTarget("feat/x", "main").reason).toMatch(/only release\/\* and fix\/\* may target main/);
  });
});

describe("PR titles", () => {
  it("parses a conventional title with tag", () => {
    expect(parsePrTitle("feat(scripts): kebab-case filename codemod [GH-000]")).toEqual({
      type: "feat", scope: "scripts", subject: "kebab-case filename codemod", issue: 0,
    });
    expect(parsePrTitle("feat: no scope [GH-12]")).toEqual({ type: "feat", scope: null, subject: "no scope", issue: 12 });
  });

  it.each([
    "Task 9/9: Closing sweep [GH-000]",   // real aeleos title
    "feat(x): missing tag",
    "feat(x): two [GH-1] [GH-2]",
    "feat(x):  leading space [GH-1]",
    "style(x): dropped type [GH-1]",
    `feat(x): ${"a".repeat(81)} [GH-1]`,
  ])("rejects %s", (title) => {
    expect(parsePrTitle(title)).toBeNull();
  });

  it("accepts an 80-character subject", () => {
    expect(parsePrTitle(`feat(x): ${"a".repeat(80)} [GH-1]`)).not.toBeNull();
  });

  it("requires the title type to equal the branch type", async () => {
    const r = await checkPrTitle("feat(x): y [GH-000]", "fix/x", { issueExists: async () => true });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/title type feat does not match branch type fix/);
  });

  it("accepts GH-000 without consulting issues", async () => {
    let asked = false;
    const r = await checkPrTitle("fix(x): y [GH-000]", "fix/x", { issueExists: async () => { asked = true; return false; } });
    expect(r.ok).toBe(true);
    expect(asked).toBe(false);
  });

  it("requires any other issue to exist", async () => {
    const r = await checkPrTitle("fix(x): y [GH-999]", "fix/x", { issueExists: async (n) => n === 12 });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/GH-999 does not exist/);
    expect((await checkPrTitle("fix(x): y [GH-12]", "fix/x", { issueExists: async (n) => n === 12 })).ok).toBe(true);
  });

  it("release branches must carry chore(release) titles with the version", async () => {
    const ok = await checkPrTitle("chore(release): v2026.09.08.1 [GH-000]", "release/v2026.09.08.1", { issueExists: async () => true });
    expect(ok.ok).toBe(true);
    const bad = await checkPrTitle("chore(release): v2026.09.08.2 [GH-000]", "release/v2026.09.08.1", { issueExists: async () => true });
    expect(bad.ok).toBe(false);
    expect(bad.reason).toMatch(/must be chore\(release\): v2026\.09\.08\.1/);
  });
});

describe("commit messages", () => {
  it.each([
    ["docs(spec): Phase 2e repository policy design", true],
    ["feat(cli): x [GH-000]", true],
    ["Merge pull request #1 from vaoan/feat/phase-2a-diff-eslint", true],
    ["Merge branch 'main' into develop", true],
    ["Merge remote-tracking branch 'origin/develop' into feat/x", true],
    ["Scaffold Orrery for development", false],
    ["fixed stuff", false],
    ["feat(cli): x\n\nBody text\n\nCo-Authored-By: someone", true],
  ])("%j -> %s", (message, ok) => {
    expect(checkCommitMessage(message).ok).toBe(ok);
  });
});

describe("branch sync", () => {
  it("passes when main has no commits develop lacks", async () => {
    const r = await checkBranchSync({ run: (cmd, args) => (args.includes("rev-list") ? "0\n" : "") });
    expect(r).toEqual({ ok: true, reason: "", behind: 0 });
  });

  it("fails naming the count and asks for the back-merge", async () => {
    const r = await checkBranchSync({ run: (cmd, args) => (args.includes("rev-list") ? "3\n" : "") });
    expect(r.ok).toBe(false);
    expect(r.behind).toBe(3);
    expect(r.reason).toMatch(/main has 3 commit\(s\) that develop lacks/);
    expect(r.reason).toMatch(/back-merge/);
  });

  it("fetches both branches before counting", async () => {
    const calls = [];
    await checkBranchSync({ run: (cmd, args) => { calls.push(args.join(" ")); return "0"; } });
    expect(calls[0]).toBe("fetch --no-tags origin main develop");
    expect(calls[1]).toBe("rev-list --count origin/develop..origin/main");
  });
});

describe("config drift", () => {
  const files = ["eslint.config.mjs", "package.json"];
  const run = (changedByPr, differing) => (cmd, args) => {
    if (args[0] === "merge-base") return "mb\n";
    if (args[0] === "diff") return changedByPr.join("\n");
    if (args[0] === "show") {
      const [ref, file] = args[1].split(":");
      return differing.includes(file) && ref === "head" ? "changed" : "same";
    }
    return "";
  };

  it("passes when the tooling files match the base", async () => {
    const r = await checkConfigDrift({ run: run([], []), baseRef: "origin/develop", headSha: "head", files });
    expect(r).toEqual({ ok: true, reason: "", stale: [], intentional: [] });
  });

  it("allows a difference the PR itself made", async () => {
    const r = await checkConfigDrift({ run: run(["package.json"], ["package.json"]), baseRef: "origin/develop", headSha: "head", files });
    expect(r.ok).toBe(true);
    expect(r.intentional).toEqual(["package.json"]);
  });

  it("fails on a difference the PR did not make", async () => {
    const r = await checkConfigDrift({ run: run([], ["eslint.config.mjs"]), baseRef: "origin/develop", headSha: "head", files });
    expect(r.ok).toBe(false);
    expect(r.stale).toEqual(["eslint.config.mjs"]);
    expect(r.reason).toMatch(/eslint\.config\.mjs.*differs from origin\/develop without this PR changing it/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run packages/orrery/tests/git-flow.test.mjs`
Expected: FAIL — cannot resolve `../src/lib/git-flow.mjs`

- [ ] **Step 3: Write the implementation**

```javascript
// packages/orrery/src/lib/git-flow.mjs

export const TYPES = ["feat", "fix", "docs", "refactor", "perf", "test", "chore", "revert"];
const TYPE_ALT = TYPES.join("|");

export const BRANCH_PATTERN = new RegExp(`^(${TYPE_ALT})\\/[a-z0-9]+(?:-[a-z0-9]+)*$`);
export const RELEASE_PATTERN = /^release\/(v\d{4}\.\d{2}\.\d{2}\.\d+)$/;
// Subject: 1-80 chars, no leading whitespace, never containing another tag. Exactly one tag at the end.
export const TITLE_PATTERN = new RegExp(`^(${TYPE_ALT})(?:\\(([a-z0-9-]+)\\))?: ((?=\\S)(?:(?!\\[GH-)[^\\r\\n]){1,80}) \\[GH-(\\d+)\\]$`);
export const COMMIT_PATTERN = new RegExp(
  `^(?:(?:${TYPE_ALT})(?:\\([a-z0-9-]+\\))?: (?=\\S)(?:(?!\\[GH-)[^\\r\\n]){1,80}(?: \\[GH-\\d+\\])?|Merge (?:pull request|branch|remote-tracking branch) .+)$`
);

const ok = () => ({ ok: true, reason: "" });
const fail = (reason) => ({ ok: false, reason });

export function branchType(name) {
  if (RELEASE_PATTERN.test(name)) return "release";
  const match = BRANCH_PATTERN.exec(name);
  return match ? match[1] : null;
}

export function checkBranchName(name) {
  if (branchType(name)) return ok();
  return fail(
    `branch "${name}" must be type/short-kebab-description with type one of ${TYPE_ALT}, or release/vYYYY.MM.DD.N`
  );
}

export function checkBranchTarget(head, base) {
  const type = branchType(head);
  if (base === "main") {
    if (type === "release" || type === "fix") return ok();
    return fail(`branch "${head}" cannot target main: only release/* and fix/* may target main`);
  }
  if (base === "develop") {
    if (head === "main") return ok(); // the automatic back-merge
    if (type === "release") return fail(`release branch "${head}" must target main, not develop`);
    if (head === "develop" || type === null) return fail(`branch "${head}" cannot target develop`);
    return ok();
  }
  return ok(); // stacked branches and other bases are not governed
}

export function parsePrTitle(title) {
  const match = TITLE_PATTERN.exec(title);
  if (!match) return null;
  const [, type, scope, subject, issue] = match;
  return { type, scope: scope ?? null, subject, issue: Number(issue) };
}

export async function checkPrTitle(title, headBranch, { issueExists }) {
  const parsed = parsePrTitle(title);
  if (!parsed) {
    return fail(`title "${title}" must be type(scope): subject [GH-n] with type one of ${TYPE_ALT}, subject ≤ 80 chars, exactly one tag`);
  }
  const type = branchType(headBranch);
  if (type === "release") {
    const version = RELEASE_PATTERN.exec(headBranch)[1];
    const expected = `chore(release): ${version}`;
    if (!title.startsWith(`${expected} `)) return fail(`release title must be ${expected} [GH-n]`);
  } else if (type && parsed.type !== type) {
    return fail(`title type ${parsed.type} does not match branch type ${type}`);
  }
  if (parsed.issue !== 0 && !(await issueExists(parsed.issue))) {
    return fail(`issue GH-${parsed.issue} does not exist in this repository; use GH-000 for work with no issue`);
  }
  return ok();
}

export function checkCommitMessage(message) {
  const subject = message.split(/\r?\n/, 1)[0];
  if (COMMIT_PATTERN.test(subject)) return ok();
  return fail(`commit subject "${subject}" must be type(scope): subject with type one of ${TYPE_ALT}`);
}

export async function checkBranchSync({ run }) {
  run("git", ["fetch", "--no-tags", "origin", "main", "develop"]);
  const behind = Number(run("git", ["rev-list", "--count", "origin/develop..origin/main"]).trim());
  if (behind === 0) return { ...ok(), behind };
  return {
    ...fail(`main has ${behind} commit(s) that develop lacks; the back-merge PR from main into develop must land before anything else merges into develop`),
    behind,
  };
}

export async function checkConfigDrift({ run, baseRef, headSha, files }) {
  const mergeBase = run("git", ["merge-base", baseRef, headSha]).trim();
  const changedByPr = new Set(run("git", ["diff", "--name-only", mergeBase, headSha]).split(/\r?\n/).filter(Boolean));
  const stale = [];
  const intentional = [];
  for (const file of files) {
    const baseContent = run("git", ["show", `${baseRef}:${file}`]);
    const headContent = run("git", ["show", `${headSha}:${file}`]);
    if (baseContent === headContent) continue;
    (changedByPr.has(file) ? intentional : stale).push(file);
  }
  if (stale.length === 0) return { ...ok(), stale, intentional };
  return {
    ...fail(`${stale.join(", ")} differs from ${baseRef} without this PR changing it; update the branch from ${baseRef}`),
    stale,
    intentional,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run packages/orrery/tests/git-flow.test.mjs`
Expected: PASS — 48 tests (10 + 1 + 1 branch-name; 9 + 1 target; 1 + 6 + 1 + 1 + 1 + 1 + 1 title; 8 commit; 3 sync; 3 drift; verified 2026-09-08 by running this exact file). Report the exact count.

- [ ] **Step 5: Commit**

```bash
git add packages/orrery/src/lib/git-flow.mjs packages/orrery/tests/git-flow.test.mjs
git commit -m "feat(git-flow): branch, target, title, commit, sync and drift checks as pure functions"
```

---

### Task 7: `orrery ci <verb>` command

Reads the Actions event file, or explicit flags, and runs one verb. Exit `0` pass, `1` fail, `2` bad arguments.

**Files:**
- Create: `packages/orrery/src/commands/ci.mjs`
- Modify: `packages/orrery/src/cli.mjs` (register `ci`; add usage lines)
- Test: `packages/orrery/tests/ci-command.test.mjs`

**Interfaces:**
- Consumes: every check in Task 6; `createGithub`/`resolveToken` (Task 1) for `issueExists`.
- Produces: default export `(argv, deps) => Promise<number>`. Verbs: `branch-target`, `branch-name`, `pr-title`, `branch-sync`, `config-drift`. Context comes from `--head`, `--base`, `--title`, `--repo`, `--head-sha`, or from the JSON at `GITHUB_EVENT_PATH` (`pull_request.head.ref`, `.base.ref`, `.title`, `.head.sha`, `repository.full_name`). `config-drift` also takes `--files a,b,c` with the default list below.

Default drift files (the union of what libra guards plus Orrery's pointers): `eslint.config.mjs, eslint.local.mjs, tsconfig.json, tsconfig.base.json, package.json, pnpm-lock.yaml, pnpm-workspace.yaml, orrery.config.mjs, .github/workflows/ci.yml`.

- [ ] **Step 1: Write the failing test**

```javascript
// packages/orrery/tests/ci-command.test.mjs
import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ci from "../src/commands/ci.mjs";

const event = (pr) => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "orrery-event-")), "event.json");
  fs.writeFileSync(file, JSON.stringify({ pull_request: pr, repository: { full_name: "vaoan/x" } }));
  return file;
};

const quiet = () => {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  return { out: () => [...log.mock.calls, ...error.mock.calls].flat().join("\n"), restore: () => { log.mockRestore(); error.mockRestore(); } };
};

describe("orrery ci", () => {
  it("exits 2 on a missing or unknown verb", async () => {
    const q = quiet();
    expect(await ci([])).toBe(2);
    expect(await ci(["nonsense"])).toBe(2);
    expect(q.out()).toContain("usage: orrery ci <branch-target|branch-name|pr-title|branch-sync|config-drift>");
    q.restore();
  });

  it("reads head, base and title from the event file", async () => {
    const q = quiet();
    const env = { GITHUB_EVENT_PATH: event({ head: { ref: "feat/x", sha: "h" }, base: { ref: "main" }, title: "feat(x): y [GH-000]" }) };
    expect(await ci(["branch-target"], { env })).toBe(1);
    expect(q.out()).toContain("only release/* and fix/* may target main");
    q.restore();
  });

  it("lets flags override the event", async () => {
    const q = quiet();
    const env = { GITHUB_EVENT_PATH: event({ head: { ref: "feat/x", sha: "h" }, base: { ref: "main" }, title: "t" }) };
    expect(await ci(["branch-target", "--base", "develop"], { env })).toBe(0);
    q.restore();
  });

  it("exits 2 when a verb lacks its inputs", async () => {
    const q = quiet();
    expect(await ci(["branch-name"], { env: {} })).toBe(2);
    expect(q.out()).toContain("--head is required");
    q.restore();
  });

  it("checks the branch name", async () => {
    const q = quiet();
    expect(await ci(["branch-name", "--head", "Feature/X"], { env: {} })).toBe(1);
    expect(await ci(["branch-name", "--head", "feat/x"], { env: {} })).toBe(0);
    q.restore();
  });

  it("checks the title against the repository's issues", async () => {
    const q = quiet();
    const asked = [];
    const deps = {
      env: {},
      createGithub: () => ({ request: async (m, p) => { asked.push(p); return p.endsWith("/issues/12") ? { status: 200, data: { number: 12 } } : { status: 404, data: null }; } }),
      resolveToken: () => "t",
    };
    expect(await ci(["pr-title", "--head", "fix/x", "--title", "fix(x): y [GH-12]", "--repo", "vaoan/x"], deps)).toBe(0);
    expect(asked).toEqual(["/repos/vaoan/x/issues/12"]);
    expect(await ci(["pr-title", "--head", "fix/x", "--title", "fix(x): y [GH-13]", "--repo", "vaoan/x"], deps)).toBe(1);
    expect(q.out()).toContain("GH-13 does not exist");
    q.restore();
  });

  it("treats a pull request number as a non-existent issue", async () => {
    const q = quiet();
    const deps = { env: {}, createGithub: () => ({ request: async () => ({ status: 200, data: { number: 5, pull_request: {} } }) }), resolveToken: () => "t" };
    expect(await ci(["pr-title", "--head", "fix/x", "--title", "fix(x): y [GH-5]", "--repo", "vaoan/x"], deps)).toBe(1);
    q.restore();
  });

  it("runs branch-sync through the injected runner", async () => {
    const q = quiet();
    expect(await ci(["branch-sync"], { env: {}, run: (c, a) => (a[0] === "rev-list" ? "2" : "") })).toBe(1);
    expect(q.out()).toContain("main has 2 commit(s)");
    expect(await ci(["branch-sync"], { env: {}, run: (c, a) => (a[0] === "rev-list" ? "0" : "") })).toBe(0);
    q.restore();
  });

  it("runs config-drift with the default file list and the event's refs", async () => {
    const q = quiet();
    const seen = [];
    const run = (c, a) => { seen.push(a.join(" ")); if (a[0] === "merge-base") return "mb"; if (a[0] === "diff") return ""; return "same"; };
    const env = { GITHUB_EVENT_PATH: event({ head: { ref: "feat/x", sha: "headsha" }, base: { ref: "develop" }, title: "t" }) };
    expect(await ci(["config-drift"], { env, run })).toBe(0);
    expect(seen[0]).toBe("fetch --no-tags origin develop");
    expect(seen.some((s) => s === "show origin/develop:eslint.config.mjs")).toBe(true);
    expect(seen.some((s) => s === "show headsha:orrery.config.mjs")).toBe(true);
    q.restore();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run packages/orrery/tests/ci-command.test.mjs`
Expected: FAIL — cannot resolve `../src/commands/ci.mjs`

- [ ] **Step 3: Write the command and register it**

```javascript
// packages/orrery/src/commands/ci.mjs
import fs from "node:fs";
import { parseArgs } from "node:util";
import { execFileSync } from "node:child_process";
import { createGithub as realCreateGithub, resolveToken as realResolveToken } from "../lib/github.mjs";
import {
  checkBranchName, checkBranchTarget, checkPrTitle, checkBranchSync, checkConfigDrift,
} from "../lib/git-flow.mjs";

const VERBS = ["branch-target", "branch-name", "pr-title", "branch-sync", "config-drift"];
const USAGE = `usage: orrery ci <${VERBS.join("|")}> [--head <branch>] [--base <branch>] [--title <text>] [--repo <owner/name>] [--head-sha <sha>] [--files a,b,c]`;

export const DEFAULT_DRIFT_FILES = [
  "eslint.config.mjs", "eslint.local.mjs", "tsconfig.json", "tsconfig.base.json",
  "package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", "orrery.config.mjs",
  ".github/workflows/ci.yml",
];

function defaultRun(command, args) {
  return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

// `git show ref:file` on a missing file exits non-zero; treat that as "absent" so a file that
// exists on one side only is a real difference, not a crash.
function tolerantRun(run) {
  return (command, args) => {
    try {
      return run(command, args);
    } catch (error) {
      if (args[0] === "show") return "";
      throw error;
    }
  };
}

function readEvent(env) {
  const file = env.GITHUB_EVENT_PATH;
  if (!file || !fs.existsSync(file)) return {};
  const event = JSON.parse(fs.readFileSync(file, "utf8"));
  const pr = event.pull_request ?? {};
  return {
    head: pr.head?.ref,
    base: pr.base?.ref,
    title: pr.title,
    headSha: pr.head?.sha,
    repo: event.repository?.full_name,
  };
}

export default async function ci(argv, deps = {}) {
  const { env = process.env, run = defaultRun, createGithub = realCreateGithub, resolveToken = realResolveToken } = deps;

  let values, positionals;
  try {
    ({ values, positionals } = parseArgs({
      args: argv,
      options: {
        head: { type: "string" }, base: { type: "string" }, title: { type: "string" },
        repo: { type: "string" }, "head-sha": { type: "string" }, files: { type: "string" },
      },
      allowPositionals: true,
    }));
  } catch (error) {
    console.error(`${error.message}\n${USAGE}`);
    return 2;
  }

  const [verb] = positionals;
  if (!VERBS.includes(verb)) {
    console.error(USAGE);
    return 2;
  }

  const event = readEvent(env);
  const ctx = {
    head: values.head ?? event.head,
    base: values.base ?? event.base,
    title: values.title ?? event.title,
    headSha: values["head-sha"] ?? event.headSha,
    repo: values.repo ?? event.repo,
  };
  const need = (...keys) => {
    for (const key of keys) {
      if (!ctx[key]) {
        console.error(`--${key === "headSha" ? "head-sha" : key} is required for ${verb} (or run inside a pull_request workflow)`);
        return false;
      }
    }
    return true;
  };

  let result;
  switch (verb) {
    case "branch-name":
      if (!need("head")) return 2;
      result = checkBranchName(ctx.head);
      break;
    case "branch-target":
      if (!need("head", "base")) return 2;
      result = checkBranchTarget(ctx.head, ctx.base);
      break;
    case "pr-title": {
      if (!need("head", "title", "repo")) return 2;
      const github = createGithub({ token: resolveToken() });
      const issueExists = async (number) => {
        const { data } = await github.request("GET", `/repos/${ctx.repo}/issues/${number}`);
        return Boolean(data) && !("pull_request" in data);
      };
      result = await checkPrTitle(ctx.title, ctx.head, { issueExists });
      break;
    }
    case "branch-sync":
      result = await checkBranchSync({ run });
      break;
    case "config-drift": {
      if (!need("base", "headSha")) return 2;
      const files = values.files ? values.files.split(",").map((f) => f.trim()).filter(Boolean) : DEFAULT_DRIFT_FILES;
      run("git", ["fetch", "--no-tags", "origin", ctx.base]);
      result = await checkConfigDrift({ run: tolerantRun(run), baseRef: `origin/${ctx.base}`, headSha: ctx.headSha, files });
      break;
    }
    default:
      return 2;
  }

  if (result.ok) {
    console.log(`${verb}: ok`);
    return 0;
  }
  console.error(`${verb}: ${result.reason}`);
  return 1;
}
```

Register in `packages/orrery/src/cli.mjs`:

```javascript
  ci: async (argv) => (await import("./commands/ci.mjs")).default(argv),
```

Usage lines:

```
  orrery ci <verb> [--head] [--base] [--title] [--repo] [--head-sha] [--files]
```
```
  ci            run one git-flow check: branch-target, branch-name, pr-title, branch-sync, config-drift
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run packages/orrery/tests/ci-command.test.mjs packages/orrery/tests/cli.test.mjs`
Expected: PASS — 9 new tests

- [ ] **Step 5: Commit**

```bash
git add packages/orrery/src/commands/ci.mjs packages/orrery/src/cli.mjs packages/orrery/tests/ci-command.test.mjs
git commit -m "feat(ci): orrery ci verbs reading the Actions event or explicit flags"
```

---

### Task 8: Workflows in Orrery: shared CI, back-merge, release creation

YAML carries structure only. Each job calls one verb. Orrery is both the definition and its own first caller: `ci.yml` has `workflow_call` for bodies and `pull_request`/`push` for itself.

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/back-merge.yml`
- Create: `.github/workflows/release.yml`
- Create: `.github/pull_request_template.md`
- Test: `packages/orrery/tests/workflows.test.mjs`

**Interfaces:**
- Consumes: `orrery ci <verb>` (Task 7); the policy's `requiredChecks` names (Task 2) — **job names must equal the check names in the policy exactly**: `test`, `branch-target`, `branch-name`, `pr-title`, `config-drift`, `branch-sync`.
- Produces: the shared `ci.yml` bodies will reference as `vaoan/Orrery/.github/workflows/ci.yml@main` (Phase 2d); the marker line `# orrery-ci` on its first line, which `readRepoState` detects.

- [ ] **Step 1: Write the failing test**

```javascript
// packages/orrery/tests/workflows.test.mjs
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPolicy } from "../src/lib/policy.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const jobNames = (yaml) => [...yaml.matchAll(/^  ([a-z-]+):\n(?:    [^\n]*\n)*?    name: \1\n/gm)].map((m) => m[1]);

describe(".github/workflows/ci.yml", () => {
  const yaml = read(".github/workflows/ci.yml");
  const policy = loadPolicy();

  it("starts with the shared-CI marker", () => {
    expect(yaml.split("\n")[0]).toBe(policy.sharedCiMarker);
  });

  it("is callable by bodies and runs on Orrery's own PRs and pushes", () => {
    expect(yaml).toMatch(/^on:\n(?:.*\n)*?  workflow_call:/m);
    expect(yaml).toMatch(/  pull_request:\n    branches: \[develop, main\]/);
    expect(yaml).toMatch(/  push:\n    branches: \[develop, main\]/);
  });

  it("defines one job per required check, named exactly as the policy names it", () => {
    const names = jobNames(yaml);
    for (const check of new Set([...policy.requiredChecks.main, ...policy.requiredChecks.develop])) {
      expect(names).toContain(check);
    }
  });

  it("runs branch-sync only for PRs into develop", () => {
    expect(yaml).toMatch(/  branch-sync:\n(?:    [^\n]*\n)*?    if: github\.event_name == 'pull_request' && github\.event\.pull_request\.base\.ref == 'develop'/);
  });

  it("calls each verb through the package", () => {
    for (const verb of ["branch-target", "branch-name", "pr-title", "branch-sync", "config-drift"]) {
      expect(yaml).toContain(`pnpm orrery ci ${verb}`);
    }
    expect(yaml).toContain("pnpm test");
  });
});

describe(".github/workflows/back-merge.yml", () => {
  const yaml = read(".github/workflows/back-merge.yml");
  it("runs on push to main and opens a merge-commit PR into develop with automerge", () => {
    expect(yaml).toMatch(/  push:\n    branches: \[main\]/);
    expect(yaml).toContain("--base develop");
    expect(yaml).toContain("--head main");
    expect(yaml).toContain("--merge --auto");
    expect(yaml).not.toContain("--squash");
  });
  it("uses the bot token, not GITHUB_TOKEN, so the PR triggers checks", () => {
    expect(yaml).toContain("secrets.ORRERY_BOT_TOKEN");
  });
});

describe(".github/workflows/release.yml", () => {
  const yaml = read(".github/workflows/release.yml");
  it("creates a GitHub release when a release branch merges into main", () => {
    expect(yaml).toContain("github.event.pull_request.merged == true");
    expect(yaml).toContain("startsWith(github.event.pull_request.head.ref, 'release/')");
    expect(yaml).toContain("gh release create");
  });
});

describe(".github/pull_request_template.md", () => {
  it("states the routes the checks enforce", () => {
    const md = read(".github/pull_request_template.md");
    expect(md).toContain("`type/*` → `develop`");
    expect(md).toContain("`fix/*` → `main`");
    expect(md).toContain("`release/*` → `main`");
    expect(md).toContain("[GH-000]");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run packages/orrery/tests/workflows.test.mjs`
Expected: FAIL — ENOENT on `.github/workflows/ci.yml`

- [ ] **Step 3: Write the workflows**

`.github/workflows/ci.yml`:

```yaml
# orrery-ci
# The constellation's shared CI. Bodies reference this file at @main; Orrery runs it on itself.
# Job names are the required-check names in policy/repository.json and must not be renamed
# without changing the policy in the same PR.
name: ci

on:
  workflow_call:
  pull_request:
    branches: [develop, main]
    types: [opened, synchronize, reopened, edited, ready_for_review]
  push:
    branches: [develop, main]

permissions:
  contents: read
  pull-requests: read
  issues: read

env:
  PNPM_VERSION: 11

jobs:
  test:
    name: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}
      - uses: actions/setup-node@v5
        with:
          node-version: 24
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm test

  branch-target:
    name: branch-target
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}
      - uses: actions/setup-node@v5
        with:
          node-version: 24
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm orrery ci branch-target

  branch-name:
    name: branch-name
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}
      - uses: actions/setup-node@v5
        with:
          node-version: 24
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm orrery ci branch-name

  pr-title:
    name: pr-title
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}
      - uses: actions/setup-node@v5
        with:
          node-version: 24
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm orrery ci pr-title
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  config-drift:
    name: config-drift
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
        with:
          fetch-depth: 0
      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}
      - uses: actions/setup-node@v5
        with:
          node-version: 24
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm orrery ci config-drift

  branch-sync:
    name: branch-sync
    if: github.event_name == 'pull_request' && github.event.pull_request.base.ref == 'develop'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
        with:
          fetch-depth: 0
      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}
      - uses: actions/setup-node@v5
        with:
          node-version: 24
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm orrery ci branch-sync
```

`.github/workflows/back-merge.yml`:

```yaml
# Opens the merge-commit back-merge from main into develop after every push to main
# (a release or a fix landing). Uses a bot token: PRs opened with GITHUB_TOKEN do not
# trigger pull_request workflows, so the required checks would never run.
name: back-merge

on:
  push:
    branches: [main]

permissions:
  contents: read

jobs:
  open:
    name: open back-merge PR
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
        with:
          fetch-depth: 0
      - name: Skip when develop already contains main
        id: gap
        run: |
          git fetch --no-tags origin develop
          echo "behind=$(git rev-list --count origin/develop..origin/main)" >> "$GITHUB_OUTPUT"
      - name: Open or reuse the back-merge PR
        if: steps.gap.outputs.behind != '0'
        env:
          GH_TOKEN: ${{ secrets.ORRERY_BOT_TOKEN }}
        run: |
          existing=$(gh pr list --repo "$GITHUB_REPOSITORY" --base develop --head main --state open --json number --jq '.[0].number')
          if [ -z "$existing" ]; then
            gh pr create --repo "$GITHUB_REPOSITORY" --base develop --head main \
              --title "chore(back-merge): main into develop [GH-000]" \
              --body "Automatic back-merge. main is ${{ steps.gap.outputs.behind }} commit(s) ahead of develop. Merge commit, never squash." \
              --label back-merge --label orrery
            existing=$(gh pr list --repo "$GITHUB_REPOSITORY" --base develop --head main --state open --json number --jq '.[0].number')
          fi
          gh pr merge "$existing" --repo "$GITHUB_REPOSITORY" --merge --auto
```

`.github/workflows/release.yml`:

```yaml
# Creates the GitHub Release when a release branch merges into main.
name: release

on:
  pull_request:
    branches: [main]
    types: [closed]

permissions:
  contents: write

jobs:
  create:
    name: create release
    if: github.event.pull_request.merged == true && startsWith(github.event.pull_request.head.ref, 'release/')
    runs-on: ubuntu-latest
    steps:
      - name: Version from the branch name
        id: version
        run: echo "version=${GITHUB_HEAD_REF#release/}" >> "$GITHUB_OUTPUT"
        env:
          GITHUB_HEAD_REF: ${{ github.event.pull_request.head.ref }}
      - name: Create the release
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          gh release create "${{ steps.version.outputs.version }}" \
            --repo "$GITHUB_REPOSITORY" \
            --target main \
            --title "${{ steps.version.outputs.version }}" \
            --generate-notes
```

`.github/pull_request_template.md`:

```markdown
## Summary

<!-- What and why. -->

## Route

Routes are enforced by the `branch-target` check:

- `type/*` → `develop` (squash) — `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `chore`, `revert`
- `fix/*` → `main` (squash), then an automatic back-merge into `develop`
- `release/*` → `main` (merge commit), cut by `orrery release`

Title: `type(scope): subject [GH-n]`, with `[GH-000]` for work with no issue.

## Checklist

- [ ] `pnpm test` passes locally
- [ ] Every ruling I made is recorded where the next reader will find it
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run packages/orrery/tests/workflows.test.mjs`
Expected: PASS — 9 tests

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml .github/workflows/back-merge.yml .github/workflows/release.yml .github/pull_request_template.md packages/orrery/tests/workflows.test.mjs
git commit -m "ci: shared workflow with one job per required check, back-merge and release workflows"
```

---

### Task 9: Open the first PR through the flow, then apply the required checks to Orrery

This task exercises the flow on Orrery before any check is required, then makes the checks required. It is sequenced so that Orrery is never in a state where a required check cannot run.

**Files:** none. Operations and a ledger entry.

- [ ] **Step 1: Verify the branch and title comply**

```bash
git branch --show-current            # must match type/short-kebab-description
pnpm orrery ci branch-name --head "$(git branch --show-current)"
pnpm orrery ci branch-target --head "$(git branch --show-current)" --base develop
```

Expected: both print `ok`. If the branch was named before this plan, rename it: `git branch -m feat/phase-2e-repository-policy` and push with `-u`.

- [ ] **Step 2: Push and open the PR into develop**

```bash
git push -u origin HEAD
gh pr create --base develop --title "feat(policy): repository policy, git-flow checks and shared CI [GH-000]" --body-file .superpowers/sdd/2026-09-08-phase-2e-repository-policy/pr-body.md
```

Write the PR body first: a summary of Tasks 1–8, the ADR link, and the test count. Expected: the `ci` workflow runs on the PR and every job is green. If a job is red, fix it in this branch; do not proceed.

- [ ] **Step 3: Confirm `readRepoState` now sees the shared CI**

Run: `pnpm orrery repo apply vaoan/Orrery --dry-run`
Expected: exactly two operations, `set-protection main` and `set-protection develop`, because `ci.yml` with the marker is on `develop` only after merge. If the dry run shows nothing, the marker is not on develop yet: wait for Step 4.

- [ ] **Step 4: Merge the PR and apply the checks**

```bash
gh pr merge --squash --auto
```

After it merges (the checks on this PR are the first evidence the flow works):

```bash
git checkout develop && git pull --ff-only
pnpm orrery repo apply vaoan/Orrery
pnpm orrery repo apply vaoan/Orrery   # prints: nothing to change
gh api repos/vaoan/Orrery/branches/develop/protection -q '.required_status_checks.contexts'
```

Expected: the last command prints the six develop checks. Record in the ledger: "Orrery on the flow with required checks as of <sha>".

From here on, every later task's branch is cut from `develop` (`git checkout -b type/name origin/develop`).

---

### Task 10: Hooks: `orrery hook commit-msg` and `orrery hook pre-push`, and Orrery's own hooks

**Files:**
- Create: `packages/orrery/src/commands/hook.mjs`
- Modify: `packages/orrery/src/cli.mjs` (register `hook`; usage)
- Create: `.husky/commit-msg`, `.husky/pre-push`
- Modify: `package.json` (root: `"prepare": "husky"`, devDependency `husky`)
- Test: `packages/orrery/tests/hook-command.test.mjs`
- Test: `packages/orrery/tests/hooks.process.test.mjs`

**Interfaces:**
- Consumes: `checkCommitMessage`, `checkBranchName` (Task 6).
- Produces: `orrery hook commit-msg <file>` exits 1 with the reason on a bad subject; `orrery hook pre-push` checks the current branch name and then runs `pnpm run test --if-present` unless `ORRERY_HOOK_SKIP_TESTS=1`; both exit 0 when clean.

- [ ] **Step 1: Write the failing command test**

```javascript
// packages/orrery/tests/hook-command.test.mjs
import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import hook from "../src/commands/hook.mjs";

const msgFile = (text) => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "orrery-msg-")), "COMMIT_EDITMSG");
  fs.writeFileSync(f, text);
  return f;
};

describe("orrery hook", () => {
  it("exits 2 on an unknown hook", async () => {
    const e = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await hook(["nonsense"])).toBe(2);
    expect(e.mock.calls.flat().join("\n")).toContain("usage: orrery hook <commit-msg|pre-push>");
    e.mockRestore();
  });

  it("commit-msg accepts a conventional subject and ignores comment lines", async () => {
    expect(await hook(["commit-msg", msgFile("# comment\nfeat(x): y\n\nbody\n")])).toBe(0);
  });

  it("commit-msg rejects a free-form subject with the reason", async () => {
    const e = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await hook(["commit-msg", msgFile("fixed stuff\n")])).toBe(1);
    expect(e.mock.calls.flat().join("\n")).toMatch(/commit subject "fixed stuff" must be/);
    e.mockRestore();
  });

  it("commit-msg lets a merge commit through", async () => {
    expect(await hook(["commit-msg", msgFile("Merge branch 'main' into develop\n")])).toBe(0);
  });

  it("pre-push checks the branch name through the runner and then runs tests", async () => {
    const calls = [];
    const run = (c, a) => { calls.push([c, ...a].join(" ")); return c === "git" ? "feat/x\n" : ""; };
    expect(await hook(["pre-push"], { run, env: {} })).toBe(0);
    expect(calls).toEqual(["git branch --show-current", "pnpm run test --if-present"]);
  });

  it("pre-push fails on a bad branch name before running tests", async () => {
    const e = vi.spyOn(console, "error").mockImplementation(() => {});
    const calls = [];
    const run = (c, a) => { calls.push(c); return "Feature/X\n"; };
    expect(await hook(["pre-push"], { run, env: {} })).toBe(1);
    expect(calls).toEqual(["git"]);
    e.mockRestore();
  });

  it("pre-push skips tests when ORRERY_HOOK_SKIP_TESTS=1", async () => {
    const calls = [];
    const run = (c) => { calls.push(c); return "feat/x\n"; };
    expect(await hook(["pre-push"], { run, env: { ORRERY_HOOK_SKIP_TESTS: "1" } })).toBe(0);
    expect(calls).toEqual(["git"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run packages/orrery/tests/hook-command.test.mjs`
Expected: FAIL — cannot resolve `../src/commands/hook.mjs`

- [ ] **Step 3: Write the command, register it, add Orrery's hooks**

```javascript
// packages/orrery/src/commands/hook.mjs
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { checkCommitMessage, checkBranchName } from "../lib/git-flow.mjs";

const USAGE = "usage: orrery hook <commit-msg|pre-push> [args]";

function defaultRun(command, args) {
  // pnpm is a .cmd shim on Windows; execFileSync needs a shell for it there. The
  // arguments are fixed literals, so shell concatenation cannot inject anything.
  return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"], shell: process.platform === "win32" && command === "pnpm" });
}

export default async function hook(argv, deps = {}) {
  const { run = defaultRun, env = process.env } = deps;
  const [name, ...rest] = argv;

  if (name === "commit-msg") {
    const [file] = rest;
    if (!file || !fs.existsSync(file)) {
      console.error(`commit-msg: message file not found: ${file}\n${USAGE}`);
      return 2;
    }
    const message = fs.readFileSync(file, "utf8").split(/\r?\n/).filter((line) => !line.startsWith("#")).join("\n").trim();
    const result = checkCommitMessage(message);
    if (result.ok) return 0;
    console.error(`commit-msg: ${result.reason}`);
    return 1;
  }

  if (name === "pre-push") {
    const branch = run("git", ["branch", "--show-current"]).trim();
    const nameCheck = checkBranchName(branch);
    if (!nameCheck.ok) {
      console.error(`pre-push: ${nameCheck.reason}`);
      return 1;
    }
    if (env.ORRERY_HOOK_SKIP_TESTS === "1") return 0;
    try {
      run("pnpm", ["run", "test", "--if-present"]);
      return 0;
    } catch {
      console.error("pre-push: tests failed");
      return 1;
    }
  }

  console.error(USAGE);
  return 2;
}
```

Register in `cli.mjs`:

```javascript
  hook: async (argv) => (await import("./commands/hook.mjs")).default(argv),
```

Usage lines: `  orrery hook <commit-msg|pre-push> [args]` and `  hook          run a git hook: commit-msg validates the subject, pre-push validates the branch and runs tests`.

Root `package.json`: add `"prepare": "husky"` to `scripts` and `"husky": "^9.1.7"` to `devDependencies`, then `pnpm install`.

`.husky/commit-msg`:

```sh
pnpm orrery hook commit-msg "$1"
```

`.husky/pre-push`:

```sh
pnpm orrery hook pre-push
```

- [ ] **Step 4: Write the process test**

```javascript
// packages/orrery/tests/hooks.process.test.mjs
// Runs the hook command as a real process inside a temp git repository, so the exit
// code git would see is the exit code asserted here.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const bin = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../bin/orrery.mjs");
let repo;

beforeEach(() => {
  repo = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-hooks-"));
  execFileSync("git", ["init", "-q", "-b", "develop"], { cwd: repo });
  execFileSync("git", ["config", "user.email", "t@example.com"], { cwd: repo });
  execFileSync("git", ["config", "user.name", "t"], { cwd: repo });
});
afterEach(() => fs.rmSync(repo, { recursive: true, force: true }));

const runHook = (args, env = {}) =>
  spawnSync(process.execPath, [bin, "hook", ...args], { cwd: repo, encoding: "utf8", env: { ...process.env, ORRERY_HOOK_SKIP_TESTS: "1", ...env } });

describe("hooks as processes", () => {
  it("commit-msg exits 1 on a bad subject and 0 on a good one", () => {
    const f = path.join(repo, "msg");
    fs.writeFileSync(f, "bad message\n");
    expect(runHook(["commit-msg", f]).status).toBe(1);
    fs.writeFileSync(f, "feat(x): good [GH-000]\n");
    expect(runHook(["commit-msg", f]).status).toBe(0);
  });

  it("pre-push exits 1 on a bad branch and 0 on a good one", () => {
    execFileSync("git", ["checkout", "-q", "-b", "Feature/Bad"], { cwd: repo });
    const bad = runHook(["pre-push"]);
    expect(bad.status).toBe(1);
    expect(bad.stderr).toMatch(/type\/short-kebab-description/);
    execFileSync("git", ["checkout", "-q", "-b", "feat/good"], { cwd: repo });
    expect(runHook(["pre-push"]).status).toBe(0);
  });
});
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm vitest run packages/orrery/tests/hook-command.test.mjs packages/orrery/tests/hooks.process.test.mjs`
Expected: PASS — 9 tests. Then make a deliberately bad commit locally (`git commit --allow-empty -m "bad"`) and confirm husky rejects it; amend nothing, the rejection leaves no commit.

- [ ] **Step 6: Commit and open the PR**

```bash
git add packages/orrery/src/commands/hook.mjs packages/orrery/src/cli.mjs package.json pnpm-lock.yaml .husky/commit-msg .husky/pre-push packages/orrery/tests/hook-command.test.mjs packages/orrery/tests/hooks.process.test.mjs
git commit -m "feat(hook): commit-msg and pre-push hooks, wired into Orrery through husky"
git push -u origin HEAD
gh pr create --base develop --title "feat(hook): commit-msg and pre-push hooks through husky [GH-000]" --body "Task 10 of the 2e plan: the two hooks as orrery verbs, with command and process tests, and Orrery's own .husky pointers."
gh pr merge --squash --auto
```

Wait for the merge before starting Task 11 (the next branch is cut from develop).

---

### Task 11: `orrery release`

Computes the next calendar version, cuts the branch from develop, bumps the version, pushes, opens the PR into main. Git and gh calls go through an injected runner so the logic is unit-tested; one guarded real run happens at the end of the phase, not here.

**Files:**
- Create: `packages/orrery/src/lib/release.mjs`
- Create: `packages/orrery/src/commands/release.mjs`
- Modify: `packages/orrery/src/cli.mjs` (register `release`; usage)
- Test: `packages/orrery/tests/release.test.mjs`

**Interfaces:**
- Consumes: `checkBranchSync` (Task 6) — a release is refused while main is ahead of develop.
- Produces:
  - `nextVersion(existing: string[], today: Date) => string` — `vYYYY.MM.DD.N`, `N` one above the highest existing for that day, starting at 1. `existing` is any list of names containing versions (tags, branches).
  - `planRelease({ run, today, versionFile }) => { version, branch, steps }`
  - `orrery release [--dry-run] [--version-file <path>]` — default version file `package.json` at the working directory; for Orrery, `packages/orrery/package.json` is passed explicitly by its own release invocation.

- [ ] **Step 1: Write the failing test**

```javascript
// packages/orrery/tests/release.test.mjs
import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { nextVersion, planRelease, cutRelease } from "../src/lib/release.mjs";
import release from "../src/commands/release.mjs";

const today = new Date(Date.UTC(2026, 8, 8, 12));

describe("nextVersion", () => {
  it("starts at .1 on a fresh day", () => {
    expect(nextVersion(["v2026.09.07.3"], today)).toBe("v2026.09.08.1");
  });
  it("increments past the highest existing for the day, from tags or branches", () => {
    expect(nextVersion(["release/v2026.09.08.1", "v2026.09.08.2", "v2026.09.08.10"], today)).toBe("v2026.09.08.11");
  });
  it("ignores names that are not calendar versions", () => {
    expect(nextVersion(["main", "v1.2.3", "release/GH-000_v2026.09.08.1"], today)).toBe("v2026.09.08.1");
  });
});

describe("planRelease", () => {
  const versionFile = () => {
    const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "orrery-rel-")), "package.json");
    fs.writeFileSync(f, JSON.stringify({ name: "x", version: "0.0.0" }, null, 2) + "\n");
    return f;
  };

  it("refuses while main is ahead of develop", () => {
    const run = (c, a) => (a[0] === "rev-list" ? "2" : "");
    expect(() => planRelease({ run, today, versionFile: versionFile() })).toThrow(/main has 2 commit\(s\) that develop lacks/);
  });

  it("plans the branch, bump, push and PR", () => {
    const run = (c, a) => {
      if (a[0] === "rev-list") return "0";
      if (a[0] === "ls-remote") return "abc\trefs/tags/v2026.09.08.1\ndef\trefs/heads/release/v2026.09.08.2\n";
      return "";
    };
    const plan = planRelease({ run, today, versionFile: versionFile() });
    expect(plan.version).toBe("v2026.09.08.3");
    expect(plan.branch).toBe("release/v2026.09.08.3");
    expect(plan.title).toBe("chore(release): v2026.09.08.3 [GH-000]");
  });
});

describe("cutRelease", () => {
  it("runs the git and gh steps in order and rewrites the version file", () => {
    const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "orrery-rel-")), "package.json");
    fs.writeFileSync(f, JSON.stringify({ name: "x", version: "0.0.0" }, null, 2) + "\n");
    const calls = [];
    const run = (c, a) => { calls.push([c, ...a].join(" ")); if (a[0] === "rev-list") return "0"; return ""; };
    const plan = planRelease({ run, today, versionFile: f });
    calls.length = 0;
    cutRelease(plan, { run, versionFile: f });
    expect(JSON.parse(fs.readFileSync(f, "utf8")).version).toBe("2026.9.8-1");
    expect(calls).toEqual([
      "git fetch --no-tags origin develop",
      "git checkout -q -b release/v2026.09.08.1 origin/develop",
      `git add ${f}`,
      "git commit -q -m chore(release): v2026.09.08.1 [GH-000]",
      "git push -u origin release/v2026.09.08.1",
      "gh pr create --base main --head release/v2026.09.08.1 --title chore(release): v2026.09.08.1 [GH-000] --body Release v2026.09.08.1, cut from develop by orrery release. Merge with a merge commit. --label release --label orrery",
    ]);
  });
});

describe("orrery release", () => {
  it("prints the plan and stops on --dry-run", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "orrery-rel-")), "package.json");
    fs.writeFileSync(f, '{"version":"0.0.0"}\n');
    const calls = [];
    const run = (c, a) => { calls.push(a[0]); if (a[0] === "rev-list") return "0"; return ""; };
    expect(await release(["--dry-run", "--version-file", f], { run, today })).toBe(0);
    expect(log.mock.calls.flat().join("\n")).toMatch(/would cut release\/v2026\.09\.08\.1/);
    expect(calls).not.toContain("checkout");
    log.mockRestore();
  });

  it("exits 1 with the reason when a release is refused", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "orrery-rel-")), "package.json");
    fs.writeFileSync(f, '{"version":"0.0.0"}\n');
    expect(await release(["--version-file", f], { run: (c, a) => (a[0] === "rev-list" ? "1" : ""), today })).toBe(1);
    expect(error.mock.calls.flat().join("\n")).toMatch(/develop lacks/);
    error.mockRestore();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run packages/orrery/tests/release.test.mjs`
Expected: FAIL — cannot resolve `../src/lib/release.mjs`

- [ ] **Step 3: Write the implementation**

```javascript
// packages/orrery/src/lib/release.mjs
import fs from "node:fs";

// A whole name: a tag `vYYYY.MM.DD.N` or a branch `release/vYYYY.MM.DD.N`. Anything
// else, including libra's old `release/GH-000_v2026.05.27.1`, is not a version.
const CALVER = /^(?:release\/)?v(\d{4})\.(\d{2})\.(\d{2})\.(\d+)$/;

export function nextVersion(existing, today = new Date()) {
  const y = today.getUTCFullYear();
  const m = String(today.getUTCMonth() + 1).padStart(2, "0");
  const d = String(today.getUTCDate()).padStart(2, "0");
  const prefix = `v${y}.${m}.${d}.`;
  let highest = 0;
  for (const name of existing) {
    const match = CALVER.exec(name);
    if (!match) continue;
    if (`v${match[1]}.${match[2]}.${match[3]}.` !== prefix) continue;
    highest = Math.max(highest, Number(match[4]));
  }
  return `${prefix}${highest + 1}`;
}

// package.json needs semver; v2026.09.08.3 becomes 2026.9.8-3 (prerelease tag carries N).
export function semverFor(version) {
  const [, y, m, d, n] = CALVER.exec(version);
  return `${Number(y)}.${Number(m)}.${Number(d)}-${n}`;
}

export function planRelease({ run, today = new Date(), versionFile }) {
  run("git", ["fetch", "--no-tags", "origin", "main", "develop"]);
  const behind = Number(run("git", ["rev-list", "--count", "origin/develop..origin/main"]).trim());
  if (behind > 0) {
    throw new Error(`cannot cut a release: main has ${behind} commit(s) that develop lacks; land the back-merge first`);
  }
  const names = run("git", ["ls-remote", "--tags", "--heads", "origin"])
    .split(/\r?\n/)
    .map((line) => line.split("\t")[1] ?? "")
    .map((ref) => ref.replace(/^refs\/(tags|heads)\//, ""))
    .filter(Boolean);
  const version = nextVersion(names, today);
  return {
    version,
    branch: `release/${version}`,
    title: `chore(release): ${version} [GH-000]`,
    body: `Release ${version}, cut from develop by orrery release. Merge with a merge commit.`,
    versionFile,
  };
}

export function cutRelease(plan, { run, versionFile = plan.versionFile }) {
  run("git", ["fetch", "--no-tags", "origin", "develop"]);
  run("git", ["checkout", "-q", "-b", plan.branch, "origin/develop"]);
  const manifest = JSON.parse(fs.readFileSync(versionFile, "utf8"));
  manifest.version = semverFor(plan.version);
  fs.writeFileSync(versionFile, JSON.stringify(manifest, null, 2) + "\n");
  run("git", ["add", versionFile]);
  run("git", ["commit", "-q", "-m", plan.title]);
  run("git", ["push", "-u", "origin", plan.branch]);
  run("gh", ["pr", "create", "--base", "main", "--head", plan.branch, "--title", plan.title, "--body", plan.body, "--label", "release", "--label", "orrery"]);
}
```

```javascript
// packages/orrery/src/commands/release.mjs
import path from "node:path";
import { parseArgs } from "node:util";
import { execFileSync } from "node:child_process";
import { planRelease, cutRelease } from "../lib/release.mjs";

const USAGE = "usage: orrery release [--dry-run] [--version-file <package.json>]";

function defaultRun(command, args) {
  return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
}

export default async function release(argv, deps = {}) {
  const { run = defaultRun, today = new Date() } = deps;

  let values;
  try {
    ({ values } = parseArgs({
      args: argv,
      options: { "dry-run": { type: "boolean", default: false }, "version-file": { type: "string", default: "package.json" } },
    }));
  } catch (error) {
    console.error(`${error.message}\n${USAGE}`);
    return 2;
  }

  const versionFile = path.resolve(values["version-file"]);
  try {
    const plan = planRelease({ run, today, versionFile });
    if (values["dry-run"]) {
      console.log(`would cut ${plan.branch} from origin/develop, bump ${versionFile}, and open "${plan.title}" into main`);
      return 0;
    }
    cutRelease(plan, { run, versionFile });
    console.log(`opened ${plan.title}; merge it with a merge commit to release`);
    return 0;
  } catch (error) {
    console.error(error.message);
    return 1;
  }
}
```

Register in `cli.mjs`: `release: async (argv) => (await import("./commands/release.mjs")).default(argv),` with usage `  orrery release [--dry-run] [--version-file <package.json>]` and `  release       cut release/vYYYY.MM.DD.N from develop and open its PR into main`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run packages/orrery/tests/release.test.mjs`
Expected: PASS — 8 tests. The `cutRelease` expectation `"2026.9.8-1"` is `semverFor("v2026.09.08.1")`; if the reviewer prefers the `.N` to be a build number, that is a ruling for the controller, not a silent change.

- [ ] **Step 5: Commit and open the PR**

```bash
git add packages/orrery/src/lib/release.mjs packages/orrery/src/commands/release.mjs packages/orrery/src/cli.mjs packages/orrery/tests/release.test.mjs
git commit -m "feat(release): cut calendar releases from develop and open the PR into main"
git push -u origin HEAD
gh pr create --base develop --title "feat(release): orrery release cuts calendar releases from develop [GH-000]" --body "Task 11 of the 2e plan."
gh pr merge --squash --auto
```

---

### Task 12: Registry and the nightly observation of repository policy

**Files:**
- Create: `registry.json`
- Create: `.github/workflows/observe.yml`
- Create: `packages/orrery/src/lib/registry.mjs`
- Test: `packages/orrery/tests/registry.test.mjs`
- Modify: `packages/orrery/tests/workflows.test.mjs` (add the observe assertions)

**Interfaces:**
- Consumes: `orrery repo apply` (Task 4).
- Produces: `loadRegistry(path = defaultRegistryPath) => { bodies: { [name]: { repo, role, class } } }`; `registry.json` as the design doc specifies, no version field; the nightly workflow runs `repo apply --dry-run` for every body and Orrery, writing `docs/observations/<date>-repository.md`, and switches to a real apply only when the repository variable `ORRERY_APPLY_POLICY` equals `apply` (set in Task 13, never before).

- [ ] **Step 1: Write the registry**

```json
{
  "$comment": "The constellation map. No version field on purpose: each body pins its own; orrery status reads them live.",
  "bodies": {
    "orrery":      { "repo": "vaoan/Orrery",      "role": "centre", "class": null },
    "aeleos":      { "repo": "vaoan/AeleOS",      "role": "star",   "class": "next-supabase-mono" },
    "libra":       { "repo": "vaoan/libra",       "role": "planet", "class": "next-supabase-mono" },
    "puck":        { "repo": "vaoan/Puck",        "role": "planet", "class": "next-supabase-mono" },
    "eclipse-con": { "repo": "vaoan/eclipse-con", "role": "planet", "class": "next-supabase-mono" },
    "janus":       { "repo": "vaoan/Janus",       "role": "planet", "class": "next-supabase-mono" }
  }
}
```

- [ ] **Step 2: Write the failing tests**

```javascript
// packages/orrery/tests/registry.test.mjs
import { describe, it, expect } from "vitest";
import { loadRegistry, defaultRegistryPath } from "../src/lib/registry.mjs";

describe("registry", () => {
  it("lists Orrery and the five bodies with repo, role and class", () => {
    const { bodies } = loadRegistry();
    expect(Object.keys(bodies)).toEqual(["orrery", "aeleos", "libra", "puck", "eclipse-con", "janus"]);
    for (const body of Object.values(bodies)) {
      expect(body.repo).toMatch(/^vaoan\/[A-Za-z-]+$/);
      expect(["centre", "star", "planet"]).toContain(body.role);
    }
    expect(bodies.aeleos.class).toBe("next-supabase-mono");
    expect(bodies.orrery.class).toBeNull();
  });

  it("carries no version field, by design", () => {
    const { bodies } = loadRegistry();
    for (const body of Object.values(bodies)) expect(body).not.toHaveProperty("version");
  });

  it("lives at the repository root", () => {
    expect(defaultRegistryPath.replaceAll("\\", "/")).toMatch(/\/registry\.json$/);
  });
});
```

Append to `packages/orrery/tests/workflows.test.mjs`:

```javascript
describe(".github/workflows/observe.yml", () => {
  const yaml = read(".github/workflows/observe.yml");
  it("runs nightly and on demand", () => {
    expect(yaml).toMatch(/  schedule:\n    - cron: /);
    expect(yaml).toContain("workflow_dispatch:");
  });
  it("dry-runs by default and applies only when the repository variable says so", () => {
    expect(yaml).toContain("vars.ORRERY_APPLY_POLICY == 'apply'");
    expect(yaml).toContain("--dry-run");
  });
  it("iterates the registry and uses the admin token", () => {
    expect(yaml).toContain("registry.json");
    expect(yaml).toContain("secrets.ORRERY_ADMIN_TOKEN");
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm vitest run packages/orrery/tests/registry.test.mjs packages/orrery/tests/workflows.test.mjs`
Expected: FAIL — cannot resolve `../src/lib/registry.mjs`; ENOENT on `observe.yml`

- [ ] **Step 4: Write the loader and the workflow**

```javascript
// packages/orrery/src/lib/registry.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const defaultRegistryPath = path.resolve(here, "../../../../registry.json");

export function loadRegistry(file = defaultRegistryPath) {
  const registry = JSON.parse(fs.readFileSync(file, "utf8"));
  for (const [name, body] of Object.entries(registry.bodies ?? {})) {
    if (!body.repo || !body.role) throw new Error(`registry body ${name} needs repo and role`);
    if ("version" in body) throw new Error(`registry body ${name} must not carry a version`);
  }
  return registry;
}
```

`.github/workflows/observe.yml`:

```yaml
# Nightly observation of every registered repository's policy state.
# Dry-run by default. Set the repository variable ORRERY_APPLY_POLICY=apply to let it
# re-apply drift; that switch is flipped only after the bodies were brought to policy
# with explicit confirmation (2e plan, Task 13).
name: observe

on:
  schedule:
    - cron: "17 3 * * *"
  workflow_dispatch:

permissions:
  contents: write

jobs:
  repository-policy:
    name: repository policy
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
        with:
          ref: develop
      - uses: pnpm/action-setup@v4
        with:
          version: 11
      - uses: actions/setup-node@v5
        with:
          node-version: 24
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - name: Observe every registered repository
        env:
          ORRERY_GH_TOKEN: ${{ secrets.ORRERY_ADMIN_TOKEN }}
          MODE: ${{ vars.ORRERY_APPLY_POLICY == 'apply' && 'apply' || 'report' }}
        run: |
          mkdir -p docs/observations
          out="docs/observations/$(date -u +%F)-repository.md"
          {
            echo "# Repository policy observation — $(date -u +%F)"
            echo
            echo "Mode: $MODE"
            echo
          } > "$out"
          for repo in $(node -e 'const r=require("./registry.json");console.log(Object.values(r.bodies).map(b=>b.repo).join(" "))'); do
            echo "## $repo" >> "$out"
            if [ "$MODE" = "apply" ]; then
              pnpm -s orrery repo apply "$repo" >> "$out" 2>&1 || echo "FAILED: $repo" >> "$out"
            else
              pnpm -s orrery repo apply "$repo" --dry-run >> "$out" 2>&1 || echo "FAILED: $repo" >> "$out"
            fi
            echo >> "$out"
          done
          cat "$out"
      - name: Commit the observation
        run: |
          git config user.name "orrery"
          git config user.email "orrery@users.noreply.github.com"
          git add docs/observations
          git diff --cached --quiet || git commit -m "docs(observe): repository policy $(date -u +%F) [GH-000]"
          git push origin HEAD:develop || echo "develop is protected; observation kept in the run log"
```

Note for the reviewer: pushing to a protected `develop` will be refused, which is correct. The observation still appears in the run log and the workflow stays green. Committing observations through a PR is Phase 2b's `observe` work; this task only needs the nightly run to exist.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm vitest run packages/orrery/tests/registry.test.mjs packages/orrery/tests/workflows.test.mjs`
Expected: PASS — 3 registry tests, 12 workflow tests

- [ ] **Step 6: Commit and open the PR**

```bash
git add registry.json packages/orrery/src/lib/registry.mjs packages/orrery/tests/registry.test.mjs .github/workflows/observe.yml packages/orrery/tests/workflows.test.mjs
git commit -m "feat(registry): the constellation map and the nightly repository-policy observation"
git push -u origin HEAD
gh pr create --base develop --title "feat(registry): registry and nightly repository-policy observation [GH-000]" --body "Task 12 of the 2e plan. Dry-run only until ORRERY_APPLY_POLICY is set."
gh pr merge --squash --auto
```

---

### Task 13: Secrets, the first Orrery release, and applying the policy to the bodies

Two of these steps need the human. The plan stops at each and says exactly what to do.

**Files:** `docs/decisions/0003-repository-policy.md` (append the application log).

- [ ] **Step 1: STOP — ask for the two tokens**

Orrery's workflows need two secrets that only the account owner can create. Ask, with these exact instructions, and wait:

> Create two fine-grained personal access tokens at https://github.com/settings/personal-access-tokens/new, both with **Resource owner: vaoan**, **Repository access: Only select repositories** → Orrery, AeleOS, libra, Puck, eclipse-con, Janus, orrery-policy-fixture, expiry 1 year:
>
> 1. **ORRERY_ADMIN_TOKEN** — Repository permissions: Administration **Read and write**, Contents **Read and write**, Metadata Read. Used only by the nightly observe job to apply protection.
> 2. **ORRERY_BOT_TOKEN** — Repository permissions: Contents **Read and write**, Pull requests **Read and write**, Issues Read, Metadata Read. Used by back-merge and by 2d's bump bot to open PRs that trigger checks.
>
> Then run, from Z:\Github\Orrery: `gh secret set ORRERY_ADMIN_TOKEN -R vaoan/Orrery` and `gh secret set ORRERY_BOT_TOKEN -R vaoan/Orrery`, pasting each token when prompted. Tell me when both are set.

Verify: `gh secret list -R vaoan/Orrery` lists both names.

- [ ] **Step 2: Cut Orrery's first release through the flow**

```bash
git checkout develop && git pull --ff-only
pnpm orrery release --dry-run --version-file packages/orrery/package.json
pnpm orrery release --version-file packages/orrery/package.json
```

Expected: `release/v2026.MM.DD.1` opened into main; all checks green; merge it with `gh pr merge --merge --auto`. Then: the `release` workflow creates the GitHub Release, the `back-merge` workflow opens main → develop and automerges it. Confirm with `gh release list -R vaoan/Orrery` and `gh pr list -R vaoan/Orrery --state merged --label back-merge`. If back-merge did not fire, the bot token is missing or lacks pull-request write; fix and re-run the workflow with `gh workflow run back-merge.yml`.

- [ ] **Step 3: Dry-run the five bodies**

```bash
for r in vaoan/AeleOS vaoan/libra vaoan/Puck vaoan/eclipse-con vaoan/Janus; do pnpm orrery repo apply "$r" --dry-run; done
```

Save the output to the workspace. Expected operations per body, from the 2026-09-08 measurement: aeleos gains `develop` and loses rebase; libra, Puck and Janus gain settings and label changes and keep their existing check contexts (they have no shared `ci.yml` yet); eclipse-con gains everything.

- [ ] **Step 4: STOP — present the dry run and ask for confirmation**

Show the human the five dry-run outputs and this sentence, then wait:

> Applying will change how anyone working on these repositories works tomorrow: develop becomes the default branch on aeleos and eclipse-con, rebase merging is disabled everywhere, merging requires a PR with resolved conversations, and squash titles come from the PR title. Their existing required checks are preserved. Required approvals become 0 on both branches (all five bodies already require 0 as of 2026-09-09). Nothing in their code changes. Say "apply" to proceed, or name the repositories to skip.

- [ ] **Step 5: Apply, verify idempotence, flip the nightly to apply mode**

On confirmation:

```bash
for r in vaoan/AeleOS vaoan/libra vaoan/Puck vaoan/eclipse-con vaoan/Janus; do pnpm orrery repo apply "$r"; done
for r in vaoan/AeleOS vaoan/libra vaoan/Puck vaoan/eclipse-con vaoan/Janus; do pnpm orrery repo apply "$r"; done   # every line: nothing to change
gh variable set ORRERY_APPLY_POLICY -R vaoan/Orrery --body apply
gh workflow run observe.yml -R vaoan/Orrery
```

Expected: the second loop prints `nothing to change` five times; the observe run completes green and its log shows `nothing to change` for all six.

- [ ] **Step 6: Record the application**

Append to `docs/decisions/0003-repository-policy.md`:

```markdown
## Application log

| Date | Repository | Operations | Notes |
|---|---|---|---|
| 2026-09-08 | vaoan/Orrery | develop created; settings; protection; labels | first, before any body |
| <date> | vaoan/AeleOS | <from the run> | develop created from main |
| <date> | vaoan/libra | <from the run> | existing check contexts preserved |
| <date> | vaoan/Puck | <from the run> | |
| <date> | vaoan/eclipse-con | <from the run> | previously unprotected |
| <date> | vaoan/Janus | <from the run> | |
```

Fill every `<…>` from the actual output; a row with a placeholder left in it is a failed task. Commit on a `docs/*` branch, PR into develop, squash-merge.

Also update `CLAUDE.md`'s "Commands the CLI will expose" block to list `repo apply`, `ci <verb>`, `hook <name>`, `release` alongside the existing verbs, in the same PR.

---

## Done when

- `pnpm test` passes with every test in this plan. Verified 2026-09-08 by extracting every code block of this plan into a scratch copy of the package and running it: 160 tests pass across 15 files plus the integration file skipped without `ORRERY_FIXTURE_REPO` (41 from Phase 2a, 119 from this plan). Report the observed number.
- Orrery runs the flow: `develop` default, both branches protected with the six checks required, a release merged through `release/*` with a merge commit, and its back-merge landed automatically.
- `orrery repo apply` prints `nothing to change` for all six registered repositories.
- ADR 0003 holds the values, the reasons, and the application log with no placeholders.

## Rulings made while planning, for the controller to confirm or overturn

1. Squash commit title and body come from the PR title and body (`PR_TITLE` / `PR_BODY`), not the donors' `COMMIT_OR_PR_TITLE`. The PR title is what the checks validate.
2. Required check contexts are imposed only where `ci.yml` carries the `# orrery-ci` marker; elsewhere a repository's existing contexts are preserved. Otherwise applying the policy to a body today would name checks that do not exist there and block every merge.
3. The `package.json` version for a calendar release is `YYYY.M.D-N` (semver-valid). Bodies install by commit from `main`, so this number is informational.
4. Two tokens rather than one: an admin token that only Orrery's nightly job holds, and a bot token for PR-opening workflows, because a fine-grained token cannot open PRs that trigger checks without pull-request write, and the admin token should not travel.
5. The nightly observation dry-runs until `ORRERY_APPLY_POLICY=apply` is set in Task 13, so nothing touches a body before the confirmation the spec requires.
6. `pre-push` runs the body's `test` script rather than libra's scoped selection, which is libra-local; the docker health check is not carried into the shared hook.

## Amendments

- **2026-09-09:** main only receives `release/*` and `hotfix/*`; `fix/*`
  lands on develop. A hotfix is big words. And: when execution corners the
  agent into an unplanned fix, it stops and asks; a needed fix means a
  misunderstanding or a plan conflict.
- **2026-09-09:** Task 13's application to the five bodies is deferred to the
  production cut-over that closes the whole programme, by the owner's
  decision; until then the nightly observation runs in report mode and
  Orrery is kept ready.
- **2026-09-09 (option B):** the back-merge goes through an intermediate
  `back-merge/<sha>` branch so "Update branch" never merges develop into main
  and strict stays on both branches; `back-merge/*` is automation-only,
  enforced by an author check now and by a GitHub App identity plus a
  creation ruleset in Phase 2d.
