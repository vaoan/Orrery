// The generated bundle must produce, for the fixture body, exactly the rulings for every surface.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readEffectiveConfig } from "../src/lib/effective-config.mjs";
import { optionsOf, severityOf } from "../src/lib/reconcile/ordering.mjs";
import { PLUGIN_SOURCES } from "../src/lib/bundle/plugins.mjs";
import { withDefaults } from "../src/lib/body-config.mjs";
import schema from "../classes/next-supabase-mono/schema.mjs";
import { builtinRules } from "eslint/use-at-your-own-risk";
import prettierConfig from "eslint-config-prettier";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const fixture = path.join(root, "fixtures/next-supabase-mono");
const rulings = JSON.parse(fs.readFileSync(path.join(root, "docs/decisions/rulings.json"), "utf8"));
const SAMPLES = {
  source: "apps/web/src/features/thing/application/use-thing.ts",
  component: "apps/web/src/features/thing/presentation/thing-tile.tsx",
  "unit-test": "apps/web/tests/use-thing.test.ts",
  e2e: "apps/web/e2e/home.spec.ts",
  script: "scripts/build.mjs",
  package: "packages/core/src/thing.ts",
};
const rawBody = (await import(path.join(fixture, "orrery.config.mjs").replace(/^([A-Za-z]):/, "file:///$1:"))).default;
// The real bundle always reads a schema-defaulted body (`withDefaults`, in body-config.mjs) — a
// $parameter such as "e2e.assertFunctionNames" or "i18n.excludedWords" that the fixture's
// orrery.config.mjs leaves unset resolves to the schema's default ([]), never to `undefined`.
// Reading the raw, un-defaulted config here would make `read()` return `undefined` for anything
// the fixture omits, which JSON.stringify then silently drops — a false "want": {} that does not
// reflect what the generator actually renders.
const body = withDefaults(rawBody, schema);

const resolveParameters = (value) => {
  if (Array.isArray(value)) return value.flatMap((v) => (v && typeof v === "object" && "$parameter" in v ? (read(v.$parameter) ?? []) : [resolveParameters(v)]));
  if (value && typeof value === "object") return "$parameter" in value ? read(value.$parameter) : Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolveParameters(v)]));
  return value;
};
const read = (dotted) => dotted.split(".").reduce((o, k) => o?.[k], body);

// Canonical (key-order-independent) JSON, for readable miss messages only: ESLint's own effective
// config and the ruling's `chosen` value are semantically the same object with the keys inserted
// in different orders (the generator's `literal()` alphabetizes; rulings.json keeps reconciliation
// order) — plain JSON.stringify would treat that as a mismatch it is not.
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, v]) => [k, canonical(v)]));
  }
  return value;
}
const norm = (v) => JSON.stringify(canonical([severityOf(v), ...optionsOf(v)]));

// `want` matches `actual` when every key/value `want` names is present in `actual` (recursively),
// order-independent; `actual` may carry additional keys `want` does not mention. That slack is
// real, not a loophole: a rule's own JSON-schema can fill in a default the ruling never had to
// spell out (e.g. better-tailwindcss/enforce-canonical-classes's `ignore: []`) once ESLint
// validates the option object, so the fully-resolved `actual` is a superset of the minimal
// `chosen` literal by construction, not by the bundle mis-rendering the ruling.
function matches(actual, want) {
  if (Array.isArray(want)) return Array.isArray(actual) && actual.length === want.length && want.every((w, i) => matches(actual[i], w));
  if (want && typeof want === "object") return !!actual && typeof actual === "object" && !Array.isArray(actual) && Object.entries(want).every(([k, v]) => matches(actual[k], v));
  return Object.is(actual, want);
}

// eslint-config-prettier's own rules are appended last, unconditionally (no `files` filter), by
// design — it is meant to win over any earlier config for the formatting rules it lists,
// regardless of tier. A rule the rulings named as active but that also appears in this list can
// never actually fire; the second test below already carves out this exact exemption for
// "extras". This carves out the symmetric case: such a rule's *ruled* value is unreachable, and
// the only honest expectation left for it is that it really is "off" in the effective config.
const prettierOffKeys = new Set(Object.keys(prettierConfig.rules));

