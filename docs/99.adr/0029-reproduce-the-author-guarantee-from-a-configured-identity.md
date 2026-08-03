---
title: 'Reproduce the author guarantee from a configured identity'
description: 'merge-deps drives GitLab too, with its select-by-author guarantee re-established rather than ported: one configured identity, matched on an immutable id, in a key that can only narrow.'
status: 'accepted'
date: '2026-08-03'
---

# ADR-0029 — Reproduce the author guarantee from a configured identity

## Context

`merge-deps` selects the pull requests it may touch **strictly by author**, and that selection is its central safety guarantee: no human's request and no other bot's request is ever seen, let alone merged. [ADR-0028](0028-dock-gitlab-and-resolve-the-host-per-repo.md) docked GitLab on the forge axis and deliberately left this skill out, alongside `release`, on the grounds that both had unresolved questions of their own.

The unresolved question here was specific. The guarantee rests on a fact that holds only on GitHub: **`app/dependabot` is a constant.** GitHub runs the bot, so the login is identical in every repo on the forge, which is why the skill names it outright and why its REFERENCE records that selection is deliberately **not** a config key — a `mergeDeps.selector` could only ever let a repo _widen_ the one constraint that must not widen.

On GitLab there is no constant to name:

- **The counterpart is Renovate.** GitLab runs it for its own projects and it is the de-facto standard there. `dependabot-gitlab` exists and would have reused every artifact the skill already reads, but it is alpha and self-hosted.
- **There is no hosted identity to pin.** Mend's hosted GitLab app is offline indefinitely, so Renovate on GitLab is always self-run. Its author is either a dedicated user holding a personal access token or the internal bot user GitLab mints for a project or group access token — a per-repo, per-instance fact, and structurally indistinguishable from a person on the API.

So the choice was between leaving the skill GitHub-only — the route [ADR-0028](0028-dock-gitlab-and-resolve-the-host-per-repo.md) recorded and the one `release` still takes — and finding a form of the guarantee that survives the identity becoming configurable.

## Decision

**The guarantee is reproduced, not ported, and `merge-deps` drives both forges.** The GitLab identity comes from `mergeDeps.gitlab.bot` — `{id, login}`, the same shape `trustedBots` already specifies — and three properties, holding together, are what keep a configured identity strictly **narrower** than a constant:

- **It names an identity, never a selector _type_.** There is no branch-prefix key, no label key, no `selector`. A repo may say _which_ account; it may not say _how_ authorship is decided, because "how" is the axis along which `label:dependencies` becomes writable by any contributor.
- **It names exactly one.** An object, not an array. A list would be an allowlist, and an allowlist of authors is a queue that grows by editing config — which is what `trustedBots` is _for_, and precisely why this key is not that.
- **The match is on the immutable id.** `login` exists so the entry is readable and so `glab mr list --author` can narrow cheaply; the assertion made before touching any merge request reads `author.id`. An id/login disagreement is the rename signal: report it, never silently trust it.

**No identity configured under `forge: gitlab` is a stop, not an empty queue.** An empty queue reads as a healthy run, which is the one wrong way to fail here. The stop is a **runtime** rule rather than a schema constraint: a profile fragment must stay valid on its own, and a `forge: gitlab` repo need not use this skill at all.

**Three places where GitLab does not mirror GitHub are answered in the skill rather than smoothed over.** The hand-back on conflict is Renovate's own `<!-- rebase-check -->` checkbox — GitLab's native `/rebase` rewrites history and regenerates **nothing**, which is the lockfile hand-editing the skill forbids itself, arrived at through a button. Security advisories are an **Ultimate-only** feature, so their absence is reported as a tier statement rather than as an error, and never as zero. And the bump level is read from Renovate's own artifacts, with the rule that **the highest bump in a request sets its tier** — Dependabot's declared groups could not carry a major, and Renovate's presets routinely do.

**The merge method keeps coming from the forge, at whatever level the forge binds it.** GitHub binds `allowed_merge_methods` to a branch ruleset, read per request; GitLab binds `merge_method` and `squash_option` to the project, read once per run. Same refusal to hardcode, and the same refusal to make it a config key — the forge already knows the answer.

## Consequences

**ADR-0028's clause is now half-superseded.** `release` stays GitHub-only for the reasons recorded there; `merge-deps` does not. The `<skills-forge>` roster gains it — six carriers, not five — and `test/isolation.test.ts` pins that, so the two cannot drift apart silently.

**The precedent is narrow on purpose.** "A safety-critical constant may become a config key" is not the lesson; "a key that can only narrow is not a weakening" is. The three properties above are what make it checkable, and a future skill reaching for this shape has to reproduce all three rather than cite the outcome.

**One config key is now load-bearing in a way none of the others is.** Every other `mergeDeps` key has a default and degrades to report-only when wrong. This one has no default, and getting it _wrong_ — a valid id belonging to somebody else — is not caught by anything: the skill would faithfully triage that account's requests. The mitigations are the readable `login` beside it and the rename signal, both of which surface a **disagreement**; neither can see a key that was wrong from the start. That is the same class of exposure `forgeHost` carries, and it is answered the same way — the identity is named in the plan, so the one reader who can spot it is shown it.

**The queue's author is now a section, not a sentence.** It had lived as one line in Decisions because there was nothing to decide; it is now the place both forges' selection is argued from, and the place a third forge would have to satisfy.
