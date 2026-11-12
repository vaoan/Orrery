import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { planInit, runInit, renameText, insertRegistryEntry } from "../src/lib/init.mjs";
import init from "../src/commands/init.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const templateDir = path.resolve(here, "../templates/next-supabase-mono");
const walkFiles = (dir, rel = "") =>
  fs.readdirSync(path.join(dir, rel), { withFileTypes: true }).flatMap((e) => {
    const next = rel ? `${rel}/${e.name}` : e.name;
    return e.isDirectory() ? walkFiles(dir, next) : [next];
  });
const b64 = (text) => Buffer.from(text).toString("base64");

const STARTER = {
  "package.json": '{\n  "name": "vulkan",\n  "description": "vulkan is a starter"\n}\n',
  "themis.config.mjs": 'export default { body: "vulkan" };\n',
  "CLAUDE.md": "# Vulkan\n\nVulkan stays Vulkan below the title.\n",
  "README.md": "# Vulkan\n\nvulkan docs\n",
  "docs/notes.md": "vulkan elsewhere\n",
};

const REGISTRY = `{
  "$comment": "map",
  "bodies": {
    "themis":      { "repo": "vaoan/Themis",      "role": "centre", "class": null },
    "aeleos":      { "repo": "vaoan/AeleOS",      "role": "star",   "class": "next-supabase-mono" },
    "eclipse-con": { "repo": "vaoan/eclipse-con", "role": "planet", "class": "next-supabase-mono" }
  }
}
`;

// An in-memory GitHub: the template, optionally the generated repo, Themis's registry.
function makeWorld({ registryBranchExists = false, noRegistryOnBranch = false, exists = false, files = {}, pollsBeforeBranch = 0, openPr = false, registry = REGISTRY, hasMain = true } = {}) {
  const calls = [];
  const state = { exists, polls: 0, branches: new Set(), registry, files: { ...files } };
  const github = {
    async request(method, route, body) {
      calls.push({ method, route, body });
      const [pathname] = route.split("?");
      const ok = (data, status = 200) => ({ status, data });
      const none = { status: 404, data: null };
      if (method === "GET" && pathname === "/repos/vaoan/Vulkan") return ok({ default_branch: "develop" });
      if (method === "POST" && pathname === "/repos/vaoan/Vulkan/generate") { state.exists = true; return ok({}, 201); }
      if (method === "GET" && pathname === "/repos/vaoan/Portia") return state.exists ? ok({ default_branch: "develop" }) : none;
      if (method === "GET" && pathname === "/repos/vaoan/Portia/branches") {
        state.polls += 1;
        return ok(state.polls > pollsBeforeBranch ? [{ name: "develop" }] : []);
      }
      if (method === "GET" && pathname === "/repos/vaoan/Portia/branches/main") return hasMain ? ok({ commit: { sha: "m1" } }) : none;
      if (method === "GET" && pathname === "/repos/vaoan/Portia/branches/develop") return ok({ commit: { sha: "d1" } });
      if (method === "POST" && pathname === "/repos/vaoan/Portia/git/refs") return ok({}, 201);
      const contents = /^\/repos\/vaoan\/Portia\/contents\/(.+)$/.exec(pathname);
      if (method === "GET" && contents) {
        const text = state.files[decodeURIComponent(contents[1])];
        return text === undefined ? none : ok({ content: b64(text), encoding: "base64", sha: "f1" });
      }
      if (method === "GET" && pathname === "/repos/vaoan/Themis/contents/registry.json") return noRegistryOnBranch && /register-portia/.test(route) ? none : ok({ content: b64(state.registry), encoding: "base64", sha: "r1" });
      if (method === "GET" && pathname === "/repos/vaoan/Themis/branches/develop") return ok({ commit: { sha: "t1" } });
      if (method === "GET" && pathname === "/repos/vaoan/Themis/branches/feat/register-portia") return registryBranchExists ? ok({ commit: { sha: "t2" } }) : none;
      if (method === "GET" && pathname === "/repos/vaoan/Themis/pulls") return ok(openPr ? [{ html_url: "https://example/pr/7" }] : []);
      if (method === "POST" && pathname === "/repos/vaoan/Themis/git/refs") return ok({}, 201);
      if (method === "PUT" && pathname === "/repos/vaoan/Themis/contents/registry.json") return ok({}, 200);
      if (method === "POST" && pathname === "/repos/vaoan/Themis/pulls") return ok({ html_url: "https://example/pr/9", number: 9 }, 201);
      throw new Error(`fake github: unexpected ${method} ${route}`);
    },
  };
  return { github, calls, state };
}

