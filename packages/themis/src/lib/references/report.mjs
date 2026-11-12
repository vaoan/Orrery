// Renders check results to a markdown report and its json twin. Bodies are named, never located, and
// the only file text that appears is the reference token itself.
const rows = (items, cols) => items.map((i) => `| ${cols.map((c) => String(i[c] ?? "").replace(/\|/g, "\\|")).join(" | ")} |`);
const table = (title, items, cols) => items.length ? [title, "", `| ${cols.join(" | ")} |`, `|${cols.map(() => "---").join("|")}|`, ...rows(items, cols), ""] : [];

export function renderReferences(results, { date, label, command }) {
  const json = { date, label: label ?? null, command, brokenCount: results.reduce((n, r) => n + (r.broken?.length ?? 0), 0), bodies: results };
  const md = [`# References${label ? `: ${label}` : ""}`, "", `Date: ${date}`, "", `Command: \`${command}\``, "", "Each link, backticked path, pnpm script, themis command and skill name an instruction file mentions, checked against the body. Exceptions are skipped on purpose and listed; external names are plugin skills, accepted without verification.", ""];
  for (const r of results) {
    md.push(`## ${r.body}`, "");
    if (r.error) { md.push(`Error: ${r.error}`, ""); continue; }
    md.push(`Files read: ${r.files}, references checked: ${r.checked}, broken: ${r.broken.length}, exceptions: ${r.exceptions.length}, external: ${r.external.length}`, "");
    md.push(...table("Broken:", r.broken, ["file", "line", "kind", "token", "reason"]));
    md.push(...table("Exceptions:", r.exceptions, ["file", "line", "kind", "token", "why"]));
    md.push(...table("External:", r.external, ["file", "line", "token", "plugin"]));
  }
  return { md: md.join("\n"), json };
}

export function renderSkills(results, { date, label, command }) {
  const json = { date, label: label ?? null, command, failureCount: results.reduce((n, r) => n + (r.failures?.length ?? 0), 0), bodies: results };
  const md = [`# Skills and agents${label ? `: ${label}` : ""}`, "", `Date: ${date}`, "", `Command: \`${command}\``, ""];
  for (const r of results) {
    md.push(`## ${r.body}`, "");
    if (r.error) { md.push(`Error: ${r.error}`, ""); continue; }
    md.push(`Skills: ${r.skills}, agents: ${r.agents}, description tokens: ${r.descriptionTokens} of ${r.budget}, failures: ${r.failures.length}`, "");
    md.push(...table("Failures:", r.failures, ["file", "what"]));
  }
  return { md: md.join("\n"), json };
}
