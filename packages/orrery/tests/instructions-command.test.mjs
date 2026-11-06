import { describe, it, expect, vi, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import instructions from "../src/commands/instructions.mjs";

const dirs = [];
afterEach(() => { for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true }); vi.restoreAllMocks(); });
const tmp = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-instrc-")); dirs.push(d); return d; };
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

describe("orrery instructions", () => {
  it("exits 2 without a body", async () => {
    const q = quiet();
    expect(await instructions([], deps)).toBe(2);
    expect(q.err()).toContain("usage: orrery instructions <bodyDir>...");
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
});
