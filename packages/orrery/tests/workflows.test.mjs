import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPolicy } from "../src/lib/policy.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const jobNames = (yaml) => [...yaml.matchAll(/^  ([a-z-]+):\n(?:    [^\n]*\n)*?    name: \1\n/gm)].map((m) => m[1]);

describe(".github/workflows/ci.yml", () => {
  const yaml = read(".github/workflows/ci.yml");
  const policy = loadPolicy();

  it("starts with the shared-CI marker", () => {
    expect(yaml.split("\n")[0]).toBe(policy.sharedCiMarker);
  });

  it("is callable by bodies and runs on Orrery's own PRs and pushes", () => {
    expect(yaml).toMatch(/^on:\n(?:.*\n)*?  workflow_call:/m);
    expect(yaml).toMatch(/  pull_request:\n    branches: \[develop, main\]/);
    expect(yaml).toMatch(/  push:\n    branches: \[develop, main\]/);
  });

  it("defines one job per required check, named exactly as the policy names it", () => {
    const names = jobNames(yaml);
    for (const check of new Set([...policy.requiredChecks.main, ...policy.requiredChecks.develop])) {
      expect(names).toContain(check);
    }
  });

  it("runs branch-sync only for PRs into develop", () => {
    expect(yaml).toMatch(/  branch-sync:\n(?:    [^\n]*\n)*?    if: github\.event_name == 'pull_request' && github\.event\.pull_request\.base\.ref == 'develop'/);
  });

  it("calls each verb through the package", () => {
    for (const verb of ["branch-target", "branch-name", "pr-title", "branch-sync", "config-drift"]) {
      expect(yaml).toContain(`pnpm orrery ci ${verb}`);
    }
    expect(yaml).toContain("pnpm test");
  });
});

describe(".github/workflows/back-merge.yml", () => {
  const yaml = read(".github/workflows/back-merge.yml");
  it("runs on push to main and opens a merge-commit PR into develop with automerge", () => {
    expect(yaml).toMatch(/  push:\n    branches: \[main\]/);
    expect(yaml).toContain("--base develop");
    expect(yaml).toContain("--head main");
    expect(yaml).toContain("--merge --auto");
    expect(yaml).not.toContain("--squash");
  });
  it("uses the bot token, not GITHUB_TOKEN, so the PR triggers checks", () => {
    expect(yaml).toContain("secrets.ORRERY_BOT_TOKEN");
  });
  it("never treats jq's null as an existing PR", () => {
    expect(yaml).toContain(".[0].number // empty");
    expect(yaml).not.toContain(".[0].number'");
  });
});

describe(".github/workflows/release.yml", () => {
  const yaml = read(".github/workflows/release.yml");
  it("creates a GitHub release when a release branch merges into main", () => {
    expect(yaml).toContain("github.event.pull_request.merged == true");
    expect(yaml).toContain("startsWith(github.event.pull_request.head.ref, 'release/')");
    expect(yaml).toContain("gh release create");
  });
  it("passes the version through env and validates it before releasing", () => {
    expect(yaml).toContain("VERSION: ${{ steps.version.outputs.version }}");
    expect(yaml).toContain("grep -Eq '^v[0-9]{4}");
    expect(yaml).not.toContain('gh release create "${{');
  });
});

describe(".github/pull_request_template.md", () => {
  it("states the routes the checks enforce", () => {
    const md = read(".github/pull_request_template.md");
    expect(md).toContain("`type/*` → `develop`");
    expect(md).toContain("`hotfix/*` → `main`");
    expect(md).toContain("`release/*` → `main`");
    expect(md).toContain("[GH-000]");
  });
});

describe(".github/workflows/observe.yml", () => {
  const yaml = read(".github/workflows/observe.yml");
  it("runs nightly and on demand", () => {
    expect(yaml).toMatch(/  schedule:\n    - cron: /);
    expect(yaml).toContain("workflow_dispatch:");
  });
  it("dry-runs by default and applies only when the repository variable says so", () => {
    expect(yaml).toContain("vars.ORRERY_APPLY_POLICY == 'apply'");
    expect(yaml).toContain("--dry-run");
  });
  it("iterates the registry and uses the admin token", () => {
    expect(yaml).toContain("registry.json");
    expect(yaml).toContain("secrets.ORRERY_ADMIN_TOKEN");
  });
});
