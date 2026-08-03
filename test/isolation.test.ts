// A skill is installable on its own, so nothing it ships may point outside its own
// folder — not the generated config block, and not a hand-written "see also" into a
// sibling skill. These tests enforce that, and that what stays inside still resolves.

import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { ROOT, sandbox, type Sandbox } from './helpers.ts';
import { discoverSkills, paths } from '../scripts/gen-skills.ts';

const boxes: Sandbox[] = [];
after(() => boxes.forEach((b) => b.cleanup()));

/**
 * Every skill directory, as "<category>/<name>".
 *
 * Asked of the generator rather than walked again here: what counts as a skill is one
 * rule, and a second walk in this file would answer it slightly differently — it
 * counted any directory, where the generator requires a SKILL.md in a known category.
 */
function allSkills(): string[] {
  return discoverSkills(paths(ROOT)).map((s) => s.path);
}

/** Markdown files a skill ships. */
function docsOf(skillDir: string): string[] {
  return readdirSync(skillDir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => join(skillDir, f));
}

/**
 * Relative markdown link targets in `file`, ignoring pure anchors and URLs.
 *
 * Code is stripped first. A link inside a fence or backticks is a fragment of what
 * the skill *generates* — a badge pointing at the consuming repo's LICENSE, an
 * image path for a README it writes — and is not navigation within the skill.
 * Treating those as links reported five false positives on the first run.
 */
function relativeLinks(file: string): string[] {
  const body = readFileSync(file, 'utf8')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`\n]*`/g, '');
  return [...body.matchAll(/\]\(([^)]+)\)/g)]
    .flatMap((m) => {
      const target = m[1]?.split('#')[0];
      return target ? [target] : [];
    })
    .filter((t) => !/^[a-z]+:/i.test(t) && !t.startsWith('/'));
}

/** Skills whose shipped markdown contains `tag` (an opening block marker). */
function skillsWithTag(tag: string): string[] {
  return allSkills().filter((p) =>
    docsOf(join(ROOT, 'skills', p)).some((f) =>
      readFileSync(f, 'utf8').includes(tag)
    )
  );
}

/** Everything a skill's own markdown says, as one string. */
const shippedText = (path: string) =>
  docsOf(join(ROOT, 'skills', path))
    .map((f) => readFileSync(f, 'utf8'))
    .join('\n');

/**
 * Prose reaching for text that has an author: an issue body or its comments, a PR's
 * comments, a handoff document. Deliberately narrow — it names the reads that decide the
 * FULL tier, not everything a skill might touch — so a hit is evidence and a miss is
 * merely no evidence.
 */
const READS_AUTHORED =
  /gh (issue|pr) view[^`]{0,80}(body|comments)|gh api[^`]{0,80}comments|list_comments|get_issue\b|handoff document/;

const withConfigBlock = skillsWithTag('<skills-config>');
// The resolver is a file a skill *runs*, so it follows the mention, not the block: every
// block host names it, plus the two queue skills, which delegate the contract's prose to
// their worker's REFERENCE and still have to execute the script themselves.
const withResolver = skillsWithTag('templates/resolve-config.sh');
// `<skills-authority>` is a strict prefix of `<skills-authority-reduced>` only up to
// the `-`, so the trailing `>` in each literal keeps the two sets from overlapping.
const withAuthorityFull = skillsWithTag('<skills-authority>');
const withAuthorityReduced = skillsWithTag('<skills-authority-reduced>');
// Same trailing-`>` reasoning for the check-command block's two variants.
const withVerifyBase = skillsWithTag('<skills-verify>');
const withVerifyIsolated = skillsWithTag('<skills-verify-isolated>');
const withPlanBlock = skillsWithTag('<skills-plan>');
const withTldrBlock = skillsWithTag('<skills-tldr>');
const withForgeBlock = skillsWithTag('<skills-forge>');

/**
 * Which skills run the repo's gate, and in which tree.
 *
 * `base` runs it in the working tree; `isolated` runs it in a tree that is not the working
 * tree — a PR head, a pushed branch, a worktree the run made for itself — so it installs
 * that tree's lockfile first. A skill that can be either, depending on how the repo
 * configures it, belongs in `isolated`: `work-implement` verifies in place when sequential
 * but in a fresh worktree once `parallel` is on, and the install section is scoped by its
 * own heading, so the isolated body is the superset that stays correct on both paths.
 *
 * The roster lives here rather than being inferred, because both failure directions are
 * silent on disk: a skill that starts running checks without the block re-invents
 * detection, and a listed one that lost its block keeps the prose that promises it.
 */
