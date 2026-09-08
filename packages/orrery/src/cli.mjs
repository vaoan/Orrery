const USAGE = `orrery — constellation governance

Usage:
  orrery diff-eslint <repoA> <repoB> [--file <relative-path>] [--json]
  orrery repo apply <owner/name> [--dry-run] [--policy <file>]
  orrery ci <verb> [--head] [--base] [--title] [--repo] [--head-sha] [--files]
  orrery hook <commit-msg|pre-push> [args]
  orrery release [--dry-run] [--version-file <package.json>]

Commands:
  diff-eslint   compare two repositories' effective ESLint configurations
  repo apply    bring a repository's branches, protection, settings and labels to policy
  ci            run one git-flow check: branch-target, branch-name, pr-title, branch-sync, config-drift
  hook          run a git hook: commit-msg validates the subject, pre-push validates the branch and runs tests
  release       cut release/vYYYY.MM.DD.N from develop and open its PR into main
`;

const COMMANDS = {
  "diff-eslint": async (argv) => (await import("./commands/diff-eslint.mjs")).default(argv),
  repo: async (argv) => (await import("./commands/repo.mjs")).default(argv),
  ci: async (argv) => (await import("./commands/ci.mjs")).default(argv),
  hook: async (argv) => (await import("./commands/hook.mjs")).default(argv),
  release: async (argv) => (await import("./commands/release.mjs")).default(argv),
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
