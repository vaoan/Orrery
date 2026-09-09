import { row, same } from "./simple.mjs";

const shape = (group) => { const { dependencies, label, ...rest } = group; return rest; };
const WORKSPACE = { packages: ["**"], dependencyTypes: ["prod", "dev"], pinVersion: "workspace:*" };
const PEERS = { dependencyTypes: ["peer"], isIgnored: true };

export function reconcileSyncpack(a, b) {
  const rows = [];
  const ga = a?.versionGroups ?? [];
  const gb = b?.versionGroups ?? [];
  const find = (groups, target) => groups.find((g) => same(shape(g), target));
  const wa = find(ga, WORKSPACE); const wb = find(gb, WORKSPACE);
  const pa = find(ga, PEERS); const pb = find(gb, PEERS);
  if (wa && wb) {
    rows.push(row("syncpack", "versionGroups.workspace", { a: shape(wa), b: shape(wb), chosen: WORKSPACE, test: "agree", tier: "physics", note: "workspace packages are reached by protocol, never by version" }));
    rows.push(row("syncpack", "versionGroups.workspace.dependencies", { a: wa.dependencies, b: wb.dependencies, chosen: { $parameter: "workspacePackages" }, test: "parameter", tier: "physics" }));
  }
  if (pa && pb) {
    rows.push(row("syncpack", "versionGroups.floatingPeers", { a: shape(pa), b: shape(pb), chosen: PEERS, test: "agree", tier: "physics", note: "peer dependencies in packages may float wider than apps pin" }));
    rows.push(row("syncpack", "versionGroups.floatingPeers.dependencies", { a: pa.dependencies, b: pb.dependencies, chosen: { $parameter: "floatingPeers" }, test: "parameter", tier: "physics" }));
  }
  for (const [side, groups] of [["a", ga], ["b", gb]]) {
    for (const g of groups) if (g !== wa && g !== wb && g !== pa && g !== pb) rows.push(row("syncpack", `versionGroups.${g.label ?? "unlabelled"}`, { [side]: g, chosen: null, test: "residue", tier: "physics", note: "a version group outside the two shared rules" }));
  }
  return rows;
}