const VERIFY_CARRIERS: Record<'base' | 'isolated', string[]> = {
  base: ['repo/prune-comments', 'repo/update-deps'],
  isolated: ['repo/merge-deps', 'work/work-implement', 'work/work-review']
};

/**
 * Which skills put a plan in front of a human — a plan, a preview, a candidate list or a
 * findings report — and therefore carry the rule that all of it has to render in a terminal.
 *
 * Declared, for the same reason as the roster above: both failure directions are silent. A
 * skill that starts presenting a plan without the block re-decides the form per run, which is
 * how a package list ended up folded into `<details>` and arrived as an empty summary line;
 * a listed one that lost its block keeps the promise with nothing behind it.
 *
 * The four skills deliberately absent present no plan to answer: `handoff` and `vhs-demo`
 * deliver a file, and `work-implement` / `work-review` are single units a drain invokes, whose
 * output is a short outcome rather than something a human reads to decide.
 *
 * `tldr` carries it while waiting for no answer at all, and that is the criterion rather than an
 * exception to it: what the block binds is the message a human reads in a terminal, and for `tldr`
 * that message *is* the whole product — a sectioned report, which is precisely the shape that
 * arrives folded.
 */
const PLAN_CARRIERS = [
  'docs/compact-readme',
  'docs/write-contributing',
  'docs/write-docs',
  'docs/write-readme',
  'meta/tituskirch-skills-config',
  'meta/validate-skills',
  'repo/atomic-commit',
  'repo/merge-deps',
  'repo/prune-branches',
  'repo/prune-comments',
  'repo/pull-request',
  'repo/release',
  'repo/update-deps',
  'work/issue',
  'work/refine-issue',
  'work/tldr',
  'work/work-implement-queue',
  'work/work-review-queue'
];

/**
 * Which skills end a run with a report of what happened, and therefore carry the rule that
 * the report opens with its result rather than with its first group.
 *
 * The criterion is the **last thing the skill hands back**: an account of a run — what was
 * found, what was acted on, what is left — read once and acted on. A skill whose closing
 * output is a plan awaiting a yes is not on this list; the plan block governs that, and a
 * plan already opens with what it proposes.
 *
 * `tldr` is deliberately absent, and it is the one skill whose absence is not about the
 * criterion: its entire product is this frame, fixed in its own workflow, so mirroring the
 * block into it would give one skill two statements of the same rule to drift apart.
 *
 * Declared rather than inferred, for the reason the rosters above are: both failure
 * directions are silent on disk. A skill that starts reporting without the block buries its
 * result under its first group; a listed one that lost its block keeps the promise with
 * nothing behind it.
 */
const TLDR_CARRIERS = [
  'meta/validate-skills',
  'repo/merge-deps',
  'repo/prune-branches',
  'repo/prune-comments',
  'repo/release',
  'repo/update-deps',
  'work/work-implement-queue',
  'work/work-review-queue'
];

/**
 * Which skills pick a forge driver and resolve the host it talks to.
 *
 * Two facts, one rule: which CLI drives the forge (`gh` / `glab`) and which instance that
 * CLI is pointed at. The host is the half that has to be mirrored rather than assumed —
 * self-hosted GitLab is the normal deployment and GitHub Enterprise has the same shape, so
 * a skill that resolves it once and reuses it reaches the wrong instance the moment a
 * session touches a second repo.
 *
 * Declared, like the two rosters below it, because both failure directions are silent: a
 * skill that starts driving a forge without the block re-derives the ladder its own way,
 * and a listed one that lost its block keeps prose promising a resolution it no longer has.
 *
 * `release` is deliberately absent: it is GitHub-only, and stating that limitation is
 * tracked on its own rather than papered over with a rule it does not follow. `merge-deps`
 * was absent for the same reason and no longer is — its author guarantee turned out to be
 * reproducible on GitLab from a configured identity, so it drives both forges and carries
 * the block. The two queue skills are absent for the standing reason — they name their
 * worker's REFERENCE instead of mirroring, which the suite at the bottom of this file pins.
 */
const FORGE_CARRIERS = [
  'repo/merge-deps',
  'repo/prune-branches',
  'repo/pull-request',
  'work/issue',
  'work/work-implement',
  'work/work-review'
];

