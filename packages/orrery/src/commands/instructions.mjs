import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { measureBody as realMeasureBody } from "../lib/instructions/measure.mjs";
import { renderInstructions } from "../lib/instructions/report.mjs";

const USAGE = "usage: orrery instructions <bodyDir>... [--touching body=path]... [--base <ref>|body=ref]... [--allow-lost <file.json>] [--report <dir>] [--label <name>]";

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
        base: { type: "string", multiple: true, default: [] },
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

  const names = positionals.map((p) => path.basename(path.resolve(p)).toLowerCase());
  const touching = {};
  for (const t of values.touching) {
    const eq = t.indexOf("=");
    if (eq < 1 || eq === t.length - 1) {
      console.error(`--touching expects body=path, got ${t}\n${USAGE}`);
      return 2;
    }
    const key = t.slice(0, eq).toLowerCase();
    const file = t.slice(eq + 1);
    if (!names.includes(key)) {
      console.error(`--touching names ${key}, which is not one of the bodies given (${names.join(", ")})\n${USAGE}`);
      return 2;
    }
    if (path.isAbsolute(file) || path.win32.isAbsolute(file) || file.split(/[\\/]/).includes("..")) {
      console.error(`--touching path for ${key} must be relative to the body and stay inside it, got ${file}\n${USAGE}`);
      return 2;
    }
    (touching[key] ??= []).push(file);
  }

  // A bare ref applies to every body; body=ref overrides it for that body.
  let sharedBase;
  const bases = {};
  for (const b of values.base) {
    const eq = b.indexOf("=");
    if (eq === -1) {
      if (sharedBase !== undefined) {
        console.error(`--base takes one bare ref, got ${sharedBase} and ${b}\n${USAGE}`);
        return 2;
      }
      sharedBase = b;
      continue;
    }
    const key = b.slice(0, eq).toLowerCase();
    const ref = b.slice(eq + 1);
    if (!names.includes(key)) {
      console.error(`--base names ${key}, which is not one of the bodies given (${names.join(", ")})\n${USAGE}`);
      return 2;
    }
    if (ref === "" || key in bases) {
      console.error(`--base expects one body=ref per body, got ${b}\n${USAGE}`);
      return 2;
    }
    bases[key] = ref;
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
  for (const [i, bodyDir] of positionals.entries()) {
    const name = names[i];
    const base = bases[name] ?? sharedBase;
    const m = d.measureBody(bodyDir, { touching: touching[name], base, allowLost });
    measures.push(m);
    if (m.error) {
      failed = true;
      console.error(`${m.body}: ${m.error}`);
      continue;
    }
    console.log(`${m.body}: start ${m.startup.tokens} tokens${m.task ? `, task ${m.task.tokens} tokens` : ""}`);
    for (const f of [...m.startup.files, ...(m.task?.added ?? [])]) console.log(`  ${f.path}  ${f.bytes} bytes  ${f.reason}`);
    for (const r of m.skippedRules ?? []) console.error(`${m.body}: skipped ${r}, unreadable`);
    if (m.over.startup) { failed = true; console.error(`${m.body}: over the start budget`); }
    if (m.over.task) { failed = true; console.error(`${m.body}: over the task budget`); }
    for (const o of m.oversize) { failed = true; console.error(`${m.body}: ${o.path} has ${o.lines} lines, limit is under ${o.limit}`); }
    if (m.lost?.length) {
      failed = true;
      console.error(`${m.body}: ${m.lost.length} paragraph(s) lost since ${base}`);
      for (const p of m.lost) console.log(`  lost: ${p}`);
    }
  }

  if (values.report) {
    const date = d.today();
    // Named by body, never by directory: the report is committed, and a local path is not for it.
    const command = ["orrery instructions", ...names, ...values.touching.map((t) => `--touching ${t}`), ...values.base.map((b) => `--base ${b}`), ...(values["allow-lost"] ? [`--allow-lost ${path.basename(values["allow-lost"])}`] : []), ...(values.label ? [`--label ${values.label}`] : [])].join(" ");
    const { md, json } = renderInstructions(measures, { date, label: values.label, command });
    fs.mkdirSync(values.report, { recursive: true });
    const stem = path.join(values.report, `${date}-instructions${values.label ? `-${values.label}` : ""}`);
    fs.writeFileSync(`${stem}.md`, md + "\n");
    fs.writeFileSync(`${stem}.json`, JSON.stringify(json, null, 2) + "\n");
    console.log(`report: ${stem}.md`);
  }

  return failed ? 1 : 0;
}
