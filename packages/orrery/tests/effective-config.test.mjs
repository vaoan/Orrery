import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  pickSampleFile,
  readEffectiveConfig,
  resolveEslintBin,
} from "../src/lib/effective-config.mjs";

let repo;
beforeEach(() => {
  repo = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-"));
  fs.mkdirSync(path.join(repo, "apps/store/src/app"), { recursive: true });
});
afterEach(() => fs.rmSync(repo, { recursive: true, force: true }));

describe("pickSampleFile", () => {
  it("returns the preferred file when it exists", () => {
    fs.writeFileSync(path.join(repo, "apps/store/src/a.ts"), "");
    expect(pickSampleFile(repo, "apps/store/src/a.ts")).toBe("apps/store/src/a.ts");
  });

  it("falls back to the first existing candidate", () => {
    fs.writeFileSync(path.join(repo, "apps/store/src/app/layout.tsx"), "");
    expect(pickSampleFile(repo)).toBe("apps/store/src/app/layout.tsx");
  });

  it("throws naming what it tried when nothing matches", () => {
    expect(() => pickSampleFile(repo)).toThrow(/no sample file found/i);
  });
});

describe("resolveEslintBin", () => {
  it("returns the bin script of the eslint installed in the repo", () => {
    const pkg = path.join(repo, "node_modules/eslint");
    fs.mkdirSync(path.join(pkg, "bin"), { recursive: true });
    fs.writeFileSync(
      path.join(pkg, "package.json"),
      JSON.stringify({ name: "eslint", version: "0.0.0", bin: { eslint: "./bin/eslint.js" } })
    );
    fs.writeFileSync(path.join(pkg, "bin/eslint.js"), "");
    expect(resolveEslintBin(repo)).toBe(path.join(pkg, "bin/eslint.js"));
  });

  it("throws naming the repo when eslint is not installed there", () => {
    expect(() => resolveEslintBin(repo)).toThrow(/eslint is not installed/i);
  });
});

describe("readEffectiveConfig", () => {
  it("parses the JSON that eslint prints", () => {
    const fakeExec = () => JSON.stringify({ rules: { "no-var": ["error"] } });
    const config = readEffectiveConfig(repo, "apps/store/src/a.ts", fakeExec);
    expect(config.rules["no-var"]).toEqual(["error"]);
  });

  it("throws a message naming the repo when eslint output is not JSON", () => {
    const fakeExec = () => "ELIFECYCLE something went wrong";
    expect(() => readEffectiveConfig(repo, "a.ts", fakeExec)).toThrow(/could not parse/i);
  });
});
