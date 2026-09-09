import fs from "node:fs";

// A whole name: a tag `vYYYY.MM.DD.N` or a branch `release/vYYYY.MM.DD.N`. Anything
// else, including libra's old `release/GH-000_v2026.05.27.1`, is not a version.
const CALVER = /^(?:release\/)?v(\d{4})\.(\d{2})\.(\d{2})\.(\d+)$/;

export function nextVersion(existing, today = new Date()) {
  const y = today.getUTCFullYear();
  const m = String(today.getUTCMonth() + 1).padStart(2, "0");
  const d = String(today.getUTCDate()).padStart(2, "0");
  const prefix = `v${y}.${m}.${d}.`;
  let highest = 0;
  for (const name of existing) {
    const match = CALVER.exec(name);
    if (!match) continue;
    if (`v${match[1]}.${match[2]}.${match[3]}.` !== prefix) continue;
    highest = Math.max(highest, Number(match[4]));
  }
  return `${prefix}${highest + 1}`;
}

// package.json needs semver; v2026.09.08.3 becomes 2026.9.8-3 (prerelease tag carries N).
export function semverFor(version) {
  const [, y, m, d, n] = CALVER.exec(version);
  return `${Number(y)}.${Number(m)}.${Number(d)}-${n}`;
}

export function planRelease({ run, today = new Date(), versionFile }) {
  run("git", ["fetch", "--no-tags", "origin", "main", "develop"]);
  const behind = Number(run("git", ["rev-list", "--count", "origin/develop..origin/main"]).trim());
  if (behind > 0) {
    throw new Error(`cannot cut a release: main has ${behind} commit(s) that develop lacks; land the back-merge first`);
  }
  const names = run("git", ["ls-remote", "--tags", "--heads", "origin"])
    .split(/\r?\n/)
    .map((line) => line.split("\t")[1] ?? "")
    .map((ref) => ref.replace(/^refs\/(tags|heads)\//, ""))
    .filter(Boolean);
  const version = nextVersion(names, today);
  return {
    version,
    branch: `release/${version}`,
    title: `chore(release): ${version} [GH-000]`,
    body: `Release ${version}, cut from develop by orrery release. Merge with a merge commit.`,
    versionFile,
  };
}

export function cutRelease(plan, { run, versionFile = plan.versionFile }) {
  run("git", ["fetch", "--no-tags", "origin", "develop"]);
  run("git", ["checkout", "-q", "-b", plan.branch, "origin/develop"]);
  const manifest = JSON.parse(fs.readFileSync(versionFile, "utf8"));
  manifest.version = semverFor(plan.version);
  fs.writeFileSync(versionFile, JSON.stringify(manifest, null, 2) + "\n");
  run("git", ["add", versionFile]);
  run("git", ["commit", "-q", "-m", plan.title]);
  run("git", ["push", "-u", "origin", plan.branch]);
  run("gh", ["pr", "create", "--base", "main", "--head", plan.branch, "--title", plan.title, "--body", plan.body, "--label", "release", "--label", "orrery"]);
}
