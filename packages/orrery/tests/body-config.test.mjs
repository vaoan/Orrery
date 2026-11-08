import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadBodyConfig, validateBodyConfig, resolveParameter } from "../src/lib/body-config.mjs";
import schema from "../classes/next-supabase-mono/schema.mjs";

let dir;
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-body-")); });
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe("validateBodyConfig", () => {
  it("accepts a config that only carries declared fields", () => {
    expect(validateBodyConfig({ class: "next-supabase-mono", tailwind: { entryPoint: "apps/x/src/app/globals.css" }, spelling: ["x"] }, schema)).toEqual([]);
  });
  it("rejects unknown fields, wrong types, and a missing required field", () => {
    const errors = validateBodyConfig({ class: "next-supabase-mono", rules: { "no-var": "off" }, spelling: "x", tailwind: {} }, schema);
    expect(errors).toContain("unknown field rules");
    expect(errors).toContain("spelling must be string[]");
    expect(errors).toContain("tailwind.entryPoint is required");
  });
  it("rejects an unknown class", () => {
    expect(validateBodyConfig({ class: "node-lib" }, schema)).toContain("class must be one of next-supabase-mono");
  });
});

describe("loadBodyConfig", () => {
  it("walks up from a nested directory, validates, and returns the root", async () => {
    fs.writeFileSync(path.join(dir, "orrery.config.mjs"), 'export default { class: "next-supabase-mono", tailwind: { entryPoint: "apps/a/src/app/globals.css" } };');
    fs.mkdirSync(path.join(dir, "apps/a/src"), { recursive: true });
    const { root, config } = await loadBodyConfig(path.join(dir, "apps/a/src"));
    expect(fs.realpathSync(root)).toBe(fs.realpathSync(dir));
    expect(config.tailwind.entryPoint).toBe("apps/a/src/app/globals.css");
  });
  it("throws naming the field when the config is invalid", async () => {
    fs.writeFileSync(path.join(dir, "orrery.config.mjs"), 'export default { class: "next-supabase-mono", tailwind: { entryPoint: "x" }, severity: "error" };');
    await expect(loadBodyConfig(dir)).rejects.toThrow(/unknown field severity/);
  });
  it("throws when no config is found", async () => {
    await expect(loadBodyConfig(dir)).rejects.toThrow(/no orrery\.config\.mjs found/);
  });
});

describe("resolveParameter", () => {
  it("reads a dotted path and falls back to the schema default", () => {
    const config = { class: "next-supabase-mono", tailwind: { entryPoint: "g.css" } };
    expect(resolveParameter(config, "tailwind.entryPoint", schema)).toBe("g.css");
    expect(resolveParameter(config, "spelling", schema)).toEqual([]);
    expect(resolveParameter(config, "boundaries.allow", schema)).toEqual([]);
    expect(resolveParameter(config, "tsconfig.exclude", schema)).toEqual(["node_modules"]);
  });
});
