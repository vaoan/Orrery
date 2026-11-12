const USAGE = `themis — constellation governance

Usage:
  themis diff-eslint <repoA> <repoB> [--file <relative-path>] [--json]
  themis repo apply <owner/name> [--dry-run] [--policy <file>]
  themis ci <verb> [--head] [--base] [--title] [--repo] [--head-sha] [--files]
  themis hook <commit-msg|pre-push> [args]
  themis init <name> --class <class> [--owner vaoan] [--repo-name <Name>] [--template vaoan/Vulkan] [--role planet] [--dry-run]
  themis release [--dry-run] [--version-file <package.json>]
  themis reconcile <repoA> <repoB> [--sample surface=path]... [--out <dir>]
  themis bundle [--rulings docs/decisions/rulings.json] [--package packages/themis]
  themis observe <bodyDir>... [--predict] [--report <dir>]
  themis references <bodyDir>... [--report <dir>] [--label <name>]
  themis skills <bodyDir>... [--report <dir>] [--label <name>]
  themis instructions <bodyDir>... [--touching body=path]... [--base <ref>] [--allow-lost <file.json>] [--report <dir>] [--label <name>]

Commands:
  diff-eslint   compare two repositories' effective ESLint configurations
  repo apply    bring a repository's branches, protection, settings and labels to policy
  ci            run one git-flow check: branch-target, branch-name, pr-title, branch-sync, config-drift
  hook          run a git hook: commit-msg validates the subject, pre-push validates the branch and runs tests
  init          create a body from the starter template, bring it to policy, register it
  release       cut release/vYYYY.MM.DD.N from develop and open its PR into main
  reconcile     generate the ruling records and rulings.json from two donor repositories
  bundle        generate the physics and class tiers from rulings.json
  observe       version, pointer and code drift of a body against the bundle, read-only
  instructions  what a body's CLAUDE.md, rules and imports load at session start and across a task, read-only
  references    every link, path, pnpm script, themis command and skill name its instructions mention, and whether it exists
  skills        whether each skill and agent of a body has valid frontmatter, a description that says when, and references that resolve
`;

export const COMMANDS = {
  "diff-eslint": async (argv) => (await import("./commands/diff-eslint.mjs")).default(argv),
  repo: async (argv) => (await import("./commands/repo.mjs")).default(argv),
  ci: async (argv) => (await import("./commands/ci.mjs")).default(argv),
  hook: async (argv) => (await import("./commands/hook.mjs")).default(argv),
  init: async (argv) => (await import("./commands/init.mjs")).default(argv),
  release: async (argv) => (await import("./commands/release.mjs")).default(argv),
  reconcile: async (argv) => (await import("./commands/reconcile.mjs")).default(argv),
  bundle: async (argv) => (await import("./commands/bundle.mjs")).default(argv),
  observe: async (argv) => (await import("./commands/observe.mjs")).default(argv),
  instructions: async (argv) => (await import("./commands/instructions.mjs")).default(argv),
  references: async (argv) => (await import("./commands/references.mjs")).default(argv),
  skills: async (argv) => (await import("./commands/skills.mjs")).default(argv),
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
