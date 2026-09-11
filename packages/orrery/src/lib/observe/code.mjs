import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import prettierConfig from "eslint-config-prettier";
import { optionsOf, severityOf } from "../reconcile/ordering.mjs";
import { readEffectiveConfig, resolveEslintBin } from "../effective-config.mjs";
import { materialise } from "./scratch.mjs";
import { assertMarker } from "../markers.mjs";

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

// C2/I5: `assertMarker` rejects a marker attribute nobody implements. This function and `matches`
// below are two of the three readers that used to drop `base: "a"` in silence, which is how the
// class shipped a boundaries policy with no base and every check agreed with it.
function resolveParameters(value, body) {
  if (Array.isArray(value)) {
    return value.flatMap((v) => {
      assertMarker(v);
      return v && typeof v === "object" && !Array.isArray(v) && "$parameter" in v ? (read(body, v.$parameter) ?? []) : [resolveParameters(v, body)];
    });
  }
  if (value && typeof value === "object") {
    assertMarker(value);
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
export function matches(actual, want) {
  if (Array.isArray(want)) return Array.isArray(actual) && actual.length === want.length && want.every((w, i) => matches(actual[i], w));
  if (want && typeof want === "object") {
    assertMarker(want);
    return !!actual && typeof actual === "object" && !Array.isArray(actual) && Object.entries(want).every(([k, v]) => matches(actual[k], v));
  }
  return Object.is(actual, want);
}

// What the bundle actually renders for a ruled rule, given the body: an eslint-config-prettier
// key is always "off" in the real effective config regardless of what `chosen` says — the
// prettier block is appended last, with no `files` filter, so it always wins that rule, options
// and all: the options an earlier tier set do not necessarily clear just because the severity
// does, so only severity is checked for these keys, never options. Every comparison against
// "what the bundle produces" — the honesty check against a real effective config, and observe's
// own "did the bundle tighten this rule" check against a body's own pre-bundle effective
// config — must agree on that carve-out, or they drift apart. (They did: see `tightenedFor`
// below — S4.)
function ruledValueMatches(actualValue, row, body) {
  if (actualValue === undefined) return false;
  if (prettierOffKeys.has(row.key)) return severityOf(actualValue) === "off";
  const want = resolveParameters(row.chosen, body);
  return severityOf(actualValue) === severityOf(want) && matches(optionsOf(actualValue), optionsOf(want));
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
    if (!ruledValueMatches(actual, r, body)) {
      if (prettierOffKeys.has(r.key)) out.push(`${r.key}: got ${norm(actual)} want ["off"] (eslint-config-prettier always wins this rule)`);
      else out.push(`${r.key}: got ${norm(actual)} want ${norm(resolveParameters(r.chosen, body))}`);
    }
  }
  for (const [key, value] of Object.entries(effectiveRules)) if (!named.has(key) && severityOf(value) !== "off") out.push(`${key}: not in the rulings and not off`);
  return out;
}

export function violationsByRule(eslintJson) {
  const counts = {};
  for (const file of JSON.parse(eslintJson)) for (const m of file.messages) { const k = m.ruleId ?? "(fatal)"; counts[k] = (counts[k] ?? 0) + 1; }
  return Object.fromEntries(Object.entries(counts).sort(([x], [y]) => (x < y ? -1 : 1)));
}

// A rule with violations that the prediction did not `tighten` is either `baseline` (already
// known at or below the count `--predict` last recorded — informational, not a failure) or
// `unexplained` (absent from the prediction entirely, or worse than what was recorded — a defect
// in Orrery or a body that is not clean under its own config). Count changes on an
// already-tightened rule are `moved`, informational. A tightened rule the prediction never saw
// before is `new`. A tightened rule with zero violations now is `resolved`: the body fixed it, or
// it never fired.
export function compareToPrediction(observed, prediction) {
  const tightened = new Set(prediction.tightened);
  const baseline = [];
  const unexplained = [];
  for (const [rule, n] of Object.entries(observed)) {
    if (rule === "(fatal)" || tightened.has(rule)) continue;
    const predicted = prediction.counts[rule];
    (predicted === undefined || n > predicted ? unexplained : baseline).push(rule);
  }
  const moved = Object.entries(observed)
    .filter(([r, n]) => prediction.counts[r] !== undefined && prediction.counts[r] !== n)
    .map(([r, n]) => ({ rule: r, was: prediction.counts[r], now: n }));
  const newRules = Object.keys(observed).filter((r) => tightened.has(r) && prediction.counts[r] === undefined);
  const resolved = prediction.tightened.filter((r) => observed[r] === undefined);
  return { unexplained, baseline, moved, newRules, resolved };
}

// Which rules the bundle tightens for this body: every ruled rule whose value differs from what
// the body's own effective config has for that surface (or that the body lacks entirely) — the
// same `ruledValueMatches` effectiveMismatches uses against a real effective config. A rule
// eslint-config-prettier always turns off is excluded outright, not compared:
// its real effective value is always "off" regardless of `chosen` or of the body's own value, so
// it can never contribute a new violation the bundle didn't already produce — reporting it
// "tightened" was always spurious, however the body's own pre-bundle value happened to compare.
//
// T4b: a `boundaries/*` rule can carry an identical `chosen` value (severity + options) on both
// sides and still behave differently, because boundaries rules read `settings["boundaries/elements"]`
// — not the rule's own options — to know what an "element" is. `classEffectiveBySurface` is the
// class bundle's own real effective config per surface (the same `readEffectiveConfig` call
// `codeDrift`'s eslint pass already makes against the materialised scratch config, threaded
// through here rather than recomputed); a body whose own `boundaries/elements` setting differs
// from the class's — canonicalised, so key order never matters — is tightened for every
// `boundaries/*` rule even when the rule value itself already matched.
export function tightenedFor(rows, bodyEffectiveBySurface, body, classEffectiveBySurface = {}) {
  const out = new Set();
  for (const r of rows) {
    if (r.tool !== "eslint" || r.chosen === null || !r.tier || prettierOffKeys.has(r.key)) continue;
    const own = bodyEffectiveBySurface[r.surface]?.rules?.[r.key];
    if (!ruledValueMatches(own, r, body)) { out.add(r.key); continue; }
    if (r.key.startsWith("boundaries/")) {
      const classElements = JSON.stringify(canonical(classEffectiveBySurface[r.surface]?.settings?.["boundaries/elements"]));
      const ownElements = JSON.stringify(canonical(bodyEffectiveBySurface[r.surface]?.settings?.["boundaries/elements"]));
      if (classElements !== ownElements) out.add(r.key);
    }
  }
  return [...out].sort();
}

// T1: every tool here exits non-zero on findings (not just on a real crash), and which stream
// carries the report is a per-tool fact, not a universal one — measured against the installed
// binaries (see code.mjs's callers below and the report this fix shipped with): eslint, tsc,
// jscpd and cspell write to stdout; stylelint, ls-lint and syncpack write to stderr, even on a
// clean, zero-exit run. `defaultRun` no longer picks a stream itself (execFileSync's old
// stdout-only catch silently dropped every stylelint/ls-lint finding into a "crashed" report,
// since neither ever had anything on stdout to fall back to) — it hands the caller both streams
// plus the exit status and lets each tool's own attempt block read the one that is actually its
// report. `spawnSync` never throws on a non-zero exit (only on a real spawn failure, e.g. a
// missing binary), so a genuine crash is: `result.error` (thrown here), or a tool's own parser
// failing to make sense of the stream it reads (JSON.parse throwing on a panic trace, for
// instance) — `attempt` below still catches either as `{ crashed: true, message }`.
function defaultRun(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  if (result.error) throw result.error;
  return { stdout: result.stdout ?? "", stderr: result.stderr ?? "", status: result.status };
}

// Runs Orrery's own tool binaries — never the body's — against the body, read-only: `cwd` is the
// body directory, every `--config`/`-c` points into `scratchDir`. The ruling made in planning is
// that this proves the bundle against the plugins it actually ships, which is exactly a body's
// situation after adoption (the plugins live in Orrery's devDependencies, not the body's).
// syncpack is the one exception (T2): its installed binary panics on `--config` whenever there is
// real work to do, on every version tried, so it runs against whatever config the body's own root
// discovers (its own `.syncpackrc*` if it has one, syncpack's built-in defaults if it does not) —
// the same invocation both donors' own `package.json` scripts use, not the class-rendered one.
//
// Every tool runs inside its own try/catch: observe's job is to report drift across every tool
// and every body, and a single tool crashing (a bad rule config, a missing binary, a body file
// eslint chokes on) must not take the rest of the run down with it. A caught failure becomes
// `{ crashed: true, message }` for that tool's entry — the caller (the observe command) is the
// one that prints it and fails the run, since it is the one that knows which body this was.
// C5: every tool here exits non-zero on FINDINGS as well as on a crash, so the exit status alone
// cannot tell the two apart — and every parser here answers "no findings" when handed something
// that is not its report at all (a panic trace, an empty stream after an OOM), which observe then
// recorded as a clean run. Six of the seven tools read that way.
//
// The rule, per tool: status 0 is a clean run and its report — empty or not — is parsed as it
// stands. A non-zero status is findings ONLY if the tool's own stream really carries its own
// report: it parses, and `evidence` recognises at least one finding in it. Anything else throws,
// and `attempt` turns that into `{ crashed: true, message }` for that tool's entry.
function statusAware(tool, result, { stream, parse, evidence }) {
  const text = result?.[stream] ?? "";
  if (result?.status === 0) return parse(text);
  let parsed;
  try {
    parsed = parse(text);
  } catch (error) {
    throw new Error(`${tool} exited ${result?.status} and its ${stream} is not a ${tool} report: ${error.message}`);
  }
  if (!evidence(text, parsed)) {
    throw new Error(`${tool} exited ${result?.status} with no findings on its ${stream}; that is a crash, not a report`);
  }
  return parsed;
}

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
        // eslint's own report — --print-config here, -f json below — is on stdout (measured
        // against the installed binary; see this fix's report).
        const execWithScratch = exec ?? ((execDir, file) => run(node, [eslintBin, "-c", files.eslint, "--no-config-lookup", "--print-config", file], execDir).stdout);
        const mismatches = [];
        const classEffective = {};
        for (const [surface, file] of Object.entries(samples)) {
          const effective = readEffectiveConfig(bodyDir, file, execWithScratch);
          classEffective[surface] = effective;
          mismatches.push(...effectiveMismatches(effective.rules ?? {}, rows, surface, bodyConfig).map((m) => `${surface} ${m}`));
        }
        // Type-aware linting loads the body's whole TypeScript program into memory; a real
        // monorepo (libra: ~1,100 source files) can exceed Node's default old-space ceiling
        // during this one full-tree sweep (found running this against libra: an OOM crash, not
        // a lint finding). The per-surface --print-config calls above are single small files
        // and do not need it.
        // Minor: `apps packages scripts` is the class's shape, not every body's — a body with no
        // scripts/ directory is not an error, it is a body with no scripts.
        const result = run(node, ["--max-old-space-size=6144", eslintBin, "-c", files.eslint, "--no-config-lookup", "--no-error-on-unmatched-pattern", "-f", "json", "apps", "packages", "scripts"], bodyDir);
        const violations = statusAware("eslint", result, {
          stream: "stdout",
          parse: (text) => violationsByRule(text || "[]"),
          evidence: (text, counts) => Object.keys(counts).length > 0,
        });
        return { mismatches, violations, tightened: tightenedFor(rows, bodyEffective ?? {}, bodyConfig, classEffective) };
      });
    }

    if (tools.includes("tsc")) {
      attempt(results, "tsc", () => {
        // tsc's own report is on stdout.
        const result = run(node, [binField("typescript", "tsc"), "-p", files.tsconfig, "--pretty", "false"], bodyDir);
        const errors = statusAware("tsc", result, {
          stream: "stdout",
          parse: (text) => {
            const counts = {};
            for (const m of text.matchAll(/error (TS\d+):/g)) counts[m[1]] = (counts[m[1]] ?? 0) + 1;
            return counts;
          },
          evidence: (text, counts) => Object.keys(counts).length > 0,
        });
        return { errors };
      });
    }

    if (tools.includes("stylelint")) {
      attempt(results, "stylelint", () => {
        // The installed stylelint (packages/orrery/node_modules/stylelint) writes its `-f json`
        // report to stderr, even on a clean, zero-exit run — never stdout. The old stdout-only
        // read silently turned every real stylelint finding into a false "crashed".
        const result = run(node, [binField("stylelint"), "--config", files.stylelint, "-f", "json", "**/*.css"], bodyDir);
        return {
          count: statusAware("stylelint", result, {
            stream: "stderr",
            parse: (text) => JSON.parse(text || "[]").reduce((n, f) => n + f.warnings.length, 0),
            evidence: (text, count) => count > 0,
          }),
        };
      });
    }

    if (tools.includes("jscpd")) {
      attempt(results, "jscpd", () => {
        const result = run(node, [binField("jscpd"), "-c", files.jscpd, "-r", "json", "-o", dir, "."], bodyDir);
        const reportFile = path.join(dir, "jscpd-report.json");
        // jscpd's own report is the file it writes via -o, so that file IS the evidence: a
        // non-zero exit with no report written is a crash, not a duplication finding.
        return {
          clones: statusAware("jscpd", result, {
            stream: "stdout",
            parse: () => (fs.existsSync(reportFile) ? (JSON.parse(fs.readFileSync(reportFile, "utf8")).statistics?.total?.clones ?? 0) : 0),
            evidence: () => fs.existsSync(reportFile),
          }),
        };
      });
    }

    if (tools.includes("cspell")) {
      attempt(results, "cspell", () => {
        // cspell's own report is on stdout.
        const result = run(node, [binField("cspell"), "lint", "-c", files.cspell, "--no-progress", "--no-summary", "**/*.{ts,tsx,md}"], bodyDir);
        return {
          issues: statusAware("cspell", result, {
            stream: "stdout",
            parse: (text) => text.split(/\r?\n/).filter((l) => /:\d+:\d+ - /.test(l)).length,
            evidence: (text, issues) => issues > 0,
          }),
        };
      });
    }

    if (tools.includes("ls-lint")) {
      attempt(results, "ls-lint", () => {
        // The installed @ls-lint/ls-lint writes its findings to stderr ("<path> failed for
        // `<ext>` rules: <rule>", one per line — no hyphen in the rule name despite the rule
        // being configured as "kebab-case"), not stdout; matched against "failed for" rather
        // than a specific rule name so any rule this config ever turns on is counted, not just
        // kebab-case.
        const result = run(node, [binField("@ls-lint/ls-lint", "ls-lint"), "-config", files.lsLint], bodyDir);
        return {
          errors: statusAware("ls-lint", result, {
            stream: "stderr",
            parse: (text) => text.split(/\r?\n/).filter((l) => l.includes("failed for")).length,
            evidence: (text, errors) => errors > 0,
          }),
        };
      });
    }

    if (tools.includes("syncpack")) {
      attempt(results, "syncpack", () => {
        // T2: the installed syncpack (a Rust binary wrapped by a thin Node launcher — packages/
        // orrery/node_modules/syncpack) panics with a clap arg-definition mismatch ("Mismatch
        // between definition and access of `config`") whenever --config is combined with any
        // invocation that actually has a package.json to process — reproduced on both the
        // installed 14.3.1 and a from-npm 15.3.3, with a trivial config and with the real
        // rendered one, so no --config shape works and no version fixes it (see this fix's
        // report). Both donors' own package.json scripts invoke it the same way this now does:
        // plain `syncpack lint`, cwd at the body's own root, config found by cosmiconfig-style
        // discovery from there. The report — real findings and the clean "no issues" banner
        // alike — is on stderr.
        const result = run(node, [binField("syncpack"), "lint"], bodyDir);
        return {
          mismatches: statusAware("syncpack", result, {
            stream: "stderr",
            parse: (text) => (text.match(/✘/g) ?? []).length,
            evidence: (text, mismatches) => mismatches > 0,
          }),
        };
      });
    }

    return results;
  } finally {
    if (ownScratch) fs.rmSync(dir, { recursive: true, force: true });
  }
}
