import { describe, it, expect } from "vitest";
import { renderRecord, RECORD_NUMBERS } from "../src/lib/records.mjs";

const provenance = { date: "2026-09-09", a: { name: "aeleos", dir: "Z:/Github/aeleos", sha: "aaa1111", samples: { source: "a.ts" } }, b: { name: "libra", dir: "Z:/Github/libra", sha: "bbb2222", samples: { source: "b.ts" } } };

describe("renderRecord", () => {
  const rows = [
    { tool: "eslint", surface: "source", key: "no-var", a: ["error"], b: [2], chosen: ["error"], test: "agree", tier: "physics", note: "" },
    { tool: "eslint", surface: "source", key: "sonarjs/max-lines", a: [0, { maximum: 1000 }], b: [2, { maximum: 400 }], chosen: ["error", { maximum: 400 }], test: "strictest", tier: "physics", note: "maximum 400 is the lower bound" },
    { tool: "eslint", surface: "source", key: "@stylistic/semi", a: ["off"], b: null, chosen: null, test: "inert", tier: null, note: "" },
    { tool: "eslint", surface: "unit-test", key: "x/y", a: ["error", { s: 1 }], b: ["error", { s: 2 }], chosen: null, test: "residue", tier: "physics", note: "needs a ruling" },
  ];
  const md = renderRecord({ number: 4, tool: "eslint", rows, provenance });

  it("has the ADR header, provenance and counts", () => {
    expect(md).toMatch(/^# ADR 0004 — eslint reconciliation/);
    expect(md).toContain("**Status:** accepted");
    expect(md).toContain("aeleos `aaa1111`");
    expect(md).toContain("| agree | 1 |");
    expect(md).toContain("| residue | 1 |");
  });

  it("has one table per surface with the two values, the ruling and the test", () => {
    expect(md).toContain("## source");
    expect(md).toContain("| `sonarjs/max-lines` | `[0,{\"maximum\":1000}]` | `[2,{\"maximum\":400}]` | `[\"error\",{\"maximum\":400}]` | strictest | physics | maximum 400 is the lower bound |");
    expect(md).not.toContain("## unit-test\n\n| key");
  });

  it("lists inert rules compactly and residue under its own heading", () => {
    expect(md).toContain("## Inert (off on one side, absent on the other)");
    expect(md).toContain("`@stylistic/semi`");
    expect(md).toContain("## Residue — needs a ruling");
    expect(md).toContain("`x/y`");
  });

  it("numbers every tool", () => {
    expect(RECORD_NUMBERS.eslint).toBe(4);
    expect(Object.keys(RECORD_NUMBERS)).toHaveLength(12);
  });
});
