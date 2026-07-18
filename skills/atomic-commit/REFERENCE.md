# atomic-commit — Reference

Detailed mechanics for the [SKILL.md](SKILL.md) workflow.

## Detecting conventions

Run these against the actual repo before planning — the goal is to commit the way this repo already commits.

### Convention cache

Conventions change rarely and are identical on every branch, so persist them per-repo instead of re-detecting every run. This file is **shared with other TitusKirch skills** (`pull-request` reads the same convention for its PR title); it holds only the genuinely shared convention block, so either skill can rewrite it in the same schema — last writer wins, no coordination needed.

- **Location** — `$(git rev-parse --git-common-dir)/tituskirch-skills/conventions`. The owner-namespaced directory (`tituskirch-skills/`, matching the plugin name) lives in the _common_ git dir — shared by every branch and linked worktree, outside the working tree, never tracked — so the cache survives branch switches and can't be committed by accident. Create the directory before writing (`mkdir -p`).
- **Migration** — the old flat `$(git rev-parse --git-common-dir)/atomic-commit-cache` is obsolete. Don't read it; just re-detect once into the new path. Optionally `rm -f` the old file when writing the new one.
- **Validity (config hash, TTL only as fallback)** — how the cache is validated depends on whether a hashable config source exists. **With a config source** (`hash != none` — a `commitlint.config.*` / `.commitlintrc*` file, or a `commitlint` key in `package.json`) a hash match already proves the conventions are unchanged, so reuse on hash match alone, **regardless of age**. **Without one** (`hash = none` — conventions inferred from `git log`, which can drift silently as new commits land) age is the only staleness signal, so keep the 3-day TTL (259200 s). Re-detect and rewrite when the cache is missing, the hash differs, the fallback TTL has expired (`hash = none` only), or the user asks to refresh ("neu prüfen", "refresh", "--refresh").
- **Transparency** — when reusing, label it in the plan header, e.g. `Conventions (cached, 2d ago): …`, so staleness stays visible and the user can force a refresh.

Read and validate:

```bash
cache="$(git rev-parse --git-common-dir)/tituskirch-skills/conventions"
mkdir -p "$(dirname "$cache")"
now=$(date +%s)

# commitlint-config hash: dedicated config file if present, else the package.json
# commitlint key (conservative — any package.json edit re-detects), else "none".
cfg=$(ls commitlint.config.* .commitlintrc* 2>/dev/null | head -1)
if [ -n "$cfg" ]; then
  hash=$(cksum "$cfg" | cut -d' ' -f1)
elif grep -q '"commitlint"' package.json 2>/dev/null; then
  hash=$(cksum package.json | cut -d' ' -f1)
else
  hash=none
fi

if [ -f "$cache" ]; then
  detected_at=$(grep '^detected_at=' "$cache" | cut -d= -f2)
  cached_hash=$(grep '^commitlint_hash=' "$cache" | cut -d= -f2)
  # A hash match proves the conventions are unchanged when a config source
  # exists — reuse regardless of age. With no hashable source (hash=none,
  # conventions inferred from git log) the 3-day TTL is the only staleness signal.
  if [ "$hash" = "$cached_hash" ] && { [ "$hash" != none ] || [ $(( now - detected_at )) -lt 259200 ]; }; then
    echo "cache hit"   # reuse the stored conventions, skip the recipes below
  fi
fi
```

Write after a fresh detection (simple `key=value` lines — read back with `grep '^key=' "$cache" | cut -d= -f2-`, no `jq` needed):

```bash
cat > "$cache" <<EOF
detected_at=$now
commitlint_hash=$hash
scopes=yes
scope_count=47/50
types=feat fix docs chore ci
scope_vocab=write-readme atomic-commit ci dependabot changelog
language=en
header_max_length=72
commitlint=@commitlint/config-conventional
EOF
```

`header_max_length` is the resolved commitlint `header-max-length` (72 under config-conventional unless overridden); it lets `pull-request` reuse the same limit for PR titles without re-reading commitlint.

### Scope usage

```bash
git log --pretty='%s' -n 80 | grep -cE '^[a-z]+\([^)]+\)!?:'   # scoped subjects
git log --pretty='%s' -n 80 | grep -cE '^[a-z]+(\([^)]+\))?!?:' # all conventional subjects
```

- ≥ ~60% scoped → **use scopes**.
- ≤ ~40% scoped → **omit scopes**.
- In between, or fewer than ~10 conventional commits → check commitlint: a non-empty `scope-enum` means use scopes; otherwise default to no scope unless the changes map cleanly to packages/areas.

### Types in use

```bash
git log --pretty='%s' -n 200 | sed -E 's/^([a-z]+).*/\1/' | sort | uniq -c | sort -rn
```

Prefer types already present in the history over introducing new ones.

### Scope vocabulary

```bash
git log --pretty='%s' -n 200 | grep -oE '^[a-z]+\([^)]+\)' | sed -E 's/^[a-z]+\(([^)]+)\)/\1/' | sort | uniq -c | sort -rn
```

