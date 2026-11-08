import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { writeBundle } from "../lib/bundle/write.mjs";

const USAGE = "usage: orrery bundle [--rulings docs/decisions/rulings.json] [--package packages/orrery]";

export default async function bundle(argv, deps = {}) {
  const { readFileSync = fs.readFileSync } = deps;

  let values;
  try {
    ({ values } = parseArgs({
      args: argv,
      options: { rulings: { type: "string", default: "docs/decisions/rulings.json" }, package: { type: "string", default: "packages/orrery" } },
    }));
  } catch (error) {
    console.error(`${error.message}\n${USAGE}`);
    return 2;
  }

  try {
    const rulings = JSON.parse(readFileSync(values.rulings, "utf8"));
    const residue = rulings.rows.filter((r) => r.test === "residue");
    if (residue.length > 0) {
      console.error(`${values.rulings} carries ${residue.length} residue row(s); resolve them before bundling`);
      return 1;
    }
    const written = writeBundle(rulings, path.resolve(values.package));
    for (const file of written.sort()) console.log(file);
    return 0;
  } catch (error) {
    console.error(error.message);
    return 1;
  }
}
