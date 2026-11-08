import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, it, expect } from "vitest";
import { reconcileTsconfig } from "../src/lib/reconcile/tsconfig.mjs";
import { reconcileStylelint } from "../src/lib/reconcile/stylelint.mjs";
import { reconcilePrettier, reconcileSecretlint, reconcileJscpd, reconcileCspell, reconcileLintStaged, reconcileHooks, reconcileLsLint } from "../src/lib/reconcile/simple.mjs";
import { reconcileKnip, normaliseEntry } from "../src/lib/reconcile/knip.mjs";
import { reconcileSyncpack } from "../src/lib/reconcile/syncpack.mjs";

const by = (rows) => Object.fromEntries(rows.map((r) => [r.key, r]));

// Real donor checkouts, siblings of this repo on disk. Not part of any package; read-only,
// and absent in CI, where the assertion is skipped rather than faked.
const here = path.dirname(fileURLToPath(import.meta.url));
const aeleosStylelintPath = path.resolve(here, "../../../../aeleos/stylelint.config.mjs");
const libraStylelintPath = path.resolve(here, "../../../../libra/stylelint.config.mjs");
const hasStylelintDonors = fs.existsSync(aeleosStylelintPath) && fs.existsSync(libraStylelintPath);

describe("tsconfig", () => {
  it("turns strictness flags on, compares enums case-insensitively, and parameterises paths", () => {
    const a = { compilerOptions: { target: "ES2023", module: "ESNext", strict: true, noUnusedLocals: false, types: ["node"] }, include: ["tests/**/*.ts"] };
    const b = { compilerOptions: { target: "ES2023", module: "esnext", strict: true, noUnusedLocals: true, jsx: "react-jsx", lib: ["dom", "esnext"], ignoreDeprecations: "6.0" } };
    const r = by(reconcileTsconfig(a, b));
    expect(r["compilerOptions.strict"]).toMatchObject({ test: "agree", chosen: true, tier: "physics" });
    expect(r["compilerOptions.noUnusedLocals"]).toMatchObject({ test: "strictest", chosen: true, tier: "physics" });
    expect(r["compilerOptions.module"]).toMatchObject({ test: "agree", chosen: "esnext", tier: "physics" });
    expect(r["compilerOptions.jsx"]).toMatchObject({ test: "adopt", chosen: "react-jsx", tier: "class" });
    expect(r["compilerOptions.lib"]).toMatchObject({ test: "adopt", tier: "class" });
    expect(r["compilerOptions.ignoreDeprecations"]).toMatchObject({ test: "adopt", tier: "class" });
    expect(r["compilerOptions.types"]).toMatchObject({ test: "parameter", chosen: { $parameter: "tsconfig.types" } });
    expect(r["include"]).toMatchObject({ test: "parameter" });
  });
  it("treats skipLibCheck false as stricter and allowJs false as stricter", () => {
    const r = by(reconcileTsconfig({ compilerOptions: { skipLibCheck: true, allowJs: true } }, { compilerOptions: { skipLibCheck: false, allowJs: false } }));
    expect(r["compilerOptions.skipLibCheck"].chosen).toBe(false);
    expect(r["compilerOptions.allowJs"].chosen).toBe(false);
  });
  it("leaves a differing enum as residue", () => {
    const r = by(reconcileTsconfig({ compilerOptions: { target: "ES2022" } }, { compilerOptions: { target: "ES2023" } }));
    expect(r["compilerOptions.target"]).toMatchObject({ test: "residue", chosen: null });
  });
});

describe("stylelint", () => {
  it("switches a rule on when either side has it on, unions extends, and unions ignoreAtRules", () => {
    const a = { extends: ["stylelint-config-standard"], rules: { "no-duplicate-selectors": null, "selector-attribute-name-disallowed-list": [["class"]], "at-rule-no-unknown": [true, { ignoreAtRules: ["tailwind", "utility"] }] } };
    const b = { extends: ["stylelint-config-standard", "stylelint-config-tailwindcss"], rules: { "no-duplicate-selectors": true, "at-rule-no-unknown": [true, { ignoreAtRules: ["tailwind", "theme"] }] } };
    const r = by(reconcileStylelint(a, b));
    expect(r["rules.no-duplicate-selectors"]).toMatchObject({ test: "strictest", chosen: true, tier: "class" });
    expect(r["rules.selector-attribute-name-disallowed-list"]).toMatchObject({ test: "adopt", chosen: [["class"]] });
    expect(r["rules.at-rule-no-unknown"]).toMatchObject({ test: "benefit", chosen: [true, { ignoreAtRules: ["tailwind", "theme", "utility"] }] });
    expect(r["extends"]).toMatchObject({ test: "strictest", chosen: ["stylelint-config-standard", "stylelint-config-tailwindcss"] });
  });
  it("leaves two different non-null values as residue", () => {
    const r = by(reconcileStylelint({ rules: { x: "a" } }, { rules: { x: "b" } }));
    expect(r["rules.x"]).toMatchObject({ test: "residue" });
  });
  it("treats an explicit null against an absent key as the preset's on, not residue", () => {
    const r = by(reconcileStylelint({ rules: { "no-duplicate-selectors": null } }, { rules: {} }));
    expect(r["rules.no-duplicate-selectors"]).toMatchObject({ test: "strictest", chosen: { $inherit: true } });
  });
  it("and the mirror with sides swapped", () => {
    const r = by(reconcileStylelint({ rules: {} }, { rules: { "no-duplicate-selectors": null } }));
    expect(r["rules.no-duplicate-selectors"]).toMatchObject({ test: "strictest", chosen: { $inherit: true } });
  });
  it.skipIf(!hasStylelintDonors)("has no residue against the real donors' stylelint configs", async () => {
    const aeleosConfig = (await import(pathToFileURL(aeleosStylelintPath).href)).default;
    const libraConfig = (await import(pathToFileURL(libraStylelintPath).href)).default;
    const rows = reconcileStylelint(aeleosConfig, libraConfig);
    expect(rows.some((r) => r.test === "residue")).toBe(false);
  });
  it("settles both sides disabling a rule, however they spelled it, as agreement", () => {
    const r = by(reconcileStylelint({ rules: { x: null } }, { rules: { x: false } }));
    expect(r["rules.x"]).toMatchObject({ test: "agree", chosen: null });
  });
});

