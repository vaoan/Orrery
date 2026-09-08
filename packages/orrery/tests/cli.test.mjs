import { describe, it, expect, vi } from "vitest";
import { run } from "../src/cli.mjs";

describe("run", () => {
  it("prints usage and exits 0 for --help", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const code = await run(["--help"]);
    expect(code).toBe(0);
    expect(log.mock.calls.flat().join("\n")).toContain("orrery diff-eslint");
    log.mockRestore();
  });

  it("prints usage and exits 0 with no arguments", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    expect(await run([])).toBe(0);
    log.mockRestore();
  });

  it("exits 2 on an unknown command", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const code = await run(["nonsense"]);
    expect(code).toBe(2);
    expect(error.mock.calls.flat().join("\n")).toContain("unknown command");
    error.mockRestore();
  });

  it("dispatches to the real diff-eslint command module", async () => {
    // Loads and runs the actual command through the dispatcher, rather than a
    // mock, so a broken import path or export shape would fail this test.
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const code = await run(["diff-eslint", "only-one"]);
    expect(code).toBe(2);
    error.mockRestore();
  });
});
