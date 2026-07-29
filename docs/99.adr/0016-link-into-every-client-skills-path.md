---
title: 'Link into every client skills path, always'
description: 'skills:link writes to ~/.claude/skills and ~/.agents/skills unconditionally rather than taking a client argument, because unlink has to clear exactly what link created.'
status: 'accepted'
date: '2026-07-29'
---

# ADR-0016 — Link into every client skills path, always

## Context

`pnpm skills:link` is the install path this repo recommends **for developing on itself** — Option B in the README, the one that makes an edit in the working copy live in the agent immediately. It had a single destination, `~/.claude/skills`, hard-coded as `DEST`. That was exactly right while Claude Code was the only client; the README now names four, and [ADR-0015](0015-tier-an-extension-by-the-clients-that-define-it.md) made those four — Claude Code, Codex, Cursor, OpenCode — the set the repo publishes for.

Against that set, one destination is not a shortfall of three quarters. It is a shortfall of one, unevenly distributed:

| Client      | Reads `~/.claude/skills/`           | Reads `~/.agents/skills/` |
| :---------- | :---------------------------------- | :------------------------ |
| Claude Code | yes — its only user-scope path      | no                        |
| Cursor      | yes, as a legacy compatibility path | yes                       |
| OpenCode    | yes, as a Claude-compatible path    | yes                       |
| Codex       | **no**                              | yes                       |
| Gemini CLI  | no                                  | yes                       |

Two of the four picked the link tree up by accident of their compatibility paths, and **Codex saw nothing at all**. This repo carries `.codex/rules/default.rules` — Codex is used on it — so the recommended way to develop here did not work from one of the clients being developed for. The published path was never affected: `npx skills add` is client-aware and installs for Codex itself, which is what kept the gap invisible.

`~/.agents/skills/` is the vendor-neutral location. Adding it as a second destination covers every client the repo names, plus Gemini CLI, which it does not.

## Decision

`skills:link` writes to **both** destinations on every run, and `skills:unlink` clears both. There is no client argument.

- **The destination list lives once**, as `SKILL_LINK_DESTS` in `scripts/skills-lib.sh`, sourced by both scripts. Two copies of it would be one copy that stops matching, and the failure would be an orphaned link tree nobody cleans up.
- **Every guard runs per destination** — the "is this destination a symlink back into the repo" bail-out, the "this exists and is not ours" skip, and the entry-by-entry linking that keeps `evals/` out of an installed skill ([ADR-0008](0008-keep-eval-fixtures-out-of-the-package.md)). A guard that ran once would protect the first destination and write blind into the second. The repo-symlink check runs over all destinations **before any of them is written**, so a bad one fails the run outright instead of half-linking.
- **`test/link-destinations.test.ts` runs both scripts against a throwaway `HOME`** and asserts the symmetry — both destinations linked, the fixture excluded in both, both cleared, and nothing the scripts did not create removed.

**Why not an argument.** `--client codex` is the obvious alternative and it is the one that breaks `unlink`. Unlink has to remove exactly what link created, which leaves two bad options: remember the choice on disk — new state for a pair of scripts whose whole appeal is having none, and state that goes stale the moment someone links from another checkout — or clear every destination regardless, which makes the argument inconsequential at exactly the moment it matters. Unconditional linking makes unlink deterministic and stateless, and the cost is a symlink tree in a directory the user's other agents were going to read anyway.

**Why not each client's native path.** `.cursor/skills/`, `~/.config/opencode/skills/` and the rest are more destinations to keep in sync, for clients that already read `~/.agents/skills/`. The vendor-neutral path exists precisely so this does not have to be a per-client list.

## Consequences

A skill under development is live in every installed client at once, which is what makes cross-client behaviour — the thing [ADR-0015](0015-tier-an-extension-by-the-clients-that-define-it.md) tiers findings by — testable rather than theoretical. It also means a broken skill is broken everywhere at once; that is the same trade the single destination already made, now with a wider blast radius.

`~/.agents/skills/` is created on a machine that may not have wanted it. It is the documented user-scope path for four agents, so this is a directory those agents would read, not one invented here.

A new destination is now a one-line change in `scripts/skills-lib.sh`, and the tests follow it automatically because they read that list rather than restating it. What they cannot detect is a client changing where it reads — the same upstream-drift limit [ADR-0015](0015-tier-an-extension-by-the-clients-that-define-it.md) records for the extension matrix, and the same answer: re-reading the clients' documentation is a periodic human job, and this ADR's date is the record of when it was last done.
