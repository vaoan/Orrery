import { describe, it, expect, vi, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import references from "../src/commands/references.mjs";
import { execFileSync } from "node:child_process";
import { discoverInstructionFiles } from "../src/lib/instructions/discover.mjs";
import { COMMANDS } from "../src/cli.mjs";
import { COMMAND_NAMES } from "../src/lib/command-names.mjs";

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

describe("command names", () => {
  it("are the ones cli.mjs dispatches on", () => {
    expect([...COMMAND_NAMES].sort()).toEqual(Object.keys(COMMANDS).sort());
  });
});

describe("discovery through git", () => {
  it("skips gitignored directories and lists untracked files", () => {
    const dir = body({ "CLAUDE.md": "x", ".gitignore": ".ai-context/\n", ".ai-context/CLAUDE.md": "x", "pkg/CLAUDE.md": "x" });
    execFileSync("git", ["-C", dir, "init", "-q"]);
    expect(discoverInstructionFiles(dir).claude).toEqual(["CLAUDE.md", "pkg/CLAUDE.md"]);
  });
});

const ws = (extra = {}) => ({ "CLAUDE.md": "x", "package.json": JSON.stringify({ name: "root" }), "pnpm-workspace.yaml": "packages:\n  - \"apps/*\"\n  - \"packages/*\"\n", ...extra });
const ok = async (files) => expect((await run(files)).code).toBe(0);
const bad = async (files) => expect((await run(files)).code).toBe(1);

describe("precision rules", () => {
  it("1. resolves an app-relative path from a workspace package root, and still flags a missing one", async () => {
    const pkg = { "apps/store/package.json": JSON.stringify({ name: "store" }), "apps/store/src/globals.css": "x" };
    await ok(ws({ ...pkg, "docs/lessons/a.md": "see `src/globals.css`" }));
    await bad(ws({ ...pkg, "docs/lessons/a.md": "see `src/missing.css`" }));
    await ok(ws({ ...pkg, "docs/lessons/a.md": "see `shared/x.ts`", "apps/store/src/shared/x.ts": "x" }));
    await bad(ws({ ...pkg, "docs/lessons/a.md": "see `shared/y.ts`", "apps/store/src/shared/x.ts": "x" }));
  });

  it("2. a bare file name passes when any file has that basename, fails when none does", async () => {
    await ok(ws({ "docs/lessons/a.md": "see `globals.css`", "apps/store/src/globals.css": "x" }));
    await bad(ws({ "docs/lessons/a.md": "see `globals.css`" }));
  });

  it("3. an import specifier is not checked; a workspace package specifier is checked against the package", async () => {
    await ok({ "CLAUDE.md": "import from `./Component` or `../domain`" });
    const pkgs = { "packages/shared/package.json": JSON.stringify({ name: "@acme/shared", exports: { "./utils": "./u.js" } }), "packages/shared/src/x.ts": "x" };
    await ok(ws({ ...pkgs, "docs/lessons/a.md": "`@acme/shared/src/x.ts` and `@acme/shared/utils`" }));
    await bad(ws({ ...pkgs, "docs/lessons/a.md": "`@acme/shared/src/y.ts`" }));
    await bad({ "CLAUDE.md": "see `./gone.ts`" });
  });

  it("4. placeholders check only the directory before the first one", async () => {
    await ok({ "CLAUDE.md": "`src/mocks/data/[entity].ts` and `src/{feature}/x.ts`", "src/mocks/data/users.ts": "x", "src/a/x.ts": "x" });
    await bad({ "CLAUDE.md": "`src/mocks/data/[entity].ts`", "src/other/x.ts": "x" });
    await ok({ "CLAUDE.md": "`{sub-agent-type}_{timestamp}.json`" });
    await ok({ "CLAUDE.md": "a route `app/[id]/page.tsx`", "app/[id]/page.tsx": "x" });
  });

  it("5. branch names are not paths unless a top-level directory has that name", async () => {
    await ok({ "CLAUDE.md": "branch `feat/GH-42_User-Auth` from `release/*` and `fix/the-thing`" });
    await bad({ "CLAUDE.md": "`docs/gone.md`", "docs/a.md": "x" });
    await bad({ "CLAUDE.md": "`docs/lessons/` and `feat/x/y` and `release/v2025.01.09.1`", "src/a.ts": "x" });
    await ok({ "CLAUDE.md": "`docs/*` and `feat/reconcile-records-command` and `fix/<name>`", "src/a.ts": "x" });
    await ok({ "CLAUDE.md": "`docs/a.md`", "docs/a.md": "x" });
  });

  it("5b. a branch prefix with a trailing slash is a branch, not a directory", async () => {
    await ok({ "CLAUDE.md": "branches `feature/` and `fix/`" });
  });

  it("2b. a bare directory name resolves from the root, the file's dir or the file's own package, not anywhere", async () => {
    const ui = { "packages/ui/package.json": JSON.stringify({ name: "ui" }), "packages/ui/src/domain/x.ts": "x" };
    await bad(ws({ ...ui, "CLAUDE.md": "layers `domain/`" }));
    await ok(ws({ ...ui, "CLAUDE.md": "x", "packages/ui/CLAUDE.md": "layers `domain/`" }));
    await bad(ws({ ...ui, "CLAUDE.md": "x", "packages/other/package.json": JSON.stringify({ name: "other" }), "packages/other/CLAUDE.md": "layers `domain/`" }));
  });

  it("6. eslint rule ids of a dependency are not paths", async () => {
    const deps = { "package.json": JSON.stringify({ devDependencies: { "eslint-plugin-unicorn": "1", "@acme/eslint-plugin": "1" } }) };
    await ok({ "CLAUDE.md": "`unicorn/no-document-cookie` `@acme/some-rule`", ...deps });
    await bad({ "CLAUDE.md": "`unicorn/no-document-cookie`", "package.json": "{}" });
    await bad({ "CLAUDE.md": "`other/no-thing`", ...deps });
  });

  it("7. a repository slug with a registry owner is not a path", async () => {
    await ok({ "CLAUDE.md": "`vaoan/AeleOS`" }); // owners come from Themis's registry
    await bad({ "CLAUDE.md": "`acme/AeleOS`" });
  });

  it("8. a /name that names a directory or workspace app is a route, not a skill", async () => {
    await ok(ws({ "CLAUDE.md": "`/auth` `/shared` `/cart`", "apps/auth/package.json": JSON.stringify({ name: "auth" }), "shared/a.ts": "x", "apps/auth/src/app/cart/page.tsx": "x" }));
    await bad({ "CLAUDE.md": "`/auth`" });
    await bad(ws({ "CLAUDE.md": "`/deep`", "src/lib/deep/a.ts": "x" }));
  });

  it("9. an unknown /name is external-unverified when plugins are enabled, broken otherwise", async () => {
    await ok({ "CLAUDE.md": "`/brainstorming`", ".claude/settings.json": JSON.stringify({ enabledPlugins: { "superpowers@m": true } }) });
    await bad({ "CLAUDE.md": "`/brainstorming`", ".claude/settings.json": "{}" });
  });
});

describe("gitignored and directory globs", () => {
  const git = (dir) => execFileSync("git", ["-C", dir, "init", "-q"]);
  it("does not expect a path the body's .gitignore ignores to exist", async () => {
    const q = quiet();
    const dir = body({ "CLAUDE.md": "reports go to `.ai-context/reports/` and `.ai-context/out-{id}.md`, config `local.json`", ".gitignore": ".ai-context/\n" });
    git(dir);
    expect(await references([dir], deps)).toBe(1);
    expect(q.err()).toContain("local.json");
    expect(q.err()).not.toContain("ai-context");
  });
  it("matches a glob that ends at a directory", async () => {
    const a = { "apps/a/package.json": JSON.stringify({ name: "a" }) };
    await ok(ws({ ...a, "CLAUDE.md": "`src/features/*/ui/`", "apps/a/src/features/x/ui/b.ts": "x" }));
    await bad(ws({ ...a, "CLAUDE.md": "`src/features/*/ui/`", "apps/a/src/features/x/lib/b.ts": "x" }));
  });
});

describe("example blocks", () => {
  const table = "| Components | `UserCard.tsx` | `src/shared/domain/x.ts` |";
  it("skips a table inside a block and reports it as an example with the block's range", async () => {
    const { code, dir } = await run({ "CLAUDE.md": `intro\n<!-- themis: examples -->\n${table}\n<!-- themis: end -->\n` });
    expect(code).toBe(0);
    const report = tmp();
    await references([dir, "--report", report], deps);
    const json = JSON.parse(fs.readFileSync(path.join(report, "2026-11-11-references.json"), "utf8"));
    expect(json.bodies[0].exceptions).toEqual([expect.objectContaining({ token: "UserCard.tsx", why: "example (lines 2-4)" }), expect.objectContaining({ token: "src/shared/domain/x.ts", why: "example (lines 2-4)" })]);
  });
  it("fails the same table outside a block, and still checks what follows a closed block", async () => {
    await bad({ "CLAUDE.md": `${table}\n` });
    await bad({ "CLAUDE.md": `<!-- themis: examples -->\n${table}\n<!-- themis: end -->\n\`src/gone.ts\`\n` });
  });
  it("counts a marker only alone on its line and outside a fence", async () => {
    await bad({ "CLAUDE.md": "wrap in `<!-- themis: examples -->` ... `<!-- themis: end -->`\n`src/gone.ts`\n" });
    await bad({ "CLAUDE.md": "```\n<!-- themis: examples -->\n```\n`src/gone.ts`\n" });
    await ok({ "CLAUDE.md": "  <!-- themis: examples -->  \n`src/gone.ts`\n<!-- themis: end -->\n" });
  });
  it("fails a stray end, naming file and line", async () => {
    const r = await run({ "CLAUDE.md": "a\n<!-- themis: end -->\n" });
    expect(r.code).toBe(1);
    expect(r.q.err()).toContain("CLAUDE.md:2");
  });
  it("fails an unclosed block, naming file and line", async () => {
    const r = await run({ "CLAUDE.md": `a\n<!-- themis: examples -->\n${table}\n` });
    expect(r.code).toBe(1);
    expect(r.q.err()).toContain("CLAUDE.md:2");
    expect(r.q.err()).toContain("never closed");
  });
  it("skips fenced sample output inside a block", async () => {
    await ok({ "CLAUDE.md": "<!-- themis: examples -->\n```\nthemis frobnicate x\n```\n<!-- themis: end -->\n" });
  });
  it("puts the markers in the usage text and the report, and splits findings by likelihood", async () => {
    const q = quiet();
    expect(await references([], deps)).toBe(2);
    expect(q.err()).toContain("themis: examples");
    const dir = body({ "CLAUDE.md": "| a | `Foo.tsx` | `src/Bar.tsx` |\nsee `src/gone.ts`\n" });
    const report = tmp();
    await references([dir, "--report", report], deps);
    const md = fs.readFileSync(path.join(report, "2026-11-11-references.md"), "utf8");
    expect(md).toContain("Mark examples, do not weaken the check");
    expect(md).toMatch(/Likely stale[^\n]*\n[\s\S]*src\/gone\.ts[\s\S]*Ambiguous[^\n]*\n[\s\S]*Foo\.tsx[\s\S]*Likely illustrative[^\n]*\n[\s\S]*Bar\.tsx/);
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
