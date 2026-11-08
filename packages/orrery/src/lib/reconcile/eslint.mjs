import { diffRules } from "../rule-diff.mjs";
import { SURFACES } from "../surfaces.mjs";
import { stricter, optionsOf, severityOf, PRE_RULINGS, isEmptyObject, splitRestrictions, RESTRICTION_FIELD } from "./ordering.mjs";
import { tierOf } from "./tiers.mjs";
import { assertMarker } from "../markers.mjs";

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
export function hasLostRegExp(chosen) {
  if (!Array.isArray(chosen)) return false;
  const scan = (v) => {
    if (Array.isArray(v)) return v.some(isEmptyObject) || v.some(scan);
    if (v && typeof v === "object") return Object.values(v).some(scan);
    return false;
  };
  return chosen.slice(1).some(scan);
}

// C3, the agree/adopt half (the conflict half is `parameterise` in ordering.mjs): a row that copies
// one donor's restriction rule verbatim -- or that copies a value both donors happen to share --
// carries whatever that donor decided to ban, paths, messages and all. Split it the same way, so
// there is one answer to "what may a restricted-* rule say in a shared tier" rather than two.
// Rows a pre-ruling governs are left alone: their options are hand-written here, not donor data,
// and the e2e union's own selectors legitimately contain regular expressions full of slashes.
function parameteriseRestrictions(r) {
  if (r.tool !== "eslint" || r.chosen === null || !RESTRICTION_FIELD[r.key]) return;
  if (preRulingApplies(r.key, r.surface)) return;
  // The row's OWN entries, not `optionsOf`'s: `optionsOf` strips every `message`, and a message
  // that cites a project file ("See: shared/application/utils/featureFlagChecks.ts") is exactly
  // the evidence the token test is looking for.
  const split = splitRestrictions(r.key, r.surface, Array.isArray(r.chosen) ? r.chosen.slice(1) : []);
  if (!split) return;
  r.chosen = [severityOf(r.chosen), ...split];
  r.test = "parameter";
  r.note = `${r.note ? `${r.note}; ` : ""}the entries naming a project path, file or helper are that body's own and become the restrictions.${r.surface}.${RESTRICTION_FIELD[r.key]} parameter`;
}

// C4 -- the spec's CI section: "No rule ever ships at warn." A warning is a rule nobody has to
// obey, and a shared tier full of them is a shared tier that does not bind. Every decided severity
// of warn becomes error, whichever test decided it; an inert row (a rule one side turns off and the
// other never names) has no severity to lift.
function liftWarn(r) {
  if (r.chosen === null || r.test === "inert" || severityOf(r.chosen) !== "warn") return;
  r.chosen = Array.isArray(r.chosen) ? ["error", ...r.chosen.slice(1)] : "error";
  r.test = "strictest";
  r.note = r.note ? `${r.note}; no rule ships at warn (spec)` : "no rule ships at warn (spec)";
}

// C2: lift one eslint-plugin-boundaries element type out of a policy borrowed from a donor. An
// element matcher is either a `{ type }` object (the type itself a string or a list), a bare
// string, or an array of either, and it appears under `from`, `allow.to` and `disallow.to`.
// Lifting a type means: drop any rule whose `from` named only that type, drop the type from every
// `to` it appears in, and drop a rule whose `to` named nothing else.
function narrowMatcher(matcher, type) {
  if (Array.isArray(matcher)) {
    const kept = matcher.map((m) => narrowMatcher(m, type)).filter((m) => m !== undefined);
    return kept.length ? kept : undefined;
  }
  if (typeof matcher === "string") return matcher === type ? undefined : matcher;
  if (!matcher || typeof matcher !== "object" || !("type" in matcher)) return matcher;
  const narrowed = Array.isArray(matcher.type) ? matcher.type.filter((t) => t !== type) : matcher.type === type ? [] : matcher.type;
  if (Array.isArray(narrowed) && narrowed.length === 0) return undefined;
  return { ...matcher, type: narrowed };
}

