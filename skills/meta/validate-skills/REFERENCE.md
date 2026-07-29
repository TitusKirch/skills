# validate-skills — Reference

Mechanics for [`validate-skills`](SKILL.md): the spec rule catalog and how each rule is tiered, discovering skills to validate, getting and running `skills-ref`, what to do when it cannot be obtained, the house-style tier and its cross-skill-reference pass, and where `skill-creator` sits.

## Principle

> The **spec verdict is `skills-ref`'s**; the agent's job is to run it, tier its output, and locate it — never to re-derive the rules. This is the same stance `update-deps` takes on the repo's own updater and `merge-deps` on the forge's own merge: drive the authoritative tool so its rules are honoured as they move, rather than freezing a copy that silently goes stale.

The [Agent Skills specification](https://agentskills.io/specification) is the standard; `skills-ref` is its reference validator. The catalog below is **orientation** — enough to explain a finding and to write the clearly-labelled fallback — but it is **not** the source of truth. When the catalog and `skills-ref` disagree, `skills-ref` wins, and this file is the thing to correct.

## The spec

What the standard defines for a skill, and which tier a deviation lands in.

### Directory structure

A skill is a **directory** whose only required member is `SKILL.md`. Optional, spec-named subdirectories: `scripts/` (executable code), `references/` (on-demand docs), `assets/` (static resources). Any other files may sit alongside.

### Frontmatter fields

`SKILL.md` opens with YAML frontmatter, then Markdown body. The settled frontmatter contract (`skills/README.md`, from the landed contract issue) tags every field **[standard]** (the open Agent Skills spec), **[client]** — written as the defining client's name, **[Claude Code]** or **[Cursor]** — or **[house]** (a consuming repo's own field), and that tag **is** the tier a stray key lands in: a **[standard]** breach is a **spec violation**, a **[client]** key is a **client extension (non-portable)**, a **[house]** field is **house style**.

**Standard fields [standard]** — the six the open standard defines; `skills-ref` enforces exactly these:

| Field           | Required | Spec constraint                                                                                                                                    | Tier of a breach                                                     |
| :-------------- | :------- | :------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------- |
| `name`          | Yes      | 1–64 chars; lowercase `a-z`, `0-9`, hyphens only; no leading/trailing hyphen; **no consecutive hyphens**; **must match the parent directory name** | **spec violation**                                                   |
| `description`   | Yes      | 1–1024 chars; non-empty; says what the skill does **and when to use it**                                                                           | length/empty → **spec violation**; weak wording → **house/advisory** |
| `license`       | No       | A license name or a reference to a bundled license file                                                                                            | **spec violation** only if malformed                                 |
| `compatibility` | No       | 1–500 chars if present; environment requirements                                                                                                   | **spec violation** if over length                                    |
| `metadata`      | No       | Map of **string keys to string values**; the conforming home for client-specific fields                                                            | **spec violation** if not a string map                               |
| `allowed-tools` | No       | Space-separated string of pre-approved tools; **Experimental** — support varies between agents                                                     | rarely a hard breach; note portability                               |

