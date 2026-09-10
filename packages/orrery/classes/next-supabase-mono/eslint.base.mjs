// Hand-written: what every block needs besides rules. Language options come from the donors'
// effective configs (both use typescript-eslint's parser with the project service); settings
// are what the React and boundaries plugins need to resolve elements and versions.
import tseslint from "typescript-eslint";

const STANDARD_ELEMENTS = [
  { type: "proxy", mode: "file", pattern: "apps/*/src/proxy.ts" },
  { type: "feature-barrel", mode: "file", pattern: "apps/*/src/features/*/{index,public}.ts" },
  { type: "feature", pattern: "apps/*/src/features/*/*", capture: ["feature", "layer"] },
  { type: "shared", pattern: "apps/*/src/shared/*", capture: ["layer"] },
  { type: "app", pattern: ["apps/*/src/app", "apps/*/src/app/**"] },
];

export default function base(surface, body, root) {
  const typescript = surface !== "script";
  return {
    languageOptions: typescript
      ? { parser: tseslint.parser, parserOptions: { projectService: true, tsconfigRootDir: root }, ecmaVersion: 2023, sourceType: "module" }
      : { ecmaVersion: 2023, sourceType: "module" },
    settings: {
      react: { version: "detect" },
      "boundaries/elements": [...STANDARD_ELEMENTS, ...body.boundaries.elements],
      "boundaries/include": ["apps/*/src/**/*", "packages/*/src/**/*"],
    },
  };
}
