// The generated bundle must produce, for the fixture body, exactly the rulings for every surface.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readEffectiveConfig } from "../src/lib/effective-config.mjs";
import { severityOf } from "../src/lib/reconcile/ordering.mjs";
import { effectiveMismatches } from "../src/lib/observe/code.mjs";
import { PLUGIN_SOURCES } from "../src/lib/bundle/plugins.mjs";
import { withDefaults } from "../src/lib/body-config.mjs";
import schema from "../classes/next-supabase-mono/schema.mjs";
import { builtinRules } from "eslint/use-at-your-own-risk";

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

// The honesty comparison itself (canonical key-order-independent matching, the subset "actual can
// carry a schema-filled default `want` never spelled out" slack, the eslint-config-prettier
// exemption) lives in src/lib/observe/code.mjs's effectiveMismatches — this is the same function
// `orrery observe` runs against a real body, so there is one comparison, not two.
describe.each(Object.entries(SAMPLES))("surface %s", (surface, file) => {
  const effective = readEffectiveConfig(fixture, file);
  const mismatches = effectiveMismatches(effective.rules, rulings.rows, surface, body);

  it("carries every ruled rule with the ruled value", () => {
    expect(mismatches.filter((m) => !m.endsWith("not in the rulings and not off"))).toEqual([]);
  }, 120_000);

  it("carries no rule the rulings do not name, except eslint-config-prettier's offs", () => {
    expect(mismatches.filter((m) => m.endsWith("not in the rulings and not off"))).toEqual([]);
  }, 120_000);
});

// T3: aeleos's own e2e layout nests under apps/*/tests/e2e/, not apps/*/e2e/ — and the
// unit-test surface's own globs (**/*.test.{ts,tsx}, **/tests/**/*.{ts,tsx}) match that path too.
// A flat-config block with overlapping "files" still applies regardless of "ignores" on another
// block, so without the unit-test block's own "ignores": ["**/e2e/**"] (SURFACE_FILES /
// renderClassEslint in src/lib/bundle/eslint.mjs) this file would carry both the e2e surface's
// rules and the unit-test surface's testing-library/vitest ones. Checked as its own surface
// sample, separately from SAMPLES.e2e above, specifically because it is the layout that broke.
describe("surface e2e (aeleos's nested apps/*/tests/e2e/ layout)", () => {
  const file = "apps/web/tests/e2e/smoke.spec.ts";
  const effective = readEffectiveConfig(fixture, file);
  const mismatches = effectiveMismatches(effective.rules, rulings.rows, "e2e", body);

  it("carries every ruled rule with the ruled value", () => {
    expect(mismatches.filter((m) => !m.endsWith("not in the rulings and not off"))).toEqual([]);
  }, 120_000);

  it("carries no rule the rulings do not name, except eslint-config-prettier's offs", () => {
    expect(mismatches.filter((m) => m.endsWith("not in the rulings and not off"))).toEqual([]);
  }, 120_000);

  it("carries no testing-library/* or vitest/* rule that is on", () => {
    const on = Object.entries(effective.rules)
      .filter(([key, value]) => (key.startsWith("testing-library/") || key.startsWith("vitest/")) && severityOf(value) !== "off")
      .map(([key]) => key);
    expect(on).toEqual([]);
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
