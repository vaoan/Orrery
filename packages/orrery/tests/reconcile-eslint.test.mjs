import { describe, it, expect } from "vitest";
import { reconcileEslint, resolveMarkers, withoutElementType } from "../src/lib/reconcile/eslint.mjs";
import { literal } from "../src/lib/bundle/eslint.mjs";
import { assertMarker } from "../src/lib/markers.mjs";

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

  // C4 — the spec's CI section: "No rule ever ships at warn." Whichever test decided the row, a
  // decided severity of warn becomes error. An inert row has no severity to lift.
  describe("no rule ships at warn", () => {
    it("lifts a rule both donors agree to run at warn", () => {
      const a = { source: cfg({ "no-console": ["warn"] }) };
      const b = { source: cfg({ "no-console": [1] }) };
      const [r] = reconcileEslint(a, b);
      expect(r.chosen).toEqual(["error"]);
      expect(r.test).toBe("strictest");
      expect(r.note).toContain("no rule ships at warn (spec)");
    });

    it("lifts a rule adopted at warn from one donor, options and all", () => {
      const a = { source: cfg({ "sonarjs/max-lines": [1, { maximum: 400 }] }) };
      const b = {};
      const [r] = reconcileEslint(a, b);
      expect(r.chosen).toEqual(["error", { maximum: 400 }]);
      expect(r.test).toBe("strictest");
      expect(r.note).toContain("no rule ships at warn (spec)");
    });

    it("leaves an off rule and an inert row alone", () => {
      const a = { source: cfg({ "no-console": ["off"], "unicorn/x": ["off"] }) };
      const b = { source: cfg({ "no-console": ["off"] }) };
      const rows = reconcileEslint(a, b);
      const by = Object.fromEntries(rows.map((r) => [r.key, r]));
      expect(by["no-console"].chosen).toEqual(["off"]);
      expect(by["unicorn/x"]).toMatchObject({ test: "inert", chosen: null });
    });
  });

  // C2: the boundaries base is a value in the row, not an attribute nobody reads.
  describe("boundaries/dependencies renders aeleos's policy as the base", () => {
    const aeleosRules = [
      { from: { type: "app" }, allow: { to: { type: ["app", "shared", "identity"] } } },
      { from: { type: "shared" }, allow: { to: [{ type: "shared" }, { type: "identity" }] } },
      { from: { type: "identity" }, allow: { to: { type: "identity" } } },
    ];
    const a = { source: cfg({ "boundaries/dependencies": [2, { default: "disallow", rules: aeleosRules }] }) };
    const b = { source: cfg({ "boundaries/dependencies": [2, { default: "disallow", rules: [{ from: { type: "feature" }, allow: { to: { type: ["shared"] } } }] }] }) };

    it("puts the base rules in the row's own chosen, identity lifted out, body edges last", () => {
      const [r] = reconcileEslint(a, b);
      expect(r.test).toBe("parameter");
      expect(r.chosen[1].rules).toEqual([
        { from: { type: "app" }, allow: { to: { type: ["app", "shared"] } } },
        { from: { type: "shared" }, allow: { to: [{ type: "shared" }] } },
        { $parameter: "boundaries.allow" },
      ]);
    });

    it("renders as a spread of the base followed by the body's own edges", () => {
      const [r] = reconcileEslint(a, b);
      expect(literal(r.chosen)).toContain("...body.boundaries.allow");
      expect(literal(r.chosen)).toContain('"from": { "type": "app" }');
    });
  });

  describe("withoutElementType", () => {
    it("drops a rule whose from names only that type and narrows every to that mentions it", () => {
      expect(withoutElementType([
        { from: { type: "identity" }, allow: { to: { type: "identity" } } },
        { from: { type: "app" }, allow: { to: { type: ["app", "identity"] } } },
        { from: { type: "app" }, allow: { to: { type: "identity" } } },
        { from: { type: ["app", "identity"] }, allow: { to: { type: ["shared"] } } },
      ], "identity")).toEqual([
        { from: { type: "app" }, allow: { to: { type: ["app"] } } },
        { from: { type: ["app"] }, allow: { to: { type: ["shared"] } } },
      ]);
    });

    it("returns a non-array unchanged", () => {
      expect(withoutElementType(undefined, "identity")).toBeUndefined();
    });
  });

  // C2/I5: a marker attribute nobody implements used to be dropped in silence — which is exactly
  // how `{ $parameter: "boundaries.allow", base: "a" }` shipped a policy with no base at all.
  describe("unknown marker attributes throw", () => {
    it("assertMarker names the attribute", () => {
      expect(() => assertMarker({ $parameter: "x", base: "a" })).toThrow(/base/);
      expect(() => assertMarker({ $parameter: "x", base: "a" })).toThrow(/\$parameter/);
    });

    it("throws on an unknown marker key", () => {
      expect(() => assertMarker({ $whatever: "x" })).toThrow(/unknown marker/);
    });

    it("accepts the markers and attributes that are implemented", () => {
      expect(assertMarker({ $parameter: "a.b" })).toBe("$parameter");
      expect(assertMarker({ $union: "k", join: "|" })).toBe("$union");
      expect(assertMarker({ $fromSide: "a", withoutElementType: "identity" })).toBe("$fromSide");
      expect(assertMarker({ selector: "X" })).toBeNull();
    });

    it("resolveMarkers throws", () => {
      expect(() => resolveMarkers(["error", { x: { $parameter: "x", base: "a" } }], [], [])).toThrow(/base/);
    });

    it("literal throws", () => {
      expect(() => literal(["error", { $parameter: "x", base: "a" }])).toThrow(/base/);
    });
  });
});
