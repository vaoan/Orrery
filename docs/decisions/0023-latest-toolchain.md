# ADR 0023 — The latest stable toolchain, read from each repository's own files

**Date:** 2026-11-12
**Status:** accepted

## Decision

Themis and every body run the latest stable version of their toolchain that passes all
of CI: the package manager, the runtime, the frameworks and every dependency. Any pin
below the latest is an exception, recorded below (or in the body's own record) with its
reason, its evidence and the version it waits for. An exception ends when what it waits
for ships; the next change that touches the dependency lifts it.

The toolchain is read from the repository's own files, never from a workflow:

- **pnpm** from `package.json` `packageManager` (an exact version). `pnpm/action-setup`
  runs with no `version:` and reads it.
- **Node** from `package.json` `engines.node`, the current LTS major as a range (`^26`).
  `actions/setup-node` reads it through `node-version-file: package.json`. One file for
  both, so a body states its toolchain in the one place it already keeps.

Themis's own workflows and `body-ci.yml` follow it; in `body-ci.yml` the files are the
body's. A body with no `packageManager` fails at setup (`pnpm/action-setup` throws "No
pnpm version is specified"). A body with no `engines.node` does not fail: setup-node warns
"Could not determine node version" and falls back to the runner's preinstalled Node, so
`engines.node` is required by this record and by the fixture's test, not by CI. The fixture
`fixtures/next-supabase-mono` carries both, at Themis's values.

Local development needs Node 26 too: on Node 24, pnpm only warns about `engines.node`, and
the suite is measured on 26.

"Latest" means the newest release pnpm accepts: pnpm 12 refuses a version younger than
its minimum release age (a supply-chain check, `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`),
so a version published in the last day waits a day. Nobody adds
`minimumReleaseAgeExclude` to get one sooner.

The owner, 2026-11-12, after the starter's first PR went red: "siempre apunta a usar lo
más actual. Ese es el punto de Themis y Vulkan. Ser los que marcan a los otros pero estar
seguros que todo sirve." And, on how the red happened: "cambiar el orden de cómo se
hacen las cosas para que no pase de nuevo".

## Why

Vulkan's first PR (vaoan/Vulkan#1) failed at setup in every job: `body-ci.yml` passed
`version: 11` to `pnpm/action-setup` while the body's `packageManager` named
`pnpm@11.28.11`, and the action refuses two versions (`ERR_PNPM_BAD_PM_VERSION`). A
workflow that names a version can only disagree with the body; one that reads the body
cannot. The same PR also failed `themis references .`, a check added to `body-ci.yml`
that a body without a root `CLAUDE.md` cannot pass. Both are the same mistake in order:
something was demanded of a body before anything a body is made from could meet it.

So the order changes: a check added to `body-ci.yml` lands together with what the
fixture and the starter need to pass it. `packages/themis/tests/fresh-body.test.mjs`
classifies all of body-ci, and Themis's own CI goes red first when something is new:

- the job ids must be exactly `test` and the five pull-request jobs; a new job fails
  until it is classified;
- in `test`, every `run:` step is either one that needs the body's own install (`pnpm
  install`, `lint`, `typecheck`, `test`) or a `pnpm themis` command, and each `pnpm
  themis` step runs against the fixture and must pass; any `uses:` step other than
  checkout, pnpm setup and Node setup fails, and supabase is allowed only behind the
  `database` input;
- each pull-request job must be exactly setup, install and its own `themis ci` verb.
  Those need a pull request's context, so they are not run against the fixture; Themis's
  own `ci.yml` runs the same verbs on every Themis PR.

What it does not guarantee: that the body's own `lint`, `typecheck` and `test` pass. Those
depend on the body's install; the fixture is required to have the scripts, and
bundle-honesty lints the fixture with the class config.

The template's `.husky/pre-commit` is removed until `themis hook pre-commit` exists, so
lint-staged on pre-commit is not enforced in bodies until then (ADR 0018, Amendments).

## Measured 2026-11-12

`npm view <pkg> version` and `nodejs.org/dist/index.json`:

| Tool | Latest stable | Themis runs |
|---|---|---|
| pnpm | 12.18.0 | 12.18.0 (`packageManager`) |
| Node | 26.13.1 (LTS "Lithium"; 27.0.0 is an alpha) | `^26` (`engines.node`); the suite passed locally on 26.13.1 |
| Next.js | 16.4.6 | (bodies) |
| React | 19.3.1 | (bodies) |
| TypeScript | 7.0.2 | 6.0.3, exception 1 |
| ESLint | 10.14.0 | 9.39.5, exception 2 |
| vitest | 5.1.0 | 5.1.0 |
| actions/checkout, actions/setup-node, pnpm/action-setup, supabase/setup-cli | v7, v7, v6, v3 | the same majors |

Every other dependency of `packages/themis` moved to its latest, majors included
(eslint-plugin-boundaries 7, eslint-plugin-jsdoc 65, jscpd 5, lint-staged 17,
secretlint 13, stylelint 18, stylelint-config-standard 41, syncpack 15). The full suite
(`pnpm test`, the bundle-honesty and observe tests included) passed with pnpm 12.18.0
on Node 26.13.1, and `pnpm install --frozen-lockfile` passed on a clean tree.

## Exceptions

1. **TypeScript 6.0.3, waits for typescript-eslint to accept TypeScript 7.**
   `typescript-eslint@8.72.2` (the latest) declares `typescript: ">=4.8.4 <6.1.0"`.
   The class's lint config parses through it, so TypeScript 7 would leave every body's
   lint on an unsupported parser.
2. **ESLint 9.39.5, waits for eslint-plugin-react, eslint-plugin-import and
   eslint-plugin-jsx-a11y to support ESLint 10.** Their latest releases (7.37.5, 2.32.0,
   6.10.2) declare `eslint` up to `^9` only. Measured with ESLint 10.14.0: 9 tests fail,
   among them `TypeError: Error while loading rule 'react/display-name':
   contextOrFilename.getFilename is not a function`. pnpm marks eslint 9.39.5 deprecated.
3. **eslint-plugin-unicorn 64.0.0, waits for exception 2 and a ruling.** 66 and later
   declare `eslint: ">=10.4"`. 65.0.1 accepts ESLint 9 but removed the `ignoreDates`
   option of `unicorn/expiring-todo-comments`, which the ruling in `rulings.json` sets,
   so every config load fails (`Unexpected property "ignoreDates"`). Moving needs a
   ruling amendment with its own record, not a version bump.
4. **Known, not new:** `@eslint/js@10.0.1` declares `eslint: ^10`, and
   `eslint-plugin-tsdoc@0.5.4` (the latest) depends on `@typescript-eslint/*@8.56.1`,
   which declares `typescript: <6.0.0`. Both were unmet before this record
   (`pnpm peers check`); both close with exceptions 1 and 2.

## Consequences

- A body moves pnpm or Node by editing its own `package.json`; Themis's workflows never
  change for it. Vulkan's `packageManager` and `engines.node` move to Themis's values.
- `pnpm/setup` (pnpm's newer single action for pnpm and Node) was not adopted:
  `pnpm/action-setup` v6 supports pnpm 12, and `actions/setup-node` already reads
  `engines.node`.
- `body-ci.yml`'s header, the template's `ci.yml` and the caller job id implied by
  `bodyCheckPrefix` (`ci / ` gives `ci`) are tested to agree.
