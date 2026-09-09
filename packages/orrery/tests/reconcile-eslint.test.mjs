import { describe, it, expect } from "vitest";
import { reconcileEslint } from "../src/lib/reconcile/eslint.mjs";

const cfg = (rules) => ({ rules });

describe("reconcileEslint", () => {
  it("emits one row per surface and rule with the deciding test", () => {
    const a = { source: cfg({ "no-var": ["error"], "sonarjs/cognitive-complexity": ["error", 20], "jsdoc/require-jsdoc": ["error"], "@stylistic/semi": ["off"] }) };
    const b = { source: cfg({ "no-var": [2], "sonarjs/cognitive-complexity": ["error", 15], "react/jsx-key": ["error"] }) };
    const rows = reconcileEslint(a, b);
    const by = Object.fromEntries(rows.map((r) => [r.key, r]));
    expect(by["no-var"]).toMatchObject({ surface: "source", test: "agree", chosen: ["error"], tier: "physics" });
    expect(by["sonarjs/cognitive-complexity"]).toMatchObject({ test: "strictest", chosen: ["error", 15], tier: "physics" });
    expect(by["jsdoc/require-jsdoc"]).toMatchObject({ test: "adopt", chosen: ["error"], tier: "physics", a: ["error"], b: null });
    expect(by["react/jsx-key"]).toMatchObject({ test: "adopt", chosen: ["error"], tier: "class" });
    expect(by["@stylistic/semi"]).toMatchObject({ test: "inert", chosen: null, tier: null });
  });

  it("keeps surfaces separate", () => {
    const a = { source: cfg({ "no-var": ["error"] }), "unit-test": cfg({ "no-var": ["off"] }) };
    const b = { source: cfg({ "no-var": ["error"] }), "unit-test": cfg({ "no-var": ["error"] }) };
    const rows = reconcileEslint(a, b);
    expect(rows.filter((r) => r.key === "no-var").map((r) => [r.surface, r.test])).toEqual([["source", "agree"], ["unit-test", "strictest"]]);
  });

  it("is sorted by surface order then rule name so output is stable", () => {
    const a = { "unit-test": cfg({ b: ["error"] }), source: cfg({ z: ["error"], a: ["error"] }) };
    const b = { "unit-test": cfg({ b: ["error"] }), source: cfg({ z: ["error"], a: ["error"] }) };
    expect(reconcileEslint(a, b).map((r) => `${r.surface}:${r.key}`)).toEqual(["source:a", "source:z", "unit-test:b"]);
  });

  it("marks residue rows with tier still assigned", () => {
    const a = { source: cfg({ "some/x": ["error", { style: "a" }] }) };
    const b = { source: cfg({ "some/x": ["error", { style: "b" }] }) };
    expect(() => reconcileEslint(a, b)).toThrow(/unknown plugin "some"/);
    const rows = reconcileEslint({ source: cfg({ "unicorn/x": ["error", { style: "a" }] }) }, { source: cfg({ "unicorn/x": ["error", { style: "b" }] }) });
    expect(rows[0]).toMatchObject({ test: "residue", chosen: null, tier: "physics" });
  });

  it("resolves union and fromSide markers from the pre-rulings against both sides' options", () => {
    const a = { source: cfg({ "sonarjs/no-duplicate-string": [0, { threshold: 3, ignoreStrings: "application/json" }] }) };
    const b = { source: cfg({ "sonarjs/no-duplicate-string": [2, { threshold: 2, ignoreStrings: "var\\(--x\\)|text-[a-z-]+" }] }) };
    const [r] = reconcileEslint(a, b);
    expect(r.chosen).toEqual(["error", { threshold: 2, ignoreStrings: "application/json|text-[a-z-]+|var\\(--x\\)" }]);
    expect(r.test).toBe("benefit");
  });
});
