import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const defaultRun = (command, args) => execFileSync(command, args, { encoding: "utf8" });

// pnpm records a git dependency as '<name>@https://codeload.github.com/<owner>/<repo>/tar.gz/<sha>'.
export function installedCommit(lockText) {
  const m = /@vaoan\/orrery@[^\n]*?vaoan\/Orrery\/tar\.gz\/([0-9a-f]{40})/.exec(lockText ?? "");
  return m ? m[1] : null;
}

export function versionDrift(bodyDir, { run = defaultRun, remote = "https://github.com/vaoan/Orrery.git" } = {}) {
  const lockFile = path.join(bodyDir, "pnpm-lock.yaml");
  const installed = installedCommit(fs.existsSync(lockFile) ? fs.readFileSync(lockFile, "utf8") : "");
  const latest = run("git", ["ls-remote", remote, "refs/heads/main"]).split(/\s/)[0];
  if (!installed) return { installed: null, latest, behind: false, note: "body does not depend on @vaoan/orrery yet" };
  return { installed, latest, behind: installed !== latest, note: installed === latest ? "current" : `behind main (${installed.slice(0, 7)} installed, ${latest.slice(0, 7)} latest)` };
}
