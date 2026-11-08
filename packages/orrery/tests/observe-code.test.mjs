import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { materialise } from "../src/lib/observe/scratch.mjs";
import { effectiveMismatches, violationsByRule, compareToPrediction, binField, codeDrift, tightenedFor, matches } from "../src/lib/observe/code.mjs";
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

// T4b: a boundaries/* rule reads settings["boundaries/elements"] to know what an "element" is —
// not its own rule options — so two sides can carry an identical `chosen` value and still behave
// differently. `classEffectiveBySurface` (the class bundle's own real effective config, the same
// object codeDrift's eslint pass already computes per surface via readEffectiveConfig) lets
// tightenedFor catch that case too.
describe("tightenedFor / boundaries settings-awareness (T4b)", () => {
  const body = {};
  const rows = [{ tool: "eslint", surface: "source", key: "boundaries/no-unknown", chosen: ["error"], tier: "class", test: "agree" }];

  it("reports a boundaries/* rule tightened when the class's settings differ from the body's own, even though the rule value already matches", () => {
    const bodyEffective = { source: { rules: { "boundaries/no-unknown": ["error"] }, settings: { "boundaries/elements": [{ type: "app" }] } } };
    const classEffective = { source: { settings: { "boundaries/elements": [{ type: "app" }, { type: "package" }] } } };
    expect(tightenedFor(rows, bodyEffective, body, classEffective)).toEqual(["boundaries/no-unknown"]);
  });

  it("does not report a boundaries/* rule tightened when the settings are the same modulo key order (canonicalised)", () => {
    const bodyEffective = { source: { rules: { "boundaries/no-unknown": ["error"] }, settings: { "boundaries/elements": [{ type: "app", capture: ["x"] }] } } };
    const classEffective = { source: { settings: { "boundaries/elements": [{ capture: ["x"], type: "app" }] } } };
    expect(tightenedFor(rows, bodyEffective, body, classEffective)).toEqual([]);
  });

  it("ignores settings entirely for a non-boundaries rule", () => {
    const nonBoundaryRows = [{ tool: "eslint", surface: "source", key: "no-var", chosen: ["error"], tier: "physics", test: "agree" }];
    const bodyEffective = { source: { rules: { "no-var": ["error"] }, settings: { "boundaries/elements": [{ type: "app" }] } } };
    const classEffective = { source: { settings: { "boundaries/elements": [{ type: "package" }] } } };
    expect(tightenedFor(nonBoundaryRows, bodyEffective, body, classEffective)).toEqual([]);
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

  // T4a: baseline semantics. A rule with violations that the prediction did not tighten is only
  // "unexplained" when it is new (absent from prediction.counts) or worse (more violations now
  // than predicted); at or below its predicted count, it is "baseline" — known, informational,
  // not a failure.
  describe("baseline semantics (T4a)", () => {
    it("a baseline rule (violated, not tightened) at its predicted count is baseline, not unexplained", () => {
      const prediction = { tightened: [], counts: { "sonarjs/prefer-read-only-props": 10 } };
      const r = compareToPrediction({ "sonarjs/prefer-read-only-props": 10 }, prediction);
      expect(r.unexplained).toEqual([]);
      expect(r.baseline).toEqual(["sonarjs/prefer-read-only-props"]);
    });

    it("a baseline rule below its predicted count is baseline, not unexplained", () => {
      const prediction = { tightened: [], counts: { "sonarjs/prefer-read-only-props": 10 } };
      const r = compareToPrediction({ "sonarjs/prefer-read-only-props": 4 }, prediction);
      expect(r.unexplained).toEqual([]);
      expect(r.baseline).toEqual(["sonarjs/prefer-read-only-props"]);
    });

    it("a baseline rule above its predicted count is unexplained, not baseline", () => {
      const prediction = { tightened: [], counts: { "sonarjs/prefer-read-only-props": 10 } };
      const r = compareToPrediction({ "sonarjs/prefer-read-only-props": 11 }, prediction);
      expect(r.unexplained).toEqual(["sonarjs/prefer-read-only-props"]);
      expect(r.baseline).toEqual([]);
    });

    it("a rule with no predicted count at all is unexplained", () => {
      const prediction = { tightened: [], counts: {} };
      const r = compareToPrediction({ "boundaries/no-unknown": 1 }, prediction);
      expect(r.unexplained).toEqual(["boundaries/no-unknown"]);
      expect(r.baseline).toEqual([]);
    });

    it("a tightened rule is neither baseline nor unexplained, no matter its count", () => {
      const prediction = { tightened: ["no-var"], counts: { "no-var": 2 } };
      const r = compareToPrediction({ "no-var": 50 }, prediction);
      expect(r.unexplained).toEqual([]);
      expect(r.baseline).toEqual([]);
    });
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
    const run = (command, args) => { calls.push(args); return { stdout: "[]", stderr: "", status: 0 }; };
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
  // (as a subprocess spawn failure would) for one tool only.
  it("catches a tool crash as { crashed: true, message }, and the other tools still run", async () => {
    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-observe-test-"));
    try {
      const run = (command, args) => {
        if (args.some((a) => typeof a === "string" && a.endsWith("stylelint.config.mjs"))) {
          throw new Error("boom");
        }
        return { stdout: "[]", stderr: "", status: 0 };
      };
      const result = await codeDrift(FAKE_BODY, { rows: [], bodyConfig: {}, samples: {}, bodyEffective: {}, tools: ["stylelint", "cspell"], run, scratchDir: scratch });
      expect(result.stylelint).toEqual({ crashed: true, message: "boom" });
      expect(result.cspell).toEqual({ issues: 0 });
    } finally {
      fs.rmSync(scratch, { recursive: true, force: true });
    }
  });

  // T1 regression: the installed stylelint and @ls-lint/ls-lint write their real report to
  // stderr, not stdout, even on a non-zero exit with real findings — the old stdout-only read
  // (`defaultRun`'s execFileSync catch) turned every one of those findings into a false
  // "crashed". A `run` stub standing in for that real shape (status 1, the report on stderr,
  // nothing on stdout) must still produce counts.
  it("reads stylelint's report from stderr, not stdout, even at a non-zero exit", async () => {
    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-observe-test-"));
    try {
      const run = () => ({ stdout: "", stderr: JSON.stringify([{ warnings: [{}, {}] }, { warnings: [{}] }]), status: 2 });
      const result = await codeDrift(FAKE_BODY, { rows: [], bodyConfig: {}, samples: {}, bodyEffective: {}, tools: ["stylelint"], run, scratchDir: scratch });
      expect(result.stylelint).toEqual({ count: 3 });
    } finally {
      fs.rmSync(scratch, { recursive: true, force: true });
    }
  });

  it("reads ls-lint's report from stderr, not stdout, even at a non-zero exit", async () => {
    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-observe-test-"));
    try {
      const stderr = "apps/web/src/BadName.ts failed for `.ts` rules: kebabcase\napps/web/src/Other.ts failed for `.ts` rules: kebabcase\n";
      const run = () => ({ stdout: "", stderr, status: 1 });
      const result = await codeDrift(FAKE_BODY, { rows: [], bodyConfig: {}, samples: {}, bodyEffective: {}, tools: ["ls-lint"], run, scratchDir: scratch });
      expect(result["ls-lint"]).toEqual({ errors: 2 });
    } finally {
      fs.rmSync(scratch, { recursive: true, force: true });
    }
  });

  // T1 regression, the other direction: eslint's report stays on stdout, as before — this must
  // not regress when the other tools move to stderr.
  it("still reads eslint's violations report from stdout", async () => {
    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-observe-test-"));
    try {
      const eslintJson = JSON.stringify([{ filePath: "a.ts", messages: [{ ruleId: "no-var" }] }]);
      const run = () => ({ stdout: eslintJson, stderr: "some unrelated plugin warning\n", status: 1 });
      const result = await codeDrift(FAKE_BODY, { rows: [], bodyConfig: {}, samples: {}, bodyEffective: {}, tools: ["eslint"], run, scratchDir: scratch });
      expect(result.eslint.violations).toEqual({ "no-var": 1 });
    } finally {
      fs.rmSync(scratch, { recursive: true, force: true });
    }
  });

  // Minor: a scratch directory codeDrift creates itself (no scratchDir passed) is its own to
  // clean up; one the caller passed in is the caller's to keep (tests read its files).
  it("removes a scratch directory it creates itself, but not one the caller passed", async () => {
    const calls = [];
    const run = (command, args) => { calls.push(args); return { stdout: "[]", stderr: "", status: 0 }; };
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

  // T2: the installed syncpack (packages/orrery/node_modules/syncpack, a Rust binary) panics on
  // every `--config` invocation that has real work to do — reproduced directly against the
  // binary, not just through this code path (see this fix's report). The adopted shape drops
  // --config and relies on cosmiconfig-style discovery from the body's own root, exactly how
  // both donors' own package.json scripts invoke it. This is the one real (non-stubbed) run in
  // this file: it proves the fixture gets a parseable result through codeDrift's actual
  // invocation, not a mocked stand-in for one.
  it("runs the real syncpack against the fixture through codeDrift's own invocation and gets a parseable result, not crashed", async () => {
    const fixture = path.resolve(PACKAGE_DIR, "../../fixtures/next-supabase-mono");
    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-observe-test-"));
    try {
      const result = await codeDrift(fixture, {
        rows: [],
        bodyConfig: { class: "next-supabase-mono", tailwind: { entryPoint: "apps/web/src/app/globals.css" } },
        samples: {},
        bodyEffective: {},
        tools: ["syncpack"],
        scratchDir: scratch,
      });
      expect(result.syncpack).toBeTruthy();
      expect(result.syncpack.crashed).toBeFalsy();
      expect(typeof result.syncpack.mismatches).toBe("number");
    } finally {
      fs.rmSync(scratch, { recursive: true, force: true });
    }
  }, 30_000);
});

// C5: crash detection is status-aware for EVERY tool, not just the two whose parser happens to
// throw. Each of these tools exits non-zero on findings as well as on a crash, and each parser
// answers "no findings" when handed something that is not its report — so a panic, an OOM kill or
// a bad config used to be recorded as a clean run. One pair per tool: an empty-stream exit 2 is a
// crash; a real report at exit 1 is findings.
describe("codeDrift: a non-zero exit with no report is a crash, not a clean run", () => {
  const withScratch = async (fn) => {
    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-observe-crash-"));
    try {
      return await fn(scratch);
    } finally {
      fs.rmSync(scratch, { recursive: true, force: true });
    }
  };

  const drift = (tool, run, scratch) =>
    codeDrift(FAKE_BODY, { rows: [], bodyConfig: {}, samples: {}, bodyEffective: {}, tools: [tool], run, scratchDir: scratch });

  const CRASHED = { stdout: "", stderr: "", status: 2 };

  // The real report each tool writes when it really did find something, at its own exit code 1 and
  // on its own stream — measured shapes, the same ones the T1 stream tests above use.
  const REPORTS = {
    eslint: { run: () => ({ stdout: JSON.stringify([{ filePath: "a.ts", messages: [{ ruleId: "no-var" }] }]), stderr: "", status: 1 }), expect: (r) => expect(r.eslint.violations).toEqual({ "no-var": 1 }) },
    tsc: { run: () => ({ stdout: "apps/web/src/a.ts(1,1): error TS2307: Cannot find module.\n", stderr: "", status: 1 }), expect: (r) => expect(r.tsc).toEqual({ errors: { TS2307: 1 } }) },
    stylelint: { run: () => ({ stdout: "", stderr: JSON.stringify([{ warnings: [{}, {}] }]), status: 1 }), expect: (r) => expect(r.stylelint).toEqual({ count: 2 }) },
    cspell: { run: () => ({ stdout: "apps/web/src/a.ts:3:5 - Unknown word (teh)\n", stderr: "", status: 1 }), expect: (r) => expect(r.cspell).toEqual({ issues: 1 }) },
    "ls-lint": { run: () => ({ stdout: "", stderr: "apps/web/src/BadName.ts failed for `.ts` rules: kebabcase\n", status: 1 }), expect: (r) => expect(r["ls-lint"]).toEqual({ errors: 1 }) },
    syncpack: { run: () => ({ stdout: "", stderr: "\u2718 react 18.0.0 != 19.0.0\n", status: 1 }), expect: (r) => expect(r.syncpack).toEqual({ mismatches: 1 }) },
  };

  it.each(Object.keys(REPORTS))("%s: exit 2 with empty streams is crashed", async (tool) => {
    await withScratch(async (scratch) => {
      const result = await drift(tool, () => CRASHED, scratch);
      expect(result[tool].crashed, JSON.stringify(result[tool])).toBe(true);
      expect(result[tool].message).toContain(tool);
    });
  });

  it.each(Object.keys(REPORTS))("%s: a real report at exit 1 is findings", async (tool) => {
    await withScratch(async (scratch) => {
      const result = await drift(tool, REPORTS[tool].run, scratch);
      expect(result[tool].crashed, JSON.stringify(result[tool])).toBeUndefined();
      REPORTS[tool].expect(result);
    });
  });

  // jscpd is the one tool whose report is a FILE (-o), not a stream: the file is the evidence.
  it("jscpd: exit 2 with no report file written is crashed", async () => {
    await withScratch(async (scratch) => {
      const result = await drift("jscpd", () => CRASHED, scratch);
      expect(result.jscpd.crashed, JSON.stringify(result.jscpd)).toBe(true);
      expect(result.jscpd.message).toContain("jscpd");
    });
  });

  it("jscpd: a report file at exit 1 is findings", async () => {
    await withScratch(async (scratch) => {
      const run = () => {
        fs.writeFileSync(path.join(scratch, "jscpd-report.json"), JSON.stringify({ statistics: { total: { clones: 4 } } }));
        return { stdout: "", stderr: "", status: 1 };
      };
      const result = await drift("jscpd", run, scratch);
      expect(result.jscpd).toEqual({ clones: 4 });
    });
  });

  // The other direction: a clean run is a clean run, whatever its streams hold.
  it("reads exit 0 as clean for every tool", async () => {
    await withScratch(async (scratch) => {
      const result = await codeDrift(FAKE_BODY, {
        rows: [], bodyConfig: {}, samples: {}, bodyEffective: {},
        tools: ["eslint", "tsc", "stylelint", "cspell", "ls-lint", "syncpack"],
        run: () => ({ stdout: "", stderr: "", status: 0 }),
        scratchDir: scratch,
      });
      expect(Object.values(result).some((r) => r?.crashed)).toBe(false);
      expect(result.eslint.violations).toEqual({});
      expect(result.syncpack).toEqual({ mismatches: 0 });
    });
  });
});

// Minor: `apps packages scripts` is the class's shape, not every body's.
describe("codeDrift: eslint's sweep tolerates a directory the body does not have", () => {
  it("passes --no-error-on-unmatched-pattern", async () => {
    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-observe-unmatched-"));
    const calls = [];
    try {
      await codeDrift(FAKE_BODY, {
        rows: [], bodyConfig: {}, samples: {}, bodyEffective: {}, tools: ["eslint"],
        run: (command, args) => { calls.push(args); return { stdout: "[]", stderr: "", status: 0 }; },
        scratchDir: scratch,
      });
    } finally {
      fs.rmSync(scratch, { recursive: true, force: true });
    }
    const sweep = calls.find((a) => a.includes("apps") && a.includes("packages") && a.includes("scripts"));
    expect(sweep).toBeTruthy();
    expect(sweep).toContain("--no-error-on-unmatched-pattern");
  });
});

// C2/I5: `matches` is the third reader of a marker, and it used to ignore an attribute it did not
// understand exactly as the other two did.
describe("matches rejects an unknown marker attribute", () => {
  it("throws naming the attribute", () => {
    expect(() => matches({ a: 1 }, { $parameter: "x", base: "a" })).toThrow(/base/);
  });
});
