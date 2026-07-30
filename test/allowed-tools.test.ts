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
 * The kinds of reason a blanket `Bash` can rest on, each with why no narrowing exists.
 *
 * With the migration finished, every entry below is permanent rather than pending, and the
 * *kind* is what makes that checkable: a reason is not free text a later author can invent
 * to fit, it is one of these, and the tests pin the set in both directions — a kind nothing
 * claims fails, and a skill claiming a kind not listed here fails too.
 *
 * That is deliberately the only place the kinds are enumerated. `skills/README.md` used to
 * carry a prose copy — a count of them and a claim about which skills they cover — and it
 * went stale on every pass this migration took, because prose is the one part of this gate
 * nothing reads. The contract page now points here instead of restating it.
 */
const PERMANENT_REASONS: Record<string, string> = {
  verify:
    "runs the repo's own `verify` — an arbitrary declared command, and no fixed pattern pre-approves one without pre-approving every command",
  unattended:
    'unattended by design (`disallowed-tools: AskUserQuestion`) — a permission prompt has nobody to answer it, so a narrow grant turns a prompt into a hang',
  container:
    'its work *is* a container invocation, and the container takes the command it runs as an argument — the scoped rule would read `Bash(docker:*)`, the blanket grant spelled longer'
};

/**
 * The named exceptions: skills still granting a blanket `Bash`, each with the kind of
 * reason it rests on and what that looks like for this skill in particular.
 *
 * None is waiting on a per-skill pass; each is the honest answer for that skill.
 */
const BLANKET_BASH: Record<string, { why: string; detail: string }> = {
  'docs/vhs-demo': {
    why: 'container',
    detail: 'drives VHS through `docker run`'
  },
  'repo/merge-deps': {
    why: 'verify',
    detail: 'runs it in a throwaway worktree, per dependency update'
  },
  'repo/update-deps': {
    why: 'verify',
    detail: "runs it plus each ecosystem's own updater"
  },
  'work/work-implement': {
    why: 'verify',
    detail: 'runs it as the gate on the work it is about to push'
  },
  'work/work-implement-queue': {
    why: 'unattended',
    detail: 'drains the implement queue under `/loop`, with nobody watching'
  },
  'work/work-review': {
    why: 'verify',
    detail: 'runs it against the pushed head it is reviewing'
  },
  'work/work-review-queue': {
    why: 'unattended',
    detail: 'drains the review queue under `/loop`, with nobody watching'
  }
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
 *
 * *Runs a command* is the line, and writing a file is deliberately on the other side of it.
 * `curl -o <path>` writes anywhere, which is the two-step shape that put `git config` in
 * EXEC_CAPABLE_SUBCOMMANDS below — but the step it arms is one *something else* has to
 * fire, and by that reading `printf`, `mkdir`, `cat`, `git add` and `git apply` are all
 * exec routes too, along with Write and Edit. A model that catches `curl` catches nearly
 * every grant here, so this list keeps the narrower one and the floor is documented rather
 * than widened. Raising it is an ADR's decision, not an entry.
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
  gh: '`gh alias set --shell x <cmd>` then `gh x` runs it, and `gh extension exec` runs an installed extension',
  docker:
    '`docker run <image> <cmd>` runs it, and `-v /:/host` hands it the filesystem it was meant to be isolated from'
};

/**
 * Subcommands that take a command as an *argument*, so the subcommand is no narrower than
 * the head. Listed apart from EXEC_CAPABLE because nothing above them can be cleared: the
 * clear below is by token prefix, and these are the prefixes it must never reach.
 *
 * `git push --receive-pack=<cmd>` (spelled `--exec=<cmd>`) and `git fetch --upload-pack=<cmd>`
 * run their argument on the far side — which for a filesystem remote is this machine. And
 * `git config core.pager=<cmd>` writes the very configuration the clears above declare out
 * of scope, turning a one-step grant into a two-step one. A skill needing any of the three
 * lets it ask, which is the correct cost for the one command in its recipe that can execute.
 */
