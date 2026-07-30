// `allowed-tools` is pre-approval, not restriction (ADR-0005): a listed tool runs
// without stopping to ask, and an unlisted one still runs — it just asks first. So the
// *scoping* is the safety measure, not the field's presence, and a skill carrying a
// blanket `Bash` can run any command unattended.
//
// ADR-0005 decided to scope the grant; ADR-0017 decided how to get there, because
// rewriting nineteen tool lists on a guess is a large, likely-wrong diff. This suite is
// that decision made mechanical: the scoped form is the default, and a blanket `Bash`
// survives only as an entry in the list below, with a reason someone wrote down.
//
// The list is pinned in both directions on purpose. A skill added later cannot inherit
// the blanket form by copying its neighbour, and a skill that *is* scoped cannot leave a
// stale entry behind claiming it still needs one — so the list can only shrink, which is
// the whole point of writing it out rather than counting.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './helpers.ts';
import { discoverSkills, paths } from '../scripts/gen-skills.ts';

/**
 * The named exceptions: skills still granting a blanket `Bash`, each with the reason it
 * has not been scoped yet.
 *
 * Two of these reasons are permanent and two are not, and the difference is worth
 * seeing. A skill that runs the repo's own `verify` drives *whatever the consuming repo
 * declares* — no fixed pattern pre-approves an arbitrary command without pre-approving
 * every command — and an unattended queue skill cannot answer a permission prompt at
 * all, so for those four-plus-two the blanket grant may well be the right answer. The
 * rest are simply undecided, and say so.
 */
const BLANKET_BASH: Record<string, string> = {
  'docs/compact-readme': 'not yet scoped — awaiting its own per-skill pass',
  'docs/vhs-demo':
    'not yet scoped — drives VHS through a docker invocation whose shape is still per-repo',
  'docs/write-docs': 'not yet scoped — awaiting its own per-skill pass',
  'docs/write-readme': 'not yet scoped — awaiting its own per-skill pass',
  'meta/tituskirch-skills-config':
    'not yet scoped — awaiting its own per-skill pass',
  'repo/atomic-commit': 'not yet scoped — awaiting its own per-skill pass',
  'repo/merge-deps':
    "runs the repo's own `verify` in a throwaway worktree — an arbitrary declared command no pattern can pre-approve",
  'repo/prune-branches': 'not yet scoped — awaiting its own per-skill pass',
  'repo/pull-request': 'not yet scoped — awaiting its own per-skill pass',
  'repo/release': 'not yet scoped — awaiting its own per-skill pass',
  'repo/update-deps':
    "runs the repo's own `verify` plus each ecosystem's updater — arbitrary declared commands no pattern can pre-approve",
  'work/handoff': 'not yet scoped — awaiting its own per-skill pass',
  'work/issue': 'not yet scoped — awaiting its own per-skill pass',
  'work/work-implement':
    "runs the repo's own `verify` — an arbitrary declared command no pattern can pre-approve",
  'work/work-implement-queue':
    'unattended by design (`disallowed-tools: AskUserQuestion`) — a permission prompt has nobody to answer it',
  'work/work-review':
    "runs the repo's own `verify` — an arbitrary declared command no pattern can pre-approve",
  'work/work-review-queue':
    'unattended by design (`disallowed-tools: AskUserQuestion`) — a permission prompt has nobody to answer it'
};

/**
 * Command prefixes that can run *another* command, and how.
 *
 * A permission rule is a command-prefix match, so `Bash(sh:*)` matches `sh -c '<anything>'`
 * and `Bash(find:*)` matches `find . -exec <anything> \;`. A scoped rule headed by one of
 * these is a blanket `Bash` spelled differently — it reads as a narrowing in review and
 * grants arbitrary execution in fact, which is the one outcome ADR-0017 exists to prevent.
 * Each entry names the mechanism, so the list can be argued with rather than trusted.
 *
 * This is a floor, not a proof of confinement. It catches the primitives whose *purpose*
 * is to run something else; it cannot catch every escape hatch in every binary, and a
 * passing list still does not confine a skill. Per ADR-0005 the durable controls are
 * `disallowed-tools` and `.claude/settings.json` deny rules — this gate only keeps the
 * scoped form from being a fiction.
 */
