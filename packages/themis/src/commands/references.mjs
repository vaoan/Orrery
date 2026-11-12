import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { discoverInstructionFiles, readFile } from "../lib/instructions/measure.mjs";
import { bodyContext, checkFiles } from "../lib/references/resolve.mjs";
import { renderReferences } from "../lib/references/report.mjs";

const USAGE = "usage: themis references <bodyDir>... [--report <dir>] [--label <name>]";
const defaults = { today: () => new Date().toISOString().slice(0, 10) };

export function writeReport(dir, kind, label, date, { md, json }) {
  fs.mkdirSync(dir, { recursive: true });
  const stem = path.join(dir, `${date}-${kind}${label ? `-${label}` : ""}`);
  fs.writeFileSync(`${stem}.md`, md + "\n");
  fs.writeFileSync(`${stem}.json`, JSON.stringify(json, null, 2) + "\n");
  console.log(`report: ${stem}.md`);
}

export function checkBody(dir) {
  const body = path.basename(path.resolve(dir)).toLowerCase();
  if (readFile(dir, "CLAUDE.md") === null) return { body, error: "no CLAUDE.md at the root" };
  const found = discoverInstructionFiles(dir);
  const files = [...found.claude, ...found.rules.filter((r) => readFile(dir, r) !== null), ...found.skills, ...found.agents, ...found.lessons];
  const r = checkFiles(bodyContext(dir), files);
  return { body, files: files.length, ...r };
}

export default async function references(argv, deps = {}) {
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
    const r = checkBody(dir);
    results.push(r);
    if (r.error) { failed = true; console.error(`${r.body}: ${r.error}`); continue; }
    console.log(`${r.body}: ${r.checked} references checked, ${r.broken.length} broken, ${r.exceptions.length} exceptions, ${r.external.length} external`);
    for (const b of r.broken) { failed = true; console.error(`${r.body}: ${b.file}:${b.line}: ${b.token} (${b.reason})`); }
  }
  if (values.report) {
    const names = positionals.map((p) => path.basename(path.resolve(p)).toLowerCase());
    const command = ["themis references", ...names, ...(values.label ? [`--label ${values.label}`] : [])].join(" ");
    const date = d.today();
    writeReport(values.report, "references", values.label, date, renderReferences(results, { date, label: values.label, command }));
  }
  return failed ? 1 : 0;
}
