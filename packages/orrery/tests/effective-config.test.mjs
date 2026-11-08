import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  pickSampleFile,
  readEffectiveConfig,
  resolveEslintBin,
} from "../src/lib/effective-config.mjs";

const effectiveConfigUrl = pathToFileURL(
  fileURLToPath(new URL("../src/lib/effective-config.mjs", import.meta.url))
).href;

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

  it("throws when the preferred file does not exist, even if a candidate does", () => {
    // A candidate is present, so a silent fallback would return it instead of
    // honouring --file. That would hide a typo in --file behind a config that
    // looks plausible but was not the one the caller asked for.
    fs.writeFileSync(path.join(repo, "apps/store/src/app/layout.tsx"), "");
    expect(() => pickSampleFile(repo, "apps/store/src/missing.ts")).toThrow(
      /does not exist/i
    );
    expect(() => pickSampleFile(repo, "apps/store/src/missing.ts")).toThrow(
      /apps\/store\/src\/missing\.ts/
    );
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

  it("does not resolve eslint through NODE_PATH when the repo has none installed", () => {
    // Reproduces the leak without relying on vitest's own worker environment
    // (which happens to set NODE_PATH itself): a hoisted-looking node_modules
    // directory is put on NODE_PATH for a *child* node process, and an empty
    // repo is handed to resolveEslintBin in that child. A resolver that
    // consults NODE_PATH (createRequire, require.resolve) finds the fake
    // eslint and returns a path instead of throwing.
    const hoisted = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-hoisted-"));
    const fakeEslintDir = path.join(hoisted, "node_modules/eslint/bin");
    fs.mkdirSync(fakeEslintDir, { recursive: true });
    fs.writeFileSync(
      path.join(hoisted, "node_modules/eslint/package.json"),
      JSON.stringify({ name: "eslint", version: "0.0.0", bin: { eslint: "./bin/eslint.js" } })
    );
    fs.writeFileSync(path.join(fakeEslintDir, "eslint.js"), "");

    const script = [
      `import { resolveEslintBin } from ${JSON.stringify(effectiveConfigUrl)};`,
      `try {`,
      `  console.log("RESOLVED:" + resolveEslintBin(${JSON.stringify(repo)}));`,
      `} catch (error) {`,
      `  console.log("ERROR:" + error.message);`,
      `}`,
    ].join("\n");

    const output = execFileSync(
      process.execPath,
      ["--input-type=module", "-e", script],
      {
        env: { ...process.env, NODE_PATH: path.join(hoisted, "node_modules") },
        encoding: "utf8",
      }
    );

    expect(output).toMatch(/eslint is not installed/);
  });

  it("walks up to a hoisted node_modules above the repo (no leak: it is a real ancestor)", () => {
    const outer = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-outer-"));
    const pkg = path.join(outer, "node_modules/eslint");
    fs.mkdirSync(path.join(pkg, "bin"), { recursive: true });
    fs.writeFileSync(
      path.join(pkg, "package.json"),
      JSON.stringify({ name: "eslint", version: "0.0.0", bin: { eslint: "./bin/eslint.js" } })
    );
    fs.writeFileSync(path.join(pkg, "bin/eslint.js"), "");

    const nestedRepo = path.join(outer, "repo");
    fs.mkdirSync(nestedRepo, { recursive: true });

    expect(resolveEslintBin(nestedRepo)).toBe(path.join(pkg, "bin/eslint.js"));
  });

  it("throws naming the manifest when bin is neither a string nor an object with an eslint key", () => {
    const pkg = path.join(repo, "node_modules/eslint");
    fs.mkdirSync(pkg, { recursive: true });
    const manifestPath = path.join(pkg, "package.json");
    fs.writeFileSync(
      manifestPath,
      JSON.stringify({ name: "eslint", version: "0.0.0", bin: { notEslint: "./bin/other.js" } })
    );
    expect(() => resolveEslintBin(repo)).toThrow(/no eslint bin entry/i);
    expect(() => resolveEslintBin(repo)).toThrow(
      new RegExp(manifestPath.replace(/[/\\.]/g, "\\$&"))
    );
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

// These pin the default exec's spawn contract — argv and cwd — without
// depending on ESLint actually being installed anywhere. The fake "eslint" is
// just a Node script that reports what it was called with.
function installFakeEslint(repoDirectory, scriptBody) {
  const pkg = path.join(repoDirectory, "node_modules/eslint");
  fs.mkdirSync(path.join(pkg, "bin"), { recursive: true });
  fs.writeFileSync(
    path.join(pkg, "package.json"),
    JSON.stringify({ name: "eslint", version: "0.0.0", bin: { eslint: "./bin/eslint.js" } })
  );
  fs.writeFileSync(path.join(pkg, "bin/eslint.js"), scriptBody);
}

describe("readEffectiveConfig with the default exec", () => {
  it("spawns eslint --print-config with the file as the sole argument, in the repo directory", () => {
    installFakeEslint(
      repo,
      "console.log(JSON.stringify({ rules: {}, argv: process.argv.slice(2), cwd: process.cwd() }));"
    );

    const config = readEffectiveConfig(repo, "a.ts");

    expect(config.argv).toEqual(["--print-config", "a.ts"]);
    expect(fs.realpathSync(config.cwd)).toBe(fs.realpathSync(repo));
  });

  it("rethrows a spawn failure naming the repository", () => {
    installFakeEslint(repo, "process.exit(2);");

    expect(() => readEffectiveConfig(repo, "a.ts")).toThrow(
      /eslint --print-config failed in/
    );
    expect(() => readEffectiveConfig(repo, "a.ts")).toThrow(
      new RegExp(repo.replace(/[/\\.]/g, "\\$&"))
    );
  });
});
