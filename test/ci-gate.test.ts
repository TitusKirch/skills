// CI no longer lists the gate's commands a second time. `.github/workflows/ci.yml`
// is a caller stub for `kirchDev/workflows/_ci-check.yml`, and that body DERIVES
// its steps from this package.json — it splits `verify` on `&&`, expands each
// `pnpm <script>` call recursively, and runs the leaves one per log group.
//
// So the drift this suite used to guard against is now structurally impossible:
// there is no second list to keep in step. What is left is the other half of the
// same contract — that the local gate and the one the skills run are the same
// script CI resolves.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './helpers.ts';

const scripts = (
  JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
    scripts: Record<string, string>;
  }
).scripts;

/** A bare `pnpm <script>` call — no flags, which is what the body's resolver matches. */
const CALL = /^pnpm ([\w:-]+)$/;

/**
 * `pnpm verify` flattened to the commands it actually runs, in order — the same
 * expansion `_ci-check.yml` performs. Asserting it here keeps the gate readable
 * from this repo without CI having to restate it.
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

describe('the gate resolves to the checks CI runs', () => {
  test('verify expands to the five commands, in order', () => {
    assert.deepEqual(gateCommands(), [
      'pnpm lint',
      'pnpm format',
      'pnpm skills:check',
      'pnpm typecheck',
      'pnpm test'
    ]);
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
