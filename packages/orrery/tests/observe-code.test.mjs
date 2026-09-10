import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { materialise } from "../src/lib/observe/scratch.mjs";
import { effectiveMismatches, violationsByRule, compareToPrediction, binField, codeDrift, tightenedFor } from "../src/lib/observe/code.mjs";
import { resolveEslintBin } from "../src/lib/effective-config.mjs";

// Every path used in these tests is derived from the test file's own location (never a literal
// drive path): CI runs on Linux, where a hard-coded "Z:/..." string is not absolute at all —
// `path.resolve` silently prepends the runner's cwd to it instead of erroring, producing a
// plausible-looking but wrong path that only fails once something tries to load a module there.
const PACKAGE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGE_DIR_POSIX = PACKAGE_DIR.split(path.sep).join("/");
// A body directory that need not exist: every test below either fully overrides the tool
// functions materialise would otherwise import (so it never touches bodyDir on disk) or mocks
// `run`/`codeDrift`'s subprocess calls outright. `path.resolve("fake-body")` is absolute and
// cross-platform on both Windows and Linux, unlike a literal drive path.
const FAKE_BODY = path.resolve("fake-body");
const FAKE_BODY_POSIX = FAKE_BODY.split(path.sep).join("/");

describe("materialise", () => {
  let scratch;
  beforeEach(() => { scratch = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-scratch-")); });
  afterEach(() => fs.rmSync(scratch, { recursive: true, force: true }));

  it("writes one config per tool that imports the bundle by absolute path and passes the body config", async () => {
    const bundleDir = PACKAGE_DIR;
    const files = await materialise(FAKE_BODY, { class: "next-supabase-mono", tailwind: { entryPoint: "g.css" } }, scratch, { bundleDir, functions: { stylelint: () => ({ rules: {} }), jscpd: () => ({ threshold: 4 }), cspell: () => ({ words: [] }), lsLint: () => "ls:\n", syncpack: () => ({ versionGroups: [] }), tsconfigInclude: ["apps/*/src"] } });
    const eslint = fs.readFileSync(files.eslint, "utf8");
    const eslintEntryUrl = pathToFileURL(`${PACKAGE_DIR_POSIX}/classes/next-supabase-mono/eslint.mjs`).href;
    expect(eslint).toContain(`import orrery from ${JSON.stringify(eslintEntryUrl)}`);
    expect(eslint).toContain(`"root": ${JSON.stringify(FAKE_BODY_POSIX)}`);
    expect(eslint).toContain('"entryPoint": "g.css"');
    expect(JSON.parse(fs.readFileSync(files.tsconfig, "utf8"))).toEqual({
      extends: `${PACKAGE_DIR_POSIX}/classes/next-supabase-mono/tsconfig.json`,
      include: [`${FAKE_BODY_POSIX}/apps/*/src`],
      compilerOptions: { noEmit: true },
    });
    expect(JSON.parse(fs.readFileSync(files.jscpd, "utf8")).threshold).toBe(4);
    expect(fs.readFileSync(files.lsLint, "utf8")).toBe("ls:\n");
  });

  // A real body's tree carries generated build output the bundle itself never excludes (real
  // usage only ever runs it through lint-staged, against staged files). observe's own
  // violations pass is the one caller that sweeps the whole tree; found against libra, where
  // omitting this OOM-crashed the eslint child process parsing `.next`'s generated webpack
  // chunks (see task-9-report.md "Real runs").
  it("ignores generated/build directories in the materialised eslint config", async () => {
    const bundleDir = PACKAGE_DIR;
    const files = await materialise(FAKE_BODY, { class: "next-supabase-mono", tailwind: { entryPoint: "g.css" } }, scratch, { bundleDir, functions: { stylelint: () => ({}), jscpd: () => ({}), cspell: () => ({}), lsLint: () => "ls:\n", syncpack: () => ({}), tsconfigInclude: [] } });
    const eslint = fs.readFileSync(files.eslint, "utf8");
    for (const pattern of ["**/.next/**", "**/.turbo/**", "**/dist/**", "**/build/**", "**/coverage/**", "**/node_modules/**"]) {
      expect(eslint).toContain(JSON.stringify(pattern));
    }
    expect(eslint).toMatch(/export default \[\{ ignores: \[/);
  });

  // Regression for the bug fixed in this round: bodyRoot used to be `posix(bodyDir)` without a
  // `path.resolve` first. A relative bodyDir then flowed, unresolved, into the eslint scratch
  // config's `root` and the tsconfig's `include` paths — root becomes `tsconfigRootDir` in
  // parserOptions (eslint.base.mjs), which typescript-eslint's project service needs absolute;
  // relative, it silently fails to associate any file with a TS project (a parse-level "fatal"
  // message per file, not a config error — see task-9-report.md's "Why this is blocked" #1).
  it("resolves a relative bodyDir to absolute before writing it as root / into tsconfig include", async () => {
    const bundleDir = PACKAGE_DIR;
    const absoluteBody = FAKE_BODY;
    const relativeBody = path.relative(process.cwd(), absoluteBody);
    const files = await materialise(relativeBody, { class: "next-supabase-mono", tailwind: { entryPoint: "g.css" } }, scratch, {
      bundleDir,
      functions: { stylelint: () => ({}), jscpd: () => ({}), cspell: () => ({}), lsLint: () => "ls:\n", syncpack: () => ({}), tsconfigInclude: ["apps/*/src"] },
    });
    const eslint = fs.readFileSync(files.eslint, "utf8");
    const rootMatch = /"root": "([^"]+)"/.exec(eslint);
    expect(rootMatch, "eslint scratch config has no root field").toBeTruthy();
    expect(path.isAbsolute(rootMatch[1])).toBe(true);
    expect(rootMatch[1]).toBe(absoluteBody.split(path.sep).join("/"));

    const tsconfig = JSON.parse(fs.readFileSync(files.tsconfig, "utf8"));
    for (const include of tsconfig.include) expect(path.isAbsolute(include)).toBe(true);
  });

  // Minor: exercise the YAML emitter against the real physics/ls-lint.mjs object, not a stub.
  it("serialises the real physics ls-lint config to nested YAML", async () => {
    const bundleDir = PACKAGE_DIR;
    const lsLintModule = await import(pathToFileURL(path.join(bundleDir, "physics/ls-lint.mjs")).href);
    const real = lsLintModule.default();
    const files = await materialise(FAKE_BODY, { class: "next-supabase-mono", tailwind: { entryPoint: "g.css" } }, scratch, { bundleDir });
    const yaml = fs.readFileSync(files.lsLint, "utf8");
    expect(yaml.startsWith("ls:\n")).toBe(true);
    for (const [pattern, rules] of Object.entries(real.ls)) {
      expect(yaml).toContain(`  ${pattern}:`);
      for (const [ext, rule] of Object.entries(rules)) expect(yaml).toContain(`    ${ext}: ${rule}`);
    }
  });

  // S3: both donors' per-app tsconfigs include `**/*.ts`, so tests and e2e files sit inside
  // their own project — the fixture's e2e/unit-test files were "not found by the project
  // service" until the default (and the template's own include list) covered those directories
  // too. A body that does not override `tsconfig.include` gets this default.
  it("defaults tsconfig include to source, tests and e2e for both apps and packages when the body does not override it", async () => {
    const bundleDir = PACKAGE_DIR;
    const files = await materialise(FAKE_BODY, { class: "next-supabase-mono", tailwind: { entryPoint: "g.css" } }, scratch, { bundleDir });
    const tsconfig = JSON.parse(fs.readFileSync(files.tsconfig, "utf8"));
    expect(tsconfig.include).toEqual(
      ["apps/*/src", "apps/*/tests", "apps/*/e2e", "packages/*/src", "packages/*/tests"].map((i) => `${FAKE_BODY_POSIX}/${i}`)
    );
  });
});

describe("effectiveMismatches", () => {
  const rows = [
    { tool: "eslint", surface: "source", key: "no-var", chosen: ["error"], tier: "physics", test: "agree" },
    { tool: "eslint", surface: "source", key: "better-tailwindcss/x", chosen: ["error", { entryPoint: { $parameter: "tailwind.entryPoint" } }], tier: "class", test: "parameter" },
    { tool: "eslint", surface: "source", key: "unicorn/inert", chosen: null, tier: null, test: "inert" },
  ];
  const body = { tailwind: { entryPoint: "g.css" } };
  it("passes when every ruled rule matches and extras are only offs", () => {
    expect(effectiveMismatches({ "no-var": [2], "better-tailwindcss/x": ["error", { entryPoint: "g.css" }], "@stylistic/semi": ["off"] }, rows, "source", body)).toEqual([]);
  });
  it("names a missing rule, a wrong value, and an unexpected on rule", () => {
    expect(effectiveMismatches({ "no-var": ["warn"], "extra/rule": ["error"] }, rows, "source", body)).toEqual([
      'no-var: got ["warn"] want ["error"]',
      "better-tailwindcss/x: missing",
      "extra/rule: not in the rulings and not off",
    ]);
  });
});

// S4: tightenedFor must use the same comparison as effectiveMismatches (severity + options
// matching, with the eslint-config-prettier carve-out), not a raw norm(own) !== norm(chosen)
// check — a body whose own value for a prettier-off rule merely differs from `chosen` (the
// bundle can never actually enforce that rule; eslint-config-prettier always turns it off last)
// must never be reported as tightened.
describe("tightenedFor", () => {
  const body = {};
  it("never reports a rule eslint-config-prettier always turns off as tightened, even when the body's own value differs from chosen", () => {
    const rows = [{ tool: "eslint", surface: "source", key: "quotes", chosen: ["error", "single"], tier: "physics", test: "agree" }];
    const bodyEffective = { source: { rules: { quotes: ["error", "double"] } } };
    expect(tightenedFor(rows, bodyEffective, body)).toEqual([]);
  });

  it("still reports tightened for a non-prettier rule whose body value differs from chosen", () => {
    const rows = [{ tool: "eslint", surface: "source", key: "no-var", chosen: ["error"], tier: "physics", test: "agree" }];
    const bodyEffective = { source: { rules: { "no-var": ["off"] } } };
    expect(tightenedFor(rows, bodyEffective, body)).toEqual(["no-var"]);
  });

  it("reports nothing when the body's own value already matches chosen", () => {
    const rows = [{ tool: "eslint", surface: "source", key: "no-var", chosen: ["error"], tier: "physics", test: "agree" }];
    const bodyEffective = { source: { rules: { "no-var": ["error"] } } };
    expect(tightenedFor(rows, bodyEffective, body)).toEqual([]);
  });
});

describe("violationsByRule / compareToPrediction", () => {
  const output = JSON.stringify([{ filePath: "a.ts", messages: [{ ruleId: "no-var" }, { ruleId: "no-var" }, { ruleId: "sonarjs/max-lines" }] }, { filePath: "b.ts", messages: [{ ruleId: null, fatal: true, message: "parse" }] }]);
  it("counts violations per rule and parse errors separately", () => {
    expect(violationsByRule(output)).toEqual({ "no-var": 2, "sonarjs/max-lines": 1, "(fatal)": 1 });
  });
  it("classifies unexplained, moved and new rules against a prediction", () => {
    const prediction = { tightened: ["no-var", "sonarjs/max-lines", "unicorn/x"], counts: { "no-var": 5, "sonarjs/max-lines": 1 } };
    const r = compareToPrediction({ "no-var": 2, "sonarjs/max-lines": 1, "react/jsx-key": 3 }, prediction);
    expect(r.unexplained).toEqual(["react/jsx-key"]);
    expect(r.moved).toEqual([{ rule: "no-var", was: 5, now: 2 }]);
    expect(r.newRules).toEqual([]);
    expect(r.resolved).toEqual(["unicorn/x"]);
  });
});

// Each of these packages' bin field points somewhere different in its own tree (stylelint:
// "bin/stylelint.mjs", syncpack: "./index.cjs", @ls-lint/ls-lint's bin key is the short
// "ls-lint", not its scoped package name): binField must read the field, not assume a layout.
describe("binField", () => {
  it.each([
    ["eslint", "eslint"],
    ["typescript", "tsc"],
    ["stylelint", "stylelint"],
    ["jscpd", "jscpd"],
    ["cspell", "cspell"],
    ["@ls-lint/ls-lint", "ls-lint"],
    ["syncpack", "syncpack"],
  ])("%s resolves to an existing file", (pkg, binName) => {
    const resolved = binField(pkg, binName);
    expect(fs.existsSync(resolved), `${resolved} does not exist`).toBe(true);
  });
});

describe("codeDrift", () => {
  // F1: eslint is the one binary the rulings and the honesty comparison are measured against,
  // so it is resolved the mandated way — resolveEslintBin, from packages/orrery — not through
  // the generic binField used for the other six tools.
  it("resolves eslint via resolveEslintBin from packages/orrery, not binField", async () => {
    const calls = [];
    const run = (command, args) => { calls.push(args); return "[]"; };
    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-observe-test-"));
    try {
      await codeDrift(FAKE_BODY, { rows: [], bodyConfig: {}, samples: {}, bodyEffective: {}, tools: ["eslint"], run, scratchDir: scratch });
    } finally {
      fs.rmSync(scratch, { recursive: true, force: true });
    }
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0]).toContain(resolveEslintBin(PACKAGE_DIR));
  });

  // F2: a tool crashing must never take the whole observation down. Inject a `run` that throws
  // (as a subprocess failure with empty stdout would) for one tool only.
  it("catches a tool crash as { crashed: true, message }, and the other tools still run", async () => {
    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-observe-test-"));
    try {
      const run = (command, args) => {
        if (args.some((a) => typeof a === "string" && a.endsWith("stylelint.config.mjs"))) {
          const error = new Error("boom");
          error.stdout = "";
          throw error;
        }
        return "[]";
      };
      const result = await codeDrift(FAKE_BODY, { rows: [], bodyConfig: {}, samples: {}, bodyEffective: {}, tools: ["stylelint", "cspell"], run, scratchDir: scratch });
      expect(result.stylelint).toEqual({ crashed: true, message: "boom" });
      expect(result.cspell).toEqual({ issues: 0 });
    } finally {
      fs.rmSync(scratch, { recursive: true, force: true });
    }
  });

  // Minor: a scratch directory codeDrift creates itself (no scratchDir passed) is its own to
  // clean up; one the caller passed in is the caller's to keep (tests read its files).
  it("removes a scratch directory it creates itself, but not one the caller passed", async () => {
    const calls = [];
    const run = (command, args) => { calls.push(args); return "[]"; };
    await codeDrift(FAKE_BODY, { rows: [], bodyConfig: {}, samples: {}, bodyEffective: {}, tools: ["eslint"], run });
    const ownScratchDir = path.dirname(calls[0][calls[0].indexOf("-c") + 1]);
    expect(fs.existsSync(ownScratchDir)).toBe(false);

    const passedScratch = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-observe-owned-"));
    try {
      await codeDrift(FAKE_BODY, { rows: [], bodyConfig: {}, samples: {}, bodyEffective: {}, tools: ["eslint"], run, scratchDir: passedScratch });
      expect(fs.existsSync(passedScratch)).toBe(true);
    } finally {
      fs.rmSync(passedScratch, { recursive: true, force: true });
    }
  });
});