Reuse an existing scope when the change touches the same area. For a new area, infer the scope from the path: the package/app/dir name, or the single feature folder being touched (e.g. a skill name, a workspace package).

### commitlint config

Look in priority order: `commitlint.config.{js,cjs,mjs,ts}` → `.commitlintrc` / `.commitlintrc.{json,yaml,yml,js,cjs}` → a `"commitlint"` key in `package.json`. When it extends `@commitlint/config-conventional`, apply these defaults unless overridden: standard type list (below), non-empty subject, header ≤ 72 chars, **body lines ≤ 100 chars** (`body-max-line-length`), lowercase type & scope, no trailing period. Honor any explicit `type-enum`, `scope-enum`, `header-max-length`, `body-max-line-length`, or `subject-case` override as a **hard constraint** — a commit that violates it will be rejected by the hook.

Write multi-line bodies with real line breaks (e.g. `git commit -m "subject" -m $'line one\nline two'`) and wrap each line to the body limit. A body written as one long paragraph is the most common hook rejection — `body-max-line-length` counts every line, including the body you pass via a single `-m`.

### Language

```bash
git log --pretty='%s' -n 30
```

If subjects are consistently in another language, match it. Otherwise write English (the Conventional Commits norm).

> Worked detection example — this very repo: `commitlint.config.js` extends `@commitlint/config-conventional`; history shows `feat(write-readme):`, `ci(dependabot):`, `docs(changelog):` → scopes **on**, scope vocabulary = skill names + areas (`ci`, `dependabot`, `changelog`), language **English**.

## Config

`.tituskirch-skills.json` at the repo root (`$(git rev-parse --show-toplevel)`) is an optional, committed config shared across TitusKirch skills. Absent → behave exactly as before. Read with `jq`; if the file or `jq` is missing, ignore it (warn once) and fall back to detection. Resolution per setting: **config → detected/native → built-in default**.

Keys this skill reads:

| Key                   | Effect                                                                                           |
| :-------------------- | :----------------------------------------------------------------------------------------------- |
| `commit.language`     | commit-message language — any code/name (e.g. `en`, `de`) or `match`; overrides root + detection |
| `language` (root)     | shared default language; used when `commit.language` is unset                                    |
| `commit.scopes`       | force scope usage — `true` (always) / `false` (never) / `"auto"` (detect, the default)           |
| `commit.scopeVocab`   | preferred scope vocabulary (`string[]`), unioned with the detected scope words                   |
| `commit.instructions` | free-text wording guidance for the message (subject/body)                                        |

```bash
config="$(git rev-parse --show-toplevel)/.tituskirch-skills.json"
if [ -f "$config" ] && command -v jq >/dev/null 2>&1; then
  lang=$(jq -er '.commit.language // .language // empty' "$config" 2>/dev/null) || lang=
  scopes=$(jq -er '.commit.scopes // empty' "$config" 2>/dev/null) || scopes=          # true|false|auto
  scope_vocab_cfg=$(jq -er '(.commit.scopeVocab // []) | join(" ")' "$config" 2>/dev/null) || scope_vocab_cfg=
  instructions=$(jq -er '.commit.instructions // empty' "$config" 2>/dev/null) || instructions=
fi
```

**commitlint stays on top.** `commit.scopes` / `commit.scopeVocab` are _soft_ preferences that only fill a detection gap (thin history, an intended-but-unused vocabulary). They never override a commitlint rule the `commit-msg` hook enforces: if `scope-enum` exists, drop any `commit.scopeVocab` entry not in it; if `scope-empty` forbids/requires scopes, it beats `commit.scopes`. Format rules the hook owns — `header-max-length`, `body-max-line-length`, `subject-case` — have **no** config key on purpose: duplicating them here would create a second source of truth that can diverge from the hook. Set those in commitlint. `commit.instructions` is likewise additive — it shapes wording, never the guardrails.

`language` is a shared root key (it also drives `pull-request` and `issue`); `commit.language` overrides it for commit messages, mirroring `pr.language` / `issue.language`. `commit.instructions` mirrors `pr.instructions` / `issue.instructions`. Full schema: the repo-root `tituskirch-skills.schema.json`.

## Release-gated repos

Some repos ship only on a release, and **release-please cuts a release only for `feat:` (minor) and `fix:` (patch)** — `refactor`/`chore`/`perf`/`ci`/`docs`/`style`/`test`/`build` produce no version bump and no release. release-please's mapping is fixed; `changelog-sections` only changes changelog display, `versioning` only the bump size — the commit type is the only lever.

So when a repo uses release-please (detect via `release-please-config.json`, `.release-please-manifest.json`, or a workflow that runs `googleapis/release-please-action`):

