import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { BUDGET, WIDE_GLOB_SHARE, tokens, parseRule, measureBody } from "../src/lib/instructions/measure.mjs";

const dirs = [];
afterEach(() => { for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true }); });

const git = (dir, ...args) => execFileSync("git", ["-C", dir, "-c", "user.email=t@t", "-c", "user.name=t", "-c", "commit.gpgsign=false", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });

// files: { relativePath: contents }. Everything is added to the index; commit is optional.
function fixture(files, { commit = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-instr-"));
  dirs.push(dir);
  git(dir, "init", "-q");
  write(dir, files);
  git(dir, "add", "-A");
  if (commit) git(dir, "commit", "-q", "-m", "init");
  return dir;
}
function write(dir, files) {
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  }
}
const rule = (paths) => `---\npaths:\n${paths.map((p) => `  - "${p}"`).join("\n")}\n---\nbody\n`;
const paths = (list) => list.map((f) => f.path);

describe("constants", () => {
  it("fixes the budgets and the arithmetic", () => {
    expect(BUDGET).toEqual({ startup: 10000, task: 25000 });
    expect(WIDE_GLOB_SHARE).toBe(0.4);
    expect(tokens(30000)).toBe(10000);
    expect(tokens(30001)).toBe(10001);
  });
});

describe("parseRule", () => {
  it("treats frontmatter not on line 1 or malformed as unscoped", () => {
    expect(parseRule("\n---\npaths:\n  - a\n---\n").paths).toBeNull();
    expect(parseRule("---\npaths: [\n---\n").paths).toBeNull();
    expect(parseRule("---\npaths:\n  - a\n").paths).toBeNull();
    expect(parseRule("no frontmatter").paths).toBeNull();
  });
  it("parses paths from a CRLF file, a YAML list, and a comma string", () => {
    expect(parseRule("---\r\npaths:\r\n  - a/**\r\n---\r\n").paths).toEqual(["a/**"]);
    expect(parseRule("---\npaths: a/**, b/**\n---\n").paths).toEqual(["a/**", "b/**"]);
    expect(parseRule("---\npaths: [a/**, \"b/**\"]\n---\n").paths).toEqual(["a/**", "b/**"]);
    expect(parseRule("---\npaths: src/**/*.{ts,tsx}\n---\n").paths).toEqual(["src/**/*.{ts,tsx}"]);
  });
  it("treats frontmatter without paths as unscoped", () => {
    expect(parseRule("---\ndescription: x\n---\n").paths).toBeNull();
  });
});

