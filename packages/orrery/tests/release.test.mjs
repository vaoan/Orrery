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

  // origin/develop..origin/main is the sync check (checkBranchSync); origin/main..origin/develop
  // is the emptiness check below it. Tests that only care about one give the other a non-zero
  // count so it does not also trip.
  const syncRun = (behind, ahead, extra = () => "") => (c, a) => {
    if (a[0] === "rev-list") return a[2] === "origin/develop..origin/main" ? String(behind) : String(ahead);
    return extra(c, a);
  };

  it("refuses while main is ahead of develop", async () => {
    const run = syncRun(2, 5);
    await expect(planRelease({ run, today, versionFile: versionFile() })).rejects.toThrow(/main has 2 commit\(s\) that develop lacks/);
  });

  it("refuses an empty release", async () => {
    const run = syncRun(0, 0);
    await expect(planRelease({ run, today, versionFile: versionFile() })).rejects.toThrow(/nothing to release: develop has no commits main lacks/);
  });

  it("plans the branch, bump, push and PR", async () => {
    const run = syncRun(0, 5, (c, a) => {
      if (a[0] === "ls-remote") return "abc\trefs/tags/v2026.09.08.1\ndef\trefs/heads/release/v2026.09.08.2\n";
      return "";
    });
    const plan = await planRelease({ run, today, versionFile: versionFile() });
    expect(plan.version).toBe("v2026.09.08.3");
    expect(plan.branch).toBe("release/v2026.09.08.3");
    expect(plan.title).toBe("chore(release): v2026.09.08.3 [GH-000]");
  });
});

describe("cutRelease", () => {
  it("runs the git and gh steps in order and rewrites the version file", async () => {
    const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "orrery-rel-")), "package.json");
    fs.writeFileSync(f, JSON.stringify({ name: "x", version: "0.0.0" }, null, 2) + "\n");
    const calls = [];
    const run = (c, a) => {
      calls.push([c, ...a].join(" "));
      if (a[0] === "rev-list") return a[2] === "origin/develop..origin/main" ? "0" : "5";
      return "";
    };
    const plan = await planRelease({ run, today, versionFile: f });
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
    const run = (c, a) => {
      calls.push(a[0]);
      if (a[0] === "rev-list") return a[2] === "origin/develop..origin/main" ? "0" : "5";
      return "";
    };
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
