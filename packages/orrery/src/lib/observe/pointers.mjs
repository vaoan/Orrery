import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { validateBodyConfig } from "../body-config.mjs";

export function localOverrideViolations(entries) {
  const violations = [];
  (entries ?? []).forEach((entry, i) => {
    if (!Array.isArray(entry.files) || entry.files.length === 0) { violations.push(`entry ${i}: has no files; a local entry must name the files it applies to`); return; }
    for (const f of entry.files) if (typeof f !== "string" || /[*?{}\[\]]/.test(f)) violations.push(`entry ${i}: files pattern ${JSON.stringify(f)} is not a named file`);
  });
  return violations;
}

// readdirSync, not globSync: fs.glob skips dot-prefixed paths such as .husky by default.
const listFiles = (root) => fs.readdirSync(root, { recursive: true, withFileTypes: true }).filter((d) => d.isFile()).map((d) => path.relative(root, path.join(d.parentPath, d.name)).split(path.sep).join("/")).sort();

async function importDefault(file) {
  return (await import(pathToFileURL(file).href + `?t=${Date.now()}`)).default;
}

// This machine checks out CRLF (core.autocrlf=true; see CLAUDE.md), so a byte-for-byte
// comparison would report drift on line endings alone. Normalise before comparing.
const normalizeLineEndings = (buf) => buf.toString("utf8").replace(/\r\n/g, "\n");

export async function pointerDrift(bodyDir, templatesDir, schema) {
  const files = listFiles(templatesDir).map((rel) => {
    const target = path.join(bodyDir, rel);
    if (!fs.existsSync(target)) return { path: rel, state: "missing" };
    const same = normalizeLineEndings(fs.readFileSync(target)) === normalizeLineEndings(fs.readFileSync(path.join(templatesDir, rel)));
    return { path: rel, state: same ? "identical" : "differs" };
  });
  const localFile = path.join(bodyDir, "eslint.local.mjs");
  const local = fs.existsSync(localFile) ? localOverrideViolations(await importDefault(localFile)) : [];
  const configFile = path.join(bodyDir, "orrery.config.mjs");
  const config = fs.existsSync(configFile) ? validateBodyConfig(await importDefault(configFile), schema) : ["missing"];
  return { files, local, config };
}
