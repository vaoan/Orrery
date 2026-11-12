import path from "node:path";
import { frontmatter, unquote, readFile, skillText, tokens } from "../instructions/measure.mjs";
import { discoverInstructionFiles, listBodyFiles } from "../instructions/discover.mjs";
import { bodyContext, checkText } from "../references/resolve.mjs";

export const MAX_DESCRIPTION = 1024;
// The skill listing is budgeted at 1% of the context window (docs/specs/2026-11-06-ai-layer-design.md:80);
// 1% of a 200,000-token window is 2,000 tokens.
export const SKILL_LISTING_BUDGET = 2000;
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
// "Use when", "when ", "use this", "before ", "after ", "proactively", or "for ... when": a bare "used" or "if" says nothing.
const WHEN = /\bwhen\b|\buse this\b|\bbefore\b|\bafter\b|\bproactively\b/i;
export const KNOWN_TOOLS = new Set(["Bash", "BashOutput", "KillShell", "KillBash", "Read", "Write", "Edit", "MultiEdit", "NotebookEdit", "NotebookRead", "Glob", "Grep", "LS", "WebFetch", "WebSearch", "Task", "Agent", "TodoWrite", "ExitPlanMode", "EnterPlanMode", "Skill", "SlashCommand", "AskUserQuestion", "Monitor", "TaskStop", "TaskOutput", "LSP", "EnterWorktree", "ExitWorktree", "ToolSearch", "ListMcpResourcesTool", "ReadMcpResourceTool"]);

// A small reader for the subset of YAML that skill and agent frontmatter uses: scalars, folded and
// literal blocks, flow lists and dash lists.
export function parseFields(text) {
  const fm = frontmatter(text);
  if (!fm) return { error: "no frontmatter" };
  const fields = {};
  let key = null;
  for (const l of fm) {
    if (l.trim() === "" || /^\s*#/.test(l)) continue;
    const m = /^([A-Za-z][\w-]*)\s*:\s*(.*)$/.exec(l);
    if (m && !/^\s/.test(l)) { key = m[1]; const v = m[2].trim(); fields[key] = /^[>|][+-]?$/.test(v) ? "" : v; continue; }
    if (key === null) return { error: `cannot parse frontmatter line: ${l.trim().slice(0, 40)}` };
    if (/^\s*-\s+/.test(l)) { if (!Array.isArray(fields[key])) fields[key] = fields[key] ? [fields[key]] : []; fields[key].push(l.replace(/^\s*-\s+/, "").trim()); }
    else if (/^\s/.test(l)) fields[key] = `${fields[key] ?? ""} ${l.trim()}`.trim();
    else return { error: `cannot parse frontmatter line: ${l.trim().slice(0, 40)}` };
  }
  return { fields };
}

function splitTools(v) {
  const list = Array.isArray(v) ? v : [v.replace(/^\[|\]$/g, "")];
  const out = [];
  for (const item of list) {
    let depth = 0, cur = "";
    for (const c of item) {
      if (c === "(") depth++;
      if (c === ")") depth--;
      if (c === "," && depth === 0) { out.push(cur); cur = ""; } else cur += c;
    }
    out.push(cur);
  }
  return out.map((t) => unquote(t.trim())).filter(Boolean);
}

export function validateSkills(dir) {
  const body = path.basename(path.resolve(dir)).toLowerCase();
  const listed = listBodyFiles(dir);
  const found = discoverInstructionFiles(dir, listed);
  const failures = [];
  const ctx = bodyContext(dir, listed);
  let descBytes = 0;
  const fail = (file, what) => failures.push({ file, what });

  const check = (rel, expectedName, isAgent) => {
    const text = readFile(dir, rel);
    if (!isAgent) descBytes += Buffer.byteLength(skillText(text));
    const { fields, error } = parseFields(text);
    if (error) return fail(rel, error);
    const name = unquote(fields.name ?? "");
    if (!name) fail(rel, "name is missing");
    else if (!KEBAB.test(name)) fail(rel, `name ${name} is not kebab-case`);
    else if (name !== expectedName) fail(rel, `name ${name} does not match ${isAgent ? "the file" : "the directory"} name ${expectedName}`);
    const description = unquote(Array.isArray(fields.description) ? fields.description.join(" ") : fields.description ?? "");
    if (!description) fail(rel, "description is missing or empty");
    else {
      if (description.length > MAX_DESCRIPTION) fail(rel, `description is ${description.length} characters, the limit is ${MAX_DESCRIPTION}`);
      if (!WHEN.test(description)) fail(rel, "description says what it is but not when to use it");
    }
    if (isAgent && fields.tools !== undefined) {
      for (const t of splitTools(fields.tools)) {
        const base = t.replace(/\(.*$/, "");
        if (!KNOWN_TOOLS.has(base) && !base.startsWith("mcp__")) fail(rel, `tools lists ${base}, which is not a known tool`);
      }
    }
    for (const b of checkText(ctx, rel, text).broken) fail(rel, `line ${b.line}: ${b.token} (${b.reason})`);
  };

  for (const rel of found.skills) check(rel, rel.split("/")[2], false);
  for (const rel of found.agents) check(rel, path.posix.basename(rel, ".md"), true);

  const descriptionTokens = tokens(descBytes);
  if (descriptionTokens > SKILL_LISTING_BUDGET) fail("(all descriptions)", `descriptions total ${descriptionTokens} tokens, over the listing budget of ${SKILL_LISTING_BUDGET}`);
  return { body, skills: found.skills.length, agents: found.agents.length, descriptionTokens, budget: SKILL_LISTING_BUDGET, failures };
}
