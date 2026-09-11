// C1: every generated tool file must be usable BY ITS OWN TOOL. The bundle tests next door prove
// the generator renders what the rulings say; they cannot see that the rendered shape is one the
// tool refuses — a `prettier` pointer that resolves to a function, a lint-staged key split on its
// own "." into a nested object, a syncpack `versionGroups` object where the schema says array.
// Each case here hands the committed generated output to the tool's own loader or validator, or
// (where a tool exposes neither) to the exact structural contract its documentation states.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import prettierApi from "prettier";
import stylelintApi from "stylelint";

import prettierConfig from "../physics/prettier.mjs";
import lintStagedConfig from "../physics/lint-staged.mjs";
import syncpackConfig from "../physics/syncpack.mjs";
import lsLintConfig from "../physics/ls-lint.mjs";
import secretlintConfig from "../physics/secretlint.mjs";
import hooksConfig from "../physics/hooks.mjs";
import stylelintConfigFn from "../classes/next-supabase-mono/stylelint.mjs";
import cspellConfigFn from "../classes/next-supabase-mono/cspell.mjs";
import jscpdConfigFn from "../classes/next-supabase-mono/jscpd.mjs";
import knipConfigFn from "../classes/next-supabase-mono/knip.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(here, "..");

const tempDir = (name) => fs.mkdtempSync(path.join(os.tmpdir(), "orrery-shape-" + name + "-"));

