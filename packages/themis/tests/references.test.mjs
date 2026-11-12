import { describe, it, expect, vi, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import references from "../src/commands/references.mjs";
import { discoverInstructionFiles } from "../src/lib/instructions/measure.mjs";

const dirs = [];
afterEach(() => { for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true }); vi.restoreAllMocks(); });
const tmp = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), "themis-refs-")); dirs.push(d); return d; };
export function body(files) {
  const dir = path.join(tmp(), "Body");
  fs.mkdirSync(dir);
  for (const [rel, text] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); }
  return dir;
}
const quiet = () => { const log = vi.spyOn(console, "log").mockImplementation(() => {}); const err = vi.spyOn(console, "error").mockImplementation(() => {}); return { out: () => log.mock.calls.flat().join("\n"), err: () => err.mock.calls.flat().join("\n") }; };
const deps = { today: () => "2026-11-11" };
const run = (files, extra = []) => { const q = quiet(); const dir = body(files); return references([dir, ...extra], deps).then((code) => ({ code, q, dir })); };

describe("discoverInstructionFiles", () => {
  it("finds root and nested CLAUDE.md, rules, skills, agents and lessons", () => {
    const dir = body({ "CLAUDE.md": "x", "packages/a/CLAUDE.md": "x", ".claude/rules/r.md": "x", ".claude/skills/s/SKILL.md": "x", ".claude/agents/a.md": "x", "docs/lessons/l.md": "x", "node_modules/p/CLAUDE.md": "x" });
    const f = discoverInstructionFiles(dir);
    expect(f.claude).toEqual(["CLAUDE.md", "packages/a/CLAUDE.md"]);
    expect(f.rules).toEqual([".claude/rules/r.md"]);
    expect(f.skills).toEqual([".claude/skills/s/SKILL.md"]);
    expect(f.agents).toEqual([".claude/agents/a.md"]);
    expect(f.lessons).toEqual(["docs/lessons/l.md"]);
  });
});