// A git runner whose "clone" materialises the starter files, and whose push snapshots them.
function makeGit({ starter = STARTER, dirty = true, identity = true } = {}) {
  const log = [];
  const snapshots = [];
  const run = (command, args, options = {}) => {
    log.push({ command, args, options });
    const sub = args.filter((a) => !a.startsWith("-c") && !a.startsWith("credential.helper"))[0];
    const verb = args.find((a) => ["clone", "add", "commit", "push", "status", "config"].includes(a));
    if (verb === "clone") {
      const dir = args[args.length - 1];
      for (const [file, text] of Object.entries(starter)) {
        fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
        fs.writeFileSync(path.join(dir, file), text);
      }
    }
    if (verb === "push") {
      const dir = options.cwd;
      const snap = {};
      const walk = (d, rel = "") => {
        for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
          if (entry.name === ".git") continue;
          const full = path.join(d, entry.name);
          if (entry.isDirectory()) walk(full, path.join(rel, entry.name));
          else snap[path.join(rel, entry.name).split(path.sep).join("/")] = fs.readFileSync(full);
        }
      };
      walk(dir);
      snapshots.push(snap);
    }
    if (verb === "config") return identity ? "someone\n" : "";
    if (verb === "status") return dirty ? " M package.json\n" : "";
    return "";
  };
  return { run, log, snapshots };
}

const base = { name: "portia", owner: "vaoan", template: "vaoan/Vulkan", klass: "next-supabase-mono", role: "planet", repoName: "Portia", themisRepo: "vaoan/Themis" };
const noOps = async () => ({ ops: [], applied: [] });
const policy = { defaultBranch: "develop" };

describe("planInit", () => {
  it("plans all five steps pending, in order, for a missing repository", async () => {
    const { github } = makeWorld();
    const plan = await planInit({ ...base, github, policy, applyRepoPolicy: noOps });
    expect(plan.steps.map((s) => [s.kind, s.done])).toEqual([
      ["generate-repo", false],
      ["rename", false],
      ["write-pointers", false],
      ["apply-policy", false],
      ["registry-pr", false],
    ]);
  });

  it("marks generate-repo done when the repository already exists, and the rest still run", async () => {
    const { github } = makeWorld({ exists: true, files: { "package.json": STARTER["package.json"] } });
    const plan = await planInit({ ...base, github, policy, applyRepoPolicy: async () => ({ ops: [{ kind: "set-protection" }], applied: [] }) });
    expect(plan.steps.map((s) => s.done)).toEqual([true, false, false, false, false]);
  });

  it("marks rename, pointers, policy and registry done when each result is already present", async () => {
    const files = { "package.json": '{ "name": "portia" }\n' };
    for (const f of walkFiles(templateDir)) files[f] = fs.readFileSync(path.join(templateDir, f), "utf8");
    const world = makeWorld({ exists: true, files, registry: REGISTRY.replace('"themis":', '"portia": { "repo": "vaoan/Portia", "role": "planet", "class": "next-supabase-mono" },\n    "themis":') });
    const plan = await planInit({ ...base, github: world.github, policy, applyRepoPolicy: noOps });
    expect(plan.steps.map((s) => s.done)).toEqual([true, true, true, true, true]);
  });

  it("marks registry-pr done when an open PR from the branch exists", async () => {
    const { github } = makeWorld({ exists: true, openPr: true });
    const plan = await planInit({ ...base, github, policy, applyRepoPolicy: noOps });
    expect(plan.steps.at(-1).done).toBe(true);
  });

  it("makes no write calls while planning", async () => {
    const { github, calls } = makeWorld();
    await planInit({ ...base, github, policy, applyRepoPolicy: noOps });
    expect(calls.filter((c) => c.method !== "GET")).toEqual([]);
  });
});

