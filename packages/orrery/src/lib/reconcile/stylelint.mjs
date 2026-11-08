import { row, same, union } from "./simple.mjs";

// "off" is an explicit disable (null or false); "absent" is the key not being written at all,
// which leaves whatever `extends` set defaults to in force. The two used to be conflated —
// an explicit disable against an absent key looked identical to "neither side cares" and
// fell through to residue instead of the inherit ruling below.
const state = (v) => (v === undefined ? "absent" : v === null || v === false ? "off" : "on");

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
    const sa = state(va);
    const sb = state(vb);
    // Explicit off against absent: the preset's own default (on) is stricter than the one
    // side that disabled it, so the bundle omits the key rather than writing `false`/`null`
    // and lets `extends` supply the rule.
    if (sa === "off" && sb === "absent") { rows.push(row("stylelint", k, { ...base, chosen: { $inherit: true }, test: "strictest", note: "a disabled a preset rule; the preset's default (on) is stricter, so the bundle omits the key and the preset applies" })); continue; }
    if (sb === "off" && sa === "absent") { rows.push(row("stylelint", k, { ...base, chosen: { $inherit: true }, test: "strictest", note: "b disabled a preset rule; the preset's default (on) is stricter, so the bundle omits the key and the preset applies" })); continue; }
    // On against absent: the side that wrote the rule adopts as-is.
    if (sa === "on" && sb === "absent") { rows.push(row("stylelint", k, { ...base, chosen: va, test: "adopt" })); continue; }
    if (sb === "on" && sa === "absent") { rows.push(row("stylelint", k, { ...base, chosen: vb, test: "adopt" })); continue; }
    // On against an explicit off: on wins outright.
    if (sa === "off" && sb === "on") { rows.push(row("stylelint", k, { ...base, chosen: vb, test: "strictest", note: "on over off" })); continue; }
    if (sb === "off" && sa === "on") { rows.push(row("stylelint", k, { ...base, chosen: va, test: "strictest", note: "on over off" })); continue; }
    // Both off, just spelled differently (null versus false): they agree on the outcome.
    if (sa === "off" && sb === "off") { rows.push(row("stylelint", k, { ...base, chosen: null, test: "agree", note: "both sides disable the rule" })); continue; }
    if (key === "at-rule-no-unknown" && Array.isArray(va) && Array.isArray(vb)) {
      const merged = [true, { ...(va[1] ?? {}), ...(vb[1] ?? {}), ignoreAtRules: union(va[1]?.ignoreAtRules ?? [], vb[1]?.ignoreAtRules ?? []) }];
      rows.push(row("stylelint", k, { ...base, chosen: merged, test: "benefit", note: "union of Tailwind at-rules: every one listed exists in the framework and must parse" }));
      continue;
    }
    rows.push(row("stylelint", k, { ...base, chosen: null, test: "residue", note: "two different non-null values" }));
  }
  return rows;
}
