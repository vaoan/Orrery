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
    expect(calls).toEqual(["git branch --show-current", "pnpm run --if-present test"]);
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
