import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { readFile } from "./measure.mjs";

const SKIP_DIRS = new Set([".git", "node_modules"]);

// Every file of a body that is not ignored: `git ls-files` (tracked plus untracked-but-not-ignored)
// when the body is a git checkout, so .gitignore'd directories are skipped; otherwise a filesystem
// walk that skips .git and node_modules and passes over a directory it cannot read.
export function listBodyFiles(dir) {
  try {
    const out = execFileSync("git", ["-C", dir, "ls-files", "-z", "--cached", "--others", "--exclude-standard"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 256 * 1024 * 1024 });
    return [...new Set(out.split("\0").filter(Boolean))].sort();
  } catch { /* not a git checkout */ }
  const files = [];
  const walk = (rel) => {
    let entries;
    try { entries = fs.readdirSync(path.join(dir, rel), { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(r); } else files.push(r);
    }
  };
  walk("");
  return files.sort();
}

// The files a body hands the model, for `references` and `skills`. `themis instructions` measures
// what loads at start and has its own discovery in measure.mjs; this one reads the whole tree.
export function discoverInstructionFiles(dir, files = listBodyFiles(dir)) {
  const readable = (list) => list.filter((rel) => readFile(dir, rel) !== null);
  const under = (prefix, test = () => true) => readable(files.filter((f) => f.startsWith(prefix) && f.endsWith(".md") && test(f)));
  return {
    claude: readable(files.filter((f) => path.posix.basename(f) === "CLAUDE.md")).sort((a, b) => (a === "CLAUDE.md" ? -1 : b === "CLAUDE.md" ? 1 : a < b ? -1 : 1)),
    rules: under(".claude/rules/"),
    skills: readable(files.filter((f) => /^\.claude\/skills\/[^/]+\/SKILL\.md$/.test(f))),
    agents: under(".claude/agents/"),
    lessons: under("docs/lessons/"),
  };
}
