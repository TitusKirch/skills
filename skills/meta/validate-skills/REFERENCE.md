# validate-skills — Reference

Mechanics for [`validate-skills`](SKILL.md): the spec rule catalog and how each rule is tiered, discovering skills to validate, getting and running `skills-ref`, what to do when it cannot be obtained, the house-style tier, and where `skill-creator` sits.

## Principle

> The **spec verdict is `skills-ref`'s**; the agent's job is to run it, tier its output, and locate it — never to re-derive the rules. This is the same stance `update-deps` takes on the repo's own updater and `merge-deps` on the forge's own merge: drive the authoritative tool so its rules are honoured as they move, rather than freezing a copy that silently goes stale.

The [Agent Skills specification](https://agentskills.io/specification) is the standard; `skills-ref` is its reference validator. The catalog below is **orientation** — enough to explain a finding and to write the clearly-labelled fallback — but it is **not** the source of truth. When the catalog and `skills-ref` disagree, `skills-ref` wins, and this file is the thing to correct.

## The spec

What the standard defines for a skill, and which tier a deviation lands in.

### Directory structure

A skill is a **directory** whose only required member is `SKILL.md`. Optional, spec-named subdirectories: `scripts/` (executable code), `references/` (on-demand docs), `assets/` (static resources). Any other files may sit alongside.

### Frontmatter fields

`SKILL.md` opens with YAML frontmatter, then Markdown body. The settled frontmatter contract (`skills/README.md`, from the landed contract issue) tags every field **[standard]** (the open Agent Skills spec), **[Claude Code]** (a client extension the spec does not define), or **[house]** (a consuming repo's own field) — and that tag **is** the tier a stray key lands in: a **[standard]** breach is a **spec violation**, a **[Claude Code]** key is a **client extension (non-portable)**, a **[house]** field is **house style**.

**Standard fields [standard]** — the six the open standard defines; `skills-ref` enforces exactly these:

| Field           | Required | Spec constraint                                                                                                                                    | Tier of a breach                                                     |
| :-------------- | :------- | :------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------- |
| `name`          | Yes      | 1–64 chars; lowercase `a-z`, `0-9`, hyphens only; no leading/trailing hyphen; **no consecutive hyphens**; **must match the parent directory name** | **spec violation**                                                   |
| `description`   | Yes      | 1–1024 chars; non-empty; says what the skill does **and when to use it**                                                                           | length/empty → **spec violation**; weak wording → **house/advisory** |
| `license`       | No       | A license name or a reference to a bundled license file                                                                                            | **spec violation** only if malformed                                 |
| `compatibility` | No       | 1–500 chars if present; environment requirements                                                                                                   | **spec violation** if over length                                    |
| `metadata`      | No       | Map of **string keys to string values**; the conforming home for client-specific fields                                                            | **spec violation** if not a string map                               |
| `allowed-tools` | No       | Space-separated string of pre-approved tools; **Experimental** — support varies between agents                                                     | rarely a hard breach; note portability                               |

**Claude Code extensions [Claude Code]** — valid in Claude Code, **absent from the open standard**. A skill using one loads in Claude Code but **not** in a conformant client, so each is a **client extension (non-portable)** finding, never a spec violation. `skills-ref` does not know them — its allowlist is the six above — so it fails each as an `Unexpected fields in frontmatter` line, which the [re-tiering rule](#getting-and-running-skills-ref) moves into this tier:

| Field                      | Tier                                |
| :------------------------- | :---------------------------------- |
| `disallowed-tools`         | **client extension** (non-portable) |
| `when_to_use`              | **client extension** (non-portable) |
| `disable-model-invocation` | **client extension** (non-portable) |
| `arguments`                | **client extension** (non-portable) |
| `model`                    | **client extension** (non-portable) |
| subagent `context`         | **client extension** (non-portable) |

This is the **whole** known set — a top-level key outside both tables above is genuinely unrecognised and stays a **spec violation**.

**House fields [house]** — a consuming repo's own keys, carried **inside** `metadata` so the standard's string-map contract is never broken. This repo's is `metadata.summary`; its absence is a [house-style](#the-house-style-tier) finding, never a spec breach.

Two field notes that catch people out:

- **`name` must equal the folder name.** `skills-ref` checks this, and it is a real portability bug (a client keys the skill by its directory), so it is a **spec violation**, not house style.
- **`metadata` is a string→string map.** A nested non-string value (an object, a number) is a spec breach. This is why a house field like `summary` lives at `metadata.summary` **as a string** — the standard's sanctioned way to carry a client-specific field without violating the map contract. A `[Claude Code]` extension is the other way to carry a client-specific field — as a **top-level** key the client defines, which is exactly why `skills-ref` rejects it and why it is non-portable rather than a spec breach.

### Body and progressive disclosure — advisory

The spec places **no format restriction** on the body, but **recommends**: keep `SKILL.md` under ~500 lines / the body under ~5000 tokens, use progressive disclosure (push detail into `references/`), and keep file references **one level deep**. These are **recommendations**, so a long body is an **advisory** finding, never a spec violation. Surface it as advice.

## Discovering skills

- **One named skill** — the user gives a directory (or a `SKILL.md` path). Normalise a `SKILL.md` path to its parent directory (`skills-ref` does the same) and validate that one directory.
- **A whole repo** — a skill is any directory containing a `SKILL.md`. Enumerate portably:

```sh
# every skill directory in the repo, one per line — portable (no GNU-only -printf)
find . -name SKILL.md -not -path '*/node_modules/*' | sed 's|/SKILL\.md$||' | sort
```

This repo nests skills at `skills/<category>/<name>/SKILL.md` (categories `repo/`, `work/`, `docs/`, `meta/`), and already exposes the canonical list via `node scripts/gen-skills.ts --paths` — prefer a repo's own enumerator when it has one, since it encodes what that repo counts as a skill; fall back to the `find` above otherwise. Note that `--paths` prints `SKILL.md` **file** paths, not directories, so apply the same parent-directory normalisation as the "One named skill" bullet above before handing each to `skills-ref validate`, which takes a skill **directory** (the `find … | sed` snippet already emits directories; `--paths` does not). Do **not** treat a `references/`, `scripts/`, `assets/`, `templates/` or `evals/` subdirectory as a skill — only a directory that directly contains a `SKILL.md`.

## Getting and running skills-ref

`skills-ref` is a Python package in the [agentskills repo](https://github.com/agentskills/agentskills/tree/main/skills-ref), published as a **reference library for demonstration**, not a production tool — one more reason to drive it rather than depend on reimplementing its behaviour, and to report honestly when it is absent.

**Obtain it, cheapest first:**

```sh
# 1. Already installed?
command -v skills-ref && skills-ref --version

# 2. uv — run without a persistent install (the package lives in a subdirectory)
uvx --from "git+https://github.com/agentskills/agentskills.git#subdirectory=skills-ref" \
  skills-ref validate ./path/to/skill

# 3. pip into a throwaway venv (per skills-ref's own README)
python -m venv .venv && . .venv/bin/activate
pip install "git+https://github.com/agentskills/agentskills.git#subdirectory=skills-ref"
skills-ref validate ./path/to/skill
```

If the quick recipes fail, the **authoritative** install steps are in `skills-ref`'s own README (clone the repo, then `pip install -e .` or `uv sync` inside `skills-ref/`); fall back to those before declaring it unavailable.

**Subcommands:**

| Command                             | Purpose                                                                    |
| :---------------------------------- | :------------------------------------------------------------------------- |
| `skills-ref validate <path>`        | Conformance check — **the spec verdict**                                   |
| `skills-ref read-properties <path>` | Parsed frontmatter as JSON — useful to show the exact `description` length |
| `skills-ref to-prompt <path>...`    | The `<available_skills>` prompt block — not needed for validation          |

**`validate` output and exit codes** — parse these, do not re-judge them:

- **Exit `0`** — valid. Prints `Valid skill: <path>` to **stdout**.
- **Exit `1`** — invalid. Prints `Validation failed for <path>:` to **stderr**, then one line per problem, each indented and bulleted with a hyphen. Each such line is a **spec violation**; carry it into the report verbatim, attributed to the skill's `SKILL.md` — with the **one** exception below.

Run it once per skill directory so each skill gets its own verdict; a whole-repo run loops and tallies pass/fail.

### The one re-tiered line — `Unexpected fields in frontmatter`

`skills-ref` carries a fixed allowlist — its `validator.py` defines `ALLOWED_FIELDS` as exactly `{name, description, license, allowed-tools, metadata, compatibility}` — and `_validate_metadata_fields()` fails the **whole skill** for any top-level key outside it:

```
Unexpected fields in frontmatter: <keys>. Only [...] are allowed.
```

Because the [Claude Code extensions](#frontmatter-fields) are top-level keys the open standard does not define, this is the line they trip. So it is the **one** `skills-ref` line the run does **not** carry verbatim — split it by key:

- **A known Claude Code extension** — `disallowed-tools`, `when_to_use`, `disable-model-invocation`, `arguments`, `model`, subagent `context` — is re-tiered to the **client-extension (non-portable)** tier: valid in Claude Code, will not load in a conformant client.
- **Any other key** stays a **spec violation**, carried verbatim (a real unrecognised field, a typo like `descriptoin`).

**Why this is not a contradiction of [principle 1](#principle).** Re-tiering is not re-judging: `skills-ref`'s verdict — "this key is not in the open standard" — is accepted in full and **unchanged**. The re-tier only records _why_ the standard rejects a known extension (a named client defines it), turning "malformed" into "non-portable," which is the [distinction this skill exists to draw](SKILL.md). This is the **sole** place the run overrides `skills-ref`'s tiering, and it is called out here precisely so it never masquerades as a general licence to second-guess the tool. Run it over this repo and it is what keeps `work-implement-queue` and `work-review-queue` — whose deliberate, [documented](#the-house-style-tier) `disallowed-tools` key is a real Claude Code extension — off the spec-violation list where the verbatim rule would wrongly put them.

## When skills-ref is unavailable

The one thing never to do: report a weaker check as if it were the spec's verdict. If `skills-ref` cannot be obtained or cannot run:

1. **State the spec tier as UNVERIFIED**, with the reason (offline, no Python/uv, install failed).
2. **Optionally** run a best-effort manual frontmatter read against [the catalog above](#frontmatter-fields) — but only if every finding is labelled **"unverified (skills-ref unavailable)"** and the run **never** uses the word "valid". This best-effort pass can still catch the obvious (a `description` over 1024, an uppercase `name`, a `name` that does not match the folder), which is genuinely useful — provided it is never dressed up as the authoritative result.
3. **Do not** advance a whole-repo summary to "all pass" on an unverified run.

This mirrors `update-deps`: what the authoritative tool does not confirm is **reported as unconfirmed**, never smoothed over.

## The house-style tier

Tier 2 is the **consuming repo's own conventions** — portable, local choices the standard says nothing about. The rule that keeps the tiers honest: **a house rule is never reported as a spec violation.** If it does not come out of `skills-ref` (or the spec catalog), it is at most house style.

Where the conventions come from is the **repo's own contract**, not this skill's taste:

- **Read where the repo documents its house style** (a skills README, a CONTRIBUTING, a frontmatter contract) and check against that.
- **Run the repo's own house lint** where it has one, and attribute its findings to tier 2.
- A repo with **no** documented house style has **no tier-2 findings** — a clean result, not a gap to invent rules for.

### This repo, as the worked example

For the `TitusKirch/skills` repo the contract is the frontmatter section of `skills/README.md`, and the house gate is `pnpm skills:check` (which runs `scripts/gen-skills.ts --check`). House-style expectations here — each a **tier-2** finding, none a spec violation:

- **`metadata.summary` present** — this repo's own field (the one-liner in the generated README table). Its absence is house style, not a spec breach; the spec is satisfied by `metadata` being a string map.
- **`description` written as _when to act_** — imperative, keyword-rich, trigger phrases (with other-language variants), key use case first. A description that reads as _what the skill is_ is a house/advisory finding.
- **Naming** — folder = `name` = kebab-case; the **category** carries the grouping, so the name does not (`write-docs`, not `docs-write`). (Folder = `name` is _also_ the spec's rule, so a mismatch is a **spec** violation; the kebab-and-no-category-prefix convention is house.)
- **Category placement** — the skill sits under the right `skills/<category>/` folder (`repo/`, `work/`, `docs/`, `meta/`).
- **Generated artifacts in sync** — the six artifacts `pnpm skills:sync` produces are current (`pnpm skills:check` is the gate). Drift here is a repo-integrity finding, tier 2.
- **`skills.sh.json` YAML-safety** — an unquoted `summary`/`description` must not contain `": "` (colon-space) or `" #"` (space-hash), or the repo's own parser drops the skill. `gen-skills.ts` lints exactly this; surface it as tier 2.

Running `pnpm skills:check` and folding its output into tier 2 is the honest way to report this repo's house findings — the repo's own tool, the same way the spec tier uses the standard's own tool.

## skill-creator — adjacent, not a substitute

Anthropic's [`skill-creator`](https://github.com/anthropics/skills/tree/main/skills/skill-creator) was assessed alongside `skills-ref` and covers **different** ground. It is a Python **development** toolchain that scaffolds skills (`init_skill.py`), packages them (`package_skill.py`), and — the substantive overlap — runs **quality** loops: evals with baselines, grading, benchmark aggregation, and description optimisation for trigger accuracy, plus a browser review viewer.

The division of labour:

| Question                                                                        | Tool                          |
| :------------------------------------------------------------------------------ | :---------------------------- |
| **Is this a valid skill?** (frontmatter, spec)                                  | `skills-ref` → **this skill** |
| **Is this a _good_ skill?** (does it trigger, does it beat a no-skill baseline) | `skill-creator`               |

So `skill-creator` is the tool to **name and position**, not to drive from here: it does not perform spec conformance validation, and it ships a Python toolchain that a no-runtime-code repo does not vendor. Point a user at it for evals and description tuning; use **this** skill for conformance. This repo already frames `skill-creator` the same way — as the out-of-band evaluation tool, its output workspace data, not a repo artifact.

## CI wiring — out of scope

Whether a repo runs `validate-skills` (or `skills-ref` directly) as a CI gate is a **separate decision**, deliberately not made here. The skill validates on demand; turning that into a required check is a small, later choice for whoever owns the repo's CI, once the skill exists.
