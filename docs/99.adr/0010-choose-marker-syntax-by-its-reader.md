---
title: 'Choose marker syntax by its reader'
description: 'An element where a model must follow the block, an HTML comment where a machine replaces a region.'
status: 'accepted'
date: '2026-07-27'
---

# ADR-0010 — Choose marker syntax by its reader

## Context

Three families of marker are in use, and `scripts/gen-skills.ts` reads all of them:

| Marker                                          | Lives in                              |
| :---------------------------------------------- | :------------------------------------ |
| `<skills-config>` … `</skills-config>`          | a skill's `SKILL.md` / `REFERENCE.md` |
| `<!-- skills:start -->` … `<!-- skills:end -->` | `README.md`                           |
| `<!-- config:body -->`                          | `scripts/config-block.md`             |

Each was justified where it was introduced — the element in `skills/README.md`, the README markers in the generator — but the rule that decides between them was never written down. So the question reopens whole every time a new mirrored block is proposed, and the honest answer to "why not comments everywhere?" was, until now, a matter of recall.

The two styles are not a house invention on either side. Laravel Boost writes a `<laravel-boost-guidelines>` element into `CLAUDE.md` and `AGENTS.md`; doctoc and all-contributors have fenced generated regions with HTML comments for a decade. Both conventions are live, and picking one wholesale would break something.

## Decision

**The syntax follows the reader.**

- **A named element, where a model must read the block and act on it.** A comment says "metadata, skip me" to every reader. For a block whose body _is_ instruction — the config contract, the author-authority rule — that is the wrong signal. `skills/README.md` states the same reason from the other side: a boundary hidden in a comment is one the model may skip.
- **An HTML comment, where a machine replaces a region in a rendered document.** The README's table is generated, not instruction; nobody should read between those markers as a rule to follow, and a visible tag would sit in the middle of the rendered page.
- **An HTML comment in the `scripts/` sources too**, for a third reason: the marker is deliberately excluded from what gets mirrored. `configBody()` slices from _after_ it, so the marker never reaches the copy.

Rejected: **comments everywhere**, which hides instruction text behind a signal that invites skipping it — the failure the element exists to prevent. Rejected: **elements everywhere**, which puts a tag in the rendered README and would carry the source-file markers into all sixteen mirrored copies.

## Consequences

A new mirrored block — for the preview-then-confirm promise, or the work-loop lock spec — has its answer without reopening the question.

The element stays **attribute-free**. A `version=` or `source=` would name files the installed skill does not have, which is the same mistake as linking out of the folder.

The rule scopes to markers `gen-skills.ts` reads. Ordinary Markdown, and comments written for a human reader, are untouched.

The accepted cost is two syntaxes in one repo. Without this record that reads as inconsistency, and the obvious "fix" — unifying on one — silently breaks whichever side it is not.