describe("themis references", () => {
  it("exits 2 without a body", async () => {
    const q = quiet();
    expect(await references([], deps)).toBe(2);
    expect(q.err()).toContain("usage: themis references <bodyDir>...");
  });

  it("fails a link to a missing file and passes the same link to an existing one", async () => {
    const bad = await run({ "CLAUDE.md": "See [the plan](docs/plan.md)." });
    expect(bad.code).toBe(1);
    expect(bad.q.err()).toContain("docs/plan.md");
    const good = await run({ "CLAUDE.md": "See [the plan](docs/plan.md).", "docs/plan.md": "x" });
    expect(good.code).toBe(0);
  });

  it("resolves a path relative to the file's own directory", async () => {
    const { code } = await run({ "CLAUDE.md": "x", "docs/lessons/a.md": "see `b.md`", "docs/lessons/b.md": "x" });
    expect(code).toBe(0);
  });

  it("checks backticked paths and ignores URLs, flags, packages and prose", async () => {
    const { code } = await run({ "CLAUDE.md": "`@vaoan/themis/eslint` `--flag/x` `https://x.dev/a.md` `a b/c.md` `plain`" });
    expect(code).toBe(0);
    expect((await run({ "CLAUDE.md": "`src/gone.ts`" })).code).toBe(1);
  });

  it("does not take a bare extension for a file", async () => {
    expect((await run({ "CLAUDE.md": "a `.json` twin beside the `.md`" })).code).toBe(0);
  });

  it("checks pnpm scripts against the root and workspace packages", async () => {
    const files = { "CLAUDE.md": "run `pnpm lint`", "package.json": JSON.stringify({ scripts: { lint: "x" } }) };
    expect((await run(files)).code).toBe(0);
    expect((await run({ ...files, "package.json": JSON.stringify({ scripts: {} }) })).code).toBe(1);
    const ws = { "CLAUDE.md": "run `pnpm build`", "package.json": "{}", "pnpm-workspace.yaml": "packages:\n  - \"packages/*\"\n", "packages/a/package.json": JSON.stringify({ scripts: { build: "x" } }) };
    expect((await run(ws)).code).toBe(0);
    expect((await run({ "CLAUDE.md": "`pnpm install` `pnpm exec nothing` `pnpm test`", "package.json": "{}" })).code).toBe(0);
  });

  it("checks themis commands against the registered ones", async () => {
    expect((await run({ "CLAUDE.md": "`themis references .`" })).code).toBe(0);
    const bad = await run({ "CLAUDE.md": "`themis frobnicate`" });
    expect(bad.code).toBe(1);
    expect(bad.q.err()).toContain("frobnicate");
  });

  it("checks fenced commands at line start", async () => {
    expect((await run({ "CLAUDE.md": "```\nthemis frobnicate x\n```\n" })).code).toBe(1);
  });

  it("checks globs as matching at least one file", async () => {
    expect((await run({ "CLAUDE.md": "`src/**/*.ts`" })).code).toBe(1);
    expect((await run({ "CLAUDE.md": "`src/**/*.ts`", "src/a/b.ts": "x" })).code).toBe(0);
    expect((await run({ "CLAUDE.md": "`src/*.{ts,tsx}`", "src/b.tsx": "x" })).code).toBe(0);
  });

  it("skips a marked line and lists it as an exception", async () => {
    const { code, dir } = await run({ "CLAUDE.md": "`themis frobnicate` <!-- themis: example -->" });
    expect(code).toBe(0);
    const report = tmp();
    await references([dir, "--report", report], deps);
    const json = JSON.parse(fs.readFileSync(path.join(report, "2026-11-11-references.json"), "utf8"));
    expect(json.bodies[0].exceptions).toEqual([expect.objectContaining({ token: "themis frobnicate", why: "example" })]);
  });

  it("skips angle-bracket placeholders as examples", async () => {
    expect((await run({ "CLAUDE.md": "`docs/<name>.md`" })).code).toBe(0);
  });

  it("checks local skill names, accepts plugin-qualified ones as external", async () => {
    const files = { "CLAUDE.md": "use skill `deploy` or `/deploy` or `/superpowers:brainstorming`", ".claude/skills/deploy/SKILL.md": "---\nname: deploy\n---\n" };
    expect((await run(files)).code).toBe(0);
    expect((await run({ "CLAUDE.md": "use skill `missing`" })).code).toBe(1);
    expect((await run({ "CLAUDE.md": "use `/missing`" })).code).toBe(1);
    expect((await run({ "CLAUDE.md": "use `/clear`" })).code).toBe(0);
  });

  it("reads rules, nested files and lessons too", async () => {
    expect((await run({ "CLAUDE.md": "x", ".claude/rules/r.md": "`nope/x.md`" })).code).toBe(1);
    expect((await run({ "CLAUDE.md": "x", "pkg/CLAUDE.md": "`nope/x.md`" })).code).toBe(1);
    expect((await run({ "CLAUDE.md": "x", "docs/lessons/l.md": "`nope/x.md`" })).code).toBe(1);
  });

  it("writes md and json twins that hold no absolute path", async () => {
    const q = quiet();
    const dir = body({ "CLAUDE.md": "`src/gone.ts` `/Users/someone/x.md`" });
    const report = tmp();
    expect(await references([dir, "--report", report, "--label", "t"], deps)).toBe(1);
    expect(fs.readdirSync(report).sort()).toEqual(["2026-11-11-references-t.json", "2026-11-11-references-t.md"]);
    for (const f of fs.readdirSync(report)) {
      const text = fs.readFileSync(path.join(report, f), "utf8");
      expect(text).not.toContain(path.dirname(dir));
      expect(text).not.toContain("/Users/someone");
    }
    expect(q.out()).toContain("report:");
  });

  it("fails a body without a CLAUDE.md", async () => {
    expect((await run({ "README.md": "x" })).code).toBe(1);
  });
});
