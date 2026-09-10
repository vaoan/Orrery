import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const typeOk = (value, type) => {
  if (type === "string") return typeof value === "string";
  if (type === "string[]") return Array.isArray(value) && value.every((v) => typeof v === "string");
  if (type === "object[]") return Array.isArray(value) && value.every((v) => v && typeof v === "object");
  if (type === "object") return value && typeof value === "object" && !Array.isArray(value);
  return false;
};

export function validateBodyConfig(config, schema, prefix = "") {
  const errors = [];
  for (const key of Object.keys(config ?? {})) if (!schema[key]) errors.push(`unknown field ${prefix}${key}`);
  for (const [key, spec] of Object.entries(schema)) {
    const value = config?.[key];
    const name = `${prefix}${key}`;
    if (value === undefined) { if (spec.required) errors.push(`${name} is required`); continue; }
    if (!typeOk(value, spec.type)) { errors.push(`${name} must be ${spec.type}`); continue; }
    if (spec.enum && !spec.enum.includes(value)) errors.push(`${name} must be one of ${spec.enum.join(", ")}`);
    if (spec.fields) errors.push(...validateBodyConfig(value, spec.fields, `${name}.`));
  }
  return errors;
}

export function withDefaults(config, schema) {
  const out = {};
  for (const [key, spec] of Object.entries(schema)) {
    const value = config?.[key];
    if (spec.fields) out[key] = withDefaults(value ?? {}, spec.fields);
    else out[key] = value === undefined ? structuredClone(spec.default) : value;
  }
  return out;
}

export function resolveParameter(config, dotted, schema) {
  return dotted.split(".").reduce((o, k) => o?.[k], withDefaults(config, schema));
}

export async function loadBodyConfig(startDir) {
  let dir = path.resolve(startDir);
  for (;;) {
    const file = path.join(dir, "orrery.config.mjs");
    if (fs.existsSync(file)) {
      const config = (await import(pathToFileURL(file).href)).default;
      const schema = (await import(`../../classes/${config?.class ?? "next-supabase-mono"}/schema.mjs`)).default;
      const errors = validateBodyConfig(config, schema);
      if (errors.length) throw new Error(`invalid ${file}:\n  ${errors.join("\n  ")}`);
      return { root: dir, config };
    }
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error(`no orrery.config.mjs found from ${startDir} upward`);
    dir = parent;
  }
}
