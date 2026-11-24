---
title: 'Make a blanket Bash grant a named exception'
description: 'Scope allowed-tools one skill at a time, with a gate that makes the scoped form the default and the blanket grant something someone has to write down.'
status: 'accepted'
date: '2026-07-29'
---

# ADR-0017 — Make a blanket Bash grant a named exception

## Context

[ADR-0005](/adr/0005-keep-allowed-tools-as-pre-approval) established that `allowed-tools` is **pre-approval, not restriction**, and drew the consequence: "Scope the grant. `allowed-tools: Bash(git:*) Bash(gh:*) Read` pre-approves what a skill actually does, rather than a blanket `Bash`." The frontmatter contract in `skills/README.md` has required the scoped form ever since.

Nothing followed. All nineteen skills went on declaring a bare `Bash`, and `skills/README.md` recorded the gap as a known deviation — "`allowed-tools` content is unsettled per skill" — because rewriting nineteen tool lists in one pass would be a large diff built on guesses about what each skill actually drives.

That left the repo's own written contract violated nineteen times, in the one place where the violation has a security shape rather than a cosmetic one: a skill with blanket `Bash` runs any command unattended without a prompt, which is exactly what ADR-0005 said the scoping — not the field's presence — was there to prevent. And the deviation note was self-perpetuating: a new skill's author copies a neighbour, inherits the blanket grant, and adds a twentieth violation without ever making a decision.

## Decision

**Keep migrating one skill at a time, but invert which form is the default.** A blanket `Bash` is no longer what a skill gets by saying nothing; it is an entry someone has to add to a named list, with the reason it cannot be scoped. `test/allowed-tools.test.ts` holds that list and pins it in **both** directions:

- a skill granting bare `Bash` that is **not** on the list fails — so a new skill inherits the scoped form;
- a skill on the list that **no longer** grants bare `Bash` fails — so the list can only shrink, and scoping a skill forces its entry out.

**A write the skill's own confirmation step already gates is pre-approved; a write that reaches the forge or the remote asks.** That is the rule the remaining migrations followed. So the grant and the guardrail say the same thing, and the single prompt a run stops on is the one a person was going to be asked about anyway. How it is applied — the `gh api` case, the narrowest covering prefix, a flag as anchor, cache bookkeeping — is the `allowed-tools` entry of the [frontmatter contract](https://github.com/TitusKirch/skills/blob/main/skills/README.md). A rule headed by a command that can execute another is refused outright: [ADR-0043](/adr/0043-refuse-a-grant-headed-by-an-exec-capable-command).

**Not every entry is a migration backlog.** With the migration finished, every reason left on that list is permanent, and each entry records which — as a **named kind** it claims rather than as free text, so the set of kinds is pinned in both directions alongside the roster (a kind nothing claims fails; so does a skill claiming one that is not named). The kinds, each with why no narrowing exists, are enumerated once, in [the test](https://github.com/TitusKirch/skills/blob/main/test/allowed-tools.test.ts).

Rejected: **rewriting all nineteen in one pass**, for the reason `skills/README.md` already gave — what each skill needs is a per-skill judgement, and a sweep would encode nineteen guesses at once. Rejected: **leaving it as a documented deviation**, which is the state that produced nineteen violations and would produce the twentieth. Rejected: **counting instead of naming** (an assertion that N skills are scoped), which ratchets a number without recording a single reason and passes just as well when the wrong skill is scoped.

## Consequences

The contract and the catalogue now agree by construction rather than by intention. The gap is closed: every skill that can be scoped is, one skill drives nothing and so declares no `Bash` at all, and each skill still granting a blanket one carries a reason that is permanent rather than pending. **The counts are deliberately not written here.** An earlier draft of this paragraph gave two, and both were stale within the migration that produced them — a number in prose is the half of this record nothing reads, which is the same defect the decision above exists to remove from `skills/README.md`. `test/allowed-tools.test.ts` holds the roster and the kinds of reason instead, pinned in both directions. What the list guards from here is the next skill, which inherits the scoped form instead of a neighbour's blanket grant.

The cost is a list to maintain, and it is real — the same two-copies-of-one-fact shape [ADR-0009](/adr/0009-enforce-the-agents-md-mirror-in-the-gate) and `test/conformance-gate.test.ts` already carry. It is bounded the same way: the list is pinned to the catalogue in both directions, so it cannot drift, only shrink.

Scoping a skill costs a permission prompt wherever the scoped list is wrong or incomplete. That is the correct failure mode and the reason the migration ran through human-attended skills only — a prompt is an inconvenience there and a hang in an unattended loop, which is why the two queue skills are on the permanent side of the list rather than in the migration. Resolving the config is the prompt every scoped skill now pays: it runs through `sh`, so it asks once per run.