describe('the forge driver and its host are one rule, not one per skill', () => {
  test('the tags on disk are exactly the roster', () => {
    assert.deepEqual(withForgeBlock.sort(), [...FORGE_CARRIERS].sort());
  });

  test('every forge-carrier also carries the config block, so it ships the resolver it reads forge/forgeHost from', () => {
    for (const path of withForgeBlock) {
      assert.ok(
        withConfigBlock.includes(path),
        `${path} carries the forge block but not the config block/resolver`
      );
    }
  });

  test('no link inside the forge block leaves the skill folder', () => {
    for (const path of withForgeBlock) {
      const dir = join(ROOT, 'skills', path);
      for (const file of docsOf(dir)) {
        const body = readFileSync(file, 'utf8');
        const from = body.indexOf('<skills-forge>');
        if (from === -1) continue;
        const block = body.slice(from, body.indexOf('</skills-forge>'));
        for (const target of relativeLinks(file).filter((t) =>
          block.includes(`(${t}`)
        )) {
          assert.ok(
            !target.startsWith('..'),
            `${path}: forge block links out of the skill via "${target}"`
          );
        }
      }
    }
  });
});

describe('the generated config block is self-contained', () => {
  test('it is present in the skills that read config, and nowhere else by accident', () => {
    assert.equal(
      withConfigBlock.length,
      17,
      `found: ${withConfigBlock.join(', ')}`
    );
  });

  test('every block host also ships the resolver the block points at', () => {
    const missing = withConfigBlock.filter((p) => !withResolver.includes(p));
    assert.deepEqual(missing, [], 'the block links a resolver the skill lacks');
  });

  test('no link inside the block leaves the skill folder', () => {
    for (const path of withConfigBlock) {
      const dir = join(ROOT, 'skills', path);
      for (const file of docsOf(dir)) {
        const body = readFileSync(file, 'utf8');
        const from = body.indexOf('<skills-config>');
        if (from === -1) continue;
        const block = body.slice(from, body.indexOf('</skills-config>'));
        for (const target of relativeLinks(file).filter((t) =>
          block.includes(`(${t}`)
        )) {
          assert.ok(
            !target.startsWith('..'),
            `${path}: block links out of the skill via "${target}"`
          );
        }
      }
    }
  });

  test('every path the block points at exists in an isolated copy', () => {
    const box = sandbox('minimal.json', 'work/work-implement');
    boxes.push(box);
    const file = join(box.skill, 'REFERENCE.md');
    const body = readFileSync(file, 'utf8');
    const block = body.slice(
      body.indexOf('<skills-config>'),
      body.indexOf('</skills-config>')
    );
    const targets = [...block.matchAll(/\]\(([^)]+)\)/g)]
      .flatMap((m) => {
        const target = m[1]?.split('#')[0];
        return target ? [target] : [];
      })
      .filter((t) => !/^[a-z]+:/i.test(t));
    assert.ok(targets.length > 0, 'the block should reference the resolver');
    for (const target of targets) {
      assert.ok(
        existsSync(join(box.skill, target)),
        `missing after install: ${target}`
      );
    }
  });

  test('the resolver ships with every skill that names it', () => {
    for (const path of withResolver) {
      assert.ok(
        existsSync(
          join(ROOT, 'skills', path, 'templates', 'resolve-config.sh')
        ),
        `${path} names the resolver but does not ship it`
      );
    }
  });

  test('no skill ships a resolver it does not name', () => {
    // The other half of the contract, checked against the real registry rather than a
    // fixture: the mention is what the sync keys shipping on, so a copy left behind by a
    // skill that stopped naming the script is checked by nothing above — every assertion
    // here iterates the skills that *do* name it.
    const orphans = allSkills().filter(
      (path) =>
        !withResolver.includes(path) &&
        existsSync(join(ROOT, 'skills', path, 'templates', 'resolve-config.sh'))
    );
    assert.deepEqual(orphans, [], 'shipped resolver that nothing points at');
  });

  test('all shipped resolvers are byte-identical to the canonical one', () => {
    const canonical = readFileSync(
      join(ROOT, 'scripts', 'resolve-config.sh'),
      'utf8'
    );
    for (const path of withResolver) {
      const copy = readFileSync(
        join(ROOT, 'skills', path, 'templates', 'resolve-config.sh'),
        'utf8'
      );
      assert.equal(
        copy,
        canonical,
        `${path} drifted from scripts/resolve-config.sh`
      );
    }
  });
});

