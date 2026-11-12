import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const templatesDir = path.resolve(here, "../../templates");

export const STEP_KINDS = ["generate-repo", "rename", "write-pointers", "apply-policy", "registry-pr"];
export const NAME_PATTERN = /^[a-z][a-z0-9-]*$/;
const BRANCH_POLL_TRIES = 30;
const BRANCH_POLL_MS = 2000;
const COMMIT_MESSAGE = "chore(init): rename and pointers [GH-000]";

const capitalise = (text) => text.charAt(0).toUpperCase() + text.slice(1);
export const defaultRepoName = capitalise;

export function listClasses(dir = templatesDir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
}

function listFiles(dir, rel = "") {
  const out = [];
  for (const entry of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    const next = path.posix.join(rel.split(path.sep).join("/"), entry.name);
    if (entry.isDirectory()) out.push(...listFiles(dir, next));
    else out.push(next);
  }
  return out.sort();
}

// vulkan -> name, Vulkan -> Name: case-preserving, whole text.
const swap = (text, name) => text.replace(/vulkan/g, name).replace(/Vulkan/g, capitalise(name));

/** The rename, and only the rename: four named files, the title line of two of them. */
export function renameText(file, text, name) {
  switch (file) {
    case "package.json":
      return text.replace(/("name"\s*:\s*")([^"]*)(")/, (_m, a, value, c) => a + swap(value, name) + c);
    case "themis.config.mjs":
      return swap(text, name);
    case "CLAUDE.md":
    case "README.md":
      return text.replace(/^# .*$/m, (line) => swap(line, name));
    default:
      return text;
  }
}
export const RENAMED_FILES = ["package.json", "themis.config.mjs", "CLAUDE.md", "README.md"];

/** Insert one body into registry.json text, matching the existing column alignment. */
export function insertRegistryEntry(text, name, entry) {
  const parsed = JSON.parse(text);
  const expected = { ...parsed, bodies: { ...parsed.bodies, [name]: entry } };
  const q = JSON.stringify;
  const bodies = Object.entries(expected.bodies);
  const width = (pick) => Math.max(...bodies.map(([k, v]) => q(pick(k, v)).length));
  const keyW = width((k) => k) + 2;
  const repoW = width((_k, v) => v.repo) + 10;
  const roleW = width((_k, v) => v.role) + 10;
  const line = `${`${q(name)}:`.padEnd(keyW)}{ ${`"repo": ${q(entry.repo)},`.padEnd(repoW)}${`"role": ${q(entry.role)},`.padEnd(roleW)}"class": ${q(entry.class)} }`;
  const tail = /\n(\s*\}\s*\n\}\s*)$/.exec(text);
  if (tail) {
    const candidate = `${text.slice(0, tail.index)},\n    ${line}\n${tail[1]}`;
    try {
      if (JSON.stringify(JSON.parse(candidate)) === JSON.stringify(expected)) return candidate;
    } catch {
      // fall through to the stable form
    }
  }
  return JSON.stringify(expected, null, 2) + "\n";
}

const decode = (data) => (data?.content ? Buffer.from(data.content, data.encoding ?? "base64") : null);
const contentsRoute = (repo, file, ref) => `/repos/${repo}/contents/${file.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(ref)}`;

/**
 * What init would do, step by step, with each step's `done` read from GitHub.
 * Only reads: nothing here writes, so --dry-run is the plan alone.
 */
