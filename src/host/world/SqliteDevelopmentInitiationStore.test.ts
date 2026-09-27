import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, join, sep } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { CATALYST_FAMILIES } from
  '../../core/world/development/DevelopmentCatalyst';
import type { DevelopmentReceptivityPolicy } from
  '../../core/world/development/DevelopmentReceptivity';
import { CURVE_SHAPES, DEVELOPMENT_DOMAINS,
  MATURITY_TIMINGS } from
  '../../core/world/development/DevelopmentTrajectory';
import { applyRosterChange } from '../../core/world/roster/RosterCommands';
import { createRosterState } from '../../core/world/roster/RosterState';
import { rosterFixture } from '../../core/world/roster/RosterTestFixtures';
import type { DevelopmentAppraisalSources } from
  './DevelopmentEpisodeFromAcceptedAppraisal';
import { openSqliteDevelopmentInitiationStore } from
  './SqliteDevelopmentInitiationStore';

const directories: string[] = [];
const stores: { close(): void }[] = [];
afterEach(() => {
  for (const store of stores.splice(0).reverse()) store.close();
  const root = realpathSync(tmpdir());
  for (const directory of directories.splice(0)) {
    const target = realpathSync(directory);
    if (!target.startsWith(`${root}${sep}`)
      || !basename(target).startsWith('kneekura-development-initiation-')) {
      throw new Error('test cleanup escaped temporary directory');
    }
    rmSync(target, { recursive: true, force: true });
  }
});

const setup = () => {
  const before = createRosterState(rosterFixture());
  const promoted = applyRosterChange(before, {
    commandId: 'promotion-1', causeEventId: 'execution-1',
    expectedRevision: 0, effectiveDay: 10,
    changes: [{ playerId: 'p2',
      assignment: { clubId: 'a', unitId: 'a-first' } }],
  });
  if (!promoted.ok) throw new Error('fixture promotion failed');
  const curves = Object.fromEntries(MATURITY_TIMINGS.map(timing =>
    [timing, Object.fromEntries(CURVE_SHAPES.map(shape =>
      [shape, [{ ageYears: 0, receptivity: 1,
        declinePressure: 0 }, { ageYears: 40,
        receptivity: 1, declinePressure: 0 }]]))])) as unknown as
      DevelopmentReceptivityPolicy['templateCurves'];
  const sources: Omit<DevelopmentAppraisalSources, 'history'> = {
    roster: { readDevelopmentRosterChange: executionId =>
      executionId === 'execution-1' ? { before,
        after: promoted.state, event: promoted.event } : null },
    person: { read: sourceId => sourceId === 'person-1' ? {
      careerId: before.careerId, playerId: 'p2',
      personId: 'person-p2', priors: {
        createdAtDay: 1,
        catalyst: { careerId: before.careerId,
          playerId: 'p2', createdAtDay: 1,
          profileVersion: 'catalyst-v1',
          sensitivityByFamily: Object.fromEntries(
            CATALYST_FAMILIES.map(family => [family, 1])) as
              Record<typeof CATALYST_FAMILIES[number], number> },
        trajectory: { careerId: before.careerId,
          playerId: 'p2', createdAtDay: 1,
          profileVersion: 'trajectory-v1',
          maturityTiming: 'NORMAL', curveShape: 'BROAD_PLATEAU',
          domainOffsets: Object.fromEntries(
            DEVELOPMENT_DOMAINS.map(domain => [domain, 0])) as
              Record<typeof DEVELOPMENT_DOMAINS[number], number>,
          generation: { rngVersion: 'development-xorshift32-v1',
            seed: 1729, drawCount: 8, policyId: 'trajectory-v1' } },
      },
    } : null,
    readDevelopmentSeed: careerId =>
      careerId === before.careerId ? 1729 : null },
    appraisal: { readAcceptedAppraisal: sourceId =>
      sourceId === 'appraisal-1' ? { sourceId,
        episodeId: 'episode-1', careerId: before.careerId,
        playerId: 'p2', domain: 'TECHNICAL',
        ageYears: 20, competingLearningLoad: 0,
        appraisal: { sourceEventId: sourceId,
          atDay: 10, salience: 1,
          learningDisposition: 1, novelty: 1,
          consolidationCapacity: 1 } } : null },
    policies: { readAcceptedPolicies: sourceId =>
      sourceId === 'policy-1' ? { sourceId,
        careerId: before.careerId,
        learning: { policyId: 'learning-v1', version: 'v1',
          availableAtDay: 1, minimumPracticeEvents: 2,
          minimumFeedbackEvents: 1, minimumElapsedDays: 5 },
        receptivity: { policyId: 'receptivity-v1', version: 'v1',
          profileVersion: 'trajectory-v1',
          availableAtDay: 1, templateCurves: curves },
        initiation: { policyId: 'initiation-v1', version: 'v1',
          availableAtDay: 1, baseChance: 1, maximumChance: 1,
          sameMotifSaturation: 0.5, cooldownDays: 30,
          maximumOpenHypotheses: 2 } } : null },
  };
  const directory = mkdtempSync(join(tmpdir(),
    'kneekura-development-initiation-'));
  directories.push(directory);
  return { path: join(directory, 'world.sqlite'), sources };
};
const request = { episodeId: 'episode-1', executionId: 'execution-1',
  playerId: 'p2', personSourceId: 'person-1',
  appraisalSourceId: 'appraisal-1', policySourceId: 'policy-1' };

