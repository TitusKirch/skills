---
name: handoff
metadata:
  summary: Hands off in-progress work to another agent or session via a committed handoff document.
description: Hands in-progress work from one agent or session to another through a structured handoff document committed to the repo under `.agents/handoffs/`, and resumes an existing handoff by its number. Captures goal, context gathered, progress, next steps and open questions in a document that assumes none of the writer's session, so the work can continue in a fresh session or on another machine. The resuming agent deletes the handoff once the work is finished — not when it reads it. Use when the user wants to hand off, park or pause work for another agent or session, to write or read a handoff, to continue handed-off work, or says things like "hand this off", "write a handoff", "continue handoff 0003", "resume the handoff", "übergib das", "fahre das fort".
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
---

# handoff

Move **in-progress work** from one agent to the next — a different session, a different machine, a different day — through a **structured document committed to the repo**. Two directions, one skill: **write** a handoff, or **resume** one.

The document is the whole product. It is written for a reader who has **none of the writer's session** — no scrollback, no open files, no memory of what was already tried. A handoff that only makes sense to the agent that wrote it has failed at the one job it has.

## Workflow

### 1. Route

| Situation                                                             | Action                       |
| :-------------------------------------------------------------------- | :--------------------------- |
| Work is in flight and must be parked or passed on                     | **Write** — steps 2–5        |
| A handoff exists and the user wants to continue it (`0003`, "resume") | **Resume** — steps 6–8       |
| Work was resumed but is unfinished and is being parked again          | **Update in place** — step 9 |

### 2. Make the work reachable — before writing anything

A handoff is committed **so another machine can pick it up**. That promise is only kept if the _work_ travels too, not just the note about it.

- **Uncommitted work is unreachable.** Commit it (via `atomic-commit`) and push the branch. Work in progress that is not yet coherent goes in one honest `wip` commit — the resumer needs the code more than it needs a tidy history.
- **Nothing to commit** is a fine answer — say so in the document (`Progress` records "nothing uncommitted").
- **Cannot push** (no remote, offline, work that must not leave the machine) → still write the handoff, but state it plainly under `Progress` and drop the `branch` field. A handoff describing work that exists nowhere but this disk is a **local note**, and must not claim otherwise.

### 3. Allocate the id

Handoffs live in **`.agents/handoffs/`**, named `NNNN-lower-kebab-case.md` (`0001-refactor-auth-layer.md`).

