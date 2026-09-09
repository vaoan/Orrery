import fs from "node:fs";
import path from "node:path";

// The six kinds of file whose resolved eslint config differs in the donors. Patterns are
// the layouts seen in the constellation; an override on the command line is authoritative.
// Each app-scoped surface tries the donors' own consumer-facing apps (aeleos: hub, libra:
// store) before falling back to a plain apps/* wildcard: a bare wildcard sorts alphabetically
// across every app in a monorepo, and in libra that puts apps/admin ahead of apps/store even
// though store is the app whose config the donor reader is meant to sample. The bracketed
// pattern is a seed of known layouts, not policy — same spirit as CANDIDATES in
// effective-config.mjs — and it is simply skipped (no matches) for any repo without a
// hub or store app, leaving the generic fallback to do the work.
const NOT_SOURCE = /(\.test\.|\.spec\.|\.d\.ts$|(^|\/)index\.tsx?$)/;

export const SURFACES = [
  { name: "source", patterns: ["apps/{hub,store}/src/features/**/*.ts", "apps/*/src/features/**/*.ts", "apps/*/src/**/*.ts"], exclude: NOT_SOURCE },
  { name: "component", patterns: ["apps/{hub,store}/src/features/**/*.tsx", "apps/*/src/features/**/*.tsx", "apps/*/src/**/*.tsx"], exclude: NOT_SOURCE },
  { name: "unit-test", patterns: ["apps/{hub,store}/tests/**/*.test.{ts,tsx}", "apps/*/tests/**/*.test.{ts,tsx}", "apps/*/src/**/*.test.{ts,tsx}"], exclude: /(^|\/)e2e\// },
  { name: "e2e", patterns: ["apps/{hub,store}/e2e/**/*.spec.ts", "apps/{hub,store}/tests/e2e/**/*.spec.ts", "apps/*/e2e/**/*.spec.ts", "apps/*/tests/e2e/**/*.spec.ts"], exclude: /$^/ },
  { name: "script", patterns: ["scripts/*.mjs"], exclude: /\.d\.mts$/ },
  { name: "package", patterns: ["packages/*/src/**/*.ts"], exclude: NOT_SOURCE },
];

const toPosix = (p) => p.split(path.sep).join("/");

export function findSurfaceSamples(repoDirectory, overrides = {}) {
  const samples = {};
  for (const surface of SURFACES) {
    const override = overrides[surface.name];
    if (override === null) continue; // caller opted out of this surface (tests only)
    if (override) {
      if (!fs.existsSync(path.join(repoDirectory, override))) {
        throw new Error(`override for surface "${surface.name}" (${override}) does not exist in ${repoDirectory}`);
      }
      samples[surface.name] = toPosix(override);
      continue;
    }
    let found;
    for (const pattern of surface.patterns) {
      const matches = fs
        .globSync(pattern, { cwd: repoDirectory, exclude: (name) => name.includes("node_modules") })
        .map(toPosix)
        .filter((p) => !surface.exclude.test(p))
        .sort();
      if (matches.length > 0) { found = matches[0]; break; }
    }
    if (!found) {
      throw new Error(`no sample for surface "${surface.name}" in ${repoDirectory}; tried ${surface.patterns.join(", ")}`);
    }
    samples[surface.name] = found;
  }
  return samples;
}
