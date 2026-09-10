
export const TYPES = ["feat", "fix", "docs", "refactor", "perf", "test", "chore", "revert"];
const TYPE_ALT = TYPES.join("|");

export const BRANCH_PATTERN = new RegExp(`^(${TYPE_ALT})\\/[a-z0-9]+(?:-[a-z0-9]+)*$`);
export const RELEASE_PATTERN = /^release\/(v\d{4}\.\d{2}\.\d{2}\.\d+)$/;
export const HOTFIX_PATTERN = /^hotfix\/[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const BACK_MERGE_PATTERN = /^back-merge\/[0-9a-f]{7,40}$/;
// Subject: 1-80 chars, no leading whitespace, never containing another tag. Exactly one tag at the end.
export const TITLE_PATTERN = new RegExp(`^(${TYPE_ALT})(?:\\(([a-z0-9-]+)\\))?: ((?=\\S)(?:(?!\\[GH-)[^\\r\\n]){1,80}) \\[GH-(\\d+)\\]$`);
export const COMMIT_PATTERN = new RegExp(
  `^(?:(?:${TYPE_ALT})(?:\\([a-z0-9-]+\\))?: (?=\\S)(?:(?!\\[GH-)[^\\r\\n]){1,80}(?: \\[GH-\\d+\\])?|Merge (?:pull request|branch|remote-tracking branch) .+)$`
);

const ok = () => ({ ok: true, reason: "" });
const fail = (reason) => ({ ok: false, reason });

// A description that starts with a plan/phase/task label says what the plan called the
// work, not what the work does: a phase label (a single digit, optionally one letter, then
// a hyphen — "2b-", "3-") or one of these words used as a leading label ("fix-" here is the
// redundant task-refinement label, distinct from the branch's own `fix/` type prefix).
const PLAN_LABEL_PATTERN = /^(?:[0-9][a-z]?-|(?:phase|task|step|wave|round|fix)-)/;

export function branchType(name) {
  if (BACK_MERGE_PATTERN.test(name)) return "back-merge";
  if (RELEASE_PATTERN.test(name)) return "release";
  if (HOTFIX_PATTERN.test(name)) return "hotfix";
  const match = BRANCH_PATTERN.exec(name);
  return match ? match[1] : null;
}

export function checkBranchName(name) {
  const type = branchType(name);
  if (!type) {
    return fail(
      `branch "${name}" must be type/short-kebab-description with type one of ${TYPE_ALT}, hotfix/short-kebab-description, release/vYYYY.MM.DD.N, or back-merge/<sha> (automation only)`
    );
  }
  // release/*, hotfix/* and back-merge/* are automation-shaped patterns handled by their own
  // regexes above; the descriptive-name rule below governs only type/* branches.
  if (type === "release" || type === "hotfix" || type === "back-merge") return ok();
  const description = name.slice(name.indexOf("/") + 1);
  const words = description.split("-");
  if (PLAN_LABEL_PATTERN.test(description) || words.length < 2) {
    return fail(
      `branch description must describe the change (two or more words, no plan label such as "2b-"): got "${description}"; try feat/reconcile-records-command`
    );
  }
  return ok();
}

export function checkBranchTarget(head, base) {
  const type = branchType(head);
  if (base === "main") {
    if (type === "release" || type === "hotfix") return ok();
    return fail(`branch "${head}" cannot target main: only release/* and hotfix/* may target main`);
  }
  if (base === "develop") {
    if (type === "release") return fail(`release branch "${head}" must target main, not develop`);
    if (type === "hotfix") return fail(`hotfix branch "${head}" must target main, not develop`);
    if (head === "main" || head === "develop" || type === null) return fail(`branch "${head}" cannot target develop`);
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
  } else if (type === "hotfix") {
    if (parsed.type !== "fix") return fail(`title type ${parsed.type} does not match branch type hotfix (a hotfix carries a fix title)`);
  } else if (type === "back-merge") {
    if (parsed.type !== "chore") return fail(`title type ${parsed.type} does not match branch type back-merge (a back-merge carries a chore title)`);
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

// The back-merge (head back-merge/<sha> into base develop) is the PR that resolves the
// freeze, so it cannot itself be subject to it. `back-merge/*` is automation-only, and a
// fork branch of that shape gets no exemption: sameRepo must be verified by the caller.
export function isBackMerge({ head, base, sameRepo }) {
  return branchType(head) === "back-merge" && base === "develop" && sameRepo === true;
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
