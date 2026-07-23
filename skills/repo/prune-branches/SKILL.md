---
name: prune-branches
summary: Reports a repo's stale branches grouped by why they are stale, and deletes the ones confirmed.
description: Reports a repo's stale branches grouped by why they are stale — merged into the integration branch (squash and rebase merges included, which git branch --merged cannot see), upstream gone, a closed pull request that never merged, and no commits for 90 days — then deletes only what a human confirms. Local and remote branches are listed separately so it is always clear which side a deletion touches, and an optional scope argument restricts a run to one side. Two tiers of consent — merged and upstream-gone are the default deletion set, while a closed PR and plain age are always listed and never preselected. Protected branches are never offered at all — the forge's default branch, the integration branch, anything checked out in a worktree, anything the forge marks protected, and a name-based fallback that config adds to rather than replaces. The remote side touches the integration branch's own remote only, so forks and mirrors are never written to. Forge chosen per-repo by config (root forge key); v1 is GitHub via the gh CLI. Invoke manually only — this skill never fires proactively and never deletes without an explicit yes. Use when the user wants to prune, clean up or list stale, merged or dead branches, asks which branches are safe to delete, or says things like "clean up the branches", "delete the merged branches", "Branches aufräumen", "alte Branches löschen".
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
---

# prune-branches

Report the repo's **stale branches grouped by why they are stale**, then delete exactly the ones a human confirms. What is left afterwards is live work. **Manual invocation only**: nothing here fires on its own, and no branch is deleted without an explicit yes.

Its one principle, from which the rest follows:

> **A branch is a name; the commits behind it may be the only copy.** "Stale" is not one condition but four, and they are not equally good evidence that the work landed. So the report is **grouped by reason and never flattened into one list** — the two strong reasons carry the default deletion set, and the two weak ones are listed without being preselected.

**Opted out?** If the repo config sets `pruneBranches` to `false`, this skill is **disabled** for the repo — stop immediately and tell the user the prune-branches skill is turned off in `.tituskirch-skills.json`. An _absent_ `pruneBranches` block is **not** disabled; it means the built-in defaults. Check `.pruneBranches == false` on the resolved config before any action. A missing `jq` or config exits non-zero too, so a pass is not evidence the config was read.

## Workflow

### 1. Detect (read the repo — never assume)

