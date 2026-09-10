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

  it("leaves ordinary option keys named union, fromSide or parameter untouched", () => {
    const a = { source: cfg({ "unicorn/x": ["error", { union: ["a", "b"], fromSide: "left", parameter: 1, other: 2 }] }) };
    const b = { source: cfg({ "unicorn/x": ["warn", { union: ["a", "b"], fromSide: "left", parameter: 1, other: 2 }] }) };
    expect(() => reconcileEslint(a, b)).not.toThrow();
    const [r] = reconcileEslint(a, b);
    expect(r.chosen).toEqual(["error", { union: ["a", "b"], fromSide: "left", parameter: 1, other: 2 }]);
    expect(r.test).toBe("strictest");
  });

  describe("a pre-ruled key's adopt rows", () => {
    it("takes the pre-ruling's resolved options from the first conflict surface, keeping its own severity and test", () => {
      const a = { component: cfg({ "i18next/no-literal-string": [2, { mode: "jsx-text-only", "jsx-attributes": { include: ["alt", "title"] } }] }) };
      const b = {
        component: cfg({ "i18next/no-literal-string": [2, { mode: "all", "jsx-attributes": { include: ["alt", "label"] }, ignoreAttribute: ["className"], words: { exclude: ["y"] } }] }),
        source: cfg({ "i18next/no-literal-string": [2, { mode: "all", ignoreAttribute: ["className"], words: { exclude: ["y"] }, callees: { exclude: ["z"] } }] }),
      };
      const rows = reconcileEslint(a, b);
      const component = rows.find((r) => r.surface === "component" && r.key === "i18next/no-literal-string");
      const source = rows.find((r) => r.surface === "source" && r.key === "i18next/no-literal-string");
      expect(component.test).toBe("benefit");
      expect(source.test).toBe("benefit");
      expect(source.chosen[0]).toBe("error");
      expect(source.chosen.slice(1)).toEqual(component.chosen.slice(1));
      expect(source.chosen[1]).not.toHaveProperty("callees");
      expect(source.note).toMatch(/one-sided on this surface, options from the class ruling$/);
    });

    it("stays a plain adopt row outside a surface-restricted pre-ruling's declared surfaces", () => {
      const a = { source: cfg({ "no-restricted-syntax": [2, { selector: "Foo", message: "bar" }] }) };
      const b = { source: cfg({}) };
      const [r] = reconcileEslint(a, b);
      expect(r.test).toBe("adopt");
      expect(r.chosen).toEqual([2, { selector: "Foo", message: "bar" }]);
    });

    it("resolves markers against its own two sides when the rule never conflicts anywhere, unioning against the absent side's empty list", () => {
      const a = { package: cfg({ "sonarjs/no-duplicate-string": [2, { threshold: 3, ignoreStrings: "abc" }] }) };
      const b = {};
      const [r] = reconcileEslint(a, b);
      expect(r.test).toBe("benefit");
      expect(r.chosen).toEqual(["error", { threshold: 2, ignoreStrings: "abc" }]);
    });

    it("falls back to the present side's own value when a fromSide marker points at the absent side", () => {
      const a = { source: cfg({ "i18next/no-literal-string": [2, { mode: "all", ignoreAttribute: ["className"] }] }) };
      const b = {};
      const [r] = reconcileEslint(a, b);
      expect(r.chosen[1].ignoreAttribute).toEqual(["className"]);
    });

    // S6: the pre-ruling is restricted to source/component/package; on script it never applies,
    // so a one-sided rule is adopted verbatim, the same as any other rule with no pre-ruling.
    it("does not apply the i18next pre-ruling on script; the present side's bare value is adopted verbatim", () => {
      const a = {};
      const b = { script: cfg({ "i18next/no-literal-string": [2] }) };
      const [r] = reconcileEslint(a, b);
      expect(r.test).toBe("adopt");
      expect(r.chosen).toEqual([2]);
    });

    it("omits a fromSide key neither side has, rather than emitting null", () => {
      const a = { package: cfg({ "i18next/no-literal-string": [2, { mode: "all" }] }) };
      const b = {};
      const [r] = reconcileEslint(a, b);
      expect(r.chosen[1]).not.toHaveProperty("ignoreAttribute");
      expect(r.chosen[1]["jsx-attributes"]).toEqual({ include: [] });
      expect(r.chosen[1]).not.toHaveProperty("callees");
    });
  });

  describe("lost RegExp detection", () => {
    it("turns a row whose options still hold a RegExp lost by --print-config into residue", () => {
      const a = { source: cfg({ "unicorn/fake-rule": [2, { exclude: [{}, "x"] }] }) };
      const b = {};
      const [r] = reconcileEslint(a, b);
      expect(r.test).toBe("residue");
      expect(r.chosen).toBeNull();
      expect(r.note).toBe("an option holds a RegExp that --print-config serialises as {}; needs a pre-ruling");
    });

    it("does not flag a bare empty options object", () => {
      const a = { source: cfg({ "unicorn/fake-rule": [2, {}] }) };
      const b = {};
      const [r] = reconcileEslint(a, b);
      expect(r.test).toBe("adopt");
      expect(r.chosen).toEqual([2, {}]);
    });
  });
});
