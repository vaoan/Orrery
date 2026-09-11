import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { findSurfaceSamples } from "../lib/surfaces.mjs";
import { readEffectiveConfig } from "../lib/effective-config.mjs";
import { versionDrift as realVersionDrift } from "../lib/observe/version.mjs";
import { pointerDrift as realPointerDrift } from "../lib/observe/pointers.mjs";
import { codeDrift as realCodeDrift, compareToPrediction } from "../lib/observe/code.mjs";
import { renderObservation } from "../lib/observe/report.mjs";
import { loadBodyConfig, withDefaults } from "../lib/body-config.mjs";
import schema from "../../classes/next-supabase-mono/schema.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../../..");
const USAGE = "usage: orrery observe <bodyDir>... [--predict] [--report <dir>] [--tools a,b] [--surface <name>]";

const defaults = {
  findSurfaceSamples,
  readEffectiveConfig,
  versionDrift: realVersionDrift,
  pointerDrift: realPointerDrift,
  codeDrift: realCodeDrift,
  loadRulings: () => JSON.parse(fs.readFileSync(path.join(repoRoot, "docs/decisions/rulings.json"), "utf8")),
  loadPrediction: (name) => {
    const f = path.join(repoRoot, "docs/predictions", `${name}.json`);
    return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : null;
  },
  writePrediction: (name, prediction) => {
    const dir = path.join(repoRoot, "docs/predictions");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(prediction, null, 2) + "\n");
  },
  today: () => new Date().toISOString().slice(0, 10),
};

// I2: a body that HAS an orrery.config.mjs is governed by it, full stop. The prediction's
// `bodyConfig` is a record of what a body's parameters were when the prediction was taken —
// useful before adoption, when the body has no config of its own, and wrong the moment it does:
// observing a body against parameters it no longer holds proves nothing about the body.
// Before adoption the order is: the prediction's recorded parameters, else the schema defaults
// with a placeholder tailwind entry point good enough to run the bundle against.
async function resolveBodyConfig(bodyDir, prediction) {
  const configFile = path.join(bodyDir, "orrery.config.mjs");
  if (fs.existsSync(configFile)) return { config: (await loadBodyConfig(bodyDir)).config, source: "the body's own orrery.config.mjs" };
  if (prediction?.bodyConfig) return { config: prediction.bodyConfig, source: "the prediction's recorded bodyConfig" };
  return { config: { class: "next-supabase-mono", tailwind: { entryPoint: "apps/*/src/app/globals.css" } }, source: "the schema defaults" };
}

// I1: a pointer file that a body has but that no longer matches the template, a local override
// that breaks the "named files only" rule, and an orrery.config.mjs the schema rejects are all
// drift the run must FAIL on, not merely mention in the report. The one state that is not a
// failure is `["missing"]` — a body before adoption has no config of its own and no pointer files
// yet, and observing it is exactly what `--predict` is for. A `differs` only counts once the body
// has at least one pointer file the template actually placed there, which is what separates "has
// not adopted Orrery" from "adopted Orrery and drifted": a body before adoption has an
// eslint.config.mjs and a .husky/pre-commit of its very own, at exactly the paths the templates
// use, and every one of them reads as `differs` — measured against both donors, where nothing is
// `identical` at all. One identical pointer is the evidence that the body was adopted, and from
// then on a pointer that stops matching is drift the run must fail on. The remaining hole is small
// and deliberate: a body that drifts EVERY pointer at once reads as un-adopted again.
export function pointerFailures(pointers) {
  const failures = [];
  const config = pointers?.config ?? [];
  const configErrors = config.filter((e) => e !== "missing");
  if (configErrors.length > 0) failures.push(`orrery.config.mjs is invalid: ${configErrors.join("; ")}`);
  for (const violation of pointers?.local ?? []) failures.push(`eslint.local.mjs: ${violation}`);
  const files = pointers?.files ?? [];
  if (files.some((f) => f.state === "identical")) {
    for (const f of files.filter((f) => f.state === "differs")) failures.push(`${f.path} differs from the template it points at`);
  }
  return failures;
}