export async function planInit({
  name, owner = "vaoan", template = "vaoan/Vulkan", klass, role = "planet", repoName = capitalise(name),
  github, policy, applyRepoPolicy, themisRepo = "vaoan/Themis", pointersDir = path.join(templatesDir, klass ?? ""),
}) {
  const repo = `${owner}/${repoName}`;
  const registryBranch = `feat/register-${name}`;
  const entry = { repo, role, class: klass };

  const { data: templateData } = await github.request("GET", `/repos/${template}`);
  if (!templateData) throw new Error(`template ${template} not found or not accessible`);
  const defaultBranch = templateData.default_branch;

  const { data: repoData } = await github.request("GET", `/repos/${repo}`);
  const exists = Boolean(repoData);
  // Generation is asynchronous: the repository can exist before its default branch does.
  let branchReady = false;
  if (exists) {
    const { data: branches } = await github.request("GET", `/repos/${repo}/branches`);
    branchReady = Array.isArray(branches) && branches.some((b) => b.name === defaultBranch);
  }

  let renameDone = false;
  let pointersDone = false;
  let policyDone = false;
  const pointerFiles = listFiles(pointersDir);
  if (exists) {
    const { data: pkg } = await github.request("GET", contentsRoute(repo, "package.json", defaultBranch));
    const pkgText = decode(pkg)?.toString("utf8");
    try {
      renameDone = pkgText !== undefined && pkgText !== null && JSON.parse(pkgText).name === name;
    } catch {
      renameDone = false;
    }
    pointersDone = true;
    for (const file of pointerFiles) {
      const { data } = await github.request("GET", contentsRoute(repo, file, defaultBranch));
      const remote = decode(data);
      if (!remote || !remote.equals(fs.readFileSync(path.join(pointersDir, file)))) {
        pointersDone = false;
        break;
      }
    }
    try {
      const { data: main } = await github.request("GET", `/repos/${repo}/branches/main`);
      if (main) {
        const { ops } = await applyRepoPolicy(github, repo, policy, { dryRun: true });
        policyDone = ops.length === 0;
      }
    } catch {
      policyDone = false;
    }
  }

  const { data: registryFile } = await github.request("GET", contentsRoute(themisRepo, "registry.json", "develop"));
  const registryText = decode(registryFile)?.toString("utf8");
  let registered = false;
  try {
    registered = Boolean(JSON.parse(registryText ?? "{}").bodies?.[name]);
  } catch {
    registered = false;
  }
  let prUrl = null;
  if (!registered) {
    const head = `${themisRepo.split("/")[0]}:${registryBranch}`;
    const { data: prs } = await github.request("GET", `/repos/${themisRepo}/pulls?head=${encodeURIComponent(head)}&state=open`);
    prUrl = prs?.[0]?.html_url ?? null;
  }

  const steps = [
    { kind: "generate-repo", done: exists && branchReady, exists, detail: `${repo} from ${template}` },
    { kind: "rename", done: renameDone, detail: `vulkan -> ${name} in package.json, themis.config.mjs, CLAUDE.md and README.md titles` },
    { kind: "write-pointers", done: pointersDone, detail: `${pointerFiles.length} pointer file(s) of class ${klass}` },
    { kind: "apply-policy", done: policyDone, detail: `bring ${repo} to policy/repository.json` },
    { kind: "registry-pr", done: registered || prUrl !== null, detail: `register ${name} in ${themisRepo} registry.json on ${registryBranch}`, prUrl },
  ];
  return { steps, params: { name, owner, repo, template, klass, role, entry, defaultBranch, themisRepo, registryBranch, pointersDir, pointerFiles } };
}

const CREDENTIAL_HELPER = "credential.helper=!f(){ echo username=x-access-token; echo password=$GH_TOKEN; }; f";
// The token reaches git through the environment of this one process, never an argument, URL or config.
const authed = (args) => ["-c", "credential.helper=", "-c", CREDENTIAL_HELPER, ...args];

async function generateRepo(plan, { github, sleep }) {
  const { template, owner, repo, defaultBranch } = plan.params;
  const name = repo.split("/")[1];
  if (!plan.steps[0].exists) {
    await github.request("POST", `/repos/${template}/generate`, { owner, name, private: false, include_all_branches: false });
  }
  for (let attempt = 0; attempt < BRANCH_POLL_TRIES; attempt++) {
    const { data } = await github.request("GET", `/repos/${repo}/branches`);
    if (Array.isArray(data) && data.some((b) => b.name === defaultBranch)) return;
    await sleep(BRANCH_POLL_MS);
  }
  throw new Error(`${repo} was generated but branch ${defaultBranch} did not appear after ${BRANCH_POLL_TRIES} tries; rerun init to continue`);
}

