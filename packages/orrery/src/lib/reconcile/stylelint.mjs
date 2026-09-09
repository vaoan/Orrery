import { row, same, union } from "./simple.mjs";

const isOff = (v) => v === null || v === undefined || v === false;

export function reconcileStylelint(a, b) {
  const rows = [];
  a ??= {}; b ??= {};
  if (a.extends || b.extends) rows.push(row("stylelint", "extends", { a: a.extends ?? null, b: b.extends ?? null, chosen: union([].concat(a.extends ?? []), [].concat(b.extends ?? [])), test: same(a.extends, b.extends) ? "agree" : "strictest", tier: "class", note: "more presets check more" }));
  const ra = a.rules ?? {};
  const rb = b.rules ?? {};
  for (const key of union(Object.keys(ra), Object.keys(rb))) {
    const va = ra[key];
    const vb = rb[key];
    const k = `rules.${key}`;
    const base = { a: va === undefined ? null : va, b: vb === undefined ? null : vb, tier: "class" };
    if (same(va, vb)) { rows.push(row("stylelint", k, { ...base, chosen: va, test: "agree" })); continue; }
    if (isOff(va) && !isOff(vb)) { rows.push(row("stylelint", k, { ...base, chosen: vb, test: va === undefined ? "adopt" : "strictest", note: va === undefined ? "" : "on over off" })); continue; }
    if (isOff(vb) && !isOff(va)) { rows.push(row("stylelint", k, { ...base, chosen: va, test: vb === undefined ? "adopt" : "strictest", note: vb === undefined ? "" : "on over off" })); continue; }
    if (key === "at-rule-no-unknown" && Array.isArray(va) && Array.isArray(vb)) {
      const merged = [true, { ...(va[1] ?? {}), ...(vb[1] ?? {}), ignoreAtRules: union(va[1]?.ignoreAtRules ?? [], vb[1]?.ignoreAtRules ?? []) }];
      rows.push(row("stylelint", k, { ...base, chosen: merged, test: "benefit", note: "union of Tailwind at-rules: every one listed exists in the framework and must parse" }));
      continue;
    }
    rows.push(row("stylelint", k, { ...base, chosen: null, test: "residue", note: "two different non-null values" }));
  }
  return rows;
}
