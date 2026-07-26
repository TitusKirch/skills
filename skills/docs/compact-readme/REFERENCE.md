# compact-readme — reference

Supporting detail for the [`compact-readme`](SKILL.md) skill: the collapse patterns, and a worked before/after from the envprism repo.

## `<details>` patterns

GitHub renders `<details>` as a native disclosure widget. Keep the `<summary>` short and descriptive; leave a blank line after `</summary>` so the markdown inside renders.

**Full feature list** (categorized superset — every original bullet survives, just grouped):

```markdown
<details>
<summary>Full feature list</summary>

### Discovery & comparison

- **🔍 Auto-discovery** — …
- **🧮 Matrix view** — …

### Editing & write-back

- **✏️ Edit-or-add** — …

</details>
```

**All configuration options** (verbatim tables, only moved):

```markdown
<details>
<summary>All configuration options</summary>

### `discovery`

| Option | Default | What it does |
| :----- | :------ | :----------- |
| …      | …       | …            |

</details>
```

Rules:

- The visible highlights are a **subset** chosen for impact; the `<details>` is the **superset**. Don't drop a bullet on the floor — if it's not a highlight, it goes in the details block.
- Tables move **verbatim** — same columns, same defaults, same wording. Compacting never edits a value.
- Keep it all in one `README.md`. Spinning out to `docs/` is opt-in only.

## Bold-density fix

Before — everything shouted, nothing stands out:

```markdown
- **🧮 Matrix view** — **every** `.env*` file becomes a **column**, every variable a **row**, so **n-way differences** are **visible at a glance**.
```

After — bold the lead phrase only:

```markdown
- **🧮 Matrix view** — every `.env*` file becomes a column, every variable a row, so n-way differences are visible at a glance.
```

## Merging Install + Quick start, requirement stated once

Before (requirement repeated in hero subtitle, an install note, and a separate quick-start callout). After — one merged section, one `> [!IMPORTANT]` callout:

```markdown
## 📦 Install & run

> [!IMPORTANT]
> envprism runs on **[Bun](https://bun.sh/)** 1.3+, not Node. The TUI links a native core via `bun:ffi`, so `npx envprism` will **not** work — [install Bun](https://bun.sh/) first.

​`bash
bun add -g envprism     # install globally
bunx envprism           # …or run without installing
​`
```

## Worked before/after — envprism

