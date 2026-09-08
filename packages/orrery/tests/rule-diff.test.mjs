import { describe, it, expect } from "vitest";
import { diffRules } from "../src/lib/rule-diff.mjs";

const cfg = (rules) => ({ rules });

describe("diffRules", () => {
  it("buckets an identical rule as agreeing", () => {
    const d = diffRules(cfg({ "no-var": ["error"] }), cfg({ "no-var": ["error"] }));
    expect(d.agree).toEqual(["no-var"]);
    expect(d.conflict).toEqual([]);
  });

  it("treats numeric and string severities as equal", () => {
    const d = diffRules(cfg({ "no-var": [2] }), cfg({ "no-var": ["error"] }));
    expect(d.agree).toEqual(["no-var"]);
  });

  it("buckets a rule only one side sets", () => {
    const d = diffRules(cfg({ "no-var": ["error"] }), cfg({}));
    expect(d.onlyA).toEqual(["no-var"]);
    expect(d.onlyB).toEqual([]);
  });

  it("buckets differing severities as a conflict carrying both values", () => {
    const d = diffRules(cfg({ "no-var": ["error"] }), cfg({ "no-var": ["warn"] }));
    expect(d.conflict).toEqual([{ rule: "no-var", a: ["error"], b: ["warn"] }]);
  });

  it("treats differing options at equal severity as a conflict", () => {
    const a = cfg({ "unicorn/filename-case": ["error", { case: "kebabCase" }] });
    const b = cfg({ "unicorn/filename-case": ["error", { case: "camelCase" }] });
    expect(diffRules(a, b).conflict).toHaveLength(1);
  });

  it("ignores key order inside options", () => {
    const a = cfg({ r: ["error", { x: 1, y: 2 }] });
    const b = cfg({ r: ["error", { y: 2, x: 1 }] });
    expect(diffRules(a, b).agree).toEqual(["r"]);
  });

  it("treats a rule switched off on one side as a conflict, not agreement", () => {
    const d = diffRules(cfg({ "no-var": ["off"] }), cfg({ "no-var": ["error"] }));
    expect(d.conflict).toHaveLength(1);
    expect(d.agree).toEqual([]);
  });

  it("returns empty buckets for two empty configs", () => {
    expect(diffRules(cfg({}), cfg({}))).toEqual({ agree: [], onlyA: [], onlyB: [], conflict: [] });
  });

  it("sorts every bucket so output is stable across runs", () => {
    const d = diffRules(cfg({ b: ["error"], a: ["error"] }), cfg({ a: ["error"], b: ["error"] }));
    expect(d.agree).toEqual(["a", "b"]);
  });

  it("treats trailing empty options object as equivalent to omitted options", () => {
    const d = diffRules(cfg({ r: ["error"] }), cfg({ r: ["error", {}] }));
    expect(d.agree).toEqual(["r"]);
    expect(d.conflict).toEqual([]);
  });

  it("strips multiple trailing empty options objects", () => {
    const d = diffRules(cfg({ r: ["error", {}, {}] }), cfg({ r: ["error"] }));
    expect(d.agree).toEqual(["r"]);
    expect(d.conflict).toEqual([]);
  });

  it("treats non-empty options object as different from omitted options", () => {
    const d = diffRules(cfg({ r: ["error", { a: 1 }] }), cfg({ r: ["error"] }));
    expect(d.conflict).toHaveLength(1);
    expect(d.agree).toEqual([]);
  });

  it("treats empty array in options as different from omitted options", () => {
    const d = diffRules(cfg({ r: ["error", []] }), cfg({ r: ["error"] }));
    expect(d.conflict).toHaveLength(1);
    expect(d.agree).toEqual([]);
  });

  it("ignores key order in nested objects multiple levels deep", () => {
    const a = cfg({ r: ["error", { outer: { y: 2, x: 1 }, list: [{ b: 1, a: 2 }] }] });
    const b = cfg({ r: ["error", { outer: { x: 1, y: 2 }, list: [{ a: 2, b: 1 }] }] });
    expect(diffRules(a, b).agree).toEqual(["r"]);
  });

  it("treats different array order in nested options as a conflict", () => {
    const a = cfg({ r: ["error", [1, 2]] });
    const b = cfg({ r: ["error", [2, 1]] });
    const d = diffRules(a, b);
    expect(d.conflict).toHaveLength(1);
    expect(d.agree).toEqual([]);
  });
});