describe.each(Object.entries(SAMPLES))("surface %s", (surface, file) => {
  const effective = readEffectiveConfig(fixture, file);
  const expected = rulings.rows.filter((r) => r.tool === "eslint" && r.surface === surface && r.chosen !== null && r.tier);

  it("carries every ruled rule with the ruled value", () => {
    const misses = [];
    for (const r of expected) {
      const actual = effective.rules[r.key];
      if (actual === undefined) { misses.push(`${r.key}: missing`); continue; }
      if (prettierOffKeys.has(r.key)) {
        if (severityOf(actual) !== "off") misses.push(`${r.key}: got ${norm(actual)} want ["off"] (eslint-config-prettier always wins this rule)`);
        continue;
      }
      const want = resolveParameters(r.chosen);
      const ok = severityOf(actual) === severityOf(want) && matches(optionsOf(actual), optionsOf(want));
      if (!ok) misses.push(`${r.key}: got ${norm(actual)} want ${norm(want)}`);
    }
    expect(misses).toEqual([]);
  }, 120_000);

  it("carries no rule the rulings do not name, except eslint-config-prettier's offs", () => {
    const named = new Set(expected.map((r) => r.key));
    const extras = Object.entries(effective.rules).filter(([k, v]) => !named.has(k) && severityOf(v) !== "off").map(([k]) => k);
    expect(extras).toEqual([]);
  }, 120_000);
});

// Regression pre-check: a ruling can name a rule that does not exist in the plugin version the
// bundle actually ships (this is exactly how "@next/next/no-location-assign-relative-destination"
// broke every real ESLint run before packages/orrery/package.json caught up to the version the
// ruling was measured against). This checks rule *existence* against the installed plugins
// directly — no fixture, no --print-config — so it fails fast and names the exact rule and plugin,
// rather than surfacing as an opaque `eslint --print-config` crash inside the surface tests above.
const coreRules = builtinRules;
const pluginRulesCache = new Map();
async function rulesForPrefix(prefix) {
  if (pluginRulesCache.has(prefix)) return pluginRulesCache.get(prefix);
  const source = PLUGIN_SOURCES[prefix];
  if (!source) { pluginRulesCache.set(prefix, undefined); return undefined; }
  // import.meta.resolve, not a bare `import(source.module)`: Vite/Vitest's SSR module graph
  // intercepts bare specifiers under "@vitest/*" (colliding with its own internal packages) and
  // resolves them against the workspace root instead of this file's real location, throwing
  // MODULE_NOT_FOUND for "@vitest/eslint-plugin" even though it is genuinely installed.
  // import.meta.resolve follows real Node ESM resolution from this file's own path and sidesteps it.
  const mod = await import(import.meta.resolve(source.module));
  const base = mod.default ?? mod;
  const memberPath = source.member === source.name ? [] : source.member.slice(source.name.length + 1).split(".");
  let plugin = base;
  for (const part of memberPath) plugin = plugin?.[part];
  const rules = plugin?.rules;
  pluginRulesCache.set(prefix, rules);
  return rules;
}

const ruledKeys = [...new Set(
  rulings.rows
    .filter((r) => r.tool === "eslint" && r.tier && r.chosen !== null && severityOf(r.chosen) !== "off")
    .map((r) => r.key)
)];

describe("every ruled, non-off eslint rule exists in the plugin the bundle ships", () => {
  it.each(ruledKeys)("%s", async (key) => {
    const slash = key.lastIndexOf("/");
    if (slash === -1) {
      expect(coreRules.has(key), `core rule "${key}" does not exist in the installed eslint`).toBe(true);
      return;
    }
    const prefix = key.slice(0, slash);
    const ruleName = key.slice(slash + 1);
    const rules = await rulesForPrefix(prefix);
    expect(rules, `"${key}": no plugin mapping (or no rules export) for prefix "${prefix}" in PLUGIN_SOURCES`).toBeTruthy();
    expect(ruleName in rules, `"${key}": "${ruleName}" does not exist in plugin "${prefix}" (module "${PLUGIN_SOURCES[prefix]?.module}")`).toBe(true);
  });
});
