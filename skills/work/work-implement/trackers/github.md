# Tracker — GitHub (`gh`)

The **GitHub** branch of the work loop — reached when `work.tracker` (falling back to `issue.tracker`) resolves to `github`. Everything a run needs whatever its tracker stays in `REFERENCE.md`.

- **Lifecycle** — labels are flat (`ai: ready` …); flip with `gh issue edit <n> --add-label <x> --remove-label <y>`, assign with `--add-assignee`.
- **Dependencies** — `blockedBy` / `parent`, GraphQL-only (see **Dependency ordering** in `REFERENCE.md`).
- **Mutex** — the `mutex: <group>` label convention (GitHub has no order-free relation); read straight off the labels `gh issue list --json …,labels` already returns, so it costs no extra call (**Parallel-batch mutex** in `REFERENCE.md`).
- **Eligible** — `gh issue list --state open --label …`. Priority via `work.priorityLabels`.
- **PR link** — `Closes #<n>` in the PR body links the PR to the issue, and auto-closes it on merge **into the default branch only**. With a non-default `pr.base` (e.g. `dev`) that merge fires neither, so the keyword is **traceability, not the route to `done`** (**Terminal `done`, and what `reviewRequested` / `reviewing` mean now** in `REFERENCE.md`).
- **Reconcile** — find an issue's PRs with `closedByPullRequestsReferences` (see **Reconcile** in `REFERENCE.md`).
- **Label sync** — if the repo mirrors labels to Linear, that is the **integration's** job; the agent writes only the GitHub side. Never double-write.
