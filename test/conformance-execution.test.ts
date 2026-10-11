import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from './helpers.ts';
import { discoverSkills, paths } from '../scripts/gen-skills.ts';

const scratch = mkdtempSync(join(tmpdir(), 'skills-conformance-execution-'));
after(() => rmSync(scratch, { recursive: true, force: true }));
writeFileSync(
  join(scratch, 'docker'),
  `#!/bin/sh
printf '%s\\n' "$@" > "$SKILLS_DOCKER_ARGS"
if [ "$SKILLS_DOCKER_FAIL" = true ]; then
  echo 'fixture Docker failure' >&2
  exit 17
fi
echo '##VALIDATOR 0.1.1'
for argument do
  case "$argument" in
    skills/*/*) printf '##BEGIN %s\\n##END %s 0\\n' "$argument" "$argument" ;;
  esac
done
`,
  { mode: 0o755 }
);

function run(fail = false) {
  return spawnSync('bash', [join(ROOT, 'scripts/check-conformance.sh')], {
    encoding: 'utf8',
    timeout: 30_000,
    env: {
      PATH: `${scratch}:${process.env.PATH ?? ''}`,
      HOME: scratch,
      SKILLS_DOCKER_ARGS: join(scratch, 'args'),
      SKILLS_DOCKER_FAIL: String(fail)
    }
  });
}

test('conformance refreshes its image and mounts the published tree read-only without capabilities', () => {
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  const count = discoverSkills(paths(ROOT)).length;
  assert.match(result.stdout, new RegExp(`${count} conformant .*0 failed`));
  const args = readFileSync(join(scratch, 'args'), 'utf8').split('\n');
  assert.ok(args.includes('--pull=always'));
  assert.ok(args.includes('--cap-drop=ALL'));
  assert.equal(
    args[args.indexOf('--security-opt') + 1],
    'no-new-privileges:true'
  );
  assert.equal(args[args.indexOf('-v') + 1], `${ROOT}:/repo:ro`);
});

test('a Docker failure cannot be reported as a conformant tree', () => {
  const result = run(true);
  assert.equal(result.status, 2, result.stderr);
  assert.match(
    result.stderr,
    /validator produced no verdict \(docker exit 17\)/
  );
  assert.ok(!result.stdout.includes('conformant'));
});
