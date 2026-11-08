import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import reconcile from "../src/commands/reconcile.mjs";
import { hasLostRegExp } from "../src/lib/reconcile/eslint.mjs";
import { isEmptyObject, namesProject } from "../src/lib/reconcile/ordering.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

const quiet = () => {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  return { out: () => [...log.mock.calls, ...error.mock.calls].flat().join("\n"), restore: () => { log.mockRestore(); error.mockRestore(); } };
};

const donor = (name, rules) => ({ dir: `/${name}`, sha: name.slice(0, 7), eslint: { source: { rules } }, tsconfig: { compilerOptions: { strict: true } }, stylelint: null, prettier: { endOfLine: "auto" }, secretlint: null, jscpd: null, cspell: null, knip: null, syncpack: null, lintStaged: null, lsLint: null, hooks: { preCommit: null, prePush: null } });

describe("orrery reconcile", () => {
  it("exits 2 without two repositories", async () => {
    const q = quiet();
    expect(await reconcile(["only"])).toBe(2);
    expect(q.out()).toContain("usage: orrery reconcile <repoA> <repoB>");
    q.restore();
  });

  it("writes rulings.json and one record per tool, and exits 0 with no residue", async () => {
    const q = quiet();
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-rec-"));
    const code = await reconcile(["/a", "/b", "--out", out], {
      findSurfaceSamples: () => ({ source: "x.ts" }),
      readDonor: async (dir) => donor(dir === "/a" ? "aeleos1" : "libra11", { "no-var": ["error"] }),
    });
    expect(code).toBe(0);
    const rulings = JSON.parse(fs.readFileSync(path.join(out, "rulings.json"), "utf8"));
    expect(rulings.provenance.a.sha).toBe("aeleos1");
    expect(rulings.rows.some((r) => r.tool === "eslint" && r.key === "no-var" && r.test === "agree")).toBe(true);
    expect(fs.existsSync(path.join(out, "0004-eslint.md"))).toBe(true);
    expect(fs.existsSync(path.join(out, "0005-tsconfig.md"))).toBe(true);
    expect(q.out()).toMatch(/eslint\s+agree 1/);
    fs.rmSync(out, { recursive: true, force: true });
    q.restore();
  });

  it("exits 1 and names every residue row", async () => {
    const q = quiet();
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-rec-"));
    const code = await reconcile(["/a", "/b", "--out", out], {
      findSurfaceSamples: () => ({ source: "x.ts" }),
      readDonor: async (dir) => donor(dir, { "unicorn/x": ["error", { style: dir === "/a" ? "a" : "b" }] }),
    });
    expect(code).toBe(1);
    expect(q.out()).toMatch(/residue.*eslint source unicorn\/x/s);
    fs.rmSync(out, { recursive: true, force: true });
    q.restore();
  });

  it("passes --sample overrides through", async () => {
    const q = quiet();
    let seen;
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-rec-"));
    await reconcile(["/a", "/b", "--out", out, "--sample", "source=custom.ts", "--sample", "e2e=e.spec.ts"], {
      findSurfaceSamples: (dir, overrides) => { seen = overrides; return { source: "custom.ts" }; },
      readDonor: async (dir) => donor(dir, {}),
    });
    expect(seen).toEqual({ source: "custom.ts", e2e: "e.spec.ts" });
    fs.rmSync(out, { recursive: true, force: true });
    q.restore();
  });

  it("guards the committed rulings.json: no eslint row's chosen options hold a RegExp lost by --print-config", () => {
    const rulings = JSON.parse(fs.readFileSync(path.join(root, "docs/decisions/rulings.json"), "utf8"));
    // The detector itself is the one reconcileEslint uses, imported rather than restated: a guard
    // that re-implements what it guards can only ever prove its own copy right.
    expect(isEmptyObject({})).toBe(true);
    const offenders = rulings.rows.filter((r) => r.tool === "eslint" && hasLostRegExp(r.chosen)).map((r) => `${r.surface} ${r.key}`);
    expect(offenders).toEqual([]);
  });

  // C3, the permanent guard for the one rule: nothing in `physics/` may name a path, a file, an
  // alias or a project convention, because physics must be true for a repository that does not
  // exist yet. The token list is `namesProject`'s (src/lib/reconcile/ordering.mjs): a path
  // separator, a source-file extension, `@/`, or `.claude`, with purely relative specifiers
  // (`../*`) stripped first because a parent-relative ban names a shape and not a project.
  //
  // Three rows carry a token and are not a project reference. Each is named here with why, so the
  // exemption is a decision and not a hole, and an exemption that stops being needed shows up as a
  // failure of its own:
  const EXEMPT = new Map([
    ["eslint sonarjs/no-duplicate-string", "the MIME type application/json and the CSS/Tailwind class patterns in ignoreStrings are machine strings, not paths"],
    ["secretlint rules", "an npm package id (@secretlint/secretlint-rule-preset-recommend), not a path in a repository"],
    ["ls-lint ls", "a workspace directory layout of globs (apps/*/src, packages/*/tests) that names no project's files"],
  ]);

  it("guards the committed rulings.json: no physics row names a path, a file, an alias or a project convention", () => {
    const rulings = JSON.parse(fs.readFileSync(path.join(root, "docs/decisions/rulings.json"), "utf8"));
    const flagged = rulings.rows.filter((r) => r.tier === "physics" && r.chosen !== null && namesProject(r.chosen));
    const offenders = [...new Set(flagged.map((r) => `${r.tool} ${r.key}`))].filter((k) => !EXEMPT.has(k));
    expect(offenders, "a physics row carrying a project token; parameterise it or record an exemption with its reason").toEqual([]);
  });

  it("keeps every physics-token exemption earning its place", () => {
    const rulings = JSON.parse(fs.readFileSync(path.join(root, "docs/decisions/rulings.json"), "utf8"));
    const flagged = new Set(rulings.rows.filter((r) => r.tier === "physics" && r.chosen !== null && namesProject(r.chosen)).map((r) => `${r.tool} ${r.key}`));
    const stale = [...EXEMPT.keys()].filter((k) => !flagged.has(k));
    expect(stale, "an exemption no row needs any more; delete it").toEqual([]);
  });

  // C4, the spec's CI section: "No rule ever ships at warn."
  it("guards the committed rulings.json: no eslint row ships at warn", () => {
    const rulings = JSON.parse(fs.readFileSync(path.join(root, "docs/decisions/rulings.json"), "utf8"));
    const warned = rulings.rows
      .filter((r) => r.tool === "eslint" && Array.isArray(r.chosen) && (r.chosen[0] === "warn" || r.chosen[0] === 1))
      .map((r) => `${r.surface} ${r.key}`);
    expect(warned).toEqual([]);
  });
});
