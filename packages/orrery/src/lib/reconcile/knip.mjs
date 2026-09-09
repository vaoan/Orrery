import { row, union } from "./simple.mjs";

const normaliseEntry = (e) => e.replace("**/*.tsx", "**/*.{ts,tsx}").replace("**/*.test.{ts,tsx}", "**/*.{ts,tsx}");
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
      if (flatA.length || flatB.length) rows.push(row("knip", `${kind}.${extraName}`, { a: flatA, b: flatB, chosen: { $parameter: `knip.${extraName}` }, test: "parameter", tier: "class", note: "workspace-specific entries are body data" }));
    }
  }
  const root = (c) => c?.workspaces?.["."];
  if (root(a) || root(b)) rows.push(row("knip", "root", { a: root(a) ?? null, b: root(b) ?? null, chosen: { $parameter: "knip.root" }, test: "parameter", tier: "class", note: "the root workspace lists a body's own scripts and tests" }));
  return rows;
}
