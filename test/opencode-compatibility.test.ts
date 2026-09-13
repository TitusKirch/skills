// OpenCode compatibility is checked through the real CLI, not a second parser. The
// normal test suite skips this probe when the pinned CLI is absent; its own workflow
// installs that exact version and makes absence or drift a failure.

import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  closeSync,
  cpSync,
  existsSync,
  fstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readSync,
  rmSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from './helpers.ts';
import { discoverSkills, paths } from '../scripts/gen-skills.ts';

const OPENCODE_VERSION = '1.18.30';
const OPENCODE = process.env.OPENCODE_BIN ?? 'opencode';
const REQUIRED = process.env.OPENCODE_REQUIRED === 'true';
const QUEUES = ['work-implement-queue', 'work-review-queue'];
const homes: string[] = [];

after(() =>
  homes.forEach((home) => rmSync(home, { recursive: true, force: true }))
);

interface Run {
  status: number;
  stdout: string;
  stderr: string;
  missing: boolean;
}

// stdout goes to a file, not a pipe: OpenCode exits before a pipe drains, which cuts
// `debug skill` — every skill's full content — off mid-JSON at roughly 145 KB.
function run(
  args: string[],
  env: NodeJS.ProcessEnv = process.env,
  cwd = ROOT
): Run {
  // Read back through the descriptor the child wrote to, never the path again, so
  // the file cannot be swapped between the write and the read.
  const fd = openSync(join(home(), 'stdout'), 'w+');
  let result;
  let stdout;
  try {
    result = spawnSync(OPENCODE, args, {
      cwd,
      encoding: 'utf8',
      env,
      stdio: ['ignore', fd, 'pipe']
    });
    const buffer = Buffer.alloc(fstatSync(fd).size);
    for (let read = 0; read < buffer.length;) {
      const n = readSync(fd, buffer, read, buffer.length - read, read);
      if (n === 0) break;
      read += n;
    }
    stdout = buffer.toString('utf8');
  } finally {
    closeSync(fd);
  }
  return {
    status: result.status ?? -1,
    stdout,
    stderr: result.stderr ?? '',
    missing:
      (result.error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT'
  };
}

function home(): string {
  const dir = mkdtempSync(join(tmpdir(), 'tituskirch-skills-opencode-'));
  homes.push(dir);
  return dir;
}

// The README's OpenCode setup, exactly: skills:link, then this variable, so the
// linked `~/.agents/skills/` is OpenCode's one source for the bundle.
function envFor(home: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    HOME: home,
    XDG_CACHE_HOME: join(home, '.cache'),
    XDG_CONFIG_HOME: join(home, '.config'),
    XDG_DATA_HOME: join(home, '.local', 'share'),
    OPENCODE_DISABLE_CLAUDE_CODE_SKILLS: '1'
  };
}

function link(env: NodeJS.ProcessEnv): void {
  const result = spawnSync('bash', [join(ROOT, 'scripts', 'link-skills.sh')], {
    cwd: ROOT,
    encoding: 'utf8',
    env
  });
  assert.equal(result.status, 0, result.stderr);
}

// A bare repo with no skills of its own, so every skill OpenCode reports can only
// have come from the linked user-scope install.
function emptyProject(): string {
  const project = home();
  const git = spawnSync('git', ['init', '--quiet'], {
    cwd: project,
    encoding: 'utf8'
  });
  assert.equal(git.status, 0, git.stderr);
  return project;
}

interface Permission {
  permission: string;
  pattern: string;
  action?: string;
}

interface Agent {
  permission: Permission[];
}

function action(
  agent: Agent,
  permission: string,
  pattern: string
): string | undefined {
  return agent.permission
    .filter(
      (entry) => entry.permission === permission && entry.pattern === pattern
    )
    .at(-1)?.action;
}

function agent(name: string, env: NodeJS.ProcessEnv, cwd: string): Agent {
  const configured = run(['--pure', 'debug', 'agent', name], env, cwd);
  assert.equal(configured.status, 0, configured.stderr);
  return JSON.parse(configured.stdout) as Agent;
}

test('OpenCode 1.18.30 loads the linked skills and enforces queue permissions', (t) => {
  const version = run(['--version']);
  if (version.missing) {
    if (REQUIRED)
      assert.fail(`OpenCode ${OPENCODE_VERSION} is required but not installed`);
    t.skip(`OpenCode ${OPENCODE_VERSION} is not installed`);
    return;
  }
  if (version.stdout.trim() !== OPENCODE_VERSION) {
    if (REQUIRED) {
      assert.equal(version.stdout.trim(), OPENCODE_VERSION, version.stderr);
    }
    t.skip(
      `requires OpenCode ${OPENCODE_VERSION}; found ${version.stdout.trim()}`
    );
    return;
  }

  const isolatedHome = home();
  const env = envFor(isolatedHome);
  link(env);
  const linked = join(isolatedHome, '.agents', 'skills');

  const project = emptyProject();
  const skills = run(['--pure', 'debug', 'skill'], env, project);
  assert.equal(skills.status, 0, skills.stderr);
  const loaded = JSON.parse(skills.stdout) as Array<{
    name: string;
    location: string;
  }>;

  for (const skill of discoverSkills(paths(ROOT))) {
    const entries = loaded.filter((entry) => entry.name === skill.name);
    assert.equal(
      entries.length,
      1,
      `${skill.name} should be discovered exactly once`
    );
    assert.equal(
      entries[0]?.location,
      join(linked, skill.name, 'SKILL.md'),
      `${skill.name} should load from the linked ~/.agents/skills`
    );
  }

  const agents = join(project, '.opencode', 'agents');
  mkdirSync(agents, { recursive: true });
  for (const name of QUEUES) {
    const template = join(linked, name, 'templates', 'opencode-agent.md');
    assert.ok(
      existsSync(template),
      `${name} should install its OpenCode agent template`
    );
    cpSync(template, join(agents, `${name}.md`));
  }

  for (const name of QUEUES) {
    const queue = agent(name, env, project);
    assert.equal(action(queue, 'question', '*'), 'deny');
    assert.equal(action(queue, 'skill', '*'), 'allow');
    assert.equal(action(queue, 'task', '*'), 'deny');
    assert.equal(action(queue, 'task', 'general'), 'allow');
  }

  // The queue's own `question: deny` does not reach the workers it spawns: `task`
  // runs `general` under that agent's permissions. An unattended drain only holds if
  // the worker cannot ask either, so pin the default the templates rely on.
  assert.equal(
    action(agent('general', env, project), 'question', '*'),
    'deny',
    'the general worker must not be able to ask a question'
  );
});
