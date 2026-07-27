// CI runs the gate as one step per command so a single run reports every failure
// instead of only the first. That buys visibility at the cost of a second place to
// keep in sync: `pnpm verify` is what runs locally — and, on `branch:dev`, the only
// automated check ahead of the release branch — while ci.yml lists the commands again.
//
// This suite is what makes the split safe. Add a command to `verify` without adding
// its step (or the reverse) and these tests fail, so the two cannot quietly diverge.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './helpers.ts';

const WORKFLOW = join(ROOT, '.github', 'workflows', 'ci.yml');

const scripts = (
  JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
    scripts: Record<string, string>;
  }
).scripts;

/** A bare `pnpm <script>` call — no flags, which is what a gate step and a composite both use. */
const CALL = /^pnpm ([\w:-]+)$/;

/**
 * `pnpm verify` flattened to the commands it actually runs, in order.
 *
 * A script whose whole body is `pnpm x && pnpm y` is a composite and is expanded;
 * anything else is a leaf and stands for itself. That is what makes `check` count as
 * its two commands rather than one, matching the steps CI has always had.
 */
function gateCommands(name = 'verify', seen = new Set<string>()): string[] {
  const body = scripts[name];
  assert.ok(body, `package.json should define a "${name}" script`);
  assert.ok(!seen.has(name), `the "${name}" script calls itself`);

  const parts = body.split('&&').map((p) => p.trim());
  const calls = parts.map((p) => CALL.exec(p)?.[1]);
  if (!calls.every((c) => c !== undefined && c in scripts))
    return [`pnpm ${name}`];

  return calls.flatMap((c) =>
    gateCommands(c as string, new Set(seen).add(name))
  );
}

/**
 * ci.yml's steps as flat key/value maps.
 *
 * Deliberately a targeted read of the one file rather than a YAML dependency: the
 * three keys this suite asserts on (`name`, `if`, `run`) are all scalars written on
 * one line, and a parser would be more surface than the check is worth.
 */
function ciSteps(): Record<string, string>[] {
  const lines = readFileSync(WORKFLOW, 'utf8').split('\n');
  const start = lines.indexOf('    steps:');
  assert.notEqual(start, -1, 'ci.yml should hold one job with a steps: block');

  const steps: Record<string, string>[] = [];
  for (const raw of lines.slice(start + 1)) {
    if (raw.trim() === '' || raw.trimStart().startsWith('#')) continue;
    // Indented less than a step item means the steps: block has ended.
    if (!raw.startsWith('      ')) break;

    const item = raw.startsWith('      - ');
    if (item) steps.push({});
    // Normalising the "- " away puts a key written on the item line at the same
    // depth as its siblings; nested keys (`with:` entries) stay deeper and are skipped.
    const key = /^ {8}(name|if|run): (.+)$/.exec(
      item ? raw.replace('      - ', '        ') : raw
    );
    const step = steps.at(-1);
    if (key?.[1] && key[2] && step) step[key[1]] = key[2].trim();
  }
  assert.ok(steps.length > 0, 'ci.yml should have steps');
  return steps;
}

const steps = ciSteps();
const gateSteps = steps.filter((s) => CALL.test(s.run ?? ''));

describe('the CI gate matches the verify script', () => {
  test('every command `pnpm verify` runs has its own step, in the same order', () => {
    assert.deepEqual(
      gateSteps.map((s) => s.run),
      gateCommands()
    );
  });

  test('the split is the reason it can drift, so the expansion is asserted too', () => {
    assert.deepEqual(gateCommands(), [
      'pnpm lint',
      'pnpm format',
      'pnpm skills:check',
      'pnpm typecheck',
      'pnpm test'
    ]);
  });
});

describe('a failing step does not suppress the ones after it', () => {
  test('every gate step carries the !cancelled() guard', () => {
    for (const step of gateSteps)
      assert.equal(
        step.if,
        '${{ !cancelled() }}',
        `step "${step.name ?? step.run}" should run even after an earlier failure`
      );
  });

  test('each gate step is named, so the failing command is readable', () => {
    for (const step of gateSteps)
      assert.ok(step.name, `step running "${step.run}" should have a name`);
  });
});

describe('the local gate stays the same gate', () => {
  const config = JSON.parse(
    readFileSync(join(ROOT, '.tituskirch-skills.json'), 'utf8')
  ) as { verify?: string; mergeDeps?: { verify?: string } };

  test('the config points at the script CI mirrors', () => {
    assert.equal(config.verify, 'pnpm verify');
  });

  // merge-deps runs its command against a Dependabot PR's own head in a throwaway
  // worktree — a bare checkout with no node_modules, where the root key alone would
  // fail on a missing oxlint and hold every PR in the queue on a verify that never
  // had a chance to pass. Installing first is also the only way the gate sees the
  // updated versions at all: a dependency PR *is* its lockfile.
  describe('merge-deps verifies in a bare worktree', () => {
    const effective = config.mergeDeps?.verify ?? config.verify ?? '';

    test('the command installs before it runs anything', () => {
      assert.match(effective, /^pnpm install --frozen-lockfile &&/);
    });

    test('what it then runs is the same gate, not a narrower one', () => {
      assert.match(effective, /&& pnpm verify$/);
    });
  });
});
