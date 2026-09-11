// The boundary rule: physics is true for a repository that does not exist yet; a plugin that
// needs Next.js, React, Tailwind, TanStack Query, i18n, Playwright or Vitest to make sense is class.
// `boundaries` is class because the element layout it encodes (app/features/shared/proxy) is the
// class's layout. `@stylistic`, `babel`, `standard` appear only as `off` from
// eslint-config-prettier and are physics: a formatting rule turned off is true of any repository.
// `vue` and `flowtype` reach the donors the same way, but they are class — a Vue or Flow codebase
// is an archetype, and physics may not assume one exists.
export const TIER_BY_PLUGIN = {
  core: "physics",
  "@typescript-eslint": "physics",
  sonarjs: "physics",
  unicorn: "physics",
  security: "physics",
  "unused-imports": "physics",
  // `import/*` rules reach both donors through eslint-config-next, which bundles eslint-plugin-import;
  // neither donor depends on the plugin directly, so the rules live where the plugin arrives.
  import: "class",
  jsdoc: "physics",
  tsdoc: "physics",
  "@stylistic": "physics",
  "@stylistic/js": "physics",
  "@stylistic/ts": "physics",
  "@stylistic/jsx": "physics",
  standard: "physics",
  babel: "physics",
  "@babel": "physics",
  boundaries: "class",
  "@next/next": "class",
  react: "class",
  "react-hooks": "class",
  "jsx-a11y": "class",
  "better-tailwindcss": "class",
  "@tanstack/query": "class",
  i18next: "class",
  "testing-library": "class",
  playwright: "class",
  vitest: "class",
  vue: "class",
  flowtype: "class",
};

// A rule the plugin alone cannot place. `no-restricted-syntax` is a core rule, so physics by
// plugin -- but the e2e pre-ruling's chosen is the union of both donors' Playwright and
// testing-library selector bans, which mean nothing where no browser test runs. Keyed by surface
// first, because the same rule is physics on one surface and class on another.
export const TIER_OVERRIDES = { e2e: { "no-restricted-syntax": "class" } };

export function pluginOf(rule) {
  if (!rule.includes("/")) return "core";
  return rule.slice(0, rule.lastIndexOf("/"));
}

export function tierOf(rule, surface) {
  const override = TIER_OVERRIDES[surface]?.[rule];
  if (override) return override;
  const plugin = pluginOf(rule);
  const tier = TIER_BY_PLUGIN[plugin];
  if (!tier) throw new Error(`unknown plugin "${plugin}" for rule ${rule}; add it to TIER_BY_PLUGIN with a boundary-rule justification`);
  return tier;
}
