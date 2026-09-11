// The fields a body's orrery.config.mjs may carry. No field can hold a severity, a threshold
// or a rule name: a body adds data and adds rules, never loosens a shared rule.
export default {
  class: { type: "string", required: true, enum: ["next-supabase-mono"] },
  workspacePackages: { type: "string[]", default: [] },
  floatingPeers: { type: "string[]", default: [] },
  tailwind: { type: "object", fields: { entryPoint: { type: "string", required: true } } },
  boundaries: {
    type: "object",
    fields: {
      elements: { type: "object[]", default: [] },   // extra { type, pattern, mode? } on top of app/features/shared/proxy
      allow: { type: "object[]", default: [] },      // extra { from, to } edges
    },
  },
  i18n: { type: "object", fields: { excludedWords: { type: "string[]", default: [] } } },
  e2e: { type: "object", fields: { assertFunctionNames: { type: "string[]", default: [] } } },
  // C3: what a body bans with no-restricted-syntax / -imports / -properties is that body's own
  // opinion, and it differs per surface — a Supabase port ban belongs in e2e, an arbitrary-Tailwind
  // ban in components. The shared tiers keep only the entries that name nothing project-specific
  // and splice these in after them. A body adds bans here; it can never remove a shared one.
  restrictions: {
    type: "object",
    fields: Object.fromEntries(
      ["source", "component", "package", "unit-test", "e2e", "script"].map((surface) => [
        surface,
        { type: "object", fields: { syntax: { type: "object[]", default: [] }, imports: { type: "object[]", default: [] }, properties: { type: "object[]", default: [] } } },
      ])
    ),
  },
  spelling: { type: "string[]", default: [] },
  ignore: { type: "object", fields: { duplication: { type: "string[]", default: [] }, secrets: { type: "string[]", default: [] }, spelling: { type: "string[]", default: [] } } },
  knip: { type: "object", fields: { apps: { type: "object", fields: { extraEntries: { type: "string[]", default: [] }, extraProjects: { type: "string[]", default: [] } } }, packages: { type: "object", fields: { extraEntries: { type: "string[]", default: [] }, extraProjects: { type: "string[]", default: [] } } }, root: { type: "object", default: {} } } },
  tsconfig: { type: "object", fields: { types: { type: "string[]", default: [] }, include: { type: "string[]", default: [] }, exclude: { type: "string[]", default: ["node_modules"] }, paths: { type: "object", default: {} } } },
  hooks: { type: "object", fields: { preCommit: { type: "string[]", default: [] } } },
};
