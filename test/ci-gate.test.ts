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
    if (key?.[1] && key[2] && step) {
      const value = key[2].trim();
      // The one-line assumption above, made loud. A `run: |` block would capture the
      // indicator as the value, fail the `pnpm <script>` shape, and drop the step out
      // of the gate set entirely — leaving this suite comparing a short list and
      // reporting a drift that is really an unreadable file.
      assert.ok(
        !/^[|>]/.test(value),
        `ci.yml: "${key[1]}:" is a block scalar — this reader only understands one-line values, so teach it or keep the value on one line`
      );
      step[key[1]] = value;
    }
  }
  assert.ok(steps.length > 0, 'ci.yml should have steps');
  return steps;
}

// Parsed inside the tests, not at module load: a malformed workflow should fail as a
// named test with the assertion's message, not as an import error before any test runs.
const gateSteps = () => ciSteps().filter((s) => CALL.test(s.run ?? ''));

describe('the CI gate matches the verify script', () => {
  test('every command `pnpm verify` runs has its own step, in the same order', () => {
    assert.deepEqual(
      gateSteps().map((s) => s.run),
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
    for (const step of gateSteps())
      assert.equal(
        step.if,
        '${{ !cancelled() }}',
        `step "${step.name ?? step.run}" should run even after an earlier failure`
      );
  });

  test('each gate step is named, so the failing command is readable', () => {
    for (const step of gateSteps())
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

  // merge-deps checks a Dependabot PR in a throwaway worktree, where nothing is
  // installed — and installs that head's own lockfile itself before running this
  // command. So the effective value is the gate and nothing else: prepending an
  // install here would install twice and re-teach the pattern the skill removed.
  test("merge-deps gets the gate alone, because the install is the skill's job", () => {
    assert.equal(config.mergeDeps?.verify ?? config.verify, 'pnpm verify');
  });
});
