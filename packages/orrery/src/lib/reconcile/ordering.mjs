// The ruling order for one eslint rule: stricter wins; if strictness is undefined, the
// pre-ruled consistency/benefit table; project data is a parameter; anything left is residue.

const SEVERITY = { 0: "off", 1: "warn", 2: "error", off: "off", warn: "warn", error: "error" };
const RANK = { off: 0, warn: 1, error: 2 };

export const severityOf = (value) => SEVERITY[Array.isArray(value) ? value[0] : value] ?? "off";

export const isEmptyObject = (v) => v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0;

function stripMessages(value) {
  if (Array.isArray(value)) return value.map(stripMessages);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).filter(([k]) => k !== "message").map(([k, v]) => [k, stripMessages(v)]));
  }
  return value;
}

export function optionsOf(value) {
  const options = (Array.isArray(value) ? value.slice(1) : []).map(stripMessages);
  while (options.length > 0 && isEmptyObject(options.at(-1))) options.pop();
  return options;
}

export const ORDINAL_OPTIONS = {
  "sonarjs/cognitive-complexity": { at: 0, lower: true },
  "sonarjs/cyclomatic-complexity": { at: "threshold", lower: true },
  "sonarjs/expression-complexity": { at: "max", lower: true },
  "sonarjs/max-lines": { at: "maximum", lower: true },
  "sonarjs/max-lines-per-function": { at: "maximum", lower: true },
  "sonarjs/nested-control-flow": { at: "maximumNestingLevel", lower: true },
  "sonarjs/no-nested-functions": { at: "threshold", lower: true },
  "sonarjs/no-duplicate-string": { at: "threshold", lower: true },
  "max-params": { at: 0, lower: true },
  "max-depth": { at: 0, lower: true },
  "complexity": { at: 0, lower: true },
};

// Anywhere in the key: `argsIgnorePattern`, `allowShortCircuit`, `onlyIfContainsSeparator` all count.
export const EXEMPTION_KEY = /(allow|ignore|except|exempt|skip|onlyIf)/i;
export const PARAMETER_KEYS = ["entryPoint", "elements", "patterns", "paths", "project", "tsconfigRootDir", "words", "packageDir"];

const PARAMETER_NAME = {
  entryPoint: "tailwind.entryPoint",
  elements: "boundaries.elements",
  rules: "boundaries.allow",
  patterns: "imports.restrictedPatterns",
  words: "i18n.excludedWords",
};

