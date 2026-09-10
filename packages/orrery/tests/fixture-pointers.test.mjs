import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const templates = path.join(root, "packages/orrery/templates/next-supabase-mono");
const fixture = path.join(root, "fixtures/next-supabase-mono");

describe("fixture pointer files", () => {
  // readdirSync, not globSync: fs.glob skips dot-prefixed paths such as .husky by default.
  const files = fs.readdirSync(templates, { recursive: true, withFileTypes: true }).filter((d) => d.isFile()).map((d) => path.relative(templates, path.join(d.parentPath, d.name)).split(path.sep).join("/"));
  it("exist as templates", () => { expect(files.length).toBeGreaterThanOrEqual(7); });
  it.each(files)("%s is byte-identical between template and fixture", (rel) => {
    expect(fs.readFileSync(path.join(fixture, rel))).toEqual(fs.readFileSync(path.join(templates, rel)));
  });
  it("templates carry no policy: no rule names, no severities", () => {
    for (const rel of files) {
      const text = fs.readFileSync(path.join(templates, rel), "utf8");
      expect(text, rel).not.toMatch(/"error"|"warn"|"off"|rules:/);
    }
  });
});
