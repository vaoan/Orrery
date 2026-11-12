import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPolicy } from "../src/lib/policy.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
// These tests assert file shape, not line endings, so normalise \r\n to \n regardless
// of how the working tree checked the file out (see CLAUDE.md's core.autocrlf note).
const read = (f) => fs.readFileSync(path.join(root, f), "utf8").replace(/\r\n/g, "\n");
const jobNames = (yaml) => [...yaml.matchAll(/^  ([a-z-]+):\n(?:    [^\n]*\n)*?    name: \1\n/gm)].map((m) => m[1]);

describe(".github/workflows/ci.yml", () => {
  const yaml = read(".github/workflows/ci.yml");
  const policy = loadPolicy();

  it("starts with the shared-CI marker", () => {
    expect(yaml.split("\n")[0]).toBe(policy.sharedCiMarker);
  });

  it("is callable by bodies and runs on Themis's own PRs and pushes", () => {
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
      expect(yaml).toContain(`pnpm themis ci ${verb}`);
    }
    expect(yaml).toContain("pnpm test");
  });
});

describe(".github/workflows/back-merge.yml", () => {
  const yaml = read(".github/workflows/back-merge.yml");
  it("runs on push to main and opens a merge-commit PR into develop with automerge", () => {
    expect(yaml).toMatch(/  push:\n    branches: \[main\]/);
    expect(yaml).toContain("--base develop");
    expect(yaml).toContain("--merge --auto");
    expect(yaml).not.toContain("--squash");
  });
  it("cuts an intermediate back-merge/<sha> branch from main rather than using main as the PR head", () => {
    expect(yaml).toContain('back-merge/$(git rev-parse --short=7 origin/main)');
    expect(yaml).not.toContain("--head main");
  });
  it("checks out without persisting the default token and pushes with the bot token instead", () => {
    expect(yaml).toContain("persist-credentials: false");
    expect(yaml).toContain("x-access-token:${GH_TOKEN}");
  });
  it("uses the bot token, not GITHUB_TOKEN, so the PR triggers checks", () => {
    expect(yaml).toContain("secrets.THEMIS_BOT_TOKEN");
  });
  it("never treats jq's null as an existing PR", () => {
    expect(yaml).toContain(".[0].number // empty");
    expect(yaml).not.toContain(".[0].number'");
  });
  it("prints nothing for the existing-PR lookup when no back-merge is open", () => {
    expect(yaml).toContain('select(. != null) | "\\(.number) \\(.headRefName)"');
    expect(yaml).not.toContain('][0] | "\\(.number)');
  });
  it("the existing-PR lookup logic yields empty for no match and 'number branch' for a match", () => {
    // Mirrors the yaml's jq expression
    // `[.[] | select(.headRefName | startswith("back-merge/"))][0] | select(. != null) | "\(.number) \(.headRefName)"`
    // in plain JavaScript, since gh's jq cannot run inside vitest. Update this
    // alongside any change to that jq expression.
    const pick = (prs) => {
      const m = prs.filter((p) => p.headRefName.startsWith("back-merge/"))[0];
      return m == null ? "" : `${m.number} ${m.headRefName}`;
    };
    expect(pick([])).toBe("");
    expect(pick([{ number: 42, headRefName: "back-merge/abc1234" }])).toBe("42 back-merge/abc1234");
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

// ADR 0017: there is no scheduled job in Themis. `themis repo apply` and `themis observe`
// are on-demand commands; a body's own CI (the reusable ci.yml) is what fails it, not a
// nightly run from here.
describe("no scheduled observation workflow", () => {
  it("does not ship .github/workflows/observe.yml", () => {
    expect(fs.existsSync(path.join(root, ".github/workflows/observe.yml"))).toBe(false);
  });
});

describe(".github/workflows/body-ci.yml", () => {
  const yaml = read(".github/workflows/body-ci.yml");
  it("is callable with a boolean database input that defaults to false", () => {
    expect(yaml).toMatch(/^on:\n  workflow_call:\n    inputs:\n      database:\n(?:        [^\n]*\n)*?        type: boolean\n(?:        [^\n]*\n)*?        default: false\n/m);
  });
  it("defines exactly the six jobs, named as the required checks", () => {
    expect(jobNames(yaml)).toEqual(["test", "branch-target", "branch-name", "pr-title", "config-drift", "branch-sync"]);
  });
  it("runs the body's own scripts as steps of the test job, the database steps only when asked", () => {
    const block = yaml.match(/^  test:\n((?:    [^\n]*\n|\n)*)/m)[1];
    const steps = block.split(/^      - /m).slice(1).map((s) => s.replace(/\n        /g, "\n"));
    const runs = steps.filter((s) => !s.includes("inputs.database")).map((s) => s.match(/^run: (.*)$/m)?.[1]);
    expect(runs).toEqual(expect.arrayContaining(["pnpm lint", "pnpm typecheck", "pnpm test"]));
    const gated = steps.filter((s) => s.includes("if: ${{ inputs.database }}"));
    const find = (needle) => steps.filter((s) => s.includes(needle));
    for (const needle of ["supabase/setup-cli@v1", "run: supabase start", "run: pnpm test:db"]) {
      expect(find(needle)).toHaveLength(1);
      expect(gated).toContain(find(needle)[0]);
    }
    expect(gated).toHaveLength(3);
  });
  it("calls each verb through the installed package and holds no secret but GITHUB_TOKEN", () => {
    for (const verb of ["branch-target", "branch-name", "pr-title", "branch-sync", "config-drift"]) {
      expect(yaml).toContain(`pnpm themis ci ${verb}`);
    }
    expect([...yaml.matchAll(/secrets\.(\w+)/g)].map((m) => m[1]).every((n) => n === "GITHUB_TOKEN")).toBe(true);
  });
  it("runs the PR-only jobs on pull_request and branch-sync only into develop", () => {
    expect(yaml).toMatch(/  branch-sync:\n(?:    [^\n]*\n)*?    if: github\.event_name == 'pull_request' && github\.event\.pull_request\.base\.ref == 'develop'/);
    expect((yaml.match(/    if: github\.event_name == 'pull_request'/g) ?? []).length).toBe(5);
  });
});
