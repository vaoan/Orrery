// Pulls the references out of one instruction file. It reads Markdown, not prose: a reference is a link
// target or a backticked token, and a command is a pnpm or themis line. Nothing is fetched or resolved here.

export const EXAMPLE_MARK = /<!--\s*themis:\s*example\s*-->/;
// A marker counts only when it is alone on its line; mentioned inline it is plain text.
export const BLOCK_START = /^\s*<!--\s*themis:\s*examples\s*-->\s*$/;
export const BLOCK_END = /^\s*<!--\s*themis:\s*end\s*-->\s*$/;
const EXT = /\.(md|mjs|js|ts|tsx|json|yml|yaml|sql|css|toml|sh)$/;
const PATH_CHARS = /^[\w.\-/*{}[\]~$<>,:+@()]+$/;

const lf = (text) => text.replace(/\r\n?/g, "\n");

function classify(token) {
  let t = token.trim();
  if (!t || /\s/.test(t) || /^[a-z][a-z0-9+.-]*:\/\//i.test(t) || t.startsWith("--")) return null;
  if (!PATH_CHARS.test(t)) return null;
  t = t.replace(/:\d+(-\d+)?$/, "");
  if (/^\.[a-z]+$/.test(t)) return null; // a bare extension names a kind of file, not a file
  if (!t.includes("/") && !EXT.test(t)) return null;
  return t;
}

// A line that is a table row or says "for example" holds illustrations more often than claims.
const ILLUSTRATIVE_LINE = /^\s*\|.*\|\s*$|\be\.g\.|\bexamples?\b|\bsuch as\b|\bcreates?:|\bnamed? like\b/i;

// kind: link | path | command | skill | agent. `why` is set when the token cannot be verified.
// Returns { refs, unclosed, strays }: `unclosed` is the line of a `themis: examples` block that never
// ends, `strays` the lines of a `themis: end` with no block open. Markers inside a fence are text.
export function extractRefs(text) {
  const refs = [];
  let fence = false, comment = false, block = null, blockFirst = 0;
  const strays = [];
  const closeBlock = (endLine) => { for (let k = blockFirst; k < refs.length; k++) refs[k].why = `example (lines ${block}-${endLine})`; };
  const lines = lf(text).split("\n");
  for (const [i, raw] of lines.entries()) {
    const line = i + 1;
    if (/^\s*(```|~~~)/.test(raw)) { fence = !fence; continue; }
    if (!fence) {
      if (BLOCK_START.test(raw) && block === null) { block = line; blockFirst = refs.length; }
      else if (BLOCK_END.test(raw)) { if (block !== null) { closeBlock(line); block = null; } else strays.push(line); }
    }
    const example = EXAMPLE_MARK.test(raw);
    const illustrative = ILLUSTRATIVE_LINE.test(raw);
    const add = (kind, token, extra = {}) => refs.push({ kind, token, line, ...(example ? { why: "example" } : {}), ...(illustrative ? { illustrative: true } : {}), ...extra });

    if (fence) {
      const m = /^\s*(?:\$\s*)?((?:pnpm|themis)\s+\S.*)$/.exec(raw);
      if (m) addCommand(m[1], add);
      continue;
    }

    let l = raw;
    if (comment) { const end = l.indexOf("-->"); if (end === -1) continue; l = l.slice(end + 3); comment = false; }
    l = l.replace(/<!--[\s\S]*?-->/g, "");
    const open = l.indexOf("<!--");
    if (open !== -1) { l = l.slice(0, open); comment = true; }

    const spans = [];
    const bare = l.replace(/``?([^`]+?)``?/g, (all, code, offset) => { spans.push({ code, offset }); return " ".repeat(all.length); });

    for (const m of bare.matchAll(/!?\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)) addLink(m[1], add);

    for (const { code, offset } of spans) {
      const t = code.trim();
      const lead = /\b(skill|agent)s?\s*$/i.exec(l.slice(0, offset));
      if (/^(pnpm|themis)\s+\S/.test(t)) { addCommand(t, add); continue; }
      const slash = /^\/([a-z][a-z0-9-]*(?::[a-z][a-z0-9-]*)?)$/.exec(t);
      if (slash) { add("skill", slash[1], { slash: true }); continue; }
      if (lead && /^[a-z][a-z0-9-]*(?::[a-z][a-z0-9-]*)?$/.test(t)) { add(lead[1].toLowerCase() === "agent" ? "agent" : "skill", t); continue; }
      const p = classify(t);
      if (p !== null) addPath(p, "path", add);
    }
  }
  if (block !== null) { for (let k = blockFirst; k < refs.length; k++) refs[k].why = `example (lines ${block}-end)`; }
  return { refs, unclosed: block, strays };
}

function addCommand(text, add) {
  const words = text.split(/\s+/);
  if (words[0] === "pnpm" && words[1] === "themis") { if (words[2]) addCommandWords(["themis", ...words.slice(2)], add, text); return; }
  addCommandWords(words, add, text);
}

function addCommandWords(words, add) {
  const [tool, first, second] = words;
  if (!first) return;
  if (first.startsWith("<")) return add("command", `${tool} ${first}`, { tool, why: "example" });
  if (first.startsWith("-")) return tool === "themis" ? undefined : add("command", `${tool} ${first}`, { tool, why: "flags" });
  add("command", `${tool} ${first}`, { tool, name: first, arg: second });
}

function addLink(target, add) {
  let t = target.split("#")[0].split("?")[0];
  if (!t || /^[a-z][a-z0-9+.-]*:/i.test(t)) return;
  try { t = decodeURIComponent(t); } catch { /* keep as written */ }
  addPath(t, "link", add);
}

function addPath(p, kind, add) {
  if (/[<>]/.test(p)) return add(kind, p, { why: "example" });
  if (p.startsWith("/")) return add(kind, "<absolute path>", { why: "absolute" });
  if (p.startsWith("~")) return add(kind, "<home path>", { why: "home" });
  if (/\$|\{\{/.test(p)) return add(kind, p, { why: "variable" });
  add(kind, p);
}
