const SEVERITY = { 0: "off", 1: "warn", 2: "error", off: "off", warn: "warn", error: "error" };

/**
 * `eslint --print-config` emits every rule as an array whose head is the
 * severity, but the two repositories write severities differently — one uses
 * numbers, the other strings. Normalising first keeps the conflict list free of
 * differences that are not real, which matters because every conflict costs a
 * human ruling.
 *
 * Trailing empty options objects (with zero own keys) are stripped before
 * comparison because they are semantically equivalent to omitted options. Empty
 * arrays and non-empty objects are never stripped — whether they equal "use
 * defaults" requires per-rule schema knowledge we do not have.
 */
function normalise(entry) {
  const value = Array.isArray(entry) ? entry : [entry];
  const [severity, ...options] = value;

  // Strip trailing empty plain objects only
  while (options.length > 0) {
    const last = options[options.length - 1];
    if (typeof last === "object" && last !== null && !Array.isArray(last) && Object.keys(last).length === 0) {
      options.pop();
    } else {
      break;
    }
  }

  return JSON.stringify([SEVERITY[severity] ?? severity, ...options], sortedKeys);
}

// Stable stringify: option objects that differ only in key order are the same
// configuration.
function sortedKeys(_key, value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((k) => [k, value[k]]));
}

// The normalised severity alone, for deciding which one-sided bucket a rule
// belongs in — its options don't matter for that decision.
function severityOf(entry) {
  const raw = Array.isArray(entry) ? entry[0] : entry;
  return SEVERITY[raw] ?? raw;
}

// Not localeCompare: it collates by locale/ICU rules (varies by machine and can
// ignore or reorder punctuation), so rule name ordering would not be stable
// across environments. Plain code-point comparison is deterministic everywhere.
function compare(x, y) {
  return x < y ? -1 : x > y ? 1 : 0;
}

const byRuleName = (x, y) => compare(x.rule, y.rule);

export function diffRules(a, b) {
  const rulesA = a.rules ?? {};
  const rulesB = b.rules ?? {};

  const agree = [];
  // A rule present on only one side is bucketed by its *effect*, not its
  // presence: a rule set to "off" on one side and absent on the other behave
  // identically at lint time, so that pairing is a no-op, not an opinion the
  // other side lacks. Only a one-sided rule whose severity is not "off" is a
  // real opinion — those go in onlyA/onlyB, carrying the raw value so the
  // reconciliation can see what it would be adopting. One-sided "off" rules go
  // in offOnlyA/offOnlyB as plain rule names, since there is no value worth
  // showing for a no-op.
  const onlyA = [];
  const onlyB = [];
  const offOnlyA = [];
  const offOnlyB = [];
  const conflict = [];

  for (const rule of Object.keys(rulesA)) {
    if (!(rule in rulesB)) {
      if (severityOf(rulesA[rule]) === "off") {
        offOnlyA.push(rule);
      } else {
        onlyA.push({ rule, value: rulesA[rule] });
      }
    } else if (normalise(rulesA[rule]) === normalise(rulesB[rule])) {
      agree.push(rule);
    } else {
      conflict.push({ rule, a: rulesA[rule], b: rulesB[rule] });
    }
  }

  for (const rule of Object.keys(rulesB)) {
    if (!(rule in rulesA)) {
      if (severityOf(rulesB[rule]) === "off") {
        offOnlyB.push(rule);
      } else {
        onlyB.push({ rule, value: rulesB[rule] });
      }
    }
  }

  return {
    agree: agree.sort(compare),
    onlyA: onlyA.sort(byRuleName),
    onlyB: onlyB.sort(byRuleName),
    offOnlyA: offOnlyA.sort(compare),
    offOnlyB: offOnlyB.sort(compare),
    conflict: conflict.sort(byRuleName),
  };
}
