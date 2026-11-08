import path from "node:path";
import { parseArgs } from "node:util";
import { execFileSync } from "node:child_process";
import { planRelease, cutRelease } from "../lib/release.mjs";

const USAGE = "usage: orrery release [--dry-run] [--version-file <package.json>]";

function defaultRun(command, args) {
  return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
}

export default async function release(argv, deps = {}) {
  const { run = defaultRun, today = new Date() } = deps;

  let values;
  try {
    ({ values } = parseArgs({
      args: argv,
      options: { "dry-run": { type: "boolean", default: false }, "version-file": { type: "string", default: "package.json" } },
    }));
  } catch (error) {
    console.error(`${error.message}\n${USAGE}`);
    return 2;
  }

  const versionFile = path.resolve(values["version-file"]);
  try {
    const plan = await planRelease({ run, today, versionFile });
    if (values["dry-run"]) {
      console.log(`would cut ${plan.branch} from origin/develop, bump ${versionFile}, and open "${plan.title}" into main`);
      return 0;
    }
    cutRelease(plan, { run, versionFile });
    console.log(`opened ${plan.title}; merge it with a merge commit to release`);
    return 0;
  } catch (error) {
    console.error(error.message);
    return 1;
  }
}