const EXEC_CAPABLE_SUBCOMMANDS: Record<string, string> = {
  'git push':
    '`--receive-pack=<cmd>` / `--exec=<cmd>` runs it on the remote, which a filesystem remote makes local',
  'git fetch': '`--upload-pack=<cmd>` runs it on the far side, same as above',
  'git clone': '`--upload-pack=<cmd>`, same as `git fetch`',
  'git ls-remote': '`--upload-pack=<cmd>`, same as `git fetch`',
  'git config':
    'writes `core.pager`, `core.editor` and `alias.*`, so it arms an exec route the next git command fires'
};

/**
 * Prefixes cleared despite an exec-capable head, each with why that spelling cannot.
 *
 * The head token is the wrong unit for a command whose *subcommand* decides what it does:
 * `git` can reach a shell, `git diff` cannot. Clearing costs a written reason — the same
 * shape as BLANKET_BASH above, and for the same purpose. Scoping a skill that needs
 * `git commit` means adding it here and saying why, not widening the rule to `Bash(git:*)`
 * and hoping nobody reads it.
 *
 * Clearing is by **token prefix**: an entry for `gh pr` clears `Bash(gh pr list:*)` too,
 * because the reason — no command reachable through the arguments — holds for everything
 * under it. That is what lets a skill pin the narrow rule it actually needs without this
 * list carrying one entry per subcommand it will never see. It also means an entry here is
 * exactly as wide as it reads, so `git` and `gh` alone are refused below, and the
 * EXEC_CAPABLE_SUBCOMMANDS above can never be reached by a prefix.
 *
 * A reason here says what the *spelling* can reach through its arguments. It does not say
 * the repository cannot: `core.pager`, `diff.external` and `gh`'s `pager` are configuration,
 * and a repo supplying them runs its own command under any of these prefixes. That is the
 * same floor EXEC_CAPABLE is measured against, and the reason ADR-0005's durable controls —
 * not this list — are what confine a skill. Write the reasons that way; a clear that claims
 * "runs nothing" full stop is claiming more than the gate delivers.
 *
 * What is deliberately **absent** is as much of the decision as what is here. `git push`,
 * `git fetch` and `git config` are named above as exec routes in their own right, so the
 * skills that drive them ask — which lands the prompt on the deleting push, the merging
 * fetch and the config write rather than on the reads around them.
 */