describe("renameText", () => {
  it("renames the package name, the config, and the first heading only", () => {
    expect(renameText("package.json", STARTER["package.json"], "portia")).toBe('{\n  "name": "portia",\n  "description": "vulkan is a starter"\n}\n');
    expect(renameText("themis.config.mjs", STARTER["themis.config.mjs"], "portia")).toBe('export default { body: "portia" };\n');
    expect(renameText("CLAUDE.md", STARTER["CLAUDE.md"], "portia")).toBe("# Portia\n\nVulkan stays Vulkan below the title.\n");
    expect(renameText("README.md", STARTER["README.md"], "portia")).toBe("# Portia\n\nvulkan docs\n");
    expect(renameText("docs/notes.md", STARTER["docs/notes.md"], "portia")).toBe(STARTER["docs/notes.md"]);
  });
});

describe("insertRegistryEntry", () => {
  it("keeps the file's alignment and the other entries untouched", () => {
    const next = insertRegistryEntry(REGISTRY, "portia", { repo: "vaoan/Portia", role: "planet", class: "next-supabase-mono" });
    expect(next).toContain('    "portia":      { "repo": "vaoan/Portia",      "role": "planet", "class": "next-supabase-mono" }\n  }\n}\n');
    expect(next.replace(/,\n    "portia".*\n/, "\n")).toBe(REGISTRY);
    expect(JSON.parse(next).bodies.portia).toEqual({ repo: "vaoan/Portia", role: "planet", class: "next-supabase-mono" });
  });
});

describe("runInit", () => {
  const deps = (world, git, extra = {}) => ({
    github: world.github, run: git.run, sleep: async () => {}, token: "secret-token", policy, applyRepoPolicy: noOps, log: () => {}, ...extra,
  });

  it("generates from the template, polls for the branch, then renames and writes pointers in one commit", async () => {
    const world = makeWorld({ pollsBeforeBranch: 2 });
    const git = makeGit();
    const plan = await planInit({ ...base, github: world.github, policy, applyRepoPolicy: noOps });
    await runInit(plan, deps(world, git));

    const generate = world.calls.find((c) => c.method === "POST" && c.route === "/repos/vaoan/Vulkan/generate");
    expect(generate.body).toEqual({ owner: "vaoan", name: "Portia", private: false, include_all_branches: false });
    expect(world.state.polls).toBe(3);

    expect(git.snapshots).toHaveLength(1);
    const snap = git.snapshots[0];
    expect(snap["package.json"].toString()).toContain('"name": "portia"');
    expect(snap["CLAUDE.md"].toString().startsWith("# Portia\n")).toBe(true);
    expect(snap["docs/notes.md"].toString()).toBe(STARTER["docs/notes.md"]);
    for (const f of walkFiles(templateDir)) expect(snap[f].equals(fs.readFileSync(path.join(templateDir, f)))).toBe(true);

    const commits = git.log.filter((l) => l.args.includes("commit"));
    expect(commits).toHaveLength(1);
    expect(commits[0].args).toContain("chore(init): rename and pointers [GH-000]");
    const push = git.log.find((l) => l.args.includes("push"));
    expect(push.args.join(" ")).toMatch(/HEAD:develop/);
  });

  it("never puts the token in an argument; it travels in the environment of the clone and push", async () => {
    const world = makeWorld();
    const git = makeGit();
    const plan = await planInit({ ...base, github: world.github, policy, applyRepoPolicy: noOps });
    await runInit(plan, deps(world, git));
    expect(JSON.stringify(git.log.map((l) => l.args))).not.toContain("secret-token");
    const clone = git.log.find((l) => l.args.includes("clone"));
    expect(clone.options.env.GH_TOKEN).toBe("secret-token");
    expect(clone.args.join(" ")).toContain("credential.helper=!");
    expect(clone.args).toContain("https://github.com/vaoan/Portia.git");
  });

  it("gives up with a clear error when the branch never appears", async () => {
    const world = makeWorld({ pollsBeforeBranch: 1000 });
    const git = makeGit();
    const plan = await planInit({ ...base, github: world.github, policy, applyRepoPolicy: noOps });
    await expect(runInit(plan, deps(world, git))).rejects.toThrow(/did not appear/);
    expect(world.state.polls).toBe(30);
  });

  it("skips done steps and commits nothing when the clone is already clean", async () => {
    const files = { "package.json": '{ "name": "portia" }\n' };
    for (const f of walkFiles(templateDir)) files[f] = fs.readFileSync(path.join(templateDir, f), "utf8");
    const world = makeWorld({ exists: true, files, registry: REGISTRY.replace('"themis":', '"portia": {},\n    "themis":') });
    const git = makeGit();
    const plan = await planInit({ ...base, github: world.github, policy, applyRepoPolicy: noOps });
    await runInit(plan, deps(world, git));
    expect(git.log).toEqual([]);
    expect(world.calls.filter((c) => c.method !== "GET")).toEqual([]);
  });

  it("applies policy through applyRepoPolicy and bootstraps main when only develop exists", async () => {
    const world = makeWorld({ exists: true, hasMain: false, files: { "package.json": '{ "name": "portia" }\n' } });
    const git = makeGit();
    const applyRepoPolicy = vi.fn(async () => ({ ops: [], applied: [] }));
    const plan = await planInit({ ...base, github: world.github, policy, applyRepoPolicy });
    await runInit(plan, deps(world, git, { applyRepoPolicy }));
    expect(applyRepoPolicy).toHaveBeenCalledWith(world.github, "vaoan/Portia", policy, { dryRun: false });
    const ref = world.calls.find((c) => c.method === "POST" && c.route === "/repos/vaoan/Portia/git/refs");
    expect(ref.body).toEqual({ ref: "refs/heads/main", sha: "d1" });
  });

  it("registry-pr branches from develop, writes the entry, and opens the PR", async () => {
    const world = makeWorld({ exists: true });
    const git = makeGit();
    const plan = await planInit({ ...base, github: world.github, policy, applyRepoPolicy: noOps });
    const result = await runInit(plan, deps(world, git));
    const ref = world.calls.find((c) => c.method === "POST" && c.route === "/repos/vaoan/Themis/git/refs");
    expect(ref.body).toEqual({ ref: "refs/heads/feat/register-portia", sha: "t1" });
    const put = world.calls.find((c) => c.method === "PUT");
    expect(put.body.branch).toBe("feat/register-portia");
    expect(put.body.sha).toBe("r1");
    const written = JSON.parse(Buffer.from(put.body.content, "base64").toString());
    expect(written.bodies.portia).toEqual({ repo: "vaoan/Portia", role: "planet", class: "next-supabase-mono" });
    expect(Object.keys(written.bodies)).toContain("themis");
    const pr = world.calls.find((c) => c.method === "POST" && c.route === "/repos/vaoan/Themis/pulls");
    expect(pr.body).toMatchObject({ title: "feat(registry): register portia [GH-000]", head: "feat/register-portia", base: "develop" });
    expect(result.registryPrUrl).toBe("https://example/pr/9");
  });
});

