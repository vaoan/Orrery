import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import prettierConfig from "eslint-config-prettier";
import { optionsOf, severityOf } from "../reconcile/ordering.mjs";
import { readEffectiveConfig, resolveEslintBin } from "../effective-config.mjs";
import { materialise } from "./scratch.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(here, "../../..");

// Reads the executable a package's own package.json advertises, rather than hard-coding a
// relative path: those paths are not consistent across packages (stylelint's is
// "bin/stylelint.mjs", syncpack's is "./index.cjs", @ls-lint/ls-lint's bin key is the short
// "ls-lint", not its scoped package name) and drift with every dependency bump. Found directly
// under packages/orrery/node_modules — Orrery's own tools, per the observe ruling — rather than
// through Node's resolver: some of these packages' "exports" maps do not expose "./package.json"
// as a subpath at all, which createRequire(...).resolve refuses outright.
export function binField(pkg, binName = pkg) {
  const manifestPath = path.join(packageDir, "node_modules", pkg, "package.json");
  if (!fs.existsSync(manifestPath)) throw new Error(`${pkg} is not installed in ${packageDir}; run pnpm install there first`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const short = pkg.includes("/") ? pkg.slice(pkg.lastIndexOf("/") + 1) : pkg;
  const rel =
    typeof manifest.bin === "string"
      ? manifest.bin
      : (manifest.bin?.[binName] ?? manifest.bin?.[short] ?? manifest.bin?.[manifest.name] ?? Object.values(manifest.bin ?? {})[0]);
  if (!rel) throw new Error(`${pkg} has no bin entry in ${manifestPath}`);
  return path.join(path.dirname(manifestPath), rel);
}

// eslint-config-prettier's own rules are appended last, unconditionally (no `files` filter), by
// design — it is meant to win over any earlier config for the formatting rules it lists,
// regardless of tier. A rule the rulings named as active but that also appears in this list can
// never actually fire; the only honest expectation for it is that it really is "off" in the
// effective config.
const prettierOffKeys = new Set(Object.keys(prettierConfig.rules));

const read = (body, dotted) => dotted.split(".").reduce((o, k) => o?.[k], body);

function resolveParameters(value, body) {
  if (Array.isArray(value)) {
    return value.flatMap((v) => (v && typeof v === "object" && !Array.isArray(v) && "$parameter" in v ? (read(body, v.$parameter) ?? []) : [resolveParameters(v, body)]));
  }
  if (value && typeof value === "object") {
    return "$parameter" in value ? read(body, value.$parameter) : Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolveParameters(v, body)]));
  }
  return value;
}

// Canonical (key-order-independent) JSON, for readable mismatch messages only: ESLint's own
// effective config and the ruling's `chosen` value are semantically the same object with the
// keys inserted in different orders.
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, v]) => [k, canonical(v)]));
  }
  return value;
}
const norm = (v) => JSON.stringify(canonical([severityOf(v), ...optionsOf(v)]));

// `want` matches `actual` when every key/value `want` names is present in `actual`
// (recursively), order-independent; `actual` may carry additional keys `want` does not mention.
// That slack is real, not a loophole: a rule's own JSON-schema can fill in a default the ruling
// never had to spell out once ESLint validates the option object, so the fully-resolved `actual`
// is a superset of the minimal `chosen` literal by construction, not by the bundle misrendering
// the ruling.
function matches(actual, want) {
  if (Array.isArray(want)) return Array.isArray(actual) && actual.length === want.length && want.every((w, i) => matches(actual[i], w));
  if (want && typeof want === "object") return !!actual && typeof actual === "object" && !Array.isArray(actual) && Object.entries(want).every(([k, v]) => matches(actual[k], v));
  return Object.is(actual, want);
}