const EXEC_CLEARED: Record<string, string> = {
  'command -v':
    'prints where a command would be found; the -v form runs nothing',
  'git add': 'stages paths; takes no command as an argument',
  'git apply': 'applies a patch to the tree; takes no command as an argument',
  'git branch':
    'lists, creates and deletes branch refs; takes no command as an argument',
  'git cat-file': 'prints an object; takes no command as an argument',
  'git cherry':
    'compares commits against an upstream; takes no command as an argument',
  'git commit':
    'records the index; the `-c` here names a commit to reuse a message from, not a configuration assignment',
  'git commit-tree':
    'writes a commit object from a tree; takes no command as an argument',
  'git describe': 'prints the nearest tag; takes no command as an argument',
  'git diff':
    'prints a diff; the exec routes on `git` are global options (`-c`, `--exec-path`) that sit before the subcommand, where this prefix cannot reach them',
  'git for-each-ref':
    'prints refs through a format string, which is interpolated and never executed',
  'git fsck': 'checks object connectivity; takes no command as an argument',
  'git log':
    'prints commits; same global-option reasoning as `git diff`, and it needs an explicit `--ext-diff` to reach even a configured external differ',
  'git ls-files': 'reads the index and prints paths; writes nothing',
  'git merge-base': 'prints a common ancestor; takes no command as an argument',
  'git reflog': 'prints the ref log; takes no command as an argument',
  'git remote':
    'lists and edits remote entries; takes no command as an argument, and the URL it stores is fetched by a command that asks',
  'git rev-list': 'prints revisions; takes no command as an argument',
  'git rev-parse': 'prints revisions and repository paths; writes nothing',
  'git show':
    'prints objects; like `git log` it needs an explicit `--ext-diff` to reach even a configured external differ',
  'git status':
    'prints the working-tree state; takes no command as an argument',
  'git symbolic-ref':
    'prints a symbolic ref; the writing form needs a second argument',
  'git verify-commit':
    'checks a signature; the program that does it comes from `gpg.program`, which is configuration rather than an argument',
  'git worktree':
    'adds, lists and removes linked worktrees; takes no command as an argument',
  'gh api':
    "sends one API request; `gh`'s exec routes are top-level (`gh <alias>`, `gh extension exec`), which a subcommand prefix cannot reach",
  'gh auth': 'reads and stores credentials; same top-level-only exec routes',
  'gh issue': 'works on issues; same top-level-only exec routes',
  'gh label': 'works on labels; same top-level-only exec routes',
  'gh pr':
    "works on pull requests; `gh` refuses to alias over a core command, so `gh pr <anything>` stays inside `gh`'s own subcommand tree",
  'gh project': 'works on projects; same top-level-only exec routes',
  'gh repo': 'works on repositories; same top-level-only exec routes',
  'gh search': 'runs one search query; same top-level-only exec routes'
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

/**
 * Skills that pre-approve no command at all, each with why there is none to name.
 *
 * The scoped form is a smaller grant; *no* Bash grant is the smallest, and a skill whose
 * whole job runs through Read, Write and Edit has nothing to pre-approve. Requiring one
 * anyway would have it invent a command to declare, which is the opposite of the point.
 * Listed rather than inferred, and pinned in both directions like the others: a skill here
 * that starts driving something must say so, and one that drives nothing cannot be quietly
 * handed a grant.
 */
const NO_BASH: Record<string, string> = {
  'docs/write-readme':
    'scaffolds README.md through Read/Write/Edit and drives no command — it reads no config either'
};

/** The command prefix inside a scoped rule: `Bash(git diff:*)` → `git diff`. */
const prefixOf = (tool: string) => /^Bash\((.+):\*\)$/.exec(tool)?.[1] ?? '';

/** Split a command prefix into tokens: `git ls-files` → `['git', 'ls-files']`. */
const tokens = (prefix: string) => prefix.split(/\s+/).filter(Boolean);

/** Is `prefix` `entry` or something under it? `git commit --amend` is under `git commit`. */
const startsWith = (prefix: string, entry: string) => {
  const [p, e] = [tokens(prefix), tokens(entry)];
  return e.length <= p.length && e.every((t, i) => t === p[i]);
};

/**
 * The EXEC_CLEARED entry covering this prefix, if one does.
 *
 * By token prefix, so `gh pr` covers `gh pr list` — the reason a clear gives is a property
 * of the subcommand, and it does not stop holding because a skill pinned something narrower.
 */
const clearedBy = (prefix: string) =>
  Object.keys(EXEC_CLEARED).find((entry) => startsWith(prefix, entry));

/** The exec-capable subcommand this prefix reaches, if any — `git push --force` reaches `git push`. */
const execSubcommand = (prefix: string) =>
  Object.keys(EXEC_CAPABLE_SUBCOMMANDS).find((entry) =>
    startsWith(prefix, entry)
  );

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
    for (const [skill, { detail }] of Object.entries(BLANKET_BASH))
      assert.ok(
        detail.trim().length >= 20,
        `${skill}: give a real reason for the blanket grant, not a placeholder`
      );
  });

  test('every exception rests on one of the named kinds, not on free text', () => {
    for (const [skill, { why }] of Object.entries(BLANKET_BASH))
      assert.ok(
        PERMANENT_REASONS[why],
        `${skill}: "${why}" is not a kind PERMANENT_REASONS names — a blanket grant rests on one of those, or on a new kind added there with why no narrowing exists`
      );
  });

  test('and every named kind is one some skill actually rests on', () => {
    // The other half of the pin. Without it a kind outlives the last skill that needed it,
    // which is the same stale-claim shape the roster check above exists to prevent — and
    // the reason `skills/README.md` no longer keeps a copy of this list.
    const claimed = new Set(Object.values(BLANKET_BASH).map((e) => e.why));
    assert.deepEqual(
      Object.keys(PERMANENT_REASONS).sort(),
      [...claimed].sort(),
      'PERMANENT_REASONS names a kind no skill claims (or a skill claims one it does not name) — the set of kinds is meant to shrink with the list'
    );
  });

  test('each kind says why no narrowing exists, so a kind cannot be a label', () => {
    for (const [why, reason] of Object.entries(PERMANENT_REASONS))
      assert.ok(
        reason.trim().length >= 40,
        `PERMANENT_REASONS.${why}: say why nothing narrower pre-approves it, not a placeholder`
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
      if (isBlanketBash(tools) || NO_BASH[skill]) continue;
      // Dropping Bash entirely is not the scoped form — it is a different change. Losing
      // the grant silently would read as progress while costing a prompt on every command
      // the skill actually runs, so a skill that runs none says so in NO_BASH instead.
      assert.ok(
        tools.some((t) => t.startsWith('Bash(')),
        `${skill}: scoped skills pre-approve the commands they drive — declare at least one \`Bash(…)\`, or name it in NO_BASH with the reason it drives none`
      );
    }
  });

  test('and every skill claiming to drive nothing declares no Bash at all', () => {
    for (const [skill, reason] of Object.entries(NO_BASH)) {
      const tools = allowedTools(skill);
      assert.ok(
        !tools.some((t) => t === 'Bash' || t.startsWith('Bash(')),
        `NO_BASH says ${skill} drives no command (${reason}), but its list grants Bash — drop the entry, or drop the grant`
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
        if (!prefix) continue;

        const reached = execSubcommand(prefix);
        assert.ok(
          !reached,
          `${skill}: "${tool}" reaches \`${reached}\`, which takes a command as an argument — ${EXEC_CAPABLE_SUBCOMMANDS[reached ?? '']}. Let it ask; no clear can cover it.`
        );
        if (clearedBy(prefix)) continue;

        const head = tokens(prefix)[0] ?? '';
        const mechanism = EXEC_CAPABLE[head];
        assert.ok(
          !mechanism,
          `${skill}: "${tool}" pre-approves arbitrary execution — ${mechanism} — so it grants what a blanket \`Bash\` grants. Drop it and let the command ask, or pin a narrower prefix and clear it in EXEC_CLEARED with the reason that spelling cannot execute.`
        );
      }
  });

  test('every cleared prefix is headed by an exec-capable command, so the list cannot grow sideways', () => {
    for (const prefix of Object.keys(EXEC_CLEARED)) {
      const head = tokens(prefix)[0] ?? '';
      assert.ok(
        EXEC_CAPABLE[head],
        `EXEC_CLEARED lists "${prefix}", whose head \`${head}\` is not in EXEC_CAPABLE — nothing was blocking it, so the entry only obscures what the gate checks`
      );
      assert.notEqual(
        prefix,
        head,
        `EXEC_CLEARED lists the bare command \`${head}\` — clearing a whole command defeats the check; clear the subcommand that cannot execute`
      );
      // A clear is as wide as it reads, so one that sits on or above a subcommand taking a
      // command argument would hand out exactly what that subcommand can run.
      const reached = execSubcommand(prefix);
      assert.ok(
        !reached,
        `EXEC_CLEARED lists "${prefix}", which covers \`${reached}\` — ${EXEC_CAPABLE_SUBCOMMANDS[reached ?? '']}`
      );
    }
  });

  test('each cleared prefix and each mechanism says something, so no list can be padded to pass', () => {
    for (const [key, reason] of [
      ...Object.entries(EXEC_CAPABLE),
      ...Object.entries(EXEC_CAPABLE_SUBCOMMANDS),
      ...Object.entries(EXEC_CLEARED),
      ...Object.entries(TAUGHT_AS_REJECTED),
      ...Object.entries(NO_BASH)
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
      if (clearedBy(prefix)) continue;

      const head = tokens(prefix)[0] ?? '';
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
        EXEC_CAPABLE[tokens(prefix)[0] ?? ''] && !clearedBy(prefix),
        `skills/README.md shows "${tool}" as a rule to avoid (${where}), but this gate accepts it — the illustration and the check disagree`
      );
    }
  });
});
