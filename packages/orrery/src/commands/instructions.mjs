import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { measureBody as realMeasureBody } from "../lib/instructions/measure.mjs";
import { renderInstructions } from "../lib/instructions/report.mjs";

const USAGE = "usage: orrery instructions <bodyDir>... [--touching body=path]... [--base <ref>] [--allow-lost <file.json>] [--report <dir>] [--label <name>]";

const defaults = {
  measureBody: realMeasureBody,
  today: () => new Date().toISOString().slice(0, 10),
};

export default async function instructions(argv, deps = {}) {
  const d = { ...defaults, ...deps };
  let values, positionals;
  try {
    ({ values, positionals } = parseArgs({
      args: argv,
      options: {
        touching: { type: "string", multiple: true, default: [] },
        base: { type: "string" },
        "allow-lost": { type: "string" },
        report: { type: "string" },
        label: { type: "string" },
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

  const touching = {};
  for (const t of values.touching) {
    const eq = t.indexOf("=");
    if (eq < 1 || eq === t.length - 1) {
      console.error(`--touching expects body=path, got ${t}\n${USAGE}`);
      return 2;
    }
    (touching[t.slice(0, eq).toLowerCase()] ??= []).push(t.slice(eq + 1));
  }

  let allowLost = [];
  if (values["allow-lost"]) {
    try {
      allowLost = JSON.parse(fs.readFileSync(values["allow-lost"], "utf8"));
      if (!Array.isArray(allowLost)) throw new Error("expected a JSON array of paragraphs");
    } catch (error) {
      console.error(`--allow-lost: ${error.message}`);
      return 2;
    }
  }

  let failed = false;
  const measures = [];
  for (const bodyDir of positionals) {
    const name = path.basename(path.resolve(bodyDir)).toLowerCase();
    const m = d.measureBody(bodyDir, { touching: touching[name], base: values.base, allowLost });
    measures.push(m);
    if (m.error) {
      failed = true;
      console.error(`${m.body}: ${m.error}`);
      continue;
    }
    console.log(`${m.body}: start ${m.startup.tokens} tokens${m.task ? `, task ${m.task.tokens} tokens` : ""}`);
    for (const f of [...m.startup.files, ...(m.task?.added ?? [])]) console.log(`  ${f.path}  ${f.bytes} bytes  ${f.reason}`);
    if (m.over.startup) { failed = true; console.error(`${m.body}: over the start budget`); }
    if (m.over.task) { failed = true; console.error(`${m.body}: over the task budget`); }
    for (const o of m.oversize) { failed = true; console.error(`${m.body}: ${o.path} has ${o.lines} lines, limit is under ${o.limit}`); }
    if (m.lost?.length) {
      failed = true;
      console.error(`${m.body}: ${m.lost.length} paragraph(s) lost since ${values.base}`);
      for (const p of m.lost) console.log(`  lost: ${p}`);
    }
  }

  if (values.report) {
    const date = d.today();
    const { md, json } = renderInstructions(measures, { date, label: values.label, command: `orrery instructions ${argv.join(" ")}` });
    fs.mkdirSync(values.report, { recursive: true });
    const stem = path.join(values.report, `${date}-instructions${values.label ? `-${values.label}` : ""}`);
    fs.writeFileSync(`${stem}.md`, md + "\n");
    fs.writeFileSync(`${stem}.json`, JSON.stringify(json, null, 2) + "\n");
    console.log(`report: ${stem}.md`);
  }

  return failed ? 1 : 0;
}
