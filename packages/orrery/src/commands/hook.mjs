import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { checkCommitMessage, checkBranchName } from "../lib/git-flow.mjs";

const USAGE = "usage: orrery hook <commit-msg|pre-push> [args]";

// pnpm (verified: 11.20.0) only treats --if-present as its own flag when it
// precedes the script name. Placed after ("pnpm run test --if-present", the
// call-site order below), pnpm forwards it straight to the script instead,
// and vitest then dies on an unknown option. Reorder only for the real spawn;
// callers and tests keep passing the literal, readable ["run", "test", "--if-present"].
function reorderIfPresent(command, args) {
  if (command !== "pnpm" || args[0] !== "run" || !args.includes("--if-present")) return args;
  return ["run", "--if-present", ...args.slice(1).filter((a) => a !== "--if-present")];
}

function defaultRun(command, args) {
  // pnpm is a .cmd shim on Windows; execFileSync needs a shell for it there. The
  // arguments are fixed literals, so shell concatenation cannot inject anything.
  return execFileSync(command, reorderIfPresent(command, args), { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"], shell: process.platform === "win32" && command === "pnpm" });
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
      run("pnpm", ["run", "test", "--if-present"]);
      return 0;
    } catch {
      console.error("pre-push: tests failed");
      return 1;
    }
  }

  console.error(USAGE);
  return 2;
}
