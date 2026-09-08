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
