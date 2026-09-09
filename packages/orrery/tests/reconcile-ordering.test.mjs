import { describe, it, expect } from "vitest";
import { severityOf, optionsOf, stricter, PRE_RULINGS } from "../src/lib/reconcile/ordering.mjs";

describe("severityOf / optionsOf", () => {
  it("normalises numbers and strings and strips trailing empties and messages", () => {
    expect(severityOf(2)).toBe("error");
    expect(severityOf(["warn"])).toBe("warn");
    expect(optionsOf(["error", {}])).toEqual([]);
    expect(optionsOf(["error", { message: "x", object: "document" }])).toEqual([{ object: "document" }]);
    expect(optionsOf(["error", { patterns: [{ group: ["../*"], message: "no" }] }])).toEqual([{ patterns: [{ group: ["../*"] }] }]);
  });
});

describe("stricter: severity", () => {
  it("picks the higher severity when options agree", () => {
    expect(stricter("x", ["warn", { a: 1 }], ["error", { a: 1 }])).toEqual({ chosen: ["error", { a: 1 }], test: "strictest", note: "severity error over warn" });
  });
  it("treats off versus error as a severity flip, keeping the on side's options", () => {
    expect(stricter("sonarjs/deprecation", ["off"], ["error"]).chosen).toEqual(["error"]);
  });
});

describe("stricter: ordinal options", () => {
  it("takes the lower threshold and the higher severity independently", () => {
    const r = stricter("sonarjs/cyclomatic-complexity", ["off", { threshold: 10 }], ["error", { threshold: 15 }]);
    expect(r.chosen).toEqual(["error", { threshold: 10 }]);
    expect(r.test).toBe("strictest");
  });
  it("handles a positional ordinal option", () => {
    expect(stricter("sonarjs/cognitive-complexity", ["error", 20], ["error", 15]).chosen).toEqual(["error", 15]);
  });
  it("takes the lower maximum for max-lines family", () => {
    expect(stricter("sonarjs/max-lines", ["off", { maximum: 1000 }], ["error", { maximum: 400 }]).chosen).toEqual(["error", { maximum: 400 }]);
    expect(stricter("sonarjs/nested-control-flow", ["off", { maximumNestingLevel: 3 }], ["error", { maximumNestingLevel: 4 }]).chosen).toEqual(["error", { maximumNestingLevel: 3 }]);
  });
});

describe("stricter: exemptions", () => {
  it("prefers the side without exemption keys", () => {
    const r = stricter("@typescript-eslint/no-unused-vars", ["error"], ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }]);
    expect(r.chosen).toEqual(["error"]);
    expect(r.test).toBe("strictest");
    expect(r.note).toMatch(/no exemption/);
  });
  it("prefers allow-false over allow-true and drops an allow key one side lacks", () => {
    expect(stricter("x", ["error", { allowMultiline: true }], ["error"]).chosen).toEqual(["error"]);
    expect(stricter("x", ["error", { allowShortCircuit: true }], ["error", { allowShortCircuit: false }]).chosen).toEqual(["error", { allowShortCircuit: false }]);
  });
  it("prefers the side without a nested onlyIfContainsSeparator exemption", () => {
    const a = ["error", { hexadecimal: { minimumDigits: 0, groupLength: 2, onlyIfContainsSeparator: true } }];
    const b = ["error", { hexadecimal: { minimumDigits: 0, groupLength: 2 } }];
    expect(stricter("unicorn/numeric-separators-style", a, b).chosen).toEqual(b);
  });
});

describe("stricter: parameters", () => {
  it("marks project data as a parameter and keeps the stricter severity", () => {
    const r = stricter("better-tailwindcss/no-conflicting-classes", ["error"], ["error", { entryPoint: "apps/store/src/app/globals.css" }]);
    expect(r.chosen).toEqual(["error", { entryPoint: { parameter: "tailwind.entryPoint" } }]);
    expect(r.test).toBe("parameter");
  });
  it("splits no-restricted-imports into the universal pattern and alias parameters", () => {
    const a = ["error", { patterns: [{ group: ["../*"] }] }];
    const b = ["error", { patterns: [{ group: ["@ui/*"] }, { group: ["@shared/*"] }] }];
    const r = stricter("no-restricted-imports", a, b);
    expect(r.chosen).toEqual(["error", { patterns: [{ group: ["../*"] }, { parameter: "imports.restrictedPatterns" }] }]);
    expect(r.test).toBe("parameter");
  });
});

describe("stricter: pre-rulings and residue", () => {
  it("applies a pre-ruling for a non-ordinal tie", () => {
    const r = stricter("unicorn/number-literal-case", ["error", { hexadecimalValue: "lowercase" }], ["error", { hexadecimalValue: "uppercase" }]);
    expect(r.chosen).toEqual(["error", { hexadecimalValue: "uppercase" }]);
    expect(r.test).toBe("consistency");
  });
  it("returns residue when nothing decides", () => {
    const r = stricter("some/rule", ["error", { style: "a" }], ["error", { style: "b" }]);
    expect(r.chosen).toBeNull();
    expect(r.test).toBe("residue");
  });
  it("every pre-ruling names its test", () => {
    for (const [rule, ruling] of Object.entries(PRE_RULINGS)) {
      expect(["strictest", "consistency", "benefit", "parameter"]).toContain(ruling.test);
      expect(ruling.note.length, rule).toBeGreaterThan(10);
    }
  });
});