describe("runInit edge cases", () => {
  const deps = (world, git, extra = {}) => ({
    github: world.github, run: git.run, sleep: async () => {}, token: "t", policy, applyRepoPolicy: noOps, log: () => {}, ...extra,
  });

  it("polls instead of skipping when the repository exists but its branch does not yet", async () => {
    const world = makeWorld({ exists: true, pollsBeforeBranch: 3 });
    const git = makeGit();
    const plan = await planInit({ ...base, github: world.github, policy, applyRepoPolicy: noOps });
    expect(plan.steps[0].done).toBe(false);
    await runInit(plan, deps(world, git));
    expect(world.calls.some((c) => c.route.endsWith("/generate"))).toBe(false);
    expect(world.state.polls).toBeGreaterThan(3);
    expect(git.snapshots).toHaveLength(1);
  });

  it("fails clearly when the branch never appears for an existing repository", async () => {
    const world = makeWorld({ exists: true, pollsBeforeBranch: 1000 });
    const git = makeGit();
    const plan = await planInit({ ...base, github: world.github, policy, applyRepoPolicy: noOps });
    await expect(runInit(plan, deps(world, git))).rejects.toThrow(/did not appear/);
    expect(git.log).toEqual([]);
  });

  it("fails clearly when registry.json is missing on the registry branch", async () => {
    const world = makeWorld({ exists: true, registryBranchExists: true, noRegistryOnBranch: true });
    const plan = await planInit({ ...base, github: world.github, policy, applyRepoPolicy: noOps });
    await expect(runInit(plan, deps(world, makeGit()))).rejects.toThrow(/registry\.json not found on vaoan\/Themis branch feat\/register-portia/);
  });

  it("refuses to commit without a git identity, and does not invent one", async () => {
    const world = makeWorld({ exists: true });
    const git = makeGit({ identity: false });
    const plan = await planInit({ ...base, github: world.github, policy, applyRepoPolicy: noOps });
    await expect(runInit(plan, deps(world, git))).rejects.toThrow(/git user\.name is not set/);
    expect(git.log.some((l) => l.args.includes("commit") || l.args.includes("push"))).toBe(false);
  });

  it("opens the PR and writes the entry once when the registry branch exists without a PR", async () => {
    const world = makeWorld({ exists: true, registryBranchExists: true });
    const plan = await planInit({ ...base, github: world.github, policy, applyRepoPolicy: noOps });
    await runInit(plan, deps(world, makeGit()));
    expect(world.calls.filter((c) => c.method === "PUT")).toHaveLength(1);
    expect(world.calls.filter((c) => c.method === "POST" && c.route === "/repos/vaoan/Themis/pulls")).toHaveLength(1);
    expect(world.calls.some((c) => c.method === "POST" && c.route === "/repos/vaoan/Themis/git/refs")).toBe(false);
  });
});

