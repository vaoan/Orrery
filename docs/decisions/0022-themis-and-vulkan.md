# ADR 0022 — Orrery is renamed Themis, and the starter is Vulkan

**Date:** 2026-11-11
**Status:** accepted

## Decision

This repository, its package and its command are renamed: `vaoan/Orrery` becomes
`vaoan/Themis`, `@vaoan/orrery` becomes `@vaoan/themis`, the `orrery` command becomes
`themis`, a body's `orrery.config.mjs` becomes `themis.config.mjs`, and `ORRERY_*`
variables become `THEMIS_*`. The starter planned in ADR 0021, first called `nebula`, is
`vaoan/Vulkan`.

The owner, 2026-11-11, on the starter: "es un printer así que deberíamos buscar un
nombre que sea como algo de la creación. Aunque creo que orrery no tiene sentido
tampoco." From names put to them they chose Vulkan, the god of the forge, and Themis,
the Titan of divine law and order, and asked for "Themis y Vulkan" capitalised. Package
and command names stay lowercase because npm and pnpm require it.

## Consequences

- Every reference was renamed, dated records included, at the owner's request
  ("cambies todo con las nuevas referencias"). Before this record, the repository was
  Orrery; a record that reads "Themis" for an earlier date means the same thing.
- No body installed the package yet, so nothing outside this repository breaks.
  GitHub redirects the old repository name.
- The local checkout moves from `~/Documents/GitHub/Orrery` to
  `~/Documents/GitHub/Themis`.
