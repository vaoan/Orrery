// Hand-written: what every block needs besides rules. Language options come from the donors'
// effective configs (both use typescript-eslint's parser with the project service); settings
// are what the React and boundaries plugins need to resolve elements and versions.
import { createRequire } from "node:module";
import globals from "globals";
import tseslint from "typescript-eslint";

// The resolver is named by ABSOLUTE PATH, not by the short name "typescript". eslint-module-utils
// (which eslint-plugin-boundaries and eslint-plugin-import both resolve through) loads a named
// resolver from the linted FILE's own package directory, or from its own directory inside the
// store — never from Orrery's. Under pnpm's isolated layout that means a body which does not
// itself depend on eslint-import-resolver-typescript silently gets no resolver at all, every
// aliased import becomes an unplaceable element, and boundaries reports nothing while looking
// healthy. Orrery ships the resolver, so Orrery is the one that can say where it is.
const RESOLVER = createRequire(import.meta.url).resolve("eslint-import-resolver-typescript");

const STANDARD_ELEMENTS = [
  { type: "proxy", mode: "file", pattern: "apps/*/src/proxy.ts" },
  // The capture list is load-bearing, not decoration. The class's boundaries policy allows a barrel
  // to reach only into its OWN feature, written as `{{ from.captured.feature }}`, and its layered
  // rules match on `layer`. Captures bind to the pattern's `*` groups IN ORDER, and the class's
  // patterns lead with `apps/*` where a single body's own config names its one app — so the app
  // wildcard must be named too, or `feature` binds to the app name and `layer` to the feature, and
  // every layered edge matches nothing.
  { type: "feature-barrel", mode: "file", pattern: "apps/*/src/features/*/{index,public}.ts", capture: ["app", "feature"] },
  { type: "feature", pattern: "apps/*/src/features/*/*", capture: ["app", "feature", "layer"] },
  { type: "shared", pattern: "apps/*/src/shared/*", capture: ["app", "layer"] },
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
      // C2. **Without this the boundaries graph is decorative.** eslint-plugin-boundaries asks the
      // `import/resolver` settings where a specifier points; with none configured, every `@/...`
      // import — which is how both donors reach anything that is not a sibling — comes back as an
      // unknown element, and an import the rule cannot place is an import it cannot police. The
      // TypeScript resolver reads the `paths` the compiler reads, so `@/` means the same thing to
      // the linter that it means to the build. Only the TypeScript surfaces have a project to
      // read; `script` is plain JavaScript.
      ...(typescript ? { "import/resolver": { [RESOLVER]: { alwaysTryTypes: true, noWarnOnMultipleProjects: true, project: ["apps/*/tsconfig.json", "packages/*/tsconfig.json"] } } } : {}),
      "boundaries/elements": [...STANDARD_ELEMENTS, ...body.boundaries.elements],
      "boundaries/include": ["apps/*/src/**/*", "packages/*/src/**/*"],
    },
  };
}