const EXEC_CAPABLE: Record<string, string> = {
  sh: '`sh -c <anything>`',
  bash: '`bash -c <anything>`',
  zsh: '`zsh -c <anything>`',
  ksh: '`ksh -c <anything>`',
  dash: '`dash -c <anything>`',
  fish: '`fish -c <anything>`',
  eval: 'evaluates its argument as a command',
  exec: 'replaces the shell with an arbitrary command',
  command: '`command <anything>` runs it, bypassing functions and aliases',
  env: '`env <anything>` runs it with a modified environment',
  xargs: 'runs the command it is given, once per input line',
  nohup: 'runs an arbitrary command detached',
  timeout: 'runs an arbitrary command under a time limit',
  watch: 'runs an arbitrary command on a loop',
  find: '`-exec` / `-execdir` / `-ok` run arbitrary commands (POSIX, not a GNU extra)',
  sed: "`-i` writes files in place; GNU's `e` command and `s///e` flag execute the pattern space",
  awk: '`system()` and `cmd | getline` run arbitrary commands',
  gawk: '`system()` and `cmd | getline` run arbitrary commands',
  perl: 'a general-purpose interpreter',
  python: 'a general-purpose interpreter',
  python3: 'a general-purpose interpreter',
  ruby: 'a general-purpose interpreter',
  node: 'a general-purpose interpreter',
  ssh: 'runs an arbitrary command on the far side',
  sort: '`--compress-program=PROG` runs PROG',
  git: '`git -c alias.x=!<cmd> x` and `-c core.pager=<cmd>` run arbitrary commands',
  gh: '`gh alias set --shell x <cmd>` then `gh x` runs it, and `gh extension exec` runs an installed extension'
};

/**
 * Exact prefixes cleared despite an exec-capable head, each with why that spelling cannot.
 *
 * The head token is the wrong unit for a command whose *subcommand* decides what it does:
 * `git` can reach a shell, `git diff` cannot. Clearing is per exact prefix and costs a
 * written reason — the same shape as BLANKET_BASH above, and for the same purpose. Scoping
 * a skill that needs `git commit` means adding it here and saying why, not widening the
 * rule to `Bash(git:*)` and hoping nobody reads it.
 *
 * A reason here says what the *spelling* can reach through its arguments. It does not say
 * the repository cannot: `core.pager`, `diff.external` and `gh`'s `pager` are configuration,
 * and a repo supplying them runs its own command under any of these prefixes. That is the
 * same floor EXEC_CAPABLE is measured against, and the reason ADR-0005's durable controls —
 * not this list — are what confine a skill. Write the reasons that way; a clear that claims
 * "runs nothing" full stop is claiming more than the gate delivers.
 */
const EXEC_CLEARED: Record<string, string> = {
  'command -v':
    'prints where a command would be found; the -v form runs nothing',
  'git diff':
    'prints a diff; the exec routes on `git` are global options (`-c`, `--exec-path`) that sit before the subcommand, where this prefix cannot reach them',
  'git log':
    'prints commits; same global-option reasoning as `git diff`, and it needs an explicit `--ext-diff` to reach even a configured external differ',
  'git ls-files': 'reads the index and prints paths; writes nothing',
  'git rev-parse': 'prints revisions and repository paths; writes nothing',
  'git symbolic-ref':
    'prints a symbolic ref; the writing form needs a second argument',
  'gh pr view':
    "prints a pull request; `gh`'s exec routes are top-level (`gh <alias>`, `gh extension exec`), and `gh` refuses to alias over a core command"
};

/**
 * Rules `skills/README.md` shows as what *not* to write, each with where it says so.
 *
 * The frontmatter contract has to name bad rules to teach the scoping, so it is the one
 * file whose examples cannot all be required to pass. Listing them makes the exception
 * explicit and pins it in both directions, like every other list here: a counter-example
 * the gate has stopped rejecting fails, so an illustration cannot quietly turn into a
 * recommendation, and one the file no longer shows fails too.
 */
const TAUGHT_AS_REJECTED: Record<string, string> = {
  'Bash(sh:*)':
    'named in the scope-by-what-it-reaches note as arbitrary execution',
  'Bash(find:*)': 'same note — `find -exec` runs anything',
  'Bash(git:*)': "same note — `git -c alias.x='!…' x` reaches a shell",
  'Bash(gh:*)':
    'same note — `gh alias set --shell` then `gh <alias>` reaches a shell'
};

/** The command prefix inside a scoped rule: `Bash(git diff:*)` → `git diff`. */
const prefixOf = (tool: string) => /^Bash\((.+):\*\)$/.exec(tool)?.[1] ?? '';

/**
 * One skill's `allowed-tools`, read out of its frontmatter.
 *
 * Only the YAML-list form is understood, which is the form every skill here uses. A
 * skill switching to the standard's space-separated string would parse as an empty list
 * and quietly pass every check below — so an empty result is a failure, not a skill with
 * nothing to declare. A gate that cannot read its input must not report a pass.
 */
