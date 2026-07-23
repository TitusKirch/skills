# work-review / work-review-queue — Reference

Mechanics for [`work-review`](SKILL.md) (the unit) and [`work-review-queue`](../work-review-queue/SKILL.md) (the drain) — the **review half** of the two-loop agent workflow. Shares the config, catalog cache and tracker recipes with [`work-implement`](../work-implement/REFERENCE.md); this file covers what is review-specific.

## Principle

> **The reviewer is independent and read-only.** A different agent than the implementer, with fresh context, judges the pushed work and writes a **verdict** — a label move plus a comment. It never edits, commits, or merges. State lives in the label, so a crashed review just re-runs (idempotent).

The two loops meet at two hand-off labels: `review` (implement → review) and `changes-requested` (review → implement). See the [lifecycle](../work-implement/REFERENCE.md#lifecycle-state-machine).

## Config

Reads the shared `work.*` section ([schema](../work-implement/REFERENCE.md#config)). Review-specific keys:

| Key                            | Effect                                                                                                  |
| :----------------------------- | :------------------------------------------------------------------------------------------------------ |
| `work.review.maxRounds`        | Max AI-review rounds before escalating to `needs human` instead of `changes-requested`. Default: **3**. |
| `work.labels.review`           | The "awaiting AI review" label — the review queue's input.                                              |
| `work.labels.changesRequested` | The "review requested changes" label — hands back to the implement loop.                                |
| `work.labels.needsHuman`       | The "escalated to a human" label.                                                                       |
| `work.labels.done`             | Terminal "accepted".                                                                                    |

Every key, type and default lives once in the repo-root [`tituskirch-skills.schema.json`](../../../tituskirch-skills.schema.json).

## Selection query

Eligible = the issues this loop reviews. Self-select (one) and drain (all, ordered) use the same query.

- **label** — has `work.labels.review`; not already `needs human`/`blocked`.
- **repo scope / team** — Linear only, as in the [implement selection](../work-implement/REFERENCE.md#selection-query).
- **order** — by priority (Linear native; GitHub `work.priorityLabels`), then creation order. **No dependency re-sort** — review order is priority only (unlike the implement loop, review has no accumulation to order for).

**Resolve the label before you query with it** ([reading the config](../../README.md#reading-the-config)) — an unresolved substitution reaching `--label` is the failure mode this loop is most exposed to, because `gh` **drops an empty `--label` silently** and returns every open issue instead of none:

```bash
# label-or-off: false is "mechanic off", absent/unreadable is "use the default"
review=$(jq -er '.work.labels.review | select(. != null) | tostring' "$config" 2>/dev/null) || review=
[ -n "$review" ] || review='ai: review'
[ "$review" = 'false' ] && review=

# GitHub — issues awaiting review
test -n "$review" && gh issue list --state open --label "$review" --json number,title,labels,createdAt
```

**Never pass `--label "$review"` unguarded.** With `labels.review: false` the label mechanic is off and [the PR's existence is the signal](../work-implement/REFERENCE.md#config) — select on that instead; do **not** fall through to a label query with an empty value.

## Round count

The round number is **derived from the tracker's own events**, never a stored counter — one round = one `working → review` transition = one `review` label addition.

```bash
# GitHub — how many times this issue has entered review ($review resolved as above)
gh api "repos/$owner/$repo/issues/$n/timeline" --paginate \
  --jq '[.[] | select(.event=="labeled" and .label.name==$review)] | length' \
  --arg review "$review"
```

An empty `$review` here fails **closed** rather than open — every round counts as 0, so `maxRounds` never triggers and the loop keeps returning `changes-requested` instead of escalating. Same resolution, same reason.

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

Label moves mirror the [implement recipes](../work-implement/REFERENCE.md#tracker--github-gh); the reviewer only ever writes the **verdict** labels (`done` / `changesRequested` / `needsHuman` / `blocked`) and their mapped Linear states — never `working`/`ready` (those are the implement loop's).
