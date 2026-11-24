// .claude/settings.json and .codex/rules/default.rules are one safety policy written in
// two rule languages: Claude Code matches a prefix of the command string, Codex a
// prefix of the argv tokens. Two copies of one list drift, so this pins the parity
// both files' headers claim: every spelling Codex forbids is denied by Claude, and
// every Claude deny has a Codex rule. It is a parity check, not a completeness proof.
//
// A small set of intended decisions is also pinned per client — a read, the repo's
// gate, a formatter that writes, and one forbidden operation. The Codex half asks the
// native policy engine (`codex execpolicy check`, which executes nothing) when the CLI
// is installed, and is skipped otherwise; CI does not install Codex.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './helpers.ts';

const RULES = join(ROOT, '.codex', 'rules', 'default.rules');
const settings = JSON.parse(
  readFileSync(join(ROOT, '.claude', 'settings.json'), 'utf8')
) as { permissions: { allow: string[]; deny: string[] } };

/** `Bash(git push --force:*)` → `git push --force`. */
const unwrap = (rule: string) => rule.replace(/^Bash\((.*?)(:\*)?\)$/, '$1');

/** Every spelling a forbidden `prefix_rule` matches: the cartesian product of its tokens. */
function codexSpellings(): string[] {
  const source = readFileSync(RULES, 'utf8').replace(/#.*$/gm, '');
  const patterns = [
    ...source.matchAll(
      /pattern\s*=\s*(\[[\s\S]*?\])\s*,\s*\n\s*decision\s*=\s*"forbidden"/g
    )
  ].map(
    (m) =>
      JSON.parse((m[1] as string).replace(/,\s*\]/g, ']')) as (
        | string
        | string[]
      )[]
  );
  assert.ok(patterns.length > 0, 'no forbidden prefix_rule was parsed');
  return patterns.flatMap((pattern) =>
    pattern
      .reduce<string[][]>(
        (acc, token) =>
          acc.flatMap((a) =>
            (Array.isArray(token) ? token : [token]).map((t) => [...a, t])
          ),
        [[]]
      )
      .map((tokens) => tokens.join(' '))
  );
}

const deny = settings.permissions.deny.map(unwrap);
const codex = codexSpellings();
// Claude's `:*` is a prefix of the command string, so `git clean -f` covers `-fdx`.
const claudeDenies = (command: string) =>
  deny.some((p) => command.startsWith(p));

describe('the two client policies forbid the same spellings', () => {
  test('every spelling Codex forbids is denied by Claude', () => {
    assert.deepEqual(
      codex.filter((s) => !claudeDenies(s)),
      []
    );
  });

  test('every Claude deny has a Codex rule', () => {
    assert.deepEqual(
      deny.filter((p) => !codex.some((s) => s.startsWith(p))),
      []
    );
  });
});

describe('the intended decisions, per client', () => {
  const allow = settings.permissions.allow.map(unwrap);
  const claudeAllows = (command: string) =>
    allow.some((p) => command === p || command.startsWith(`${p} `));

  test('Claude pre-approves a read and the formatter, and denies a force-push', () => {
    assert.ok(claudeAllows('git status'));
    assert.ok(claudeAllows('pnpm check:fix'));
    assert.ok(claudeDenies('git push --force origin dev'));
  });

  const codexCli = spawnSync('codex', ['--version'], { encoding: 'utf8' });
  test(
    'Codex forbids the force-push and leaves the rest to prompt',
    { skip: codexCli.status !== 0 && 'codex is not installed' },
    () => {
      const decide = (...argv: string[]) => {
        const out = spawnSync(
          'codex',
          ['execpolicy', 'check', '--rules', RULES, '--', ...argv],
          { encoding: 'utf8' }
        );
        assert.equal(out.status, 0, out.stderr);
        return (JSON.parse(out.stdout) as { decision?: string }).decision;
      };
      assert.equal(
        decide('git', 'push', '--force', 'origin', 'dev'),
        'forbidden'
      );
      for (const argv of [
        ['git', 'status'],
        ['pnpm', 'verify'],
        ['pnpm', 'check:fix']
      ]) {
        assert.notEqual(decide(...argv), 'forbidden', argv.join(' '));
      }
    }
  );
});