- **Forge** — from the root `forge` key (v1: only `github` is implemented; any other value → say it is not supported yet and stop). Confirm the repo is reachable: `gh repo view --json nameWithOwner,defaultBranchRef`. If it fails (no GitHub remote, or `gh` not authenticated), **stop** — two of the four categories and half the protection are read from the forge, and without them the run silently degrades from evidence to guesswork.
- **Integration branch** — `pr.base`, else the repo's default branch. **Never hardcode `main` or `dev`.**
- **Remote** — the integration branch's own remote (`git config branch.<base>.remote`), else `origin`. **One remote per run.** Forks, mirrors and any second remote are neither read nor written ([why](REFERENCE.md#decisions)).
- **Refresh before reading anything** — `git fetch --prune <remote>`. Every category depends on current refs: `[gone]` means nothing against a stale remote-tracking set, and a branch merged an hour ago still looks unmerged. `--prune` removes **remote-tracking refs only** — it deletes no branch, on neither side. Fetch fails → stop; a stale answer here is worse than none.
- **Scope** — the optional argument: `local`, `remote`, or absent for both. It narrows which side is _offered_, never which side is _read_ — a local branch is classified against the remote picture either way.
- **Config** — `.tituskirch-skills.json` at the repo root (optional, committed). Keys: [REFERENCE.md](REFERENCE.md#config).

### 2. Protect — build the never-offered set first

Before a single branch is classified, collect everything that must not be deleted:

| Protected                  | Read from                                                                            |
| :------------------------- | :----------------------------------------------------------------------------------- |
| The forge's default branch | `gh repo view --json defaultBranchRef`                                               |
| The integration branch     | `pr.base`, else the default branch                                                   |
| Checked out anywhere       | `git worktree list --porcelain` — every `branch refs/heads/…`, HEAD included         |
| Forge-protected            | `gh api "repos/{owner}/{repo}/branches?protected=true" --paginate`                   |
| Has an **open** PR         | `gh pr list --state open --json headRefName`                                         |
| Name fallback              | `main`, `master`, `dev`, `develop`, `stage`, `staging`, `prod`, `production`, `next` |
| `pruneBranches.protect`    | Glob patterns from the config — **added to** this list, never replacing it           |

- **Protection is a filter, not a warning.** A protected branch leaves the run entirely: not preselected, not listed as a candidate, not mentioned as "skipped because protected but you could". The count is worth reporting; the branches are not candidates.
- **The name fallback is a floor, not the mechanism.** A repo with real branch protection gets it from the forge; the names exist so a repo that declares no rules is still safe. Both apply, always — the fallback is never switched off by the forge answering.
- **The forge read failing is not "nothing is protected."** No `security`/`administration` access, an API error, a rate limit — say the protected-branch list could not be read, fall back to the names, and **do not present the run as complete**.
- **An open PR's head is untouchable.** Deleting it closes someone's live review, and a long-running PR is exactly the branch that trips category 4.
- **`release/*` is deliberately not protected** — that is the shape of release-please's own throwaway branches ([why](REFERENCE.md#decisions)). A repo that ships from `release/*` adds it via `pruneBranches.protect`.

### 3. Classify — four reasons, first match wins

Each branch lands in **exactly one** category, tested in this order. Overlap is the normal case — a merged branch usually also has a gone upstream — and the earlier category is the stronger evidence, so it wins.

| #   | Category                | Evidence                                                                      | Tier              |
| :-- | :---------------------- | :---------------------------------------------------------------------------- | :---------------- |
| 1   | **Merged**              | the forge merged its PR, or every commit is already in the integration branch | default set       |
| 2   | **Upstream gone**       | `%(upstream:track)` is `[gone]` after a pruning fetch                         | default set       |
| 3   | **Closed PR, unmerged** | a PR with this head was closed with `mergedAt` null                           | never preselected |
| 4   | **Stale by age**        | tip committer date older than `pruneBranches.age` days (default 90)           | never preselected |

**Category 1 is where the work is.** `git branch --merged` sees only ancestor merges, so a squash-merged branch — the normal outcome of most PR workflows — reads as unmerged. Two things fix that, in this order:

1. **Ask the forge.** A merged PR is direct testimony — it merged, whatever the commit graph looks like afterwards. Read the PR list **once for the repo**, not once per branch, and raise `--limit` off its default of 30 or the branches past the cutoff silently read as "never had a PR". Skip cross-repository PRs, so a fork's head branch never enters the run.
2. **Compare patches, not hashes.** No PR, or no forge answer, → `git cherry <base> <branch>` marks each commit `-` when an equivalent patch is already in the base (that catches **rebase** merges), and a synthetic single-commit tree catches **squash** merges. Recipes: [REFERENCE.md](REFERENCE.md#detecting-a-squash-or-rebase-merge).

**Neither test says "probably".** A branch that fails both is not merged, and it belongs in category 3 or 4 or nowhere — never in category 1 with a caveat.

**Category 4 is a smell, not a verdict.** Age says nobody has committed, not that nobody wants it. It catches abandoned spikes and it also catches the branch someone will return to next quarter, which is exactly why it is never preselected. Measure from the tip's **committer** date, and read it per side — a local branch and its remote counterpart can differ.

### 4. Plan — grouped, local and remote apart, before anything is deleted

- **Local and remote are separate blocks**, always, even when the run covers both and the names match. `git branch -D feature/x` and `git push origin --delete feature/x` are different acts with different blast radii, and a merged list hides which one is being approved.
- **Every branch shows its evidence and its tip SHA** — the PR number, `squash-merged`, `[gone]`, or the last-commit date. A name alone is not reviewable, and the SHA is what makes the deletion undoable ([recovery](REFERENCE.md#deletion-mechanics-and-recovery)).
- **Two tiers of consent.** Categories 1 and 2 are the **default set** — the work demonstrably landed, or the branch it tracked is already gone. Categories 3 and 4 are listed **unselected**, and taking them needs its own explicit yes; approving the default set never carries them along.
- **Individual branches can be dropped** from either tier before the confirmation. Then **one confirmation for what remains** — not one prompt per branch.
- **Never present a count alone.** "23 stale branches" is not something anyone can approve.

### 5. Delete — only what came back confirmed

- **Record the tip SHA first**, per branch, on both sides. It goes in the report, and it is the whole recovery story.
- **Local: try `git branch -d` first.** It refuses anything git can still see unlanded commits on, and that refusal is information. Force with `-D` **only** where category 1's evidence explains it — a squash or rebase merge git cannot see — and say so in the report. A `-d` refusal with **no** such evidence means the classification was wrong: skip the branch and report it.
- **Remote: `git push <remote> --delete <branch>`**, on the run's single remote. Never `--force` anything, never delete a tag, never touch a second remote.
- **Local first, then remote, then `git fetch --prune`** so the tracking refs match reality when the run ends.
- **A failed deletion stops nothing and hides nothing** — a protected-branch rejection from the forge, a race with someone else's push: report it per branch and carry on with the rest.
- **Stop at the deletions.** No commit, no push of anything but the deletion refspec, no PR, no branch created.

### 6. Report

- **Deleted** — per side, per category, with each tip SHA and the one-line restore command.
- **Kept** — what was dropped from the plan, and the never-preselected tier that was not taken.
- **Protected** — the count, and which source protected them (forge rules, worktree, config globs). Not a list of names to reconsider.
- **Unreadable** — anything the run could not establish: a protected-branch list it could not fetch, a branch whose merge state neither the forge nor patch comparison settled.

## Guardrails

- **Plans first; deletes nothing without confirmation.** Plan-only triggers ("just show me", "dry run", "nur den Plan", "nichts löschen") → print the grouped list and stop.
- **Manual invocation only.** Never fire proactively — not after a merge, not because the branch list "looks long".
- **Never delete a protected branch**, and never present one as a candidate. Protection is additive: config extends the built-in set and can never shrink it.
- **Never delete the head of an open pull request.**
- **The default set is categories 1 and 2 only.** A closed PR or plain age is never preselected and never rides along on someone else's yes.
- **One remote — the integration branch's.** Forks and mirrors are never written to, in any mode.
- **Never `git push --force`, never delete a tag, never rewrite history.** This skill deletes refs it was told to delete and nothing else.
- **An unreadable fact is never a green light.** A failed protected-branch read, an undeterminable merge state, a fetch that did not run → report it and hold the branch.
- **Never commit, push work, or open a PR.**
- **Attribution-free** — no `Generated with`/🤖 line, no session url, no agent self-naming in anything it writes.
- **GitHub forge (v1).** No GitHub remote / `gh` unavailable → stop; never fall back to a git-only run that quietly loses two categories.

## Reference

Config keys, the merge-detection recipes, the protection sources, the `git`/`gh` recipes, the report layout, deletion and recovery, and the reasoning behind the defaults: [REFERENCE.md](REFERENCE.md).
