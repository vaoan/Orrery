import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { findSurfaceSamples as realFind } from "../lib/surfaces.mjs";
import { readDonor as realReadDonor } from "../lib/donors.mjs";
import { reconcileEslint } from "../lib/reconcile/eslint.mjs";
import { reconcileTsconfig } from "../lib/reconcile/tsconfig.mjs";
import { reconcileStylelint } from "../lib/reconcile/stylelint.mjs";
import { reconcilePrettier, reconcileSecretlint, reconcileJscpd, reconcileCspell, reconcileLintStaged, reconcileHooks, reconcileLsLint } from "../lib/reconcile/simple.mjs";
import { reconcileKnip } from "../lib/reconcile/knip.mjs";
import { reconcileSyncpack } from "../lib/reconcile/syncpack.mjs";
import { renderRecord, RECORD_NUMBERS } from "../lib/records.mjs";

const USAGE = "usage: orrery reconcile <repoA> <repoB> [--sample surface=path]... [--out <dir>] [--json]";

const TOOLS = [
  ["eslint", (a, b) => reconcileEslint(a.eslint, b.eslint)],
  ["tsconfig", (a, b) => reconcileTsconfig(a.tsconfig, b.tsconfig)],
  ["stylelint", (a, b) => reconcileStylelint(a.stylelint, b.stylelint)],
  ["prettier", (a, b) => reconcilePrettier(a.prettier, b.prettier)],
  ["secretlint", (a, b) => reconcileSecretlint(a.secretlint, b.secretlint)],
  ["jscpd", (a, b) => reconcileJscpd(a.jscpd, b.jscpd)],
  ["cspell", (a, b) => reconcileCspell(a.cspell, b.cspell)],
  ["ls-lint", () => reconcileLsLint()],
  ["knip", (a, b) => reconcileKnip(a.knip, b.knip)],
  ["syncpack", (a, b) => reconcileSyncpack(a.syncpack, b.syncpack)],
  ["lint-staged", (a, b) => reconcileLintStaged(a.lintStaged, b.lintStaged)],
  ["hooks", (a, b) => reconcileHooks(a.hooks, b.hooks)],
];

export default async function reconcile(argv, deps = {}) {
  const { findSurfaceSamples = realFind, readDonor = realReadDonor, today = new Date() } = deps;
  let values, positionals;
  try {
    ({ values, positionals } = parseArgs({ args: argv, options: { sample: { type: "string", multiple: true, default: [] }, out: { type: "string", default: "docs/decisions" }, json: { type: "boolean", default: false } }, allowPositionals: true }));
  } catch (error) {
    console.error(`${error.message}\n${USAGE}`);
    return 2;
  }
  const [repoA, repoB] = positionals;
  if (!repoA || !repoB) { console.error(USAGE); return 2; }

  const overrides = {};
  for (const s of values.sample) {
    const [surface, file] = s.split("=");
    if (!surface || !file) { console.error(`bad --sample ${s}; expected surface=path\n${USAGE}`); return 2; }
    overrides[surface] = file;
  }

  try {
    const samplesA = findSurfaceSamples(repoA, overrides);
    const samplesB = findSurfaceSamples(repoB, overrides);
    const a = await readDonor(repoA, samplesA);
    const b = await readDonor(repoB, samplesB);
    const name = (dir) => path.basename(dir).toLowerCase();
    const provenance = { date: today.toISOString().slice(0, 10), a: { name: name(repoA), dir: repoA, sha: a.sha, samples: samplesA }, b: { name: name(repoB), dir: repoB, sha: b.sha, samples: samplesB } };

    const rows = [];
    fs.mkdirSync(values.out, { recursive: true });
    for (const [tool, run] of TOOLS) {
      const toolRows = run(a, b).map((r) => ({ ...r, tool }));
      rows.push(...toolRows);
      fs.writeFileSync(path.join(values.out, `${String(RECORD_NUMBERS[tool]).padStart(4, "0")}-${tool}.md`), renderRecord({ number: RECORD_NUMBERS[tool], tool, rows: toolRows, provenance }) + "\n");
      const counts = {};
      for (const r of toolRows) counts[r.test] = (counts[r.test] ?? 0) + 1;
      console.log(`${tool.padEnd(12)}${Object.entries(counts).map(([t, n]) => `${t} ${n}`).join("  ")}`);
    }
    fs.writeFileSync(path.join(values.out, "rulings.json"), JSON.stringify({ provenance, rows }, null, 2) + "\n");
    if (values.json) console.log(JSON.stringify({ provenance, rows }, null, 2));

    const residue = rows.filter((r) => r.test === "residue");
    if (residue.length > 0) {
      console.error(`\nresidue — ${residue.length} row(s) need a ruling before the bundle can be generated:`);
      for (const r of residue) console.error(`  ${r.tool} ${r.surface} ${r.key}: ${JSON.stringify(r.a)} vs ${JSON.stringify(r.b)}`);
      return 1;
    }
    return 0;
  } catch (error) {
    console.error(error.message);
    return 1;
  }
}
