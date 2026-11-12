// The fixture stands in for a fresh body. Every check body-ci runs that can run offline is
// run here against it, so a check added to body-ci that a fresh body cannot pass breaks
// Themis's own CI first (the ordering fix after Vulkan's first PR, ADR 0023).
import { describe, it, expect, vi, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { COMMANDS } from "../src/cli.mjs";
import { HOOK_NAMES } from "../src/commands/hook.mjs";
import { CI_VERBS } from "../src/commands/ci.mjs";
import { measureBody } from "../src/lib/instructions/measure.mjs";
import { loadPolicy } from "../src/lib/policy.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const fixture = path.join(root, "fixtures/next-supabase-mono");
const templates = path.join(root, "packages/themis/templates/next-supabase-mono");
const read = (f) => fs.readFileSync(path.isAbsolute(f) ? f : path.join(root, f), "utf8").replace(/\r\n/g, "\n");
const listFiles = (dir) => fs.readdirSync(dir, { recursive: true, withFileTypes: true }).filter((d) => d.isFile()).map((d) => path.relative(dir, path.join(d.parentPath, d.name)).split(path.sep).join("/"));

afterEach(() => vi.restoreAllMocks());
const quiet = () => {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  const err = vi.spyOn(console, "error").mockImplementation(() => {});
  return () => [...log.mock.calls, ...err.mock.calls].flat().join("\n");
};

// The test job's steps in body-ci.yml, as `run:` lines, database-gated ones left out.
const bodyCi = read(".github/workflows/body-ci.yml");
const testRuns = () => {
  const block = bodyCi.match(/^  test:\n((?:    [^\n]*\n|\n)*)/m)[1];
  return block.split(/^      - /m).slice(1).filter((s) => !s.includes("inputs.database")).map((s) => s.match(/^run: (.*)$/m)?.[1]).filter(Boolean);
};

// Steps that need the body's own install (its eslint, tsc, vitest and lockfile) cannot run
// against the fixture here; Themis covers their configuration elsewhere (bundle-honesty lints
// the fixture with the class config). Any other step must be a `pnpm themis` command that
// runs below, so a new body-ci step has to be classified before it can land.
const NEEDS_BODY_INSTALL = { "pnpm install --frozen-lockfile": "the body's lockfile", "pnpm lint": "bundle-honesty", "pnpm typecheck": "bundle-honesty", "pnpm test": "the body's own tests" };

describe("body-ci's test job against the fixture (a fresh body)", () => {
  const runs = testRuns();
  const themisSteps = runs.filter((r) => r.startsWith("pnpm themis "));

  it("classifies every step: needs the body's install, or a themis command run below", () => {
    for (const r of runs) expect(r in NEEDS_BODY_INSTALL || r.startsWith("pnpm themis "), r).toBe(true);
    expect(themisSteps.length).toBeGreaterThanOrEqual(2);
  });

  it.each(testRuns().filter((r) => r.startsWith("pnpm themis ")))("%s passes on the fixture", async (step) => {
    const [command, ...args] = step.replace(/^pnpm themis /, "").split(/\s+/);
    expect(COMMANDS[command], command).toBeTypeOf("function");
    const output = quiet();
    const code = await COMMANDS[command](args.map((a) => (a === "." ? fixture : a)));
    expect(code, output()).toBe(0);
  });

  it("themis instructions keeps the fixture within budget", async () => {
    const output = quiet();
    expect(await COMMANDS.instructions([fixture]), output()).toBe(0);
    const m = measureBody(fixture);
    expect(m.over).toEqual({ startup: false, task: false });
  });
});

describe("the fixture carries what a fresh body must have", () => {
  const rootPkg = JSON.parse(read("package.json"));
  const pkg = JSON.parse(read(path.join(fixture, "package.json")));
  it("a root CLAUDE.md under 40 lines", () => {
    const text = read(path.join(fixture, "CLAUDE.md"));
    expect(text.split("\n").length).toBeLessThan(40);
  });
  it("every script body-ci's test job runs, and the themis bin", () => {
    const scripts = testRuns().map((r) => r.match(/^pnpm ([\w:-]+)$/)?.[1]).filter(Boolean);
    expect(scripts.length).toBeGreaterThanOrEqual(3);
    for (const s of [...scripts, "themis"]) expect(pkg.scripts?.[s], s).toBeTypeOf("string");
  });
  it("the toolchain body-ci reads from the body: packageManager and engines.node, at Themis's own", () => {
    expect(pkg.packageManager).toBe(rootPkg.packageManager);
    expect(pkg.engines?.node).toBe(rootPkg.engines.node);
  });
});

describe("the toolchain Themis runs (ADR 0023)", () => {
  const rootPkg = JSON.parse(read("package.json"));
  it("pins an exact pnpm 12 in packageManager", () => {
    expect(rootPkg.packageManager).toMatch(/^pnpm@12\.\d+\.\d+$/);
  });
  it("names Node 26 in engines.node, which setup-node reads", () => {
    expect(rootPkg.engines.node).toBe("^26");
    expect(JSON.parse(read("packages/themis/package.json")).engines.node).toBe(rootPkg.engines.node);
  });
});

describe("templates invoke only what exists", () => {
  const files = listFiles(templates);
  it("ships no pre-commit hook", () => {
    expect(files).not.toContain(".husky/pre-commit");
  });
  it.each(files.filter((f) => f.startsWith(".husky/")))("%s calls a themis hook verb that exists", (rel) => {
    const verbs = [...read(path.join(templates, rel)).matchAll(/themis hook (\S+)/g)].map((m) => m[1]);
    expect(verbs.length).toBeGreaterThan(0);
    for (const v of verbs) expect(HOOK_NAMES).toContain(v);
  });
  it.each(files.filter((f) => /\.ya?ml$/.test(f)))("%s uses only workflows and verbs that exist in Themis", (rel) => {
    const text = read(path.join(templates, rel));
    for (const [, file] of text.matchAll(/uses: vaoan\/Themis\/(\S+)@main/g)) expect(fs.existsSync(path.join(root, file)), file).toBe(true);
    for (const [, verb] of text.matchAll(/themis ci (\S+)/g)) expect(CI_VERBS).toContain(verb);
  });
});

describe("the template's ci.yml is the caller a body needs", () => {
  const yaml = read(path.join(templates, ".github/workflows/ci.yml"));
  const policy = loadPolicy();
  const callerJob = policy.bodyCheckPrefix.replace(/ \/ $/, "");
  it("starts with the shared-CI marker repo apply looks for", () => {
    expect(yaml.split("\n")[0]).toBe(policy.sharedCiMarker);
  });
  it("has one job, named as bodyCheckPrefix implies, calling body-ci with the permissions it needs and a database input", () => {
    expect(callerJob).toBe("ci");
    expect([...yaml.matchAll(/^  ([a-z-]+):$/gm)].map((m) => m[1]).filter((j) => j !== "pull_request" && j !== "push")).toEqual([callerJob]);
    expect(yaml).toContain(`\njobs:\n  ${callerJob}:\n    permissions: { contents: read, pull-requests: read, issues: read }\n    uses: vaoan/Themis/.github/workflows/body-ci.yml@main\n    with:\n`);
    expect(yaml).toMatch(/^      database: (true|false)$/m);
  });
  it("matches the example caller in body-ci.yml's header, job id included", () => {
    expect(bodyCi).toContain(`#   jobs:\n#     ${callerJob}:\n#       permissions: { contents: read, pull-requests: read, issues: read }\n#       uses: vaoan/Themis/.github/workflows/body-ci.yml@main\n`);
    expect(bodyCi).toContain(`\`${policy.bodyCheckPrefix}test\``);
  });
});
