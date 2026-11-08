import fs from "node:fs";
import { parseArgs } from "node:util";
import { execFileSync } from "node:child_process";
import { createGithub as realCreateGithub, resolveToken as realResolveToken } from "../lib/github.mjs";
import {
  branchType, checkBranchName, checkBranchTarget, checkPrTitle, checkBranchSync, checkConfigDrift, isBackMerge,
} from "../lib/git-flow.mjs";

const VERBS = ["branch-target", "branch-name", "pr-title", "branch-sync", "config-drift"];
const USAGE = `usage: orrery ci <${VERBS.join("|")}> [--head <branch>] [--base <branch>] [--title <text>] [--repo <owner/name>] [--head-sha <sha>] [--head-repo <owner/name>] [--base-repo <owner/name>] [--author <login>] [--files a,b,c]`;

export const DEFAULT_DRIFT_FILES = [
  "eslint.config.mjs", "eslint.local.mjs", "tsconfig.json", "tsconfig.base.json",
  "package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", "orrery.config.mjs",
  ".github/workflows/ci.yml",
];

function defaultRun(command, args) {
  return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

// `git show ref:file` on a missing file exits non-zero; treat that as "absent" so a file that
// exists on one side only is a real difference, not a crash. Only git's own "no such path"
// diagnostics qualify — any other failure (a bad ref, a network error) is a real error and must
// be rethrown, or a broken revision would silently read as "the file doesn't exist here".
const ABSENT_FILE_PATTERN = /does not exist in|exists on disk, but not in/;
function tolerantRun(run) {
  return (command, args) => {
    try {
      return run(command, args);
    } catch (error) {
      if (args[0] === "show" && typeof error.stderr === "string" && ABSENT_FILE_PATTERN.test(error.stderr)) {
        return "";
      }
      throw error;
    }
  };
}

function readEvent(env) {
  const file = env.GITHUB_EVENT_PATH;
  if (!file || !fs.existsSync(file)) return {};
  const event = JSON.parse(fs.readFileSync(file, "utf8"));
  const pr = event.pull_request ?? {};
  return {
    head: pr.head?.ref,
    base: pr.base?.ref,
    title: pr.title,
    headSha: pr.head?.sha,
    repo: event.repository?.full_name,
    headRepo: pr.head?.repo?.full_name,
    baseRepo: pr.base?.repo?.full_name,
    author: pr.user?.login,
  };
}

export default async function ci(argv, deps = {}) {
  const { env = process.env, run = defaultRun, createGithub = realCreateGithub, resolveToken = realResolveToken } = deps;

  let values, positionals;
  try {
    ({ values, positionals } = parseArgs({
      args: argv,
      options: {
        head: { type: "string" }, base: { type: "string" }, title: { type: "string" },
        repo: { type: "string" }, "head-sha": { type: "string" }, files: { type: "string" },
        "head-repo": { type: "string" }, "base-repo": { type: "string" }, author: { type: "string" },
      },
      allowPositionals: true,
    }));
  } catch (error) {
    console.error(`${error.message}\n${USAGE}`);
    return 2;
  }

  const [verb] = positionals;
  if (!VERBS.includes(verb)) {
    console.error(USAGE);
    return 2;
  }

  const event = readEvent(env);
  const headRepo = values["head-repo"] ?? event.headRepo;
  const baseRepo = values["base-repo"] ?? event.baseRepo;
  const ctx = {
    head: values.head ?? event.head,
    base: values.base ?? event.base,
    title: values.title ?? event.title,
    headSha: values["head-sha"] ?? event.headSha,
    repo: values.repo ?? event.repo,
    headRepo,
    baseRepo,
    author: values.author ?? event.author,
    sameRepo: Boolean(headRepo && baseRepo && headRepo === baseRepo),
  };
  const need = (...keys) => {
    for (const key of keys) {
      if (!ctx[key]) {
        console.error(`--${key === "headSha" ? "head-sha" : key} is required for ${verb} (or run inside a pull_request workflow)`);
        return false;
      }
    }
    return true;
  };

  try {
    let result;
    switch (verb) {
      case "branch-name":
        if (!need("head")) return 2;
        // A back-merge/* head is automation-only regardless of whether it otherwise
        // qualifies for the exemption below: the default bot login is the account
        // that owns the bot token today; it becomes the GitHub App's login
        // (orrery[bot]) once Phase 2d's identity cut-over lands.
        if (branchType(ctx.head) === "back-merge") {
          const bot = env.ORRERY_BOT_LOGIN || "vaoan";
          if (ctx.author !== bot) {
            console.error(`branch-name: only the back-merge workflow may open back-merge/* pull requests (author ${ctx.author} is not ${bot})`);
            return 1;
          }
        }
        if (isBackMerge({ head: ctx.head, base: ctx.base, sameRepo: ctx.sameRepo })) {
          console.log("branch-name: ok (back-merge into develop)");
          return 0;
        }
        result = checkBranchName(ctx.head);
        break;
      case "branch-target":
        if (!need("head", "base")) return 2;
        result = checkBranchTarget(ctx.head, ctx.base);
        break;
      case "pr-title": {
        if (!need("head", "title", "repo")) return 2;
        const github = createGithub({ token: resolveToken() });
        const issueExists = async (number) => {
          const { data } = await github.request("GET", `/repos/${ctx.repo}/issues/${number}`);
          return Boolean(data) && !("pull_request" in data);
        };
        result = await checkPrTitle(ctx.title, ctx.head, { issueExists });
        break;
      }
      case "branch-sync":
        // branch-sync takes no --head/--base of its own; ctx.head/ctx.base only feed
        // isBackMerge here, and checkBranchSync below runs an ordinary sync check
        // when neither is present (or is a normal PR).
        if (isBackMerge({ head: ctx.head, base: ctx.base, sameRepo: ctx.sameRepo })) {
          console.log("branch-sync: ok (this is the back-merge that closes the gap)");
          return 0;
        }
        result = await checkBranchSync({ run });
        break;
      case "config-drift": {
        if (!need("base", "headSha")) return 2;
        const files = values.files ? values.files.split(",").map((f) => f.trim()).filter(Boolean) : DEFAULT_DRIFT_FILES;
        run("git", ["fetch", "--no-tags", "origin", ctx.base]);
        result = await checkConfigDrift({ run: tolerantRun(run), baseRef: `origin/${ctx.base}`, headSha: ctx.headSha, files });
        break;
      }
      default:
        return 2;
    }

    if (result.ok) {
      console.log(`${verb}: ok`);
      return 0;
    }
    console.error(`${verb}: ${result.reason}`);
    return 1;
  } catch (error) {
    const message = (typeof error.stderr === "string" && error.stderr.trim()) || error.message;
    console.error(`${verb}: ${message}`);
    return 1;
  }
}
