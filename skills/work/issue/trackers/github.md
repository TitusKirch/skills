# Tracker — GitHub (`gh`)

The **GitHub** branch of `issue` — reached when `issue.tracker` resolves to `github`. Everything a run needs whatever its tracker stays in `REFERENCE.md`.

- **Availability** — `gh repo view --json nameWithOwner` (fails → not a GitHub repo or `gh` not authenticated).
- **Create** — `gh issue create --title <t> --body-file <f> [--label <l>] [--assignee <a>] [--milestone <m>] [--project <p>]`.
- **Read one issue** — `gh issue view <n> --json title,body,labels,assignees,state` (add `--comments` for the discussion). Every **update** starts here: re-read the live body before editing it, never edit from a remembered one.
- **Update** — `gh issue edit <n> [--title …] [--body-file …] [--add-label …] [--milestone …]`; close with `gh issue close <n>`.
- **Search/list** — `gh issue list --search <q> --state <s>` or `gh search issues <q>`.
- **Catalogs** — `gh label list --limit 1000 --json name,description,color` (or `gh api repos/{owner}/{repo}/labels --paginate`), **not** the bare `gh label list`: it caps at 30 (`-L, --limit` defaults to 30, and `--json` does not lift it), so a repo past 30 labels silently caches a truncated catalog — and every real label past the cutoff then reads as unresolvable when a template's `labels:` are checked against it. Milestones/projects via `gh api` / `gh project list`.
- **Issue templates** — detect `.github/ISSUE_TEMPLATE/*.md` **and** `*.yml` (forms) and fill them per **Issue templates** in `REFERENCE.md`, which is tracker-neutral — nothing in it is GitHub-only except the `--template` note.

## Sub-issues

GitHub's sub-issues are a REST feature, not first-class in `gh` yet — create the children as normal issues, then link each via `gh api`. `sub_issue_id` is the child's **database id** (integer), **not** its issue number: fetch it with `gh api repos/{owner}/{repo}/issues/{n} --jq .id`, and pass it typed with `-F` (not `-f`, which sends a string).

```bash
# add a child to a parent
gh api --method POST repos/{owner}/{repo}/issues/{parent}/sub_issues -F sub_issue_id=<child_db_id>

# list a parent's sub-issues
gh api repos/{owner}/{repo}/issues/{parent}/sub_issues

# remove one (note the singular path segment: sub_issue)
gh api --method DELETE repos/{owner}/{repo}/issues/{parent}/sub_issue -F sub_issue_id=<child_db_id>
```

Add `-F replace_parent=true` to reparent a child that already has a parent. Reprioritize with `PATCH .../issues/{parent}/sub_issues/priority` (`sub_issue_id` + `after_id`/`before_id`).
