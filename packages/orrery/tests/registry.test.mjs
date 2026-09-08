import { describe, it, expect } from "vitest";
import { loadRegistry, defaultRegistryPath } from "../src/lib/registry.mjs";

describe("registry", () => {
  it("lists Orrery and the five bodies with repo, role and class", () => {
    const { bodies } = loadRegistry();
    expect(Object.keys(bodies)).toEqual(["orrery", "aeleos", "libra", "puck", "eclipse-con", "janus"]);
    for (const body of Object.values(bodies)) {
      expect(body.repo).toMatch(/^vaoan\/[A-Za-z-]+$/);
      expect(["centre", "star", "planet"]).toContain(body.role);
    }
    expect(bodies.aeleos.class).toBe("next-supabase-mono");
    expect(bodies.orrery.class).toBeNull();
  });

  it("carries no version field, by design", () => {
    const { bodies } = loadRegistry();
    for (const body of Object.values(bodies)) expect(body).not.toHaveProperty("version");
  });

  it("lives at the repository root", () => {
    expect(defaultRegistryPath.replaceAll("\\", "/")).toMatch(/\/registry\.json$/);
  });
});
