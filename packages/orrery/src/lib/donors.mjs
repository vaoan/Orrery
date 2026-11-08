import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { readEffectiveConfig } from "./effective-config.mjs";

export function stripJsonComments(text) {
  let out = "";
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];
    if (inString) {
      out += c;
      if (c === "\\") { out += next ?? ""; i++; continue; }
      if (c === '"') inString = false;
      continue;
    }
    if (c === '"') { inString = true; out += c; continue; }
    if (c === "/" && next === "/") { while (i < text.length && text[i] !== "\n") i++; out += "\n"; continue; }
    if (c === "/" && next === "*") { i += 2; while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++; i++; continue; }
    out += c;
  }
  return out;
}

const readText = (dir, rel) => (fs.existsSync(path.join(dir, rel)) ? fs.readFileSync(path.join(dir, rel), "utf8") : null);
const readJson = (dir, rel) => { const t = readText(dir, rel); return t === null ? null : JSON.parse(stripJsonComments(t)); };
const firstJson = (dir, rels) => { for (const rel of rels) { const v = readJson(dir, rel); if (v !== null) return v; } return null; };

async function importConfig(dir, rels) {
  for (const rel of rels) {
    const file = path.join(dir, rel);
    if (!fs.existsSync(file)) continue;
    const mod = await import(pathToFileURL(file).href + `?t=${Date.now()}`);
    return mod.default ?? mod;
  }
  return null;
}

function defaultRun(command, args, cwd) {
  return execFileSync(command, args, { cwd, encoding: "utf8" });
}

export async function readDonor(repoDirectory, samples, { exec, run = defaultRun } = {}) {
  const sha = run("git", ["rev-parse", "--short", "HEAD"], repoDirectory).trim();
  const eslint = {};
  for (const [surface, file] of Object.entries(samples)) {
    eslint[surface] = readEffectiveConfig(repoDirectory, file, exec);
  }
  const pkg = readJson(repoDirectory, "package.json") ?? {};
  return {
    dir: repoDirectory,
    sha,
    eslint,
    tsconfig: firstJson(repoDirectory, ["tsconfig.base.json", "tsconfig.json"]),
    stylelint: await importConfig(repoDirectory, ["stylelint.config.mjs", "stylelint.config.js"]),
    prettier: firstJson(repoDirectory, [".prettierrc", ".prettierrc.json"]) ?? pkg.prettier ?? null,
    secretlint: readJson(repoDirectory, ".secretlintrc.json"),
    jscpd: readJson(repoDirectory, ".jscpd.json"),
    cspell: readJson(repoDirectory, "cspell.json"),
    knip: readJson(repoDirectory, "knip.json"),
    syncpack: readJson(repoDirectory, ".syncpackrc.json"),
    lintStaged: pkg["lint-staged"] ?? null,
    lsLint: readText(repoDirectory, ".ls-lint.yml"),
    hooks: { preCommit: readText(repoDirectory, ".husky/pre-commit"), prePush: readText(repoDirectory, ".husky/pre-push") },
  };
}