- **When in doubt, `feat`/`fix` — never `refactor`.** The error is asymmetric: a change mis-typed `refactor` is silently dropped from the release and the changelog, while an over-typed `feat`/`fix` only adds a changelog line. Bias hard toward `feat`/`fix` whenever a change _could_ plausibly matter to a consumer.
- **Type by effect, not by how the diff looks.** A change that alters behavior or deployed/rendered state must be `feat`/`fix` so it actually ships — even if it reads like a restructure. This bites hardest in IaC/config (Terraform/OpenTofu, Helm, k8s YAML), where renaming or reordering can change the applied result (a rename can mean destroy + recreate), but it applies to ordinary code too.
- **When the changed files _are_ the shipped product, improving them is `feat`/`fix`.** In a skills, library, template, or docs-as-product repo the content _is_ the release — clarifying a description, tightening guardrails, deduping a body, or adjusting an API are user-facing improvements that belong in the changelog. Typing them `refactor` ships the work invisibly, which is the mistake this rule exists to prevent.
- **`refactor` is the narrow exception, not the default.** Reserve it for changes you are certain are effect-free and invisible to consumers (internal restructure of non-shipped code); even then, when unsure, prefer `feat`/`fix`.
- Advisory, not blocking: surface the type choice in the plan and offer to re-type. There is **no config switch** — the rule keys purely off release-please being present.

## Type catalogue (Conventional Commits)

| type     | use for                                                 |
| :------- | :------------------------------------------------------ |
| feat     | a new user-facing capability                            |
| fix      | a bug fix                                               |
| docs     | documentation only                                      |
| refactor | code change that neither fixes a bug nor adds a feature |
| perf     | a performance improvement                               |
| test     | adding or correcting tests                              |
| build    | build system or dependencies                            |
| ci       | CI configuration / pipelines                            |
| chore    | maintenance that touches neither src nor tests          |
| style    | formatting/whitespace, no change in code meaning        |
| revert   | reverts a previous commit                               |

`feat!:` / `fix!:` (or a `BREAKING CHANGE:` footer) marks a breaking change.

## Atomic grouping heuristics

Split the diff so each commit is the smallest change that stands on its own:

- **Separate by intent** — feature ≠ fix ≠ refactor ≠ docs ≠ tooling. Two intents = two commits.
- **Separate mechanical from meaningful** — a wide rename/format pass gets its own commit, away from logic changes, so review stays readable.
- **Keep a change with its enablers** — a new dependency plus the code that uses it can share a commit if the code is meaningless without it; otherwise split (deps first).
- **Tests with or after the code** — same commit when they are the proof of the feature; a separate `test:` commit when added for pre-existing code.
- **Order for a clean history** — prerequisites (config, deps, scaffolding) first, the feature in the middle, docs/chore last; each commit ideally leaves the tree building.

## Hunk-level staging

When one file holds changes that belong to different commits, stage only the relevant hunks.

### Preferred — build a partial patch and apply it to the index

1. Inspect the file's diff with context:
   ```bash
   git diff -- path/to/file
   ```
2. Write a patch keeping only the wanted hunks — preserve the `diff --git`, `index`, `---`/`+++`, and the chosen `@@ … @@` headers verbatim; drop the rest.
3. Apply just those hunks to the index, verify, commit:
   ```bash
   git apply --cached partial.patch
   git diff --cached --stat            # confirm only the intended hunks are staged
   git commit -m "type(scope): …"
   ```
   Add `--recount` to `git apply` if you trimmed context lines and the counts no longer match.
4. Repeat for the next commit's hunks; the rest stays in the working tree.

### Fallback — drive interactive add non-interactively

```bash
printf 'y\nn\nq\n' | git add -p path/to/file
```

Fragile: the answer sequence must match hunk order and prompts (`y/n/s/e/q`). Prefer the patch method; if you use this, always `git diff --cached` before committing.

### New (untracked) files

`git add -p` won't see them. Use `git add -N path/to/file` (intent-to-add) so its lines surface as hunks, or just `git add path/to/file` when the whole file belongs to one commit.

## Plan output

Present this before committing:

```text
Conventions (cached, 2d ago): scopes = yes (47/50) · types = feat fix docs chore ci · lang = en · commitlint = @commitlint/config-conventional

Proposed commits:
1. feat(auth): add password-based login endpoint
   ├─ src/auth/login.ts   (new file)
   └─ src/router.ts       (hunk: register POST /login)
   why: the core feature

2. test(auth): cover the login endpoint
   └─ tests/auth/login.test.ts  (new file)

3. docs(readme): document the auth flow
   └─ README.md           (hunk: "## Authentication" section)

Unassigned: none
```

In plan-only mode, follow the plan with the runnable commands, e.g.:

```bash
git add src/auth/login.ts
git apply --cached router-login.patch
git commit -m "feat(auth): add password-based login endpoint"
# …repeat per commit
```

## Worked example — a file that mixes concerns

`src/utils.ts` got two unrelated edits in one session: a new `formatDate` helper (the feature) and a fix to an existing `parseId` off-by-one (a bug). Plan:

1. `fix(utils): correct off-by-one in parseId` — only the `parseId` hunk.
2. `feat(utils): add formatDate helper` — only the `formatDate` hunk.

Stage each hunk via the partial-patch method, commit, verify, repeat — leaving the working tree clean at the end.
