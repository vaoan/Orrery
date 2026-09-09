// packages/orrery/src/lib/repo-policy.mjs

const PROTECTION_FLAGS = [
  "enforce_admins",
  "required_linear_history",
  "allow_force_pushes",
  "allow_deletions",
  "required_conversation_resolution",
  "lock_branch",
  "allow_fork_syncing",
];

const REVIEW_FIELDS = ["dismiss_stale_reviews", "require_code_owner_reviews", "required_approving_review_count"];

const unwrap = (value) => (value && typeof value === "object" && "enabled" in value ? value.enabled : value);

/** GET shape -> PUT shape, so state and policy compare field for field. */
export function normaliseProtection(api) {
  if (!api) return null;
  const reviews = api.required_pull_request_reviews ?? null;
  const normalised = {
    required_status_checks: {
      strict: Boolean(api.required_status_checks?.strict),
      contexts: [...(api.required_status_checks?.contexts ?? [])].sort(),
    },
    required_pull_request_reviews: reviews
      ? Object.fromEntries(REVIEW_FIELDS.map((f) => [f, reviews[f] ?? (f === "required_approving_review_count" ? 0 : false)]))
      : null,
    restrictions: null,
  };
  for (const flag of PROTECTION_FLAGS) normalised[flag] = Boolean(unwrap(api[flag]));
  return normalised;
}

export function desiredProtection(policy, branch, state) {
  const contexts = state.sharedCi
    ? [...policy.requiredChecks[branch]].sort()
    : [...(state.protection[branch]?.required_status_checks?.contexts ?? [])].sort();

  return {
    ...policy.protection[branch],
    required_status_checks: { strict: true, contexts },
  };
}

const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Whether current protection state already matches the desired PUT body.
 * Re-normalises both sides through normaliseProtection so a GET-shaped
 * current value and a PUT-shaped desired body compare on identical shapes.
 */
function protectionEquals(current, desired) {
  if (!current) return false;
  const asApiShape = (body) => ({
    ...body,
    required_status_checks: body.required_status_checks,
    ...Object.fromEntries(PROTECTION_FLAGS.map((f) => [f, { enabled: body[f] }])),
  });
  return sameJson(normaliseProtection(asApiShape(current)), normaliseProtection(asApiShape(desired)));
}

// Order matters: a branch must exist before it can be default or protected.
export function planRepoChanges(state, policy) {
  if (state.branches.main === null) {
    throw new Error("repository has no main branch; create it before applying policy");
  }

  const ops = [];
  const sourceSha = state.branches.main;

  for (const branch of policy.protectedBranches) {
    if (state.branches[branch] === null && branch !== "main") {
      ops.push({ kind: "create-branch", name: branch, fromSha: sourceSha });
    }
  }

  const patch = {};
  const currentSettings = {};
  for (const [key, value] of Object.entries(policy.settings)) {
    if (state.settings[key] !== value) {
      patch[key] = value;
      currentSettings[key] = state.settings[key];
    }
  }
  if (Object.keys(patch).length > 0) ops.push({ kind: "update-settings", patch, current: currentSettings });

  if (state.defaultBranch !== policy.defaultBranch) {
    ops.push({ kind: "set-default-branch", name: policy.defaultBranch });
  }

  for (const branch of policy.protectedBranches) {
    const body = desiredProtection(policy, branch, state);
    const current = state.protection[branch];
    if (!protectionEquals(current, body)) {
      ops.push({ kind: "set-protection", branch, body, current });
    }
  }

  const byName = new Map(state.labels.map((l) => [l.name, l]));
  for (const label of policy.labels) {
    const existing = byName.get(label.name);
    if (!existing) ops.push({ kind: "create-label", label });
    else if (existing.color.toLowerCase() !== label.color.toLowerCase() || (existing.description ?? "") !== label.description) {
      ops.push({ kind: "update-label", label });
    }
  }

  return ops;
}

export async function readRepoState(github, repo, policy = { protectedBranches: ["main", "develop"], sharedCiMarker: "# orrery-ci" }) {
  const base = `/repos/${repo}`;
  const { data: repoData } = await github.request("GET", base);
  if (!repoData) throw new Error(`repository ${repo} not found or not accessible`);

  const branches = {};
  const protection = {};
  for (const branch of policy.protectedBranches) {
    const { data: b } = await github.request("GET", `${base}/branches/${branch}`);
    branches[branch] = b?.commit?.sha ?? null;
    const { data: p } = await github.request("GET", `${base}/branches/${branch}/protection`);
    protection[branch] = normaliseProtection(p);
  }

  const { data: labels } = await github.request("GET", `${base}/labels?per_page=100`);

  const { data: ci } = await github.request("GET", `${base}/contents/.github/workflows/ci.yml`);
  const ciEncoding = ci?.encoding ?? "base64";
  const ciText = ci?.content && ciEncoding === "base64" ? Buffer.from(ci.content, "base64").toString("utf8") : "";
  const sharedCi = ciText.includes(policy.sharedCiMarker ?? "# orrery-ci");

  const settings = {};
  for (const key of ["allow_squash_merge", "allow_merge_commit", "allow_rebase_merge", "delete_branch_on_merge", "allow_auto_merge", "allow_update_branch", "squash_merge_commit_title", "squash_merge_commit_message"]) {
    settings[key] = repoData[key];
  }

  return {
    settings,
    defaultBranch: repoData.default_branch,
    branches,
    protection,
    labels: (labels ?? []).map(({ name, color, description }) => ({ name, color, description: description ?? "" })),
    sharedCi,
  };
}

async function execute(github, repo, op) {
  const base = `/repos/${repo}`;
  switch (op.kind) {
    case "create-branch":
      return github.request("POST", `${base}/git/refs`, { ref: `refs/heads/${op.name}`, sha: op.fromSha });
    case "update-settings":
      return github.request("PATCH", base, op.patch);
    case "set-default-branch":
      return github.request("PATCH", base, { default_branch: op.name });
    case "set-protection":
      return github.request("PUT", `${base}/branches/${op.branch}/protection`, op.body);
    case "create-label":
      return github.request("POST", `${base}/labels`, op.label);
    case "update-label":
      return github.request("PATCH", `${base}/labels/${encodeURIComponent(op.label.name)}`, {
        new_name: op.label.name,
        color: op.label.color,
        description: op.label.description,
      });
    default:
      throw new Error(`unknown operation ${op.kind}`);
  }
}

export async function applyRepoPolicy(github, repo, policy, { dryRun = false } = {}) {
  const state = await readRepoState(github, repo, policy);
  const ops = planRepoChanges(state, policy);
  const applied = [];
  if (dryRun) return { ops, applied };

  for (const op of ops) {
    await execute(github, repo, op);
    applied.push(op);
  }
  return { ops, applied };
}
