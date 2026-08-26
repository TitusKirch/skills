# Tracker — GitHub (`gh`)

The **GitHub** branch of `refine-issue` — reached when `work.tracker` (falling back to `issue.tracker`) resolves to `github`. Everything a run needs whatever its tracker stays in `REFERENCE.md`.

- **Read** — `gh issue view <n> --json title,body,comments,labels,createdAt,url` for the brief; the comments are part of it, judged by **Author authority** in `REFERENCE.md`.
- **Candidates** — the negative label search in **Finding the candidates** (`REFERENCE.md`); `gh label list` (via the cache) resolves what the lifecycle strings actually are.
- **Duplicates** — `gh search issues --repo <owner>/<repo> --state open`.
- **Write** — `gh issue edit <n> --body-file <tmp>`, once, after confirmation. The labels stay for the human: `gh issue edit <n> --add-label "<ready>" --remove-label "<needsTriage>"` is printed, never run — the second flag only where the label is configured and the issue carries it (**Report output** in `REFERENCE.md`).
