import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { checkCommitMessage, checkBranchName } from "../lib/git-flow.mjs";

const USAGE = "usage: orrery hook <commit-msg|pre-push> [args]";

function defaultRun(command, args) {
  // pnpm is a .cmd shim on Windows; execFileSync needs a shell for it there. The
  // arguments are fixed literals, so shell concatenation cannot inject anything.
  return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"], shell: process.platform === "win32" && command === "pnpm" });
}

export default async function hook(argv, deps = {}) {
  const { run = defaultRun, env = process.env } = deps;
  const [name, ...rest] = argv;

  if (name === "commit-msg") {
    const [file] = rest;
    if (!file || !fs.existsSync(file)) {
      console.error(`commit-msg: message file not found: ${file}\n${USAGE}`);
      return 2;
    }
    const message = fs.readFileSync(file, "utf8").split(/\r?\n/).filter((line) => !line.startsWith("#")).join("\n").trim();
    const result = checkCommitMessage(message);
    if (result.ok) return 0;
    console.error(`commit-msg: ${result.reason}`);
    return 1;
  }

  if (name === "pre-push") {
    const branch = run("git", ["branch", "--show-current"]).trim();
    const nameCheck = checkBranchName(branch);
    if (!nameCheck.ok) {
      console.error(`pre-push: ${nameCheck.reason}`);
      return 1;
    }
    if (env.ORRERY_HOOK_SKIP_TESTS === "1") return 0;
    try {
      // pnpm (verified: 11.20.0) only treats --if-present as its own flag when
      // it precedes the script name; placed after the script name, pnpm
      // forwards it straight to the script instead, which then fails on the
      // unknown option.
      run("pnpm", ["run", "--if-present", "test"]);
      return 0;
    } catch {
      console.error("pre-push: tests failed");
      return 1;
    }
  }

  console.error(USAGE);
  return 2;
}
