## Summary

<!-- What and why. -->

## Route

Routes are enforced by the `branch-target` check:

- `type/*` → `develop` (squash) — `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `chore`, `revert`
- `hotfix/*` → `main` (squash, title type `fix`), then an automatic back-merge into `develop`
- `release/*` → `main` (merge commit), cut by `orrery release`

Title: `type(scope): subject [GH-n]`, with `[GH-000]` for work with no issue.

## Checklist

- [ ] `pnpm test` passes locally
- [ ] Every ruling I made is recorded where the next reader will find it
