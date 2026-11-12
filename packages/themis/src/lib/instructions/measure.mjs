import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import ignore from "ignore";

export const BUDGET = { startup: 10000, task: 25000 };
export const WIDE_GLOB_SHARE = 0.4;
export const tokens = (bytes) => Math.ceil(bytes / 3);

const ROOT_LINE_LIMIT = 200;
const RULE_LINE_LIMIT = 100;
const MAX_IMPORT_HOPS = 4;
const MIN_PARAGRAPH = 40;
const MAX_BRACE_RESULTS = 1000;
const SOURCE_EXT = new Set(["ts", "tsx", "js", "jsx", "mjs", "cjs", "css", "java", "py", "go", "rs"]);

const lf = (text) => text.replace(/\r\n?/g, "\n");
const posix = (p) => p.split(path.sep).join("/");

// ---- frontmatter -------------------------------------------------------------------------

// Frontmatter only counts when the file opens with `---` on line 1 and a closing `---` follows.
export function frontmatter(text) {
  const lines = lf(text).split("\n");
  if (lines[0].trim() !== "---") return null;
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === "---");
  return end === -1 ? null : lines.slice(1, end);
}

export const unquote = (s) => {
  const t = s.trim();
  return t.length >= 2 && (t[0] === '"' || t[0] === "'") && t.at(-1) === t[0] ? t.slice(1, -1) : t;
};

// The steps below follow Claude Code's rule loader (2.1.311). It matches with
// `ignore().add(globs).ignores(path)`, which is gitignore semantics and not a shell glob: `tests/*`
// reaches everything under a directory it matches, and a glob with no inner slash matches at any depth.

// Split on commas that sit outside {braces}, so `*.{ts,tsx}` stays one glob.
function splitGlobs(s) {
  const out = [];
  let depth = 0, cur = "";
  for (const c of s) {
    if (c === "{") depth++;
    if (c === "}") depth--;
    if (c === "," && depth === 0) { out.push(cur); cur = ""; } else cur += c;
  }
  out.push(cur);
  return out.map(unquote).filter(Boolean);
}

// A pattern past the limit stays unexpanded, as in the loader.
function expandBraces(glob) {
  const out = [], stack = [glob];
  while (stack.length) {
    const g = stack.pop();
    const m = /^([^{]*)\{([^}]+)\}(.*)$/.exec(g);
    if (!m) { out.push(g); continue; }
    const alternatives = m[2].split(",").map((a) => a.trim());
    if (out.length + stack.length + alternatives.length > MAX_BRACE_RESULTS) return [glob];
    for (const a of alternatives.reverse()) stack.push(m[1] + a + m[3]);
  }
  return out;
}

const compiles = (glob) => {
  try { ignore().add([glob]).test("probe"); return true; } catch { return false; }
};

// Files under a matched directory match too. The loader drops a glob that does not compile.
function matcher(globs) {
  const ig = ignore().add(globs.filter(compiles));
  return (file) => file !== "" && file !== "." && ig.ignores(file);
}

