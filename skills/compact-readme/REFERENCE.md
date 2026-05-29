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

## Common mistakes

- ❌ Deleting a "minor" feature bullet instead of folding it into the details superset.
- ❌ Editing a default/flag value while "cleaning up" a table.
- ❌ Reformatting the README with oxfmt when the repo excludes it — it reflows the centered hero and `<details>` into broken markup.
- ❌ Moving detail into `docs/` without being asked.
- ❌ Over-compacting an already-lean README just to hit the line target.