// Every skill is classified here — not just the carriers (issue #92). The tiers state the
// criterion ADR-0004 settled: FULL for a skill that acts on text from an identifiable
// author — authorship is checkable, so it is checked — REDUCED for one that reads
// third-party text with no author to check, where the rule is flat (data, never
// instruction), and NONE for a skill that reads only its own repo or session, with no
// third-party text to judge.
//
// What this table is, stated plainly: a declaration, not a derivation. A tier is written
// down, and the tests below check four things about it — the table covers every skill,
// each entry carries a written justification (the union type makes that field mandatory),
// the declared tier matches the tag on disk, and — the two derivation tests further down —
// the declaration does not contradict what the skill's own prose reaches for. Together
// they close the trap that let `prune-comments` and `prune-branches` slip the earlier name
// list, and they catch a tier that is plainly wrong. What no test here can do is *decide*
// the tier: whether a skill reads authored text is a judgement about prose, and the
// derivation is a coarse signal standing in for it. ADR-0013 records that ceiling.
const authorityClass: Record<
  string,
  { tier: 'full' | 'reduced'; reads: string } | { tier: 'none'; reason: string }
> = {
  // FULL — acts on text from an identifiable author.
  'repo/merge-deps': { tier: 'full', reads: "a Dependabot PR's author" },
  'work/handoff': { tier: 'full', reads: 'a handoff document author' },
  'work/issue': { tier: 'full', reads: 'issue and comment authors' },
  'work/refine-issue': {
    tier: 'full',
    reads:
      'an issue body and its comments, including a rescope someone else wrote'
  },
  'work/work-implement': {
    tier: 'full',
    reads: 'an issue body and review feedback'
  },
  'work/work-review': { tier: 'full', reads: 'an issue body and its comments' },
  // REDUCED — reads third-party text with no author to check.
  'repo/prune-branches': { tier: 'reduced', reads: "closed PRs' titles" },
  'repo/prune-comments': { tier: 'reduced', reads: 'code comments' },
  'repo/release': { tier: 'reduced', reads: 'upstream changelogs' },
  'repo/update-deps': { tier: 'reduced', reads: 'changelogs and advisories' },
  'work/work-implement-queue': {
    tier: 'reduced',
    reads: 'issue references and PR state'
  },
  'work/work-review-queue': {
    tier: 'reduced',
    reads: 'issue references and PR state'
  },
  // NONE — reads only its own repo or session; no third-party text to judge.
  'docs/compact-readme': {
    tier: 'none',
    reason: "the repo's own README — no third-party text"
  },
  'docs/vhs-demo': {
    tier: 'none',
    reason: "the repo's own CLI and tape — no third-party text"
  },
  'docs/write-contributing': {
    tier: 'none',
    reason: "the repo's own files and its existing guide — no third-party text"
  },
  'docs/write-docs': {
    tier: 'none',
    reason: "the repo's own code and docs — no third-party text"
  },
  'docs/write-readme': {
    tier: 'none',
    reason: "the repo's own project metadata — no third-party text"
  },
  'meta/tituskirch-skills-config': {
    tier: 'none',
    reason: "the repo's own config and signals — no third-party text"
  },
  'meta/validate-skills': {
    tier: 'none',
    reason:
      "the repo's own skill files, read as data to validate — the spec and house verdicts come from tools, not the agent reading the text"
  },
  'repo/atomic-commit': {
    tier: 'none',
    reason: "the session's own working-tree diff — no third-party text"
  },
  'repo/pull-request': {
    tier: 'none',
    reason:
      "the branch's own commits and the repo's PR template — no third-party text"
  },
  'work/tldr': {
    tier: 'none',
    reason:
      "the session's own conversation and the repo's own git state — no third-party text"
  }
};

