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
import { existsSync, readFileSync } from 'node:fs';
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

/**
 * The skill files this reader takes commands from.
 *
 * `DESIGN.md` is deliberately not one of them. It records what was decided *and what was
 * rejected*, so a command shown there may be the one the skill does **not** run — reading
 * it would clear a grant by quoting the argument against it.
 */
const PROSE_FILES = ['SKILL.md', 'REFERENCE.md'];

/**
 * Fence info strings read as shell.
 *
 * A **bare** fence is deliberately not one. The catalogue's only bare block holds a
 * validator's output, and output read as commands invents calls that clear grants — which
 * is the one way this gate could fail open. `json`, `mermaid`, `markdown` and the rest are
 * excluded for the same reason, by not being listed.
 */
const SHELL_FENCES = new Set(['sh', 'bash', 'shell', 'zsh', 'console']);

/**
 * Words that sit in a command position and hand it to the next word.
 *
 * The reader is a token scanner, not a shell, so it steps over these rather than splitting
 * on them: `{ git log --all …` and `if git rev-parse --verify …` both run the command that
 * follows. Braces are stepped over rather than treated as separators because `gh api
 * repos/{owner}/{repo}/labels` would otherwise come apart mid-argument.
 */
const OPENS_A_COMMAND = new Set([
  '{',
  '}',
  '!',
  'if',
  'elif',
  'then',
  'else',
  'while',
  'until',
  'do',
  'time'
]);

/**
 * Words that occupy a command position and end the fragment for this reader's purposes —
 * shell syntax and builtins that no `allowed-tools` rule is ever written against. Unlike
 * the set above, what follows one of these is its argument, not a command.
 */
const NOT_A_COMMAND = new Set([
  'fi',
  'done',
  'esac',
  'case',
  'in',
  'for',
  'function',
  'return',
  'break',
  'continue',
  'exit',
  'set',
  'local',
  'export',
  'readonly',
  'shift',
  'trap',
  'wait',
  'true',
  'false',
  ':',
  '.',
  'source',
  'echo',
  'test',
  'read',
  'unset',
  'eval'
]);

/**
 * A token this gate is willing to demand a grant narrow onto: a subcommand.
 *
 * The narrowest prefix covering a skill's calls is not always a subcommand — `pull-request`
 * drives `git branch` only as `--show-current`, `prune-comments` `git symbolic-ref` only as
 * `--short` — and ADR-0017 records that a flag is the **more brittle anchor**, sound only
 * where the call has a single shape, which is a property of the call site rather than of
 * the rule. So the gate *accepts* a flag-anchored rule and never *requires* one: it demands
 * a narrowing only where the next token is a plain subcommand word, which is where the
 * widening this check exists to catch actually lives (`Bash(git worktree:*)` over
 * `git worktree list`). Anything with a flag, a variable, a placeholder, a path or a
 * redirect in it fails this and is left alone.
 */
const SUBCOMMAND = /^[a-z][a-z0-9-]*$/;

/**
 * The kinds of reason a grant this reader cannot see demonstrated can rest on.
 *
 * Same shape and same purpose as PERMANENT_REASONS above: a reason is one of these rather
 * than free text a later author invents to fit, and the set is pinned in both directions.
 */
const UNDEMONSTRATED_REASONS: Record<string, string> = {
  unparsed:
    'the skill drives it, but not in a form this reader can extract — prose that names the command without writing it out, so the call is real and the text is not a command',
  undemonstrated:
    'no recipe drives it at all, so the grant is a candidate for removal — but which grants a skill still needs is the per-skill judgement ADR-0017 kept out of a sweep, and this gate reports rather than guesses'
};

/**
 * Scoped rules the skill's own prose does not demonstrate, keyed `<skill> <rule>`.
 *
 * This is the opt-out the check was expected to need, and on the day it landed it is also
 * where the check earns its keep: most of it is grants for calls no recipe in the catalogue
 * makes. Listing them is not the same as clearing them — it says a human, not a parser,
 * decides whether the grant or the recipe is the thing that is wrong. (No count here on
 * purpose, for the reason ADR-0017 gives: a number in prose is the half nothing reads.)
 *
 * Pinned in both directions like every list in this file: an entry whose rule the prose
 * *does* demonstrate fails, so the list can only shrink.
 */
