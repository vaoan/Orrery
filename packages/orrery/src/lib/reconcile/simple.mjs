export const row = (tool, key, extra) => ({ tool, surface: "*", key, a: null, b: null, chosen: null, test: "agree", tier: "physics", note: "", ...extra });
export const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);
export const union = (...lists) => [...new Set(lists.flat().filter((v) => v !== undefined && v !== null))].sort();

// Two identical values agree; one absent adopts the other; two different values are residue.
export function liftKey(tool, key, a, b, tier = "physics") {
  if (a === undefined && b === undefined) return null;
  if (same(a, b)) return row(tool, key, { a, b, chosen: a, test: "agree", tier });
  if (a === undefined) return row(tool, key, { a: null, b, chosen: b, test: "adopt", tier });
  if (b === undefined) return row(tool, key, { a, b: null, chosen: a, test: "adopt", tier });
  return row(tool, key, { a, b, chosen: null, test: "residue", tier, note: "values differ and the tool has no strictness order for this key" });
}

const liftAll = (tool, a, b, tier) =>
  union(Object.keys(a ?? {}), Object.keys(b ?? {})).map((key) => liftKey(tool, key, a?.[key], b?.[key], tier)).filter(Boolean);

export const reconcilePrettier = (a, b) => liftAll("prettier", a, b, "physics");
export const reconcileSecretlint = (a, b) => liftAll("secretlint", a, b, "physics");

export function reconcileJscpd(a, b) {
  const rows = [];
  a ??= {}; b ??= {};
  const thresholds = [a.threshold, b.threshold].filter((t) => typeof t === "number");
  if (thresholds.length) rows.push(row("jscpd", "threshold", { a: a.threshold ?? null, b: b.threshold ?? null, chosen: Math.min(...thresholds), test: thresholds.length === 2 && a.threshold !== b.threshold ? "strictest" : "agree", note: "lower threshold is stricter" }));
  for (const key of ["format", "reporters"]) {
    if (a[key] || b[key]) rows.push(row("jscpd", key, { a: a[key] ?? null, b: b[key] ?? null, chosen: union(a[key] ?? [], b[key] ?? []), test: same(a[key], b[key]) ? "agree" : "strictest", note: "checking more formats is stricter" }));
  }
  if (a.ignore || b.ignore) rows.push(row("jscpd", "ignore", { a: a.ignore ?? null, b: b.ignore ?? null, chosen: union(a.ignore ?? [], b.ignore ?? []), test: "benefit", tier: "class", note: "the union: every excluded path is generated or framework boilerplate, not our code; body extras via ignore.duplication" }));
  for (const key of union(Object.keys(a), Object.keys(b)).filter((k) => !["threshold", "format", "reporters", "ignore"].includes(k))) {
    rows.push(liftKey("jscpd", key, a[key], b[key], "class"));
  }
  return rows;
}

export function reconcileCspell(a, b) {
  const rows = [];
  a ??= {}; b ??= {};
  for (const key of ["version", "language", "allowCompoundWords"]) {
    const r = liftKey("cspell", key, a[key], b[key], "physics");
    if (r) rows.push(r);
  }
  for (const key of ["ignorePaths", "flagWords", "ignoreWords"]) {
    if (a[key] || b[key]) rows.push(row("cspell", key, { a: a[key] ?? null, b: b[key] ?? null, chosen: union(a[key] ?? [], b[key] ?? []), test: "benefit", tier: "class", note: "union of paths that are generated or vendored" }));
  }
  rows.push(row("cspell", "words", { a: a.words ?? null, b: b.words ?? null, chosen: { $parameter: "spelling" }, test: "parameter", tier: "class", note: "a project's vocabulary is its data" }));
  return rows;
}

const parseGlob = (glob) => { const m = /^\*\.\{([^}]+)\}$/.exec(glob); return m ? m[1].split(",").map((s) => s.trim()) : null; };
const toolName = (command) => command.split(" ")[0];

export function reconcileLintStaged(a, b) {
  a ??= {}; b ??= {};
  const groups = new Map(); // key: sorted extension list -> commands
  const merge = (glob, commands) => {
    const exts = parseGlob(glob);
    if (!exts) return;
    const overlapping = [...groups.keys()].find((k) => k.some((e) => exts.includes(e)));
    const key = overlapping ? union(overlapping, exts) : union(exts);
    const existing = overlapping ? groups.get(overlapping) : [];
    if (overlapping) groups.delete(overlapping);
    const merged = [...existing];
    for (const command of commands) {
      const i = merged.findIndex((c) => toolName(c) === toolName(command));
      if (i === -1) merged.push(command);
      else if (command.length > merged[i].length) merged[i] = command; // the more specific invocation
    }
    groups.set(key, merged);
  };
  for (const [glob, commands] of Object.entries(a)) merge(glob, commands);
  for (const [glob, commands] of Object.entries(b)) merge(glob, commands);
  return [...groups.entries()].map(([exts, commands]) => row("lint-staged", `*.{${exts.join(",")}}`, { a, b, chosen: commands, test: "strictest", tier: "physics", note: "union of extensions and commands; for one tool the more specific invocation wins" }));
}

const hookLines = (text) => (text ?? "").split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#") && !/^(echo|exit|if|fi|then|\[|set )/.test(l) && !l.startsWith("STAGED") && !l.startsWith("HAS_"));

export function reconcileHooks(a, b) {
  const la = hookLines(a?.preCommit);
  const lb = hookLines(b?.preCommit);
  const lintStagedA = la.find((l) => l.includes("lint-staged"));
  const lintStagedB = lb.find((l) => l.includes("lint-staged"));
  const rows = [];
  rows.push(liftKey("hooks", "pre-commit.lint-staged", lintStagedA, lintStagedB, "physics"));
  rows.push(row("hooks", "pre-commit.checks", { a: la.filter((l) => l !== lintStagedA), b: lb.filter((l) => l !== lintStagedB), chosen: { $parameter: "hooks.preCommit" }, test: "parameter", tier: "physics", note: "the hook runs lint-staged for everyone, then each body's own staged checks" }));
  return rows.filter(Boolean);
}

export function reconcileLsLint() {
  const kebab = { ".ts": "kebab-case", ".tsx": "kebab-case", ".js": "kebab-case", ".mjs": "kebab-case", ".css": "kebab-case", ".json": "kebab-case" };
  const ls = { "apps/*/src": kebab, "apps/*/tests": kebab, "apps/*/test": kebab, "apps/*/e2e": kebab, "packages/*/src": kebab, "packages/*/tests": kebab, scripts: { ".mjs": "kebab-case", ".html": "kebab-case" }, tests: { ".ts": "kebab-case" } };
  return [row("ls-lint", "ls", { chosen: ls, test: "strictest", tier: "physics", note: "kebab-case everywhere per ADR 0001; coverage extends to tests and e2e where 298 violations accumulated unobserved" })];
}
