import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from './helpers.ts';

const scratch = mkdtempSync(join(tmpdir(), 'skills-container-audit-test-'));
after(() => rmSync(scratch, { recursive: true, force: true }));

writeFileSync(
  join(scratch, 'docker'),
  `#!/bin/sh
echo build >> "$SKILLS_AUDIT_CALLS"
if [ "$SKILLS_AUDIT_CASE" = build-failure ]; then exit 1; fi
`,
  { mode: 0o755 }
);

writeFileSync(
  join(scratch, 'trivy'),
  `#!/bin/sh
output= source= image=
while [ "$#" -gt 0 ]; do
  case "$1" in
    --output) shift; output="$1" ;;
    --image-src) shift; source="$1" ;;
    *) image="$1" ;;
  esac
  shift
done
printf '%s|%s\\n' "$source" "$image" >> "$SKILLS_AUDIT_CALLS"
case "$image:$SKILLS_AUDIT_CASE" in
  python*:scan-failure) exit 1 ;;
  python*:invalid-report) echo broken > "$output" ;;
  python*:missing-report) exit 0 ;;
  python*:advisories)
    echo '{"Results":[{"Vulnerabilities":[{"VulnerabilityID":"CVE-FIXTURE","Severity":"HIGH"}]}]}' > "$output"
    exit 2 ;;
  *) echo '{"Results":[]}' > "$output" ;;
esac
`,
  { mode: 0o755 }
);

function run(scenario: string) {
  const output = join(scratch, scenario);
  const calls = join(scratch, `${scenario}.calls`);
  const result = spawnSync(
    'bash',
    [join(ROOT, 'scripts/audit-containers.sh'), output],
    {
      encoding: 'utf8',
      timeout: 30_000,
      env: {
        PATH: `${scratch}:${process.env.PATH ?? ''}`,
        HOME: scratch,
        SKILLS_AUDIT_CASE: scenario,
        SKILLS_AUDIT_CALLS: calls
      }
    }
  );
  return { ...result, output, calls: readFileSync(calls, 'utf8') };
}

test('container audit scans the registry validator and freshly built renderer', () => {
  const result = run('clean');
  assert.equal(result.status, 0, result.stderr);
  assert.match(
    result.calls,
    /^remote\|python:.*\nbuild\ndocker\|tituskirch-skills-vhs-audit:local\n$/
  );
  assert.deepEqual(
    JSON.parse(readFileSync(join(result.output, 'vhs.json'), 'utf8')),
    { Results: [] }
  );
  assert.match(result.stdout, /0 package findings, 0 unique advisories/);
});

test('advisories still allow the other image to be checked', () => {
  const result = run('advisories');
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stdout, /1 package findings, 1 unique advisories/);
  assert.match(result.calls, /docker\|tituskirch-skills-vhs-audit:local/);
});

test('a failed scan stays distinct from advisories and the other image is checked', () => {
  const result = run('scan-failure');
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stderr, /could not be scanned/);
  assert.match(result.calls, /docker\|tituskirch-skills-vhs-audit:local/);
});

test('a failed build cannot fall back to a stale local renderer', () => {
  const result = run('build-failure');
  assert.equal(result.status, 2, result.stderr);
  assert.match(
    result.stderr,
    /renderer build failed; no previous image was scanned/
  );
  assert.ok(!result.calls.includes('docker|'));
});

for (const scenario of ['invalid-report', 'missing-report']) {
  test(`${scenario} cannot be mistaken for a clean scan or advisories`, () => {
    const result = run(scenario);
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /produced no usable report/);
    assert.match(result.calls, /docker\|tituskirch-skills-vhs-audit:local/);
  });
}
