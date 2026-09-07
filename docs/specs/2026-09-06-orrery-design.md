# Orrery — constellation governance

**Status:** approved design, not yet implemented
**Date:** 2026-09-06

An orrery is a clockwork model of a solar system: brass gears showing how every
body moves, sitting on a table *outside* the system it describes. This repository
is that model. It governs how every project in the constellation is built, and it
contains no application code.

## Why this exists

Five live repositories share a stack and a toolchain, and they have drifted.
Measured on 2026-09-06 across `aeleos` and `libra`:

| Signal | State |
|---|---|
| Shared config files | 5 of 7 diverged (`jscpd`, `ls-lint`, `syncpack`, `cspell`, prettier) |
| prettier | Identical content, different filename (`.prettierrc.json` vs `.prettierrc`) |
| eslint | 850 vs 1,854 lines; 13 of ~18 plugins in common |
| Guard scripts | 70 total, 3 sharing a filename; both repos independently grew the same class of `check-*.mjs` enforcers |
| AI documents | libra: 31 rules (~9,000 lines), 38 skills, 7 MCP servers. aeleos: none of it, plus a 3,312-line monolithic `CLAUDE.md` |
| Claude plugins | aeleos enables 9, libra enables 2 |
| husky `pre-commit` | First 12 lines byte-identical, including a shared comment, then diverging |

Nothing here was carelessness. Both repos solved the same problems well and
independently, which is the definition of a missing shared layer.

## Decisions

| # | Decision | Rationale |
|---|---|---|
| 1 | Repos stay separate | Existing CI, Vercel targets, and Supabase projects keep working |
| 2 | Locked config with a declared escape hatch | Consistency by default; per-repo difference stays possible but visible |
| 3 | Three tiers: physics / class / local | Four of five bodies are the same archetype; the middle tier stops that overlap from being re-solved or wrongly universalised |
| 4 | Its own repo, not inside aeleos | See "Why not aeleos" |
| 5 | Governs and maps; contains no app code | The registry describes bodies, it does not hold them |
| 6 | Two delivery channels: npm + Claude plugin | Each asset ships through the mechanism its consumer already understands |
| 7 | Both repos are donors | aeleos and libra each hold assets the other lacks |
| 8 | kebab-case filenames, constellation-wide | It is the only convention the linter can actually enforce (ADR 0001) |

### Why not aeleos

aeleos is the centre of the *runtime* constellation: it owns the authoritative
`actors` table, every consuming app keeps a mirror, and `person_actor_ref`
derives identity through UUIDv5 over a fixed namespace so one human is one
identity platform-wide. That makes it the star. It does not make it the right
home for build-time governance:

- **It could not pin itself.** Every other body pins a version; aeleos would
  always track `main`, and `orrery check` inside aeleos would compare aeleos
  against aeleos — structurally incapable of failing.
- **Release cadences conflict.** An identity provider whose UUIDv5 namespace
  "forks every person's identity" if changed should release slowly. Tooling
  releases constantly. Coupling them makes each hostage to the other.
- **Access surface.** Five bodies' CI tokens would need read access to the
  identity provider's migrations and `security definer` RPCs in order to fetch
  lint rules.
- **Blast radius.** A broken aeleos `main` would stop every body from linting.
- **No boundary against leakage.** With no repo boundary, promoting an
  aeleos-specific rule into the universal tier is a one-file move that nobody
  reviews. Over a year the universal tier fills with one project's opinions.
  A separate repo makes promotion an explicit, reviewable pull request.

## Architecture

### Two channels

Content lives in a package. Repositories keep only **pointer files** — small
files containing a path and no policy. Pointers are written once at `orrery init`
and are untouched by version bumps, so ongoing synchronisation effectively
disappears.

**Channel 1 — npm (`@vaoan/orrery`)**

