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
        `${skill} grants a blanket \`Bash\` — scope it (\`Bash(git:*)\`, \`Bash(gh:*)\`, …), or add it to BLANKET_BASH in this file with the reason it cannot be`
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
