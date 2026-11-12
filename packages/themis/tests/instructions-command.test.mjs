import { describe, it, expect, vi, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import instructions from "../src/commands/instructions.mjs";

const dirs = [];
afterEach(() => { for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true }); vi.restoreAllMocks(); });
const tmp = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), "themis-instrc-")); dirs.push(d); return d; };
const git = (dir, ...args) => execFileSync("git", ["-C", dir, "-c", "user.email=t@t", "-c", "user.name=t", "-c", "commit.gpgsign=false", ...args], { stdio: "ignore" });
function body(files, { commit = false } = {}) {
  const dir = path.join(tmp(), "Body");
  fs.mkdirSync(dir);
  git(dir, "init", "-q");
  for (const [rel, text] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); }
  git(dir, "add", "-A");
  if (commit) git(dir, "commit", "-q", "-m", "i");
  return dir;
}
const quiet = () => { const log = vi.spyOn(console, "log").mockImplementation(() => {}); const err = vi.spyOn(console, "error").mockImplementation(() => {}); return { out: () => log.mock.calls.flat().join("\n"), err: () => err.mock.calls.flat().join("\n") }; };
const deps = { today: () => "2026-11-06" };
const norm = (s) => s.replace(/\r\n/g, "\n");

describe("themis instructions", () => {
  it("exits 2 without a body", async () => {
    const q = quiet();
    expect(await instructions([], deps)).toBe(2);
    expect(q.err()).toContain("usage: themis instructions <bodyDir>...");
  });

  it("writes md and json twins named by date and label", async () => {
    quiet();
    const report = tmp();
    const code = await instructions([body({ "CLAUDE.md": "x" }), "--report", report, "--label", "baseline"], deps);
    expect(code).toBe(0);
    expect(fs.readdirSync(report).sort()).toEqual(["2026-11-06-instructions-baseline.json", "2026-11-06-instructions-baseline.md"]);
    const json = JSON.parse(fs.readFileSync(path.join(report, "2026-11-06-instructions-baseline.json"), "utf8"));
    expect(json.label).toBe("baseline");
    expect(json.command).toContain("instructions");
    expect(norm(fs.readFileSync(path.join(report, "2026-11-06-instructions-baseline.md"), "utf8"))).toContain("CLAUDE.md");
  });

  it("never writes paragraph text to the report, and prints it to stdout", async () => {
    const q = quiet();
    const gone = "a deleted paragraph that is long enough to be measured as a paragraph here";
    const dir = body({ "CLAUDE.md": `# t\n\n${gone}\n` }, { commit: true });
    fs.writeFileSync(path.join(dir, "CLAUDE.md"), "# t\n");
    git(dir, "add", "-A");
    const report = tmp();
    const code = await instructions([dir, "--base", "HEAD", "--report", report, "--label", "x"], deps);
    expect(code).toBe(1);
    for (const f of fs.readdirSync(report)) expect(fs.readFileSync(path.join(report, f), "utf8")).not.toContain("deleted paragraph");
    const json = JSON.parse(fs.readFileSync(path.join(report, "2026-11-06-instructions-x.json"), "utf8"));
    expect(json.bodies[0].lostCount).toBe(1);
    expect(json.bodies[0]).not.toHaveProperty("lost");
    expect(q.out()).toContain("deleted paragraph");
  });

  it("allows lost paragraphs listed in --allow-lost", async () => {
    quiet();
    const gone = "a deleted paragraph that is long enough to be measured as a paragraph here";
    const dir = body({ "CLAUDE.md": `# t\n\n${gone}\n` }, { commit: true });
    fs.writeFileSync(path.join(dir, "CLAUDE.md"), "# t\n");
    git(dir, "add", "-A");
    const allow = path.join(tmp(), "allow.json");
    fs.writeFileSync(allow, JSON.stringify([gone]));
    expect(await instructions([dir, "--base", "HEAD", "--allow-lost", allow], deps)).toBe(0);
  });

  it("exits 1 when one body errors and still reports the other", async () => {
    const q = quiet();
    const report = tmp();
    const plain = path.join(tmp(), "plain");
    fs.mkdirSync(plain);
    const code = await instructions([plain, body({ "CLAUDE.md": "x" }), "--report", report], deps);
    expect(code).toBe(1);
    expect(q.err()).toContain("plain");
    const json = JSON.parse(fs.readFileSync(path.join(report, "2026-11-06-instructions.json"), "utf8"));
    expect(json.bodies.map((b) => [b.body, Boolean(b.error)])).toEqual([["plain", true], ["body", false]]);
  });

  it("exits 0 when within budget, and applies --touching by body name", async () => {
    const q = quiet();
    const dir = body({ "CLAUDE.md": "x", "src/CLAUDE.md": "n" });
    expect(await instructions([dir, "--touching", "body=src/f.ts"], deps)).toBe(0);
    expect(q.out()).toContain("src/CLAUDE.md");
  });

  it("exits 1 when over budget", async () => {
    quiet();
    expect(await instructions([body({ "CLAUDE.md": "a".repeat(30001) })], deps)).toBe(1);
  });

  it("exits 2 on a malformed --touching", async () => {
    quiet();
    expect(await instructions([body({ "CLAUDE.md": "x" }), "--touching", "nope"], deps)).toBe(2);
  });

  it("keeps local paths out of both report files, command and errors included", async () => {
    quiet();
    const report = tmp();
    const good = body({ "CLAUDE.md": "x" });
    const plain = path.join(tmp(), "plain");
    fs.mkdirSync(plain);
    await instructions([good, plain, "--touching", "body=src/a.ts", "--report", report, "--label", "l"], deps);
    for (const f of fs.readdirSync(report)) {
      const text = fs.readFileSync(path.join(report, f), "utf8");
      expect(text).not.toContain(path.dirname(good));
      expect(text).not.toContain(path.dirname(plain));
    }
    const json = JSON.parse(fs.readFileSync(path.join(report, "2026-11-06-instructions-l.json"), "utf8"));
    expect(json.command).toBe("themis instructions body plain --touching body=src/a.ts --label l");
  });

  it("refuses a --touching key naming no given body, and writes no report", async () => {
    const q = quiet();
    const report = tmp();
    expect(await instructions([body({ "CLAUDE.md": "x" }), "--touching", "libra=src/a.ts", "--report", report], deps)).toBe(2);
    expect(q.err()).toContain("libra");
    expect(fs.readdirSync(report)).toEqual([]);
  });

  it("refuses an absolute or escaping --touching path", async () => {
    const q = quiet();
    const dir = body({ "CLAUDE.md": "x" });
    expect(await instructions([dir, "--touching", "body=/etc/passwd"], deps)).toBe(2);
    expect(await instructions([dir, "--touching", "body=../x.ts"], deps)).toBe(2);
    expect(await instructions([dir, "--touching", "body=a/../../x.ts"], deps)).toBe(2);
    expect(q.err()).toContain("must be relative");
  });

  const readJson = (report, stem = "2026-11-06-instructions") => JSON.parse(fs.readFileSync(path.join(report, `${stem}.json`), "utf8"));
  const readMd = (report, stem = "2026-11-06-instructions") => norm(fs.readFileSync(path.join(report, `${stem}.md`), "utf8"));

  it("reports a null lostCount when no body was measured for it", async () => {
    quiet();
    const report = tmp();
    await instructions([body({ "CLAUDE.md": "x" }), "--report", report], deps);
    expect(readJson(report).lostCount).toBeNull();
  });

  it("totals lostCount across the bodies that were measured for it", async () => {
    quiet();
    const report = tmp();
    const gone = "a deleted paragraph that is long enough to be measured as a paragraph here";
    const a = body({ "CLAUDE.md": `# t\n\n${gone}\n` }, { commit: true });
    fs.writeFileSync(path.join(a, "CLAUDE.md"), "# t\n");
    git(a, "add", "-A");
    await instructions([a, "--base", "HEAD", "--report", report], deps);
    expect(readJson(report).lostCount).toBe(1);
  });

  // Two committed bodies, each with a paragraph deleted since its first commit, named by directory.
  function named(name) {
    const parent = tmp();
    const dir = path.join(parent, name);
    fs.mkdirSync(dir);
    git(dir, "init", "-q");
    fs.writeFileSync(path.join(dir, "CLAUDE.md"), `# ${name}\n\na paragraph of ${name} that is long enough to be measured here\n`);
    git(dir, "add", "-A");
    git(dir, "commit", "-q", "-m", "i");
    fs.writeFileSync(path.join(dir, "CLAUDE.md"), `# ${name}\n`);
    git(dir, "add", "-A");
    return dir;
  }

  it("takes --base body=ref per body, and leaves a body without one unmeasured for loss", async () => {
    quiet();
    const report = tmp();
    const a = named("one");
    const b = named("two");
    const code = await instructions([a, b, "--base", "one=HEAD", "--report", report], deps);
    expect(code).toBe(1);
    const json = readJson(report);
    expect(json.bodies.map((x) => [x.body, x.lostCount])).toEqual([["one", 1], ["two", null]]);
    expect(json.command).toBe("themis instructions one two --base one=HEAD");
  });

  it("takes a different --base for each body in one run", async () => {
    const q = quiet();
    const report = tmp();
    const a = named("one");
    const b = named("two");
    await instructions([a, b, "--base", "one=HEAD", "--base", "two=HEAD~0", "--report", report], deps);
    expect(readJson(report).bodies.map((x) => x.lostCount)).toEqual([1, 1]);
    expect(q.err()).toContain("one: 1 paragraph(s) lost since HEAD");
    expect(q.err()).toContain("two: 1 paragraph(s) lost since HEAD~0");
    expect(readJson(report).command).toContain("--base one=HEAD --base two=HEAD~0");
  });

  it("applies a bare --base to every body, and lets body=ref override it", async () => {
    quiet();
    const report = tmp();
    const a = named("one");
    const b = named("two");
    await instructions([a, b, "--base", "HEAD", "--base", "two=does-not-exist", "--report", report], deps);
    const [one, two] = readJson(report).bodies;
    expect(one.lostCount).toBe(1);
    expect(two.error).toContain("does-not-exist");
  });

  it("refuses a --base naming no given body, an empty one, and two bare ones", async () => {
    const q = quiet();
    const report = tmp();
    const dir = body({ "CLAUDE.md": "x" });
    expect(await instructions([dir, "--base", "libra=HEAD", "--report", report], deps)).toBe(2);
    expect(q.err()).toContain("libra");
    expect(await instructions([dir, "--base", "body=", "--report", report], deps)).toBe(2);
    expect(await instructions([dir, "--base", "HEAD", "--base", "main", "--report", report], deps)).toBe(2);
    expect(await instructions([dir, "--base", "body=HEAD", "--base", "body=main", "--report", report], deps)).toBe(2);
    expect(fs.readdirSync(report)).toEqual([]);
  });

  it("says in the header what the start and task figures leave out", async () => {
    quiet();
    const report = tmp();
    await instructions([body({ "CLAUDE.md": "x" }), "--report", report], deps);
    const md = readMd(report);
    const line = md.split("\n").find((l) => l.startsWith("Start excludes"));
    expect(line).toBeDefined();
    for (const part of ["skill descriptions (shown separately)", "`.claude/agents` descriptions", "plugin and user-level injections", "MCP servers", "lessons Claude follows a link to"]) expect(line).toContain(part);
    expect(md.indexOf(line)).toBeLessThan(md.indexOf("## body"));
  });

  it("keeps going past a broken rule symlink, and still reports the other body", async () => {
    const q = quiet();
    const report = tmp();
    const broken = body({ "CLAUDE.md": "x", ".claude/rules/good.md": "unscoped" });
    fs.symlinkSync("gone.md", path.join(broken, ".claude/rules/broken.md"));
    const other = path.join(tmp(), "other");
    fs.mkdirSync(other);
    git(other, "init", "-q");
    fs.writeFileSync(path.join(other, "CLAUDE.md"), "x");
    git(other, "add", "-A");
    expect(await instructions([broken, other, "--report", report], deps)).toBe(0);
    expect(q.err()).toContain("body: skipped .claude/rules/broken.md");
    const json = readJson(report);
    expect(json.bodies.map((b) => b.body)).toEqual(["body", "other"]);
    expect(json.bodies[0].skippedRules).toEqual([".claude/rules/broken.md"]);
    expect(readMd(report)).toContain("- .claude/rules/broken.md");
  });
});
