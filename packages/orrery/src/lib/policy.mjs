import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const defaultPolicyPath = path.resolve(here, "../../../../policy/repository.json");

const HEX_COLOUR = /^[0-9a-f]{6}$/i;

export function validatePolicy(policy) {
  const errors = [];
  const branches = Array.isArray(policy.protectedBranches) ? policy.protectedBranches : [];

  if (!branches.includes(policy.defaultBranch)) {
    errors.push(`defaultBranch ${policy.defaultBranch} is not in protectedBranches`);
  }
  for (const branch of branches) {
    if (!policy.protection?.[branch]) errors.push(`protection.${branch} is missing`);
    if (!Array.isArray(policy.requiredChecks?.[branch])) errors.push(`requiredChecks.${branch} is missing`);
  }
  if (policy.settings?.allow_rebase_merge !== false) {
    errors.push("settings.allow_rebase_merge must be false");
  }
  for (const label of policy.labels ?? []) {
    if (!HEX_COLOUR.test(label.color ?? "")) {
      errors.push(`label ${label.name} has an invalid colour: ${label.color}`);
    }
  }
  return errors;
}

export function loadPolicy(file = defaultPolicyPath) {
  const policy = JSON.parse(fs.readFileSync(file, "utf8"));
  const errors = validatePolicy(policy);
  if (errors.length > 0) {
    throw new Error(`invalid policy ${file}:\n  ${errors.join("\n  ")}`);
  }
  return policy;
}
