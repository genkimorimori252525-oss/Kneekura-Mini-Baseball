import { createRequire } from 'node:module';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, sep } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { state } from '../../core/world/club/ClubFixtures.test-support';
import { appendDevelopmentLearningEvent,
  startDevelopmentLearningEpisode,
  type DevelopmentLearningEventKind } from
  '../../core/world/development/DevelopmentLearningEpisode';
import { practiceBundleForEpisode } from
  '../../core/world/development/DevelopmentPracticeExposure.test-support';
import { applyRosterChange } from
  '../../core/world/roster/RosterCommands';
import { createRosterState } from '../../core/world/roster/RosterState';
import { rosterFixture } from
  '../../core/world/roster/RosterTestFixtures';
import type { PitchTimingProfile } from
  '../../core/sim/pitch/PitchTimingModel';
import { openSqliteManagerRosterDecisionStore } from
  './SqliteManagerRosterDecisionStore';
import { openSqlitePlayerPersonLinkStore } from
  './SqlitePlayerPersonLinkStore';
import { openSqlitePlayerPitchTimingStore,
  type AcceptedPitchTimingLearning } from
  './SqlitePlayerPitchTimingStore';
import { projectPitchTimingBreakthroughs } from
  './PitchTimingBreakthroughFromAcceptedSources';
import { openSqliteWorldSettlementStore } from
  './SqliteWorldSettlementStore';

const directories: string[] = [];
const stores: { close(): void }[] = [];
afterEach(() => {
  for (const store of stores.splice(0).reverse()) store.close();
  const root = realpathSync(tmpdir());
  for (const directory of directories.splice(0)) {
    const target = realpathSync(directory);
    if (!target.startsWith(`${root}${sep}`)
      || !basename(target).startsWith('kneekura-pitch-source-')) {
      throw new Error('test cleanup escaped temporary directory');
    }
    rmSync(target, { recursive: true, force: true });
  }
});
const profile: PitchTimingProfile = {
  baseStartIntervalUs: 10_000_000,
  normalMotionToReleaseUs: 600_000,
  followThroughUs: 200_000,
  quickSpeedFactor: 1.5,
  cadenceExecutionControl: 0.8,
  cadenceTimingKnowledge: 0.8,
  quickRepeatability: 0.7,
  naturalVariationUs: 50_000,
  normalPhaseWeights: { gather: 2, transition: 3, stride: 5 },
  quickPhaseWeights: { gather: 1, transition: 2, stride: 3 },
};
const acceptedBaseline = { sourceId: 'timing-baseline-1',
  sourceVersion: 'timing-v1', careerId: 'career-a', playerId: 'p2',
  personLinkSourceId: 'intake-p2', acceptedAtDay: 1, profile };