describe("prettier", () => {
  // prettier.resolveConfig is prettier's own loader: it discovers the config the way the CLI and
  // every editor integration do, and it is what a `prettier.config.mjs` pointer has to satisfy.
  // A bare `"prettier": "@vaoan/orrery/prettier"` package.json pointer resolves to the generated
  // MODULE — whose default export is a function, per the spec's "every export is a function" —
  // and prettier then has an options object that is a function, which it does not accept.
  it("accepts the generated config through prettier.resolveConfig", async () => {
    const dir = tempDir("prettier");
    try {
      const target = pathToFileURL(path.join(packageDir, "physics/prettier.mjs")).href;
      fs.writeFileSync(path.join(dir, "prettier.config.mjs"), "import prettier from " + JSON.stringify(target) + ";\nexport default prettier();\n");
      fs.writeFileSync(path.join(dir, "sample.ts"), "export const a = 1;\n");
      const resolved = await prettierApi.resolveConfig(path.join(dir, "sample.ts"), { editorconfig: false });
      expect(resolved, "prettier.resolveConfig returned no options object").toBeTypeOf("object");
      expect(resolved).not.toBeNull();
      expect(typeof resolved).not.toBe("function");
      expect(resolved).toMatchObject(prettierConfig());
      // And the options it resolved must actually drive a format call.
      await expect(prettierApi.format("export  const a=1", { ...resolved, parser: "typescript" })).resolves.toBeTypeOf("string");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  // The pointer file is the deliverable, not the module: it is what `orrery init` copies into a
  // body, so it is a template file and the fixture carries it byte-identically.
  it("ships a prettier.config.mjs pointer that calls the function", () => {
    const pointer = fs.readFileSync(path.join(packageDir, "templates/next-supabase-mono/prettier.config.mjs"), "utf8");
    expect(pointer).toContain('import prettier from "@vaoan/orrery/prettier"');
    expect(pointer).toContain("export default prettier();");
  });
});

describe("lint-staged", () => {
  // lint-staged exposes no public validator, so this is its documented contract: the config is a
  // flat map of one glob to one command or a list of commands. A key split on "." (the old
  // setPath) produces `{ "*": { "{cjs,js,…}": [...] } }` — a nested object value, which
  // lint-staged reports as an invalid configuration and refuses to run.
  it("is a flat map of glob strings to a command or list of commands", () => {
    const config = lintStagedConfig();
    expect(Object.keys(config).length).toBeGreaterThan(0);
    for (const [glob, commands] of Object.entries(config)) {
      expect(typeof glob, "key " + JSON.stringify(glob)).toBe("string");
      expect(Array.isArray(commands) || typeof commands === "string", "value of " + glob + " must be a string or string[]").toBe(true);
      for (const command of Array.isArray(commands) ? commands : [commands]) expect(typeof command, "command under " + glob).toBe("string");
    }
    expect(Object.keys(config), "the '*' fragment key is the split-on-dot bug").not.toContain("*");
  });
});

describe("syncpack", () => {
  // syncpack ships its own JSON schema (node_modules/syncpack/schema.json, the one a .syncpackrc's
  // "$schema" points at). Read the declared type of each top-level key from it and check the
  // generated config against that, rather than restating the shape here.
  const schema = JSON.parse(fs.readFileSync(path.join(packageDir, "node_modules/syncpack/schema.json"), "utf8"));
  const rcFile = schema.definitions[schema.$ref.split("/").pop()];

  it("renders every key with the type syncpack's own schema declares", () => {
    const config = syncpackConfig();
    for (const [key, value] of Object.entries(config)) {
      const declared = rcFile.properties[key];
      expect(declared, 'syncpack\'s schema has no property "' + key + '"').toBeTruthy();
      if (declared.type === "array") expect(Array.isArray(value), key + " must be an array").toBe(true);
      if (declared.type === "object") expect(Array.isArray(value), key + " must be an object").toBe(false);
    }
  });

  it("renders versionGroups as an array of group objects, libra's own .syncpackrc shape", () => {
    const config = syncpackConfig();
    expect(Array.isArray(config.versionGroups)).toBe(true);
    expect(config.versionGroups.length).toBeGreaterThan(0);
    for (const group of config.versionGroups) {
      expect(group).toBeTypeOf("object");
      expect(Array.isArray(group)).toBe(false);
      expect(Array.isArray(group.dependencies), "every group names the dependencies it governs").toBe(true);
    }
  });
});

describe("stylelint", () => {
  it("lints a trivial stylesheet with the generated config without throwing", async () => {
    const config = stylelintConfigFn({ tailwind: { entryPoint: "apps/web/src/app/globals.css" } });
    const result = await stylelintApi.lint({ code: "a {\n  color: red;\n}\n", config, cwd: packageDir });
    expect(result.results).toHaveLength(1);
    expect(result.results[0].invalidOptionWarnings, JSON.stringify(result.results[0].invalidOptionWarnings)).toEqual([]);
  }, 60_000);
});

describe("cspell", () => {
  // cspell's documented config shape: a "version" string, "language" string, and array fields.
  it("renders the documented cspell config keys with their documented types", () => {
    const config = cspellConfigFn();
    expect(config.version).toBeTypeOf("string");
    expect(config.language).toBeTypeOf("string");
    expect(Array.isArray(config.words)).toBe(true);
    expect(Array.isArray(config.ignorePaths)).toBe(true);
    expect(config.allowCompoundWords).toBeTypeOf("boolean");
  });
});

describe("jscpd", () => {
  it("renders the documented jscpd config keys with their documented types", () => {
    const config = jscpdConfigFn();
    expect(config.threshold).toBeTypeOf("number");
    expect(Array.isArray(config.format)).toBe(true);
    expect(Array.isArray(config.reporters)).toBe(true);
    expect(Array.isArray(config.ignore)).toBe(true);
  });
});

describe("ls-lint", () => {
  // ls-lint's documented shape: a top-level "ls" map of directory glob to { extension: rule }.
  it("renders a top-level ls map of directory glob to extension rules", () => {
    const config = lsLintConfig();
    expect(Object.keys(config)).toEqual(["ls"]);
    for (const [dir, rules] of Object.entries(config.ls)) {
      expect(dir).toBeTypeOf("string");
      expect(rules).toBeTypeOf("object");
      for (const [ext, rule] of Object.entries(rules)) {
        expect(ext.startsWith("."), dir + " rule key " + ext + " must be a file extension").toBe(true);
        expect(rule).toBeTypeOf("string");
      }
    }
  });
});

describe("secretlint and knip and hooks", () => {
  it("renders secretlint's documented rules array", () => {
    const config = secretlintConfig();
    expect(Array.isArray(config.rules)).toBe(true);
    for (const rule of config.rules) expect(rule.id).toBeTypeOf("string");
  });
  it("renders knip's workspace shape with entry/project arrays", () => {
    const config = knipConfigFn();
    for (const key of ["apps", "packages"]) {
      expect(Array.isArray(config[key].entry), key + ".entry").toBe(true);
      expect(Array.isArray(config[key].project), key + ".project").toBe(true);
    }
  });
  it("renders the hooks map with a pre-commit entry", () => {
    const config = hooksConfig();
    expect(config["pre-commit"]).toBeTypeOf("object");
    expect(Array.isArray(config["pre-commit"].checks)).toBe(true);
  });
});
