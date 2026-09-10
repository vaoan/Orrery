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
// [0, ...]) — the TypeScript compiler catches undefined identifiers there, not eslint. It stays
// on only for `script`, adopted from aeleos. Globals go on every surface regardless: type-aware
// parsing still needs `window`/`process`/etc. resolvable as known identifiers rather than
// implicit `any`-flavoured globals, and `script` needs them because `no-undef` is on there.
const SURFACE_GLOBALS = {
  script: { ...globals.node },
  "unit-test": { ...globals.node, ...globals.browser },
  e2e: { ...globals.node, ...globals.browser },
  source: { ...globals.browser, ...globals.node },
  component: { ...globals.browser, ...globals.node },
  package: { ...globals.browser, ...globals.node },
};

export default function base(surface, body, root) {
  const typescript = surface !== "script";
  return {
    languageOptions: {
      ...(typescript ? { parser: tseslint.parser, parserOptions: { projectService: true, tsconfigRootDir: root } } : {}),
      ecmaVersion: 2023,
      sourceType: "module",
      globals: SURFACE_GLOBALS[surface],
    },
    settings: {
      react: { version: "detect" },
      "boundaries/elements": [...STANDARD_ELEMENTS, ...body.boundaries.elements],
      "boundaries/include": ["apps/*/src/**/*", "packages/*/src/**/*"],
    },
  };
}
