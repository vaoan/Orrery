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
    ["hotfix/checkout-total", true],
    ["hotfix/Checkout", false],
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
    expect(branchType("hotfix/x")).toBe("hotfix");
    expect(branchType("main")).toBeNull();
  });
});

describe("branch targets", () => {
  it.each([
    ["feat/x", "develop", true],
    ["fix/x", "main", false],
    ["fix/x", "develop", true],
    ["hotfix/x", "main", true],
    ["hotfix/x", "develop", false],
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
    expect(checkBranchTarget("feat/x", "main").reason).toMatch(/only release\/\* and hotfix\/\* may target main/);
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

  it("a hotfix branch must carry a fix title", async () => {
    const r = await checkPrTitle("fix(cart): total [GH-000]", "hotfix/checkout-total", { issueExists: async () => true });
    expect(r.ok).toBe(true);
  });

  it("rejects a hotfix branch with a non-fix title", async () => {
    const r = await checkPrTitle("feat(cart): total [GH-000]", "hotfix/checkout-total", { issueExists: async () => true });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/a hotfix carries a fix title/);
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
