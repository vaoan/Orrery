import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { readDonor, stripJsonComments } from "../src/lib/donors.mjs";

let repo;
const write = (rel, text) => {
  fs.mkdirSync(path.join(repo, path.dirname(rel)), { recursive: true });
  fs.writeFileSync(path.join(repo, rel), text);
};
beforeEach(() => { repo = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-donor-")); });
afterEach(() => fs.rmSync(repo, { recursive: true, force: true }));

describe("stripJsonComments", () => {
  it("removes line and block comments but not slashes inside strings", () => {
    const text = '{ // c\n "a": "http://x", /* b */ "b": 1 }';
    expect(JSON.parse(stripJsonComments(text))).toEqual({ a: "http://x", b: 1 });
  });
});

describe("readDonor", () => {
  it("reads one effective eslint config per surface and every static config, null when absent", async () => {
    write("tsconfig.base.json", '{"compilerOptions":{"strict":true}}');
    write("cspell.json", '{ "version": "0.2", // words\n "words": ["orrery"] }');
    write(".jscpd.json", '{"threshold":5}');
    write("knip.json", '{"workspaces":{}}');
    write(".syncpackrc.json", '{"versionGroups":[]}');
    write(".secretlintrc.json", '{"rules":[]}');
    write("package.json", '{"name":"x","prettier":{"endOfLine":"auto"},"lint-staged":{"*.ts":["eslint"]}}');
    write(".husky/pre-commit", "pnpm lint-staged\n");
    write("stylelint.config.mjs", 'export default { rules: { "color-no-invalid-hex": true } };');
    const exec = (dir, file) => JSON.stringify({ rules: { [`for:${file}`]: ["error"] } });
    const run = (cmd, args) => (args[0] === "rev-parse" ? "abc1234\n" : "");
    const donor = await readDonor(repo, { source: "a.ts", component: "b.tsx" }, { exec, run });
    expect(donor.sha).toBe("abc1234");
    expect(donor.eslint.source.rules["for:a.ts"]).toEqual(["error"]);
    expect(donor.eslint.component.rules["for:b.tsx"]).toEqual(["error"]);
    expect(donor.tsconfig.compilerOptions.strict).toBe(true);
    expect(donor.cspell.words).toEqual(["orrery"]);
    expect(donor.jscpd.threshold).toBe(5);
    expect(donor.knip.workspaces).toEqual({});
    expect(donor.syncpack.versionGroups).toEqual([]);
    expect(donor.secretlint.rules).toEqual([]);
    expect(donor.prettier).toEqual({ endOfLine: "auto" });
    expect(donor.lintStaged).toEqual({ "*.ts": ["eslint"] });
    expect(donor.hooks.preCommit).toBe("pnpm lint-staged\n");
    expect(donor.hooks.prePush).toBeNull();
    expect(donor.stylelint.rules["color-no-invalid-hex"]).toBe(true);
  });

  it("prefers tsconfig.base.json over tsconfig.json and .prettierrc over the package.json key", async () => {
    write("tsconfig.json", '{"compilerOptions":{"strict":false}}');
    write("tsconfig.base.json", '{"compilerOptions":{"strict":true}}');
    write(".prettierrc", '{"endOfLine":"lf"}');
    write("package.json", '{"name":"x","prettier":{"endOfLine":"auto"}}');
    const donor = await readDonor(repo, {}, { exec: () => "{}", run: () => "sha" });
    expect(donor.tsconfig.compilerOptions.strict).toBe(true);
    expect(donor.prettier).toEqual({ endOfLine: "lf" });
  });
});
