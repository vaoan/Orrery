import { describe, it, expect } from "vitest";
import base from "../classes/next-supabase-mono/eslint.base.mjs";

const body = { boundaries: { elements: [], allow: [] } };
const root = "/repo";

describe("eslint.base.mjs globals", () => {
  it("gives script only the node globals (process, module, require, __dirname)", () => {
    const { languageOptions } = base("script", body, root);
    for (const key of ["process", "module", "require", "__dirname", "console"]) {
      expect(languageOptions.globals).toHaveProperty(key);
    }
    expect(languageOptions.globals).not.toHaveProperty("window");
  });

  it.each(["unit-test", "e2e"])("gives %s both node and browser globals", (surface) => {
    const { languageOptions } = base(surface, body, root);
    expect(languageOptions.globals).toHaveProperty("process");
    expect(languageOptions.globals).toHaveProperty("window");
    expect(languageOptions.globals).toHaveProperty("document");
  });

  // S1 (PR #31 review): no-undef is off on these three TS surfaces for both donors (rulings.json:
  // agree, chosen [0, ...]) — TypeScript's own type-checking catches undefined identifiers there,
  // not eslint, so there is no rule left on these surfaces to consume a globals declaration.
  it.each(["source", "component", "package"])("gives the type-aware surface %s no declared globals", (surface) => {
    const { languageOptions } = base(surface, body, root);
    expect(languageOptions.globals).not.toHaveProperty("process");
    expect(languageOptions.globals).not.toHaveProperty("window");
    expect(languageOptions.globals).not.toHaveProperty("document");
  });

  it("keeps the type-aware parser configuration for typescript surfaces", () => {
    const { languageOptions } = base("source", body, root);
    expect(languageOptions.parserOptions).toEqual({ projectService: true, tsconfigRootDir: root });
  });
});

describe("eslint.base.mjs STANDARD_ELEMENTS", () => {
  it("adds a generic package element for the package surface's boundaries settings", () => {
    const { settings } = base("package", body, root);
    expect(settings["boundaries/elements"]).toContainEqual({ type: "package", pattern: "packages/*/src", capture: ["package"] });
  });

  it("keeps body-supplied elements on top of the standard ones", () => {
    const extra = { type: "extra", pattern: "apps/*/src/extra/*" };
    const { settings } = base("source", { boundaries: { elements: [extra], allow: [] } }, root);
    expect(settings["boundaries/elements"]).toContainEqual(extra);
    expect(settings["boundaries/elements"]).toContainEqual({ type: "package", pattern: "packages/*/src", capture: ["package"] });
  });
});
