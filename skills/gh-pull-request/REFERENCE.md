# gh-pull-request — Reference

Mechanics for the [SKILL.md](SKILL.md) workflow. Everything goes through the GitHub CLI (`gh`) against the `origin` remote — this skill is GitHub-only by design.

## Detecting conventions

### GitHub + base branch

```bash
gh repo view --json nameWithOwner,defaultBranchRef \
  --jq '{repo: .nameWithOwner, base: .defaultBranchRef.name}'
git branch --show-current        # head
```

If `gh repo view` errors, the repo has no GitHub remote or `gh` is not authenticated → **stop**; the skill is GitHub-only. Default the PR base to `defaultBranchRef.name`; never hardcode `main`/`dev`. Confirm `base ← head` in the plan and let the user override (`--base <other>`).

### PR template

Look in priority order: `.github/pull_request_template.md` → `.github/PULL_REQUEST_TEMPLATE.md` → `.github/PULL_REQUEST_TEMPLATE/*.md` (several → pick by name or ask) → `PULL_REQUEST_TEMPLATE.md` / `docs/PULL_REQUEST_TEMPLATE.md` → repo root. Use it verbatim as the body skeleton: fill its sections, keep its checklists and comments-as-prompts. No template → fall back to `## Summary`, `## Changes`, `## Related issues`.

### Title convention

Reuse the `atomic-commit` detection: a commitlint config (or a Conventional-Commits history) means the PR title is Conventional too — many repos lint it with actions like `amannn/action-semantic-pull-request`, and templates often say so outright. Honor `header-max-length` if commitlint sets it.

### Existing PR (and who owns it)

```bash
me=$(gh api user --jq .login)
gh pr list --head "$(git branch --show-current)" --state open \
  --json number,author,isDraft,title --jq '.[0]'
```

- No result → **create**.
- `author.login == $me` → offer to **update its body only**.
- `author.login != $me` (a teammate, or a `*[bot]` / automation such as a `dev → main` rollup) → **leave it untouched**; report number + author and stop.

## Title derivation (umbrella)

- **One commit** → use its subject verbatim.
- **Multiple commits** → one Conventional summary covering the branch:
  - **type** = the most significant present: `feat` > `fix` > `refactor`/`perf` > `docs`/`test`/`build`/`ci`/`chore`.
  - **scope** = the shared scope if every commit shares one; otherwise omit.
  - **subject** = imperative summary of the branch's net change, within the header limit.
  - any breaking commit (`!` or a `BREAKING CHANGE:` footer) → mark the title with `!`.
- Example: `feat(x): …` + `test(x): …` + `docs(x): …` → `feat(x): <summary>`.

## Body — filling the template

- **Summary** — what changed and why, from `git log <base>..HEAD` bodies + `git diff --stat <base>...HEAD`. Plain prose, no filler.
- **Type of change** — tick the box matching the umbrella type (feat → new skill/feature, fix → bug fix, docs → documentation, breaking → breaking change, chore → internal).
- **Checklist** — pre-tick only what you actually verified (e.g. `pnpm check` was run); leave the rest for the human.
- **Related issues** — `Closes #N` / `Refs #N` from commit messages or the branch name.
- Write the body to a temp file and pass `--body-file <file>` so multi-line markdown survives the shell.

## Plan output

Present this before creating:

```text
PR plan
  base ← head : main ← feat/cache      (base = repo default)
  title       : feat(atomic-commit): cache detected conventions
  state       : ready
  existing    : none → will create
  body ▼
    ## Summary
    …
Run: gh pr create --base main --head feat/cache --title "…" --body-file <tmp>
```

For an existing PR you own: `existing : #42 by you → will update body`, and the command becomes `gh pr edit 42 --body-file <tmp>`. For a PR owned by someone else: `existing : #42 by github-actions[bot] → leaving untouched` and stop.

## Worked example

Branch `feat/cache` with `feat(atomic-commit): add convention cache` + `docs(atomic-commit): document the cache`. Detected: base `main`, Conventional titles, PR template present, no open PR.

- Title: `feat(atomic-commit): cache detected conventions`
- Body: template Summary (cache + 3-day TTL + config hash, from the commits), "Skill update" and "Documentation" ticked, no linked issue.
- After confirmation: `gh pr create --base main --head feat/cache --title "feat(atomic-commit): cache detected conventions" --body-file /tmp/pr-body.md`.
