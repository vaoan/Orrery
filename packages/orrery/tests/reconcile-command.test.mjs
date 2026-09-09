import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import reconcile from "../src/commands/reconcile.mjs";

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
});
