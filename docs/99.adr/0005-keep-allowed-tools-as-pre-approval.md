---
title: 'Keep allowed-tools, as pre-approval rather than restriction'
description: 'The field grants permission; it never narrows the toolset — which is the opposite of how it was documented.'
status: 'accepted'
date: '2026-07-25'
---

# ADR-0005 — Keep allowed-tools, as pre-approval rather than restriction

## Context

Every skill in this repo carried `allowed-tools`, and the frontmatter contract described it as "restrict the skill to a subset of tools. Omit to inherit the caller's toolset." That description was written in the repo's first commit and inherited by every skill since.

It is backwards. The Agent Skills specification defines the field as a "space-separated string of **pre-approved** tools the skill may use"; Claude Code as "tools Claude can use **without asking permission** during the turn that invokes this skill". Neither narrows anything — every tool stays callable. The wording in the contract closely matches the **subagent** `tools` field ("Inherits every tool available to subagents if omitted"), which is a restriction, suggesting the two were conflated at the time.

So the repo believed it was constraining eighteen skills while it was in fact granting them blanket `Bash` without a prompt.

## Decision

**Keep the field, correct the description.** Every skill here drives `git`, `gh` and `pnpm`; without pre-approval an unattended `/loop` run stalls on the first permission prompt, which is precisely what the field exists to prevent.

Two things follow:

- **Scope the grant.** `allowed-tools: Bash(git:*) Bash(gh:*) Read` pre-approves what a skill actually does, rather than a blanket `Bash`. This mirrors how `.claude/settings.json` already writes its rules.
- **Real boundaries use `disallowed-tools`** — the field that removes a tool from the pool. See ADR-0007 for the portability cost that carries.

Rejected: **dropping the field**, which would make the unattended loops unusable. Rejected: **treating it as a boundary and relying on it for safety**, which is what the wrong description implied and would have been a false guarantee.

## Consequences

The grant is real and now stated as such: a skill with `Bash` pre-approved can run any command without asking, so the scoping is the actual safety measure, not the field's presence.

`.claude/settings.json` remains the durable control — `allowed-tools` clears at the next message, deny rules do not. Where the two disagree, deny wins.