**The next id is one above the highest ever used — read from git history, not the folder.** Handoffs are deleted when their work completes, so the folder is a poor witness; history is the only one that remembers `0003` existed. Ids are never reused, renumbered or gap-filled. Recipe: [REFERENCE.md](REFERENCE.md#id-allocation).

### 4. Write the document

Copy [`templates/handoff.md`](templates/handoff.md) and fill every section. Frontmatter carries the machine-readable fields (`title`, `status`, `created`, `updated`, `branch`, `issue`); the body carries the prose, in fixed H2s: `Goal`, `Context`, `Progress`, `Next steps`, `Open questions`. Full contract: [REFERENCE.md](REFERENCE.md#document-contract).

Write it **self-contained**:

- **No deixis.** No "the file we looked at", "as discussed", "the failing test from earlier". Name paths, symbols, commands, issue numbers and commit shas outright.
- **Dead ends are the most valuable content.** What was tried and did not work saves the resumer from spending the same hours. Record it under `Context`, with the reason it failed.
- **Next steps are actionable and ordered** — the next thing to type, not a topic to consider.
- **No secrets.** The file is committed. Never paste tokens, keys, credentials or `.env` values into it; reference where they live instead.
- **No attribution.** No agent or model name, no session url, no "handed off by". The document says what the work is, never who typed it — see [Guardrails](#guardrails).

### 5. Commit the handoff

Commit the new file via `atomic-commit` and push. Until it is pushed, the handoff has not happened. Report the id, the path and the branch.

**`atomic-commit` is optional** — here and at step 2. Not installed, commit directly in the repo's own Conventional Commits conventions and push as usual. A handoff that never lands because a helper skill is absent is the one failure this step cannot afford.

### 6. Find the handoff to resume

| Input                      | Action                                                                        |
| :------------------------- | :---------------------------------------------------------------------------- |
| An explicit id (`0003`)    | Open `.agents/handoffs/0003-*.md`. No match → say so, list what exists, stop. |
| No id, exactly one handoff | That one. Unambiguous, so no question needed — name it in the report.         |
| No id, several handoffs    | **List them and ask.** Never guess.                                           |
| No id, none at all         | Say so and stop.                                                              |

**Never resolve a handoff by recency.** "The latest" is a guess with a plausible-looking answer, and picking the wrong thread of work is the one failure a handoff cannot recover from. Two files sharing an id (a real race) → report the ambiguity, do not pick.

### 7. Restore the ground, then work

Read the document **fully** before touching anything. Then `git fetch`, check out the `branch` it names, and confirm the tree matches what `Progress` describes — if it does not, say so before working; the document is the writer's snapshot, and the branch may have moved since.

Then do the work: `Goal` is the target, `Next steps` is the running order, `Context` is what you do not need to rediscover. `Open questions` are for the **human** — put them to the user rather than answering them by fiat.

**Do not delete the handoff now.** Reading it is not consuming it.

### 8. Delete the handoff when the work is done

The file is deleted **in the same commit that finishes the work** — not on read, not on resume, not on the first green test.

A handoff deleted on read exists nowhere the moment the resuming session crashes — which is precisely the situation it was written to survive. Its lifetime is the work's lifetime: it lives while the work is unfinished and disappears with the last commit that finishes it. Nothing else in the repo records that it ever existed, and nothing needs to.

### 9. Unfinished? Update in place

Resumed work that is being parked again **updates the existing document** — same id, same file. Refresh `Progress`, `Next steps`, `updated`, and `branch` if it changed; fold what you learned into `Context`. Never open a second handoff for the same thread of work: one thread, one id, until it is done.

## Guardrails

- **Reachable or honest.** Never write a handoff that implies work is available elsewhere when it was never pushed ([step 2](#2-make-the-work-reachable--before-writing-anything)).
- **`atomic-commit` is optional, never a precondition.** It is the preferred way to commit the work and the handoff, but if it is not installed, commit in the repo's own conventions and push anyway — a missing helper must not be why the handoff fails to land.
- **Self-contained or worthless.** The reader has none of your session. Every reference is resolvable from the document alone.
- **Delete on done, never on read** ([step 8](#8-delete-the-handoff-when-the-work-is-done)). The file survives every intermediate failure, by design.
- **Never guess which handoff** ([step 6](#6-find-the-handoff-to-resume)). Explicit id, or the single unambiguous one, or ask.
- **Ids are permanent and never reused** — even though the files are not ([REFERENCE.md](REFERENCE.md#id-allocation)).
- **Attribution-free.** No agent or model name, no `Generated with`/🤖 line, no session url, in the document, the commit, or anything this skill writes. The frontmatter has no author field on purpose — a handoff is a note to the next worker, not a signed artifact, and the next worker gains nothing from knowing which tool typed it.
- **Secret-free.** The document is committed. Scan what you paste into `Context` — logs, env dumps and config excerpts are where secrets get in.
- **A handoff is not an ADR.** Same `NNNN-title.md` shape, opposite lifecycle — an ADR (`write-docs`) is a permanent record that must never be deleted; a handoff is working state that is consumed and removed. Never file a decision as a handoff, and never let a handoff's deletion take a decision's record with it — if the work settled something architectural, that belongs in an ADR before the handoff goes ([REFERENCE.md](REFERENCE.md#relationship-to-the-siblings)).

## Reference

The folder and naming contract, id allocation, the document contract, the status vocabulary, the resume rules, the relationship to the sibling skills, and the reasoning behind it all: [REFERENCE.md](REFERENCE.md).
