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