const UNDEMONSTRATED: Record<string, { why: string; detail: string }> = {
  'meta/tituskirch-skills-config Bash(git rev-parse:*)': {
    why: 'undemonstrated',
    detail:
      'the only `git rev-parse` in the folder is inside `templates/resolve-config.sh`, which the skill runs as one `sh` call — nothing the agent types is covered by the rule'
  },
  'meta/tituskirch-skills-config Bash(gh issue list:*)': {
    why: 'undemonstrated',
    detail:
      'the drift sweep reads labels (`gh label list --limit`, `gh api repos/{owner}/{repo}/labels`) and lists issues in no recipe'
  },
  'repo/prune-branches Bash(gh pr view:*)': {
    why: 'undemonstrated',
    detail:
      'its PR reads all go through `gh pr list --state`; no recipe views a single pull request'
  },
  'repo/pull-request Bash(gh pr view:*)': {
    why: 'undemonstrated',
    detail:
      'it finds its own PR with `gh pr list --head`; no recipe views one, and the update path reads the branch rather than the PR'
  },
  'repo/pull-request Bash(gh pr diff:*)': {
    why: 'undemonstrated',
    detail:
      'the body is built from `git log` and `git diff` over the branch; no recipe reads a PR diff'
  },
  'repo/release Bash(gh pr view:*)': {
    why: 'undemonstrated',
    detail:
      'the release PR is read with `gh pr list --base` and `gh pr checks`; the one diff recipe spells `gh pr diff`, which this list does not grant at all'
  },
  'work/handoff Bash(git rev-parse:*)': {
    why: 'undemonstrated',
    detail:
      "as with the config skill, the folder's only `git rev-parse` is inside the resolver it ships and runs as one `sh` call"
  },
  'work/issue Bash(gh issue view:*)': {
    why: 'unparsed',
    detail:
      'its contract sentence writes the pair as `gh issue list` / `view`, an abbreviation no reader can join back into a command'
  }
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

/** A skill file minus its YAML frontmatter — the tool list is not a recipe. */
const body = (md: string) => md.replace(/^---\n[\s\S]*?\n---\n/, '');

/**
 * The shell a skill's prose shows: its fenced shell blocks, plus its inline code spans.
 *
 * Spans are read as well as blocks because these skills write commands in both — a fenced
 * recipe for the multi-line ones, backticks for `wc -l README.md` or `gh pr list --state`
 * mid-sentence — and a reader that took only blocks would call a documented command
 * undocumented. Spans carry plenty that is not a command (`ai: ready`, `work.branch`); that
 * only ever *adds* to the set of calls, which can loosen this gate but never make it
 * misfire, so the noise is cheaper than the false failures.
 */
function shellSources(md: string): string[] {
  const sources: string[] = [];
  const fence = /^```([^\n`]*)\n([\s\S]*?)^```/gm;
  let block: RegExpExecArray | null;
  while ((block = fence.exec(md)))
    if (SHELL_FENCES.has((block[1] ?? '').trim().toLowerCase()))
      sources.push(block[2] ?? '');

  const prose = md.replace(/^```[\s\S]*?^```/gm, '');
  for (const span of prose.matchAll(/`([^`\n]+)`/g))
    sources.push(span[1] ?? '');
  return sources;
}

/** Drop a trailing `# …` comment, leaving a `#` inside a quoted string alone. */
function stripComment(line: string): string {
  let quote: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i] as string;
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === '#' && (i === 0 || /\s/.test(line[i - 1] as string)))
      return line.slice(0, i);
  }
  return line;
}

