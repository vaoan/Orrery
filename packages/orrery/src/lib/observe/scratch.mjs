import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const posix = (p) => p.replaceAll("\\", "/");

// A real body's tree carries generated/build output the bundle itself never excludes (it is
// normally only ever run through lint-staged, against staged files — a bulk sweep never
// happens in real usage). observe's own violations pass is the one caller that walks the
// whole tree (`apps packages scripts`), and without this it tries to parse libra's `.next`
// webpack chunks — megabyte-sized generated JS — and OOMs the eslint child process. This is a
// scratch-invocation concern, not a rulings/bundle one: it never touches the generated bundle
// or rulings.json, only what observe's own materialised config additionally ignores.
const GLOBAL_IGNORES = ["**/.next/**", "**/.turbo/**", "**/dist/**", "**/build/**", "**/coverage/**", "**/out/**", "**/.vercel/**", "**/node_modules/**"];

// Emits a small subset of YAML: nested plain objects and arrays of strings, no quoting or
// folding. That is all any of the physics/class tool functions ever return (ls-lint's `{ ls: {
// pattern: { ext: rule } } }` shape), so a dependency for the full spec would be unused weight.
function toYaml(value, indent = "") {
  if (Array.isArray(value)) return value.map((v) => `${indent}- ${v}`).join("\n") + "\n";
  if (value && typeof value === "object") {
    return Object.entries(value)
      .map(([k, v]) => (v && typeof v === "object" ? `${indent}${k}:\n${toYaml(v, indent + "  ")}` : `${indent}${k}: ${v}`))
      .join("\n") + "\n";
  }
  return `${indent}${value}\n`;
}

// One materialised config per tool, in a scratch directory, importing the bundle by absolute
// `file://` URL and passing the body config plus the resolved `root`. Nothing is written into
// the body: every path here is under `scratchDir`.
export async function materialise(bodyDir, bodyConfig, scratchDir, { bundleDir, functions } = {}) {
  const bundle = posix(path.resolve(bundleDir));
  const klass = `${bundle}/classes/next-supabase-mono`;
  // Resolved to absolute, like bundleDir above: this becomes `tsconfigRootDir` in the
  // materialised eslint config's parserOptions, which typescript-eslint's project service needs
  // absolute to find the body's tsconfig — a relative root here silently fails to associate any
  // file with a TS project, which ESLint reports as a parse-level fatal error on every file that
  // needs type information, not as a config problem.
  const bodyRoot = posix(path.resolve(bodyDir));
  const fns = functions ?? {
    stylelint: (await import(pathToFileURL(`${klass}/stylelint.mjs`).href)).default,
    jscpd: (await import(pathToFileURL(`${klass}/jscpd.mjs`).href)).default,
    cspell: (await import(pathToFileURL(`${klass}/cspell.mjs`).href)).default,
    lsLint: (await import(pathToFileURL(`${bundle}/physics/ls-lint.mjs`).href)).default,
    syncpack: (await import(pathToFileURL(`${bundle}/physics/syncpack.mjs`).href)).default,
    tsconfigInclude: bodyConfig.tsconfig?.include?.length
      ? bodyConfig.tsconfig.include
      : ["apps/*/src", "apps/*/tests", "apps/*/e2e", "packages/*/src", "packages/*/tests"],
  };
  const body = { ...bodyConfig, root: bodyRoot };
  const write = (name, text) => {
    const f = path.join(scratchDir, name);
    fs.writeFileSync(f, text);
    return f;
  };
  return {
    eslint: write(
      "eslint.config.mjs",
      `import orrery from ${JSON.stringify(pathToFileURL(`${klass}/eslint.mjs`).href)};\n` +
        `const config = await orrery(${JSON.stringify(body, null, 2)});\n` +
        `export default [{ ignores: ${JSON.stringify(GLOBAL_IGNORES)} }, ...config];\n`
    ),
    tsconfig: write(
      "tsconfig.json",
      JSON.stringify(
        { extends: `${klass}/tsconfig.json`, include: fns.tsconfigInclude.map((i) => `${bodyRoot}/${i}`), compilerOptions: { noEmit: true } },
        null,
        2
      )
    ),
    stylelint: write("stylelint.config.mjs", `export default ${JSON.stringify(fns.stylelint(body), null, 2)};\n`),
    jscpd: write("jscpd.json", JSON.stringify(fns.jscpd(body), null, 2)),
    cspell: write("cspell.json", JSON.stringify(fns.cspell(body), null, 2)),
    lsLint: write(".ls-lint.yml", typeof fns.lsLint(body) === "string" ? fns.lsLint(body) : toYaml(fns.lsLint(body))),
    syncpack: write("syncpack.json", JSON.stringify(fns.syncpack(body), null, 2)),
  };
}
