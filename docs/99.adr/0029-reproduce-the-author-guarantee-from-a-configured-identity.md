---
title: 'Reproduce the author guarantee from a configured identity'
description: 'merge-deps drives GitLab too, with its select-by-author guarantee re-established rather than ported: one configured identity, matched on an immutable id, in a key that can only narrow.'
status: 'accepted'
date: '2026-08-03'
---

# ADR-0029 — Reproduce the author guarantee from a configured identity

Partly supersedes [ADR-0028](/adr/0028-dock-gitlab-and-resolve-the-host-per-repo): GitLab as a driver and the host ladder stand; `merge-deps` staying GitHub-only does not.

## Context

`merge-deps` selects the pull requests it may touch **strictly by author**, and that selection is its central safety guarantee: no human's request and no other bot's request is ever seen, let alone merged. [ADR-0028](/adr/0028-dock-gitlab-and-resolve-the-host-per-repo) docked GitLab on the forge axis and deliberately left this skill out, alongside `release`, on the grounds that both had unresolved questions of their own.

The unresolved question here was specific. The guarantee rests on a fact that holds only on GitHub: **`app/dependabot` is a constant.** GitHub runs the bot, so the login is identical in every repo on the forge, which is why the skill names it outright and why its REFERENCE records that selection is deliberately **not** a config key — a `mergeDeps.selector` could only ever let a repo _widen_ the one constraint that must not widen.

On GitLab there is no constant to name:

- **The counterpart is Renovate.** GitLab runs it for its own projects and it is the de-facto standard there. `dependabot-gitlab` exists and would have reused every artifact the skill already reads, but it is alpha and self-hosted.
- **There is no hosted identity to pin.** Why, and what shapes the author takes instead, is in [`merge-deps`' REFERENCE](https://github.com/TitusKirch/skills/blob/main/skills/repo/merge-deps/REFERENCE.md#the-queues-author).

So the choice was between leaving the skill GitHub-only — the route [ADR-0028](/adr/0028-dock-gitlab-and-resolve-the-host-per-repo) recorded and the one `release` still takes — and finding a form of the guarantee that survives the identity becoming configurable.

## Decision

**The guarantee is reproduced, not ported, and `merge-deps` drives both forges.** The GitLab identity comes from `mergeDeps.gitlab.bot`, and three properties, holding together, are what keep a configured identity strictly **narrower** than a constant:

- **It names an identity, never a selector _type_.** There is no branch-prefix key, no label key, no `selector`. A repo may say _which_ account; it may not say _how_ authorship is decided, because "how" is the axis along which `label:dependencies` becomes writable by any contributor.
- **It names exactly one.** An object, not an array. A list would be an allowlist, and an allowlist of authors is a queue that grows by editing config — which is what `trustedBots` is _for_, and precisely why this key is not that.
- **The match is on the immutable id.** `login` exists so the entry is readable and so `glab mr list --author` can narrow cheaply; the assertion made before touching any merge request reads `author.id`. An id/login disagreement is the rename signal: report it, never silently trust it.

**No identity configured under `forge: gitlab` is a stop, not an empty queue.** An empty queue reads as a healthy run, which is the one wrong way to fail here. The stop is a **runtime** rule rather than a schema constraint: a profile fragment must stay valid on its own, and a `forge: gitlab` repo need not use this skill at all.

**Three places where GitLab does not mirror GitHub are answered in the skill rather than smoothed over** — [handing a request back](https://github.com/TitusKirch/skills/blob/main/skills/repo/merge-deps/REFERENCE.md#handing-a-request-back), [security advisories](https://github.com/TitusKirch/skills/blob/main/skills/repo/merge-deps/REFERENCE.md#security-advisories-are-a-tier-not-a-feature) and [the bump level](https://github.com/TitusKirch/skills/blob/main/skills/repo/merge-deps/REFERENCE.md#reading-the-bump-level).

**The merge method keeps coming from the forge, at whatever level the forge binds it** ([recipes](https://github.com/TitusKirch/skills/blob/main/skills/repo/merge-deps/REFERENCE.md#forge--git-recipes)). Same refusal to hardcode, and the same refusal to make it a config key — the forge already knows the answer.

## Consequences

**ADR-0028's clause is now half-superseded.** `release` stays GitHub-only for the reasons recorded there; `merge-deps` does not. [`scripts/forge-block.md`](https://github.com/TitusKirch/skills/blob/main/scripts/forge-block.md) names it among the block's carriers.

**The precedent is narrow on purpose.** "A safety-critical constant may become a config key" is not the lesson; "a key that can only narrow is not a weakening" is. The three properties above are what make it checkable, and a future skill reaching for this shape has to reproduce all three rather than cite the outcome.

**One config key is now load-bearing in a way none of the others is.** Every other `mergeDeps` key has a default and degrades to report-only when wrong. This one has no default, and getting it _wrong_ — a valid id belonging to somebody else — is not caught by anything: the skill would faithfully triage that account's requests. The mitigations are the readable `login` beside it and the rename signal, both of which surface a **disagreement**; neither can see a key that was wrong from the start. That is the same class of exposure `forgeHost` carries, and it is answered the same way — the identity is named in the plan, so the one reader who can spot it is shown it.

**The queue's author is now a section, not a sentence.** It had lived as one line in Decisions because there was nothing to decide; it is now the place both forges' selection is argued from, and the place a third forge would have to satisfy.