describe("simple tools", () => {
  it("prettier and secretlint agree when identical and are physics", () => {
    expect(by(reconcilePrettier({ endOfLine: "auto" }, { endOfLine: "auto" })).endOfLine).toMatchObject({ test: "agree", tier: "physics" });
    expect(by(reconcileSecretlint({ rules: [{ id: "x" }] }, { rules: [{ id: "x" }] })).rules).toMatchObject({ test: "agree", tier: "physics" });
    expect(by(reconcilePrettier({ endOfLine: "auto" }, { endOfLine: "lf" })).endOfLine).toMatchObject({ test: "residue" });
  });
  it("jscpd takes the lower threshold, unions formats, and unions ignores as class data", () => {
    const r = by(reconcileJscpd({ threshold: 5, format: ["typescript"], ignore: ["**/scripts/**", "**/tests/**"] }, { threshold: 4, format: ["typescript", "tsx"], ignore: ["**/.next/**", "**/tests/**"] }));
    expect(r.threshold).toMatchObject({ test: "strictest", chosen: 4, tier: "physics" });
    expect(r.format).toMatchObject({ test: "strictest", chosen: ["tsx", "typescript"] });
    expect(r.ignore).toMatchObject({ test: "benefit", chosen: ["**/.next/**", "**/scripts/**", "**/tests/**"], tier: "class" });
  });
  it("cspell lifts the identical header, unions ignorePaths, and parameterises words", () => {
    const r = by(reconcileCspell({ version: "0.2", language: "en,en-GB", allowCompoundWords: true, ignorePaths: ["node_modules"], words: ["aeleos"] }, { version: "0.2", language: "en,en-GB", allowCompoundWords: true, ignorePaths: ["node_modules", ".next"], words: ["libra"] }));
    expect(r.version).toMatchObject({ test: "agree", tier: "physics" });
    expect(r.ignorePaths).toMatchObject({ test: "benefit", chosen: [".next", "node_modules"], tier: "class" });
    expect(r.words).toMatchObject({ test: "parameter", chosen: { $parameter: "spelling" } });
  });
  it("lint-staged unions extensions per group and keeps the more specific secretlint invocation", () => {
    const r = by(reconcileLintStaged(
      { "*.{ts,tsx,js,jsx,mjs}": ["prettier --check", "eslint --max-warnings=0 --no-warn-ignored", "secretlint --no-glob"], "*.{json,md}": ["prettier --check"] },
      { "*.{ts,tsx,js,jsx,mjs,cjs}": ["prettier --check", "eslint --max-warnings=0 --no-warn-ignored", "secretlint"], "*.{json,md,css,yml,yaml}": ["prettier --check"] }
    ));
    expect(r["*.{cjs,js,jsx,mjs,ts,tsx}"]).toMatchObject({ test: "strictest", chosen: ["prettier --check", "eslint --max-warnings=0 --no-warn-ignored", "secretlint --no-glob"], tier: "physics" });
    expect(r["*.{css,json,md,yaml,yml}"]).toMatchObject({ test: "strictest", chosen: ["prettier --check"] });
  });
  it("hooks: pre-commit is lint-staged plus each body's own checks as a parameter", () => {
    const r = by(reconcileHooks({ preCommit: "pnpm lint-staged --concurrent false --no-stash --no-revert\npnpm check:docs --staged\npnpm check:agent-notes --staged\n" }, { preCommit: "pnpm lint-staged --concurrent false --no-stash --no-revert\npnpm sherif\npnpm syncpack:lint\n" }));
    expect(r["pre-commit.lint-staged"]).toMatchObject({ test: "agree", chosen: "pnpm lint-staged --concurrent false --no-stash --no-revert", tier: "physics" });
    expect(r["pre-commit.checks"]).toMatchObject({ test: "parameter", chosen: { $parameter: "hooks.preCommit" }, a: ["pnpm check:docs --staged", "pnpm check:agent-notes --staged"], b: ["pnpm sherif", "pnpm syncpack:lint"] });
  });
  it("ls-lint is generated from ADR 0001, not reconciled", () => {
    const [row] = reconcileLsLint();
    expect(row).toMatchObject({ tool: "ls-lint", key: "ls", test: "strictest", tier: "physics" });
    expect(row.chosen["apps/*/src"][".ts"]).toBe("kebab-case");
    expect(row.chosen["apps/*/tests"][".tsx"]).toBe("kebab-case");
    expect(row.note).toMatch(/ADR 0001/);
  });
});

