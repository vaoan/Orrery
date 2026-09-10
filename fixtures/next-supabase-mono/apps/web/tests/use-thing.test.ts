import { describe, it, expect } from "vitest";
import { useThing } from "../src/features/thing/application/use-thing";

describe("useThing", () => {
  it("returns the thing's label", () => {
    expect(useThing("1")).toBe("thing-1");
  });
});
