Canonical spec for the work loops' single-flight lock. `scripts/gen-skills.ts` writes it
inside each work skill's `<skills-worklock>` element; `pnpm skills:check` fails if a copy
drifts. Edit it here, never in a skill.

Everything below is self-contained on purpose: a skill can be installed on its own, so it
must not link to another skill or to a file at the repo root. That is why this text is
mirrored rather than cited — the two queues used to point at a **path** in
`work-implement`'s REFERENCE, which resolves to nothing on an installed copy, and then
wrote the load-bearing half out again anyway, in two wordings.

It is mirrored into the two work-loop **units** (`work-implement`, `work-review`), not into
the two queues. A queue cannot run without its worker — it names that worker and verifies it
before any state change — so it **names** the worker's REFERENCE for this spec, which is a
name and not a path, and keeps 9 KB out of a `SKILL.md` that has no `REFERENCE.md` to hold
it. A unit has no such sibling: `work-implement` is invoked directly as well as by a drain,
so its copy is the one every reader ends up at.

<!-- worklock:body -->

## The single-flight lock

Both drains rest their within-checkout mutual exclusion on a lock, and the two loops run **concurrently** — so each has its **own**, at a **visibly distinct** path under the owner-namespaced directory in the git common dir (the same home the catalog cache uses). This replaces the earlier ad-hoc locks written **loose** in the common dir under different names — one specified path per loop, both citing this spec; retiring the old ones is a **migration step, not a note** (below), because for a lock two names live at once means two drains running at once.

| Loop                   | Lock path                                                                 |
| :--------------------- | :------------------------------------------------------------------------ |
| `work-implement-queue` | `$(git rev-parse --git-common-dir)/tituskirch-skills/work/implement.lock` |
| `work-review-queue`    | `$(git rev-parse --git-common-dir)/tituskirch-skills/work/review.lock`    |

**The acquire primitive is `mkdir`** — a single create-or-fail syscall, atomic on every POSIX filesystem and identical across GNU and BSD, so the test-and-set is **one** operation with no window. It is the **canonical primitive both queues cite**; never substitute a `[ -e "$lock" ] && …` test-then-create, which re-opens the very race the lock closes. (A `set -C` noclobber redirect — `( set -C; : > "$lock" )` — is the equally-atomic alternative; the skills standardise on `mkdir` so there is one idiom to reason about, and because a lock **directory** gives the owner record below a natural home.)

```sh
# Acquire — implement loop; the review loop is identical with review.lock.
common=$(git rev-parse --git-common-dir)
lock="$common/tituskirch-skills/work/implement.lock"
owner="$lock/owner"
mkdir -p "$(dirname "$lock")"
rm -f "$common/implement.lock"   # migration: retire the old loose lock (review loop: rm -f "$common/tituskirch-work-review-queue.lock")
if mkdir "$lock" 2>/dev/null; then
  # won the race — stamp the owner (host + a heartbeat timestamp) for the stale check
  printf 'host=%s\nrefreshed=%s\n' "$(uname -n)" "$(date +%s)" > "$owner.tmp" && mv "$owner.tmp" "$owner"
else
  # held — read owner's refreshed timestamp and decide live vs stale (below) first
  :
fi

# Heartbeat — the drain re-stamps the timestamp once per iteration (per issue), one cheap
# command, so the lock stays demonstrably live across the batch's many separate processes.
# Always write the sibling temp file and RENAME it over the record, never overwrite in
# place: the rename replaces a directory entry, so it moves $lock's own mtime too (below).
printf 'host=%s\nrefreshed=%s\n' "$(uname -n)" "$(date +%s)" > "$owner.tmp" && mv "$owner.tmp" "$owner"

# Release — no trap (a per-command shell fires EXIT and would drop the lock immediately);
# the drain's final "Report & release" step removes the lock explicitly, once, at batch end:
rm -rf "$lock"
```

**Migrate off the old loose locks.** Earlier runs wrote each loop's lock **loose** in the common dir under an ad-hoc name — the implement loop's `$(git rev-parse --git-common-dir)/implement.lock` and the review loop's `$(git rev-parse --git-common-dir)/tituskirch-work-review-queue.lock`, neither under `tituskirch-skills/work/`. For a **cache** a changeover is harmless — re-detect into the new path and `rm -f` the old file. For a **lock** it is not: while both names are live, an old-spec drain holding the loose file and a new-spec drain that `mkdir`s the path above **never see each other and both run**. So on adopting the new path **actively retire the old one** — `rm -f` the loop's own old loose lock **before** the `mkdir` (the line in the snippet above), so no run reading the new spec ever finds the old file to honour. This retires the old **file**, not a still-running old-spec drain: while such a drain is still live it holds a name the new path never checks, and — the file now deleted — a second old-spec run could even re-take it. That residual gap is inherent to any changeover and closes as soon as the last old-spec drain exits; the migration guarantees only that a **new**-spec run will not resurrect the old idiom.

