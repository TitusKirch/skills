---
title: '{The work, in a few words}'
status: '{in-progress | blocked}'
created: '{YYYY-MM-DD}'
updated: '{YYYY-MM-DD}'
branch: '{the branch the work is pushed on — omit this field entirely if it was never pushed}'
issue: '{tracker ref, e.g. 44 or ENG-123 — omit if there is none}'
---

# Handoff {NNNN} — {The work, in a few words}

<!-- The reader has none of your session. No "the file we looked at", no "as discussed",
     no "the failing test from earlier" — name paths, symbols, commands and shas outright.
     Committed file: no secrets, no tokens, no env values. No agent names, no signatures. -->

## Goal

{What the work is, and what "done" looks like. Concrete enough that someone can tell whether they have finished. The one thing that must survive even a rushed handoff.}

## Context

{What you gathered so the next agent doesn't gather it again — the files that matter and what's in them, the constraints, the decisions already taken and why.

Dead ends belong here and are the most valuable thing on the page: what you tried, and the reason it failed. Without them the next agent spends your hours again to reach your conclusion.}

## Progress

{What is done, what is half-done, what is committed and pushed vs. still sitting in the tree. State it against the branch in the frontmatter — "pushed through {sha}, the {x} migration is written but unrun".

Nothing uncommitted? Say so. Work that was never pushed? Say that too, plainly — the next agent cannot see this machine.}

## Next steps

{Ordered, actionable — the next thing to type, not a topic to consider.}

1. {…}
2. {…}

## Open questions

{What needs a human — a decision, an answer, an access you don't have. These are for the user to answer, not for the resuming agent to settle by fiat. If the status is `blocked`, what blocks it goes here.

None? Write "None."}
