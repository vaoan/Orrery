// The commands `themis` registers. cli.mjs dispatches on these and a test holds the two in step; the
// references check reads this list, so no lib module has to import the CLI.
export const COMMAND_NAMES = ["diff-eslint", "repo", "ci", "hook", "init", "release", "reconcile", "bundle", "observe", "instructions", "references", "skills"];