| Asset | Left in the body |
|---|---|
| eslint rules, and the 13 shared plugins as transitive dependencies | `eslint.config.mjs`, 3 lines |
| tsconfig base | one `extends` line |
| prettier | one key in `package.json` |
| stylelint, cspell, knip, syncpack, lint-staged, vitest | 1–3 line pointer each |
| ls-lint, jscpd (no `extends` support) | nothing — `orrery check` wraps them and resolves config internally |
| guard scripts | nothing — package bins |
| husky `pre-commit` | one line: `pnpm orrery hook pre-commit` |
| CI | ~10-line caller using a reusable workflow |

Two consequences worth stating: the 13 eslint plugins leave every body's
`devDependencies` entirely, and because their versions are pinned in one place,
cross-repo `syncpack`/`sherif` mismatches stop being possible by construction.

ls-lint and jscpd are wrapped rather than pointed at by path because pnpm's
isolated `node_modules` makes hardcoded `node_modules/@vaoan/...` paths fragile —
libra sets `node-linker=hoisted`, aeleos does not.

**Channel 2 — Claude Code plugin**

orrery is also a plugin marketplace (`.claude-plugin/marketplace.json` plus
`.claude-plugin/plugin.json`). Bodies enable it through the `enabledPlugins` key
in a checked-in `.claude/settings.json` — a mechanism both repos already use.

| Asset | Today | Via plugin |
|---|---|---|
| 38 skills | libra only | every body, zero files |
| agents, commands | libra only | every body, zero files |
| 7 custom MCP servers | `.claude/tools/*.mjs` + `.mcp.json` | shipped with the plugin |
| 31 rule files | markdown links from `CLAUDE.md` | converted to skills |

Converting rules to skills is an upgrade rather than a move. Today those 9,000
lines are reachable only if Claude chooses to follow a markdown link. As skills
they are discovered by description and loaded on demand.

### Layout

```
vaoan/orrery
├── .claude-plugin/              marketplace.json + plugin.json
├── registry.json                the constellation map
│
├── packages/orrery/             ─── CHANNEL 1 · npm · @vaoan/orrery ───
│   ├── bin/                     orrery init | check | promote | hook | status
│   ├── physics/                                                    tier 1
│   │   ├── eslint.mjs           the 13 shared plugins + their rules
│   │   ├── prettier.json  secretlint.json  ls-lint.yml  syncpack.js  lint-staged.mjs
│   │   └── checks/              check-source-bytes, check-doc-freshness, sync-secrets
│   └── classes/next-supabase-mono/                                 tier 2
│       ├── eslint.mjs           next/typescript, react-hooks, tanstack-query
│       ├── tsconfig.json  jscpd.json  cspell.json  knip.ts  stylelint.mjs  vitest.mjs
│       └── checks/              check-css-sync, check-a11y-patterns, check-feature-boundaries
│
├── plugin/                      ─── CHANNEL 2 · Claude Code ───
│   ├── skills/
│   │   ├── physics/             solid-principles, dry, kiss, testing, naming,
│   │   │                        git-workflow, git-safety, commit-policy, portability,
│   │   │                        no-hardcoding, single-source-of-truth,
│   │   │                        code-review-standards, mcp-first, mcp-standards,
│   │   │                        + the 38 existing skills
│   │   └── next-supabase-mono/  tailwind, storybook, component-patterns,
│   │                            css-consistency, url-state, e2e-selectors,
│   │                            architecture, monorepo-architecture
│   ├── agents/  commands/  hooks/
│   └── mcp/                     git, github-unified, linear, logrocket, slack, vercel x2
│
├── docs/decisions/              reconciliation log
└── .github/workflows/
    ├── consumer-matrix.yml      every body's lint, run against a candidate version
    ├── release.yml              bumps package.json + marketplace.json together, or fails
    └── reusable-ci.yml          bodies `uses:` this
```

The tier is an **export path**, not a directory to copy from:
`@vaoan/orrery/eslint/physics` versus `/eslint/next-supabase-mono`.

