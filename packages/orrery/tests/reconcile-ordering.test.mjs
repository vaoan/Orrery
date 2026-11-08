import { describe, it, expect } from "vitest";
import { severityOf, optionsOf, stricter, PRE_RULINGS, namesProject, splitRestrictions } from "../src/lib/reconcile/ordering.mjs";

describe("severityOf / optionsOf", () => {
  it("normalises numbers and strings and strips trailing empties and messages", () => {
    expect(severityOf(2)).toBe("error");
    expect(severityOf(["warn"])).toBe("warn");
    expect(optionsOf(["error", {}])).toEqual([]);
    expect(optionsOf(["error", { message: "x", object: "document" }])).toEqual([{ object: "document" }]);
    expect(optionsOf(["error", { patterns: [{ group: ["../*"], message: "no" }] }])).toEqual([{ patterns: [{ group: ["../*"] }] }]);
  });
});

describe("stricter: severity", () => {
  it("picks the higher severity when options agree", () => {
    expect(stricter("x", ["warn", { a: 1 }], ["error", { a: 1 }])).toEqual({ chosen: ["error", { a: 1 }], test: "strictest", note: "severity error over warn" });
  });
  it("treats off versus error as a severity flip, keeping the on side's options", () => {
    expect(stricter("sonarjs/deprecation", ["off"], ["error"]).chosen).toEqual(["error"]);
  });
});

describe("stricter: ordinal options", () => {
  it("takes the lower threshold and the higher severity independently", () => {
    const r = stricter("sonarjs/cyclomatic-complexity", ["off", { threshold: 10 }], ["error", { threshold: 15 }]);
    expect(r.chosen).toEqual(["error", { threshold: 10 }]);
    expect(r.test).toBe("strictest");
  });
  it("handles a positional ordinal option", () => {
    expect(stricter("sonarjs/cognitive-complexity", ["error", 20], ["error", 15]).chosen).toEqual(["error", 15]);
  });
  it("takes the lower maximum for max-lines family", () => {
    expect(stricter("sonarjs/max-lines", ["off", { maximum: 1000 }], ["error", { maximum: 400 }]).chosen).toEqual(["error", { maximum: 400 }]);
    expect(stricter("sonarjs/nested-control-flow", ["off", { maximumNestingLevel: 3 }], ["error", { maximumNestingLevel: 4 }]).chosen).toEqual(["error", { maximumNestingLevel: 3 }]);
  });
});

describe("stricter: exemptions", () => {
  it("prefers the side without exemption keys", () => {
    const r = stricter("@typescript-eslint/no-unused-vars", ["error"], ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }]);
    expect(r.chosen).toEqual(["error"]);
    expect(r.test).toBe("strictest");
    expect(r.note).toMatch(/no exemption/);
  });
  it("prefers allow-false over allow-true and drops an allow key one side lacks", () => {
    expect(stricter("x", ["error", { allowMultiline: true }], ["error"]).chosen).toEqual(["error"]);
    expect(stricter("x", ["error", { allowShortCircuit: true }], ["error", { allowShortCircuit: false }]).chosen).toEqual(["error", { allowShortCircuit: false }]);
  });
  it("prefers the side without a nested onlyIfContainsSeparator exemption", () => {
    const a = ["error", { hexadecimal: { minimumDigits: 0, groupLength: 2, onlyIfContainsSeparator: true } }];
    const b = ["error", { hexadecimal: { minimumDigits: 0, groupLength: 2 } }];
    expect(stricter("unicorn/numeric-separators-style", a, b).chosen).toEqual(b);
  });
});

describe("stricter: parameters", () => {
  it("marks project data as a parameter and keeps the stricter severity", () => {
    const r = stricter("better-tailwindcss/no-conflicting-classes", ["error"], ["error", { entryPoint: "apps/store/src/app/globals.css" }]);
    expect(r.chosen).toEqual(["error", { entryPoint: { $parameter: "tailwind.entryPoint" } }]);
    expect(r.test).toBe("parameter");
  });
  // C3: the universal half of a restriction rule is the half that names nothing project-specific.
  // A parent-relative ban (`../*`) names a shape; an alias group names a project's own module
  // layout, so it goes back to that body as a per-surface parameter.
  it("splits no-restricted-imports into the universal pattern and the surface's own parameter", () => {
    const a = ["error", { patterns: [{ group: ["../*"] }] }];
    const b = ["error", { patterns: [{ group: ["@ui/*"] }, { group: ["@shared/*"] }] }];
    const r = stricter("no-restricted-imports", a, b, "source");
    expect(r.chosen).toEqual(["error", { patterns: [{ group: ["../*"] }, { $parameter: "restrictions.source.imports" }] }]);
    expect(r.test).toBe("parameter");
  });
});

