---
title: 'Tier an extension by the clients that define it'
description: 'A non-standard field is not automatically Claude-only, and extending need not cost conformance — so the validator holds a client matrix, not a Claude Code list.'
status: 'accepted'
date: '2026-07-29'
---

# ADR-0015 — Tier an extension by the clients that define it

## Context

[ADR-0007](0007-permit-claude-code-frontmatter-extensions.md) permitted Claude Code frontmatter extensions at a stated cost and closed on the consequence that made this record necessary:

> The re-tiering depends on a list of known extension names. That list must be complete before a new extension is adopted, or the repo's own validator will call a deliberate field malformed.

It was not complete. `validate-skills` named six keys where Claude Code documents seventeen fields, so `argument-hint` — the obvious next adoption, since several skills take arguments and none advertises it — would have been reported as a spec violation the day it was added, and the CI gate built on that list ([ADR-0012](0012-let-the-review-establish-green.md)'s green) would have gone red for a deliberate choice.

Completing the list would have fixed that and left a second defect standing, which only showed up once the other clients were read. **A one-client list does not merely under-report; it mis-reports.** Cursor defines `paths` and `disable-model-invocation` in its own `SKILL.md` frontmatter, with the same names and the same semantics Claude Code gives them. Filing those as "Claude Code extension, will not load elsewhere" — ADR-0007's cost framing — states something untrue about two fields, and an author reading that verdict trades away portability they never lost.

And the framing has a further blind spot. Codex solves the same problem the opposite way: its frontmatter is `name` and `description` only, and its extensions live in a sidecar at `<skill>/agents/openai.yaml`, which the standard permits outright. Non-portability is Claude Code's design choice, not a property of extending — ADR-0007 said as much in its context and then wrote a cost model that could not express it. OpenCode adds the last piece: it defines no fields and ignores unknown ones, so a Claude-extended skill still loads there.

## Decision

The re-tiering rule is keyed on a **matrix of field → the clients that define it**, not a list of field names, and the finding **names the clients**.

- **The matrix lives once**, in `validate-skills`' `REFERENCE.md`. The skill's own `SKILL.md` gives examples and points at it; `scripts/check-conformance.sh` mirrors it; `test/conformance-gate.test.ts` pins the mirror to the source key-for-key **and client-for-client**. Prose that re-types the list is the copy that goes stale, which is what happened here.
- **Four clients are covered** — Claude Code, Codex, Cursor, OpenCode: the ones this repo publishes for and the only ones that currently differ. Gemini CLI and GitHub Copilot were checked and left out; both follow agentskills.io and document no frontmatter of their own, so tiering them would change no verdict.
- **A Codex sidecar is in no violation tier.** Present, it is reported as a fact; absent, as a client not targeted. Never as a fault.
- **Non-portability is reported as a range**, not a verdict: a conformant validator **rejects** the skill, OpenCode **ignores** the field and loads it anyway, the defining clients **honour** it.

Two corrections to ADR-0007 that this record carries, in the manner of [ADR-0013](0013-state-what-the-authority-table-guarantees.md) — the decision stands, its stated reasoning is amended:

- Its **cost framing** — "Claude-only", "will not load elsewhere" — is right for the Claude-only rows and wrong for `paths` and `disable-model-invocation`, which Cursor shares. The trade is per field, not per client.
- Its **count** is off by one. It reads "seventeen fields, two of them standard, the other fifteen are not", which files `allowed-tools` among the extensions; `allowed-tools` is one of the standard six (Experimental, but on `skills-ref`'s allowlist), so Claude Code contributes **fourteen** re-tiered keys. Cursor's legacy `globs` is the fifteenth row, which is why the matrix has fifteen and the coincidence is not the ADR's fifteen.

## Consequences

Adopting a client extension is now a two-step change: add the row to the matrix, then use the field. The gate enforces the order — a field used but unlisted fails conformance, and a row added to the skill but not the script fails `pnpm test`. That is the ordering ADR-0007 asked for, made mechanical.

A finding is longer than it was, because it carries which clients honour the field and, where one exists, the portable alternative. That is the intended trade: the validator is the map of what is available across clients, so adopting a field is an informed decision rather than a discovery made when something breaks.

The matrix goes stale as clients ship fields, and nothing here detects that — the pin keeps the two copies honest with each other, not with upstream documentation. Re-reading the four references is a periodic human job, and the record of when it was last done is this ADR's date.