A body's entire footprint:

```
aeleos/
├── package.json          "@vaoan/orrery": "^1.0.0"  +  "prettier": "@vaoan/orrery/prettier"
├── eslint.config.mjs     3 lines
├── eslint.local.mjs      jsdoc, tsdoc, eslint-config-prettier   <- freely edited
├── tsconfig.json         one extends
├── .claude/settings.json enabledPlugins: { "orrery@vaoan-orrery": true }
├── CLAUDE.md             genuinely project-specific
└── .claude/skills/       identity-namespace, actor-mirror, phase-0-gate   <- tier 3
```

### The boundary rule

Anything in `physics/` must be true for a repository that does not exist yet. If
justifying a rule requires naming a specific project, it belongs in a class or
stays local. This is the check that keeps the universal tier honest.

### Parameterised physics

Some policy is shared while its data is not. syncpack is the clean case: both
repos express the same two rules — workspace packages are reached by protocol,
and peer dependencies in packages may float wider than apps pin — differing only
in which dependencies each names.

Config entrypoints are therefore **functions taking local data**, not static JSON:

```js
// @vaoan/orrery/physics/syncpack.js
export default ({ workspacePackages, floatingPeers }) => ({ /* the policy */ })

// aeleos/syncpack.config.js — pointer plus local data, no policy
import syncpack from '@vaoan/orrery/syncpack'
export default syncpack({
  workspacePackages: ['@aeleos/identity'],
  floatingPeers: ['@supabase/supabase-js'],
})
```

## The registry

```jsonc
{ "bodies": {
    "aeleos":      { "repo": "vaoan/AeleOS",      "role": "star",   "class": "next-supabase-mono" },
    "libra":       { "repo": "vaoan/libra",       "role": "planet", "class": "next-supabase-mono" },
    "puck":        { "repo": "vaoan/Puck",        "role": "planet", "class": "next-supabase-mono" },
    "eclipse-con": { "repo": "vaoan/eclipse-con", "role": "planet", "class": "next-supabase-mono" },
    "janus":       { "repo": "vaoan/Janus",       "role": "planet", "class": "next-supabase-mono" }
}}
```

There is deliberately **no version field**. Each body pins its own version in its
`package.json`; `orrery status` reads them live. A stored version would go stale
the moment a body upgraded — a second drift problem invented to solve the first.

## CI, in three directions

| Direction | Runs | Where |
|---|---|---|
| **Validate** (down) | `orrery check` — pointers intact, no policy inlined, overrides only in declared extension points | every body's CI and pre-commit |
| **Reference** (up) | **consumer matrix** — for each body in the registry: checkout, install with the candidate version overridden in, run lint and typecheck | orrery's CI, every PR |
| **Create** | `orrery init --class next-supabase-mono` — writes the pointers, adds the dependency and plugin, opens a PR adding the body to the registry | once per new repo |

The consumer matrix is what makes this safe rather than dangerous. Without it,
tightening one rule breaks five repos and is discovered one repo at a time.

A fourth verb keeps orrery from going stale. `orrery promote <path> --to physics`
opens a pull request against orrery, lifting a locally-proven rule into the
shared tier. Because it is a PR to a different repository, it is exactly the
review boundary that prevents one project's opinions from quietly becoming
everyone's.

## Reconciliation

Both repositories donate. Disagreements sort into four kinds:

**A · Free.** Identical content, different packaging. prettier is
`{"endOfLine": "auto"}` in both. cspell's header (`version`, `language`,
`allowCompoundWords`) is byte-identical. secretlint already matches. husky's
first 12 lines match. Lift as-is.

**B · Superset.** One is strictly richer. libra's jscpd contains everything
aeleos has plus Next.js boilerplate exclusions, config files, `e2e/`, and
generated types; likewise cspell's `ignorePaths`. libra wins; aeleos gains
coverage it lacked.

**C · Parameterised.** Same policy, different data — see syncpack above.

