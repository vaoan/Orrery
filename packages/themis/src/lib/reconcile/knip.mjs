import { row, union } from "./simple.mjs";

// Every test-file glob form, whichever extension spelling a donor wrote, folds to the one
// shared pattern. Each match is end-anchored ($) so it only fires on the glob's actual
// suffix — a plain string search would treat "**/*.test.ts" as a substring of
// "**/*.test.tsx" and truncate it into a corrupted glob ("**/*.{ts,tsx}x").
// The App Router entry convention ("…/app/**/*.tsx") is the one non-test form real donors
// disagree on spelling (one writes it without .ts); it folds too, anchored the same way so
// an unrelated "**/*.tsx" glob elsewhere in a body's own entries is left alone.
export const normaliseEntry = (e) =>
  e
    .replace(/\*\*\/\*\.test\.ts$/, "**/*.{ts,tsx}")
    .replace(/\*\*\/\*\.test\.tsx$/, "**/*.{ts,tsx}")
    .replace(/\*\*\/\*\.test\.\{ts,tsx\}$/, "**/*.{ts,tsx}")
    .replace(/\*\*\/\*\.\{test,spec\}\.\{ts,tsx\}$/, "**/*.{ts,tsx}")
    .replace(/app\/\*\*\/\*\.tsx$/, "app/**/*.{ts,tsx}");
const appWorkspaces = (config) => Object.entries(config?.workspaces ?? {}).filter(([name]) => name.startsWith("apps/"));
const packageWorkspaces = (config) => Object.entries(config?.workspaces ?? {}).filter(([name]) => name.startsWith("packages/"));

function common(workspaces, field) {
  const lists = workspaces.map(([, ws]) => (ws[field] ?? []).map(normaliseEntry));
  if (lists.length === 0) return [];
  return lists.reduce((acc, list) => acc.filter((e) => list.includes(e))).sort();
}

export function reconcileKnip(a, b) {
  const rows = [];
  for (const [kind, pick] of [["apps", appWorkspaces], ["packages", packageWorkspaces]]) {
    const all = [...pick(a), ...pick(b)];
    if (all.length === 0) continue;
    for (const field of ["entry", "project"]) {
      const shared = common(all, field);
      const extrasA = Object.fromEntries(pick(a).map(([n, ws]) => [n, (ws[field] ?? []).map(normaliseEntry).filter((e) => !shared.includes(e))]));
      const extrasB = Object.fromEntries(pick(b).map(([n, ws]) => [n, (ws[field] ?? []).map(normaliseEntry).filter((e) => !shared.includes(e))]));
      rows.push(row("knip", `${kind}.${field}`, { a: extrasA, b: extrasB, chosen: shared, test: "benefit", tier: "class", note: `${field} patterns every ${kind} workspace in both donors shares; the class convention` }));
      const flatA = union(...Object.values(extrasA));
      const flatB = union(...Object.values(extrasB));
      const extraName = { entry: "extraEntries", project: "extraProjects" }[field];
      if (flatA.length || flatB.length) rows.push(row("knip", `${kind}.${extraName}`, { a: flatA, b: flatB, chosen: { $parameter: `knip.${kind}.${extraName}` }, test: "parameter", tier: "class", note: "workspace-specific entries are body data" }));
    }
  }
  const root = (c) => c?.workspaces?.["."];
  if (root(a) || root(b)) rows.push(row("knip", "root", { a: root(a) ?? null, b: root(b) ?? null, chosen: { $parameter: "knip.root" }, test: "parameter", tier: "class", note: "the root workspace lists a body's own scripts and tests" }));
  return rows;
}
