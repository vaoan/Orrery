import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import bundle from "../src/commands/bundle.mjs";

const quiet = () => {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  return { out: () => [...log.mock.calls, ...error.mock.calls].flat().join("\n"), restore: () => { log.mockRestore(); error.mockRestore(); } };
};

const provenance = { date: "2026-09-09", a: { name: "aeleos", sha: "aaa1111" }, b: { name: "libra", sha: "bbb2222" } };
const row = (extra) => ({ tool: "eslint", surface: "source", key: "no-var", a: null, b: null, chosen: ["error"], test: "agree", tier: "physics", note: "", ...extra });

const packageDir = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-bundle-cmd-"));
  fs.mkdirSync(path.join(dir, "classes/next-supabase-mono"), { recursive: true });
  fs.writeFileSync(path.join(dir, "classes/next-supabase-mono/schema.mjs"), "export default {};");
  fs.writeFileSync(path.join(dir, "classes/next-supabase-mono/eslint.base.mjs"), "export default {};");
  return dir;
};

describe("orrery bundle", () => {
  it("exits 0 and lists every file it wrote", async () => {
    const q = quiet();
    const dir = packageDir();
    const rulings = path.join(dir, "rulings.json");
    fs.writeFileSync(rulings, JSON.stringify({ provenance, rows: [row({})] }));
    expect(await bundle(["--rulings", rulings, "--package", dir])).toBe(0);
    expect(q.out()).toContain("physics/eslint.mjs");
    expect(fs.existsSync(path.join(dir, "physics/eslint.mjs"))).toBe(true);
    fs.rmSync(dir, { recursive: true, force: true });
    q.restore();
  });

  // The residue refusal: a rulings file with an unresolved row is not something to bundle around.
  // Generating from it would ship a shared tier that quietly omits whatever nobody ruled on.
  it("exits 1 and refuses to write anything when a row is residue", async () => {
    const q = quiet();
    const dir = packageDir();
    const rulings = path.join(dir, "rulings.json");
    fs.writeFileSync(rulings, JSON.stringify({ provenance, rows: [row({}), row({ key: "unicorn/x", chosen: null, test: "residue", tier: "physics" })] }));
    expect(await bundle(["--rulings", rulings, "--package", dir])).toBe(1);
    expect(q.out()).toMatch(/carries 1 residue row\(s\); resolve them before bundling/);
    expect(fs.existsSync(path.join(dir, "physics/eslint.mjs"))).toBe(false);
    fs.rmSync(dir, { recursive: true, force: true });
    q.restore();
  });

  it("exits 1 when the rulings file cannot be read", async () => {
    const q = quiet();
    const dir = packageDir();
    expect(await bundle(["--rulings", path.join(dir, "nope.json"), "--package", dir])).toBe(1);
    expect(q.out().length).toBeGreaterThan(0);
    fs.rmSync(dir, { recursive: true, force: true });
    q.restore();
  });

  it("exits 2 on an unknown flag", async () => {
    const q = quiet();
    expect(await bundle(["--nonsense"])).toBe(2);
    expect(q.out()).toContain("usage: orrery bundle");
    q.restore();
  });
});
