import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
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
        ops: [
          { kind: "create-branch", name: "develop", fromSha: "aaa" },
          { kind: "update-settings", patch: { allow_rebase_merge: false }, current: { allow_rebase_merge: true } },
          {
            kind: "set-protection",
            branch: "main",
            body: { required_pull_request_reviews: { required_approving_review_count: 0 }, required_status_checks: { contexts: ["test"] } },
            current: null,
          },
        ],
        applied: [{ kind: "create-branch" }, { kind: "update-settings" }, { kind: "set-protection" }],
      }),
    });
    expect(code).toBe(0);
    const out = log.mock.calls.flat().join("\n");
    expect(out).toContain("create-branch develop");
    expect(out).toContain("allow_rebase_merge: true -> false");
    expect(out).toContain("set-protection main");
    expect(out).toContain("approvals: none -> 0");
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

  it("exits 2 on an invalid policy file", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "orrery-policy-")), "policy.json");
    fs.writeFileSync(file, JSON.stringify({
      defaultBranch: "develop",
      protectedBranches: ["develop"],
      settings: { allow_rebase_merge: false },
      protection: { develop: {} },
      requiredChecks: { develop: [] },
      labels: [],
    }));
    const code = await repo(["apply", "vaoan/x", "--policy", file], { createGithub: () => ({}), resolveToken: () => "t" });
    expect(code).toBe(2);
    expect(error.mock.calls.flat().join("\n")).toContain("protectedBranches must include main");
    error.mockRestore();
  });
});
