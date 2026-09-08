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

export function diffRules(a, b) {
  const rulesA = a.rules ?? {};
  const rulesB = b.rules ?? {};

  const agree = [];
  const onlyA = [];
  const onlyB = [];
  const conflict = [];

  for (const rule of Object.keys(rulesA)) {
    if (!(rule in rulesB)) {
      onlyA.push(rule);
    } else if (normalise(rulesA[rule]) === normalise(rulesB[rule])) {
      agree.push(rule);
    } else {
      conflict.push({ rule, a: rulesA[rule], b: rulesB[rule] });
    }
  }

  for (const rule of Object.keys(rulesB)) {
    if (!(rule in rulesA)) onlyB.push(rule);
  }

  const byName = (x, y) => x.localeCompare(y);
  return {
    agree: agree.sort(byName),
    onlyA: onlyA.sort(byName),
    onlyB: onlyB.sort(byName),
    conflict: conflict.sort((x, y) => byName(x.rule, y.rule)),
  };
}