The method was proven on the [envprism](https://github.com/TitusKirch/envprism) README: **~194 → ~98 visible lines**, zero information lost.

What moved where:

| Original (visible)                                                | Action                   | New home                                                                 |
| :---------------------------------------------------------------- | :----------------------- | :----------------------------------------------------------------------- |
| ~25-bullet feature wall (regexes, every keybinding, theme keys)   | trimmed to ~8 highlights | full categorized list folded into `<details>Full feature list</details>` |
| 5 large config/option tables + theme-key list                     | collapsed                | `<details>All configuration options</details>`, tables copied verbatim   |
| Separate `Installation` and `Quick start` sections                | merged                   | one `📦 Install & run`                                                   |
| "needs Bun / `npx` won't work" stated 3× (hero, install, callout) | deduped                  | one `> [!IMPORTANT]` callout in Install & run                            |
| "round-trip preserving" claim repeated                            | deduped                  | once in the hook, once on the relevant detail bullet                     |
| 3-paragraph Why section                                           | tightened                | 2 paragraphs, voice intact                                               |

Left untouched: hero block, badges, demo GIF, links, license/author line, every table's contents.

## Config

**This skill owns no config section.** It reads one key another section already owns, and only to decide whether `docs/` may be offered as a destination for cut detail:

| Key    | Use                                                                                                    |
| :----- | :----------------------------------------------------------------------------------------------------- |
| `docs` | `false` → the repo has docs turned off; never offer "move to `docs/`". Absent or an object → offer it. |

```bash
# $resolved comes from the resolver — see "Reading the config" in this file.
# `// empty` would collapse `false` into "absent" — the one value that matters here.
docs=$(printf '%s' "$resolved" | jq -er '.docs | select(. != null) | tostring' 2>/dev/null) || docs=
[ "$docs" = "false" ] && offer_docs=no || offer_docs=yes
```

Reading the **resolved** config is what makes this correct under a profile: a repo whose `ci` profile sets `docs: false` disables the destination only in that context, and the raw file would never show it.

<skills-config>

### Reading the config

The config is `.tituskirch-skills.json` at the **consuming repo's** root — committed, optional, and shared by every TitusKirch skill. Absent means detection and built-in defaults, never an error. Its keys, types and defaults are defined by [`tituskirch-skills.schema.json`](https://raw.githubusercontent.com/TitusKirch/skills/main/tituskirch-skills.schema.json).

**Resolve it before reading it.** A repo may define `profiles` — named overlays for an execution context, so a remote runner can open pull requests where a local session commits directly. [`templates/resolve-config.sh`](templates/resolve-config.sh) prints the resolved config, and every skill ships the same copy, so they all see the same values:

```sh
# Fill in this skill's own directory — the path this file was loaded from, not the
# repo being worked on. It is a blank to fill, not a variable that is already set.
skill=/absolute/path/to/this/skill

resolved=$(sh "$skill/templates/resolve-config.sh"); status=$?
case $status in
0)  [ -n "$resolved" ] || resolved='{}' ;;   # ran fine; empty means the repo has no config
10) resolved= ;;                           # no jq — read the file yourself, see below
*)  echo "resolve-config failed ($status)" >&2; exit 1 ;;
esac
```

**A failure here is never silent.** Any exit other than `0` or `10` means the resolver could not be found or could not run, and the only wrong response is to carry on with `{}` — that reports the repo's defaults as if they were its settings. Stop and say what failed.

The profile comes from `TITUSKIRCH_SKILLS_PROFILE`, falling back to `ci` when `CI` holds a truthy value, and to no profile otherwise. An unset or unknown name yields the base config unchanged.

**The merge is a rule, not just a command.** Objects merge recursively at any depth, arrays and scalars are replaced rather than concatenated, an explicit `null` sets null rather than deleting a key, and `profiles` is dropped from the result. Any path that resolves the config by other means owes the same semantics.

**`jq` may not be installed.** It ships preinstalled on none of Windows, macOS or Linux, and `gh`'s built-in `--jq` is no substitute — that filters API responses, it cannot read a local file. `resolve-config.sh` exits `10` in that case. Do **not** fall through to defaults: `Read` the file, apply the merge rule above, and carry on with the repo's real values. Nothing else is needed — no Node, no Python.

**Guard every read, resolve into a variable, then use it.** Never let a substitution reach a command flag directly — `jq -r` prints the literal string `null` for a missing key, and an empty value is silently ignored by some tools rather than matching nothing:

```sh
value=$(printf '%s' "$resolved" | jq -er '.section.key // empty' 2>/dev/null) || value=
[ -n "$value" ] || value=<documented default>
```

**Tell "off" apart from "absent".** `// empty` collapses `false` and a missing key into the same empty string, which turns a deliberately disabled mechanic into its default. Where a key may be `false`, resolve it as `select(. != null) | tostring` and test for the string afterwards.

**Snippets are POSIX `sh`.** No `[[ ]]`, no arrays, no `<<<`, and nothing that differs between GNU and BSD coreutils — the shell is whatever the user runs.

</skills-config>

## Common mistakes

- ❌ Deleting a "minor" feature bullet instead of folding it into the details superset.
- ❌ Editing a default/flag value while "cleaning up" a table.
- ❌ Reformatting the README with oxfmt when the repo excludes it — it reflows the centered hero and `<details>` into broken markup.
- ❌ Moving detail into `docs/` without being asked.
- ❌ Over-compacting an already-lean README just to hit the line target.
