# handoff — Reference

Mechanics for the [`handoff`](SKILL.md) skill. No backend, no forge, no tracker — a handoff is a **file in the repo**, and git is the only mechanism it needs.

## Principle

> **The document is the interface.** Its reader has none of the writer's session, so everything the work depends on is either in the document or lost. Its lifetime is the work's lifetime — created while the work is unfinished, deleted by the commit that finishes it.

## Config

**None.** `handoff` owns no section in `.tituskirch-skills.json`; it reads only the shared root `language` (the document's prose language). Precedent: [`update-deps`](../update-deps/SKILL.md) owns no section either — see [Decisions](#decisions) for why the folder is deliberately not a config key.

## Folder

Handoffs live in **`.agents/handoffs/`** — repo root, flat, no subfolders.

- **Tracked and committed.** Not gitignored, not `~/`-local, not a scratch dir. The point of a handoff is to be picked up **on another machine or remotely**, and anything outside the repo is invisible to them. This is the decisive constraint; everything else about the folder is negotiable.
- **Never scaffolded empty.** The folder appears with the first handoff and legitimately disappears with the last one — an empty `.agents/handoffs/` means the same thing as no folder at all.
- This follows **no cross-tool standard**, because none exists for handoff state. See [Decisions](#decisions).

## File schema

`NNNN-lower-kebab-case.md` — 4-digit zero-padded id, **hyphen**, kebab slug (`0001-refactor-auth-layer.md`). The H1 is `Handoff {NNNN} — {title}`.

The slug names the work, not the moment (`0004-flaky-payment-tests`, not `0004-tuesday-handoff`). Same shape as an [ADR](../write-docs/REFERENCE.md#file-schema), deliberately — and a completely different lifecycle ([below](#relationship-to-the-siblings)).

### Id allocation

**Next id = highest ever used + 1**, read from **git history**, not the working tree.

Handoffs are deleted when their work lands, so at any moment the folder holds only the live ones — `ls` sees `0007` and nothing else, and would happily hand out `0001` again. History is the only witness that remembers the rest.

```bash
# Highest handoff id ever added on any branch, live files included
{ git log --all --diff-filter=A --name-only --pretty=format: -- '.agents/handoffs/*.md'
  ls .agents/handoffs/ 2>/dev/null
} | sed -n 's|.*/||; s|^\([0-9]\{4\}\)-.*\.md$|\1|p' | sort -n | tail -1
```

Empty output → the repo's first handoff → `0001`. Otherwise `printf '%04d' $((max + 1))`.

- **Never reused, never renumbered, never gap-filled.** An id is how a human says "continue 0003" and how a commit message or chat log refers back; recycling it makes an old reference silently resolve to different work. Gaps are the normal, healthy state of the sequence — they are the handoffs that did their job.
- **Races are detected, not prevented.** Two agents allocating at once both take the same id, and git will merge both files without conflict (different slugs). There is no lock, and a human-triggered handoff is far too rare to warrant one. Two files sharing an id → [resume reports the ambiguity](SKILL.md#6-find-the-handoff-to-resume) and asks; it never picks.

## Document contract

### Frontmatter

```yaml
---
title: Refactor the auth layer
status: in-progress
created: 2026-07-16
updated: 2026-07-16
branch: feat/auth-layer
issue: 44
---
```

| Field     | Required | Meaning                                                                                                               |
| :-------- | :------- | :-------------------------------------------------------------------------------------------------------------------- |
| `title`   | yes      | The work, in a few words. Mirrors the slug.                                                                           |
| `status`  | yes      | `in-progress` · `blocked` — the whole vocabulary ([below](#status-vocabulary))                                        |
| `created` | yes      | ISO `YYYY-MM-DD`, the day the handoff was written                                                                     |
| `updated` | yes      | ISO `YYYY-MM-DD`, the day it last changed. Equals `created` on a fresh handoff.                                       |
| `branch`  | no       | The branch the work lives on. **Omitted only when the work was never pushed** — and then `Progress` says so outright. |
| `issue`   | no       | Tracker reference (`44`, `ENG-123`) when the work has one. A link, never a lifecycle.                                 |

**There is no author, agent or model field, and there never will be one** — see [Decisions](#decisions).

### Status vocabulary

Two values. That is the entire vocabulary, and it is short for a structural reason:

| Status        | Meaning                                                                |
| :------------ | :--------------------------------------------------------------------- |
| `in-progress` | Work is unfinished and picking it up needs nothing but this document   |
| `blocked`     | Picking it up needs something first — a decision, an answer, an access |

**`done` is unrepresentable, by construction.** A finished handoff is a _deleted_ handoff, so the file's **existence is the status** and a `done` value could only ever describe a file that should not be there. Modelling it would invite exactly the stale, never-cleaned-up handoff the delete-on-done rule exists to prevent.

`blocked` earns its place because it is otherwise invisible: a blocked handoff looks identical to a live one from the outside, and the resumer should learn it is walking into a wall from the frontmatter, not from paragraph four. What blocks it goes under `Open questions`.

### Body

Fixed H2s, in this order. All five are present; an empty one says so rather than vanishing (a missing section is indistinguishable from a forgotten one).

| Section          | Holds                                                                                                            |
| :--------------- | :--------------------------------------------------------------------------------------------------------------- |
| `Goal`           | What the work is and what "done" looks like. The one thing that must survive a bad handoff.                      |
| `Context`        | What was gathered — files, constraints, decisions taken and why, and **dead ends with the reason they failed**.  |
| `Progress`       | What is done, what is in flight, what is committed and pushed, what is uncommitted. State it against the branch. |
| `Next steps`     | Ordered and actionable — the next thing to type, not a topic to consider.                                        |
| `Open questions` | What needs a human. `None.` when there are none.                                                                 |

Template: [`templates/handoff.md`](templates/handoff.md).

**Self-containment is the contract**, and it is what the sections are shaped to force. `Context` exists so the resumer does not re-read the codebase from scratch; `Next steps` exists so it does not re-derive the plan; the dead ends exist so it does not re-spend the hours that produced them. Prose that only resolves inside the writer's session — "the file we looked at", "as discussed", "the failing test from earlier" — voids all three.

## Lifecycle

```text
        write ─────▶ .agents/handoffs/NNNN-slug.md ─────▶ resume ─────▶ work finishes
                            ▲            │                                     │
                            └── update ──┘                                     ▼
                             (parked again, same id)                    file deleted
                                                                   (same commit as the work)
```

| Transition | Rule                                                                                          |
| :--------- | :-------------------------------------------------------------------------------------------- |
| **write**  | Work is pushed (or its absence stated), id allocated from history, document committed         |
| **resume** | Document read in full, branch restored, work continued. **Reading deletes nothing.**          |
| **update** | Unfinished after a resume → same file, same id, refresh `Progress` / `Next steps` / `updated` |
| **delete** | The commit that finishes the work also removes the file                                       |

**Why deletion waits for the work, not the read.** Deleting on read hands the resuming session a fatal single point of failure — the context exists only in that session's memory, and a crash takes it with it. That is the exact scenario the handoff was written to survive, so the handoff must outlive it. Deleting on completion costs one stale-looking file during the work (harmless — `status` and `updated` say what it is) and buys immunity to every intermediate failure.

**Consequence, accepted:** the resumer has to remember. A handoff that was resumed and finished but never deleted becomes a lie in the folder — it describes work that is done. This is the same shape of obligation as [`write-docs`](../write-docs/SKILL.md) updating the ADR decision log in the same change, and it is handled the same way: the deletion is part of the finishing commit, not a follow-up task.

## Relationship to the siblings

| Skill                                         | Relationship                                                                                                                                                                                                                                                                                                                                                                                       |
| :-------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`write-docs`](../write-docs/SKILL.md) (ADRs) | **Same shape, opposite lifecycle.** `NNNN-title.md` both — but an ADR is append-only and permanent, a handoff is consumed and deleted. An ADR answers "why is it like this?" forever; a handoff answers "what were you in the middle of?" until you are no longer. Work that settles an architectural decision writes the ADR **before** the handoff is deleted, or the record dies with the note. |
| [`work-issue`](../work-issue/SKILL.md)        | **Different state, different home.** `work-issue` is resumable because the _tracker label_ holds its state — a handoff is for work with no tracker issue, or for the session context a label cannot hold. They compose rather than overlap — `issue` in the frontmatter links them, and nothing more. A handoff never drives a lifecycle label.                                                    |
| [`atomic-commit`](../atomic-commit/SKILL.md)  | Owns every commit this skill makes — the work in [step 2](SKILL.md#2-make-the-work-reachable--before-writing-anything), the handoff in [step 5](SKILL.md#5-commit-the-handoff), the deletion in [step 8](SKILL.md#8-delete-the-handoff-when-the-work-is-done). One skill owns commits; this one does not hand-roll them.                                                                           |
| `grilling`                                    | **Complementary, no dependency.** `grilling` interrogates a plan _before_ work exists; `handoff` carries work that already exists across a session boundary. They meet at `Open questions` — a resumed handoff's open questions are natural grilling material — but `handoff` never interviews. It records what is known; it does not decide what is not.                                          |

## Decisions

The issue that specified this skill left most of its shape open and asked for research. What was settled, and why:

- **`.agents/handoffs/` follows no standard — it is a choice, made knowing that.** The research was done and it came back negative. **`AGENTS.md`** is the one genuinely settled cross-tool convention, but it is a _file of instructions_, not a folder of working state — different artifact, no guidance here. **`.agent/`** (singular) is an open proposal with no maintainer consensus. **`.agents/`** (plural) is a community **draft** whose scope is explicitly **configuration**, and explicitly **not** session or handoff state. So nothing in the ecosystem covers this, and `.agents/handoffs/` borrows a plausible-looking neighbour's name rather than complying with anything. Recorded as a preference, not as standards-alignment: a later folder rename is cheap — handoffs are transient, so at any moment there is almost nothing to move — while a false claim of convention-following is not, because it would silently become the reason nobody revisits it.
- **Committed, not local.** The decisive constraint, and the one that is not up for debate: the point is to continue the work **on another machine or remotely**, and anything outside the repo is invisible to them. Everything awkward downstream — the push precondition, secret discipline, handoff files in code review — is a cost this buys, not a flaw to fix.
- **The push precondition follows from that.** Committing the _note_ while leaving the _work_ on one laptop keeps the letter of "committed" and breaks its entire purpose. So the work is pushed first, or the document says outright that it was not.
- **No config section.** Nothing about a handoff genuinely varies per repo. The folder is a fleet convention, and a `handoff.dir` key would let each repo diverge on the one thing every other machine has to guess right — defeating the convention it configures. The escape hatch is also unnecessary: because handoffs are transient, changing the convention fleet-wide is nearly free, which is exactly the property a config key would exist to buy. Adding a section later is additive; removing one is a break.
- **Ids come from git history, not the folder.** Falls directly out of delete-on-done: a folder of live handoffs has forgotten every completed one, and `max(ls) + 1` would hand out `0001` again the day the queue empties. Ids are permanent references — a human's "continue 0003", a commit message — so reuse makes an old reference resolve to new work. Gaps are the sequence working. Rejected: a counter file (`.agents/handoffs/.next`), which is one more committed thing to conflict on, and which git history already tells us for free.
- **Resume never guesses.** Explicit id, or the single unambiguous handoff, or ask. Rejected: "the latest" — recency is a guess that always produces a confident-looking answer, and resuming the wrong thread of work is unrecoverable in a way that asking one question never is.
- **Status has two values and no `done`.** The file's existence _is_ the liveness, so `done` could only describe a file that should already be gone — modelling it would legitimise the stale handoff. `blocked` stays because a blocked handoff is otherwise indistinguishable from a live one until the reader is four paragraphs in.
- **Prose in the body, machine fields in the frontmatter** — the same split as an [ADR](../write-docs/REFERENCE.md#frontmatter), for the same reason: `Goal` / `Context` / `Progress` are prose and belong where they read; `status` / `branch` / `updated` are looked _up_.
- **No author, agent or model field.** A handoff is a note to the next worker, and which tool typed it changes nothing about what the next worker does. The field would exist purely to be signed — and a _template_ that invites an agent to sign its work would propagate that habit into every repo that installs this skill. The omission is the point, not an oversight.