// The honesty comparison (originally in tests/bundle-honesty.test.mjs): every rule the rulings
// name for this surface must be present in the effective config with the ruled value (or, for a
// rule eslint-config-prettier always turns off, must actually be off); every other rule the
// effective config carries must be off, or it is an undisclosed extra.
export function effectiveMismatches(effectiveRules, rows, surface, body) {
  const out = [];
  const expected = rows.filter((r) => r.tool === "eslint" && r.surface === surface && r.chosen !== null && r.tier);
  const named = new Set();
  for (const r of expected) {
    named.add(r.key);
    const actual = effectiveRules[r.key];
    if (actual === undefined) { out.push(`${r.key}: missing`); continue; }
    if (prettierOffKeys.has(r.key)) {
      if (severityOf(actual) !== "off") out.push(`${r.key}: got ${norm(actual)} want ["off"] (eslint-config-prettier always wins this rule)`);
      continue;
    }
    const want = resolveParameters(r.chosen, body);
    const ok = severityOf(actual) === severityOf(want) && matches(optionsOf(actual), optionsOf(want));
    if (!ok) out.push(`${r.key}: got ${norm(actual)} want ${norm(want)}`);
  }
  for (const [key, value] of Object.entries(effectiveRules)) if (!named.has(key) && severityOf(value) !== "off") out.push(`${key}: not in the rulings and not off`);
  return out;
}

export function violationsByRule(eslintJson) {
  const counts = {};
  for (const file of JSON.parse(eslintJson)) for (const m of file.messages) { const k = m.ruleId ?? "(fatal)"; counts[k] = (counts[k] ?? 0) + 1; }
  return Object.fromEntries(Object.entries(counts).sort(([x], [y]) => (x < y ? -1 : 1)));
}

// A rule with violations that the prediction did not `tighten` is a defect in Orrery or a body
// that is not clean under its own config — `unexplained`. Count changes on an already-tightened
// rule are `moved`, informational. A tightened rule the prediction never saw before is `new`. A
// tightened rule with zero violations now is `resolved`: the body fixed it, or it never fired.
export function compareToPrediction(observed, prediction) {
  const tightened = new Set(prediction.tightened);
  const unexplained = Object.keys(observed).filter((r) => r !== "(fatal)" && !tightened.has(r));
  const moved = Object.entries(observed)
    .filter(([r, n]) => prediction.counts[r] !== undefined && prediction.counts[r] !== n)
    .map(([r, n]) => ({ rule: r, was: prediction.counts[r], now: n }));
  const newRules = Object.keys(observed).filter((r) => tightened.has(r) && prediction.counts[r] === undefined);
  const resolved = prediction.tightened.filter((r) => observed[r] === undefined);
  return { unexplained, moved, newRules, resolved };
}

// Which rules the bundle tightens for this body: every ruled rule whose value differs from what
// the body's own effective config has for that surface (or that the body lacks entirely).
export function tightenedFor(rows, bodyEffectiveBySurface, body) {
  const out = new Set();
  for (const r of rows) {
    if (r.tool !== "eslint" || r.chosen === null || !r.tier) continue;
    const own = bodyEffectiveBySurface[r.surface]?.rules?.[r.key];
    if (own === undefined || norm(own) !== norm(resolveParameters(r.chosen, body))) out.add(r.key);
  }
  return [...out].sort();
}

