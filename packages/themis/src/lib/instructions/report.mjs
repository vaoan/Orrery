// Renders measures to a markdown report and its json twin. Only file names and numbers go in:
// the text of a lost paragraph never does, only how many there were.
export function renderInstructions(measures, { date, label, command }) {
  const bodies = measures.map(({ lost, ...rest }) => ({ ...rest, lostCount: lost ? lost.length : null }));
  const json = { date, label: label ?? null, command, lostCount: bodies.some((b) => b.lostCount !== null) ? bodies.reduce((n, b) => n + (b.lostCount ?? 0), 0) : null, bodies };

  const md = [`# Instruction load${label ? `: ${label}` : ""}`, "", `Date: ${date}`, "", `Command: \`${command}\``, "", "Tokens are bytes divided by 3. Budgets: 10,000 at start, 25,000 in a task.", "", "Start excludes skill descriptions (shown separately), `.claude/agents` descriptions, plugin and user-level injections, and MCP servers, and the task figure excludes lessons Claude follows a link to.", ""];
  for (const b of measures) {
    md.push(`## ${b.body}${b.sha ? ` (${b.sha})` : ""}`, "");
    if (b.error) { md.push(`Error: ${b.error}`, ""); continue; }
    md.push(`Start: ${b.startup.tokens} tokens${b.over.startup ? " (OVER BUDGET)" : ""}`);
    if (b.task) md.push(`Task: ${b.task.tokens} tokens${b.over.task ? " (OVER BUDGET)" : ""}`);
    md.push(`Skills: ${b.skills.count}, ${b.skills.descriptionTokens} description tokens (not in the budget)`);
    if (b.lost) md.push(`Lost paragraphs: ${b.lost.length}`);
    md.push("", "| File | Bytes | Loaded as | When |", "|---|---|---|---|");
    for (const f of b.startup.files) md.push(`| ${f.path} | ${f.bytes} | ${f.reason} | start |`);
    for (const f of b.task?.added ?? []) md.push(`| ${f.path} | ${f.bytes} | ${f.reason} | task |`);
    md.push("");
    if (b.wideRules.length) md.push("Wide rules (counted at start):", ...b.wideRules.map((r) => `- ${r.path}: ${(r.share * 100).toFixed(1)}% of source files`), "");
    if (b.skippedRules?.length) md.push("Skipped, unreadable:", ...b.skippedRules.map((r) => `- ${r}`), "");
    if (b.oversize.length) md.push("Oversize:", ...b.oversize.map((o) => `- ${o.path}: ${o.lines} lines, limit ${o.limit}`), "");
  }
  return { md: md.join("\n"), json };
}