export default async function observe(argv, deps = {}) {
  const d = { ...defaults, ...deps };
  let values, positionals;
  try {
    ({ values, positionals } = parseArgs({
      args: argv,
      options: {
        predict: { type: "boolean", default: false },
        report: { type: "string", default: path.join(repoRoot, "docs/observations") },
        tools: { type: "string" },
        surface: { type: "string" },
      },
      allowPositionals: true,
    }));
  } catch (error) {
    console.error(`${error.message}\n${USAGE}`);
    return 2;
  }
  if (positionals.length === 0) {
    console.error(USAGE);
    return 2;
  }

  const rulings = d.loadRulings();
  const templates = path.join(repoRoot, "packages/orrery/templates/next-supabase-mono");
  const results = [];
  let failed = false;

  for (const bodyDir of positionals) {
    const name = path.basename(bodyDir).toLowerCase();
    let sha = null;
    try {
      sha = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: bodyDir, encoding: "utf8" }).trim();
    } catch {
      // Not a git checkout (e.g. a test fixture path) — sha stays null.
    }

    const version = d.versionDrift(bodyDir);
    const pointers = await d.pointerDrift(bodyDir, templates, schema);

    const prediction = d.loadPrediction(name);
    const resolved = await resolveBodyConfig(bodyDir, prediction);
    const bodyConfig = withDefaults(resolved.config, schema);

    const pointerProblems = pointerFailures(pointers);
    if (pointerProblems.length > 0) {
      failed = true;
      console.error(`${name}: pointer drift:\n  ${pointerProblems.join("\n  ")}`);
    }

    const samples = values.surface
      ? Object.fromEntries(Object.entries(d.findSurfaceSamples(bodyDir)).filter(([s]) => s === values.surface))
      : d.findSurfaceSamples(bodyDir);

    // I2: the body's own effective config is what "did the bundle tighten this rule" is measured
    // against. Swallowing a failure to read it and substituting `{ rules: {} }` does not degrade
    // gracefully — it reports every ruled rule as tightened, which reads as a clean run with a
    // large prediction, so the failure disappears into a number nobody can check.
    const bodyEffective = {};
    const bodyEffectiveError = [];
    for (const [surface, file] of Object.entries(samples)) {
      try {
        bodyEffective[surface] = d.readEffectiveConfig(bodyDir, file);
      } catch (error) {
        bodyEffective[surface] = { rules: {} };
        bodyEffectiveError.push(`${surface} (${file}): ${error.message}`);
      }
    }
    if (bodyEffectiveError.length > 0) {
      failed = true;
      console.error(`${name}: could not read the body's own effective config:\n  ${bodyEffectiveError.join("\n  ")}`);
    }

    const code = await d.codeDrift(bodyDir, { rows: rulings.rows, bodyConfig, samples, bodyEffective, tools: values.tools?.split(",") });
    const entry = { name, dir: bodyDir, sha, version, pointers, code, bodyConfigSource: resolved.source, ...(bodyEffectiveError.length ? { bodyEffectiveError } : {}) };

    // A tool crashing (codeDrift catches per tool) never aborts the run: report it, fail the
    // exit code, and keep going — the report below is written regardless, crash included.
    for (const [tool, result] of Object.entries(code)) {
      if (result?.crashed) {
        failed = true;
        console.error(`${name}: ${tool} crashed: ${result.message}`);
      }
    }

    if (values.predict) {
      const tightened = code.eslint?.tightened ?? [];
      const counts = code.eslint?.violations ?? {};
      // T4a: everything violated but not tightened is recorded as this run's baseline —
      // informational, not a failure — so a later, non-predict run can tell "already known, no
      // worse than this" (baseline) from "new, or got worse" (unexplained).
      const tightenedSet = new Set(tightened);
      const baseline = Object.fromEntries(Object.entries(counts).filter(([r]) => r !== "(fatal)" && !tightenedSet.has(r)));
      d.writePrediction(name, {
        body: name,
        sha,
        generatedAt: d.today(),
        bodyConfig,
        tightened,
        counts,
        baseline,
        tools: Object.fromEntries(Object.entries(code).filter(([t]) => t !== "eslint")),
      });
      console.log(`${name}: prediction written`);
    } else if (!prediction) {
      console.error(`${name}: no prediction for ${name}; run with --predict to record one`);
      failed = true;
    } else if (code.eslint && !code.eslint.crashed) {
      entry.comparison = compareToPrediction(code.eslint.violations, prediction);
      if (code.eslint.mismatches.length) {
        failed = true;
        console.error(`${name}: eslint effective config mismatch(es):\n  ${code.eslint.mismatches.join("\n  ")}`);
      }
      if (entry.comparison.unexplained.length) {
        failed = true;
        console.error(`${name}: unexplained violations from rules the rulings did not tighten: ${entry.comparison.unexplained.join(", ")}`);
      }
    }

    results.push(entry);
  }

  fs.mkdirSync(values.report, { recursive: true });
  const stem = path.join(values.report, `${d.today()}-tooling`);
  fs.writeFileSync(`${stem}.md`, renderObservation(results, d.today()) + "\n");
  fs.writeFileSync(`${stem}.json`, JSON.stringify(results, null, 2) + "\n");
  console.log(`report: ${stem}.md`);

  return failed ? 1 : 0;
}
