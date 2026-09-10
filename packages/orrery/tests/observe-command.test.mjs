import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import observe from "../src/commands/observe.mjs";

// Cross-platform, and its basename is literally "x" (what every assertion below expects the
// command to derive) — a hard-coded "Z:/..." string is not absolute on the Linux CI runner, and
// path.basename on it there would not give "x" the way it does on Windows.
const FAKE_BODY = path.resolve("x");

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
    const code = await observe([FAKE_BODY, "--report", report], fakeDeps());
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
    const code = await observe([FAKE_BODY, "--report", report], fakeDeps({ codeDrift: async () => ({ eslint: { mismatches: ["no-var: missing"], violations: { "react/x": 3 } } }) }));
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
    expect(await observe([FAKE_BODY, "--predict", "--report", report], deps)).toBe(0);
    expect(deps.writePrediction).toHaveBeenCalledWith("x", expect.objectContaining({ tightened: expect.any(Array), counts: { "no-var": 2 } }));
    fs.rmSync(report, { recursive: true, force: true });
    q.restore();
  });

  it("without a prediction and without --predict exits 1 saying so", async () => {
    const q = quiet();
    const report = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-obs-"));
    expect(await observe([FAKE_BODY, "--report", report], fakeDeps({ loadPrediction: () => null }))).toBe(1);
    expect(q.out()).toMatch(/no prediction for x; run with --predict/);
    fs.rmSync(report, { recursive: true, force: true });
    q.restore();
  });

  // F2: codeDrift catches a tool crash per tool (tested directly in observe-code.test.mjs); the
  // command must still surface it — fail the exit code, print which tool crashed and why, and
  // write the report regardless, with the other tools' results intact.
  it("exits 1 and still writes the report when a tool crashed, with the other tools' results present", async () => {
    const q = quiet();
    const report = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-obs-"));
    const code = await observe(
      [FAKE_BODY, "--report", report],
      fakeDeps({ codeDrift: async () => ({ eslint: { crashed: true, message: "boom" }, stylelint: { count: 0 } }) })
    );
    expect(code).toBe(1);
    expect(q.out()).toMatch(/x: eslint crashed: boom/);
    const files = fs.readdirSync(report);
    const reportFile = files.find((f) => f.endsWith("-tooling.json"));
    expect(reportFile).toBeTruthy();
    const written = JSON.parse(fs.readFileSync(path.join(report, reportFile), "utf8"));
    expect(written[0].code.eslint).toEqual({ crashed: true, message: "boom" });
    expect(written[0].code.stylelint).toEqual({ count: 0 });
    const md = fs.readFileSync(path.join(report, files.find((f) => f.endsWith("-tooling.md"))), "utf8");
    expect(md).toContain("eslint: crashed — boom");
    fs.rmSync(report, { recursive: true, force: true });
    q.restore();
  });
});
