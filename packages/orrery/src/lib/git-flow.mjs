
export const TYPES = ["feat", "fix", "docs", "refactor", "perf", "test", "chore", "revert"];
const TYPE_ALT = TYPES.join("|");

export const BRANCH_PATTERN = new RegExp(`^(${TYPE_ALT})\\/[a-z0-9]+(?:-[a-z0-9]+)*$`);
export const RELEASE_PATTERN = /^release\/(v\d{4}\.\d{2}\.\d{2}\.\d+)$/;
// Subject: 1-80 chars, no leading whitespace, never containing another tag. Exactly one tag at the end.
export const TITLE_PATTERN = new RegExp(`^(${TYPE_ALT})(?:\\(([a-z0-9-]+)\\))?: ((?=\\S)(?:(?!\\[GH-)[^\\r\\n]){1,80}) \\[GH-(\\d+)\\]$`);
export const COMMIT_PATTERN = new RegExp(
  `^(?:(?:${TYPE_ALT})(?:\\([a-z0-9-]+\\))?: (?=\\S)(?:(?!\\[GH-)[^\\r\\n]){1,80}(?: \\[GH-\\d+\\])?|Merge (?:pull request|branch|remote-tracking branch) .+)$`
);

const ok = () => ({ ok: true, reason: "" });
const fail = (reason) => ({ ok: false, reason });

export function branchType(name) {
  if (RELEASE_PATTERN.test(name)) return "release";
  const match = BRANCH_PATTERN.exec(name);
  return match ? match[1] : null;
}

export function checkBranchName(name) {
  if (branchType(name)) return ok();
  return fail(
    `branch "${name}" must be type/short-kebab-description with type one of ${TYPE_ALT}, or release/vYYYY.MM.DD.N`
  );
}

export function checkBranchTarget(head, base) {
  const type = branchType(head);
  if (base === "main") {
    if (type === "release" || type === "fix") return ok();
    return fail(`branch "${head}" cannot target main: only release/* and fix/* may target main`);
  }
  if (base === "develop") {
    if (head === "main") return ok(); // the automatic back-merge
    if (type === "release") return fail(`release branch "${head}" must target main, not develop`);
    if (head === "develop" || type === null) return fail(`branch "${head}" cannot target develop`);
    return ok();
  }
  return ok(); // stacked branches and other bases are not governed
}

export function parsePrTitle(title) {
  const match = TITLE_PATTERN.exec(title);
  if (!match) return null;
  const [, type, scope, subject, issue] = match;
  return { type, scope: scope ?? null, subject, issue: Number(issue) };
}

export async function checkPrTitle(title, headBranch, { issueExists }) {
  const parsed = parsePrTitle(title);
  if (!parsed) {
    return fail(`title "${title}" must be type(scope): subject [GH-n] with type one of ${TYPE_ALT}, subject ≤ 80 chars, exactly one tag`);
  }
  const type = branchType(headBranch);
  if (type === "release") {
    const version = RELEASE_PATTERN.exec(headBranch)[1];
    const expected = `chore(release): ${version}`;
    if (!title.startsWith(`${expected} `)) return fail(`release title must be ${expected} [GH-n]`);
  } else if (type && parsed.type !== type) {
    return fail(`title type ${parsed.type} does not match branch type ${type}`);
  }
  if (parsed.issue !== 0 && !(await issueExists(parsed.issue))) {
    return fail(`issue GH-${parsed.issue} does not exist in this repository; use GH-000 for work with no issue`);
  }
  return ok();
}

export function checkCommitMessage(message) {
  const subject = message.split(/\r?\n/, 1)[0];
  if (COMMIT_PATTERN.test(subject)) return ok();
  return fail(`commit subject "${subject}" must be type(scope): subject with type one of ${TYPE_ALT}`);
}

export async function checkBranchSync({ run }) {
  run("git", ["fetch", "--no-tags", "origin", "main", "develop"]);
  const behind = Number(run("git", ["rev-list", "--count", "origin/develop..origin/main"]).trim());
  if (behind === 0) return { ...ok(), behind };
  return {
    ...fail(`main has ${behind} commit(s) that develop lacks; the back-merge PR from main into develop must land before anything else merges into develop`),
    behind,
  };
}

export async function checkConfigDrift({ run, baseRef, headSha, files }) {
  const mergeBase = run("git", ["merge-base", baseRef, headSha]).trim();
  const changedByPr = new Set(run("git", ["diff", "--name-only", mergeBase, headSha]).split(/\r?\n/).filter(Boolean));
  const stale = [];
  const intentional = [];
  for (const file of files) {
    const baseContent = run("git", ["show", `${baseRef}:${file}`]);
    const headContent = run("git", ["show", `${headSha}:${file}`]);
    if (baseContent === headContent) continue;
    (changedByPr.has(file) ? intentional : stale).push(file);
  }
  if (stale.length === 0) return { ...ok(), stale, intentional };
  return {
    ...fail(`${stale.join(", ")} differs from ${baseRef} without this PR changing it; update the branch from ${baseRef}`),
    stale,
    intentional,
  };
}
