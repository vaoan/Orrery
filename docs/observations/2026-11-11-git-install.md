# Installing Themis from git

Date: 2026-11-11

Measured in an empty directory outside the repository, with Node v24.21.0 and pnpm 11.28.11 (`npx -y pnpm@11`, the major CI uses). The repository is public: no authentication was needed.

Specifier: `github:vaoan/Themis#main&path:/packages/themis`

The first form tried worked, so the fallback `#main&path:packages/themis` was not needed. `packages/themis/package.json` needed no change.

| Step | Result |
|---|---|
| `pnpm add -D "github:vaoan/Themis#main&path:/packages/themis"` | installed `@vaoan/themis 2026.9.9-1`, 735 packages, 10.1s by pnpm (11.3s wall), cold store for most of it |
| `import('@vaoan/themis/eslint')` default export type | `function` |
| `pnpm exec themis --help` | prints usage, exit 0 |
| delete `node_modules`, `pnpm install --frozen-lockfile` | 2.9s by pnpm (4.0s wall) |
| the two checks again | `function`; `themis --help` prints usage |

Findings:

- `package.json` keeps the specifier as written. `pnpm-lock.yaml` pins `main` to a commit (`debfdf1`, the release commit at measurement time) through a `codeload.github.com` tarball with an integrity hash, so a frozen install is reproducible and a body moves to a newer `main` only by re-running `pnpm add` or `pnpm update`.
- The lockfile entry records `path: /packages/themis` and `hasBin: true`.
- `pnpm init` run through `npx pnpm@11` wrote `packageManager: pnpm@12.18.0` and a matching `devEngines` block (taken from the globally installed pnpm), and the next command then failed. A body scaffold must write its own `packageManager`, never inherit one from `pnpm init`. The scratch `package.json` was written by hand without those fields.
