import { describe, it, expect, vi, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import skills from "../src/commands/skills.mjs";

const dirs = [];
afterEach(() => { for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true }); vi.restoreAllMocks(); });
const tmp = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), "themis-skills-")); dirs.push(d); return d; };
function body(files) {
  const dir = path.join(tmp(), "Body");
  fs.mkdirSync(dir);
  for (const [rel, text] of Object.entries({ "CLAUDE.md": "x", ...files })) { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); }
  return dir;
}
const quiet = () => { const log = vi.spyOn(console, "log").mockImplementation(() => {}); const err = vi.spyOn(console, "error").mockImplementation(() => {}); return { out: () => log.mock.calls.flat().join("\n"), err: () => err.mock.calls.flat().join("\n") }; };
const deps = { today: () => "2026-11-11" };
const run = async (files) => { const q = quiet(); return { code: await skills([body(files)], deps), q }; };
const skill = (name, desc, extra = "", text = "") => `---\nname: ${name}\ndescription: ${desc}\n${extra}---\n${text}\n`;
const good = "Deploys the app. Use when the user asks to ship.";

describe("themis skills", () => {
  it("exits 2 without a body", async () => {
    const q = quiet();
    expect(await skills([], deps)).toBe(2);
    expect(q.err()).toContain("usage: themis skills <bodyDir>...");
  });

  it("passes a valid skill and a valid agent", async () => {
    const { code } = await run({ ".claude/skills/deploy/SKILL.md": skill("deploy", good), ".claude/agents/reviewer.md": skill("reviewer", good, "tools: Read, Grep, Bash(git diff:*)\n") });
    expect(code).toBe(0);
  });

  it("fails a name that differs from its directory", async () => {
    const r = await run({ ".claude/skills/deploy/SKILL.md": skill("ship", good) });
    expect(r.code).toBe(1);
    expect(r.q.err()).toContain("name");
  });

  it("fails a name that is not kebab-case", async () => {
    expect((await run({ ".claude/skills/Deploy_It/SKILL.md": skill("Deploy_It", good) })).code).toBe(1);
  });

  it("fails an empty description, a 1025-character one, and one that never says when", async () => {
    expect((await run({ ".claude/skills/a/SKILL.md": "---\nname: a\ndescription:\n---\n" })).code).toBe(1);
    expect((await run({ ".claude/skills/a/SKILL.md": skill("a", "Use when " + "x".repeat(1016)) })).code).toBe(1);
    expect((await run({ ".claude/skills/a/SKILL.md": skill("a", "Use when " + "x".repeat(1015)) })).code).toBe(0);
    expect((await run({ ".claude/skills/a/SKILL.md": skill("a", "A deployment helper.") })).code).toBe(1);
  });

  it("fails missing or unparsable frontmatter", async () => {
    expect((await run({ ".claude/skills/a/SKILL.md": "no frontmatter" })).code).toBe(1);
  });

  it("fails an agent listing a tool that does not exist", async () => {
    const r = await run({ ".claude/agents/a.md": skill("a", good, "tools: Read, Teleport\n") });
    expect(r.code).toBe(1);
    expect(r.q.err()).toContain("Teleport");
  });

  it("accepts a tools list in YAML list form and mcp tools", async () => {
    expect((await run({ ".claude/agents/a.md": skill("a", good, "tools:\n  - Read\n  - mcp__x__y\n") })).code).toBe(0);
  });

  it("fails a broken reference in the skill body", async () => {
    expect((await run({ ".claude/skills/a/SKILL.md": skill("a", good, "", "See `refs/gone.md`.") })).code).toBe(1);
    expect((await run({ ".claude/skills/a/SKILL.md": skill("a", good, "", "See `refs/there.md`."), ".claude/skills/a/refs/there.md": "x" })).code).toBe(0);
  });

  it("fails when the descriptions together pass the listing budget", async () => {
    const files = {};
    for (let i = 0; i < 10; i++) files[`.claude/skills/s${i}/SKILL.md`] = skill(`s${i}`, "Use when " + "x".repeat(1000));
    const r = await run(files);
    expect(r.code).toBe(1);
    expect(r.q.err()).toContain("budget");
  });

  it("writes md and json twins", async () => {
    quiet();
    const report = tmp();
    await skills([body({ ".claude/skills/a/SKILL.md": skill("a", good) }), "--report", report], deps);
    expect(fs.readdirSync(report).sort()).toEqual(["2026-11-11-skills.json", "2026-11-11-skills.md"]);
  });
});
