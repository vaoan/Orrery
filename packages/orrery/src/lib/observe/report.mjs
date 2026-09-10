// One markdown document per observation run, with a section per body.
export function renderObservation(results, date) {
  const lines = [`# Tooling observation — ${date}`, ""];
  for (const r of results) {
    lines.push(`## ${r.name} (${r.dir}${r.sha ? ` @ ${r.sha}` : ""})`, "");
    lines.push(`- version: ${r.version.note}`);
    lines.push(
      `- pointers: ${r.pointers.files.filter((f) => f.state === "identical").length} identical, ${r.pointers.files.filter((f) => f.state === "differs").length} differ, ${r.pointers.files.filter((f) => f.state === "missing").length} missing; local ${r.pointers.local.length} violation(s); config ${r.pointers.config.join(", ") || "valid"}`
    );
    if (r.code?.eslint) {
      lines.push(`- eslint effective config: ${r.code.eslint.mismatches.length === 0 ? "matches the rulings on every surface" : `${r.code.eslint.mismatches.length} mismatch(es)`}`);
      lines.push("", "| rule | violations |", "|---|---|");
      for (const [rule, n] of Object.entries(r.code.eslint.violations)) lines.push(`| ${rule} | ${n} |`);
      if (r.comparison) {
        lines.push(
          "",
          `unexplained: ${r.comparison.unexplained.join(", ") || "none"}; moved: ${r.comparison.moved.map((m) => `${m.rule} ${m.was}→${m.now}`).join(", ") || "none"}; new: ${r.comparison.newRules.join(", ") || "none"}; resolved: ${r.comparison.resolved.join(", ") || "none"}`
        );
      }
    }
    for (const tool of ["tsc", "stylelint", "jscpd", "cspell", "ls-lint", "syncpack"]) if (r.code?.[tool]) lines.push(`- ${tool}: ${JSON.stringify(r.code[tool])}`);
    if (r.code?.eslint?.mismatches?.length) {
      lines.push("", "### eslint mismatches", "");
      for (const m of r.code.eslint.mismatches) lines.push(`- ${m}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
