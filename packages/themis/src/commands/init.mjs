import { parseArgs } from "node:util";
import { execFileSync } from "node:child_process";
import { createGithub as realCreateGithub, resolveToken as realResolveToken } from "../lib/github.mjs";
import { loadPolicy as realLoadPolicy } from "../lib/policy.mjs";
import { loadRegistry as realLoadRegistry } from "../lib/registry.mjs";
import { applyRepoPolicy as realApplyRepoPolicy } from "../lib/repo-policy.mjs";
import { planInit, runInit, listClasses, defaultRepoName, NAME_PATTERN } from "../lib/init.mjs";

const USAGE =
  "usage: themis init <name> --class <class> [--owner vaoan] [--repo-name <Name>] [--template vaoan/Vulkan] [--role planet] [--dry-run]";

function defaultRun(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: "utf8",
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    stdio: ["ignore", "pipe", "inherit"],
  });
}

export default async function init(argv, deps = {}) {
  const {
    run = defaultRun,
    sleep,
    createGithub = realCreateGithub,
    resolveToken = realResolveToken,
    loadPolicy = realLoadPolicy,
    loadRegistry = realLoadRegistry,
    applyRepoPolicy = realApplyRepoPolicy,
  } = deps;

  let values, positionals;
  try {
    ({ values, positionals } = parseArgs({
      args: argv,
      options: {
        class: { type: "string" },
        owner: { type: "string", default: "vaoan" },
        "repo-name": { type: "string" },
        template: { type: "string", default: "vaoan/Vulkan" },
        role: { type: "string", default: "planet" },
        "dry-run": { type: "boolean", default: false },
      },
      allowPositionals: true,
    }));
  } catch (error) {
    console.error(`${error.message}\n${USAGE}`);
    return 2;
  }

  const [name] = positionals;
  if (!name || positionals.length > 1) {
    console.error(USAGE);
    return 2;
  }
  if (!values.class) {
    console.error(`--class is required (one of: ${listClasses().join(", ") || "none"})\n${USAGE}`);
    return 2;
  }
  if (!listClasses().includes(values.class)) {
    console.error(`unknown class ${values.class} (one of: ${listClasses().join(", ") || "none"})`);
    return 2;
  }
  if (!NAME_PATTERN.test(name)) {
    console.error(`name ${name} must be lowercase kebab-case (${NAME_PATTERN})`);
    return 2;
  }
  let registry;
  try {
    registry = loadRegistry();
  } catch (error) {
    console.error(error.message);
    return 2;
  }
  if (registry.bodies?.[name]) {
    console.error(`${name} is already in registry.json`);
    return 2;
  }

  const repoName = values["repo-name"] ?? defaultRepoName(name);
  try {
    const token = resolveToken();
    const github = createGithub({ token });
    const policy = loadPolicy();
    const plan = await planInit({
      name, owner: values.owner, template: values.template, klass: values.class, role: values.role, repoName,
      github, policy, applyRepoPolicy,
    });

    if (values["dry-run"]) {
      console.log(`dry run: would create ${plan.params.repo} from ${values.template}`);
      for (const step of plan.steps) console.log(`  ${step.kind.padEnd(15)} ${step.done ? "done   " : "pending"}  ${step.detail}`);
      return 0;
    }

    const result = await runInit(plan, { github, run, sleep, token, policy, applyRepoPolicy, log: (line) => console.log(line) });
    console.log(`created ${plan.params.repo}; registry pull request: ${result.registryPrUrl ?? "already registered"}`);
    return 0;
  } catch (error) {
    console.error(error.message);
    return 1;
  }
}
