import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import base from "../classes/next-supabase-mono/eslint.base.mjs";
import eslintConfig from "../classes/next-supabase-mono/eslint.mjs";

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

// I6: "the body has no eslint.local.mjs" is a question for the filesystem, not for the module
// loader. ERR_MODULE_NOT_FOUND is also what a LOCAL FILE that imports something missing throws, so
// catching it by code reported a broken local override as an absent one — lint carried on without
// the body's own rules and said nothing.
describe("the generated class config's loadLocal", () => {
  const body = { class: "next-supabase-mono", tailwind: { entryPoint: "apps/web/src/app/globals.css" } };
  let dir;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-local-")); });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it("returns no extra blocks when the body has no eslint.local.mjs", async () => {
    const blocks = await eslintConfig({ ...body, root: dir });
    expect(blocks.some((b) => b?.name === "local-probe")).toBe(false);
  });

  it("appends the body's own local blocks last when it has one", async () => {
    fs.writeFileSync(path.join(dir, "eslint.local.mjs"), 'export default [{ name: "local-probe", files: ["x.ts"], rules: {} }];\n');
    const blocks = await eslintConfig({ ...body, root: dir });
    expect(blocks.at(-1).name).toBe("local-probe");
  });

  it("propagates an import error from inside the body's own local file", async () => {
    fs.writeFileSync(path.join(dir, "eslint.local.mjs"), 'import "./definitely-not-here.mjs";\nexport default [];\n');
    await expect(eslintConfig({ ...body, root: dir })).rejects.toThrow();
  });
});