describe("stricter: pre-rulings and residue", () => {
  it("applies a pre-ruling for a non-ordinal tie", () => {
    const r = stricter("unicorn/number-literal-case", ["error", { hexadecimalValue: "lowercase" }], ["error", { hexadecimalValue: "uppercase" }]);
    expect(r.chosen).toEqual(["error", { hexadecimalValue: "uppercase" }]);
    expect(r.test).toBe("consistency");
  });
  it("returns residue when nothing decides", () => {
    const r = stricter("some/rule", ["error", { style: "a" }], ["error", { style: "b" }]);
    expect(r.chosen).toBeNull();
    expect(r.test).toBe("residue");
  });
  it("rules on testing-library/no-dom-import: react's autofix is the benefit", () => {
    const r = stricter("testing-library/no-dom-import", [2], [2, "react"], "unit-test");
    expect(r.chosen).toEqual(["error", "react"]);
    expect(r.test).toBe("benefit");
  });
  it("rules on playwright/expect-expect: assertFunctionNames becomes the e2e parameter", () => {
    const r = stricter("playwright/expect-expect", [2], [2, { assertFunctionNames: ["x"] }], "e2e");
    expect(r.chosen).toEqual(["error", { assertFunctionNames: { $parameter: "e2e.assertFunctionNames" } }]);
    expect(r.test).toBe("parameter");
  });
  it("rules on no-restricted-syntax: the union of both sides minus body-data selectors, ending in the e2e parameter", () => {
    const r = stricter("no-restricted-syntax", [2], [2], "e2e");
    expect(r.test).toBe("benefit");
    const entries = r.chosen.slice(1, -1);
    const selectors = entries.map((o) => o.selector);
    const messages = entries.map((o) => o.message);

    // every selector aeleos bans, kept
    expect(selectors).toEqual(expect.arrayContaining([
      "CallExpression[callee.property.name=/^(getByRole|getAllByRole|queryByRole|queryAllByRole|findByRole|findAllByRole)$/]",
      "CallExpression[callee.property.name=/^(getByText|getAllByText|queryByText|queryAllByText|findByText|findAllByText)$/]",
      "CallExpression[callee.property.name='toContainText']",
      "CallExpression[callee.property.name='toHaveText']",
      "CallExpression[callee.property.name='locator'] Literal[value=/data-testid/]",
      "NewExpression[callee.name='Promise'] CallExpression[callee.name='setTimeout']",
    ]));
    // every selector libra bans (beyond aeleos's), kept
    expect(selectors).toEqual(expect.arrayContaining([
      "CallExpression[callee.property.name='toHaveClass']",
      "CallExpression[callee.property.name='toHaveCSS']",
      "CallExpression[callee.property.name='locator'][arguments.0.value=/^[.][a-zA-Z]/]",
      "CallExpression[callee.property.name='locator'][arguments.0.value=/class/]",
      "CallExpression[callee.name=/^(getByRole|getAllByRole|queryByRole|queryAllByRole|findByRole|findAllByRole)$/]",
      "CallExpression[callee.name=/^(getByText|getAllByText|queryByText|queryAllByText|findByText|findAllByText)$/]",
      "CallExpression[callee.property.name=/^(getByLabel|getByLabelText|getAllByLabel|getAllByLabelText|queryByLabel|queryByLabelText|queryAllByLabel|queryAllByLabelText|findByLabel|findByLabelText|findAllByLabel|findAllByLabelText)$/]",
      "CallExpression[callee.name=/^(getByLabel|getByLabelText|getAllByLabel|getAllByLabelText|queryByLabel|queryByLabelText|queryAllByLabel|queryAllByLabelText|findByLabel|findByLabelText|findAllByLabel|findAllByLabelText)$/]",
      "CallExpression[callee.property.name=/^(getByPlaceholder|getByPlaceholderText|getAllByPlaceholder|getAllByPlaceholderText|queryByPlaceholder|queryByPlaceholderText|queryAllByPlaceholder|queryAllByPlaceholderText|findByPlaceholder|findByPlaceholderText|findAllByPlaceholder|findAllByPlaceholderText)$/]",
      "CallExpression[callee.name=/^(getByPlaceholder|getByPlaceholderText|getAllByPlaceholder|getAllByPlaceholderText|queryByPlaceholder|queryByPlaceholderText|queryAllByPlaceholder|queryAllByPlaceholderText|findByPlaceholder|findByPlaceholderText|findAllByPlaceholder|findAllByPlaceholderText)$/]",
    ]));
    // aeleos's combined label/placeholder selector is subsumed by libra's two and dropped
    expect(selectors).not.toContain("CallExpression[callee.property.name=/^(getByLabel|getByLabelText|getByPlaceholder|getByPlaceholderText)$/]");
    // libra's Supabase-specific bans are body data, not in the shared list
    expect(selectors).not.toContain("Literal[value=54321]");
    expect(selectors).not.toContain("Literal[value=64321]");
    expect(selectors).not.toContain("Literal[value=/127\\.0\\.0\\.1:(54321|64321)/]");
    expect(selectors).not.toContain("CallExpression[callee.name='getLocalSupabaseEnv'], CallExpression[callee.object.name='getLocalSupabaseEnv']");
    // no message names a body file or a body-specific helper
    expect(messages.some((m) => m.includes(".claude/"))).toBe(false);
    expect(messages.some((m) => m.includes("tid("))).toBe(false);
    // the shared list ends with the e2e parameter marker
    expect(r.chosen.at(-1)).toEqual({ $parameter: "restrictions.e2e.syntax" });
  });
  it("falls through to the ordinary ordering when a surface-restricted pre-ruling's surface does not match", () => {
    const r = stricter("no-restricted-syntax", ["error", { selector: "a" }], ["error", { selector: "b" }], "source");
    // Not the e2e pre-ruling's Playwright union: the ordinary ordering handles it, which for a
    // restriction rule means the union of what names no project plus this surface's parameter.
    expect(r.test).toBe("parameter");
    expect(r.chosen).toEqual(["error", { selector: "a" }, { selector: "b" }, { $parameter: "restrictions.source.syntax" }]);
  });

  // C3: the same rule on the same two donors, judged by the token test rather than by hand.
  it("keeps the entries that name nothing project-specific and parameterises the ones that do", () => {
    const a = ["error", { selector: "WithStatement" }, { selector: "CallExpression[callee.name='readFileSync']", message: "See: shared/application/utils/fs.ts" }];
    const b = ["error", { selector: "CallExpression[callee.name='eval']" }];
    const r = stricter("no-restricted-syntax", a, b, "package");
    expect(r.test).toBe("parameter");
    expect(r.chosen).toEqual([
      "error",
      { selector: "WithStatement" },
      { selector: "CallExpression[callee.name='eval']" },
      { $parameter: "restrictions.package.syntax" },
    ]);
  });
  // S6: PR #29's ruling made i18next/no-literal-string's `mode: "all"` pre-ruling apply to
  // every surface, including `script` — flagging every string literal a CLI script contains
  // (e.g. "--version"). It is restricted to the TS surfaces that actually render user-facing
  // text: source, component, package.
  it("does not apply the i18next pre-ruling on script; falls through to the ordinary ordering", () => {
    expect(PRE_RULINGS["i18next/no-literal-string"].surfaces).toEqual(["source", "component", "package"]);
    const r = stricter("i18next/no-literal-string", ["error", { mode: "jsx-text-only" }], ["error", { mode: "all" }], "script");
    expect(r.chosen).not.toEqual(PRE_RULINGS["i18next/no-literal-string"].chosen);
  });
  it("still applies the i18next pre-ruling on source, component and package", () => {
    for (const surface of ["source", "component", "package"]) {
      const r = stricter("i18next/no-literal-string", ["error", { mode: "jsx-text-only" }], ["error", { mode: "all" }], surface);
      expect(r.chosen).toEqual(PRE_RULINGS["i18next/no-literal-string"].chosen);
    }
  });
  it("every pre-ruling names its test", () => {
    for (const [rule, ruling] of Object.entries(PRE_RULINGS)) {
      expect(["strictest", "consistency", "benefit", "parameter"]).toContain(ruling.test);
      expect(ruling.note.length, rule).toBeGreaterThan(10);
    }
  });
});