**D · Ruling required.** File naming was the only one. Resolved in ADR 0001.

### eslint reconciliation needs a tool

Thirteen shared plugins does not imply thirteen shared rule configurations.
Diffing 2,704 lines by hand is where this project would quietly die. Instead,
`eslint --print-config <file>` emits the fully resolved effective config; running
it on a comparable file in each repo and diffing the JSON yields an exact
rule-by-rule list: rules both agree on (physics), rules only one has an opinion
about (adopt), and rules in active conflict (ruling needed).

`orrery diff-eslint` is therefore the **first thing built**, because it sizes
everything else.

### Decision log

`docs/decisions/` holds one short entry per conflict: what disagreed, who won,
why. aeleos already carries a 1,090-line section titled *"The toolchain, and the
rules it cost"*, which demonstrates the record is considered worth keeping. It
needs a home that is not one project's `CLAUDE.md`. Those 1,090 lines, plus
aeleos's 1,000-line `## Conventions`, are themselves a donation source and are
mined into skills during extraction.

## Versioning and rollout

One repo, one tag. `release.yml` bumps `packages/orrery/package.json` and
`.claude-plugin/marketplace.json` in the same commit and **fails the release if
they disagree** — this is what stops the two channels from recreating the drift
problem one level up.

| Level | Meaning here |
|---|---|
| **major** | A rule that can fail code which currently passes. Any tightening. |
| **minor** | New class, new skill, new opt-in capability, new relaxation. |
| **patch** | Fixes, documentation, non-behavioural changes. |

**Grace mechanism.** Without one, every new rule is a major version and rollout
becomes a negotiation. A new rule lands at `warn` in one minor and is promoted to
`error` in the next. Bodies stay green while violations are visible, and
`orrery status` reports who still has outstanding warnings so promotion is
informed rather than a surprise.

Rollout is a Renovate pull request per body, routine precisely because the
consumer matrix already ran that version against every body before publication.

## Testing orrery

Governance tooling that breaks five repos at once is worse than none.

- **Fixture repo** — a minimal `next-supabase-mono` skeleton committed here.
  `orrery init` scaffolds it; `orrery check`, `lint`, and `typecheck` must pass.
  Runs in seconds; catches most CLI regressions.
- **Consumer matrix** — the integration test, against the five real bodies.
- **Plugin validation** — every skill has frontmatter with a non-empty
  `description`; no broken cross-references; `plugin.json` and
  `marketplace.json` parse and agree.
- **Version-parity test** — npm version equals marketplace version. This one
  protects the whole two-channel design.
- **Codemod tests** — fixtures covering barrel re-exports, case-only renames, and
  dynamic imports, since the codemod runs against 694 real files.

## Phases

**Phase 0 — libra kebab-case migration.** 694 renames across 11 workspaces, one
PR each, plus three enforcement layers. Specified separately in
`libra/docs/superpowers/specs/2026-09-06-kebab-migration-design.md`. Runs first so
that a large mechanical diff never entangles with the extraction, and so orrery
is seeded from repositories that already agree.

**Phase 1 — aeleos alignment.** Add `forceConsistentCasingInFileNames` (aeleos
lacks it). Zero renames; aeleos is already fully compliant.

**Phase 2 — extraction.** Build `orrery diff-eslint`, reconcile, populate
`physics/` and `classes/next-supabase-mono/`, convert 31 rules to skills, move
the 38 skills and 7 MCP servers into the plugin, write the decision log.

**Phase 3 — adoption.** `orrery init` against aeleos and libra, then the
remaining three bodies. Consumer matrix goes live.

## Open questions

None blocking. Two to revisit during Phase 2:

1. Whether `classes/node-lib` is needed yet, or should wait for a body that
   actually requires it. Default: wait — YAGNI.
2. Whether the 38 existing skills all belong in `physics`, or some are
   class-scoped. Resolved per-skill during extraction using the boundary rule.
