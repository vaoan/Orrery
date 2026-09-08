import { parseArgs } from "node:util";
import * as effective from "../lib/effective-config.mjs";
import { diffRules } from "../lib/rule-diff.mjs";

export default async function diffEslint(argv, deps = effective) {
  const { values, positionals } = parseArgs({
    args: argv,
    options: { file: { type: "string" }, json: { type: "boolean", default: false } },
    allowPositionals: true,
  });

  const [repoA, repoB] = positionals;
  if (!repoA || !repoB) {
    console.error("usage: orrery diff-eslint <repoA> <repoB> [--file <path>] [--json]");
    return 2;
  }

  let configA, configB;
  try {
    configA = deps.readEffectiveConfig(repoA, deps.pickSampleFile(repoA, values.file));
    configB = deps.readEffectiveConfig(repoB, deps.pickSampleFile(repoB, values.file));
  } catch (error) {
    console.error(error.message);
    return 1;
  }

  const result = diffRules(configA, configB);

  if (values.json) {
    console.log(JSON.stringify(result, null, 2));
    return 0;
  }

  console.log(`agree     ${result.agree.length}`);
  console.log(`only ${repoA}  ${result.onlyA.length}`);
  console.log(`only ${repoB}  ${result.onlyB.length}`);
  console.log(`conflict  ${result.conflict.length}`);

  if (result.conflict.length > 0) {
    console.log("\nconflicts — each needs a ruling and a decision record:");
    for (const { rule, a, b } of result.conflict) {
      console.log(`  ${rule}\n    ${repoA}: ${JSON.stringify(a)}\n    ${repoB}: ${JSON.stringify(b)}`);
    }
  }

  return 0;
}
