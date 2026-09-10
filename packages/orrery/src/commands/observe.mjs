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

// Before adoption a body has no orrery.config.mjs of its own: observe falls back to the body's
// parameters recorded in docs/predictions/<name>.json when a prediction already exists, else the
// schema defaults with a placeholder tailwind entry point good enough to run the bundle against.
function fallbackBodyConfig(bodyDir) {
  const configFile = path.join(bodyDir, "orrery.config.mjs");
  if (fs.existsSync(configFile)) return loadBodyConfig(bodyDir).then((c) => c.config);
  return Promise.resolve({ class: "next-supabase-mono", tailwind: { entryPoint: "apps/*/src/app/globals.css" } });
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
    const bodyConfig = withDefaults(prediction?.bodyConfig ?? (await fallbackBodyConfig(bodyDir)), schema);

    const samples = values.surface
      ? Object.fromEntries(Object.entries(d.findSurfaceSamples(bodyDir)).filter(([s]) => s === values.surface))
      : d.findSurfaceSamples(bodyDir);

    const bodyEffective = {};
    for (const [surface, file] of Object.entries(samples)) {
      try {
        bodyEffective[surface] = d.readEffectiveConfig(bodyDir, file);
      } catch {
        bodyEffective[surface] = { rules: {} };
      }
    }

    const code = await d.codeDrift(bodyDir, { rows: rulings.rows, bodyConfig, samples, bodyEffective, tools: values.tools?.split(",") });
    const entry = { name, dir: bodyDir, sha, version, pointers, code };

    // A tool crashing (codeDrift catches per tool) never aborts the run: report it, fail the
    // exit code, and keep going — the report below is written regardless, crash included.
    for (const [tool, result] of Object.entries(code)) {
      if (result?.crashed) {
        failed = true;
        console.error(`${name}: ${tool} crashed: ${result.message}`);
      }
    }

    if (values.predict) {
      d.writePrediction(name, {
        body: name,
        sha,
        generatedAt: d.today(),
        bodyConfig,
        tightened: code.eslint?.tightened ?? [],
        counts: code.eslint?.violations ?? {},
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