**A label string is a changeover too.** Changing a `work.labels.*` string — or switching a mechanic on — is the **same class of change** as the loose locks above: while a primitive lives under two names at once, it splits the very set it should partition, so the tracker and the config must move **before** the skill copies do. **The string must exist on the tracker before any copy adopts it:** `gh issue list --label '<a label the tracker lacks>'` **exits 0** on an empty result, so a queue split between an old copy's string and a new copy's stalls **silently**, with no error to notice. Create the label and relabel every open issue onto it first, or pin the old string under `work.labels.<key>` until you do — the pin covers the **steady** state, the relabel the **transition**. And **do not switch `reviewing` on until every drain runs a copy that knows it:** an unaware review drain selects the issue straight off `reviewRequested`, writes a **competing verdict**, and never reclaims a `reviewing` orphan invisible to it — the lease buys nothing until the last unaware copy exits (the same residual window the lock note reasons through), and enabling it mid-rollout is worse than leaving it off.

**Stale rule — a refreshed timestamp, not a probed pid.** These skills run **each shell command in its own short-lived process** — the harness does not persist shell state between commands — so a pid captured at acquire (`$$`) names a shell that is **dead within milliseconds**, while the drain that owns the lock runs on across many separate commands for the whole batch. A recorded pid therefore cannot separate a **live** drain from a **crashed** one here: probing it reports "no such process" for a live lock exactly as it would after a real crash, so a pid-liveness rule would read a **live** lock as stale and let a second drain delete it and run alongside the first — the very double-verdict this lock exists to prevent. So the lock records **no pid and probes no process**. It is held for the **logical duration of the drain**, which no single process spans; liveness is judged instead from a **timestamp the live drain keeps refreshing**. The `owner` records the `host` and a **`refreshed` timestamp** (epoch seconds), and the drain **re-stamps** it once per iteration — each issue it works, one cheap command (the heartbeat in the snippet above). **Every stamp is written through a rename** — into `$lock/owner.tmp`, then `mv`d over `$lock/owner` — because a rename replaces a **directory entry** and so moves the lock directory's own mtime, where overwriting an existing file in place leaves that mtime frozen at the moment `owner` was first created. That is what makes the directory's mtime a second, coarser heartbeat rather than a creation timestamp, and it is what the **no record yet** row below rests on; the rename is atomic, so a reader never meets a half-written record either. The record is **`key=value` lines**, one per line, **parsed by key** and **extensible** — the reader takes `refreshed` by its name and ignores any other field a drain may add (its own loop name, say), so the timestamp always carries a stable key rather than riding on a fixed field count. Liveness is then read from the clock:

| What the reader finds at `$lock/owner`                                                                             | Judgement                                                                                                                                  |
| :----------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------- |
| a `refreshed` **within the window below** (a live drain is mid-iteration)                                          | presumed a **live drain** → **stop and report**, never break it                                                                            |
| a `refreshed` **not within that window**                                                                           | the drain **crashed** — a live one would have re-stamped by now → **stale**: `rm -rf` it and retake                                        |
| **no record yet** — no `owner` at all (the `mkdir` won and the first stamp is still in flight)                     | just-created → fall back to the lock **directory's own age** (its mtime) under the **same** window, never stale on the missing stamp alone |
| **a record present but unparseable** — an `owner` carrying no `refreshed=` key, or another file standing in for it | presumed a **live drain** → **stop and report** exactly as the first row; **never** `rm -rf`, and name the shape found in the run's report |

The **window** is longer than any **legitimate gap between refreshes** — longer than the longest single-issue implementation a drain runs between two heartbeats (hours, not minutes) — so a live drain mid-iteration is **never** misjudged as stale, while a crashed drain, which stops re-stamping, is reclaimed once the window elapses. Err toward **not** breaking: misjudging a live lock must cost a **delay** (the reader waits; the true holder finishes and releases), **never** a destroyed lock. This is deliberately **not** the plain age TTL this section could have opened with — that would evict a slow-but-live run — because the heartbeat separates "slow" from "dead": only a live drain keeps the timestamp moving. The tradeoff is a lock format richer than an empty file — `key=value` lines to write and re-stamp each iteration — bought to keep eviction heartbeat-gated rather than clock-driven.

**The last two rows are opposite findings, which is why they are two rows.** _No record yet_ is the ordinary just-created race, seconds wide, and the directory's mtime answers it — but only because every stamp goes through the **rename** above. Overwrite `owner` in place instead and that mtime stops moving the moment `owner` is created, so the fallback silently becomes a plain age TTL on the lock's **creation** time: a drain that outruns the window is then read as stale and `rm -rf`'d **mid-run** by the one clause meant to protect a lock too young to have stamped — the eviction this section exists to rule out, arriving through the row that looks safest. _A record present but unparseable_ says the opposite: something wrote it, so another writer holds this lock, and that is exactly when destroying it costs most. Presume it **live**. The cost of being wrong is bounded and the asymmetry is the whole point — a wrongly-live lock costs a **delay** (the reader stops and reports; a repeating driver retries), a wrongly-stale one costs the double-verdict. **Report the shape found**, because an off-spec record is a bug in whatever wrote it and nothing else will surface it: such a lock is never reclaimed automatically, so the report is what brings a human to clear it. **`owner.tmp` is not a record** — it is this spec's own scratch name mid-stamp, and a reader ignores it rather than reading it as a file standing in for `owner`.

**The boundary, stated plainly.** This mutual exclusion holds **within one checkout** — the clones that share **one** git common dir on **one** filesystem, where the lock directory is visible to all of them. Two clones (or two hosts) that do **not** share the filesystem holding the lock each `mkdir` _their own_ lock and never see each other's. Cross-host coordination needs a central arbiter and is **out of scope for skill prose**; the reconcile's assignee/age guard, not the lock, is what keeps a second clone from destroying a first clone's live work.