const learning = (): AcceptedPitchTimingLearning => {
  const before = createRosterState({ ...rosterFixture(),
    careerId: 'career-a' });
  const change = applyRosterChange(before, { commandId: 'promote-1',
    causeEventId: 'selection-1', expectedRevision: 0,
    effectiveDay: 10, changes: [{ playerId: 'p2',
      assignment: { clubId: 'a', unitId: 'a-first' } }],
  });
  if (!change.ok) throw new Error(JSON.stringify(change.rejection));
  let episode = startDevelopmentLearningEpisode('learning-1', before,
    change.state, change.event, 'p2', {
      careerId: 'career-a', playerId: 'p2', createdAtDay: 1,
      profileVersion: 'catalyst-v1',
    }, { policyId: 'learning-policy', version: 'v1',
      availableAtDay: 10, minimumPracticeEvents: 3,
      minimumFeedbackEvents: 1, minimumElapsedDays: 5 });
  const events = [
    { kind: 'APPRAISAL_ENGAGED', atDay: 10 },
    { kind: 'HYPOTHESIS_FORMED', atDay: 11 },
    { kind: 'PRACTICE_RECORDED', atDay: 12 },
    { kind: 'PRACTICE_RECORDED', atDay: 13 },
    { kind: 'PRACTICE_RECORDED', atDay: 14 },
    { kind: 'FEEDBACK_RECORDED', atDay: 14 },
    { kind: 'CONSOLIDATION_RECORDED', atDay: 15 },
  ] as const;
  for (const [index, item] of events.entries()) {
    episode = appendDevelopmentLearningEvent(episode,
      episode.revision, { eventId: `learning-event-${index}`,
        sourceEventId: `source-${index}`, atDay: item.atDay,
        kind: item.kind as DevelopmentLearningEventKind,
        ...(['HYPOTHESIS_FORMED', 'PRACTICE_RECORDED',
          'FEEDBACK_RECORDED', 'CONSOLIDATION_RECORDED']
          .includes(item.kind) ? { domain: 'TECHNICAL' as const } : {}),
      });
  }
  return { sourceId: 'accepted-learning-1', episode,
    measurements: [2, 3, 4].map((index) => ({
      practiceSourceEventId: `source-${index}`,
      normalMotionToReleaseUs: 600_000,
      quickMotionToReleaseUs: 300_000,
    })), practice: practiceBundleForEpisode(episode) };
};
const setup = () => {
  const directory = mkdtempSync(join(tmpdir(), 'kneekura-pitch-source-'));
  directories.push(directory);
  const path = join(directory, 'world.sqlite');
  const world = openSqliteWorldSettlementStore(path);
  const roster = openSqliteManagerRosterDecisionStore(path);
  stores.push(world, roster);
  world.initialize({ careerId: 'career-a', clubs: [state()],
    schedule: { seasonId: 'league-season-1', leagueId: 'league-a',
      memberClubIds: ['club-a', 'club-b'],
      regularSeasonGamesPerClub: 1,
      games: [{ gameId: 'game-1', homeClubId: 'club-a',
        awayClubId: 'club-b' }], revisionEventIds: [] },
    standingsPolicy: { version: 'standings-v1',
      tieCreditNumerator: 1, tieCreditDenominator: 2,
      runDifferentialCapPerGame: 10 } });
  roster.initialize({ careerId: 'career-a', clubId: 'club-a', mood: null,
    roster: createRosterState({ careerId: 'career-a',
      effectiveDay: 10, profiles: [{ profileId: 'league',
        version: 'v1', season: 1,
        competitionEditionId: 'league-season-1',
        activeLimit: null, allowedAssignmentKinds: ['FIRST_TEAM'],
        rehabParticipationAllowed: false }],
      units: [{ unitId: 'first-a', clubId: 'club-a',
        kind: 'FIRST_TEAM' }],
      players: [{ playerId: 'p2', clubRights: {
        rightsHolderClubId: 'club-a', contractId: 'contract-p2' },
        assignment: { unitId: 'first-a', clubId: 'club-a' },
        registrations: [], availability: { status: 'AVAILABLE',
          evidenceId: 'health-p2' } }],
    }) });
  const link = openSqlitePlayerPersonLinkStore(path, {
    readAcceptedPlayerIntake: (sourceId) =>
      sourceId === 'intake-p2' ? { sourceId,
        careerId: 'career-a', playerId: 'p2', personId: 'person-p2',
        sourceRecordId: 'accepted-intake-p2',
        sourceVersion: 'intake-v1', acceptedRevision: 1,
        acceptedAtDay: 1, rosterRevision: 0 } : null,
  });
  stores.push(link);
  link.accept('intake-p2');
  return { path, link };
};

