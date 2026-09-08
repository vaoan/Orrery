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