describe('the author-authority tier follows the criterion, not a name list', () => {
  test('every skill on disk is classified exactly once — one absent from the table fails here, so it cannot be added without being placed', () => {
    assert.deepEqual(Object.keys(authorityClass).sort(), allSkills().sort());
  });

  test('each skill carries exactly the tag its classification declares — a declared full/reduced carries that tag, a declared non-carrier neither', () => {
    for (const path of allSkills()) {
      const carried = withAuthorityFull.includes(path)
        ? 'full'
        : withAuthorityReduced.includes(path)
          ? 'reduced'
          : 'none';
      assert.equal(
        carried,
        authorityClass[path]?.tier,
        `${path}: classified ${authorityClass[path]?.tier} but carries ${carried} on disk`
      );
    }
  });

  test('no skill carries both variants', () => {
    const both = withAuthorityFull.filter((p) =>
      withAuthorityReduced.includes(p)
    );
    assert.deepEqual(both, [], 'a skill has both the full and reduced block');
  });

  // The two tests above check the table against itself and against the tags on disk —
  // exhaustiveness and agreement, both real. Neither can catch a *wrong* tier: a skill
  // that reads issue comments, declared `none` with a plausible reason and no tag, passes
  // both. These two reach past the declaration to something observable in the prose. It
  // is a coarse signal and always will be — reading text is not a thing a grep can
  // decide — but it is the difference between a table checked for completeness and one
  // checked against what its skills actually do.
  test('a skill declared to read no third-party text does not reach for authored text', () => {
    const misclassified = allSkills().filter(
      (p) =>
        authorityClass[p]?.tier === 'none' &&
        READS_AUTHORED.test(shippedText(p))
    );
    assert.deepEqual(
      misclassified,
      [],
      'declared to read nothing third-party, yet its prose reads an issue body, a comment or a handoff'
    );
  });

  test('a skill declared full shows the authored text it claims to read', () => {
    const unsupported = allSkills().filter(
      (p) =>
        authorityClass[p]?.tier === 'full' &&
        !READS_AUTHORED.test(shippedText(p))
    );
    assert.deepEqual(
      unsupported,
      [],
      'declared full, but nothing in its prose reaches for text with an author — the reads: justification has no basis on disk'
    );
  });

  test('every authority-carrier ships the resolver it needs to read trustedBots', () => {
    // The resolver, not the block: `trustedBots` is read by running the script, and a skill
    // whose worker's REFERENCE states the contract still ships the script itself. Asserting
    // the block here would only say where the prose lives, which is not what the rule needs.
    for (const path of [...withAuthorityFull, ...withAuthorityReduced]) {
      assert.ok(
        withResolver.includes(path),
        `${path} carries the authority block but ships no resolver`
      );
    }
  });

  test('no link inside either authority block leaves the skill folder', () => {
    const pairs = [
      ['<skills-authority>', '</skills-authority>'],
      ['<skills-authority-reduced>', '</skills-authority-reduced>']
    ] as const;
    for (const path of [...withAuthorityFull, ...withAuthorityReduced]) {
      const dir = join(ROOT, 'skills', path);
      for (const file of docsOf(dir)) {
        const body = readFileSync(file, 'utf8');
        for (const [open, close] of pairs) {
          const from = body.indexOf(open);
          if (from === -1) continue;
          const block = body.slice(from, body.indexOf(close));
          for (const target of relativeLinks(file).filter((t) =>
            block.includes(`(${t}`)
          )) {
            assert.ok(
              !target.startsWith('..'),
              `${path}: authority block links out of the skill via "${target}"`
            );
          }
        }
      }
    }
  });
});

describe('the check-command contract reaches every skill that runs the gate', () => {
  test('the tags on disk are exactly the roster, in both variants', () => {
    assert.deepEqual(withVerifyBase.sort(), [...VERIFY_CARRIERS.base].sort());
    assert.deepEqual(
      withVerifyIsolated.sort(),
      [...VERIFY_CARRIERS.isolated].sort()
    );
  });

  test('no skill carries both variants', () => {
    const both = withVerifyBase.filter((p) => withVerifyIsolated.includes(p));
    assert.deepEqual(both, [], 'a skill has both the base and isolated block');
  });

  test('every verify-carrier also carries the config block, so it ships the resolver the block reads $resolved from', () => {
    for (const path of [...withVerifyBase, ...withVerifyIsolated]) {
      assert.ok(
        withConfigBlock.includes(path),
        `${path} carries the verify block but not the config block/resolver`
      );
    }
  });

  test('no link inside either verify block leaves the skill folder', () => {
    const pairs = [
      ['<skills-verify>', '</skills-verify>'],
      ['<skills-verify-isolated>', '</skills-verify-isolated>']
    ] as const;
    for (const path of [...withVerifyBase, ...withVerifyIsolated]) {
      const dir = join(ROOT, 'skills', path);
      for (const file of docsOf(dir)) {
        const body = readFileSync(file, 'utf8');
        for (const [open, close] of pairs) {
          const from = body.indexOf(open);
          if (from === -1) continue;
          const block = body.slice(from, body.indexOf(close));
          for (const target of relativeLinks(file).filter((t) =>
            block.includes(`(${t}`)
          )) {
            assert.ok(
              !target.startsWith('..'),
              `${path}: verify block links out of the skill via "${target}"`
            );
          }
        }
      }
    }
  });
});