/** One clone, one commit: rename and pointers share it so the push is a single commit. */
async function renameAndPointers(plan, { run, token, log }, pending) {
  const { repo, name, defaultBranch, pointersDir, pointerFiles } = plan.params;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "themis-init-"));
  const env = { GH_TOKEN: token };
  try {
    run("git", authed(["clone", "--branch", defaultBranch, `https://github.com/${repo}.git`, dir]), { env });
    if (pending.has("rename")) {
      for (const file of RENAMED_FILES) {
        const target = path.join(dir, file);
        if (!fs.existsSync(target)) continue;
        const text = fs.readFileSync(target, "utf8");
        const next = renameText(file, text, name);
        if (next !== text) fs.writeFileSync(target, next);
      }
      log("rename: names replaced in the clone");
    }
    if (pending.has("write-pointers")) {
      for (const file of pointerFiles) {
        const target = path.join(dir, file);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, fs.readFileSync(path.join(pointersDir, file)));
      }
      log("write-pointers: pointer files written in the clone");
    }
    run("git", ["add", "-A"], { cwd: dir, env });
    const status = run("git", ["status", "--porcelain"], { cwd: dir, env });
    if (String(status).trim() === "") return;
    for (const key of ["user.name", "user.email"]) {
      let value = "";
      try {
        value = String(run("git", ["config", key], { cwd: dir, env })).trim();
      } catch {
        value = "";
      }
      if (!value) throw new Error(`git ${key} is not set; set it (git config --global ${key} <value>) and rerun init`);
    }
    run("git", ["commit", "-m", COMMIT_MESSAGE], { cwd: dir, env });
    run("git", authed(["push", "origin", `HEAD:${defaultBranch}`]), { cwd: dir, env });
    log(`pushed "${COMMIT_MESSAGE}" to ${defaultBranch}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function applyPolicy(plan, { github, policy, applyRepoPolicy }) {
  const { repo, defaultBranch } = plan.params;
  // The template ships only its default branch; policy plans from main, so main must exist.
  const { data: main } = await github.request("GET", `/repos/${repo}/branches/main`);
  if (!main) {
    const { data: head } = await github.request("GET", `/repos/${repo}/branches/${defaultBranch}`);
    await github.request("POST", `/repos/${repo}/git/refs`, { ref: "refs/heads/main", sha: head.commit.sha });
  }
  await applyRepoPolicy(github, repo, policy, { dryRun: false });
}

async function registryPr(plan, { github }) {
  const { name, entry, themisRepo, registryBranch } = plan.params;
  const title = `feat(registry): register ${name} [GH-000]`;
  const { data: existing } = await github.request("GET", `/repos/${themisRepo}/branches/${registryBranch}`);
  if (!existing) {
    const { data: develop } = await github.request("GET", `/repos/${themisRepo}/branches/develop`);
    await github.request("POST", `/repos/${themisRepo}/git/refs`, { ref: `refs/heads/${registryBranch}`, sha: develop.commit.sha });
  }
  const { data: file } = await github.request("GET", contentsRoute(themisRepo, "registry.json", registryBranch));
  if (!file) throw new Error(`registry.json not found on ${themisRepo} branch ${registryBranch}`);
  const current = decode(file).toString("utf8");
  if (!JSON.parse(current).bodies?.[name]) {
    const next = insertRegistryEntry(current, name, entry);
    await github.request("PUT", `/repos/${themisRepo}/contents/registry.json`, {
      message: title,
      content: Buffer.from(next).toString("base64"),
      branch: registryBranch,
      sha: file.sha,
    });
  }
  const { data: pr } = await github.request("POST", `/repos/${themisRepo}/pulls`, {
    title,
    head: registryBranch,
    base: "develop",
    body: `Registers \`${name}\` (${entry.repo}, ${entry.role}, class ${entry.class}), created by \`themis init\`.`,
  });
  return pr.html_url;
}

/** Execute the steps whose `done` is false; each prints one line. */
export async function runInit(plan, deps) {
  const { log = () => {}, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = deps;
  const context = { ...deps, log, sleep };
  const pending = new Set(plan.steps.filter((s) => !s.done).map((s) => s.kind));
  const result = { registryPrUrl: plan.steps.find((s) => s.kind === "registry-pr")?.prUrl ?? null };

  for (const step of plan.steps) {
    if (!pending.has(step.kind)) {
      log(`${step.kind}: already done`);
      continue;
    }
    switch (step.kind) {
      case "generate-repo":
        log(`generate-repo: generating ${plan.params.repo} from ${plan.params.template}`);
        await generateRepo(plan, context);
        log(`generate-repo: ${plan.params.repo} ready`);
        break;
      case "rename":
        // rename and pointers share one clone, run from the first of them still pending.
        await renameAndPointers(plan, context, pending);
        break;
      case "write-pointers":
        if (!pending.has("rename")) await renameAndPointers(plan, context, pending);
        break;
      case "apply-policy":
        log("apply-policy: applying policy/repository.json");
        await applyPolicy(plan, context);
        break;
      case "registry-pr":
        log("registry-pr: opening the registry pull request");
        result.registryPrUrl = await registryPr(plan, context);
        break;
    }
  }
  return result;
}
