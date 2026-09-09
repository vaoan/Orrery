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
      current: { allow_rebase_merge: true, squash_merge_commit_title: "COMMIT_OR_PR_TITLE" },
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
    expect(ops[0].current).toBe(state.protection.main);
    expect(ops[0].current.required_conversation_resolution).toBe(false);
  });

  it("re-sets protection when only a required context is missing", () => {
    const state = compliantState();
    state.protection.develop.required_status_checks.contexts = policy.requiredChecks.develop.filter((c) => c !== "branch-sync");
    const ops = planRepoChanges(state, policy);
    expect(ops).toHaveLength(1);
    expect(ops[0].kind).toBe("set-protection");
    expect(ops[0].branch).toBe("develop");
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

  it("refuses a repository without a main branch", () => {
    const state = compliantState();
    state.branches.main = null;
    state.protection.main = null;
    expect(() => planRepoChanges(state, policy)).toThrow(/no main branch/);
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

  it("treats an unknown content encoding as no marker", async () => {
    const github = {
      request: async (m, p) =>
        p.endsWith("/repos/vaoan/x")
          ? { status: 200, data: { default_branch: "main" } }
          : p.includes("/contents/")
            ? { status: 200, data: { content: "# orrery-ci", encoding: "none" } }
            : { status: 404, data: null },
    };
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