export const PRE_RULINGS = {
  "unicorn/number-literal-case": {
    chosen: ["error", { hexadecimalValue: "uppercase" }],
    test: "consistency",
    note: "strictness undefined; uppercase is the plugin default and what four of five bodies run",
  },
  "i18next/no-literal-string": {
    chosen: ["error", {
      mode: "all",
      "should-validate-template": true,
      "jsx-attributes": { include: { $union: "jsx-attributes.include" } },
      ignoreAttribute: { $fromSide: "b" },
      words: { exclude: { $parameter: "i18n.excludedWords" } },
    }],
    test: "benefit",
    note: "mode all and the union of checked attributes are strictest; ignoreAttribute keeps libra's list because attribute names such as className are not user-facing text; excluded words are body data",
  },
  "sonarjs/no-duplicate-string": {
    chosen: ["error", { threshold: 2, ignoreStrings: { $union: "ignoreStrings", join: "|" } }],
    test: "benefit",
    note: "threshold 2 is strictest; ignoreStrings is the union because both sides exempt machine strings (MIME types, CSS variables, Tailwind classes), not code",
  },
  "boundaries/dependencies": {
    chosen: ["error", { default: "disallow", rules: { $parameter: "boundaries.allow", base: "a" } }],
    test: "parameter",
    note: "aeleos's layered policy (domain/application/presentation) is the class base because it is stricter; each body's extra element types and their allowed edges are parameters",
  },
  "boundaries/elements": {
    chosen: [{ $parameter: "boundaries.elements", base: "class" }],
    test: "parameter",
    note: "element paths are body data on top of the class's standard app/features/shared/proxy layout",
  },
  "testing-library/no-dom-import": {
    chosen: ["error", "react"],
    test: "benefit",
    surfaces: ["unit-test"],
    note: "both sides error; the framework argument adds the autofix to @testing-library/react and names the right module in the report, and every body in the class renders React",
  },
  "no-restricted-syntax": {
    surfaces: ["e2e"],
    chosen: ["error",
      { selector: "CallExpression[callee.property.name=/^(getByRole|getAllByRole|queryByRole|queryAllByRole|findByRole|findAllByRole)$/]", message: "Use getByTestId in E2E tests. Role queries couple the test to the accessible name, which is translated." },
      { selector: "CallExpression[callee.name=/^(getByRole|getAllByRole|queryByRole|queryAllByRole|findByRole|findAllByRole)$/]", message: "Use getByTestId in E2E tests. Role queries couple the test to the accessible name, which is translated." },
      { selector: "CallExpression[callee.property.name=/^(getByText|getAllByText|queryByText|queryAllByText|findByText|findAllByText)$/]", message: "Use getByTestId in E2E tests. Text queries break the moment a string is translated." },
      { selector: "CallExpression[callee.name=/^(getByText|getAllByText|queryByText|queryAllByText|findByText|findAllByText)$/]", message: "Use getByTestId in E2E tests. Text queries break the moment a string is translated." },
      { selector: "CallExpression[callee.property.name=/^(getByLabel|getByLabelText|getAllByLabel|getAllByLabelText|queryByLabel|queryByLabelText|queryAllByLabel|queryAllByLabelText|findByLabel|findByLabelText|findAllByLabel|findAllByLabelText)$/]", message: "Use getByTestId in E2E tests. Labels are translated." },
      { selector: "CallExpression[callee.name=/^(getByLabel|getByLabelText|getAllByLabel|getAllByLabelText|queryByLabel|queryByLabelText|queryAllByLabel|queryAllByLabelText|findByLabel|findByLabelText|findAllByLabel|findAllByLabelText)$/]", message: "Use getByTestId in E2E tests. Labels are translated." },
      { selector: "CallExpression[callee.property.name=/^(getByPlaceholder|getByPlaceholderText|getAllByPlaceholder|getAllByPlaceholderText|queryByPlaceholder|queryByPlaceholderText|queryAllByPlaceholder|queryAllByPlaceholderText|findByPlaceholder|findByPlaceholderText|findAllByPlaceholder|findAllByPlaceholderText)$/]", message: "Use getByTestId in E2E tests. Placeholders are translated." },
      { selector: "CallExpression[callee.name=/^(getByPlaceholder|getByPlaceholderText|getAllByPlaceholder|getAllByPlaceholderText|queryByPlaceholder|queryByPlaceholderText|queryAllByPlaceholder|queryAllByPlaceholderText|findByPlaceholder|findByPlaceholderText|findAllByPlaceholder|findAllByPlaceholderText)$/]", message: "Use getByTestId in E2E tests. Placeholders are translated." },
      { selector: "CallExpression[callee.property.name='toContainText']", message: "Do not assert translated text in E2E tests. Use toBeVisible()." },
      { selector: "CallExpression[callee.property.name='toHaveText']", message: "Do not assert translated text in E2E tests. Use toBeVisible()." },
      { selector: "CallExpression[callee.property.name='toHaveClass']", message: "Do not assert CSS classes in E2E tests; they are styling details that rename freely. Expose the state as an ARIA or data attribute and assert that." },
      { selector: "CallExpression[callee.property.name='toHaveCSS']", message: "Do not assert computed styles in E2E tests. Expose the state as an ARIA or data attribute and assert that." },
      { selector: "CallExpression[callee.property.name='locator'][arguments.0.value=/^[.][a-zA-Z]/]", message: "Do not select by CSS class in E2E tests. Use getByTestId, or an attribute selector." },
      { selector: "CallExpression[callee.property.name='locator'][arguments.0.value=/class/]", message: "Do not select by class attribute in E2E tests. Use getByTestId, or an attribute selector." },
      { selector: "CallExpression[callee.property.name='locator'] Literal[value=/data-testid/]", message: "Use page.getByTestId('id') rather than a raw attribute selector." },
      { selector: "NewExpression[callee.name='Promise'] CallExpression[callee.name='setTimeout']", message: "No unconditional setTimeout-based waits. Wait for a condition, or justify this exact line with eslint-disable-next-line and a comment." },
      { $parameter: "e2e.restrictedSyntax" },
    ],
    test: "benefit",
    note: "the union of both sides' bans is stricter than either; messages are aeleos's where both ban a selector and are rewritten to name no body file or helper elsewhere; aeleos's combined label/placeholder selector is subsumed by libra's two; libra's Supabase port and helper bans are body data and become the e2e.restrictedSyntax parameter",
  },
  "playwright/expect-expect": {
    chosen: ["error", { assertFunctionNames: { $parameter: "e2e.assertFunctionNames" } }],
    test: "parameter",
    surfaces: ["e2e"],
    note: "the rule stays error; the names of a body's own assertion helpers are body data, default empty as the rule's own default",
  },
};

const resolve = (options, ordinal) => (typeof ordinal.at === "number" ? options[ordinal.at] : options[0]?.[ordinal.at]);
const withOrdinal = (options, ordinal, value) => {
  const copy = options.map((o) => (o && typeof o === "object" ? { ...o } : o));
  if (typeof ordinal.at === "number") copy[ordinal.at] = value;
  else copy[0] = { ...(copy[0] ?? {}), [ordinal.at]: value };
  return copy;
};

