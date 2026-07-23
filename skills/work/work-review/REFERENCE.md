# work-review / work-review-queue — Reference

Mechanics for [`work-review`](SKILL.md) (the unit) and `work-review-queue` (the drain) — the **review half** of the two-loop agent workflow. Shares the config, catalog cache and tracker recipes with `work-implement`; this file covers what is review-specific.

## Principle

> **The reviewer is independent and read-only.** A different agent than the implementer, with fresh context, judges the pushed work and writes a **verdict** — a label move plus a comment. It never edits, commits, or merges. State lives in the label, so a crashed review just re-runs (idempotent).

The two loops meet at two hand-off labels: `review` (implement → review) and `changes-requested` (review → implement). See the **Lifecycle state machine** in `work-implement`'s REFERENCE.

## Config

Reads the shared `work.*` section (schema: **Config** in `work-implement`'s REFERENCE). Review-specific keys:

| Key                            | Effect                                                                                                  |
| :----------------------------- | :------------------------------------------------------------------------------------------------------ |
| `work.review.maxRounds`        | Max AI-review rounds before escalating to `needs human` instead of `changes-requested`. Default: **3**. |
| `work.labels.review`           | The "awaiting AI review" label — the review queue's input.                                              |
| `work.labels.changesRequested` | The "review requested changes" label — hands back to the implement loop.                                |
| `work.labels.needsHuman`       | The "escalated to a human" label.                                                                       |
| `work.labels.done`             | Terminal "accepted".                                                                                    |

Every key, type and default lives once in the repo-root [`tituskirch-skills.schema.json`](https://raw.githubusercontent.com/TitusKirch/skills/main/tituskirch-skills.schema.json).

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

## Selection query

Eligible = the issues this loop reviews. Self-select (one) and drain (all, ordered) use the same query.

- **label** — has `work.labels.review`; not already `needs human`/`blocked`.
- **repo scope / team** — Linear only, as in the implement loop's own **Selection query**.
- **order** — by priority (Linear native; GitHub `work.priorityLabels`), then creation order. **No dependency re-sort** — review order is priority only (unlike the implement loop, review has no accumulation to order for).

**Resolve the label before you query with it** — an unresolved substitution reaching `--label` is the failure mode this loop is most exposed to, because `gh` **drops an empty `--label` silently** and returns every open issue instead of none:

```bash
# label-or-off: false is "mechanic off", absent/unreadable is "use the default"
review=$(printf '%s' "$resolved" | jq -er '.work.labels.review | select(. != null) | tostring' 2>/dev/null) || review=
[ -n "$review" ] || review='ai: review'
[ "$review" = 'false' ] && review=

# GitHub — issues awaiting review
test -n "$review" && gh issue list --state open --label "$review" --json number,title,labels,createdAt
```

**Never pass `--label "$review"` unguarded.** With `labels.review: false` the label mechanic is off and the PR's existence is the signal — select on that instead; do **not** fall through to a label query with an empty value.

## Round count

The round number is **derived from the tracker's own events**, never a stored counter — one round = one `working → review` transition = one `review` label addition.

```bash
# GitHub — how many times this issue has entered review ($review resolved as above).
# gh api has no --arg, so the label is embedded in the filter; --paginate runs --jq
# once per page, so the per-page counts are summed. Capture before summing: gh prints
# its error body on stdout, and a command left of a pipe loses its exit status.
rounds=
if [ -n "$review" ]; then
  raw=$(gh api "repos/$owner/$repo/issues/$n/timeline" --paginate \
    --jq "[.[] | select(.event==\"labeled\" and .label.name==\"$review\")] | length") || raw=
  rounds=$(printf '%s\n' "$raw" | awk '/^[0-9]+$/ { n += $1; seen = 1 } END { if (seen) print n }')
fi
[ -n "$rounds" ] || echo 'round count unreadable — escalate to needs human'
```

**Three traps sit in that one request.** `gh api` has **no `--arg` flag** — passing one aborts with `unknown flag: --arg` before the request is ever made, so the resolved label must be interpolated into a double-quoted filter string. `--paginate` applies `--jq` **per page**, printing one number per page; reading only the first line undercounts a timeline past page one. And a failed request is not silence: `gh` writes its **error body to stdout**, bypassing `--jq`, and on the left of a pipe its exit status is discarded (`pipefail` is not POSIX) — so summing straight out of the pipe coerces `{"message":"Not Found",…}` to `0`. Hence: capture into a variable so the exit status is visible, then sum only the lines that are actually numbers. All three fail **open** — exactly the direction `maxRounds` exists to guard. `--slurp` cannot rescue the pagination either: `gh` rejects `--slurp` together with `--jq`.

`$rounds` is therefore **empty whenever the count could not be read** — an unresolved label (the guard is never entered), or an unreachable timeline (404, 401, rate limit, transient 5xx) — and holds `0` only when the tracker genuinely answered zero. Never read a missing number as zero rounds — that never trips `maxRounds`, and the loop keeps returning `changes-requested` instead of escalating; an unreadable count escalates to `needs human` instead. With `labels.review: false` the mechanic is deliberately off: count the reviewer's `changes-requested` verdicts on the artifact instead, and escalate to `needs human` when neither signal is countable.

**Linear** — read the issue's history/activity and count the state/label changes onto the `review` state. Before deciding `changes-requested`, compare the count to `work.review.maxRounds`: at or above it, escalate to `needs human` instead — with a comment summarising the still-unresolved feedback.

## Escalation to `needs human`

The reviewer escalates on **judgment**, guided by existing repo signals rather than a config paths-list:

- **CODEOWNERS** — the change touches paths a human owner is required to review (`.github/CODEOWNERS` / repo root / `docs/`). → escalate.
- **Branch protection / required reviews** — where the base enforces a human review, the AI never self-approves. → escalate.
- **Ambiguous intent** — the diff is plausible but you cannot confirm it matches what the issue actually wants. → escalate, don't guess.
- **Size / risk** — a change too large or consequential to sign off confidently. → escalate.
- **Red / missing checks without a clear cause** — → escalate (or `blocked` if clearly broken).
- **`maxRounds` reached** — still failing after the cap → escalate rather than accept unfinished work.
- **Explicit marker** — a repo may set a per-issue label (its own name) forcing escalation; the reviewer honours it. Not a config key here — a repo convention.

When none apply and the work is correct and low-risk → `done`. The default posture on genuine doubt is **`needs human`, never a rubber-stamp `done`**.

## Review-after-land (`branch:<name>`)

On a shared branch (e.g. `branch:dev`) the implementer commits **directly to the branch**, so the code lands **before** review. The issue still is not `done` until review passes:

- The reviewer diffs the **issue's own commit range** on the branch (the commits referencing this issue since it was last picked up), not the whole branch.
- **`changes-requested` → fix-forward** — the implement loop adds further commits on the same branch; there is no revert. Transiently-unreviewed code on an integration branch is acceptable because the release review happens at the rollup PR.
- `done` therefore means **"AI-reviewed and accepted"**, not "landed" (it landed at push time).

Under `worktree`, the PR is the artifact: review its diff, and a `changes-requested` re-work re-pushes the same branch.

## Feedback recipes

The verdict is a **label move + a comment**. Post the feedback where the artifact is:

```bash
# PR present — a real review with the changes-requested verdict (inline comments via the API)
gh pr review "$n" --request-changes --body "…what to change and why…"

# No PR (branch:<name>) — an issue comment referencing the reviewed commit(s)
gh issue comment "$n" --body "AI review — changes requested (commit <sha>): …"
```

Then move the label to `work.labels.changesRequested`. For `done`/`needs human`/`blocked`, move the label and comment the reasoning. **Linear** — post the comment via the MCP and set the label (plus the mapped `work.linear.states` state when configured), in one `update_issue` call where possible.

**De-dupe on re-review.** Because review is idempotent, before posting feedback check whether an equivalent comment from a prior crashed run already exists; update or skip rather than double-post.

## Tracker recipes

Label moves mirror the implement loop's own **Tracker — GitHub (`gh`)** recipes; the reviewer only ever writes the **verdict** labels (`done` / `changesRequested` / `needsHuman` / `blocked`) and their mapped Linear states — never `working`/`ready` (those are the implement loop's).
