import fs from "node:fs";
import path from "node:path";
import { COMMAND_NAMES } from "../../cli.mjs";
import { extractRefs } from "./extract.mjs";
import { readFile } from "../instructions/measure.mjs";

const SKIP = new Set([".git", "node_modules"]);
const posix = (p) => p.split(path.sep).join("/");

// pnpm answers these itself, or runs a bin or lifecycle script, so no package.json has to name them.
const PNPM_BUILTIN = new Set(["install", "i", "add", "remove", "rm", "uninstall", "update", "up", "upgrade", "import", "link", "unlink", "rebuild", "prune", "fetch", "audit", "outdated", "list", "ls", "why", "dedupe", "patch", "patch-commit", "store", "init", "pack", "publish", "create", "env", "self-update", "setup", "root", "bin", "config", "get", "set", "licenses", "doctor", "deploy", "approve-builds", "recursive", "cache", "test", "start", "stop", "restart", "exec", "dlx", "x", "vitest", "eslint", "tsc", "prettier", "tsx", "next", "playwright", "turbo", "knip", "jscpd", "cspell", "stylelint", "husky", "supabase", "syncpack", "lint-staged", "secretlint", "changeset"]);
// Slash commands and bundled skills that exist in every Claude Code session.
const BUILTIN_SLASH = new Set(["help", "clear", "compact", "init", "review", "config", "model", "memory", "agents", "mcp", "permissions", "resume", "status", "cost", "doctor", "login", "logout", "bug", "vim", "terminal-setup", "add-dir", "hooks", "ide", "pr-comments", "release-notes", "rewind", "export", "context", "usage", "plugin", "plugins", "loop", "schedule", "security-review", "simplify", "code-review", "run", "fewer-permission-prompts", "update-config", "keybindings-help", "batch", "skills", "login", "exit", "quit", "fast", "theme", "statusline", "output-style", "todos", "btw", "branch", "fork", "effort", "plan"]);
const KNOWN_PLUGIN_MARK = ":";

// Every file of the body that could be named, relative and posix, with no dependency on git.
export function listFiles(dir) {
  const out = [];
  const walk = (rel) => {
    for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
      if (e.isDirectory()) { if (!SKIP.has(e.name)) walk(rel ? `${rel}/${e.name}` : e.name); }
      else out.push(rel ? `${rel}/${e.name}` : e.name);
    }
  };
  try { walk(""); } catch { /* an unreadable body has no files */ }
  return out;
}

function readJson(dir, rel) {
  try { return JSON.parse(readFile(dir, rel) ?? ""); } catch { return null; }
}

