import { describe, it, expect } from "vitest";
import {
  TYPES, branchType, checkBranchName, checkBranchTarget, parsePrTitle, checkPrTitle,
  checkCommitMessage, checkBranchSync, checkConfigDrift, isBackMerge,
} from "../src/lib/git-flow.mjs";

describe("branch names", () => {
  it.each([
    ["feat/phase-2a-diff-eslint", false],             // plan label ("phase-"), not a description
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
    ["back-merge/abc1234", true],
    ["back-merge/ABC1234", false],
    ["back-merge/abc", false], // too short
    // descriptive-name rule: no plan/phase/task label, at least two words
    ["feat/2b-reconcile-records", false],
    ["feat/phase-2b", false],
    ["fix/thing", false],                              // one word says nothing
    ["feat/reconcile-records-command", true],
    ["fix/eslint-bin-lookup-ignores-node-path", true],
    ["docs/branch-name-rule", true],
    ["release/v2026.09.09.1", true],                   // automation pattern, untouched
    ["back-merge/abc1234", true],                       // automation pattern, untouched
  ])("%s -> %s", (name, ok) => {
    expect(checkBranchName(name).ok).toBe(ok);
  });

  // The plan-label rule, one case per shape it accepts and rejects.
  it.each([
    // 1. a phase/task word followed by a digit token
    ["feat/phase-2b-reconciliation", false],
    ["feat/task-5-records", false],
    ["feat/step-3-migration", false],
    ["feat/wave-1-cleanup", false],
    ["feat/round-2-review", false],
    // 2. a leading digit token
    ["feat/2b-reconcile-records", false],
    ["feat/3-more-work", false],
    // "3d" is a digit token and no rule can tell a 3D viewer from phase 3d
    ["feat/3d-viewer", false],
    // 3. a single letter followed by a digit token
    ["feat/t5-records", false],
    ["feat/p2-repository-policy", false],
    // bare words are fine: only the digit after the word makes a label
    ["feat/task-runner", true],
    ["feat/round-corners", true],
    ["feat/step-indicator", true],
    ["feat/phase-shift-detector", true],
    ["feat/wave-form-preview", true],
    ["chore/node24-actions", true],
    // "fix-" is a label only on a fix/ branch
    ["fix/fix-thing", false],
    ["feat/fix-typos-in-readme", true],
    ["fix/eslint-bin-lookup-ignores-node-path", true],
  ])("plan label: %s -> %s", (name, allowed) => {
    expect(checkBranchName(name).ok, checkBranchName(name).reason).toBe(allowed);
  });

  it("says which label shape it saw", () => {
    expect(checkBranchName("feat/3d-viewer").reason).toContain("digit token");
    expect(checkBranchName("feat/t5-records").reason).toContain("letter-and-number label");
    expect(checkBranchName("feat/phase-2b-reconciliation").reason).toContain("plan label");
    expect(checkBranchName("fix/fix-thing").reason).toContain("repeats the branch's own fix/ type");
  });

  it("names the rule in the reason", () => {
    expect(checkBranchName("Feature/X").reason).toMatch(/type\/short-kebab-description/);
    expect(checkBranchName("Feature/X").reason).toContain(TYPES.join("|"));
  });

  it("names the descriptive-name rule in the reason, with a good example", () => {
    const r = checkBranchName("feat/2b-reconcile");
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/describe the change/);
    expect(r.reason).toMatch(/two or more words/);
    expect(r.reason).toContain('"2b-"');
    expect(r.reason).toContain("2b-reconcile");
    expect(r.reason).toContain("feat/reconcile-records-command");
  });

  it("extracts the type", () => {
    expect(branchType("fix/a")).toBe("fix");
    expect(branchType("release/v2026.09.08.1")).toBe("release");
    expect(branchType("hotfix/x")).toBe("hotfix");
    expect(branchType("main")).toBeNull();
    expect(branchType("back-merge/abc1234")).toBe("back-merge");
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
    ["main", "develop", false],                 // main is no longer a PR head
    ["back-merge/abc1234", "develop", true],
    ["back-merge/abc1234", "main", false],
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

  it("a back-merge branch must carry a chore title", async () => {
    const r = await checkPrTitle("chore(back-merge): main into develop [GH-000]", "back-merge/abc1234", { issueExists: async () => true });
    expect(r.ok).toBe(true);
  });

  it("rejects a back-merge branch with a non-chore title", async () => {
    const r = await checkPrTitle("feat(x): y [GH-000]", "back-merge/abc1234", { issueExists: async () => true });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/a back-merge carries a chore title/);
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

describe("isBackMerge", () => {
  it("is true only for a same-repository back-merge branch into develop", () => {
    expect(isBackMerge({ head: "back-merge/abc1234", base: "develop", sameRepo: true })).toBe(true);
  });

  it("is false when the repository differs (a fork)", () => {
    expect(isBackMerge({ head: "back-merge/abc1234", base: "develop", sameRepo: false })).toBe(false);
  });

  it("is false when sameRepo is undefined", () => {
    expect(isBackMerge({ head: "back-merge/abc1234", base: "develop" })).toBe(false);
  });

  it("is false for main as the head", () => {
    expect(isBackMerge({ head: "main", base: "develop", sameRepo: true })).toBe(false);
  });

  it("is false when the base is not develop", () => {
    expect(isBackMerge({ head: "back-merge/abc1234", base: "main", sameRepo: true })).toBe(false);
  });
});