describe("measureBody", () => {
  it("counts an unscoped rule at start and a scoped one only when touched", () => {
    const dir = fixture({ "CLAUDE.md": "x", ".claude/rules/a.md": "unscoped", ".claude/rules/b.md": rule(["src/**"]), "src/f.ts": "", "lib/a.ts": "", "lib/b.ts": "" });
    const m = measureBody(dir, { touching: ["src/f.ts"] });
    expect(m.body).toBe(path.basename(dir).toLowerCase());
    expect(m.startup.files.map((f) => f.path)).toEqual(["CLAUDE.md", ".claude/rules/a.md"]);
    expect(m.startup.files.map((f) => f.reason)).toEqual(["root", "unscoped-rule"]);
    expect(m.task.added.map((f) => [f.path, f.reason])).toEqual([[".claude/rules/b.md", "path-rule"]]);
    expect(m.task.tokens).toBeGreaterThan(m.startup.tokens);
    expect(measureBody(dir, {}).task).toBeNull();
  });

  const sourceFixture = (matching) => {
    const files = { "CLAUDE.md": "x", ".claude/rules/r.md": rule(["hot/**"]) };
    for (let i = 0; i < 10; i++) files[`${i < matching ? "hot" : "cold"}/f${i}.ts`] = "";
    files["README.md"] = "not source";
    return fixture(files);
  };
  it("treats a glob matching over 40% of source as unscoped", () => {
    const m = measureBody(sourceFixture(5), {});
    expect(m.startup.files.map((f) => [f.path, f.reason])).toContainEqual([".claude/rules/r.md", "wide-rule"]);
    expect(m.wideRules).toEqual([{ path: ".claude/rules/r.md", share: 0.5 }]);
  });
  it("keeps a glob matching exactly 40% scoped", () => {
    const m = measureBody(sourceFixture(4), {});
    expect(paths(m.startup.files)).toEqual(["CLAUDE.md"]);
    expect(m.wideRules).toEqual([]);
  });

  it("follows imports four hops, ignoring fences, cycles and missing targets", () => {
    const dir = fixture({
      "CLAUDE.md": "@c1.md\n@missing.md\n```\n@fenced.md\n```\nand `@spanned.md` inline\n",
      "c1.md": "@c2.md", "c2.md": "@c3.md", "c3.md": "@c4.md", "c4.md": "@c5.md", "c5.md": "@c6.md", "c6.md": "end",
      "fenced.md": "x", "spanned.md": "x",
    });
    const m = measureBody(dir, {});
    expect(m.startup.files.filter((f) => f.reason === "import").map((f) => f.path)).toEqual(["c1.md", "c2.md", "c3.md", "c4.md"]);
    const cyc = fixture({ "CLAUDE.md": "@a.md", "a.md": "@b.md", "b.md": "@a.md\n@CLAUDE.md" });
    expect(paths(measureBody(cyc, {}).startup.files)).toEqual(["CLAUDE.md", "a.md", "b.md"]);
  });

  it("resolves imports relative to the importing file", () => {
    const dir = fixture({ "CLAUDE.md": "@docs/a.md", "docs/a.md": "@b.md", "docs/b.md": "x" });
    expect(paths(measureBody(dir, {}).startup.files)).toEqual(["CLAUDE.md", "docs/a.md", "docs/b.md"]);
  });

  it("counts a file once across a task", () => {
    const dir = fixture({ "CLAUDE.md": "x", "src/CLAUDE.md": "@../shared.md", "shared.md": "s", ".claude/rules/b.md": "---\npaths: src/**\n---\n@../../shared.md\n", "src/f.ts": "", "lib/a.ts": "", "lib/b.ts": "" });
    const m = measureBody(dir, { touching: ["src/f.ts"] });
    const all = [...m.startup.files, ...m.task.added].map((f) => f.path);
    expect(all.filter((p) => p === "shared.md")).toHaveLength(1);
    expect(new Set(all).size).toBe(all.length);
  });

  it("loads nested notes for a touching path that does not exist", () => {
    const dir = fixture({ "CLAUDE.md": "x", "src/CLAUDE.md": "n", "src/deep/CLAUDE.md": "m" });
    const m = measureBody(dir, { touching: ["src/deep/none.ts"] });
    expect(m.task.added.map((f) => [f.path, f.reason])).toEqual([["src/CLAUDE.md", "nested"], ["src/deep/CLAUDE.md", "nested"]]);
  });

  it("strips block HTML comments before measuring", () => {
    const dir = fixture({ "CLAUDE.md": "keep\n<!--\nthis is a long comment that must not count\n-->\nkeep\n" });
    expect(measureBody(dir, {}).startup.files[0].bytes).toBe(Buffer.byteLength("keep\n\nkeep\n"));
  });

  it("reads CRLF rule files", () => {
    const dir = fixture({ "CLAUDE.md": "x", ".claude/rules/b.md": "---\r\npaths:\r\n  - src/**\r\n---\r\nbody\r\n", "src/f.ts": "", "lib/a.ts": "", "lib/b.ts": "" });
    const m = measureBody(dir, { touching: ["src/f.ts"] });
    expect(m.task.added.map((f) => f.reason)).toEqual(["path-rule"]);
  });

  it("flags budgets and oversize at the exact limits", () => {
    expect(measureBody(fixture({ "CLAUDE.md": "a".repeat(30000) }), {}).over.startup).toBe(false);
    expect(measureBody(fixture({ "CLAUDE.md": "a".repeat(30001) }), {}).over.startup).toBe(true);
    const lines = (n) => Array.from({ length: n }, () => "l").join("\n") + "\n";
    expect(measureBody(fixture({ "CLAUDE.md": lines(199) }), {}).oversize).toEqual([]);
    expect(measureBody(fixture({ "CLAUDE.md": lines(200) }), {}).oversize).toEqual([{ path: "CLAUDE.md", lines: 200, limit: 200 }]);
    const r = measureBody(fixture({ "CLAUDE.md": "x", ".claude/rules/big.md": lines(100), ".claude/rules/ok.md": lines(99) }), {});
    expect(r.oversize).toEqual([{ path: ".claude/rules/big.md", lines: 100, limit: 100 }]);
  });

  it("flags the task budget against the whole task", () => {
    const dir = fixture({ "CLAUDE.md": "x", "src/CLAUDE.md": "a".repeat(75000), "src/f.ts": "" });
    const m = measureBody(dir, { touching: ["src/f.ts"] });
    expect(m.over).toEqual({ startup: false, task: true });
  });

  it("counts skills, reported apart from the budget", () => {
    const dir = fixture({ "CLAUDE.md": "x", ".claude/skills/s/SKILL.md": "---\nname: s\ndescription: abc\nwhen_to_use: def\n---\nbody body body\n" });
    const m = measureBody(dir, {});
    expect(m.skills).toEqual({ count: 1, descriptionTokens: 3 });
    expect(paths(m.startup.files)).toEqual(["CLAUDE.md"]);
  });

  it("includes CLAUDE.local.md only if tracked", () => {
    const tracked = fixture({ "CLAUDE.md": "x", "CLAUDE.local.md": "l" });
    expect(paths(measureBody(tracked, {}).startup.files)).toContain("CLAUDE.local.md");
    const untracked = fixture({ "CLAUDE.md": "x" });
    write(untracked, { "CLAUDE.local.md": "l" });
    expect(paths(measureBody(untracked, {}).startup.files)).not.toContain("CLAUDE.local.md");
  });

  const para = (c) => `${c} `.repeat(30).trim();
  it("reports a paragraph as lost unless it moved verbatim or is allowed", () => {
    const keep = para("kept"), moved = para("moved"), gone = para("gone");
    const dir = fixture({ "CLAUDE.md": `# t\n\n${keep}\n\n${moved}\n\n${gone}\n\nshort\n` }, { commit: true });
    write(dir, { "CLAUDE.md": `# t\n\n${keep}\n`, "docs/lessons/a.md": `${moved}\n` });
    git(dir, "add", "-A");
    const m = measureBody(dir, { base: "HEAD" });
    expect(m.lost).toEqual([gone]);
    expect(measureBody(dir, { base: "HEAD", allowLost: [gone] }).lost).toEqual([]);
    expect(measureBody(dir, {}).lost).toBeNull();
  });
  it("normalises whitespace when matching moved paragraphs", () => {
    const moved = para("moved");
    const dir = fixture({ "CLAUDE.md": `${moved}\n` }, { commit: true });
    write(dir, { "CLAUDE.md": "x", "docs/a.md": moved.replace(/ /g, "\n") + "\n" });
    git(dir, "add", "-A");
    expect(measureBody(dir, { base: "HEAD" }).lost).toEqual([]);
  });

  it("reports a non-git directory and a missing CLAUDE.md as error", () => {
    const plain = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-instr-"));
    dirs.push(plain);
    fs.writeFileSync(path.join(plain, "CLAUDE.md"), "x");
    expect(measureBody(plain, {}).error).toMatch(/git/);
    const missing = fixture({ "README.md": "x" });
    const m = measureBody(missing, {});
    expect(m.error).toMatch(/CLAUDE\.md/);
    expect(m.body).toBe(path.basename(missing).toLowerCase());
  });
});