function defaultRun(command, args, cwd) {
  try {
    return execFileSync(command, args, { cwd, encoding: "utf8", maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
  } catch (error) {
    // Linters exit non-zero on findings; their report is still on stdout.
    if (typeof error.stdout === "string" && error.stdout.length) return error.stdout;
    throw error;
  }
}

// Runs Orrery's own tool binaries — never the body's — against the body, read-only: `cwd` is the
// body directory, every `--config`/`-c` points into `scratchDir`. The ruling made in planning is
// that this proves the bundle against the plugins it actually ships, which is exactly a body's
// situation after adoption (the plugins live in Orrery's devDependencies, not the body's).
//
// Every tool runs inside its own try/catch: observe's job is to report drift across every tool
// and every body, and a single tool crashing (a bad rule config, a missing binary, a body file
// eslint chokes on) must not take the rest of the run down with it. A caught failure becomes
// `{ crashed: true, message }` for that tool's entry — the caller (the observe command) is the
// one that prints it and fails the run, since it is the one that knows which body this was.
function attempt(results, tool, fn) {
  try {
    results[tool] = fn();
  } catch (error) {
    results[tool] = { crashed: true, message: error.message };
  }
}

export async function codeDrift(bodyDir, { rows, bodyConfig, samples, bodyEffective, tools = ["eslint", "tsc", "stylelint", "jscpd", "cspell", "ls-lint", "syncpack"], run = defaultRun, exec, scratchDir }) {
  // Only clean up a scratch directory this call created itself: a caller that passed its own
  // scratchDir may still want it afterward (tests inspect its files).
  const ownScratch = scratchDir === undefined;
  const dir = scratchDir ?? fs.mkdtempSync(path.join(os.tmpdir(), "orrery-observe-"));
  try {
    const files = await materialise(bodyDir, bodyConfig, dir, { bundleDir: packageDir });
    const results = {};
    const node = process.execPath;

    if (tools.includes("eslint")) {
      attempt(results, "eslint", () => {
        // Orrery's own eslint, resolved from packages/orrery — never the body's — per the
        // planning ruling: this is the one binary the rulings and the honesty comparison are
        // measured against, so it is resolved the mandated way (resolveEslintBin), not through
        // the generic binField used for the other tools below.
        const eslintBin = resolveEslintBin(packageDir);
        const execWithScratch = exec ?? ((execDir, file) => run(node, [eslintBin, "-c", files.eslint, "--no-config-lookup", "--print-config", file], execDir));
        const mismatches = [];
        for (const [surface, file] of Object.entries(samples)) {
          const effective = readEffectiveConfig(bodyDir, file, execWithScratch);
          mismatches.push(...effectiveMismatches(effective.rules ?? {}, rows, surface, bodyConfig).map((m) => `${surface} ${m}`));
        }
        // Type-aware linting loads the body's whole TypeScript program into memory; a real
        // monorepo (libra: ~1,100 source files) can exceed Node's default old-space ceiling
        // during this one full-tree sweep (found running this against libra: an OOM crash, not
        // a lint finding). The per-surface --print-config calls above are single small files
        // and do not need it.
        const json = run(node, ["--max-old-space-size=6144", eslintBin, "-c", files.eslint, "--no-config-lookup", "-f", "json", "apps", "packages", "scripts"], bodyDir);
        return { mismatches, violations: violationsByRule(json), tightened: tightenedFor(rows, bodyEffective ?? {}, bodyConfig) };
      });
    }

    if (tools.includes("tsc")) {
      attempt(results, "tsc", () => {
        const out = run(node, [binField("typescript", "tsc"), "-p", files.tsconfig, "--pretty", "false"], bodyDir);
        const counts = {};
        for (const m of out.matchAll(/error (TS\d+):/g)) counts[m[1]] = (counts[m[1]] ?? 0) + 1;
        return { errors: counts };
      });
    }

    if (tools.includes("stylelint")) {
      attempt(results, "stylelint", () => {
        const out = run(node, [binField("stylelint"), "--config", files.stylelint, "-f", "json", "**/*.css"], bodyDir);
        return { count: JSON.parse(out || "[]").reduce((n, f) => n + f.warnings.length, 0) };
      });
    }

    if (tools.includes("jscpd")) {
      attempt(results, "jscpd", () => {
        run(node, [binField("jscpd"), "-c", files.jscpd, "-r", "json", "-o", dir, "."], bodyDir);
        const reportFile = path.join(dir, "jscpd-report.json");
        return { clones: fs.existsSync(reportFile) ? (JSON.parse(fs.readFileSync(reportFile, "utf8")).statistics?.total?.clones ?? 0) : 0 };
      });
    }

    if (tools.includes("cspell")) {
      attempt(results, "cspell", () => {
        const out = run(node, [binField("cspell"), "lint", "-c", files.cspell, "--no-progress", "--no-summary", "**/*.{ts,tsx,md}"], bodyDir);
        return { issues: out.split(/\r?\n/).filter((l) => /:\d+:\d+ - /.test(l)).length };
      });
    }

    if (tools.includes("ls-lint")) {
      attempt(results, "ls-lint", () => {
        const out = run(node, [binField("@ls-lint/ls-lint", "ls-lint"), "-config", files.lsLint], bodyDir);
        return { errors: out.split(/\r?\n/).filter((l) => l.includes("kebab-case")).length };
      });
    }

    if (tools.includes("syncpack")) {
      attempt(results, "syncpack", () => {
        const out = run(node, [binField("syncpack"), "lint", "--config", files.syncpack], bodyDir);
        return { mismatches: (out.match(/✘/g) ?? []).length };
      });
    }

    return results;
  } finally {
    if (ownScratch) fs.rmSync(dir, { recursive: true, force: true });
  }
}
