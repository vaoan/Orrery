import { parseArgs } from "node:util";
import { createGithub as realCreateGithub, resolveToken as realResolveToken } from "../lib/github.mjs";
import { loadPolicy as realLoadPolicy } from "../lib/policy.mjs";
import { applyRepoPolicy as realApplyRepoPolicy } from "../lib/repo-policy.mjs";

const USAGE = "usage: orrery repo apply <owner/name> [--dry-run] [--policy <file>]";

// Each entry is a line to print; the first line is the operation's header (indented
// two spaces by the caller), the rest are current -> desired detail lines (indented
// four) so `repo apply`'s output shows what will actually change, not just its name.
const PROTECTION_FLAG_LABELS = {
  enforce_admins: "admins",
  required_conversation_resolution: "conversation",
  required_linear_history: "linear",
  allow_force_pushes: "force-push",
  allow_deletions: "deletions",
};

const describeOp = (op) => {
  switch (op.kind) {
    case "create-branch":
      return [`create-branch ${op.name} from ${op.fromSha.slice(0, 7)}`];
    case "update-settings": {
      const keys = Object.keys(op.patch);
      const lines = [`update-settings${keys.length ? " " + keys.join(", ") : ""}`];
      for (const key of keys) lines.push(`${key}: ${op.current?.[key]} -> ${op.patch[key]}`);
      return lines;
    }
    case "set-default-branch":
      return [`set-default-branch ${op.name}`];
    case "set-protection": {
      const current = op.current ?? null;
      const desired = op.body ?? {};
      const desiredApprovals = desired.required_pull_request_reviews?.required_approving_review_count;
      const currentApprovals = current?.required_pull_request_reviews?.required_approving_review_count;
      const desiredContexts = desired.required_status_checks?.contexts ?? [];
      const currentContexts = current?.required_status_checks?.contexts ?? [];
      const lines = [
        `set-protection ${op.branch}`,
        `approvals: ${currentApprovals ?? "none"} -> ${desiredApprovals ?? "none"}`,
        `contexts: [${currentContexts.join(", ")}] -> [${desiredContexts.join(", ")}]`,
      ];
      for (const [field, label] of Object.entries(PROTECTION_FLAG_LABELS)) {
        const currentValue = current?.[field];
        const desiredValue = desired[field];
        if (currentValue !== desiredValue) lines.push(`${label}: ${currentValue ?? "none"} -> ${desiredValue}`);
      }
      return lines;
    }
    case "create-label":
      return [`create-label ${op.label.name}`];
    case "update-label":
      return [`update-label ${op.label.name}`];
    default:
      return [op.kind];
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

  let policy;
  try {
    policy = loadPolicy(values.policy);
  } catch (error) {
    console.error(error.message);
    return 2;
  }

  try {
    const github = createGithub({ token: resolveToken() });
    const { ops } = await applyRepoPolicy(github, target, policy, { dryRun: values["dry-run"] });

    if (ops.length === 0) {
      console.log(`${target}: nothing to change`);
      return 0;
    }
    console.log(`${target}: ${values["dry-run"] ? "dry run, would apply" : "applied"} ${ops.length} operation(s)`);
    for (const op of ops) {
      const [header, ...details] = describeOp(op);
      console.log(`  ${header}`);
      for (const detail of details) console.log(`    ${detail}`);
    }
    return 0;
  } catch (error) {
    console.error(error.message);
    return 1;
  }
}