it('persists a measured source change and replays it without live authority', () => {
  const { path, link } = setup();
  const evidence = learning();
  const timing = openSqlitePlayerPitchTimingStore(path, link, {
    readAcceptedBaseline: (sourceId) =>
      sourceId === acceptedBaseline.sourceId ? acceptedBaseline : null,
    readAcceptedLearning: (sourceId) =>
      sourceId === evidence.sourceId ? evidence : null,
  });
  stores.push(timing);
  expect(() => timing.apply(evidence.sourceId, 0))
    .toThrow('baseline is missing');
  expect(timing.initialize(acceptedBaseline.sourceId).revision).toBe(0);
  expect(timing.readHead('career-a', 'p2')?.profile.quickSpeedFactor)
    .toBe(1.5);
  expect(timing.readDevelopmentHistory('career-a', 'p2')).toEqual([]);
  expect(timing.selectProfile('career-a', 'p2', 10).quickSpeedFactor)
    .toBe(1.5);
  const changed = timing.apply(evidence.sourceId, 0);
  expect(changed).toMatchObject({ revision: 1,
    profile: { quickSpeedFactor: 2, normalMotionToReleaseUs: 600_000 },
    records: [{ episodeId: 'learning-1',
      changeKind: 'SOURCE_CHANGED' }] });
  const history = timing.readDevelopmentHistory('career-a', 'p2');
  expect(history?.map((event) => event.kind)).toEqual([
    'CATALYST', 'HYPOTHESIS_FORMED', 'CONSOLIDATION_PROGRESS',
    'SOURCE_STATE_CHANGED',
  ]);
  expect(history?.at(-1)).toMatchObject({
    careerId: 'career-a', playerId: 'p2', episodeId: 'learning-1',
    occurredAtDay: 15,
  });
  expect(timing.selectProfile('career-a', 'p2', 15).quickSpeedFactor)
    .toBe(2);
  expect(timing.selectProfileAtDay('career-a', 'p2', 14).quickSpeedFactor)
    .toBe(1.5);
  expect(timing.selectProfileAtDay('career-a', 'p2', 15).quickSpeedFactor)
    .toBe(2);
  expect(timing.readDevelopmentEvidenceAtDay('career-a', 'p2', 14))
    .toMatchObject({ source: { revision: 0 }, episodes: [] });
  expect(timing.readDevelopmentEvidenceAtDay('career-a', 'p2', 15))
    .toMatchObject({ source: { revision: 1 },
      episodes: [{ episodeId: 'learning-1' }] });
  expect(() => timing.selectProfile('career-a', 'p2', 14))
    .toThrow('day');
  expect(() => timing.apply(acceptedBaseline.sourceId, 1))
    .toThrow('belongs to baseline');
  expect(timing.apply(evidence.sourceId, 0)).toEqual(changed);
  expect(() => timing.apply(evidence.sourceId, 1)).toThrow('retry');
  timing.close(); stores.splice(stores.indexOf(timing), 1);
  const reopened = openSqlitePlayerPitchTimingStore(path, link);
  stores.push(reopened);
  expect(reopened.readHead('career-a', 'p2')).toEqual(changed);
  expect(reopened.readDevelopmentHistory('career-a', 'p2')).toEqual(history);
  expect(reopened.readDevelopmentEvidenceAtDay('career-a', 'p2', 15))
    .toEqual({ source: changed, episodes: [evidence.episode] });
  const breakthroughSources = { timing: reopened,
    checkpoints: { readAcceptedCheckpoints: (_careerId: string,
      _playerId: string, asOfDay: number) => [
      { checkpointId: 'check-1', episodeId: 'learning-1',
        atDay: 20, sourceRevision: 1,
        actualQuickSpeedFactor: 2,
        expectedQuickSpeedFactor: 1.6,
        trajectorySourceId: 'expected-1',
        trajectoryVersion: 'trajectory-v1' },
      { checkpointId: 'check-2', episodeId: 'learning-1',
        atDay: 120, sourceRevision: 1,
        actualQuickSpeedFactor: 2,
        expectedQuickSpeedFactor: 1.65,
        trajectorySourceId: 'expected-2',
        trajectoryVersion: 'trajectory-v1' },
    ].filter(checkpoint => checkpoint.atDay <= asOfDay) },
    policy: { readAcceptedPolicy: (sourceId: string) =>
      sourceId === 'breakthrough-policy-1' ? {
        policyId: 'major-quick-timing', version: 'v1',
        effectiveDay: 1, minimumSourceGain: 0.3,
        minimumDeviationAboveExpected: 0.3,
        minimumPersistenceDays: 90,
        minimumCheckpoints: 2 } : null } };
  const projection = { careerId: 'career-a', playerId: 'p2',
    asOfDay: 130, policySourceId: 'breakthrough-policy-1' };
  expect(projectPitchTimingBreakthroughs(breakthroughSources,
    { ...projection, asOfDay: 40 })).toEqual([]);
  expect(projectPitchTimingBreakthroughs(breakthroughSources,
    projection)).toMatchObject([{ kind: 'MAJOR_BREAKTHROUGH',
      episodeId: 'learning-1', occurredAtDay: 120 }]);
  expect(reopened.selectProfileAtDay('career-a', 'p2', 14))
    .toEqual(profile);
  expect(reopened.apply(evidence.sourceId, 0)).toEqual(changed);
  expect(() => reopened.apply('new-learning', 1)).toThrow('authority');
});

it('rejects unaccepted baseline and detects stored source alteration', () => {
  const { path, link } = setup();
  const timing = openSqlitePlayerPitchTimingStore(path, link, {
    readAcceptedBaseline: (sourceId) =>
      sourceId === acceptedBaseline.sourceId ? acceptedBaseline : null,
    readAcceptedLearning: () => null,
  });
  stores.push(timing);
  expect(() => timing.initialize('unknown')).toThrow('absent');
  timing.initialize(acceptedBaseline.sourceId);
  const Database = (createRequire(import.meta.url)('node:sqlite') as
    typeof import('node:sqlite')).DatabaseSync;
  const db = new Database(path);
  try {
    db.prepare(`UPDATE world_pitch_timing_heads SET state_json=?
      WHERE career_id=? AND player_id=?`).run('{}', 'career-a', 'p2');
    expect(() => timing.readHead('career-a', 'p2'))
      .toThrow('head diverged');
  } finally { db.close(); }
});
