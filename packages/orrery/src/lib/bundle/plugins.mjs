// Where each rule prefix's plugin comes from. `member` is the expression that yields the plugin
// object after `import <name> from "<module>"`. Versions are the donors' (libra's where they differ).
export const PLUGIN_SOURCES = {
  "@typescript-eslint": { module: "typescript-eslint", name: "tseslint", member: "tseslint.plugin", version: "^8.65.0" },
  sonarjs: { module: "eslint-plugin-sonarjs", name: "sonarjs", member: "sonarjs", version: "^4.2.0" },
  unicorn: { module: "eslint-plugin-unicorn", name: "unicorn", member: "unicorn", version: "^64.0.0" },
  security: { module: "eslint-plugin-security", name: "security", member: "security", version: "^4.0.1" },
  "unused-imports": { module: "eslint-plugin-unused-imports", name: "unusedImports", member: "unusedImports", version: "^4.4.1" },
  jsdoc: { module: "eslint-plugin-jsdoc", name: "jsdoc", member: "jsdoc", version: "^64.1.0" },
  tsdoc: { module: "eslint-plugin-tsdoc", name: "tsdoc", member: "tsdoc", version: "^0.5.2" },
  boundaries: { module: "eslint-plugin-boundaries", name: "boundaries", member: "boundaries", version: "^6.0.2" },
  "@next/next": { module: "@next/eslint-plugin-next", name: "next", member: "next", version: "^16.3.0" },
  react: { module: "eslint-plugin-react", name: "react", member: "react", version: "^7.37.5" },
  "react-hooks": { module: "eslint-plugin-react-hooks", name: "reactHooks", member: "reactHooks", version: "^7.1.1" },
  "jsx-a11y": { module: "eslint-plugin-jsx-a11y", name: "jsxA11y", member: "jsxA11y", version: "^6.10.2" },
  "better-tailwindcss": { module: "eslint-plugin-better-tailwindcss", name: "betterTailwindcss", member: "betterTailwindcss", version: "^4.7.0" },
  "@tanstack/query": { module: "@tanstack/eslint-plugin-query", name: "tanstackQuery", member: "tanstackQuery", version: "^5.100.5" },
  i18next: { module: "eslint-plugin-i18next", name: "i18next", member: "i18next", version: "^6.1.5" },
  "testing-library": { module: "eslint-plugin-testing-library", name: "testingLibrary", member: "testingLibrary", version: "^7.16.2" },
  playwright: { module: "eslint-plugin-playwright", name: "playwright", member: "playwright", version: "^2.11.0" },
  vitest: { module: "@vitest/eslint-plugin", name: "vitest", member: "vitest", version: "^1.6.27" },
  import: { module: "eslint-plugin-import", name: "importPlugin", member: "importPlugin", version: "^2.32.0" },
};

// Prefixes that appear only as `off` (from eslint-config-prettier) and have no plugin of their own.
export const PRETTIER_OFF_PREFIXES = ["@stylistic", "@stylistic/js", "@stylistic/ts", "@stylistic/jsx", "vue", "flowtype", "babel", "@babel", "standard"];

export const TOOL_DEPENDENCIES = {
  eslint: "^9.39.5", "@eslint/js": "^10.0.1", "eslint-config-prettier": "^10.1.8", typescript: "^6.0.3",
  stylelint: "^17.14.1", "stylelint-config-standard": "^40.0.0", "stylelint-config-tailwindcss": "^1.0.1",
  knip: "^6.31.0", jscpd: "^4.2.5", cspell: "^10.0.1", syncpack: "^14.3.1", secretlint: "^12.3.1", "@secretlint/secretlint-rule-preset-recommend": "^12.3.1",
  "@ls-lint/ls-lint": "^2.3.1", "lint-staged": "^16.4.0", prettier: "^3.9.6",
};

export function dependenciesFor(prefixes) {
  const deps = { ...TOOL_DEPENDENCIES };
  for (const prefix of prefixes) {
    const source = PLUGIN_SOURCES[prefix];
    if (source) deps[source.module] = source.version;
  }
  return Object.fromEntries(Object.entries(deps).sort(([x], [y]) => (x < y ? -1 : 1)));
}
