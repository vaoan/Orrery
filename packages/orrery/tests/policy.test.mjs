import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadPolicy, validatePolicy, defaultPolicyPath } from "../src/lib/policy.mjs";

describe("the committed policy", () => {
  it("loads and validates", () => {
    const policy = loadPolicy();
    expect(policy.defaultBranch).toBe("develop");
    expect(policy.protectedBranches).toEqual(["main", "develop"]);
    expect(policy.settings.allow_rebase_merge).toBe(false);
    expect(policy.requiredChecks.develop).toContain("branch-sync");
    expect(policy.requiredChecks.main).not.toContain("branch-sync");
  });

  it("lives at the repository root", () => {
    expect(defaultPolicyPath.replaceAll("\\", "/")).toMatch(/\/policy\/repository\.json$/);
  });
});

describe("validatePolicy", () => {
  const valid = () => JSON.parse(fs.readFileSync(defaultPolicyPath, "utf8"));

  it("accepts the committed policy", () => {
    expect(validatePolicy(valid())).toEqual([]);
  });

  it("requires every protected branch to have protection and required checks", () => {
    const p = valid();
    delete p.protection.develop;
    delete p.requiredChecks.develop;
    expect(validatePolicy(p)).toEqual([
      "protection.develop is missing",
      "requiredChecks.develop is missing",
    ]);
  });

  it("requires the default branch to be protected", () => {
    const p = valid();
    p.defaultBranch = "trunk";
    expect(validatePolicy(p)).toContain("defaultBranch trunk is not in protectedBranches");
  });

  it("rejects a rebase-merge setting of true", () => {
    const p = valid();
    p.settings.allow_rebase_merge = true;
    expect(validatePolicy(p)).toContain("settings.allow_rebase_merge must be false");
  });

  it("rejects labels without a six-hex colour", () => {
    const p = valid();
    p.labels.push({ name: "x", color: "red", description: "" });
    expect(validatePolicy(p)).toContain("label x has an invalid colour: red");
  });

  it("requires main to be protected", () => {
    const p = valid();
    p.protectedBranches = ["develop"];
    delete p.protection.main;
    delete p.requiredChecks.main;
    expect(validatePolicy(p)).toEqual(["protectedBranches must include main"]);
  });

  it("rejects a required check that is not a non-empty string", () => {
    const p = valid();
    p.requiredChecks.develop = ["test", 42, ""];
    expect(validatePolicy(p)).toContain("requiredChecks.develop entry 1 must be a non-empty string");
    expect(validatePolicy(p)).toContain("requiredChecks.develop entry 2 must be a non-empty string");
  });
});

describe("loadPolicy", () => {
  it("throws listing every error for an invalid file", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-policy-"));
    const file = path.join(dir, "bad.json");
    fs.writeFileSync(file, JSON.stringify({ defaultBranch: "x", protectedBranches: [], settings: {}, protection: {}, requiredChecks: {}, labels: [] }));
    expect(() => loadPolicy(file)).toThrow(/defaultBranch x is not in protectedBranches/);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