export function withoutElementType(rules, type) {
  if (!Array.isArray(rules)) return rules;
  const out = [];
  for (const rule of rules) {
    const from = rule?.from === undefined ? undefined : narrowMatcher(rule.from, type);
    if (rule?.from !== undefined && from === undefined) continue;
    const next = { ...rule, ...(from === undefined ? {} : { from }) };
    for (const side of ["allow", "disallow"]) {
      if (next[side] === undefined) continue;
      const hasTo = next[side] !== null && typeof next[side] === "object" && !Array.isArray(next[side]) && next[side].to !== undefined;
      const to = narrowMatcher(hasTo ? next[side].to : next[side], type);
      if (to === undefined) delete next[side];
      else next[side] = hasTo ? { ...next[side], to } : to;
    }
    if (next.allow === undefined && next.disallow === undefined) continue;
    out.push(next);
  }
  return out;
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
      if (!preRulingApplies(rule, surface)) return row(rule, { chosen: value, test: "adopt", tier: tierOf(rule, surface) });
      const preRuling = PRE_RULINGS[rule];
      const cached = preResolved[rule];
      const options = cached
        ? cached.options
        : resolveMarkers(preRuling.chosen, optionsOf(side === "a" ? value : undefined), optionsOf(side === "b" ? value : undefined)).slice(1);
      const test = cached ? cached.test : preRuling.test;
      const note = `${cached ? cached.note : preRuling.note}; one-sided on this surface, options from the class ruling`;
      return row(rule, { chosen: [severityOf(value), ...options], test, tier: tierOf(rule, surface), note });
    };

    for (const key of d.agree) rows.push(row(key, { chosen: a.rules[key], test: "agree", tier: tierOf(key, surface) }));
    for (const { rule, value } of d.onlyA) rows.push(adopt(rule, value, "a"));
    for (const { rule, value } of d.onlyB) rows.push(adopt(rule, value, "b"));
    for (const rule of [...d.offOnlyA, ...d.offOnlyB]) rows.push(row(rule, { chosen: null, test: "inert", tier: null }));
    for (const { rule } of d.conflict) {
      const { chosen, test, note } = stricter(rule, a.rules[rule], b.rules[rule], surface);
      rows.push(row(rule, { chosen: resolveMarkers(chosen, optionsOf(a.rules[rule]), optionsOf(b.rules[rule])), test, tier: tierOf(rule, surface), note }));
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

  for (const r of rows) {
    liftWarn(r);
    parameteriseRestrictions(r);
  }

  return rows.sort((x, y) => SURFACE_ORDER.indexOf(x.surface) - SURFACE_ORDER.indexOf(y.surface) || compare(x.key, y.key));
}

// Pre-rulings carry markers that need both sides' real values: { $union: "key" } (the union of
// that key's arrays from both sides; `join` turns it into one string), { $fromSide: "a"|"b" }
// (that side's value, falling back to the other side's when the named side lacks the key, and
// omitting the key entirely when neither side has it). { $parameter } markers survive: the
// bundle writer turns them into body config reads. Markers are namespaced with a `$` prefix so a
// plugin's own option object can never be mistaken for one — `union`, `fromSide` and `parameter`
// are all names real ESLint rule options use. `assertMarker` (src/lib/markers.mjs) rejects a marker
// attribute nobody implements, so a pre-ruling can never quietly mean less than it says.
const OMIT = Symbol("omit");

export function resolveMarkers(value, optionsA, optionsB) {
  const at = (options, key) => key.split(".").reduce((o, k) => o?.[k], options[0] ?? {});
  const walk = (v, keyPath) => {
    if (Array.isArray(v)) {
      // A marker that resolves to a list SPLICES into the array it sits in, the same way `literal`
      // spreads a `$parameter` marker in an array position: the boundaries base is one marker
      // standing for nine rule entries, followed by whatever the body adds.
      return v.flatMap((x) => {
        const resolved = walk(x, keyPath);
        return assertMarker(x) && Array.isArray(resolved) ? resolved : [resolved];
      });
    }
    if (v && typeof v === "object") {
      assertMarker(v);
      if ("$union" in v) {
        const both = [].concat(at(optionsA, v.$union) ?? [], at(optionsB, v.$union) ?? []);
        const items = v.join ? both.flatMap((s) => String(s).split(v.join)) : both;
        const unique = [...new Set(items)].sort();
        return v.join ? unique.join(v.join) : unique;
      }
      if ("$fromSide" in v) {
        const [primarySide, fallbackSide] = v.$fromSide === "a" ? [optionsA, optionsB] : [optionsB, optionsA];
        const primary = at(primarySide, keyPath);
        const taken = primary !== undefined ? primary : at(fallbackSide, keyPath);
        if (taken === undefined) return OMIT;
        return v.withoutElementType ? withoutElementType(taken, v.withoutElementType) : taken;
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
