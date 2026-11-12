import path from "node:path";
import { parseArgs } from "node:util";
import { validateSkills } from "../lib/skills/validate.mjs";
import { renderSkills } from "../lib/references/report.mjs";
import { writeReport } from "./references.mjs";

const USAGE = "usage: themis skills <bodyDir>... [--report <dir>] [--label <name>]";
const defaults = { today: () => new Date().toISOString().slice(0, 10) };

export default async function skills(argv, deps = {}) {
  const d = { ...defaults, ...deps };
  let values, positionals;
  try {
    ({ values, positionals } = parseArgs({ args: argv, options: { report: { type: "string" }, label: { type: "string" } }, allowPositionals: true }));
  } catch (error) {
    console.error(`${error.message}\n${USAGE}`);
    return 2;
  }
  if (positionals.length === 0) { console.error(USAGE); return 2; }

  let failed = false;
  const results = [];
  for (const dir of positionals) {
    const r = validateSkills(dir);
    results.push(r);
    console.log(`${r.body}: ${r.skills} skills, ${r.agents} agents, ${r.descriptionTokens} description tokens, ${r.failures.length} failures`);
    for (const f of r.failures) { failed = true; console.error(`${r.body}: ${f.file}: ${f.what}`); }
  }
  if (values.report) {
    const names = positionals.map((p) => path.basename(path.resolve(p)).toLowerCase());
    const command = ["themis skills", ...names, ...(values.label ? [`--label ${values.label}`] : [])].join(" ");
    const date = d.today();
    writeReport(values.report, "skills", values.label, date, renderSkills(results, { date, label: values.label, command }));
  }
  return failed ? 1 : 0;
}
