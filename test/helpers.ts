// Shared scaffolding for the integration tests.
//
// Both suites work against a *copy* of a skill rather than the repo tree, because
// that is the only arrangement that proves what the skills claim: each one is
// installable on its own. A symlink would still resolve `../..` back into this
// repo and pass for the wrong reason.

import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export interface Sandbox {
  /** A real git repo — the resolver locates the config via `git rev-parse`. */
  repo: string;
  /** One skill, copied out of the tree as an install would deliver it. */
  skill: string;
  /** The resolver as the installed skill ships it. */
  resolver: string;
  cleanup: () => void;
}

/**
 * Build a throwaway repo with `fixture` as its config, plus an isolated copy of
 * `skillPath` (e.g. "work/work-implement"). Nothing is written inside this repo.
 */
export function sandbox(
  fixture: string | null,
  skillPath = 'work/work-implement'
): Sandbox {
  const base = mkdtempSync(join(tmpdir(), 'tituskirch-skills-test-'));
  const repo = join(base, 'repo');
  const skill = join(base, 'installed', skillPath.split('/').pop() as string);

  mkdirSync(repo, { recursive: true });
  execFileSync('git', ['init', '-q'], { cwd: repo });

  if (fixture) {
    cpSync(
      join(ROOT, 'test', 'fixtures', fixture),
      join(repo, '.tituskirch-skills.json')
    );
  }

  mkdirSync(dirname(skill), { recursive: true });
  cpSync(join(ROOT, 'skills', skillPath), skill, { recursive: true });

  return {
    repo,
    skill,
    resolver: join(skill, 'templates', 'resolve-config.sh'),
    cleanup: () => rmSync(base, { recursive: true, force: true })
  };
}

export interface Run {
  status: number;
  stdout: string;
  stderr: string;
}

/**
 * Run the resolver the way a skill would: from inside the repo, by absolute path.
 *
 * spawnSync, not execFileSync — the latter discards stderr on success, which would
 * hide the warning an unknown profile is supposed to print while still exiting 0.
 */
export function resolve(
  box: Sandbox,
  env: Record<string, string> = {},
  script = box.resolver
): Run {
  const run = spawnSync('sh', [script], {
    cwd: box.repo,
    encoding: 'utf8',
    // A bare env keeps the host's CI= or TITUSKIRCH_SKILLS_PROFILE= out of the result.
    env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', ...env }
  });
  return {
    status: run.status ?? -1,
    stdout: run.stdout ?? '',
    stderr: run.stderr ?? ''
  };
}

/** A PATH that has everything the resolver needs except jq. */
export function pathWithoutJq(box: Sandbox): string {
  const bin = join(box.repo, '..', 'bin-no-jq');
  mkdirSync(bin, { recursive: true });
  for (const tool of ['sh', 'dash', 'git', 'cat', 'printf', 'sed', 'grep']) {
    try {
      const real = execFileSync('command', ['-v', tool], {
        encoding: 'utf8',
        shell: '/bin/sh'
      }).trim();
      if (real)
        writeFileSync(join(bin, tool), `#!/bin/sh\nexec ${real} "$@"\n`, {
          mode: 0o755
        });
    } catch {
      // tool absent on this host; the resolver does not require all of them
    }
  }
  return bin;
}
