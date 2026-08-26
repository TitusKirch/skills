# Tracker — GitLab (`glab`)

The **GitLab** branch of the work loop — reached when `work.tracker` (falling back to `issue.tracker`) resolves to `gitlab`. Everything a run needs whatever its tracker stays in `REFERENCE.md`.

The same lifecycle over GitLab Issues, driven by `glab` against the resolved host (**The forge and its host** in `REFERENCE.md`). The mechanics below are `trackers/github.md`'s in GitLab's spelling; anything not named here is unchanged.

- **Lifecycle** — labels are flat, as on GitHub. Flip with `glab issue update <n> --label <x> --unlabel <y>`, assign with `--assignee <user>`. **One call carries both flags**, so the lease stays a single write; `--unlabel` is `gh`'s `--remove-label`. A **group label** is applied by name exactly like a project label, and reads back among the issue's labels either way.
- **Dependencies** — the **linked-issue** relation with `link_type: blocks` / `is_blocked_by` (`glab api projects/:id/issues/:iid/links`). That is the edge, in place of GitHub's `blockedBy`/`parent`; GitLab's epics are a group-level object and are **not** read here.
- **Mutex** — the same `mutex: <group>` label convention as GitHub, read off the labels the issue list already returns (**Parallel-batch mutex** in `REFERENCE.md`).
- **Eligible** — `glab issue list --label '<ready>' --output json`, plus a second call for the changes-requested label. **`glab` ANDs a comma-separated `--label`**, where `gh`'s search qualifier ORs it, so the implement loop's two inputs are **two calls unioned locally** — never one comma-joined argument, which would select issues carrying _both_ labels and silently drain an empty queue. Priority via `work.priorityLabels`, exactly as on GitHub.
- **MR link** — `Closes #<n>` in the merge-request description links and auto-closes on merge **into the default branch only** — the same rule as GitHub, so with a non-default `pr.base` it is traceability, not the route to `done` (**Terminal `done`, and what `reviewRequested` / `reviewing` mean now** in `REFERENCE.md`).
- **Reconcile** — find an issue's merge requests with `glab api projects/:id/issues/:iid/related_merge_requests`, whose entries carry `state` and `merged_at`. That is **Reconcile** in `REFERENCE.md`'s artifact query on this tracker.
