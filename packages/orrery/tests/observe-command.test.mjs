import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import observe from "../src/commands/observe.mjs";

const quiet = () => { const log = vi.spyOn(console, "log").mockImplementation(() => {}); const error = vi.spyOn(console, "error").mockImplementation(() => {}); return { out: () => [...log.mock.calls, ...error.mock.calls].flat().join("\n"), restore: () => { log.mockRestore(); error.mockRestore(); } }; };

const fakeDeps = (overrides = {}) => ({
  findSurfaceSamples: () => ({ source: "a.ts" }),
  readEffectiveConfig: () => ({ rules: {} }),
  versionDrift: () => ({ installed: null, latest: "abc", behind: false, note: "not yet" }),
  pointerDrift: async () => ({ files: [{ path: "eslint.config.mjs", state: "missing" }], local: [], config: ["missing"] }),
  codeDrift: async () => ({ eslint: { mismatches: [], violations: { "no-var": 2 }, comparison: { unexplained: [], moved: [], newRules: [], resolved: [] } } }),
  loadRulings: () => ({ provenance: {}, rows: [] }),
  loadPrediction: () => ({ tightened: ["no-var"], counts: { "no-var": 2 } }),
  writePrediction: vi.fn(),
  ...overrides,
});

describe("orrery observe", () => {
  it("exits 2 without a body", async () => {
    const q = quiet();
    expect(await observe([])).toBe(2);
    expect(q.out()).toContain("usage: orrery observe <bodyDir>...");
    q.restore();
  });

  it("writes a report and exits 0 when nothing is unexplained", async () => {
    const q = quiet();
    const report = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-obs-"));
    const code = await observe(["Z:/Github/x", "--report", report], fakeDeps());
    expect(code).toBe(0);
    const files = fs.readdirSync(report);
    expect(files.some((f) => f.endsWith("-tooling.md"))).toBe(true);
    expect(files.some((f) => f.endsWith("-tooling.json"))).toBe(true);
    expect(fs.readFileSync(path.join(report, files.find((f) => f.endsWith("-tooling.md"))), "utf8")).toContain("| no-var | 2 |");
    fs.rmSync(report, { recursive: true, force: true });
    q.restore();
  });

  it("exits 1 when a rule violation is unexplained by the prediction or the effective config mismatches", async () => {
    const q = quiet();
    const report = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-obs-"));
    // The command computes the comparison itself from the violations: react/x is not in the prediction's tightened set.
    const code = await observe(["Z:/Github/x", "--report", report], fakeDeps({ codeDrift: async () => ({ eslint: { mismatches: ["no-var: missing"], violations: { "react/x": 3 } } }) }));
    expect(code).toBe(1);
    expect(q.out()).toMatch(/mismatch.*no-var: missing/s);
    expect(q.out()).toMatch(/unexplained.*react\/x/s);
    fs.rmSync(report, { recursive: true, force: true });
    q.restore();
  });

  it("with --predict writes the prediction from the observed violations and does not compare", async () => {
    const q = quiet();
    const deps = fakeDeps({ loadPrediction: () => null });
    const report = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-obs-"));
    expect(await observe(["Z:/Github/x", "--predict", "--report", report], deps)).toBe(0);
    expect(deps.writePrediction).toHaveBeenCalledWith("x", expect.objectContaining({ tightened: expect.any(Array), counts: { "no-var": 2 } }));
    fs.rmSync(report, { recursive: true, force: true });
    q.restore();
  });

  it("without a prediction and without --predict exits 1 saying so", async () => {
    const q = quiet();
    const report = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-obs-"));
    expect(await observe(["Z:/Github/x", "--report", report], fakeDeps({ loadPrediction: () => null }))).toBe(1);
    expect(q.out()).toMatch(/no prediction for x; run with --predict/);
    fs.rmSync(report, { recursive: true, force: true });
    q.restore();
  });
});
