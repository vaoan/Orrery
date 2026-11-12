import { describe, it, expect, vi } from "vitest";
import diffEslint from "../src/commands/diff-eslint.mjs";

describe("diff-eslint command", () => {
  it("exits 2 when fewer than two repositories are given", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await diffEslint(["only-one"])).toBe(2);
    error.mockRestore();
  });

  it("prints a count for every bucket", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const code = await diffEslint(["a", "b"], {
      pickSampleFile: () => "src/index.ts",
      readEffectiveConfig: (dir) =>
        dir === "a"
          ? { rules: { shared: ["error"], onlyInA: ["error"], clash: ["error"] } }
          : { rules: { shared: ["error"], onlyInB: ["error"], clash: ["warn"] } },
    });
    const out = log.mock.calls.flat().join("\n");
    expect(code).toBe(0);
    expect(out).toMatch(/agree\s+1/);
    expect(out).toMatch(/conflict\s+1/);
    expect(out).toMatch(/off only in a\s+0/);
    expect(out).toMatch(/off only in b\s+0/);
    expect(out).toContain("clash");
    log.mockRestore();
  });

  it("names the sample file used for each repository in the human output", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await diffEslint(["a", "b"], {
      pickSampleFile: (dir) => (dir === "a" ? "apps/a/sample.ts" : "apps/b/sample.ts"),
      readEffectiveConfig: () => ({ rules: {} }),
    });
    const out = log.mock.calls.flat().join("\n");
    expect(out).toContain("sample a: apps/a/sample.ts");
    expect(out).toContain("sample b: apps/b/sample.ts");
    log.mockRestore();
  });

  it("emits machine-readable JSON with --json", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await diffEslint(["a", "b", "--json"], {
      pickSampleFile: () => "src/index.ts",
      readEffectiveConfig: () => ({ rules: { shared: ["error"] } }),
    });
    expect(JSON.parse(log.mock.calls.flat().join("\n")).agree).toEqual(["shared"]);
    log.mockRestore();
  });

  it("makes the JSON output self-describing with a meta block naming the repos and sample files", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await diffEslint(["a", "b", "--json"], {
      pickSampleFile: (dir) => (dir === "a" ? "apps/a/sample.ts" : "apps/b/sample.ts"),
      readEffectiveConfig: () => ({ rules: { shared: ["error"] } }),
    });
    const parsed = JSON.parse(log.mock.calls.flat().join("\n"));
    expect(parsed.meta).toEqual({
      repoA: "a",
      repoB: "b",
      fileA: "apps/a/sample.ts",
      fileB: "apps/b/sample.ts",
    });
    log.mockRestore();
  });

  it("exits 1 with a clear message when a config cannot be read", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const code = await diffEslint(["a", "b"], {
      pickSampleFile: () => "src/index.ts",
      readEffectiveConfig: () => { throw new Error("boom"); },
    });
    expect(code).toBe(1);
    expect(error.mock.calls.flat().join("\n")).toContain("boom");
    error.mockRestore();
  });

  it("exits 2 with a usage message on an unknown flag", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const code = await diffEslint(["a", "b", "--bogus"]);
    expect(code).toBe(2);
    const out = error.mock.calls.flat().join("\n");
    expect(out).toContain("usage:");
    expect(out).toContain("--bogus");
    error.mockRestore();
  });
});