function allowedTools(skill: string): string[] {
  const raw = readFileSync(join(ROOT, 'skills', skill, 'SKILL.md'), 'utf8');
  const frontmatter = /^---\n([\s\S]*?)\n---/.exec(raw)?.[1];
  assert.ok(frontmatter, `${skill}: SKILL.md should open with frontmatter`);

  const lines = frontmatter.split('\n');
  const start = lines.indexOf('allowed-tools:');
  assert.notEqual(
    start,
    -1,
    `${skill}: should declare allowed-tools as a YAML list — this reader understands no other form`
  );

  const tools: string[] = [];
  for (const line of lines.slice(start + 1)) {
    const item = /^ {2}- (.+)$/.exec(line);
    if (!item?.[1]) break;
    tools.push(item[1].trim());
  }
  assert.ok(tools.length > 0, `${skill}: allowed-tools parsed empty`);
  return tools;
}

const skills = () => discoverSkills(paths(ROOT)).map((s) => s.path);

/** A grant of every command there is: the bare tool name, with no `(…)` scope. */
const isBlanketBash = (tools: string[]) => tools.includes('Bash');

describe('a blanket Bash grant is a named exception, never the default', () => {
  test('every skill granting bare `Bash` is named in this file, with a reason', () => {
    for (const skill of skills()) {
      if (!isBlanketBash(allowedTools(skill))) continue;
      assert.ok(
        BLANKET_BASH[skill],
        `${skill} grants a blanket \`Bash\` — scope it (\`Bash(git diff:*)\`, \`Bash(gh pr view:*)\`, …), or add it to BLANKET_BASH in this file with the reason it cannot be`
      );
    }
  });

  test('and every name in the list is a skill that still needs it', () => {
    const blanket = skills().filter((s) => isBlanketBash(allowedTools(s)));
    assert.deepEqual(
      Object.keys(BLANKET_BASH).sort(),
      blanket.sort(),
      'BLANKET_BASH lists a skill that no longer grants a blanket `Bash` (or has gone) — drop the entry; the list is meant to shrink'
    );
  });

  test('each reason says something, so the list cannot be padded to pass', () => {
    for (const [skill, reason] of Object.entries(BLANKET_BASH))
      assert.ok(
        reason.trim().length >= 20,
        `${skill}: give a real reason for the blanket grant, not a placeholder`
      );
  });
});

describe('the scoped form is what a new skill inherits', () => {
  test('at least one skill is scoped, so the default is demonstrated and not just asserted', () => {
    const scoped = skills().filter((s) => !isBlanketBash(allowedTools(s)));
    assert.ok(
      scoped.length > 0,
      'no skill scopes its Bash grant — the exception list would then be the whole catalogue'
    );
  });

  test('a scoped skill still declares the Bash it drives, rather than dropping it', () => {
    for (const skill of skills()) {
      const tools = allowedTools(skill);
      if (isBlanketBash(tools)) continue;
      // Dropping Bash entirely is not the scoped form — it is a different change, and
      // every skill here drives at least one command. Silently losing the grant would
      // read as progress while costing a prompt on every single command.
      assert.ok(
        tools.some((t) => t.startsWith('Bash(')),
        `${skill}: scoped skills pre-approve the commands they drive — declare at least one \`Bash(…)\``
      );
    }
  });

  test('every entry is a bare tool name or a scoped `Bash(…)` rule', () => {
    for (const skill of skills())
      for (const tool of allowedTools(skill))
        assert.match(
          tool,
          /^[A-Z][A-Za-z]*(\(.+\))?$/,
          `${skill}: "${tool}" is not a tool name or a scoped rule`
        );
  });

  test('a scoped Bash rule carries the `:*` prefix form the permission rules use', () => {
    for (const skill of skills())
      for (const tool of allowedTools(skill)) {
        if (!tool.startsWith('Bash(')) continue;
        assert.match(
          tool,
          /^Bash\([^()]+:\*\)$/,
          `${skill}: "${tool}" should read \`Bash(<command prefix>:*)\`, the form .claude/settings.json rules use`
        );
      }
  });
});

