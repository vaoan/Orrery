import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { versionDrift, installedCommit } from "../src/lib/observe/version.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const fixture = path.join(root, "fixtures/next-supabase-mono");

let dir;
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), "themis-ver-")); });
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));
const latest = "0123456789abcdef0123456789abcdef01234567";
const run = () => `${latest}\trefs/heads/main\n`;

describe("installedCommit", () => {
  it("finds the git-resolved commit of @vaoan/themis in a pnpm lockfile", () => {
    const lock = `packages:\n  '@vaoan/themis@https://codeload.github.com/vaoan/Themis/tar.gz/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa':\n    resolution: {tarball: https://codeload.github.com/vaoan/Themis/tar.gz/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa}\n`;
    expect(installedCommit(lock)).toBe("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
  });
  it("returns null when the lockfile does not mention it", () => {
    expect(installedCommit("packages:\n  react@19.0.0:\n")).toBeNull();
  });
});

describe("versionDrift", () => {
  it("reports not installed before adoption, with the latest still resolved", () => {
    fs.writeFileSync(path.join(dir, "pnpm-lock.yaml"), "packages: {}\n");
    expect(versionDrift(dir, { run })).toEqual({ installed: null, latest, behind: false, note: "body does not depend on @vaoan/themis yet" });
  });
  it("reports behind when the installed commit is not the latest", () => {
    fs.writeFileSync(path.join(dir, "pnpm-lock.yaml"), "  '@vaoan/themis@https://codeload.github.com/vaoan/Themis/tar.gz/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb':\n");
    const r = versionDrift(dir, { run });
    expect(r.behind).toBe(true);
    expect(r.installed).toBe("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
  });
  it("reports current when they match", () => {
    fs.writeFileSync(path.join(dir, "pnpm-lock.yaml"), `  '@vaoan/themis@https://codeload.github.com/vaoan/Themis/tar.gz/${latest}':\n`);
    expect(versionDrift(dir, { run }).behind).toBe(false);
  });
  it("asks git for exactly the main ref of the remote", () => {
    fs.writeFileSync(path.join(dir, "pnpm-lock.yaml"), "");
    let args;
    versionDrift(dir, { run: (c, a) => { args = [c, ...a]; return run(); } });
    expect(args).toEqual(["git", "ls-remote", "https://github.com/vaoan/Themis.git", "refs/heads/main"]);
  });
  it("reports not installed for the real fixture body, which predates the cut-over", () => {
    expect(versionDrift(fixture, { run })).toEqual({ installed: null, latest, behind: false, note: "body does not depend on @vaoan/themis yet" });
  });
});
