# prune-branches — Reference

Mechanics for the [`prune-branches`](SKILL.md) skill: what makes a branch stale, how a squash or rebase merge is proven, what is protected and by whom, how a deletion is undone, and why the defaults are what they are. **GitHub (`gh`) is the only forge in v1**, and a run touches exactly **one remote** — the integration branch's.

## Config

`pruneBranches.*` in the repo-root `.tituskirch-skills.json`, or `pruneBranches: false` to disable the skill for the repo. Resolution per setting: **config → detected → built-in default**. **Resolve it before reading it** — [Reading the config](#reading-the-config) is the single statement of how, including what happens when `jq` is absent. Every key, type, enum and default lives once in the repo-root [`tituskirch-skills.schema.json`](https://raw.githubusercontent.com/TitusKirch/skills/main/tituskirch-skills.schema.json) — the single source of truth.

```json
{
  "forge": "github",
  "pr": { "base": "dev" },
  "pruneBranches": {
    "age": 90,
    "protect": ["release/*", "legacy-*"]
  }
}
```

| Key                     | Effect                                                                                                        |
| :---------------------- | :------------------------------------------------------------------------------------------------------------ |
| `forge` _(root)_        | Forge, a shared root key read by all forge-aware skills. v1 supports only `github`. Default: `github`.        |
| `pr.base` _(shared)_    | The integration branch every merge check runs against, and the protected branch. Default: the repo's default. |
| `pruneBranches.age`     | Days without a commit before a branch is stale by age (category 4). Default: 90.                              |
| `pruneBranches.protect` | Extra protected-branch globs, **added to** the built-in set. Default: `[]`.                                   |

Also reads the shared root `language` (report wording).

**`protect` adds; it never replaces.** It is `issue.labels.exclude`'s shape and its semantics — a repo names what _else_ must be left alone, and cannot use the key to unprotect the default branch, the integration branch, a worktree checkout or a forge-protected branch. Patterns are globs matched against the **short** name (`feature/x`, not `refs/heads/feature/x`), and they apply identically on both sides of the run.

<skills-config>

### Reading the config

The config is `.tituskirch-skills.json` at the **consuming repo's** root — committed, optional, and shared by every TitusKirch skill. Absent means detection and built-in defaults, never an error. Its keys, types and defaults are defined by [`tituskirch-skills.schema.json`](https://raw.githubusercontent.com/TitusKirch/skills/main/tituskirch-skills.schema.json).

**Resolve it before reading it.** A repo may define `profiles` — named overlays for an execution context, so a remote runner can open pull requests where a local session commits directly. [`templates/resolve-config.sh`](templates/resolve-config.sh) prints the resolved config, and every skill ships the same copy, so they all see the same values:

```sh
# Fill in this skill's own directory — the path this file was loaded from, not the
# repo being worked on. It is a blank to fill, not a variable that is already set.
skill=/absolute/path/to/this/skill

resolved=$(sh "$skill/templates/resolve-config.sh"); status=$?
case $status in
0)  [ -n "$resolved" ] || resolved='{}' ;;   # ran fine; empty means the repo has no config
10) resolved= ;;                           # no jq — read the file yourself, see below
*)  echo "resolve-config failed ($status)" >&2; exit 1 ;;
esac
```

**A failure here is never silent.** Any exit other than `0` or `10` means the resolver could not be found or could not run, and the only wrong response is to carry on with `{}` — that reports the repo's defaults as if they were its settings. Stop and say what failed.

The profile comes from `TITUSKIRCH_SKILLS_PROFILE`, falling back to `ci` when `CI` holds a truthy value, and to no profile otherwise. An unset or unknown name yields the base config unchanged.

**The merge is a rule, not just a command.** Objects merge recursively at any depth, arrays and scalars are replaced rather than concatenated, an explicit `null` sets null rather than deleting a key, and `profiles` is dropped from the result. Any path that resolves the config by other means owes the same semantics.

**`jq` may not be installed.** It ships preinstalled on none of Windows, macOS or Linux, and `gh`'s built-in `--jq` is no substitute — that filters API responses, it cannot read a local file. `resolve-config.sh` exits `10` in that case. Do **not** fall through to defaults: `Read` the file, apply the merge rule above, and carry on with the repo's real values. Nothing else is needed — no Node, no Python.

**Guard every read, resolve into a variable, then use it.** Never let a substitution reach a command flag directly — `jq -r` prints the literal string `null` for a missing key, and an empty value is silently ignored by some tools rather than matching nothing:

```sh
value=$(printf '%s' "$resolved" | jq -er '.section.key // empty' 2>/dev/null) || value=
[ -n "$value" ] || value=<documented default>
```

**Tell "off" apart from "absent".** `// empty` collapses `false` and a missing key into the same empty string, which turns a deliberately disabled mechanic into its default. Where a key may be `false`, resolve it as `select(. != null) | tostring` and test for the string afterwards.

**Snippets are POSIX `sh`.** No `[[ ]]`, no arrays, no `<<<`, and nothing that differs between GNU and BSD coreutils — the shell is whatever the user runs.

</skills-config>

## The four categories

Every branch is tested in this order and lands in the **first** category that matches. Overlap is the rule, not the exception: a merged branch usually has a gone upstream and often an old tip too. Ordering by strength of evidence is what keeps the report honest — the branch appears once, under the best reason there is to delete it.

| #   | Category                | The claim                                            | How it can be wrong                                                         |
| :-- | :---------------------- | :--------------------------------------------------- | :-------------------------------------------------------------------------- |
| 1   | **Merged**              | the work is in the integration branch                | a squash that resolved conflicts changes the patch — ask the forge first    |
| 2   | **Upstream gone**       | the branch it tracked no longer exists on the remote | the remote branch was deleted by mistake, and this is now the only copy     |
| 3   | **Closed PR, unmerged** | someone closed the PR without merging                | closed as "later", not as "no" — the branch is the proposal, not the review |
| 4   | **Stale by age**        | nobody has committed in `age` days                   | age measures activity, never intent                                         |

Categories 1 and 2 are the **default deletion set**; 3 and 4 are listed and **never preselected**. The split is exactly the "how it can be wrong" column: for 1 and 2 the failure mode needs a second mistake to have already happened elsewhere, while for 3 and 4 the branch may be perfectly wanted and merely quiet.

**Category 2 deserves its own caution.** `[gone]` normally means the forge deleted the branch on merge — which is why it is in the default set. But it says nothing about _why_ it went, and a branch deleted by accident on the remote leaves the local copy as the only surviving one. The tip SHA in the report is what makes that recoverable; print it before deleting, never after.

## Detecting a squash or rebase merge

`git branch --merged` answers one question — is this commit an ancestor? — and both squash and rebase merges answer it "no" while having landed. This is the single most load-bearing mechanic in the skill, because the failure it prevents is the whole reason the skill exists.

**First, ask the forge.** A merged PR is direct testimony and survives any history rewrite that happened afterwards:

```sh
# One call for the whole repo, not one per branch. --limit defaults to 30.
gh pr list --state all --limit 1000 \
  --json number,state,mergedAt,headRefName,isCrossRepository
```

> **`--limit` truncates silently.** Left at its default this reads the 30 most recent PRs and every branch past the cutoff looks like it never had one — which downgrades a merged branch to "stale by age" or drops it from the run entirely. Same trap as a truncated label catalog: the missing rows are chosen by recency, not by relevance.

Filter out `isCrossRepository` PRs — a fork's head branch is not a branch in this repo and must never enter the run.

**Then compare patches, not hashes.** For a branch with no PR, or when the forge could not be read, `git cherry` prefixes a commit with `-` when an equivalent patch already exists in the base:

```sh
remote=origin              # the run's single remote
base=dev                   # the integration branch, short name — pr.base or the default branch
baseref="$remote/$base"    # …as a remote-tracking ref: what every test below compares against
branch=feature/x

# Rebase merge (or plain ancestor) — nothing left that the base does not have.
# Test the exit status, never the output alone: git cherry writes its fatals to
# stderr and prints nothing on stdout, so `| grep -q '^+' || echo landed` turns
# every error into "landed" — the default deletion set.
if out=$(git cherry "$baseref" "$branch"); then
  printf '%s\n' "$out" | grep -q '^+' || echo "landed"
else
  echo "undetermined"      # hold the branch; never category 1
fi

# Squash merge — collapse the branch into one commit on top of the merge base
# and ask the same question of that single patch.
mb=$(git merge-base "$baseref" "$branch")
squashed=$(git commit-tree "$branch^{tree}" -p "$mb" -m _)
git cherry "$baseref" "$squashed" | grep -q '^-' && echo "squash-merged"
```

`git commit-tree` writes a dangling commit object and nothing else — no ref, no branch, no change to the working tree. It is garbage-collected on its own.

**The two tests fail in opposite directions, which is why they are written differently.** The squash test's `&&` fails **closed**: a broken ref leaves `mb` or `squashed` empty, the last `git cherry` errors, `grep` matches nothing, and the branch is simply not flagged — which holds it. The rebase test's `||` fails **open**: the same empty stdout satisfies "no `+` lines" and the branch is announced as landed. Hence the `if`. Never rewrite the squash test's `&&` into an `||`, and never collapse the rebase test back into a one-liner.

Verified against four fixtures on a real clone — genuinely unmerged → not landed; fast-forward ancestor merge → landed; a cherry-pick onto the base with a **different** hash → landed; an unresolvable base or branch → **undetermined** (the one-liner said "landed" for both).

**Where patch comparison fails, and why the forge comes first:** a squash merge whose conflicts were resolved during the merge produces a **different** patch, and `git cherry` will correctly say it is not there. So a branch that fails both tests is reported as **unmerged**, not as "probably fine" — and the PR state is what catches the conflict-resolved case.

**An unresolvable base breaks every branch at once**, which is why step 1 checks it before classification begins rather than letting each test discover it: a `pr.base` naming a branch the run's remote does not carry — renamed, copied from another repo, absent from a shallow clone — would otherwise make the whole branch list undetermined, or, before this was fixed, the whole branch list "merged".

## Protection

Six sources, all applied, every run. A branch matching any of them is removed from the run before classification — it is not a candidate to be dropped from the plan, it never enters it.

| Source                  | Read from                                                                                     |
| :---------------------- | :-------------------------------------------------------------------------------------------- |
| Forge default branch    | `gh repo view --json defaultBranchRef --jq .defaultBranchRef.name`                            |
| Integration branch      | `pr.base`, else the default branch                                                            |
| Worktree checkouts      | `git worktree list --porcelain` — every `branch refs/heads/…` line, the current HEAD included |
| Forge branch protection | `gh api "repos/{owner}/{repo}/branches?protected=true" --paginate --jq '.[].name'`            |
| Open pull requests      | `gh pr list --state open --limit 1000 --json headRefName --jq '.[].headRefName'`              |
| Name fallback           | `main`, `master`, `dev`, `develop`, `stage`, `staging`, `prod`, `production`, `next`          |

Plus `pruneBranches.protect`, which is added to the union — never subtracted from it.

- **`branches?protected=true` reports rules, not intent.** It covers classic branch protection and rulesets alike, needs only plain read access, and returns nothing for a repo that declares no rules — which is exactly the repo the name fallback exists for. The two are complementary, so neither switches the other off.
- **A read failure is not an empty list — it is an _unknown_ list, and it ends the run at the report.** If the call errors, every other source still applies and every branch is still classified and listed with its evidence, but the run **offers no deletions at all**: nothing preselected, nothing confirmable, nothing deleted. It names the call that failed and says the run is a report only. Preselecting nothing would not be enough — the branch a rule protects is precisely the one the report cannot identify, so it is also the one a human could tick by hand ([why](#decisions)).
- **A checked-out branch is protected on both sides.** `git branch -d` refuses it anyway, but the remote counterpart has no such guard, and deleting the remote out from under an active worktree is the same accident one step removed.

## git / gh recipes

**Refresh, and prune only the tracking refs:**

```sh
git fetch --prune "$remote"     # deletes remote-tracking refs; no branch, on neither side
```

**Then prove the integration branch resolves, before classifying anything:**

```sh
git rev-parse --verify --quiet "$remote/$base^{commit}" >/dev/null \
  || { echo "integration branch $remote/$base does not resolve — stopping" >&2; exit 1; }
```

`$base` is the **short** name throughout (`dev`), and every comparison uses `"$remote/$base"`. Keeping the qualification in one place is what stops a block that already holds `origin/dev` from being handed to a block that adds the remote again.

**The local picture in one pass** — name, tip, age and upstream state together:

```sh
git for-each-ref refs/heads \
  --format='%(refname:short)%09%(objectname:short)%09%(committerdate:unix)%09%(upstream:short)%09%(upstream:track)'
```

`%(upstream:track)` prints `[gone]` for category 2 — **after** the pruning fetch, and only then.

**The remote picture**, skipping the remote's symbolic HEAD:

```sh
git for-each-ref "refs/remotes/$remote" \
  --format='%(refname:short)%09%(objectname:short)%09%(committerdate:unix)' \
  | grep -v "^$remote/HEAD"
```

**The cheap merge test**, for the ancestor case only — never the whole answer:

```sh
git branch --merged "$remote/$base" --format='%(refname:short)'
```

**Delete — local first, then remote, then re-prune.** Containment is proven _before_ either verb runs, and `-D` is reached only inside that guard — never by running the line below `-d`:

```sh
# per confirmed branch $b, with $category its classification
sha=$(git rev-parse --short "$b")            # record before, always — it is the restore argument
deleted=no

if git merge-base --is-ancestor "$b" "$baseref"; then
  proof="contained in $baseref"              # git itself: every commit is already in the base
elif [ "$category" = merged ]; then
  proof="category 1: $category"              # squash/rebase merge git cannot see; it is in the report
else
  proof=                                     # nothing licenses a deletion — and an errored
fi                                           # --is-ancestor lands here too, which holds the branch

if [ -n "$proof" ]; then
  if git branch -d "$b" || git branch -D "$b"; then
    deleted=yes                              # -D is unreachable without $proof
  fi
else
  echo "kept $b — not contained in $baseref, and no category-1 evidence"
fi

if [ "$deleted" = yes ]; then
  git push "$remote" --delete "$b"           # only what the local side actually gave up
fi
```

```sh
git fetch --prune "$remote"                  # once, after the whole batch
```

A `remote`-scoped run has no local half to consult, so it deletes the remote ref on the plan's evidence alone — which is why a remote deletion prints its SHA and its restore line just as loudly.

## Presentation

Two blocks per side, in category order, evidence beside every name:

```text
local (delete)
  merged
    feature/queue-cap    a1b2c3d  PR #64, squash-merged      2026-05-02
    fix/label-catalog    9f8e7d6  PR #71, merged             2026-06-11
  upstream gone
    chore/bump-oxlint    4c5d6e7  [gone], last commit        2026-04-18

local (listed, not selected)
  closed PR, unmerged
    spike/worktrees      7a8b9c0  PR #58 closed 2026-03-30
  stale by age (> 90 days)
    wip/editor-hover     2d3e4f5  last commit                2026-01-09

remote (delete)
  merged
    origin/feature/queue-cap    a1b2c3d  PR #64, squash-merged
```

- **The two tiers are two blocks, not two columns.** Approving a block is one act; a checkbox column invites approving a table.
- **Local and remote never merge into one row**, even where the name and the SHA are identical.
- **The tip SHA is part of the report, not a debugging detail** — it is the restore command's only argument.

## Deletion mechanics and recovery

- **`git branch -d` is not the second opinion it looks like.** It requires the branch to be fully merged **into its upstream** when one is set, and into `HEAD` otherwise — neither of which is the integration branch. A tracking branch that merely matches its remote counterpart is therefore deleted with a _warning_ and exit `0`, unmerged work included:

  ```text
  warning: deleting branch 'feat/live' that has been merged to
           'refs/remotes/origin/feat/live', but not yet merged to HEAD.
  ```

  Since almost every candidate here is a tracking branch, treating `-d`'s success as proof the work landed would ratify the classification instead of testing it.

- **The real second opinion is `git merge-base --is-ancestor "$b" "$baseref"`** — an explicit question about the integration branch, asked before either delete verb runs. It exits non-zero for a branch that is not contained, and for a ref it cannot resolve, so both hold the branch.
- **`-D` is for a squash or rebase merge git cannot see**, and only with category 1's evidence recorded in the report. With neither containment nor that evidence, the classification was wrong — skip the branch, and skip its remote counterpart with it.
- **A remote deletion is one push of one refspec.** `git push <remote> --delete <branch>`; never `--force`, never a wildcard refspec, never a second remote.
- **Recovery, per side:**

  ```sh
  git branch "$b" "$sha"                    # local
  git push "$remote" "$sha:refs/heads/$b"   # remote
  ```

  Locally the tip also survives in `git reflog` and, failing that, `git fsck --lost-found`, until gc collects it (90 days for reachable-from-reflog objects by default). On GitHub a deleted branch can be restored from its PR page for as long as the PR exists. **Neither is a reason to skip printing the SHA** — both are recovery paths a person has to know to look for.

## Common mistakes

- ❌ Trusting `git branch --merged` and reporting every squash-merged branch as unmerged (or worse, not reporting it at all).
- ❌ Reading `git cherry`'s output without its exit status, so a fatal on stderr and an empty stdout read as "merged".
- ❌ Classifying against a `pr.base` that was never checked to resolve, so one bad ref mis-classifies the entire branch list.
- ❌ Classifying before fetching, so `[gone]` reflects last week's remote.
- ❌ Reading `gh pr list` at its default `--limit 30` and calling the missing rows "no PR".
- ❌ Folding the local and remote lists into one, so one yes deletes two things.
- ❌ Letting "stale by age" ride along on the merged tier's confirmation.
- ❌ Treating a failed protected-branch read as "no protected branches", and deleting on a protection set nobody could read.
- ❌ Deleting the head branch of an open PR because its last commit is old.
- ❌ Reaching for `-D` on the first `-d` refusal instead of reading the refusal.
- ❌ Reading `git branch -d`'s success as "the work landed" — with an upstream set it compares against the remote counterpart, not the integration branch.
- ❌ Deleting a branch on a fork or a second remote because the name matched.
- ❌ Reporting a count instead of the branches, their evidence and their SHAs.

## Decisions

The issue that specified this skill settled its shape; what it left open, and what following from it required, is settled here:

- **Category `repo/`, name `prune-branches`.** It sits with `merge-deps`, `release` and `pull-request` — the skills that act on the repo and its forge. The verb-noun name matches its neighbours, and `prune-` is already this repo's verb for _report the candidates, act only after confirmation_, as `prune-comments` established.
- **Four categories, first match wins.** The alternative — one flat list of "stale" branches — is what makes branch cleanup risky by hand, because it collapses "the forge merged this" and "nobody touched this in a year" into a single judgement call. Ordering by evidence strength means a branch is presented under the best reason to delete it, and appears exactly once.
- **Two tiers of consent, not one prompt per branch and not one blanket yes.** Categories 1 and 2 are wrong only if something already went wrong elsewhere; 3 and 4 can be wrong about a perfectly healthy branch. A per-branch prompt for twenty branches trains people to say yes twenty times, which is worse than either.
- **Local and remote are always listed apart.** They are different acts: a local deletion is undone from the reflog by the person who ran it, a remote one is undone on the forge and is visible to everyone. The scope argument narrows what is _offered_, never what is _read_ — a local branch cannot be classified without the remote picture.
- **One remote — the integration branch's.** A fork or a mirror is somebody else's copy, and a name matching across remotes is a coincidence, not a relationship. Making the remote configurable would only widen the one thing that must not widen, the way `merge-deps` keeps its author selector fixed.
- **Protection is additive, and config can only extend it.** A key that could _replace_ the built-in list would let a config typo unprotect the default branch — the one outcome no confirmation prompt can undo. So `pruneBranches.protect` is `issue.labels.exclude`'s shape: a repo names what else to leave alone.
- **`release/*` is deliberately not protected.** It is the shape of release-please's own short-lived branches, which are exactly what wants pruning. A repo that genuinely ships from `release/*` says so in `pruneBranches.protect` — the additive key exists for precisely this.
- **The head of an open PR is protected**, which the issue did not list. It follows from having a "closed PR" category at all: if a closed PR makes a branch a candidate, an open one must make it untouchable, or a long-running review is one age threshold away from having its branch deleted underneath it.
- **90 days, and it is the only threshold.** It is long enough that a branch crossing it has genuinely gone quiet and short enough to catch a quarter's abandoned spikes. It is a category-4 boundary only — no category is _skipped_ by age, and a merged branch is offered on day one.
- **No forge, no run.** Two of four categories and half the protection come from the forge; a git-only fallback would quietly report a smaller, less trustworthy answer that looks exactly like a complete one. Stopping is the same choice `merge-deps` and `release` make, for the same reason.
- **An unreadable protection set ends the run at the report — it does not merely un-preselect.** `branches?protected=true` needs plain read access, so a failure is an access or availability problem, never evidence of a repo without rules. The two candidate answers were "fall back to the names and proceed, flagged incomplete" and "list everything, delete nothing", and the second wins because the first is a green light drawn from an unreadable fact — the exact thing the guardrails forbid. Preselecting nothing is not enough either: the branch a rule protects is by definition the one the report cannot name, so it is also the one a human would tick by hand in good faith. The report itself is safe and still worth producing, so the run is not aborted, only disarmed — the same trade as "no forge, no run", one notch milder.
- **An errored merge test is `undetermined`, never `landed`.** `git cherry` reports failure on stderr and exits non-zero while printing nothing on stdout, so any test that reads only its output classifies a broken ref as merged — into the _default deletion set_, where neither backstop catches it: locally the false "merged" is itself the evidence that licenses `-D` over a `-d` refusal, and remotely `git push --delete` has no second opinion at all. The exit status is therefore part of the test, and a base that does not resolve stops the run in step 1 rather than being rediscovered once per branch.
- **Deletion is confirmation-gated, not config-gated.** `merge-deps.merge` and `release.promote` default to off because those skills can act unattended; this one asks every time, on every branch, in every mode. An opt-in key would be a second yes buying no safety, and a repo that does not want branches pruned does not invoke the skill — or sets `pruneBranches: false`.
- **Two config keys, and no more.** The categories, the tiers, the remote and the protection floor are the skill's judgement, not a repo's preference. What genuinely varies per repo is how long "quiet" is and which extra names are sacred — `age` and `protect`.
- **Not a mode of `release` or `merge-deps`.** Branch cleanup is tied neither to shipping a release nor to the dependency queue, so folding it in would make it fire at the wrong moment — and it would put "never delete a branch" inside a skill whose job is merging PRs that delete branches.
