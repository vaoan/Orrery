import path from "node:path";
import { execFileSync } from "node:child_process";
import { COMMAND_NAMES } from "../command-names.mjs";
import { loadRegistry } from "../registry.mjs";
import { extractRefs } from "./extract.mjs";
import { readFile } from "../instructions/measure.mjs";
import { listBodyFiles } from "../instructions/discover.mjs";

// pnpm answers these itself, or runs a bin or lifecycle script, so no package.json has to name them.
const PNPM_BUILTIN = new Set(["install", "i", "add", "remove", "rm", "uninstall", "update", "up", "upgrade", "import", "link", "unlink", "rebuild", "prune", "fetch", "audit", "outdated", "list", "ls", "why", "dedupe", "patch", "patch-commit", "store", "init", "pack", "publish", "create", "env", "self-update", "setup", "root", "bin", "config", "get", "set", "licenses", "doctor", "deploy", "approve-builds", "recursive", "cache", "test", "start", "stop", "restart", "exec", "dlx", "x", "vitest", "eslint", "tsc", "prettier", "tsx", "next", "playwright", "turbo", "knip", "jscpd", "cspell", "stylelint", "husky", "supabase", "syncpack", "lint-staged", "secretlint", "changeset"]);
// Slash commands and bundled skills that exist in every Claude Code session.
const BUILTIN_SLASH = new Set(["help", "clear", "compact", "init", "review", "config", "model", "memory", "agents", "mcp", "permissions", "resume", "status", "cost", "doctor", "login", "logout", "bug", "vim", "terminal-setup", "add-dir", "hooks", "ide", "pr-comments", "release-notes", "rewind", "export", "context", "usage", "plugin", "plugins", "loop", "schedule", "security-review", "simplify", "code-review", "run", "fewer-permission-prompts", "update-config", "keybindings-help", "batch", "skills", "exit", "quit", "fast", "theme", "statusline", "output-style", "todos", "btw", "branch", "fork", "effort", "plan"]);
// Git-flow branch types (docs/decisions, policy): a token that starts with one and names no
// top-level directory is a branch name, not a path.
const BRANCH_TYPES = new Set(["feat", "fix", "chore", "docs", "refactor", "test", "perf", "ci", "build", "style", "release", "hotfix", "back-merge", "type", "feature"]);

