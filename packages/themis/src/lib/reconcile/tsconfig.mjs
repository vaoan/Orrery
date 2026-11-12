import { row, same } from "./simple.mjs";

// true is stricter
const STRICT_TRUE = ["strict", "noUncheckedIndexedAccess", "noImplicitOverride", "noUnusedLocals", "noUnusedParameters", "verbatimModuleSyntax", "forceConsistentCasingInFileNames", "isolatedModules", "exactOptionalPropertyTypes", "noFallthroughCasesInSwitch", "noImplicitReturns", "noPropertyAccessFromIndexSignature", "noImplicitAny", "strictNullChecks"];
// false is stricter
const STRICT_FALSE = ["allowJs", "skipLibCheck"];
// capabilities: true when either side needs it; class tier
const CAPABILITY = ["esModuleInterop", "resolveJsonModule", "incremental", "noEmit", "allowSyntheticDefaultImports", "declaration", "sourceMap"];
const PHYSICS_ENUM = ["target", "module", "moduleResolution"];
const CLASS_ENUM = ["jsx", "lib", "ignoreDeprecations", "moduleDetection", "jsxImportSource"];
const PARAMETER = ["types", "paths", "baseUrl", "rootDir", "outDir", "typeRoots", "plugins"];
const PARAMETER_TOP = ["include", "exclude", "files", "references"];

const norm = (v) => (typeof v === "string" ? v.toLowerCase() : Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x.toLowerCase() : x)).sort() : v);

export function reconcileTsconfig(a, b) {
  const ca = a?.compilerOptions ?? {};
  const cb = b?.compilerOptions ?? {};
  const rows = [];
  const keys = [...new Set([...Object.keys(ca), ...Object.keys(cb)])].sort();
  for (const key of keys) {
    const va = ca[key];
    const vb = cb[key];
    const k = `compilerOptions.${key}`;
    const base = { a: va ?? null, b: vb ?? null };
    if (STRICT_TRUE.includes(key) || STRICT_FALSE.includes(key)) {
      const strictValue = STRICT_TRUE.includes(key);
      const chosen = va === strictValue || vb === strictValue ? strictValue : (va ?? vb);
      const test = same(va, vb) ? "agree" : va === undefined || vb === undefined ? (chosen === strictValue ? "strictest" : "adopt") : "strictest";
      rows.push(row("tsconfig", k, { ...base, chosen, test, tier: "physics", note: `${strictValue} is stricter` }));
    } else if (CAPABILITY.includes(key)) {
      rows.push(row("tsconfig", k, { ...base, chosen: va === true || vb === true ? true : (va ?? vb), test: same(va, vb) ? "agree" : "benefit", tier: "class", note: "a capability either side needs" }));
    } else if (PHYSICS_ENUM.includes(key) || CLASS_ENUM.includes(key)) {
      const tier = PHYSICS_ENUM.includes(key) ? "physics" : "class";
      if (va === undefined || vb === undefined) rows.push(row("tsconfig", k, { ...base, chosen: va ?? vb, test: "adopt", tier }));
      else if (same(norm(va), norm(vb))) rows.push(row("tsconfig", k, { ...base, chosen: norm(va), test: "agree", tier }));
      else rows.push(row("tsconfig", k, { ...base, chosen: null, test: "residue", tier, note: "differing enum with no strictness order" }));
    } else if (PARAMETER.includes(key)) {
      rows.push(row("tsconfig", k, { ...base, chosen: { $parameter: `tsconfig.${key}` }, test: "parameter", tier: "class", note: "per-app data" }));
    } else {
      rows.push(row("tsconfig", k, { ...base, chosen: null, test: "residue", tier: "class", note: "compiler option not classified; add it to tsconfig.mjs" }));
    }
  }
  for (const key of PARAMETER_TOP) {
    if (a?.[key] !== undefined || b?.[key] !== undefined) rows.push(row("tsconfig", key, { a: a?.[key] ?? null, b: b?.[key] ?? null, chosen: { $parameter: `tsconfig.${key}` }, test: "parameter", tier: "class", note: "per-app data" }));
  }
  return rows;
}