describe("themis init command", () => {
  const run = async (argv, extra = {}) => {
    const out = [];
    const err = [];
    const log = vi.spyOn(console, "log").mockImplementation((m) => out.push(m));
    const error = vi.spyOn(console, "error").mockImplementation((m) => err.push(m));
    try {
      const world = extra.world ?? makeWorld();
      const git = extra.git ?? makeGit();
      const code = await init(argv, {
        createGithub: () => world.github, resolveToken: () => "tok", run: git.run, sleep: async () => {},
        loadPolicy: () => policy, applyRepoPolicy: noOps, loadRegistry: () => ({ bodies: { janus: {} } }), ...extra.deps,
      });
      return { code, out, err, world, git };
    } finally {
      log.mockRestore();
      error.mockRestore();
    }
  };

  it("--dry-run prints the five steps and makes no write calls", async () => {
    const { code, out, world, git } = await run(["portia", "--class", "next-supabase-mono", "--dry-run"]);
    expect(code).toBe(0);
    expect(out.join("\n")).toMatch(/generate-repo[\s\S]*rename[\s\S]*write-pointers[\s\S]*apply-policy[\s\S]*registry-pr/);
    expect(out.join("\n")).toMatch(/pending/);
    expect(world.calls.filter((c) => c.method !== "GET")).toEqual([]);
    expect(git.log).toEqual([]);
  });

  it("--dry-run with main missing reports apply-policy pending and writes nothing", async () => {
    const { code, out, world } = await run(["portia", "--class", "next-supabase-mono", "--dry-run"], { world: makeWorld({ exists: true, hasMain: false }) });
    expect(code).toBe(0);
    expect(out.join("\n")).toMatch(/apply-policy\s+pending/);
    expect(world.calls.filter((c) => c.method !== "GET")).toEqual([]);
  });

  it("runs for real and ends with the repository and the registry PR URL", async () => {
    const { code, out } = await run(["portia", "--class", "next-supabase-mono"]);
    expect(code).toBe(0);
    expect(out.at(-1)).toContain("vaoan/Portia");
    expect(out.at(-1)).toContain("https://example/pr/9");
  });

  it("honours --repo-name", async () => {
    const world = makeWorld();
    const inner = world.github.request;
    world.github.request = async (method, route, body) => {
      if (route.startsWith("/repos/vaoan/PortiaApp")) { world.calls.push({ method, route, body }); return { status: 404, data: null }; }
      return inner(method, route, body);
    };
    const { code } = await run(["portia", "--class", "next-supabase-mono", "--repo-name", "PortiaApp", "--dry-run"], { world });
    expect(code).toBe(0);
    expect(world.calls.some((c) => c.route === "/repos/vaoan/PortiaApp")).toBe(true);
  });

  it.each([
    [["portia", "--class", "nope"], /class/],
    [["Portia", "--class", "next-supabase-mono"], /kebab/],
    [["janus", "--class", "next-supabase-mono"], /already/],
    [["--class", "next-supabase-mono"], /usage/],
    [["portia"], /--class/],
  ])("exits 2 for %j", async (argv, message) => {
    const { code, err } = await run(argv);
    expect(code).toBe(2);
    expect(err.join("\n")).toMatch(message);
  });

  it("exits 1 when a step fails", async () => {
    const world = makeWorld();
    world.github.request = async () => { throw new Error("boom"); };
    const { code, err } = await run(["portia", "--class", "next-supabase-mono"], { world });
    expect(code).toBe(1);
    expect(err.join("\n")).toContain("boom");
  });
});
