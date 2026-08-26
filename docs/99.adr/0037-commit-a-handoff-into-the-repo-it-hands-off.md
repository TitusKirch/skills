---
title: 'Commit a handoff into the repo it hands off'
description: 'What was settled for handoff: the document is committed because its reader is on another machine, ids come from git history because the files are deleted, and nothing in the frame invites an agent to sign its work.'
status: 'accepted'
date: '2026-08-26'
---

# ADR-0037 — Commit a handoff into the repo it hands off

## Context

`handoff` hands in-progress work from one agent or session to another through a document under `.agents/handoffs/`. The issue that specified it left most of its shape open and asked for research into an existing convention. Relocated from the skill's `REFERENCE.md` under [ADR-0031](0031-keep-rationale-as-repo-memory.md); every part of it that steers what the skill does now lives in the skill's own mechanics as a rule.

## Decision

- **`.agents/handoffs/` follows no standard — it is a choice, made knowing that.** The research was done and it came back negative. **`AGENTS.md`** is the one genuinely settled cross-tool convention, but it is a _file of instructions_, not a folder of working state — different artifact, no guidance here. **`.agent/`** (singular) is an open proposal with no maintainer consensus. **`.agents/`** (plural) is a community **draft** whose scope is explicitly **configuration**, and explicitly **not** session or handoff state. So nothing in the ecosystem covers this, and `.agents/handoffs/` borrows a plausible-looking neighbour's name rather than complying with anything. Recorded as a preference, not as standards-alignment: a later folder rename is cheap — handoffs are transient, so at any moment there is almost nothing to move — while a false claim of convention-following is not, because it would silently become the reason nobody revisits it.
- **Committed, not local.** The decisive constraint, and the one that is not up for debate: the point is to continue the work **on another machine or remotely**, and anything outside the repo is invisible to them. Everything awkward downstream — the push precondition, secret discipline, handoff files in code review — is a cost this buys, not a flaw to fix.
- **The push precondition follows from that.** Committing the _note_ while leaving the _work_ on one laptop keeps the letter of "committed" and breaks its entire purpose. So the work is pushed first, or the document says outright that it was not.
- **No config section.** Nothing about a handoff genuinely varies per repo. The folder is a fleet convention, and a `handoff.dir` key would let each repo diverge on the one thing every other machine has to guess right — defeating the convention it configures. The escape hatch is also unnecessary: because handoffs are transient, changing the convention fleet-wide is nearly free, which is exactly the property a config key would exist to buy. Adding a section later is additive; removing one is a break.
- **Ids come from git history, not the folder.** Falls directly out of delete-on-done: a folder of live handoffs has forgotten every completed one, and `max(ls) + 1` would hand out `0001` again the day the queue empties. Ids are permanent references — a human's "continue 0003", a commit message — so reuse makes an old reference resolve to new work. Gaps are the sequence working. Rejected: a counter file (`.agents/handoffs/.next`), which is one more committed thing to conflict on, and which git history already tells us for free.
- **Resume never guesses.** Explicit id, or the single unambiguous handoff, or ask. Rejected: "the latest" — recency is a guess that always produces a confident-looking answer, and resuming the wrong thread of work is unrecoverable in a way that asking one question never is.
- **Status has two values and no `done`.** The file's existence _is_ the liveness, so `done` could only describe a file that should already be gone — modelling it would legitimise the stale handoff. `blocked` stays because a blocked handoff is otherwise indistinguishable from a live one until the reader is four paragraphs in.
- **Prose in the body, machine fields in the frontmatter** — the same split as an ADR's frontmatter (`write-docs`), for the same reason: `Goal` / `Context` / `Progress` are prose and belong where they read; `status` / `branch` / `updated` are looked _up_.
- **No author, agent or model field.** A handoff is a note to the next worker, and which tool typed it changes nothing about what the next worker does. The field would exist purely to be signed — and a _template_ that invites an agent to sign its work would propagate that habit into every repo that installs this skill. The omission is the point, not an oversight.

## Consequences

Committing the document is the constraint the rest follows from: the push precondition, the secret discipline and handoff files turning up in code review are all costs it buys rather than flaws to fix.

The research came back negative, and recording that as a **preference** rather than as standards-alignment is deliberate. A false claim of following a convention is what would stop anyone revisiting the folder name later; the rename itself is nearly free, because handoffs are transient and at any moment there is almost nothing to move.
