import { parseArgs } from "node:util";
import { createGithub as realCreateGithub, resolveToken as realResolveToken } from "../lib/github.mjs";
import { loadPolicy as realLoadPolicy } from "../lib/policy.mjs";
import { applyRepoPolicy as realApplyRepoPolicy } from "../lib/repo-policy.mjs";

const USAGE = "usage: orrery repo apply <owner/name> [--dry-run] [--policy <file>]";

const describeOp = (op) => {
  switch (op.kind) {
    case "create-branch": return `create-branch ${op.name} from ${op.fromSha.slice(0, 7)}`;
    case "update-settings": return `update-settings ${Object.keys(op.patch).join(", ")}`;
    case "set-default-branch": return `set-default-branch ${op.name}`;
    case "set-protection": return `set-protection ${op.branch}`;
    case "create-label": return `create-label ${op.label.name}`;
    case "update-label": return `update-label ${op.label.name}`;
    default: return op.kind;
  }
};

export default async function repo(argv, deps = {}) {
  const {
    loadPolicy = realLoadPolicy,
    createGithub = realCreateGithub,
    resolveToken = realResolveToken,
    applyRepoPolicy = realApplyRepoPolicy,
  } = deps;

  let values, positionals;
  try {
    ({ values, positionals } = parseArgs({
      args: argv,
      options: { "dry-run": { type: "boolean", default: false }, policy: { type: "string" } },
      allowPositionals: true,
    }));
  } catch (error) {
    console.error(`${error.message}\n${USAGE}`);
    return 2;
  }

  const [subcommand, target] = positionals;
  if (subcommand !== "apply" || !target || !target.includes("/")) {
    console.error(USAGE);
    return 2;
  }

  try {
    const policy = loadPolicy(values.policy);
    const github = createGithub({ token: resolveToken() });
    const { ops } = await applyRepoPolicy(github, target, policy, { dryRun: values["dry-run"] });

    if (ops.length === 0) {
      console.log(`${target}: nothing to change`);
      return 0;
    }
    console.log(`${target}: ${values["dry-run"] ? "dry run, would apply" : "applied"} ${ops.length} operation(s)`);
    for (const op of ops) console.log(`  ${describeOp(op)}`);
    return 0;
  } catch (error) {
    console.error(error.message);
    return 1;
  }
}