function workspaceGlobs(dir) {
  const text = readFile(dir, "pnpm-workspace.yaml") ?? "";
  const globs = [];
  let inPackages = false;
  for (const l of text.replace(/\r/g, "").split("\n")) {
    if (/^packages\s*:/.test(l)) { inPackages = true; continue; }
    if (inPackages) {
      const m = /^\s*-\s*["']?([^"'#]+?)["']?\s*(#.*)?$/.exec(l);
      if (m) globs.push(m[1]); else if (/^\S/.test(l)) inPackages = false;
    }
  }
  const ws = readJson(dir, "package.json")?.workspaces;
  for (const g of Array.isArray(ws) ? ws : ws?.packages ?? []) globs.push(g);
  return globs;
}

// What the references of a body are checked against, built once per body.
export function bodyContext(dir) {
  const files = listFiles(dir);
  const fileSet = new Set(files);
  const scripts = new Set(Object.keys(readJson(dir, "package.json")?.scripts ?? {}));
  const globs = workspaceGlobs(dir).filter((g) => !g.startsWith("!"));
  for (const f of files) {
    if (!f.endsWith("/package.json")) continue;
    const pkgDir = f.slice(0, -"/package.json".length);
    if (globs.some((g) => path.matchesGlob(pkgDir, g.replace(/\/$/, "")))) for (const s of Object.keys(readJson(dir, f)?.scripts ?? {})) scripts.add(s);
  }
  const skills = new Set(files.filter((f) => /^\.claude\/skills\/[^/]+\/SKILL\.md$/.test(f)).map((f) => f.split("/")[2]));
  const agents = new Set(files.filter((f) => /^\.claude\/agents\/.+\.md$/.test(f)).map((f) => path.posix.basename(f, ".md")));
  const commands = new Set(files.filter((f) => /^\.claude\/commands\/.+\.md$/.test(f)).map((f) => f.slice(".claude/commands/".length, -3).replace(/\//g, ":")));
  const plugins = Object.keys(readJson(dir, ".claude/settings.json")?.enabledPlugins ?? {}).map((k) => k.split("@")[0]);
  return { dir, files, fileSet, scripts, skills, agents, commands, plugins };
}

// Brackets alone are a literal, such as a Next.js route `[id]`; `*` and `{}` make a glob.
const isGlob = (p) => /[*{}]/.test(p);
const exists = (ctx, rel) => ctx.fileSet.has(rel) || ctx.files.some((f) => f.startsWith(`${rel}/`));

function resolvePath(ctx, fileRel, token) {
  const clean = token.replace(/^\.\//, "").replace(/\/$/, "");
  const fileDir = path.posix.dirname(fileRel);
  const bases = fileDir === "." ? [""] : ["", fileDir];
  const join = (b, p) => path.posix.normalize(b ? `${b}/${p}` : p);
  if (isGlob(clean)) {
    const pattern = clean.includes("/") ? clean : `**/${clean}`;
    return bases.some((b) => ctx.files.some((f) => path.matchesGlob(f, join(b, pattern))));
  }
  return bases.some((b) => { const p = join(b, clean); return !p.startsWith("..") && exists(ctx, p); });
}

// Returns { checked, broken, exceptions, external } for one file's text.
export function checkText(ctx, fileRel, text) {
  const res = { checked: 0, broken: [], exceptions: [], external: [] };
  for (const r of extractRefs(text)) {
    const at = { file: fileRel, line: r.line, kind: r.kind, token: r.token };
    if (r.why) { res.exceptions.push({ ...at, why: r.why }); continue; }
    res.checked++;
    const bad = (reason) => res.broken.push({ ...at, reason });
    if (r.kind === "link" || r.kind === "path") {
      if (!resolvePath(ctx, fileRel, r.token)) bad(isGlob(r.token) ? "glob matches no file" : "no such file");
    } else if (r.kind === "command") {
      if (r.tool === "themis") { if (!COMMAND_NAMES.includes(r.name) && !r.name.startsWith("-")) bad("not a registered themis command"); }
      else if (r.name === "run") { if (r.arg && !r.arg.startsWith("-") && !ctx.scripts.has(r.arg)) bad("no such pnpm script"); }
      else if (!PNPM_BUILTIN.has(r.name) && !ctx.scripts.has(r.name)) bad("no such pnpm script");
    } else {
      const name = r.token;
      if (name.includes(KNOWN_PLUGIN_MARK)) { res.external.push({ ...at, plugin: name.split(":")[0] }); continue; }
      const local = r.kind === "agent" ? ctx.agents : new Set([...ctx.skills, ...ctx.commands, ...BUILTIN_SLASH]);
      if (r.kind === "skill" && ctx.agents.has(name)) continue;
      if (!local.has(name)) bad(`no such ${r.kind} in the body`);
    }
  }
  return res;
}

export function checkFiles(ctx, rels) {
  const total = { checked: 0, broken: [], exceptions: [], external: [] };
  for (const rel of rels) {
    const text = readFile(ctx.dir, rel);
    if (text === null) continue;
    const r = checkText(ctx, rel, text);
    total.checked += r.checked;
    total.broken.push(...r.broken);
    total.exceptions.push(...r.exceptions);
    total.external.push(...r.external);
  }
  return total;
}

export const posixPath = posix;