it('replays one initiation and accepted learning after restart without another draw', () => {
  const { path, sources } = setup();
  const authority = { readAcceptedLearningEvent: (sourceId: string) =>
    sourceId === 'hypothesis-1' ? {
      eventId: 'hypothesis-1', sourceEventId: 'learning-source-1',
      atDay: 11, kind: 'HYPOTHESIS_FORMED' as const,
      domain: 'TECHNICAL' as const } : null };
  const store = openSqliteDevelopmentInitiationStore(path,
    sources, authority);
  stores.push(store);
  const first = store.apply(request);
  expect(first.assessment).toMatchObject({ initiated: true,
    drawCount: 1 });
  expect(store.apply(request)).toEqual(first);
  expect(store.readAcceptedPrior(first.episode.careerId, 'p2', 11))
    .toEqual([first]);
  const advanced = store.advance('episode-1', 'hypothesis-1', 1);
  expect(advanced.stage).toBe('HYPOTHESIS');
  expect(store.advance('episode-1', 'hypothesis-1', 1))
    .toEqual(advanced);
  expect(() => store.advance('episode-1', 'hypothesis-1', 2))
    .toThrow('retry');
  store.close(); stores.splice(stores.indexOf(store), 1);
  const reopened = openSqliteDevelopmentInitiationStore(path, sources);
  stores.push(reopened);
  expect(reopened.read('episode-1')).toEqual({
    assessment: first.assessment, episode: advanced });
  expect(reopened.readAcceptedPrior(first.episode.careerId, 'p2', 11))
    .toEqual([{ assessment: first.assessment, episode: advanced }]);
  expect(reopened.readAcceptedPrior(first.episode.careerId, 'p2', 10))
    .toEqual([first]);
  expect(() => reopened.apply({ ...request,
    executionId: 'different' })).toThrow('retry');
  expect(() => reopened.advance('episode-1', 'new-source', 2))
    .toThrow('authority');
  const Database = (createRequire(import.meta.url)('node:sqlite') as
    typeof import('node:sqlite')).DatabaseSync;
  const tamper = new Database(path);
  tamper.prepare(`UPDATE world_development_initiations
    SET current_json='{}' WHERE episode_id='episode-1'`).run();
  tamper.close();
  expect(() => reopened.read('episode-1')).toThrow('head diverged');
});
