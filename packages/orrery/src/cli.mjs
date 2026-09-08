const USAGE = `orrery — constellation governance

Usage:
  orrery diff-eslint <repoA> <repoB> [--file <relative-path>] [--json]
  orrery repo apply <owner/name> [--dry-run] [--policy <file>]
  orrery ci <verb> [--head] [--base] [--title] [--repo] [--head-sha] [--files]

Commands:
  diff-eslint   compare two repositories' effective ESLint configurations
  repo apply    bring a repository's branches, protection, settings and labels to policy
  ci            run one git-flow check: branch-target, branch-name, pr-title, branch-sync, config-drift
`;

const COMMANDS = {
  "diff-eslint": async (argv) => (await import("./commands/diff-eslint.mjs")).default(argv),
  repo: async (argv) => (await import("./commands/repo.mjs")).default(argv),
  ci: async (argv) => (await import("./commands/ci.mjs")).default(argv),
};

export async function run(argv) {
  const [command, ...rest] = argv;

  if (!command || command === "--help" || command === "-h") {
    console.log(USAGE);
    return 0;
  }

  const handler = COMMANDS[command];
  if (!handler) {
    console.error(`unknown command: ${command}\n\n${USAGE}`);
    return 2;
  }

  return handler(rest);
}