/** Split a line at every position a new command can start: `|`, `&&`, `;`, `$(`, … */
const atCommandPositions = (line: string) =>
  line.replace(/\|\||&&|\$\(|[|;`()]/g, '\n').split('\n');

/** Words of one command, quotes removed: `git log --pretty='%s'` → three tokens. */
function words(fragment: string): string[] {
  const out: string[] = [];
  for (const m of fragment.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g))
    out.push(m[1] ?? m[2] ?? m[3] ?? '');
  return out;
}

/**
 * Every command invocation in a chunk of shell, as token arrays.
 *
 * A scanner, not a shell: it finds the command positions, skips `VAR=…` prefixes and the
 * words that open a construct, and takes what is left. Heredoc bodies and prose caught in a
 * code span come through as junk invocations — harmless, because a junk head matches no
 * grant prefix.
 */
function invocations(text: string): string[][] {
  const found: string[][] = [];
  for (const raw of text.split('\n')) {
    if (/^\s*#/.test(raw)) continue;
    const line = stripComment(raw);
    if (!line.trim()) continue;
    for (const fragment of atCommandPositions(line)) {
      const toks = words(fragment);
      let i = 0;
      while (
        i < toks.length &&
        (/^[A-Za-z_][A-Za-z0-9_]*=/.test(toks[i] as string) ||
          OPENS_A_COMMAND.has(toks[i] as string))
      )
        i++;
      const head = toks[i];
      if (!head || NOT_A_COMMAND.has(head) || head.startsWith('-')) continue;
      found.push(toks.slice(i));
    }
  }
  return found;
}

const driven = new Map<string, string[][]>();

/** Every command `skill`'s own prose shows it running. */
function calls(skill: string): string[][] {
  const hit = driven.get(skill);
  if (hit) return hit;

  const found: string[][] = [];
  for (const file of PROSE_FILES) {
    const path = join(ROOT, 'skills', skill, file);
    if (!existsSync(path)) continue;
    for (const source of shellSources(body(readFileSync(path, 'utf8'))))
      found.push(...invocations(source));
  }
  driven.set(skill, found);
  return found;
}

/** Does `call` start with every token of `prefix`? */
const drives = (call: string[], prefix: string[]) =>
  prefix.every((t, i) => call[i] === t);

/**
 * The subcommand a rule should have been anchored at, if every call sits under one.
 *
 * `undefined` means the rule is as narrow as this gate asks for — because the calls spread
 * across subcommands, because the next token is a flag or an argument, or because the rule
 * is already anchored at a flag (see SUBCOMMAND). One step at a time: a rule two
 * subcommands too wide is reported at the first, and re-running finds the next.
 *
 * A **bare** mention of the prefix — `git worktree` with nothing after it, which is how the
 * prose explaining a narrowing names the form it rejected — is not counted as a call under
 * it. A rule reads `Bash(<prefix>:*)`, so it is written for invocations that carry
 * arguments; taking the bare word as evidence for the parent anchor would let the sentence
 * arguing *against* the wide rule be the thing that clears it.
 */
function widerThanDriven(
  prefix: string,
  observed: string[][]
): string | undefined {
  const p = tokens(prefix);
  if (p.some((t) => t.startsWith('-'))) return undefined;

  const next = new Set(
    observed.filter((c) => drives(c, p)).map((c) => c[p.length])
  );
  next.delete(undefined);
  if (next.size !== 1) return undefined;

  const [only] = [...next];
  return only && SUBCOMMAND.test(only) ? only : undefined;
}

/** The scoped rules of every skill that has any, as `[skill, rule]` pairs. */
const scopedRules = () =>
  skills().flatMap((skill) =>
    allowedTools(skill)
      .filter((tool) => tool.startsWith('Bash('))
      .map((tool) => [skill, tool] as const)
  );

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

describe('a grant is no broader than the calls the skill drives', () => {
  // The rule this makes mechanical is ADR-0017's: *a grant is written at the narrowest
  // prefix that covers every call the skill makes*. Four grants were narrowed under it and
  // every one rested on review — nothing stopped the next author widening any of them back,
  // which is the shape a claim in prose always fails in.
  //
  // **Two of the four are what this gate pins**: `git worktree list` and `git remote
  // get-url`, where the narrowing lands on a subcommand. `git branch --show-current` and
  // `git symbolic-ref --short` land on a *flag*, and pinning those would mean demanding a
  // flag anchor wherever a skill's calls share one — which is `jq -er`, `printf %s`,
  // `mkdir -p`, `head -1` and twenty more, the brittle sweep ADR-0017 declined by saying a
  // flag anchor holds only where the call has a single shape, a property of the call site
  // rather than of the rule. So the flag-anchored half stays a review matter, deliberately,
  // and this gate says so rather than implying it covers all four.
  //
  // The reader above is the part that cannot be right everywhere: fenced blocks and code
  // spans carry pseudo-code, fragments and placeholders, so the gate is written to be *shy*
  // — it demands a narrowing only onto a subcommand, and a rule it cannot see driven at all
  // is an entry in UNDEMONSTRATED rather than a failure invented from a parse.

  test('the reader finds commands, so a broken parse cannot pass everything', () => {
    // Without this, a reader that stopped matching would report every rule as narrow
    // enough and every skill as clean — a green run that checked nothing.
    for (const skill of new Set(scopedRules().map(([s]) => s)))
      assert.ok(
        calls(skill).length > 0,
        `${skill} scopes its Bash grant but this reader found no command in its prose — the reader is broken, or the skill documents no recipe`
      );
  });

  test('every scoped rule is one the skill is shown driving', () => {
    for (const [skill, tool] of scopedRules()) {
      if (UNDEMONSTRATED[`${skill} ${tool}`]) continue;
      const prefix = tokens(prefixOf(tool));
      assert.ok(
        calls(skill).some((c) => drives(c, prefix)),
        `${skill}: "${tool}" pre-approves a command no recipe in its SKILL.md or REFERENCE.md drives — drop the grant, show the call, or name it in UNDEMONSTRATED with the reason this reader cannot see it`
      );
    }
  });

  test('and every name on the undemonstrated list is still undemonstrated', () => {
    for (const [key, { detail }] of Object.entries(UNDEMONSTRATED)) {
      const [skill, tool] = [
        key.slice(0, key.indexOf(' ')),
        key.slice(key.indexOf(' ') + 1)
      ];
      assert.ok(
        allowedTools(skill).includes(tool),
        `UNDEMONSTRATED lists "${key}", which that skill no longer grants — drop the entry; the list is meant to shrink`
      );
      assert.ok(
        !calls(skill).some((c) => drives(c, tokens(prefixOf(tool)))),
        `UNDEMONSTRATED says ${skill} never shows "${tool}" (${detail}), but its prose now drives it — drop the entry`
      );
    }
  });

  test('each entry rests on one of the named kinds, not on free text', () => {
    for (const [key, { why }] of Object.entries(UNDEMONSTRATED))
      assert.ok(
        UNDEMONSTRATED_REASONS[why],
        `${key}: "${why}" is not a kind UNDEMONSTRATED_REASONS names`
      );
  });

  test('and every named kind is one some entry actually rests on', () => {
    const claimed = new Set(Object.values(UNDEMONSTRATED).map((e) => e.why));
    assert.deepEqual(
      Object.keys(UNDEMONSTRATED_REASONS).sort(),
      [...claimed].sort(),
      'UNDEMONSTRATED_REASONS names a kind no entry claims (or an entry claims one it does not name)'
    );
  });

  test('each reason says something, so no list can be padded to pass', () => {
    for (const [key, { detail }] of Object.entries(UNDEMONSTRATED))
      assert.ok(
        detail.trim().length >= 20,
        `${key}: say what the skill drives instead, not a placeholder`
      );
    for (const [why, reason] of Object.entries(UNDEMONSTRATED_REASONS))
      assert.ok(
        reason.trim().length >= 40,
        `UNDEMONSTRATED_REASONS.${why}: say why the grant survives without a demonstrated call`
      );
  });

  test('no rule sits a subcommand above every call under it', () => {
    for (const [skill, tool] of scopedRules()) {
      const prefix = prefixOf(tool);
      const narrower = widerThanDriven(prefix, calls(skill));
      assert.ok(
        !narrower,
        `${skill}: "${tool}" is wider than the calls it covers — every one is \`${prefix} ${narrower}\`, so the rule reads \`Bash(${prefix} ${narrower}:*)\``
      );
    }
  });
});

describe('the minimality reader is demonstrated, not just asserted', () => {
  // The catalogue passes the check above, which is the point and also the problem: a rule
  // nothing fires on is a rule nobody can tell is wired up. These cases are the widening
  // the check exists to catch and the four shapes it deliberately leaves alone.
  const worktree = [
    ['git', 'worktree', 'list', '--porcelain'],
    ['git', 'worktree', 'list', '-z']
  ];

  test('it names the subcommand when every call sits under one', () => {
    assert.equal(widerThanDriven('git worktree', worktree), 'list');
  });

  test('it stays quiet when the calls spread across subcommands', () => {
    assert.equal(
      widerThanDriven('git worktree', [
        ...worktree,
        ['git', 'worktree', 'remove', '$dir']
      ]),
      undefined
    );
  });

  test('a bare mention of the parent does not clear the wide rule', () => {
    // `prune-branches`' REFERENCE explains its own narrowing as "`git worktree list`, not
    // `git worktree`" — so the sentence arguing against the wide rule puts the bare word in
    // the reader's hands, and counting it would make the explanation the loophole.
    assert.equal(
      widerThanDriven('git worktree', [...worktree, ['git', 'worktree']]),
      'list'
    );
  });

  test('it never demands a flag anchor, however single-shaped the call', () => {
    assert.equal(widerThanDriven('git worktree list', worktree), undefined);
    assert.equal(widerThanDriven('jq', [['jq', '-er', '.verify']]), undefined);
  });

  test('it demands nothing under a rule already anchored at a flag', () => {
    assert.equal(
      widerThanDriven('command -v', [['command', '-v', 'skills-ref']]),
      undefined
    );
  });

  test('it demands nothing on an argument that only looks like a subcommand', () => {
    // A placeholder, a path and a variable each fail SUBCOMMAND, so a recipe written with
    // one cannot be turned into a grant nobody could satisfy.
    assert.equal(
      widerThanDriven('gh api', [['gh', 'api', 'repos/{owner}/{repo}/labels']]),
      undefined
    );
    assert.equal(
      widerThanDriven('git verify-commit', [['git', 'verify-commit', '<sha>']]),
      undefined
    );
  });

  test('the reader finds a command inside a substitution and after a pipe', () => {
    assert.deepEqual(
      invocations(
        'root=$(git rev-parse --show-toplevel) && gh pr list --json number | jq -er ".[0]"'
      ),
      [
        ['git', 'rev-parse', '--show-toplevel'],
        ['gh', 'pr', 'list', '--json', 'number'],
        ['jq', '-er', '.[0]']
      ]
    );
  });

  test('it reads no command out of a comment', () => {
    assert.deepEqual(invocations('# git worktree remove "$dir"'), []);
    assert.deepEqual(invocations('git status   # git push --force'), [
      ['git', 'status']
    ]);
  });
});
