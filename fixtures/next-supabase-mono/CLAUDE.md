# Fixture

The stand-in for a fresh `next-supabase-mono` body. Themis's own tests run body-ci's
offline checks against it, so it carries what a new body must have on its first PR.

## Commands

- `pnpm lint`, `pnpm typecheck`, `pnpm test`: what body-ci runs first.
- `pnpm themis references .` and `pnpm themis skills .`: the instruction checks.

## Layout

- `apps/web/`: the web app.
- `packages/core/`: shared code.

## Rules

Lint, tsconfig, prettier, hooks and CI come from `@vaoan/themis` through the pointer
files at the root. This body's own rules will be path-scoped, one file per area:
`.claude/rules/` does not exist yet. <!-- themis: example -->
