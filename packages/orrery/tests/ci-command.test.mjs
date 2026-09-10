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
    const env = {
      GITHUB_EVENT_PATH: event({
        head: { ref: "feat/x", sha: "h", repo: { full_name: "vaoan/x" } },
        base: { ref: "main", repo: { full_name: "vaoan/x" } },
        title: "feat(x): y [GH-000]",
        user: { login: "alice" },
      }),
    };
    expect(await ci(["branch-target"], { env })).toBe(1);
    expect(q.out()).toContain("only release/* and hotfix/* may target main");
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
    expect(await ci(["branch-name", "--head", "feat/two-words"], { env: {} })).toBe(0);
    q.restore();
  });

  it("rejects a branch description that is a plan label, not a description", async () => {
    const q = quiet();
    expect(await ci(["branch-name", "--head", "feat/2b-reconcile"], { env: {} })).toBe(1);
    expect(q.out()).toMatch(/describe the change/);
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

  it("branch-name passes for an automation back-merge in the same repository", async () => {
    const q = quiet();
    const argv = [
      "branch-name", "--head", "back-merge/abc1234", "--base", "develop",
      "--head-repo", "vaoan/Orrery", "--base-repo", "vaoan/Orrery", "--author", "vaoan",
    ];
    expect(await ci(argv, { env: {} })).toBe(0);
    expect(q.out()).toContain("back-merge");
    q.restore();
  });

  it("branch-name rejects a back-merge from a fork", async () => {
    const q = quiet();
    // A fork's PR author is never the bot login, so the mandatory author gate
    // (which fires for any back-merge/* head, regardless of the sameRepo
    // exemption) rejects it before the fork condition is even consulted.
    const argv = [
      "branch-name", "--head", "back-merge/abc1234", "--base", "develop",
      "--head-repo", "someone/Orrery", "--base-repo", "vaoan/Orrery", "--author", "someone",
    ];
    expect(await ci(argv, { env: {} })).toBe(1);
    expect(q.out()).not.toContain("ok (back-merge");
    expect(q.out()).toContain("only the back-merge workflow");
    q.restore();
  });

  it("branch-name rejects a back-merge opened by a human", async () => {
    const q = quiet();
    const argv = [
      "branch-name", "--head", "back-merge/abc1234", "--base", "develop",
      "--head-repo", "vaoan/Orrery", "--base-repo", "vaoan/Orrery", "--author", "alice",
    ];
    expect(await ci(argv, { env: {} })).toBe(1);
    expect(q.out()).toContain("only the back-merge workflow");
    q.restore();
  });

  it("branch-name still rejects main as a head for any other base", async () => {
    const q = quiet();
    expect(await ci(["branch-name", "--head", "main", "--base", "feat/x"], { env: {} })).toBe(1);
    q.restore();
  });

  it("branch-name honours ORRERY_BOT_LOGIN as the expected author", async () => {
    const q = quiet();
    const argv = [
      "branch-name", "--head", "back-merge/abc1234", "--base", "develop",
      "--head-repo", "vaoan/Orrery", "--base-repo", "vaoan/Orrery", "--author", "orrery[bot]",
    ];
    expect(await ci(argv, { env: { ORRERY_BOT_LOGIN: "orrery[bot]" } })).toBe(0);
    q.restore();
  });

  it("branch-sync passes for the same-repo back-merge without asking git", async () => {
    const q = quiet();
    const calls = [];
    const run = (c, a) => { calls.push(a); return a[0] === "rev-list" ? "2" : ""; };
    const argv = [
      "branch-sync", "--head", "back-merge/abc1234", "--base", "develop",
      "--head-repo", "vaoan/Orrery", "--base-repo", "vaoan/Orrery", "--author", "vaoan",
    ];
    expect(await ci(argv, { env: {}, run })).toBe(0);
    expect(q.out()).toContain("back-merge");
    expect(calls.some((a) => a[0] === "rev-list")).toBe(false);
    q.restore();
  });

  it("branch-sync still runs for a fork back-merge", async () => {
    const q = quiet();
    const calls = [];
    const run = (c, a) => { calls.push(a); return a[0] === "rev-list" ? "0" : ""; };
    const argv = [
      "branch-sync", "--head", "back-merge/abc1234", "--base", "develop",
      "--head-repo", "someone/Orrery", "--base-repo", "vaoan/Orrery", "--author", "vaoan",
    ];
    expect(await ci(argv, { env: {}, run })).toBe(0);
    expect(calls.some((a) => a[0] === "rev-list")).toBe(true);
    q.restore();
  });

  it("branch-sync still fails an ordinary PR while main is ahead", async () => {
    const q = quiet();
    const run = (c, a) => (a[0] === "rev-list" ? "2" : "");
    expect(await ci(["branch-sync", "--head", "feat/x", "--base", "develop"], { env: {}, run })).toBe(1);
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

  it("exits 1 with git's message when a git command fails", async () => {
    const q = quiet();
    const run = () => {
      const e = new Error("spawn failed");
      e.stderr = "fatal: could not read from remote repository\n";
      throw e;
    };
    expect(await ci(["branch-sync"], { env: {}, run })).toBe(1);
    expect(q.out()).toContain("could not read from remote repository");
    q.restore();
  });

  it("treats a file absent on one side as a difference, not a crash", async () => {
    const q = quiet();
    const run = (c, a) => {
      if (a[0] === "fetch") return "";
      if (a[0] === "merge-base") return "mb";
      if (a[0] === "diff") return "";
      if (a[0] === "show") {
        const ref = a[1];
        if (ref === "origin/develop:eslint.local.mjs") {
          const e = new Error("git show failed");
          e.stderr = "fatal: path 'eslint.local.mjs' does not exist in 'origin/develop'\n";
          throw e;
        }
        if (ref.endsWith(":eslint.local.mjs")) return "content";
        return "same";
      }
      return "";
    };
    const env = { GITHUB_EVENT_PATH: event({ head: { ref: "feat/x", sha: "headsha" }, base: { ref: "develop" }, title: "t" }) };
    expect(await ci(["config-drift"], { env, run })).toBe(1);
    expect(q.out()).toContain("eslint.local.mjs");
    q.restore();
  });

  it("does not mask a bad revision", async () => {
    const q = quiet();
    const run = (c, a) => {
      if (a[0] === "fetch") return "";
      if (a[0] === "merge-base") return "mb";
      if (a[0] === "diff") return "";
      if (a[0] === "show") {
        const e = new Error("git show failed");
        e.stderr = "fatal: invalid object name 'headsha'\n";
        throw e;
      }
      return "";
    };
    const env = { GITHUB_EVENT_PATH: event({ head: { ref: "feat/x", sha: "headsha" }, base: { ref: "develop" }, title: "t" }) };
    expect(await ci(["config-drift"], { env, run })).toBe(1);
    expect(q.out()).toContain("invalid object name");
    expect(q.out()).not.toContain("config-drift: ok");
    q.restore();
  });
});
