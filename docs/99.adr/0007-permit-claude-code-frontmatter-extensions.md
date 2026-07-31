---
title: 'Permit Claude Code frontmatter extensions, at a stated cost'
description: 'Fifteen of Claude Code’s seventeen fields break spec conformance; they are allowed where the loss is optimisation, not capability.'
status: 'accepted'
date: '2026-07-25'
---

# ADR-0007 — Permit Claude Code frontmatter extensions, at a stated cost

## Context

Claude Code defines seventeen frontmatter fields. Two of them — `name` and `description` — are in the Agent Skills standard; the other fifteen are not, and the standard's validator rejects every one of them as `Unexpected fields in frontmatter`. Verified directly: a probe skill carrying `argument-hint`, `when_to_use`, `model`, `effort`, `paths`, `context` and `agent` fails validation on all seven at once.

Codex answers the same problem differently. Its frontmatter is `name` and `description` only, and its extensions — UI metadata, invocation policy, tool dependencies — live in a separate `agents/openai.yaml` beside the `SKILL.md`, leaving the skill file conformant. Two major clients, opposite designs; non-portability is Claude Code's choice, not a property of extending.

This repo publishes on the claim "installable in Claude Code, Cursor, Windsurf and friends", so every extension spends something real.

## Decision

Claude Code extensions are **permitted where they earn their place**, and the frontmatter contract marks every field as `[standard]`, `[Claude Code]` or `[house]` so an author can tell portable from Claude-only at a glance.

The test is what a conformant client loses when it ignores the field:

- **Optimisation only** — `model`, `effort`, `paths`, `argument-hint`, `context`/`agent`. The skill still works elsewhere, just untuned. Acceptable.
- **Capability or safety** — `disallowed-tools` is in use on the two queue skills, where an unanswered `AskUserQuestion` would hang an unattended drain. A safety property is worth the cost.
- **Never** — `when_to_use`, despite being the tempting one. It would move trigger phrases out of `description`, and `description` is the only thing a portable client reads. It relieves the 1024-character pressure by making the skill trigger _worse_ everywhere except Claude Code.

## Consequences

`skills-ref` reports the two queue skills as failing, and always will. `validate-skills` re-tiers exactly that line to "client extension, non-portable" — a portability statement, not a defect. Any CI gate must carry the same rule or it is red on day one.

The re-tiering depends on a list of known extension names. That list must be complete before a new extension is adopted, or the repo's own validator will call a deliberate field malformed.

## Amendments

### 2026-07-31 — the cost is per client, not a single number

The decision above stands; two of the facts it prices have moved, and this addendum records them without touching what it says.

**`paths` and `disable-model-invocation` are not Claude-only.** Cursor defines both in its own `SKILL.md` frontmatter, under the same names with the same semantics ([its reference](https://cursor.com/docs/skills)). For those two the cost test's answer is not "still works elsewhere, just untuned" — in Cursor the field is honoured as written, and nothing is lost at all. The three tiers survive unchanged; what changes is that the price is read **per client** rather than as a single number, and that convergence between clients is a real category rather than a hypothetical.

**So the tag becomes a client list.** The Decision's `[Claude Code]` gives way to the clients that define the field — `[Claude Code, Cursor]` where both do, `[Claude Code]` where only one does. A fourth tag alongside `[standard]` / `[Claude Code]` / `[house]` would leave the reader still asking _which_ clients, and keeping the singular tag on a shared field asserts something false about portability: an author reading `[Claude Code]` on `paths` trades away portability they never lost.

**The claim in the Context has changed wording.** It quotes "installable in Claude Code, Cursor, Windsurf and friends"; the README now reads Claude Code, Codex, Cursor and OpenCode (18c35c2). The reasoning is unaffected — every extension still spends something real — but the audience it is spent on is the one named there now, and OpenCode is the client that ignores unknown fields and loads the skill anyway.

Where the per-field detail lives: [ADR-0015](0015-tier-an-extension-by-the-clients-that-define-it.md) keys the re-tiering on a field → clients matrix and names `validate-skills`' `REFERENCE.md` as its single home. This addendum **refines, it does not supersede** — a reversal would have been a new record.
