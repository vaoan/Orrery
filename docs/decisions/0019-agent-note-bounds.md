# ADR 0019 — an agent note is bounded, and the gate that obliges it says so

**Date:** 2026-09-14
**Status:** accepted
**Applies to:** every body carrying `CLAUDE.md` / `AGENTS.md` directory notes
**Evidence:** aeleos, measured 2026-09-11 to 2026-09-12 on branch `drop-target-legibility`

Hand-written. Not a `orrery reconcile` output — the two donor repositories did
not disagree about this. Neither had noticed it.

## The finding

aeleos runs `check:agent-notes`, which fails when a file changes under a
directory note and the note does not. ADR 0015 already records it, ruled as a
per-body parameter under `hooks.preCommit`. What nothing recorded is that the
gate has **no bound on what it obliges**, and that this is not theoretical.

`apps/hub/src/features/actors/CLAUDE.md` reached **7,770 lines / 491,828
bytes**. Its own opening paragraph instructs a reader to re-read it whole
before finishing. Measured consequences, on one branch:

| | |
|---|---|
| Floor under every task in that feature | ~170,000 tokens, before any work |
| Agents killed outright by it | 1 (context exhausted mid-task) |
| Tasks forced to append without reading | 7 of 8 |
| Stale forward-references that produced | 2, found by the closing task |
| Claims found contradicting the code | 1 (`"nothing in the canvas changes size while a drag is in progress"`, after a task deliberately reversed it) |

## Why this is a gate defect rather than a note defect

**The gate checks that the note CHANGED, not that anyone read it.** An append
satisfies it. So past a certain size the gate collects its full cost and
delivers none of its benefit: the note grows, nobody can read it, everybody
appends, and the stale sentences the gate exists to prevent accumulate inside
the very file it is protecting.

That is the trap worth naming for every body. A per-**symbol** freshness gate —
aeleos's `check:docs`, which compares an exported symbol against its own
TSDoc — is **self-limiting by construction**: a symbol's documentation can only
ever be as large as that symbol deserves. A per-**directory** gate has no such
bound, and will grow until somebody measures it.

`check:docs` did not bite once across the same branch. `check:agent-notes` bit
every task.

## The ruling

**A directory note is bounded, and a body that carries one prunes it as
routine maintenance rather than under pressure.**

Two mechanisms, both proven on aeleos:

1. **Split by directory, not by topic.** The gate resolves the **nearest** note
   by walking up from a changed file's directory and deliberately does not fall
   through — so several notes in one directory achieve nothing, while a note
   per layer absorbs that layer's churn. aeleos went from one 7,770-line note
   to 474 / 1,547 / 472 / 3,237 lines across root, `domain/`, `application/`
   and `presentation/`. Verified lossless by a sorted-line-multiset diff:
   **0 deletions**.

2. **Separate the record from the constraint.** A directory note's stated
   purpose is to constrain what comes NEXT; git and the specs hold what
   happened. aeleos's note was 48 dated headings out of 86, several titled
   `— done` or `Task N of 9`. Those moved to a sibling `HISTORY.md`, which the
   gate ignores because it looks only for `CLAUDE.md` / `AGENTS.md` — so the
   account stays one directory away while ceasing to be an obligation.

   **A whole-section move is lossy on its own**, because standing rules hide
   inside narrative. 14 imperatives had to be lifted back into the live note
   with pointers. Judge conservatively: a duplicated rule costs a line, a lost
   one costs what the discipline exists to buy.

3. **Warn before it becomes a restructure.** A body's note gate should report
   when a note passes a size threshold — aeleos is adopting ~40KB. Pruning at
   40KB is an afternoon; at 492KB it is a 7,770-line restructure with a
   verification burden. Nothing currently tells a body which side of that line
   it is on.

## What this does not settle

**Whether the threshold is constellation-wide or per body.** aeleos is the only
body with layered feature notes today; libra, puck, eclipse-con and janus each
carry a single root note well under any threshold. Reconciling the number is
work for the phase that distributes shared configuration, not something to fix
by decree before any other body has the shape.

**A second aeleos gate from the same week is a candidate for its own ADR and is
deliberately not decided here:** `check:line-endings`, which asks
`git ls-files --eol` rather than scanning bytes, after the obvious hand check
(`grep -c $'\r'`) was found to report a file's line count in that repository's
shell. Orrery already sets `* text=auto eol=lf`, so it is a backstop rather
than a mechanism — worth its own ruling rather than a footnote to this one.
