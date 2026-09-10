import { diffRules } from "../rule-diff.mjs";
import { SURFACES } from "../surfaces.mjs";
import { stricter, optionsOf, severityOf, PRE_RULINGS, isEmptyObject } from "./ordering.mjs";
import { tierOf } from "./tiers.mjs";

const SURFACE_ORDER = SURFACES.map((s) => s.name);
const compare = (x, y) => (x < y ? -1 : x > y ? 1 : 0);

// True when a rule's PRE_RULINGS entry governs the given surface: an entry with no `surfaces`
// list applies everywhere; one that names surfaces applies only on those.
function preRulingApplies(rule, surface) {
  const preRuling = PRE_RULINGS[rule];
  return !!preRuling && (!preRuling.surfaces || preRuling.surfaces.includes(surface));
}

// A pre-ruled rule's options are defined once. Find, for each pre-ruled rule, the resolved
// options (severity stripped) of the first surface in SURFACE_ORDER where the two donors
// actually conflict on it and the pre-ruling applies there. A rule with no such surface is
// absent from the map; its adopt rows resolve the markers against their own two sides instead
// (see reconcileEslint's `adopt`).
function firstConflictOptions(eslintA, eslintB, surfaces) {
  const found = {};
  for (const surface of surfaces) {
    const a = eslintA[surface] ?? { rules: {} };
    const b = eslintB[surface] ?? { rules: {} };
    const { conflict } = diffRules(a, b);
    for (const { rule } of conflict) {
      if (found[rule] || !preRulingApplies(rule, surface)) continue;
      const ruling = stricter(rule, a.rules[rule], b.rules[rule], surface);
      const resolved = resolveMarkers(ruling.chosen, optionsOf(a.rules[rule]), optionsOf(b.rules[rule]));
      found[rule] = { options: resolved.slice(1), test: ruling.test, note: ruling.note };
    }
  }
  return found;
}

// An empty object that is an element of an array nested inside an option object is a RegExp
// that `eslint --print-config` serialised away (see effective-config.mjs); a bare `{}` sitting
// at an options position itself just means "no options" and is not a loss.
function hasLostRegExp(chosen) {
  if (!Array.isArray(chosen)) return false;
  const scan = (v) => {
    if (Array.isArray(v)) return v.some(isEmptyObject) || v.some(scan);
    if (v && typeof v === "object") return Object.values(v).some(scan);
    return false;
  };
  return chosen.slice(1).some(scan);
}

export function reconcileEslint(eslintA, eslintB) {
  const surfaces = [...new Set([...Object.keys(eslintA), ...Object.keys(eslintB)])].sort(
    (x, y) => SURFACE_ORDER.indexOf(x) - SURFACE_ORDER.indexOf(y)
  );
  const preResolved = firstConflictOptions(eslintA, eslintB, surfaces);
  const rows = [];

  for (const surface of surfaces) {
    const a = eslintA[surface] ?? { rules: {} };
    const b = eslintB[surface] ?? { rules: {} };
    const d = diffRules(a, b);
    const row = (key, extra) => ({ tool: "eslint", surface, key, a: a.rules[key] ?? null, b: b.rules[key] ?? null, note: "", ...extra });

    // A one-sided (adopt) row for a rule the pre-rulings govern takes the pre-ruling's chosen
    // options rather than the raw value it would otherwise copy verbatim, keeping its own
    // severity. Options come from the first conflict surface if one exists anywhere for this
    // rule; otherwise the markers resolve against this row's own two sides (the absent side
    // reading as empty).
    const adopt = (rule, value, side) => {
      if (!preRulingApplies(rule, surface)) return row(rule, { chosen: value, test: "adopt", tier: tierOf(rule) });
      const preRuling = PRE_RULINGS[rule];
      const cached = preResolved[rule];
      const options = cached
        ? cached.options
        : resolveMarkers(preRuling.chosen, optionsOf(side === "a" ? value : undefined), optionsOf(side === "b" ? value : undefined)).slice(1);
      const test = cached ? cached.test : preRuling.test;
      const note = `${cached ? cached.note : preRuling.note}; one-sided on this surface, options from the class ruling`;
      return row(rule, { chosen: [severityOf(value), ...options], test, tier: tierOf(rule), note });
    };

    for (const key of d.agree) rows.push(row(key, { chosen: a.rules[key], test: "agree", tier: tierOf(key) }));
    for (const { rule, value } of d.onlyA) rows.push(adopt(rule, value, "a"));
    for (const { rule, value } of d.onlyB) rows.push(adopt(rule, value, "b"));
    for (const rule of [...d.offOnlyA, ...d.offOnlyB]) rows.push(row(rule, { chosen: null, test: "inert", tier: null }));
    for (const { rule } of d.conflict) {
      const { chosen, test, note } = stricter(rule, a.rules[rule], b.rules[rule], surface);
      rows.push(row(rule, { chosen: resolveMarkers(chosen, optionsOf(a.rules[rule]), optionsOf(b.rules[rule])), test, tier: tierOf(rule), note }));
    }
  }

  // A RegExp lost by --print-config is residue unless the row's options came from a pre-ruling
  // (whose options are hand-written, never donor data, and so cannot carry a lost RegExp).
  for (const r of rows) {
    if (!preRulingApplies(r.key, r.surface) && hasLostRegExp(r.chosen)) {
      r.test = "residue";
      r.chosen = null;
      r.note = "an option holds a RegExp that --print-config serialises as {}; needs a pre-ruling";
    }
  }

  return rows.sort((x, y) => SURFACE_ORDER.indexOf(x.surface) - SURFACE_ORDER.indexOf(y.surface) || compare(x.key, y.key));
}

// Pre-rulings carry markers that need both sides' real values: { $union: "key" } (the union of
// that key's arrays from both sides; `join` turns it into one string), { $fromSide: "a"|"b" }
// (that side's value, falling back to the other side's when the named side lacks the key, and
// omitting the key entirely when neither side has it). { $parameter } markers survive: the
// bundle writer turns them into body config reads. Markers are namespaced with a `$` prefix so a
// plugin's own option object can never be mistaken for one — `union`, `fromSide` and `parameter`
// are all names real ESLint rule options use.
const OMIT = Symbol("omit");

export function resolveMarkers(value, optionsA, optionsB) {
  const at = (options, key) => key.split(".").reduce((o, k) => o?.[k], options[0] ?? {});
  const walk = (v, keyPath) => {
    if (Array.isArray(v)) return v.map((x) => walk(x, keyPath));
    if (v && typeof v === "object") {
      if ("$union" in v) {
        const both = [].concat(at(optionsA, v.$union) ?? [], at(optionsB, v.$union) ?? []);
        const items = v.join ? both.flatMap((s) => String(s).split(v.join)) : both;
        const unique = [...new Set(items)].sort();
        return v.join ? unique.join(v.join) : unique;
      }
      if ("$fromSide" in v) {
        const [primarySide, fallbackSide] = v.$fromSide === "a" ? [optionsA, optionsB] : [optionsB, optionsA];
        const primary = at(primarySide, keyPath);
        if (primary !== undefined) return primary;
        const fallback = at(fallbackSide, keyPath);
        return fallback !== undefined ? fallback : OMIT;
      }
      const entries = Object.entries(v)
        .map(([k, x]) => [k, walk(x, keyPath ? `${keyPath}.${k}` : k)])
        .filter(([, x]) => x !== OMIT);
      return Object.fromEntries(entries);
    }
    return v;
  };
  return value === null ? null : walk(value, "");
}
