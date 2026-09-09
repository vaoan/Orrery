import { diffRules } from "../rule-diff.mjs";
import { SURFACES } from "../surfaces.mjs";
import { stricter, optionsOf } from "./ordering.mjs";
import { tierOf } from "./tiers.mjs";

const SURFACE_ORDER = SURFACES.map((s) => s.name);
const compare = (x, y) => (x < y ? -1 : x > y ? 1 : 0);

export function reconcileEslint(eslintA, eslintB) {
  const rows = [];
  const surfaces = [...new Set([...Object.keys(eslintA), ...Object.keys(eslintB)])].sort(
    (x, y) => SURFACE_ORDER.indexOf(x) - SURFACE_ORDER.indexOf(y)
  );
  for (const surface of surfaces) {
    const a = eslintA[surface] ?? { rules: {} };
    const b = eslintB[surface] ?? { rules: {} };
    const d = diffRules(a, b);
    const row = (key, extra) => ({ tool: "eslint", surface, key, a: a.rules[key] ?? null, b: b.rules[key] ?? null, note: "", ...extra });
    for (const key of d.agree) rows.push(row(key, { chosen: a.rules[key], test: "agree", tier: tierOf(key) }));
    for (const { rule, value } of d.onlyA) rows.push(row(rule, { chosen: value, test: "adopt", tier: tierOf(rule) }));
    for (const { rule, value } of d.onlyB) rows.push(row(rule, { chosen: value, test: "adopt", tier: tierOf(rule) }));
    for (const rule of [...d.offOnlyA, ...d.offOnlyB]) rows.push(row(rule, { chosen: null, test: "inert", tier: null }));
    for (const { rule } of d.conflict) {
      const { chosen, test, note } = stricter(rule, a.rules[rule], b.rules[rule]);
      rows.push(row(rule, { chosen: resolveMarkers(chosen, optionsOf(a.rules[rule]), optionsOf(b.rules[rule])), test, tier: tierOf(rule), note }));
    }
  }
  return rows.sort((x, y) => SURFACE_ORDER.indexOf(x.surface) - SURFACE_ORDER.indexOf(y.surface) || compare(x.key, y.key));
}

// Pre-rulings carry markers that need both sides' real values: { $union: "key" } (the union of
// that key's arrays from both sides; `join` turns it into one string), { $fromSide: "a"|"b" }.
// { $parameter } markers survive: the bundle writer turns them into body config reads. Markers
// are namespaced with a `$` prefix so a plugin's own option object can never be mistaken for one
// — `union`, `fromSide` and `parameter` are all names real ESLint rule options use.
export function resolveMarkers(value, optionsA, optionsB) {
  const at = (options, key) => key.split(".").reduce((o, k) => o?.[k], options[0] ?? {});
  const walk = (v, keyPath) => {
    if (Array.isArray(v)) return v.map((x, i) => walk(x, keyPath));
    if (v && typeof v === "object") {
      if ("$union" in v) {
        const both = [].concat(at(optionsA, v.$union) ?? [], at(optionsB, v.$union) ?? []);
        const items = v.join ? both.flatMap((s) => String(s).split(v.join)) : both;
        const unique = [...new Set(items)].sort();
        return v.join ? unique.join(v.join) : unique;
      }
      if ("$fromSide" in v) return at(v.$fromSide === "a" ? optionsA : optionsB, keyPath) ?? null;
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x, keyPath ? `${keyPath}.${k}` : k)]));
    }
    return v;
  };
  return value === null ? null : walk(value, "");
}
