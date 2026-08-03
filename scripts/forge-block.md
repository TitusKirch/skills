Canonical rule for picking a forge driver and resolving the host it talks to.
`scripts/gen-skills.ts` writes it inside each skill's `<skills-forge>` element; `pnpm
skills:check` fails if a copy drifts. Edit it here, never in a skill.

Everything below is self-contained on purpose: a skill can be installed on its own, so it
must not link to another skill or to a file at the repo root.

Two facts travel together here because they fail together. **Which** forge a repo uses was
already a config key; **which host** that forge lives on never was, and every skill assumed
one. Self-hosted GitLab is the normal GitLab deployment rather than the exception, and
GitHub Enterprise has exactly the same shape, so a host resolved once and reused is a bug
that only shows up in the second repo a session touches.

It is mirrored into the skills that **drive** a forge — `merge-deps`, `pull-request`,
`prune-branches`, `issue`, `work-implement`, `work-review`. `release` is deliberately out:
it is GitHub-only, and stating that is its own change rather than something to paper over
with a resolution rule it does not follow. `merge-deps` was out for the same reason and no
longer is — its author guarantee proved reproducible on GitLab from a configured identity,
so it drives both forges. The two work queues name their worker's REFERENCE for it, as they
already do for the config contract and the lock spec.

<!-- forge:body -->

## The forge and its host

Two questions, answered in this order and never merged: **which forge** drives this repo, and **which host** that forge lives on. The first is a config key with a default; the second is a per-repo fact with a resolution ladder, and the reason it has a ladder is that a session working two repos may reach two different instances.

### Which forge

The root `forge` key, resolved from the config, defaulting to `github`:

```sh
# $resolved comes from the resolver — see "Reading the config" in this file.
forge=$(printf '%s' "$resolved" | jq -er '.forge // empty' 2>/dev/null) || forge=
[ -n "$forge" ] || forge=github
```

| `forge`  | CLI    | Availability check | The thing it opens       |
| :------- | :----- | :----------------- | :----------------------- |
| `github` | `gh`   | `gh auth status`   | a **pull request** (PR)  |
| `gitlab` | `glab` | `glab auth status` | a **merge request** (MR) |

**Speak the forge's own vocabulary in everything a human reads.** On GitLab it is a merge request, a source branch and a target branch, and the templates live under `.gitlab/merge_request_templates/`; calling it a pull request in a plan, a title or a comment is how a reader stops trusting that the run knows where it is. The skills' own trigger phrases stay bilingual — a user asking for "a PR" on a GitLab repo means the MR — but the **output** follows the forge.

**A forge a skill does not implement is a stop, never a degrade.** Say which forge the config names, that this skill does not drive it, and stop. Never fall back to raw `git` plumbing, and never assume `github` because it is the default — a repo that wrote `gitlab` said something, and quietly serving it GitHub is worse than refusing.

**A CLI that is absent or unauthenticated is the same kind of stop.** Report which CLI was looked for and which host it was asked about, so the fix is one command (`gh auth login`, `glab auth login --hostname <host>`) rather than a hunt.

### Which host

Resolution is a ladder, most specific first. **Take the first that answers; never resolve it once for a session and reuse it.**

1. **The config** — the root `forgeHost` key, a bare hostname with an optional port. Explicit, committed, and the only rung a repo can state for itself.
2. **The `origin` remote** — the host in the repo's own remote URL. This is a repo-level fact and it is why the ladder does not start at the CLI: the remote is what the checkout actually points at.
3. **What the CLI is already configured for** — `GITLAB_HOST` or `glab`'s configured host; `GH_HOST` or `gh`'s `hosts.yml`. This rung is **global**, so it is the last one: it answers "what does this machine usually talk to", not "what does this repo talk to".

```sh
host=$(printf '%s' "$resolved" | jq -er '.forgeHost // empty' 2>/dev/null) || host=
if [ -z "$host" ]; then
  # Strip scheme, userinfo and path from whatever shape the remote is written in:
  #   git@host:group/repo.git · ssh://git@host:2222/group/repo · https://host/group/repo
  url=$(git remote get-url origin 2>/dev/null) || url=
  host=$(printf '%s' "$url" | sed -e 's|^[a-zA-Z][a-zA-Z0-9+.-]*://||' -e 's|^[^@/]*@||' -e 's|[:/].*$||')
fi
# Still empty → let the CLI use whatever it is already configured for, and say so.
```

**Authentication is never duplicated.** The ladder resolves a _name_; the CLI holds the credentials. Pass the resolved host to the CLI rather than re-implementing login — `GH_HOST=<host> gh …`, `GITLAB_HOST=<host> glab …` — and where the host came from rung 3, pass nothing and let the CLI keep its own default.

**Name the host in the plan whenever it is not the forge's public one.** `gitlab.example.com` in the `base ← head` line, the candidate list or the run report is the one signal a reader has that the run is pointed at their instance and not at `gitlab.com`. Where the host came from rung 2 or 3 rather than the config, say which — a derived host is a guess that happened to be right, and it is worth one clause.

**Two repos in one session are two resolutions.** Re-run the ladder per repo, and treat a cached host the way a cached config is treated: keyed by the checkout it was read in, never by the session.
