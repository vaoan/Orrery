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

// Does NOT set ORRERY_HOOK_SKIP_TESTS, so pre-push spawns the real pnpm binary
// and actually runs (or looks for) the repo's test script.
const runHookReal = (args, env = {}) =>
  spawnSync(process.execPath, [bin, "hook", ...args], { cwd: repo, encoding: "utf8", env: { ...process.env, ...env } });

const writePackageJson = (scripts) =>
  fs.writeFileSync(
    path.join(repo, "package.json"),
    JSON.stringify({ name: "t", version: "0.0.0", private: true, ...(scripts ? { scripts } : {}) }, null, 2)
  );

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

  it(
    "pre-push runs the test script through real pnpm and passes when there is no test script",
    () => {
      execFileSync("git", ["checkout", "-q", "-b", "feat/good"], { cwd: repo });
      writePackageJson(); // no scripts.test at all
      // With the old ["run", "test", "--if-present"] order, real pnpm forwards
      // --if-present to the missing script and reports "Missing script", exiting
      // 1; this test discriminates that from the fixed ["run", "--if-present", "test"] order.
      const result = runHookReal(["pre-push"]);
      expect(result.status).toBe(0);
    },
    60000
  );

  it(
    "pre-push fails when the test script fails",
    () => {
      execFileSync("git", ["checkout", "-q", "-b", "feat/good"], { cwd: repo });
      writePackageJson({ test: 'node -e "process.exit(1)"' });
      const result = runHookReal(["pre-push"]);
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/tests failed/);
    },
    60000
  );

  it(
    "pre-push passes when the test script passes",
    () => {
      execFileSync("git", ["checkout", "-q", "-b", "feat/good"], { cwd: repo });
      writePackageJson({ test: 'node -e "process.exit(0)"' });
      const result = runHookReal(["pre-push"]);
      expect(result.status).toBe(0);
    },
    60000
  );
});