// C3, the token test itself. It is deliberately crude and errs toward the body: the cost of
// calling something project-specific that was not is that the body restates it at cut-over; the
// cost of the other mistake is one project's opinion shipped to every repository as physics.
describe("namesProject", () => {
  it.each([
    [{ selector: "WithStatement" }, false],
    [{ group: ["../*"] }, false],
    [{ group: ["./sibling"] }, false],
    [{ object: "document", property: "querySelector" }, false],
    [{ group: ["@/features/*"] }, true],
    [{ selector: "X", message: "See: shared/application/utils/featureFlagChecks.ts" }, true],
    [{ selector: "X", message: "See: .claude/rules/tailwind.md" }, true],
    [{ group: ["**/local-supabase-env*"] }, true],
    [{ selector: "Literal[value=/globals.css/]" }, true],
  ])("%j -> %s", (entry, expected) => {
    expect(namesProject(entry)).toBe(expected);
  });
});

describe("splitRestrictions", () => {
  it("returns null for a rule that is not a restriction rule", () => {
    expect(splitRestrictions("no-var", "source", [])).toBeNull();
  });

  it("leaves an adopt row alone when nothing in it names a project", () => {
    expect(splitRestrictions("no-restricted-syntax", "source", [{ selector: "WithStatement" }])).toBeNull();
  });

  it("splits an adopt row that does, naming the surface's own parameter", () => {
    expect(splitRestrictions("no-restricted-syntax", "unit-test", [{ selector: "X", message: "see docs/a.md" }, { selector: "WithStatement" }])).toEqual([
      { selector: "WithStatement" },
      { $parameter: "restrictions.unit-test.syntax" },
    ]);
  });

  it("keeps no-restricted-imports's options-object shape", () => {
    expect(splitRestrictions("no-restricted-imports", "e2e", [{ patterns: [{ group: ["**/local-supabase-env*"] }] }])).toEqual([
      { patterns: [{ $parameter: "restrictions.e2e.imports" }] },
    ]);
  });
});
