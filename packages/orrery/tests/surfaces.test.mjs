import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { SURFACES, findSurfaceSamples } from "../src/lib/surfaces.mjs";

let repo;
const touch = (rel) => {
  fs.mkdirSync(path.join(repo, path.dirname(rel)), { recursive: true });
  fs.writeFileSync(path.join(repo, rel), "");
};
beforeEach(() => { repo = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-surf-")); });
afterEach(() => fs.rmSync(repo, { recursive: true, force: true }));

describe("SURFACES", () => {
  it("names the six surfaces in a fixed order", () => {
    expect(SURFACES.map((s) => s.name)).toEqual(["source", "component", "unit-test", "e2e", "script", "package"]);
  });
});

describe("findSurfaceSamples", () => {
  it("picks the first sorted match per surface and skips tests, barrels and declarations", () => {
    touch("apps/z/src/features/b/z.ts");
    touch("apps/a/src/features/a/index.ts");
    touch("apps/a/src/features/a/types.d.ts");
    touch("apps/a/src/features/a/use-thing.test.ts");
    touch("apps/a/src/features/a/use-thing.ts");
    touch("apps/a/src/features/a/tile.tsx");
    touch("apps/a/tests/one.test.ts");
    touch("apps/a/e2e/home.spec.ts");
    touch("scripts/build.mjs");
    touch("packages/core/src/index.ts");
    touch("packages/core/src/thing.ts");
    expect(findSurfaceSamples(repo)).toEqual({
      source: "apps/a/src/features/a/use-thing.ts",
      component: "apps/a/src/features/a/tile.tsx",
      "unit-test": "apps/a/tests/one.test.ts",
      e2e: "apps/a/e2e/home.spec.ts",
      script: "scripts/build.mjs",
      package: "packages/core/src/thing.ts",
    });
  });

  it("finds e2e specs under tests/e2e as well", () => {
    touch("apps/hub/tests/e2e/a11y.spec.ts");
    expect(findSurfaceSamples(repo, { source: null, component: null, "unit-test": null, script: null, package: null }).e2e).toBe("apps/hub/tests/e2e/a11y.spec.ts");
  });

  it("honours an override and requires it to exist", () => {
    touch("apps/a/src/features/a/x.ts");
    touch("custom/file.ts");
    const r = findSurfaceSamples(repo, { source: "custom/file.ts", component: null, "unit-test": null, e2e: null, script: null, package: null });
    expect(r.source).toBe("custom/file.ts");
    expect(() => findSurfaceSamples(repo, { source: "custom/missing.ts", component: null, "unit-test": null, e2e: null, script: null, package: null })).toThrow(/override .*custom\/missing\.ts.* does not exist/);
  });

  it("throws naming the surface and the patterns when nothing matches", () => {
    expect(() => findSurfaceSamples(repo)).toThrow(/no sample for surface "source".*apps\/\*\/src\/features/);
  });

  it("uses forward slashes on every platform", () => {
    touch("apps/a/src/features/a/x.ts");
    const r = findSurfaceSamples(repo, { component: null, "unit-test": null, e2e: null, script: null, package: null });
    expect(r.source).not.toContain("\\");
  });
});
