// Hand-written: what every block needs besides rules. Language options come from the donors'
// effective configs (both use typescript-eslint's parser with the project service); settings
// are what the React and boundaries plugins need to resolve elements and versions.
import globals from "globals";
import tseslint from "typescript-eslint";

const STANDARD_ELEMENTS = [
  { type: "proxy", mode: "file", pattern: "apps/*/src/proxy.ts" },
  { type: "feature-barrel", mode: "file", pattern: "apps/*/src/features/*/{index,public}.ts" },
  { type: "feature", pattern: "apps/*/src/features/*/*", capture: ["feature", "layer"] },
  { type: "shared", pattern: "apps/*/src/shared/*", capture: ["layer"] },
  { type: "app", pattern: ["apps/*/src/app", "apps/*/src/app/**"] },
  { type: "package", pattern: "packages/*/src", capture: ["package"] },
];

// Both donors turn `no-undef` off on source/component/package (rulings.json: agree, chosen
// [0, ...]) — the TypeScript compiler catches undefined identifiers there, not eslint, and
// type-aware parsing resolves `window`/`process`/etc. through TypeScript's own lib types, not
// through eslint's `no-undef`/globals machinery. Declaring globals for those three surfaces was
// dead weight with no rule left to consume it, so S1 (PR #31 review) drops it there. `script`
// keeps `no-undef` on (adopted from aeleos) and so still needs `globals.node`; `unit-test`/`e2e`
// keep both node and browser for the test-runner and DOM globals their assertions reference.
const SURFACE_GLOBALS = {
  script: { ...globals.node },
  "unit-test": { ...globals.node, ...globals.browser },
  e2e: { ...globals.node, ...globals.browser },
};

export default function base(surface, body, root) {
  const typescript = surface !== "script";
  return {
    languageOptions: {
      ...(typescript ? { parser: tseslint.parser, parserOptions: { projectService: true, tsconfigRootDir: root } } : {}),
      ecmaVersion: 2023,
      sourceType: "module",
      // ESLint's own flat-config validator requires an object here, not undefined — `?? {}` for
      // the three surfaces S1 dropped from SURFACE_GLOBALS above, not an omitted key.
      globals: SURFACE_GLOBALS[surface] ?? {},
    },
    settings: {
      react: { version: "detect" },
      "boundaries/elements": [...STANDARD_ELEMENTS, ...body.boundaries.elements],
      "boundaries/include": ["apps/*/src/**/*", "packages/*/src/**/*"],
    },
  };
}
