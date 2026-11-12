import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const defaultRegistryPath = path.resolve(here, "../../../../registry.json");

export function loadRegistry(file = defaultRegistryPath) {
  const registry = JSON.parse(fs.readFileSync(file, "utf8"));
  for (const [name, body] of Object.entries(registry.bodies ?? {})) {
    if (!body.repo || !body.role) throw new Error(`registry body ${name} needs repo and role`);
    if ("version" in body) throw new Error(`registry body ${name} must not carry a version`);
  }
  return registry;
}
