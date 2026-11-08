// C2: the boundaries graph must actually place an aliased import and actually refuse a forbidden
// edge. Three things could each make `boundaries/dependencies` report nothing while looking
// healthy, and all three were true at once: a policy with no base rules (the `base: "a"` attribute
// nothing read), no `import/resolver` at all (so every `@/...` specifier was an unplaceable
// "external" element the rule skips), and capture lists that bound `feature`/`layer` to the wrong
// wildcard (so every layered edge matched nothing). The rule reported zero on both donors and
// every check agreed with it.
//
// This runs the real ESLint binary over a temporary body — rather than putting the forbidden
// import into fixtures/next-supabase-mono. The fixture is the body every other check observes and
// predicts against, and it is meant to be clean: a deliberate violation living in it would have to
// be carried as a "known" entry in the fixture's prediction forever, where it would look exactly
// like a real regression the day one appeared. A temporary body says the same thing louder and
// leaves the fixture honest.
//
// It is a SPAWNED run, with the body as the child's cwd, exactly as `orrery observe` invokes it:
// eslint-import-resolver-typescript globs its `project` option against `process.cwd()`, so an
// in-process ESLint API call (whose `cwd` option does not change the process's own) finds no
// tsconfig and resolves no alias — which is the very failure this test exists to catch.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL, fileURLToPath } from "node:url";
import { resolveEslintBin } from "../src/lib/effective-config.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(here, "..");

let dir;

const write = (rel, text) => {
  const file = path.join(dir, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
};

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-boundaries-"));
  // eslint-plugin-import's `order` rule walks up for the nearest package.json to classify an
  // import as external; a directory with none crashes it before boundaries ever runs.
  write("package.json", JSON.stringify({ name: "boundaries-probe", private: true, type: "module" }, null, 2));
  const compilerOptions = { module: "esnext", moduleResolution: "bundler", target: "es2022", strict: true, noEmit: true };
  write("tsconfig.json", JSON.stringify({ compilerOptions, include: ["apps/*/src"] }, null, 2));
  // The per-app tsconfig is what `import/resolver`'s `project: ["apps/*/tsconfig.json", ...]`
  // reads, and its `paths` is what makes `@/` mean anything at all.
  write("apps/web/tsconfig.json", JSON.stringify({ compilerOptions: { ...compilerOptions, baseUrl: ".", paths: { "@/*": ["src/*"] } }, include: ["src"] }, null, 2));
  write("apps/web/src/features/thing/application/use-thing.ts", "export const useThing = () => 1;\n");
  write("apps/web/src/shared/domain/helper.ts", "export const helper = () => 2;\n");
  write("apps/web/src/shared/application/allowed.ts", 'import { helper } from "@/shared/domain/helper";\nexport const allowed = () => helper();\n');
  // aeleos's layered policy, which the class carries as its base, allows shared -> shared and
  // never shared -> feature: a shared module that reaches into a feature inverts the layering.
  write("apps/web/src/shared/application/forbidden.ts", 'import { useThing } from "@/features/thing/application/use-thing";\nexport const forbidden = () => useThing();\n');
  const klass = pathToFileURL(path.join(packageDir, "classes/next-supabase-mono/eslint.mjs")).href;
  const body = { class: "next-supabase-mono", root: dir.split(path.sep).join("/"), tailwind: { entryPoint: "apps/web/src/app/globals.css" } };
  write(
    "eslint.config.mjs",
    `import orrery from ${JSON.stringify(klass)};\nexport default await orrery(${JSON.stringify(body, null, 2)});\n`
  );
});

afterAll(() => {
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
});

const boundariesMessages = (file) => {
  const result = spawnSync(
    process.execPath,
    [resolveEslintBin(packageDir), "-c", path.join(dir, "eslint.config.mjs"), "--no-config-lookup", "-f", "json", file],
    { cwd: dir, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
  );
  if (result.error) throw result.error;
  if (!result.stdout.trim()) throw new Error(`eslint produced no report (status ${result.status}): ${result.stderr}`);
  return JSON.parse(result.stdout)
    .flatMap((r) => r.messages)
    .filter((m) => m.ruleId === "boundaries/dependencies");
};

describe("boundaries/dependencies against the generated class config", () => {
  it("reports exactly one violation for a shared module importing a feature through @/", () => {
    const messages = boundariesMessages("apps/web/src/shared/application/forbidden.ts");
    expect(messages.map((m) => m.message)).toHaveLength(1);
    expect(messages[0].message).toMatch(/"shared"/);
    expect(messages[0].message).toMatch(/"feature"/);
  }, 180_000);

  it("reports none for an allowed shared -> shared import through @/", () => {
    expect(boundariesMessages("apps/web/src/shared/application/allowed.ts")).toEqual([]);
  }, 180_000);
});