describe("knip", () => {
  it("keeps entries common to every app workspace as class defaults and the rest as body parameters", () => {
    const a = { workspaces: { "apps/hub": { entry: ["src/app/**/*.tsx", "src/features/*/index.ts", "tests/**/*.test.{ts,tsx}"] }, "packages/identity": { entry: ["tests/**/*.ts"] } } };
    const b = { workspaces: { "apps/store": { entry: ["src/app/**/*.{ts,tsx}", "src/features/*/index.ts", "src/shared/infrastructure/i18n/request.ts", "tests/**/*.{ts,tsx}"] }, "apps/admin": { entry: ["src/app/**/*.{ts,tsx}", "src/features/*/index.ts", "src/shared/infrastructure/i18n/request.ts", "tests/**/*.{ts,tsx}"] } } };
    const r = by(reconcileKnip(a, b));
    expect(r["apps.entry"]).toMatchObject({ test: "benefit", chosen: ["src/app/**/*.{ts,tsx}", "src/features/*/index.ts", "tests/**/*.{ts,tsx}"], tier: "class" });
    expect(r["apps.extraEntries"]).toMatchObject({ test: "parameter", chosen: { $parameter: "knip.apps.extraEntries" } });
    expect(r["apps.extraEntries"].b).toContain("src/shared/infrastructure/i18n/request.ts");
  });
  it("folds test-only package entries into the shared pattern", () => {
    const a = { workspaces: { "packages/identity": { entry: ["tests/**/*.test.ts"] } } };
    const b = { workspaces: { "packages/shared": { entry: ["tests/**/*.{ts,tsx}"] } } };
    const r = by(reconcileKnip(a, b));
    expect(r["packages.entry"]).toMatchObject({ chosen: ["tests/**/*.{ts,tsx}"] });
  });
  it("folds every test-file glob form to the shared pattern without corrupting .tsx", () => {
    expect(normaliseEntry("tests/**/*.test.tsx")).toBe("tests/**/*.{ts,tsx}");
    expect(normaliseEntry("tests/**/*.test.ts")).toBe("tests/**/*.{ts,tsx}");
    expect(normaliseEntry("tests/**/*.test.{ts,tsx}")).toBe("tests/**/*.{ts,tsx}");
    expect(normaliseEntry("tests/**/*.{test,spec}.{ts,tsx}")).toBe("tests/**/*.{ts,tsx}");
    expect(normaliseEntry("src/**/*.tsx")).toBe("src/**/*.tsx");
  });
});

describe("syncpack", () => {
  it("recognises the shared two-group policy and parameterises its data", () => {
    const a = { versionGroups: [{ packages: ["**"], dependencies: ["@aeleos/identity"], dependencyTypes: ["prod", "dev"], pinVersion: "workspace:*" }, { dependencies: ["@supabase/supabase-js"], dependencyTypes: ["peer"], isIgnored: true }] };
    const b = { versionGroups: [{ packages: ["**"], dependencies: ["api", "shared"], dependencyTypes: ["prod", "dev"], pinVersion: "workspace:*" }, { dependencies: ["react", "react-dom"], dependencyTypes: ["peer"], isIgnored: true }] };
    const r = by(reconcileSyncpack(a, b));
    expect(r["versionGroups.workspace"]).toMatchObject({ test: "agree", tier: "physics" });
    expect(r["versionGroups.workspace.dependencies"]).toMatchObject({ test: "parameter", chosen: { $parameter: "workspacePackages" } });
    expect(r["versionGroups.floatingPeers.dependencies"]).toMatchObject({ test: "parameter", chosen: { $parameter: "floatingPeers" } });
  });
  it("leaves a third group as residue", () => {
    const extra = { versionGroups: [{ packages: ["**"], dependencies: ["x"], dependencyTypes: ["prod", "dev"], pinVersion: "workspace:*" }, { dependencies: ["y"], dependencyTypes: ["peer"], isIgnored: true }, { label: "odd", dependencies: ["z"] }] };
    expect(reconcileSyncpack(extra, extra).some((r) => r.test === "residue")).toBe(true);
  });
});
