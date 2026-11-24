// The commit hook hands staged paths to oxfmt and oxlint. Two ways that goes wrong
// without anything failing: a task string built by joining paths splits a name with a
// space into two arguments, and an exclusion written as a substring test catches files
// it was never meant for. This runs the real lint-staged with the repo's own config in a
// throwaway repository and records the arguments each tool would have received.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from './helpers.ts';

const dir = mkdtempSync(join(tmpdir(), 'skills lint staged '));
after(() => rmSync(dir, { recursive: true, force: true }));

const bin = join(dir, 'bin');
const log = join(dir, 'calls.log');
mkdirSync(bin);
// `pnpm exec <tool> <args…>` → one line per call, one tab-separated field per argument.
writeFileSync(
  join(bin, 'pnpm'),
  `#!/bin/sh\nshift\nprintf '%s' "$1" >> "${log}"\nshift\nfor a do printf '\\t%s' "$a" >> "${log}"; done\necho >> "${log}"\n`,
  { mode: 0o755 }
);

const repo = join(dir, 'repo');
mkdirSync(join(repo, 'docs'), { recursive: true });
mkdirSync(join(repo, 'pnpm-lock.yaml.examples'), { recursive: true });
copyFileSync(
  join(ROOT, 'lint-staged.config.js'),
  join(repo, 'lint-staged.config.js')
);
const files = [
  'CLI notes.md',
  'CHANGELOG.md',
  'docs/CHANGELOG.md',
  'MYCHANGELOG.md',
  'pnpm-lock.yaml',
  'pnpm-lock.yaml.examples/preset.json',
  'a.ts'
];
for (const f of files) writeFileSync(join(repo, f), 'x\n');
const env = { ...process.env, PATH: `${bin}:${process.env.PATH ?? ''}` };
const git = (...args: string[]) =>
  spawnSync('git', args, { cwd: repo, encoding: 'utf8', env });
git('init', '-q');
git('add', '-A');
const run = spawnSync(
  process.execPath,
  [
    join(ROOT, 'node_modules', 'lint-staged', 'bin', 'lint-staged.js'),
    '--no-stash',
    '--config',
    join(repo, 'lint-staged.config.js')
  ],
  { cwd: repo, encoding: 'utf8', env }
);

const calls = () =>
  readFileSync(log, 'utf8')
    .trim()
    .split('\n')
    .map((line) => line.split('\t'));
const argsTo = (tool: string) =>
  calls()
    .filter(([t]) => t === tool)
    .flatMap(([, ...a]) => a.map((p) => p.slice(repo.length + 1)));

test('lint-staged runs the configured tools', () => {
  assert.equal(run.status, 0, run.stdout + run.stderr);
});

test('a path with a space reaches the formatter as one argument', () => {
  assert.ok(argsTo('oxfmt').includes('CLI notes.md'), JSON.stringify(calls()));
});

test('only the exact CHANGELOG.md and pnpm-lock.yaml are left out', () => {
  const formatted = argsTo('oxfmt');
  assert.ok(!formatted.includes('CHANGELOG.md'));
  assert.ok(!formatted.includes('docs/CHANGELOG.md'));
  assert.ok(!formatted.includes('pnpm-lock.yaml'));
  assert.ok(formatted.includes('MYCHANGELOG.md'));
  assert.ok(formatted.includes('pnpm-lock.yaml.examples/preset.json'));
});

test('code goes through the linter and the formatter', () => {
  assert.ok(argsTo('oxlint').includes('a.ts'));
  assert.ok(argsTo('oxfmt').includes('a.ts'));
});
