import fs from "node:fs";
import path from "node:path";
import { renderPhysicsEslint, renderClassEslint } from "./eslint.mjs";
import { renderTsconfig, renderStylelint, renderFunction } from "./tools.mjs";

const PHYSICS_FUNCTIONS = ["prettier", "secretlint", "ls-lint", "syncpack", "lint-staged", "hooks"];
const CLASS_FUNCTIONS = ["jscpd", "cspell", "knip"];

export function writeBundle({ provenance, rows }, packageDir) {
  const written = [];
  const put = (rel, text) => { const file = path.join(packageDir, rel); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); written.push(rel); };
  put("physics/eslint.mjs", renderPhysicsEslint(rows, provenance));
  put("classes/next-supabase-mono/eslint.mjs", renderClassEslint(rows, provenance));
  const ts = renderTsconfig(rows, provenance);
  put("physics/tsconfig.json", ts.physics);
  put("classes/next-supabase-mono/tsconfig.json", ts.klass);
  put("classes/next-supabase-mono/stylelint.mjs", renderStylelint(rows, provenance));
  for (const tool of PHYSICS_FUNCTIONS) put(`physics/${tool}.mjs`, renderFunction(tool, rows, provenance));
  for (const tool of CLASS_FUNCTIONS) put(`classes/next-supabase-mono/${tool}.mjs`, renderFunction(tool, rows, provenance));
  return written;
}