describe('nothing a skill ships points out of its folder', () => {
  test('no skill links outside its own folder', () => {
    const offenders: string[] = [];
    for (const path of allSkills()) {
      const dir = join(ROOT, 'skills', path);
      for (const file of docsOf(dir)) {
        for (const target of relativeLinks(file)) {
          if (target.startsWith('..')) offenders.push(`${path}: ${target}`);
        }
      }
    }
    assert.deepEqual(
      offenders,
      [],
      'a cross-skill link dangles on an installed copy — name the skill instead'
    );
  });

  test('a link that stays inside a skill actually resolves', () => {
    const broken: string[] = [];
    for (const path of allSkills()) {
      const dir = join(ROOT, 'skills', path);
      for (const file of docsOf(dir)) {
        for (const target of relativeLinks(file)) {
          if (target.startsWith('..')) continue;
          if (!existsSync(join(dirname(file), target)))
            broken.push(`${path}: ${target}`);
        }
      }
    }
    assert.deepEqual(broken, [], 'intra-skill links must not dangle');
  });
});

/**
 * The two skills that cannot run alone, and the sibling each requires.
 *
 * Installable alone still holds for both — nothing they ship points out of their folder, which
 * the suite above checks. What they do not do is *run* alone: each names its worker and verifies
 * it is installed before any state change, so there is no execution path on which it needs the
 * worker's rules with the worker absent. That is what lets them name the worker's REFERENCE for
 * the config contract and the lock spec instead of mirroring ~12.5 KB of both into a `SKILL.md`
 * that has no `REFERENCE.md` to keep it out of the unconditional load path.
 *
 * Declared, because both failure directions are silent on disk: a re-grown block pays the
 * duplication again on every unattended pass, and dropped naming leaves a rule the skill still
 * relies on with nowhere to read it.
 */
const DELEGATES_TO_WORKER: Record<string, string> = {
  'work/work-implement-queue': 'work-implement',
  'work/work-review-queue': 'work-review'
};

describe('a skill that cannot run alone names its worker instead of mirroring', () => {
  for (const [path, worker] of Object.entries(DELEGATES_TO_WORKER)) {
    test(`${path} carries neither mirrored block`, () => {
      const text = shippedText(path);
      for (const tag of [
        '<skills-config>',
        '<skills-worklock>',
        '<skills-forge>'
      ]) {
        assert.ok(
          !text.includes(tag),
          `${path} re-grew ${tag} — ${worker}'s REFERENCE already states it`
        );
      }
    });

    test(`${path} names ${worker}'s REFERENCE for every rule it delegates`, () => {
      const text = shippedText(path);
      assert.ok(
        text.includes(`\`${worker}\`'s REFERENCE`),
        `${path} must name ${worker}'s REFERENCE as where the rules live`
      );
      for (const rule of [
        'Reading the config',
        'The single-flight lock',
        'The forge and its host'
      ]) {
        assert.ok(
          text.includes(rule),
          `${path} no longer names "${rule}" — the rule has nowhere to be read from`
        );
      }
    });

    test(`${path} still ships the resolver it runs`, () => {
      // Naming a sibling's prose is not the same as reaching for a sibling's file: the
      // contract may be read from the worker, the script has to be in this folder.
      assert.ok(
        existsSync(
          join(ROOT, 'skills', path, 'templates', 'resolve-config.sh')
        ),
        `${path} delegated the contract and lost the script with it`
      );
    });
  }
});

// The plan-only trigger phrases are user-facing vocabulary: whichever skill a user is
// talking to, the same words have to reach the same behaviour. They are hand-copied into
// every skill that offers the mode — deliberately, since each also names its own action
// ("nichts löschen", "nicht committen") and the promise itself reads better in each
// skill's own verb than in one generic formula. What must not vary is the shared core,
// and it already had: seven skills wrote "nur den plan", three "nur den Plan", with
// nothing anywhere to notice the split.
const PLAN_ONLY_TRIGGERS = ['just show me', 'dry run', 'nur den Plan'];

