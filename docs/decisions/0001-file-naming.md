# ADR 0001 — kebab-case filenames, constellation-wide

**Date:** 2026-09-06
**Status:** accepted
**Supersedes:** libra's `.claude/rules/naming-conventions.md` file-naming table

## The disagreement

The two donor repositories held different, internally coherent conventions.

| | aeleos | libra |
|---|---|---|
| Convention | kebab-case, always | filename matches the exported symbol |
| Compliance with strict kebab | 173 of 173 | 281 of 677 in `src` |
| ls-lint rule | `kebab-case` | `kebab-case \| regex camelCase \| regex PascalCase` |
| Paths covered | explicit (`apps/hub/src`) | globs (`apps/*/src`) |

libra's convention was documented, not accidental. Its
`naming-conventions.md` specifies PascalCase components (`LoginForm.tsx`),
camelCase hooks (`useAuth.ts`), camelCase utilities (`formatDate.ts`),
PascalCase services (`AuthService.ts`) and repositories (`UserRepository.ts`),
with a stated exception for shadcn/ui files. The 396 non-kebab files in `src`
were 244 PascalCase and 152 camelCase, with **zero** falling outside those two
forms — a convention held consistently, not drift.

## Considered

**Keep both, parameterised.** Physics would enforce only "a convention is
declared and enforced"; each body picks one. Zero migration cost. Rejected —
see the deciding argument below.

**libra's convention as physics, aeleos migrates.** Far cheaper (173 files) and
matches React ecosystem norms. Rejected for the same reason.

**Strict kebab everywhere, libra migrates.** Chosen.

## The deciding argument

libra's documented convention **cannot be enforced by a linter.** Its ls-lint
rule is:

```
.ts: kebab-case | regex:^[a-z][a-zA-Z0-9]*$ | regex:^[A-Z][A-Za-z0-9]*$
```

That accepts all three forms in every location. A utility named `FormatDate.ts`
passes lint while violating the documented rule. The convention was aspirational
and the enforcement was permissive — the gap between them is exactly where drift
accumulates.

kebab-case is the only one of the two where the rule and its enforcement are the
same artifact. A rule a linter cannot hold is not a rule.

Secondary advantages, none decisive alone: no per-file classification (a utility
that grows into a component never needs renaming); no acronym bikeshedding
(`ai-data`, not `useAIData` vs `useAiData`); no exception list, so the shadcn/ui
exception disappears — those files are already lowercase and become compliant by
default; and uniform directories alongside Next.js's own mandated lowercase
`page.tsx`, `layout.tsx`, `route.ts`.

## What was weighed against it

The strongest argument for kebab-case is immunity to case-sensitivity bugs —
code that works on case-insensitive Windows and breaks on case-sensitive Linux
CI or in Docker. That argument was **already neutralised in libra**, which sets
`forceConsistentCasingInFileNames: true` in `tsconfig.base.json` and runs
`ubuntu-latest`. It is not what decided this.

Notably, **aeleos does not set that option.** The repo with the safer convention
had the weaker guard. It goes into physics regardless of convention.

## Consequences

- libra renames 694 files: 396 in `apps/*/src` and `packages/*/src`, 298 in
  `apps/*/tests`, `apps/*/test`, `packages/*/tests`, and `apps/*/e2e`.
- Six of those are case-only renames (`Button.tsx` -> `button.tsx`) requiring a
  two-step `git mv`, because `core.ignorecase` is `true` in this repo.
- aeleos renames nothing.
- ls-lint coverage extends to `apps/*/tests`, `apps/*/test`, and
  `packages/*/tests` — currently unlinted, and where 298 of the violations
  accumulated unobserved.
- `unicorn/filename-case`, presently `"off"` at `libra/eslint.config.mjs:916`,
  becomes `["error", { case: "kebabCase" }]`. `eslint-plugin-unicorn` is already
  a dependency of both repos.
- libra's `naming-conventions.md` file-naming table is rewritten; its
  symbol-casing guidance for identifiers (variables, functions, constants,
  enum-like objects) is unaffected and retained.

Full migration procedure:
`libra/docs/superpowers/specs/2026-09-06-kebab-migration-design.md`.