describe('a scoped rule is not a blanket Bash by another name', () => {
  test('no scoped rule is headed by a command that runs other commands', () => {
    for (const skill of skills())
      for (const tool of allowedTools(skill)) {
        const prefix = prefixOf(tool);
        if (!prefix || EXEC_CLEARED[prefix]) continue;

        const head = prefix.split(/\s+/)[0] ?? '';
        const mechanism = EXEC_CAPABLE[head];
        assert.ok(
          !mechanism,
          `${skill}: "${tool}" pre-approves arbitrary execution — ${mechanism} — so it grants what a blanket \`Bash\` grants. Drop it and let the command ask, or pin a narrower prefix and clear it in EXEC_CLEARED with the reason that spelling cannot execute.`
        );
      }
  });

  test('every cleared prefix is headed by an exec-capable command, so the list cannot grow sideways', () => {
    for (const prefix of Object.keys(EXEC_CLEARED)) {
      const head = prefix.split(/\s+/)[0] ?? '';
      assert.ok(
        EXEC_CAPABLE[head],
        `EXEC_CLEARED lists "${prefix}", whose head \`${head}\` is not in EXEC_CAPABLE — nothing was blocking it, so the entry only obscures what the gate checks`
      );
      assert.notEqual(
        prefix,
        head,
        `EXEC_CLEARED lists the bare command \`${head}\` — clearing a whole command defeats the check; clear the subcommand that cannot execute`
      );
    }
  });

  test('each cleared prefix and each mechanism says something, so neither list can be padded to pass', () => {
    for (const [key, reason] of [
      ...Object.entries(EXEC_CAPABLE),
      ...Object.entries(EXEC_CLEARED),
      ...Object.entries(TAUGHT_AS_REJECTED)
    ])
      assert.ok(
        reason.trim().length >= 15,
        `${key}: say how it executes (or why this spelling cannot), not a placeholder`
      );
  });
});

/**
 * Every `Bash(…)` rule the frontmatter contract shows, as written in the file.
 *
 * `skills/README.md` is what a skill author copies from, so a rule it prints is a rule
 * that gets written. Reading the prose as well as the fenced example is deliberate: the
 * field note carries its own inline `allowed-tools:` line, which is just as copyable as
 * the template above it.
 */
const taughtRules = () => {
  const raw = readFileSync(join(ROOT, 'skills', 'README.md'), 'utf8');
  return [...new Set(raw.match(/Bash\([^()]+\)/g) ?? [])];
};

describe('the frontmatter contract teaches rules its own gate accepts', () => {
  // Twice the contract has taught a rule this gate refuses — `Bash(git:*)`, then the
  // `Bash(git log:*)` that replaced it — because nothing connected the prose to the check.
  // Hand-fixing an example invites the next wrong one; this is the check that does not.
  //
  // Only this file is read. An ADR records what was decided on its date and is refined by
  // a later record rather than edited, so ADR-0005's `Bash(git:*) Bash(gh:*)` stays as
  // written and ADR-0017 carries the correction — a template to copy is a different thing
  // from a record of a decision, and only the template has to hold today.
  test('the contract shows rules at all, so an unreadable file cannot pass', () => {
    assert.ok(
      taughtRules().length > 0,
      'skills/README.md shows no `Bash(…)` rule — either the contract stopped teaching the scoped form, or this reader stopped finding it'
    );
  });

  test('every rule it teaches passes the exec-primitive check', () => {
    for (const tool of taughtRules()) {
      if (TAUGHT_AS_REJECTED[tool]) continue;

      const prefix = prefixOf(tool);
      assert.ok(
        prefix,
        `skills/README.md teaches "${tool}", which is not the \`Bash(<command prefix>:*)\` form the same file requires`
      );
      if (EXEC_CLEARED[prefix]) continue;

      const head = prefix.split(/\s+/)[0] ?? '';
      const mechanism = EXEC_CAPABLE[head];
      assert.ok(
        !mechanism,
        `skills/README.md teaches "${tool}", which this gate rejects — ${mechanism}. Show a cleared prefix instead, or clear this one in EXEC_CLEARED with the reason that spelling cannot execute.`
      );
    }
  });

  test('and every rule it names as one to avoid is still one the gate rejects', () => {
    const taught = taughtRules();
    for (const [tool, where] of Object.entries(TAUGHT_AS_REJECTED)) {
      assert.ok(
        taught.includes(tool),
        `TAUGHT_AS_REJECTED lists "${tool}", which skills/README.md no longer shows (${where}) — drop the entry`
      );

      const prefix = prefixOf(tool);
      assert.ok(
        EXEC_CAPABLE[prefix.split(/\s+/)[0] ?? ''] && !EXEC_CLEARED[prefix],
        `skills/README.md shows "${tool}" as a rule to avoid (${where}), but this gate accepts it — the illustration and the check disagree`
      );
    }
  });
});