**Client extensions [client]** — fields a **named client** defines that the open standard does not. A skill carrying one loads in the clients that define it and **not** in a conformant client that rejects unknown keys, so each is a **client extension (non-portable)** finding, never a spec violation. `skills-ref` knows none of them — its allowlist is the six above — so it fails each as an `Unexpected fields in frontmatter` line, which the [re-tiering rule](#the-one-re-tiered-line--unexpected-fields-in-frontmatter) moves into this tier.

**Which client defines a field is part of the finding**, not merely that the standard does not. Two of these keys are defined by **more than one** client with the same name and the same meaning, so reporting them as "Claude-only, will not load elsewhere" states something untrue and talks an author out of portability they never lost:

<a id="the-extension-matrix"></a>

| Field                      | Defined by          |
| :------------------------- | :------------------ |
| `agent`                    | Claude Code         |
| `argument-hint`            | Claude Code         |
| `arguments`                | Claude Code         |
| `background`               | Claude Code         |
| `context`                  | Claude Code         |
| `disable-model-invocation` | Claude Code, Cursor |
| `disallowed-tools`         | Claude Code         |
| `effort`                   | Claude Code         |
| `globs`                    | Cursor              |
| `hooks`                    | Claude Code         |
| `model`                    | Claude Code         |
| `paths`                    | Claude Code, Cursor |
| `shell`                    | Claude Code         |
| `user-invocable`           | Claude Code         |
| `when_to_use`              | Claude Code         |

This table is the **single** list of re-tiered keys; everything else that needs one — the re-tiering rule below, a consuming repo's unattended gate — reads it from here rather than keeping a second copy.

Where the counts come from, because they are easy to state wrongly:

- **Claude Code documents seventeen frontmatter fields** ([its reference](https://code.claude.com/docs/en/skills)). Three of them are **standard** — `name`, `description` and `allowed-tools`, the last flagged Experimental by the spec but on `skills-ref`'s allowlist all the same — which leaves the **fourteen** Claude Code rows above. A count of fifteen comes from filing `allowed-tools` as an extension; `skills-ref` accepts it, so it is never re-tiered.
- **Cursor documents five** ([its reference](https://cursor.com/docs/skills)): `name`, `description` and `metadata` from the standard, plus `paths` and `disable-model-invocation` — its own fields, sharing Claude Code's names and semantics. `globs` is its **legacy** spelling of `paths`, still accepted for older skills and not for new ones. It documents no `license`, `compatibility` or `allowed-tools`.

Fourteen plus `globs` is the fifteen rows above. A top-level key outside this table and the standard's six is genuinely unrecognised and stays a **spec violation**.

**House fields [house]** — a consuming repo's own keys, carried **inside** `metadata` so the standard's string-map contract is never broken. This repo's is `metadata.summary`; its absence is a [house-style](#the-house-style-tier) finding, never a spec breach.

Two field notes that catch people out:

- **`name` must equal the folder name.** `skills-ref` checks this, and it is a real portability bug (a client keys the skill by its directory), so it is a **spec violation**, not house style.
- **`metadata` is a string→string map.** A nested non-string value (an object, a number) is a spec breach. This is why a house field like `summary` lives at `metadata.summary` **as a string** — the standard's sanctioned way to carry a client-specific field without violating the map contract. A **[client]** extension is the other way to carry a client-specific field — as a **top-level** key the client defines, which is exactly why `skills-ref` rejects it and why it is non-portable rather than a spec breach. A **Codex sidecar** is the third, and the only one that costs nothing.

### Codex — the sidecar convention

Codex extends **without** breaking conformance, and it is the reason the [tier table](SKILL.md#three-tiers-of-finding) cannot be read as "extending costs portability." Its `SKILL.md` frontmatter is `name` and `description` only; everything else lives beside the file, in an optional **`<skill>/agents/openai.yaml`** ([its docs](https://learn.chatgpt.com/docs/build-skills)):

| Key            | Holds                                                                                                                           |
| :------------- | :------------------------------------------------------------------------------------------------------------------------------ |
| `interface`    | ChatGPT desktop presentation — `display_name`, `short_description`, `icon_small`, `icon_large`, `brand_color`, `default_prompt` |
| `policy`       | `allow_implicit_invocation` — `false` keeps the skill off automatic selection                                                   |
| `dependencies` | `tools` — the MCP servers and other external dependencies the skill needs                                                       |

**A sidecar belongs in no violation tier at all.** The spec permits arbitrary files alongside `SKILL.md`, so `agents/openai.yaml` costs a conformant client nothing — it is an extension that stayed portable. Report it as a **fact**:

- **Present** — name it and say what it configures. Malformed YAML in it is a finding against **Codex**, not against the spec.
- **Absent** — a client this skill does not target. That is information, **never** a fault, and it must not be phrased as one.

The contrast is the useful part of the report: an author reaching for a Claude Code frontmatter key is choosing the design that spends conformance, and a portable equivalent may sit one directory over. Say so where it applies — for UI naming, an invocation policy, or a tool dependency, the sidecar does the same job at no cost.

### OpenCode — the tolerance that makes non-portability a spectrum

OpenCode adds **no** fields of its own and documents that **unknown frontmatter fields are ignored** ([its docs](https://opencode.ai/docs/skills)), so a Claude-extended skill still loads there. That one line is what turns "non-portable" from a verdict into a range, and the report should carry it:

| A non-standard key is …                           | by                                                     |
| :------------------------------------------------ | :----------------------------------------------------- |
| **rejected** — the whole skill fails validation   | a conformant validator (`skills-ref`)                  |
| **ignored** — the skill loads, the field does not | OpenCode, and any client that tolerates unknown fields |
| **honoured** — the field does what it says        | whichever clients define it                            |

So "will not load elsewhere" is the strict-validator end of that range, not the whole of it. Say which end a finding sits at.

**Not tracked, deliberately.** Gemini CLI and GitHub Copilot follow agentskills.io and document no frontmatter of their own, so there is nothing to tier and adding them would change no verdict. The four above are the clients this repo publishes for and the only ones that currently differ.

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

**Recipes 2 and 3 will ask before they run, and that is the design.** This skill's `allowed-tools` pre-approves what it uses to _look_ — `find`, `sed`, `sort`, `grep`, `command -v`, and `skills-ref` itself — and deliberately stops short of `uvx`, `pip` and `python -m venv`. Those install code from the network, which is the one action here worth a human's eye, and this skill is invoked by a person who is present to give it: its guardrail is [**Report, do not repair**](SKILL.md#guardrails), so there is no unattended run for a prompt to stall. The field is pre-approval, not restriction — an unlisted command still runs, it just asks first — so leaving the installers off costs one confirmation and buys a skill that cannot install anything without being asked. The repo's own house lint is off the list for the same reason from the other direction: it is whatever the repo declares, so no fixed pattern could pre-approve it honestly.

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

Because the [client extensions](#frontmatter-fields) are top-level keys the open standard does not define, this is the line they trip. So it is the **one** `skills-ref` line the run does **not** carry verbatim — split it by key:

- **A known client extension** — any key in [the extension matrix](#the-extension-matrix) — is re-tiered to the **client-extension (non-portable)** tier, **named with the clients that define it**: `disallowed-tools` is Claude Code's alone, `paths` is Claude Code's _and_ Cursor's, and those are different portability facts.
- **Any other key** stays a **spec violation**, carried verbatim (a real unrecognised field, a typo like `descriptoin`).

**The matrix is the list; do not re-type it here.** A second enumeration in this section is how the two go out of step — the copy in prose that a new field is added to, and the one that quietly is not. A consuming repo whose unattended gate reproduces the rule owes the same discipline: mirror the matrix and pin the mirror to it ([this repo does](#this-repo-as-the-worked-example)).

**Why this is not a contradiction of [principle 1](#principle).** Re-tiering is not re-judging: `skills-ref`'s verdict — "this key is not in the open standard" — is accepted in full and **unchanged**. The re-tier only records _why_ the standard rejects a known extension (a named client defines it), turning "malformed" into "non-portable," which is the [distinction this skill exists to draw](SKILL.md). This is the **sole** place the run overrides `skills-ref`'s tiering, and it is called out here precisely so it never masquerades as a general licence to second-guess the tool. Run it over this repo and it is what keeps `work-implement-queue` and `work-review-queue` — whose deliberate, [documented](#the-house-style-tier) `disallowed-tools` key is a real Claude Code extension — off the spec-violation list where the verbatim rule would wrongly put them.

**Re-tiering is not absolution.** A re-tiered key still fails `skills-ref`, and the skill still does not load in a client that validates strictly — the tier records what the author traded, it does not undo the trade. Where the same job has a portable form, say so: `disable-model-invocation` and `paths` cost less than the matrix's Claude-only rows because Cursor honours them too, and UI naming, invocation policy or a tool dependency has a [Codex sidecar](#codex--the-sidecar-convention) that costs nothing at all.

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

### Cross-skill references

The one place a skill makes an assumption about its **install environment**. Every skill installs on its own, so a sibling it refers to may simply not be present — and neither half of that is something the standard speaks to, which is why both land here in tier 2 and never in the spec tier. Check it only where the repo's contract carries the rule, the same gate as every other tier-2 rule; a repo that has not adopted it gets no finding.

**Rule 1 — the reference names the skill, never a path.** A path is a path whether or not it is a link, and all three forms dangle identically on an installed copy:

| Form                               | Example                                     | Caught by a link lint? |
| :--------------------------------- | :------------------------------------------ | :--------------------- |
| Relative link out of the folder    | `[…](../work-review/REFERENCE.md)`          | yes                    |
| Absolute install path              | `~/.claude/skills/work-review/REFERENCE.md` | no                     |
| Bare path in prose, no link at all | `` `work-review/REFERENCE.md` ``            | **no**                 |

A repo's own link lint (here `test/isolation.test.ts`) reads `](…)` targets, so it sees row 1 only — run it and fold its output into tier 2, but rows 2 and 3 are this pass's job, and the lint does not travel to a consuming repo at all.

**Rule 2 — a reference that is a call declares its kind.** _Required_ → the skill states that the run **stops** when the sibling is absent, and why. _Optional_ → it states the **fallback** (degrade, skip that pass, carry on). A reference that only **mentions** another skill needs no declaration, and adding one to a mention is as much a false positive as missing an undeclared call.

**The call/mention test is the verb, not the noun** — does the run _hand work over_?

| Reads like                                                                                                    | Kind        | Wants a declaration |
| :------------------------------------------------------------------------------------------------------------ | :---------- | :------------------ |
| "delegate each issue to `work-implement`", "commit via `atomic-commit`", "open the PR through `pull-request`" | **call**    | yes                 |
| "committing is `atomic-commit`'s job", "the complement to `write-readme`", "`work-review` reviews them next"  | **mention** | no                  |

**Running the pass.** Two greps locate candidates; the verdict is the read.

```sh
# 1. the repo's skill names — the only names that count as a sibling
find . -name SKILL.md -not -path '*/node_modules/*' | sed 's|/SKILL\.md$||;s|.*/||' | sort -u

# 2. path-shaped references in one skill's shipped markdown (locator, not verdict)
grep -rnE '(\.\./|~/\.claude/skills/|[a-z0-9-]+/)[A-Za-z0-9._-]+\.md' <skill-dir> --include='*.md'

# 3. every place this skill names another one — the call/mention candidates
#    names.txt = step 1's list, minus the skill's own name
grep -rnwF -f names.txt <skill-dir> --include='*.md'
```

Then judge each hit:

- **A path is a finding only when it leaves the skill** — `../…`, `~/.claude/skills/…`, or a first segment matching **another skill's name** from step 1. A path into the skill's own `references/`, `scripts/`, `assets/` or `templates/` is internal and correct.
- **Attribute a name hit to the longest match.** `grep -w` treats `-` as a word boundary, so `work-implement` matches inside `work-implement-queue`; without preferring the longer name every queue skill looks like a reference to its own unit.
- **Only enumerated names are siblings.** `skills-ref`, `skill-creator` and a repo's own CLI are tools, not skills — check hits against step 1's list, never against anything merely skill-shaped.
- **Code spans cut both ways.** A path inside a fence or backticks may be **content the skill generates** (a badge path in a README template) — not navigation, not a finding. But a prose path in backticks _is_ a reference. What decides is what the span **is**, not that it is code, which is why stripping code wholesale — the right move for a link lint — would blind this pass to exactly the form it exists to catch.

### This repo, as the worked example

For the `TitusKirch/skills` repo the contract is `skills/README.md` — its frontmatter section and its "Referring to another skill" section — and the house gate is `pnpm skills:check` (which runs `scripts/gen-skills.ts --check`), alongside `pnpm test`, whose `test/isolation.test.ts` is the repo's link lint. House-style expectations here — each a **tier-2** finding, none a spec violation:

- **`metadata.summary` present** — this repo's own field (the one-liner in the generated README table). Its absence is house style, not a spec breach; the spec is satisfied by `metadata` being a string map.
- **`description` written as _when to act_** — imperative, keyword-rich, trigger phrases (with other-language variants), key use case first. A description that reads as _what the skill is_ is a house/advisory finding.
- **Naming** — folder = `name` = kebab-case; the **category** carries the grouping, so the name does not (`write-docs`, not `docs-write`). (Folder = `name` is _also_ the spec's rule, so a mismatch is a **spec** violation; the kebab-and-no-category-prefix convention is house.)
- **Category placement** — the skill sits under the right `skills/<category>/` folder (`repo/`, `work/`, `docs/`, `meta/`).
- **Generated artifacts in sync** — the six artifacts `pnpm skills:sync` produces are current (`pnpm skills:check` is the gate). Drift here is a repo-integrity finding, tier 2.
- **`skills.sh.json` YAML-safety** — an unquoted `summary`/`description` must not contain `": "` (colon-space) or `" #"` (space-hash), or the repo's own parser drops the skill. `gen-skills.ts` lints exactly this; surface it as tier 2.
- **[Cross-skill references](#cross-skill-references)** — a sibling is named, never pathed, and a call to one declares required or optional with its behaviour on absence. This repo is a multi-skill repo whose skills are installed individually, so both halves bite; `test/isolation.test.ts` covers the link form, and the prose-path and declaration halves come from the read.

Running `pnpm skills:check` and folding its output into tier 2 is the honest way to report this repo's house findings — the repo's own tool, the same way the spec tier uses the standard's own tool.

**The spec tier has a repo-side mirror too.** `scripts/check-conformance.sh` (`pnpm skills:conformance`, wired to its own workflow) runs `skills-ref` over every skill unattended, so it has to carry [the extension matrix](#the-extension-matrix) — an exit-code gate alone would call the two queue skills' deliberate `disallowed-tools` a failure. It is a **mirror of this file, not a second source**, and `test/conformance-gate.test.ts` pins the two together key-for-key **and client-for-client**: adding a row here without adding it there fails `pnpm test`, which is the point.

## skill-creator — adjacent, not a substitute

Anthropic's [`skill-creator`](https://github.com/anthropics/skills/tree/main/skills/skill-creator) was assessed alongside `skills-ref` and covers **different** ground. It is a Python **development** toolchain that scaffolds skills (`init_skill.py`), packages them (`package_skill.py`), and — the substantive overlap — runs **quality** loops: evals with baselines, grading, benchmark aggregation, and description optimisation for trigger accuracy, plus a browser review viewer.

The division of labour:

| Question                                                                        | Tool                          |
| :------------------------------------------------------------------------------ | :---------------------------- |
| **Is this a valid skill?** (frontmatter, spec)                                  | `skills-ref` → **this skill** |
| **Is this a _good_ skill?** (does it trigger, does it beat a no-skill baseline) | `skill-creator`               |

So `skill-creator` is the tool to **name and position**, not to drive from here: it does not perform spec conformance validation, and it ships a Python toolchain that a no-runtime-code repo does not vendor. Point a user at it for evals and description tuning; use **this** skill for conformance. This repo already frames `skill-creator` the same way — as the out-of-band evaluation tool, its output workspace data, not a repo artifact.

## CI wiring — the repo's decision, not the skill's

Whether a repo runs `validate-skills` (or `skills-ref` directly) as a CI gate is a **separate decision**, deliberately not made here. The skill validates on demand; turning that into a required check is a choice for whoever owns the repo's CI. This repo has since made it — `pnpm skills:conformance` and its own workflow, [described above](#this-repo-as-the-worked-example) — which changes nothing about the skill: an unattended gate that reproduces the re-tiering rule is a **consumer** of this file, and owes it a pinned mirror rather than a divergent copy.
