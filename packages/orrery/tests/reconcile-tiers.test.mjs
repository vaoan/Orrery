import { describe, it, expect } from "vitest";
import { tierOf, TIER_BY_PLUGIN } from "../src/lib/reconcile/tiers.mjs";

describe("tierOf", () => {
  it.each([
    ["no-var", "physics"], ["@typescript-eslint/no-unused-vars", "physics"], ["sonarjs/cognitive-complexity", "physics"],
    ["unicorn/filename-case", "physics"], ["security/detect-object-injection", "physics"], ["unused-imports/no-unused-imports", "physics"],
    ["import/no-cycle", "class"], ["jsdoc/require-jsdoc", "physics"], ["tsdoc/syntax", "physics"], ["boundaries/dependencies", "class"],
    ["@next/next/no-img-element", "class"], ["react/jsx-key", "class"], ["react-hooks/exhaustive-deps", "class"], ["jsx-a11y/alt-text", "class"],
    ["better-tailwindcss/no-conflicting-classes", "class"], ["@tanstack/query/exhaustive-deps", "class"], ["i18next/no-literal-string", "class"],
    ["testing-library/no-node-access", "class"], ["playwright/no-skipped-test", "class"], ["vitest/no-focused-tests", "class"],
  ])("%s -> %s", (rule, tier) => { expect(tierOf(rule)).toBe(tier); });

  it("throws on an unknown plugin so nothing lands unplaced", () => {
    expect(() => tierOf("mystery/rule")).toThrow(/unknown plugin "mystery"/);
  });

  it("places boundaries in the class because the layout it names is the class's layout", () => {
    expect(TIER_BY_PLUGIN.boundaries).toBe("class");
  });
});