function owners() {
  try { return new Set(Object.values(loadRegistry().bodies ?? {}).map((b) => b.repo.split("/")[0])); } catch { return new Set(); } // no registry, no slug rule
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

// plugin ids an eslint rule can be named under: eslint-plugin-X -> X, @scope/eslint-plugin -> @scope,
// @scope/eslint-plugin-X -> @scope/X.
function pluginIds(depNames) {
  const ids = new Set();
  for (const n of depNames) {
    let m;
    if ((m = /^eslint-plugin-(.+)$/.exec(n))) ids.add(m[1]);
    else if ((m = /^(@[^/]+)\/eslint-plugin$/.exec(n))) ids.add(m[1]);
    else if ((m = /^(@[^/]+)\/eslint-plugin-(.+)$/.exec(n))) ids.add(`${m[1]}/${m[2]}`);
  }
  return ids;
}

// What the references of a body are checked against, built once per body.
export function bodyContext(dir, files = listBodyFiles(dir)) {
  const fileSet = new Set(files);
  const dirSet = new Set();
  const basenames = new Set();
  const dirBasenames = new Set();
  for (const f of files) {
    basenames.add(path.posix.basename(f));
    for (let d = path.posix.dirname(f); d !== "." && !dirSet.has(d); d = path.posix.dirname(d)) { dirSet.add(d); dirBasenames.add(path.posix.basename(d)); }
  }
  const rootPkg = readJson(dir, "package.json");
  const scripts = new Set(Object.keys(rootPkg?.scripts ?? {}));
  const depNames = new Set();
  const addDeps = (pkg) => { for (const k of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) for (const n of Object.keys(pkg?.[k] ?? {})) depNames.add(n); };
  addDeps(rootPkg);
  const globs = workspaceGlobs(dir).filter((g) => !g.startsWith("!")).map((g) => g.replace(/^\.\//, "").replace(/\/$/, ""));
  const packages = [];
  for (const f of files) {
    if (!f.endsWith("/package.json")) continue;
    const pkgDir = f.slice(0, -"/package.json".length);
    if (!globs.some((g) => path.matchesGlob(pkgDir, g))) continue;
    const pkg = readJson(dir, f);
    if (!pkg) continue;
    packages.push({ dir: pkgDir, name: pkg.name ?? null, exports: pkg.exports ?? null });
    for (const s of Object.keys(pkg.scripts ?? {})) scripts.add(s);
    addDeps(pkg);
  }
  const skills = new Set(files.filter((f) => /^\.claude\/skills\/[^/]+\/SKILL\.md$/.test(f)).map((f) => f.split("/")[2]));
  const agents = new Set(files.filter((f) => /^\.claude\/agents\/.+\.md$/.test(f)).map((f) => path.posix.basename(f, ".md")));
  const commands = new Set(files.filter((f) => /^\.claude\/commands\/.+\.md$/.test(f)).map((f) => f.slice(".claude/commands/".length, -3).replace(/\//g, ":")));
  const plugins = Object.keys(readJson(dir, ".claude/settings.json")?.enabledPlugins ?? {});
  const topDirs = new Set(files.filter((f) => f.includes("/")).map((f) => f.split("/")[0]));
  return { dir, files, fileSet, dirSet, basenames, dirBasenames, topDirs, packages, scripts, skills, agents, commands, plugins, owners: owners(), eslintPlugins: pluginIds(depNames) };
}

// Brackets alone are a literal, such as a Next.js route `[id]`; `*` and `{}` make a glob.
const isGlob = (p) => /[*{}]/.test(p);
const exists = (ctx, rel) => ctx.fileSet.has(rel) || ctx.dirSet.has(rel);
const hasExtension = (p) => /\.[A-Za-z0-9]+$/.test(path.posix.basename(p));
const hasFileExtension = (p) => /\.(md|mjs|js|ts|tsx|json|yml|yaml|sql|css|toml|sh)$/.test(p);
const isPlaceholderSeg = (seg) => /\[[^\]]+\]/.test(seg) || /\{[^,}]*\}/.test(seg);

function globMatches(ctx, base, pattern) {
  const full = base ? path.posix.join(base, pattern) : pattern;
  return ctx.files.some((f) => path.matchesGlob(f, full)) || [...ctx.dirSet].some((d) => path.matchesGlob(d, full));
}

// Where a relative token may resolve from: the body root, the file's directory, then every workspace
// package root and its src/.
function bases(ctx, fileRel) {
  const fileDir = path.posix.dirname(fileRel);
  return ["", ...(fileDir === "." ? [] : [fileDir]), ...ctx.packages.flatMap((p) => [p.dir, `${p.dir}/src`])];
}

// A single segment is a bare name: a file name with an extension, or a directory name with a trailing
// slash. It is vocabulary, a weak claim, so any file or directory with that name anywhere satisfies it.
const bareName = (token, segs) => segs.length === 1 && !isGlob(token) && (token.endsWith("/") || hasExtension(token));

// Returns "base" when the token resolves from a base, "elsewhere" when a bare name only matches a file
// or directory somewhere else in the body, false otherwise.
function resolveLiteral(ctx, fileRel, clean, bare) {
  const join = (b, p) => path.posix.normalize(b ? `${b}/${p}` : p);
  if (bases(ctx, fileRel).some((b) => { const p = join(b, clean); return !p.startsWith("..") && exists(ctx, p); })) return "base";
  if (bare === "file" && ctx.basenames.has(clean)) return "elsewhere";
  if (bare === "dir" && ctx.dirBasenames.has(clean)) return "elsewhere";
  return false;
}

function resolveGlob(ctx, fileRel, clean) {
  const pattern = clean.includes("/") ? clean : `**/${clean}`;
  return bases(ctx, fileRel).some((b) => globMatches(ctx, b, pattern));
}

// A first segment that names a workspace package: check the rest against that package.
function resolveInPackage(ctx, clean) {
  for (const p of ctx.packages) {
    if (!p.name) continue;
    const segs = clean.split("/");
    const nameSegs = p.name.split("/").length;
    if (segs.slice(0, nameSegs).join("/") !== p.name) continue;
    const rest = segs.slice(nameSegs).join("/");
    if (rest === "" || exists(ctx, `${p.dir}/${rest}`)) return true;
    if (p.exports && typeof p.exports === "object" && Object.keys(p.exports).includes(`./${rest}`)) return true;
  }
  return false;
}

// A branch name: a git-flow type, then a glob, a placeholder or a kebab-case description with a hyphen.
// Never something path-like (an extension, another slash), and never when a top-level directory has the type's name
// and the rest could be inside it.
function isBranch(ctx, token, segs) {
  if (!BRANCH_TYPES.has(segs[0]) || ctx.topDirs.has(segs[0])) return false;
  if (segs.length !== 2) return false; // a lone `docs/` or `feature/` is a bare directory name
  const rest = segs[1];
  if (rest.includes(".")) return false; // path-like: an extension or a version
  return rest === "*" || isGlob(rest) || isPlaceholderSeg(rest) || /^[A-Za-z0-9_.]+(-[A-Za-z0-9_.]+)+$/.test(rest);
}

// Returns { ok }, { ok, elsewhere }, { broken } or { skip } with the reason the token is not a path to check.
function checkPath(ctx, fileRel, token, kind) {
  const clean = token.replace(/^\.\//, "").replace(/\/$/, "");
  const segs = clean.split("/");
  if (clean.startsWith("@")) {
    // A scoped specifier: checked when it names a workspace package, otherwise it is someone else's package.
    return ctx.packages.some((p) => p.name && (clean === p.name || clean.startsWith(`${p.name}/`))) ? (resolveInPackage(ctx, clean) ? { ok: true } : { broken: undefined }) : { skip: "package specifier" };
  }
  if (/^\.\.?\//.test(token) && !hasExtension(clean)) return { skip: "import specifier" };
  if (token === ".." || token === "../") return { skip: "import specifier" };
  if (segs.length >= 2 && ctx.owners.has(segs[0])) return { skip: "repository name" };
  if (kind === "path" && isBranch(ctx, token, segs)) return { skip: "branch name" };
  if (segs.length === 2 && !hasExtension(clean) && ctx.eslintPlugins.has(segs[0])) return { skip: "eslint rule" };
  if (segs.length === 3 && segs[0].startsWith("@") && !hasExtension(clean) && ctx.eslintPlugins.has(`${segs[0]}/${segs[1]}`)) return { skip: "eslint rule" };

  const bare = bareName(token, segs) ? (token.endsWith("/") ? "dir" : "file") : null;
  const run = (c, b = null) => isGlob(c) ? resolveGlob(ctx, fileRel, c) : resolveLiteral(ctx, fileRel, c, b) || resolveInPackage(ctx, c);
  const found = run(clean, bare);
  if (found === "elsewhere") return { ok: true, elsewhere: true };
  if (found) return { ok: true };

  const at = segs.findIndex(isPlaceholderSeg);
  if (at !== -1) {
    // Only the part before the first placeholder can be checked.
    const before = segs.slice(0, at).join("/");
    if (before === "") return { skip: "placeholder" };
    return run(before) ? { ok: true } : { broken: `no such directory ${before}`, probe: `${before}/` };
  }
  return { broken: undefined, probe: isGlob(clean) ? undefined : token.replace(/^\.\//, "") };
}

// Returns { checked, broken, exceptions, external } for one file's text.
export function checkText(ctx, fileRel, text) {
  const res = { checked: 0, broken: [], exceptions: [], external: [] };
  const { refs, unclosed, strays } = extractRefs(text);
  for (const line of strays) res.broken.push({ file: fileRel, line, kind: "marker", token: "themis: end", reason: "end with no examples block open", likely: "stale" });
  if (unclosed !== null) res.broken.push({ file: fileRel, line: unclosed, kind: "marker", token: "themis: examples", reason: "block opened and never closed with themis: end", likely: "stale" });
  for (const r of refs) {
    const at = { file: fileRel, line: r.line, kind: r.kind, token: r.token };
    if (r.why) { res.exceptions.push({ ...at, why: r.why }); continue; }
    if (r.kind === "link" || r.kind === "path") {
      const c = checkPath(ctx, fileRel, r.token, r.kind);
      if (c.skip) { res.exceptions.push({ ...at, why: c.skip }); continue; }
      res.checked++;
      if (c.elsewhere) { res.exceptions.push({ ...at, why: "matched elsewhere" }); continue; }
      const bare = r.kind === "path" && !isGlob(r.token) && r.token.replace(/^\.\//, "").replace(/\/$/, "").split("/").length === 1;
      if (!c.ok) res.broken.push({ ...at, reason: c.broken ?? (isGlob(r.token) ? "glob matches no file" : r.token.endsWith("/") ? "no such directory" : "no such file"), likely: bare ? "ambiguous" : r.kind === "path" && (r.illustrative || /\bpath\/to\b|YYYY|\{|<|\[/.test(r.token)) ? "illustrative" : "stale", probe: c.probe });
      continue;
    }
    if (r.kind === "command") {
      res.checked++;
      const bad = (reason) => res.broken.push({ ...at, reason, likely: "stale" });
      if (r.tool === "themis") { if (!COMMAND_NAMES.includes(r.name) && !r.name.startsWith("-")) bad("not a registered themis command"); }
      else if (r.name === "run") { if (r.arg && !r.arg.startsWith("-") && !ctx.scripts.has(r.arg)) bad("no such pnpm script"); }
      else if (!PNPM_BUILTIN.has(r.name) && !ctx.scripts.has(r.name)) bad("no such pnpm script");
      continue;
    }
    // skill or agent
    const name = r.token;
    if (name.includes(":")) { res.external.push({ ...at, plugin: name.split(":")[0] }); res.checked++; continue; }
    // A `/name` that names a top-level directory or a package's src/app/<name> is a route, not a skill.
    if (r.slash && (ctx.topDirs.has(name) || ctx.packages.some((p) => ctx.dirSet.has(`${p.dir}/src/app/${name}`)))) { res.exceptions.push({ ...at, why: "route" }); continue; }
    res.checked++;
    const known = r.kind === "agent" ? ctx.agents.has(name) : ctx.skills.has(name) || ctx.agents.has(name) || ctx.commands.has(name) || BUILTIN_SLASH.has(name);
    if (known) continue;
    if (ctx.plugins.length) res.external.push({ ...at, plugin: "unverified" });
    else res.broken.push({ ...at, reason: `no such ${r.kind} in the body`, likely: "stale" });
  }
  return res;
}

// A path the body's own .gitignore ignores is not expected to be tracked: build output, a runtime
// directory, a local-only config file. `git check-ignore` decides, so nested .gitignore files count.
function ignoredProbes(ctx, probes) {
  const candidates = new Map();
  for (const { file, probe } of probes) {
    const fileDir = path.posix.dirname(file);
    const list = [];
    for (const b of ["", ...(fileDir === "." ? [] : [fileDir]), ...ctx.packages.flatMap((p) => [p.dir, `${p.dir}/src`])]) {
      const dirLike = probe.endsWith("/");
      const p = path.posix.normalize(b ? `${b}/${probe}` : probe).replace(/\/$/, "");
      if (!p.startsWith("..")) list.push(dirLike ? `${p}/` : p);
    }
    candidates.set(`${file}\0${probe}`, list);
  }
  const all = [...new Set([...candidates.values()].flat())];
  let ignored;
  try {
    const out = execFileSync("git", ["-C", ctx.dir, "check-ignore", "--no-index", "-z", "--stdin"], { input: all.join("\0"), encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] });
    ignored = new Set(out.split("\0").filter(Boolean));
  } catch (e) {
    ignored = new Set(String(e.stdout ?? "").split("\0").filter(Boolean)); // exit 1 means none matched
  }
  return new Set([...candidates].filter(([, list]) => list.some((c) => ignored.has(c))).map(([k]) => k));
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
  const probes = total.broken.filter((b) => b.probe).map((b) => ({ file: b.file, probe: b.probe }));
  if (probes.length) {
    const ignored = ignoredProbes(ctx, probes);
    for (const b of total.broken.filter((x) => x.probe && ignored.has(`${x.file}\0${x.probe}`))) total.exceptions.push({ file: b.file, line: b.line, kind: b.kind, token: b.token, why: "ignored by .gitignore" });
    total.broken = total.broken.filter((b) => !(b.probe && ignored.has(`${b.file}\0${b.probe}`)));
  }
  for (const b of total.broken) delete b.probe;
  return total;
}