// Returns "a" | "b" | "equal" | undefined (undefined = incomparable).
function exemptionOrder(a, b) {
  if (a === undefined && b === undefined) return "equal";
  if (isEmptyObject(a) || a === undefined) return typeof b === "object" && b !== null && hasExemption(b) ? "a" : undefined;
  if (isEmptyObject(b) || b === undefined) return typeof a === "object" && a !== null && hasExemption(a) ? "b" : undefined;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return undefined;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let winner = "equal";
  for (const key of keys) {
    let local;
    const va = a[key];
    const vb = b[key];
    if (JSON.stringify(va) === JSON.stringify(vb)) continue;
    if (EXEMPTION_KEY.test(key)) {
      if (typeof va === "boolean" || typeof vb === "boolean") local = (va ?? false) === false ? "a" : (vb ?? false) === false ? "b" : undefined;
      else local = va === undefined || (Array.isArray(va) && va.length === 0) ? "a" : vb === undefined || (Array.isArray(vb) && vb.length === 0) ? "b" : undefined;
    } else if (va && vb && typeof va === "object" && typeof vb === "object" && !Array.isArray(va)) {
      local = exemptionOrder(va, vb);
    }
    if (local === undefined) return undefined;
    if (local === "equal") continue;
    if (winner === "equal") winner = local;
    else if (winner !== local) return undefined;
  }
  return winner;
}

const hasExemption = (o) => Object.keys(o).some((k) => EXEMPTION_KEY.test(k) || (o[k] && typeof o[k] === "object" && !Array.isArray(o[k]) && hasExemption(o[k])));

function parameterise(rule, optionsA, optionsB) {
  const [oa = {}, ob = {}] = [optionsA[0], optionsB[0]];
  if (typeof oa !== "object" || typeof ob !== "object") return null;
  const keys = new Set([...Object.keys(oa), ...Object.keys(ob)]);
  const param = [...keys].find((k) => PARAMETER_KEYS.includes(k));
  if (!param) return null;
  if (rule === "no-restricted-imports") {
    const universal = [...(oa.patterns ?? []), ...(ob.patterns ?? [])].filter((p) => (p.group ?? []).some((g) => g.startsWith("../")));
    return [{ patterns: [...universal, { $parameter: PARAMETER_NAME.patterns }] }];
  }
  const merged = { ...oa, ...ob };
  merged[param] = { $parameter: PARAMETER_NAME[param] ?? param };
  for (const k of Object.keys(merged)) if (k !== param && EXEMPTION_KEY.test(k)) delete merged[k];
  return [merged];
}

// `surface` is optional: a pre-ruling with no `surfaces` list applies regardless of it; one
// that names surfaces applies only when `surface` is among them, and otherwise falls through
// to the ordinary ordering below exactly as if the rule had no pre-ruling at all.
export function stricter(rule, a, b, surface) {
  const sevA = severityOf(a);
  const sevB = severityOf(b);
  const severity = RANK[sevA] >= RANK[sevB] ? sevA : sevB;
  const optionsA = optionsOf(a);
  const optionsB = optionsOf(b);
  const sameOptions = JSON.stringify(optionsA) === JSON.stringify(optionsB);

  const preRuling = PRE_RULINGS[rule];
  if (preRuling && (!preRuling.surfaces || preRuling.surfaces.includes(surface))) return { ...preRuling };

  if (sameOptions) {
    return { chosen: [severity, ...optionsA], test: "strictest", note: `severity ${severity} over ${sevA === severity ? sevB : sevA}` };
  }
  if (sevA === "off" && optionsA.length === 0) return { chosen: [severity, ...optionsB], test: "strictest", note: "switched on" };
  if (sevB === "off" && optionsB.length === 0) return { chosen: [severity, ...optionsA], test: "strictest", note: "switched on" };

  const parameterised = parameterise(rule, optionsA, optionsB);
  if (parameterised) return { chosen: [severity, ...parameterised], test: "parameter", note: "project data becomes a body parameter; the stricter severity is kept" };

  const ordinal = ORDINAL_OPTIONS[rule];
  if (ordinal) {
    const va = resolve(optionsA, ordinal);
    const vb = resolve(optionsB, ordinal);
    if (typeof va === "number" && typeof vb === "number") {
      const value = ordinal.lower ? Math.min(va, vb) : Math.max(va, vb);
      const base = value === va ? optionsA : optionsB;
      return { chosen: [severity, ...withOrdinal(base, ordinal, value)], test: "strictest", note: `${typeof ordinal.at === "number" ? "value" : ordinal.at} ${value} is the ${ordinal.lower ? "lower" : "higher"} bound` };
    }
    if (typeof va === "number" && vb === undefined) return { chosen: [severity, ...optionsA], test: "strictest", note: "only one side bounds it" };
    if (typeof vb === "number" && va === undefined) return { chosen: [severity, ...optionsB], test: "strictest", note: "only one side bounds it" };
  }

  const order = exemptionOrder(optionsA[0], optionsB[0]);
  if (order === "a") return { chosen: [severity, ...optionsA], test: "strictest", note: "no exemption over an exemption" };
  if (order === "b") return { chosen: [severity, ...optionsB], test: "strictest", note: "no exemption over an exemption" };

  return { chosen: null, test: "residue", note: "strictness undefined and no pre-ruling; needs a consistency or benefit ruling" };
}
