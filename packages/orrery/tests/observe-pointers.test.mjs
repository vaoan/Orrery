import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pointerDrift, localOverrideViolations } from "../src/lib/observe/pointers.mjs";
import schema from "../classes/next-supabase-mono/schema.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const realTemplates = path.join(root, "packages/orrery/templates/next-supabase-mono");
const fixture = path.join(root, "fixtures/next-supabase-mono");

let body, templates;
const put = (root, rel, text) => { fs.mkdirSync(path.join(root, path.dirname(rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); };
beforeEach(() => {
  body = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-ptr-body-"));
  templates = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-ptr-tpl-"));
  put(templates, "eslint.config.mjs", 'import orrery from "@vaoan/orrery/eslint";\nexport default await orrery();\n');
  put(templates, ".husky/pre-push", "pnpm orrery hook pre-push\n");
});
afterEach(() => { fs.rmSync(body, { recursive: true, force: true }); fs.rmSync(templates, { recursive: true, force: true }); });

describe("localOverrideViolations", () => {
  it("accepts named-file exceptions and rejects globs and entries without files", () => {
    expect(localOverrideViolations([{ files: ["apps/hub/tests/retry-fetch.test.ts"], rules: { "no-await-in-loop": "off" } }])).toEqual([]);
    expect(localOverrideViolations([{ files: ["apps/**/*.ts"], rules: {} }])).toEqual(['entry 0: files pattern "apps/**/*.ts" is not a named file']);
    expect(localOverrideViolations([{ rules: { "no-var": "off" } }])).toEqual(["entry 0: has no files; a local entry must name the files it applies to"]);
  });
});

describe("pointerDrift", () => {
  it("reports identical, differs and missing per template file, and validates local and config", async () => {
    put(body, "eslint.config.mjs", 'import orrery from "@vaoan/orrery/eslint";\nexport default await orrery();\n');
    put(body, ".husky/pre-push", "pnpm orrery hook pre-push\necho extra\n");
    put(body, "eslint.local.mjs", 'export default [{ files: ["apps/**/*.ts"], rules: {} }];');
    put(body, "orrery.config.mjs", 'export default { class: "next-supabase-mono", tailwind: { entryPoint: "x.css" }, severity: 1 };');
    const r = await pointerDrift(body, templates, schema);
    expect(r.files).toEqual([{ path: ".husky/pre-push", state: "differs" }, { path: "eslint.config.mjs", state: "identical" }]);
    expect(r.local).toEqual(['entry 0: files pattern "apps/**/*.ts" is not a named file']);
    expect(r.config).toEqual(["unknown field severity"]);
  });
  it("reports missing pointers and a missing config for a body not yet adopted", async () => {
    const r = await pointerDrift(body, templates, schema);
    expect(r.files.every((f) => f.state === "missing")).toBe(true);
    expect(r.config).toEqual(["missing"]);
    expect(r.local).toEqual([]);
  });
  it("reports the real fixture body as fully current against the real templates", async () => {
    const r = await pointerDrift(fixture, realTemplates, schema);
    expect(r.files.every((f) => f.state === "identical")).toBe(true);
    expect(r.local).toEqual([]);
    expect(r.config).toEqual([]);
  });
});