/** Skills offering a plan-only mode, found by the heading that announces it. */
function skillsWithPlanOnlyMode(): string[] {
  return allSkills().filter((p) =>
    docsOf(join(ROOT, 'skills', p)).some((f) =>
      readFileSync(f, 'utf8').includes('Plan-only triggers')
    )
  );
}

describe('plan-only triggers are one vocabulary, not one per skill', () => {
  const offering = skillsWithPlanOnlyMode();

  test('the mode is offered by the skills that change things', () => {
    // Not a fixed roster — the count guards against the heading being renamed and this
    // whole suite silently checking an empty set.
    assert.ok(
      offering.length >= 8,
      `only ${offering.length} skills announce plan-only triggers`
    );
  });

  test('each offering skill names every trigger in the shared core', () => {
    const missing: string[] = [];
    for (const path of offering) {
      const text = shippedText(path);
      for (const trigger of PLAN_ONLY_TRIGGERS) {
        if (!text.includes(`"${trigger}"`))
          missing.push(`${path}: "${trigger}"`);
      }
    }
    assert.deepEqual(
      missing,
      [],
      'a plan-only skill must offer the whole core'
    );
  });

  test('the German trigger keeps its capital everywhere', () => {
    // The drift that actually happened. Checked across every skill, not just the ones
    // above, so a lowercase copy cannot hide in a skill that words the heading its own way.
    const lowercase = allSkills().filter((p) =>
      /nur den plan/.test(shippedText(p))
    );
    assert.deepEqual(
      lowercase,
      [],
      'write "nur den Plan" — it is a noun, and the phrase is one vocabulary'
    );
  });
});

describe('the plan a skill presents has to render where it is read', () => {
  test('the tags on disk are exactly the roster', () => {
    assert.deepEqual(withPlanBlock.sort(), [...PLAN_CARRIERS].sort());
  });

  test('every skill offering a plan-only mode carries the block', () => {
    // Derived rather than listed: a skill that promises to print a plan and stop is
    // presenting one by definition, so this half of the roster cannot go stale.
    const missing = skillsWithPlanOnlyMode().filter(
      (p) => !withPlanBlock.includes(p)
    );
    assert.deepEqual(
      missing,
      [],
      'a skill that prints a plan on request must carry the rule for how it renders'
    );
  });

  test('no link inside the plan block leaves the skill folder', () => {
    for (const path of withPlanBlock) {
      const dir = join(ROOT, 'skills', path);
      for (const file of docsOf(dir)) {
        const body = readFileSync(file, 'utf8');
        const from = body.indexOf('<skills-plan>');
        if (from === -1) continue;
        const block = body.slice(from, body.indexOf('</skills-plan>'));
        for (const target of relativeLinks(file).filter((t) =>
          block.includes(`(${t}`)
        )) {
          assert.ok(
            !target.startsWith('..'),
            `${path}: plan block links out of the skill via "${target}"`
          );
        }
      }
    }
  });
});

describe('the report a run ends with has to lead with its result', () => {
  test('the tags on disk are exactly the roster', () => {
    assert.deepEqual(withTldrBlock.sort(), [...TLDR_CARRIERS].sort());
  });

  test('every reporting skill also carries the plan block', () => {
    // The two rules govern the same message from opposite ends — what may be hidden in it,
    // and what it opens with — so a skill bound by one and not the other has a report whose
    // lead is specified and whose body may still arrive folded.
    const missing = withTldrBlock.filter((p) => !withPlanBlock.includes(p));
    assert.deepEqual(
      missing,
      [],
      'a skill whose report leads with a TL;DR must also render the rest of it'
    );
  });

  test('no link inside the tldr block leaves the skill folder', () => {
    for (const path of withTldrBlock) {
      const dir = join(ROOT, 'skills', path);
      for (const file of docsOf(dir)) {
        const body = readFileSync(file, 'utf8');
        const from = body.indexOf('<skills-tldr>');
        if (from === -1) continue;
        const block = body.slice(from, body.indexOf('</skills-tldr>'));
        for (const target of relativeLinks(file).filter((t) =>
          block.includes(`(${t}`)
        )) {
          assert.ok(
            !target.startsWith('..'),
            `${path}: tldr block links out of the skill via "${target}"`
          );
        }
      }
    }
  });
});