// Returns { paths } where null means "unscoped": no frontmatter, no `paths:`, any malformation, or
// globs that all reduce to `**` or to nothing. Otherwise the globs as the loader holds them.
export function parseRule(text) {
  const fm = frontmatter(text);
  if (!fm) return { paths: null };
  const i = fm.findIndex((l) => /^paths\s*:/.test(l));
  if (i === -1) return { paths: null };
  const inline = fm[i].replace(/^paths\s*:/, "").trim();
  let list;
  if (inline === "") {
    list = [];
    for (const l of fm.slice(i + 1)) {
      if (/^\s*-\s+/.test(l)) list.push(l.replace(/^\s*-\s+/, ""));
      else if (l.trim() === "" || /^\s*#/.test(l)) continue;
      else break;
    }
  } else if (inline.startsWith("[")) {
    if (!inline.endsWith("]")) return { paths: null };
    list = splitGlobs(inline.slice(1, -1));
  } else {
    list = [inline];
  }
  const globs = list
    .flatMap((g) => splitGlobs(unquote(g)))
    .map((g) => g.trim())
    .filter(Boolean)
    .flatMap(expandBraces)
    .map((g) => (g.endsWith("/**") ? g.slice(0, -3) : g))
    .filter(Boolean);
  return { paths: globs.length && !globs.every((g) => g === "**") ? globs : null };
}

export function skillText(text) {
  const fm = frontmatter(text);
  if (!fm) return "";
  let out = "", active = false;
  for (const l of fm) {
    const m = /^(\w[\w-]*)\s*:\s*(.*)$/.exec(l);
    if (m) { active = m[1] === "description" || m[1] === "when_to_use"; if (active) out += unquote(m[2].replace(/^[>|][+-]?$/, "")) + " "; }
    else if (active) out += l.trim() + " ";
  }
  return out.trim();
}

// ---- git ---------------------------------------------------------------------------------

const git = (dir, args) => execFileSync("git", ["-C", dir, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 256 * 1024 * 1024 });
const lines = (s) => s.split("\n").filter(Boolean);

// ---- reading ----------------------------------------------------------------------------

// Block-level HTML comments are stripped from what the model reads, so they are not measured.
function strip(text) {
  const parts = [];
  let fence = false;
  let buf = [];
  const flush = () => { if (buf.length) parts.push(buf.join("\n").replace(/<!--[\s\S]*?-->/g, "")); buf = []; };
  for (const l of lf(text).split("\n")) {
    if (/^\s*(```|~~~)/.test(l)) { if (!fence) flush(); fence = !fence; parts.push(l); continue; }
    if (fence) parts.push(l); else buf.push(l);
  }
  flush();
  return parts.join("\n");
}

// Import specifiers outside fenced blocks and inline code spans.
function importsOf(text) {
  const found = [];
  let fence = false;
  for (const raw of lf(text).split("\n")) {
    if (/^\s*(```|~~~)/.test(raw)) { fence = !fence; continue; }
    if (fence) continue;
    const l = raw.replace(/`[^`]*`/g, "");
    for (const m of l.matchAll(/(?:^|\s)@([^\s]+)/g)) found.push(m[1].replace(/[.,;:!?)]+$/, ""));
  }
  return found;
}

export function readFile(dir, rel) {
  try {
    const abs = path.join(dir, rel);
    return fs.statSync(abs).isFile() ? fs.readFileSync(abs, "utf8") : null;
  } catch { return null; }
}

export function walkMd(dir, rel) {
  const abs = path.join(dir, rel);
  if (!fs.existsSync(abs)) return [];
  const out = [];
  for (const e of fs.readdirSync(abs, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const r = `${rel}/${e.name}`;
    if (e.isDirectory()) out.push(...walkMd(dir, r));
    else if (e.name.endsWith(".md")) out.push(r);
  }
  return out;
}

const norm = (s) => s.replace(/\s+/g, " ").trim();
const paragraphs = (text) => lf(text).split(/\n[ \t]*\n/).map(norm).filter((p) => p.length >= MIN_PARAGRAPH);

// ---- the measure ------------------------------------------------------------------------

export function measureBody(dir, { touching, base, allowLost = [] } = {}) {
  const body = path.basename(path.resolve(dir)).toLowerCase();
  const fail = (error, sha = null) => ({ body, sha, startup: { tokens: 0, files: [] }, task: null, wideRules: [], over: { startup: false, task: false }, oversize: [], skippedRules: [], skills: { count: 0, descriptionTokens: 0 }, lost: null, error });

  let tracked, sha;
  try {
    tracked = lines(git(dir, ["ls-files"]));
    sha = git(dir, ["rev-parse", "--short", "HEAD"]).trim();
  } catch {
    try { tracked = lines(git(dir, ["ls-files"])); sha = null; } catch { return fail("not a git checkout"); }
  }
  if (readFile(dir, "CLAUDE.md") === null) return fail("no CLAUDE.md at the root", sha);

  const trackedSet = new Set(tracked);
  const sources = tracked.filter((f) => SOURCE_EXT.has(f.split(".").at(-1)));

  const seen = new Set();
  const raw = new Map();
  const rawOf = (rel) => { if (!raw.has(rel)) raw.set(rel, readFile(dir, rel)); return raw.get(rel); };

  // Add a file and, to four hops, its imports. Returns the entries added (a file counts once).
  function load(rel, reason, entries) {
    if (seen.has(rel)) return;
    const text = rawOf(rel);
    if (text === null) return;
    seen.add(rel);
    entries.push({ path: rel, bytes: Buffer.byteLength(strip(text)), reason });
    follow(rel, text, 1, entries);
  }
  function follow(rel, text, hop, entries) {
    if (hop > MAX_IMPORT_HOPS) return;
    for (const spec of importsOf(strip(text))) {
      if (spec.startsWith("~") || path.isAbsolute(spec)) continue;
      const target = posix(path.normalize(path.join(path.dirname(rel), spec)));
      if (target.startsWith("..") || seen.has(target)) continue;
      const t = rawOf(target);
      if (t === null) continue;
      seen.add(target);
      entries.push({ path: target, bytes: Buffer.byteLength(strip(t)), reason: "import" });
      follow(target, t, hop + 1, entries);
    }
  }

  // A broken symlink or an unreadable entry costs nothing to load, and is noted rather than fatal.
  const ruleEntries = walkMd(dir, ".claude/rules");
  const skippedRules = ruleEntries.filter((rel) => rawOf(rel) === null);
  const ruleFiles = ruleEntries.filter((rel) => rawOf(rel) !== null);
  const scoped = [];
  const wideRules = [];
  const startupFiles = [];

  load("CLAUDE.md", "root", startupFiles);
  if (trackedSet.has("CLAUDE.local.md")) load("CLAUDE.local.md", "root", startupFiles);
  for (const rel of ruleFiles) {
    const { paths: globs } = parseRule(rawOf(rel));
    if (!globs) { load(rel, "unscoped-rule", startupFiles); continue; }
    const match = matcher(globs);
    const hits = sources.filter((f) => match(f)).length;
    const share = sources.length ? hits / sources.length : 0;
    if (share > WIDE_GLOB_SHARE) { wideRules.push({ path: rel, share }); load(rel, "wide-rule", startupFiles); }
    else scoped.push({ rel, match });
  }

  const startupBytes = startupFiles.reduce((n, f) => n + f.bytes, 0);
  const startup = { tokens: tokens(startupBytes), files: startupFiles };

  let task = null;
  if (touching?.length) {
    const added = [];
    for (const t of touching) {
      const file = posix(path.normalize(t)).replace(/^\.\//, "");
      const segs = path.posix.dirname(file) === "." ? [] : path.posix.dirname(file).split("/");
      for (let n = 1; n <= segs.length; n++) load(`${segs.slice(0, n).join("/")}/CLAUDE.md`, "nested", added);
      for (const r of scoped) if (r.match(file)) load(r.rel, "path-rule", added);
    }
    task = { tokens: tokens(startupBytes + added.reduce((n, f) => n + f.bytes, 0)), added };
  }

  const oversize = [];
  const lineCount = (rel) => lf(rawOf(rel)).replace(/\n$/, "").split("\n").length;
  if (lineCount("CLAUDE.md") >= ROOT_LINE_LIMIT) oversize.push({ path: "CLAUDE.md", lines: lineCount("CLAUDE.md"), limit: ROOT_LINE_LIMIT });
  for (const rel of ruleFiles) if (lineCount(rel) >= RULE_LINE_LIMIT) oversize.push({ path: rel, lines: lineCount(rel), limit: RULE_LINE_LIMIT });

  const skillPaths = fs.existsSync(path.join(dir, ".claude/skills"))
    ? fs.readdirSync(path.join(dir, ".claude/skills")).sort().map((d) => `.claude/skills/${d}/SKILL.md`).filter((p) => rawOf(p) !== null)
    : [];
  const skills = { count: skillPaths.length, descriptionTokens: tokens(skillPaths.reduce((n, p) => n + Buffer.byteLength(skillText(rawOf(p))), 0)) };

  let lost = null;
  if (base) {
    try {
      const baseFiles = ["CLAUDE.md", ...lines(git(dir, ["ls-tree", "-r", "--name-only", base, "--", ".claude/rules"]))];
      const haystack = tracked.filter((f) => f.endsWith(".md")).map((f) => rawOf(f)).filter((t) => t !== null).map(norm).join("\n");
      const allowed = new Set(allowLost.map(norm));
      const out = new Set();
      for (const f of baseFiles) {
        let text;
        try { text = git(dir, ["show", `${base}:${f}`]); } catch { continue; }
        for (const p of paragraphs(text)) if (!haystack.includes(p) && !allowed.has(p)) out.add(p);
      }
      lost = [...out];
    } catch (e) {
      return fail(`cannot read base ${base}: ${String(e.stderr || e.message).trim().split(dir).join(body)}`, sha);
    }
  }

  return {
    body, sha, startup, task, wideRules,
    over: { startup: startup.tokens > BUDGET.startup, task: task ? task.tokens > BUDGET.task : false },
    oversize, skippedRules, skills, lost,
  };
}
