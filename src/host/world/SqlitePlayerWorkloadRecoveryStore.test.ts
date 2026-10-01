import { createRequire } from 'node:module';
import { afterEach, expect, it } from 'vitest';
import { state } from '../../core/world/club/ClubFixtures.test-support';
import { appendDevelopmentLearningEvent, startDevelopmentLearningEpisode } from '../../core/world/development/DevelopmentLearningEpisode';
import { practiceBundleForEpisode } from '../../core/world/development/DevelopmentPracticeExposure.test-support';
import type { PlayerWorkloadActivity } from '../../core/world/development/PlayerWorkloadRecovery';
import { applyRosterChange } from '../../core/world/roster/RosterCommands';
import { createRosterState } from '../../core/world/roster/RosterState';
import { rosterFixture } from '../../core/world/roster/RosterTestFixtures';
import { openSqliteManagerRosterDecisionStore } from './SqliteManagerRosterDecisionStore';
import { openSqlitePlayerPersonLinkStore } from './SqlitePlayerPersonLinkStore';
import { openSqlitePlayerPitchTimingStore, type AcceptedPitchTimingLearning } from './SqlitePlayerPitchTimingStore';
import { bindDevelopmentPracticeFromWorkload, openSqlitePlayerWorkloadRecoveryStore,
  type AcceptedPlayerWorkloadBaseline, type WorkloadBoundPracticeInput } from './SqlitePlayerWorkloadRecoveryStore';
import { openSqliteWorldSettlementStore } from './SqliteWorldSettlementStore';

const stores: { close(): void }[] = [];
afterEach(() => { stores.splice(0).reverse().forEach((store) => store.close()); });
let counter = 0;
const setup = () => {
  const path = `file:workload-${counter++}?mode=memory&cache=shared`;
  const world = openSqliteWorldSettlementStore(path), roster = openSqliteManagerRosterDecisionStore(path);
  stores.push(world, roster);
  world.initialize({ careerId: 'career-a', clubs: [state()], schedule: { seasonId: 'league-season-1', leagueId: 'league-a',
    memberClubIds: ['club-a', 'club-b'], regularSeasonGamesPerClub: 1,
    games: [{ gameId: 'game-1', homeClubId: 'club-a', awayClubId: 'club-b' }], revisionEventIds: [] },
    standingsPolicy: { version: 'standings-v1', tieCreditNumerator: 1, tieCreditDenominator: 2, runDifferentialCapPerGame: 10 } });
  roster.initialize({ careerId: 'career-a', clubId: 'club-a', mood: null,
    roster: createRosterState({ careerId: 'career-a', effectiveDay: 1,
      profiles: [{ profileId: 'league', version: 'v1', season: 1, competitionEditionId: 'league-season-1',
        activeLimit: null, allowedAssignmentKinds: ['FIRST_TEAM'], rehabParticipationAllowed: false }],
      units: [{ unitId: 'first-a', clubId: 'club-a', kind: 'FIRST_TEAM' }],
      players: ['p2', 'p3'].map((playerId) => ({ playerId,
        clubRights: { rightsHolderClubId: 'club-a', contractId: `contract-${playerId}` },
        assignment: { unitId: 'first-a', clubId: 'club-a' }, registrations: [],
        availability: { status: 'AVAILABLE', evidenceId: `health-${playerId}` } })) }) });
  const link = openSqlitePlayerPersonLinkStore(path, { readAcceptedPlayerIntake: (sourceId) => ['intake-p2', 'intake-p3'].includes(sourceId)
    ? { sourceId, careerId: 'career-a', playerId: sourceId.slice(7), personId: `person-${sourceId}`, sourceRecordId: `record-${sourceId}`,
      sourceVersion: 'intake-v1', acceptedRevision: 1, acceptedAtDay: 1, rosterRevision: 0 } : null });
  stores.push(link); link.accept('intake-p2'); link.accept('intake-p3');
  const baseline: AcceptedPlayerWorkloadBaseline = { sourceId: 'baseline-p2', sourceVersion: 'v1', careerId: 'career-a', playerId: 'p2',
    personLinkSourceId: 'intake-p2', createdAtDay: 1, fatigue: 0.2, recoveryCapacity: 0.5,
    policy: { policyId: 'workload', version: 'v1', availableAtDay: 0, workloadFatiguePerUnit: 0.1, travelFatiguePerKm: 0.001, recoveryPerHour: 0.1 } };
  const baselines = new Map([[baseline.sourceId, baseline]]), activities = new Map<string, PlayerWorkloadActivity>();
  const authority = { readAcceptedBaseline: (id: string) => baselines.get(id) ?? null,
    readAcceptedActivity: (id: string) => activities.get(id) ?? null };
  const workload = openSqlitePlayerWorkloadRecoveryStore(path, link, authority); stores.push(workload);
  const record = (activity: PlayerWorkloadActivity, revision: number) => { activities.set(activity.sourceEventId, activity); return workload.apply(activity.sourceEventId, revision); };
  return { path, link, baseline, baselines, activities, workload, record };
};
const activity = (sourceEventId: string, atDay: number, detail: object): PlayerWorkloadActivity => ({
  sourceEventId, sourceVersion: 'v1', evidenceId: `evidence-${sourceEventId}`, careerId: 'career-a', playerId: 'p2', atDay, ...detail,
} as PlayerWorkloadActivity);
const learning = (label: string, offset = 0): Omit<AcceptedPitchTimingLearning, 'practice'> & { practice: WorkloadBoundPracticeInput } => {
  const before = createRosterState({ ...rosterFixture(), careerId: 'career-a' });
  const change = applyRosterChange(before, { commandId: `promote-${label}`, causeEventId: `selection-${label}`, expectedRevision: 0,
    effectiveDay: 10 + offset, changes: [{ playerId: 'p2', assignment: { clubId: 'a', unitId: 'a-first' } }] });
  if (!change.ok) throw new Error(JSON.stringify(change.rejection));
  let episode = startDevelopmentLearningEpisode(label, before, change.state, change.event, 'p2', {
    careerId: 'career-a', playerId: 'p2', createdAtDay: 1, profileVersion: 'catalyst-v1',
  }, { policyId: 'learning-policy', version: 'v1', availableAtDay: 10 + offset, minimumPracticeEvents: 3, minimumFeedbackEvents: 1, minimumElapsedDays: 5 });
  const events = [{ kind: 'APPRAISAL_ENGAGED', atDay: 10 }, { kind: 'HYPOTHESIS_FORMED', atDay: 11 },
    { kind: 'PRACTICE_RECORDED', atDay: 12 }, { kind: 'PRACTICE_RECORDED', atDay: 13 }, { kind: 'PRACTICE_RECORDED', atDay: 14 },
    { kind: 'FEEDBACK_RECORDED', atDay: 14 }, { kind: 'CONSOLIDATION_RECORDED', atDay: 15 }] as const;
  for (const [index, event] of events.entries()) episode = appendDevelopmentLearningEvent(episode, episode.revision, {
    eventId: `${label}-event-${index}`, sourceEventId: `${label}-source-${index}`, atDay: event.atDay + offset, kind: event.kind,
    ...(event.kind === 'APPRAISAL_ENGAGED' ? {} : { domain: 'TECHNICAL' as const }),
  });
  const practice = practiceBundleForEpisode(episode);
  return { sourceId: `accepted-${label}`, episode, measurements: episode.practiceSourceEventIds.map((practiceSourceEventId) => ({
    practiceSourceEventId, normalMotionToReleaseUs: 600_000, quickMotionToReleaseUs: 300_000,
  })), practice: { ...practice, repetitions: practice.repetitions.map(({ fatigue: _fatigue, healthAvailability: _health, ...repetition }) => repetition) } };
};

it('actual persisted fatigue suppresses Native learning; real recovery permits fresh learning without rewriting earlier practice', () => {
  const { path, link, workload, baseline, record } = setup();
  workload.initialize(baseline.sourceId);
  record(activity('match', 2, { kind: 'MATCH', effortUnits: 8 }), 0);
  const exhausted = learning('exhausted');
  for (const repetition of exhausted.practice.repetitions) record(activity(repetition.sourceEventId, repetition.atDay,
    { kind: 'PRACTICE', effortUnits: 0, healthAvailability: 1 }), workload.readHead('career-a', 'p2')!.revision);
  const oldPractice = bindDevelopmentPracticeFromWorkload(workload, exhausted.episode, exhausted.practice);
  expect(oldPractice.repetitions.map((item) => item.fatigue)).toEqual([1, 1, 1]);
  const timing = openSqlitePlayerPitchTimingStore(path, link, {
    readAcceptedBaseline: (sourceId) => sourceId === 'timing' ? { sourceId, sourceVersion: 'v1', careerId: 'career-a', playerId: 'p2',
      personLinkSourceId: 'intake-p2', acceptedAtDay: 1, profile: { baseStartIntervalUs: 10_000_000, normalMotionToReleaseUs: 600_000,
        followThroughUs: 200_000, quickSpeedFactor: 1.5, cadenceExecutionControl: 0.8, cadenceTimingKnowledge: 0.8, quickRepeatability: 0.7,
        naturalVariationUs: 50_000, normalPhaseWeights: { gather: 2, transition: 3, stride: 5 }, quickPhaseWeights: { gather: 1, transition: 2, stride: 3 } } } : null,
    readAcceptedLearning: (sourceId) => { const raw = sourceId === exhausted.sourceId ? exhausted : fresh;
      return raw.sourceId === sourceId ? { ...raw, practice: bindDevelopmentPracticeFromWorkload(workload, raw.episode, raw.practice) } : null; },
  });
  stores.push(timing); timing.initialize('timing');
  expect(() => timing.apply(exhausted.sourceId, 0)).toThrow('insufficient development practice exposure');
  expect(timing.readHead('career-a', 'p2')?.revision).toBe(0);
  record(activity('rest', 20, { kind: 'RECOVERY', durationHours: 24, quality: 1, medicalAvailability: 1 }), 4);
  expect(workload.readHead('career-a', 'p2')?.fatigue).toBe(0);
  const fresh = learning('fresh', 20);
  for (const repetition of fresh.practice.repetitions) record(activity(repetition.sourceEventId, repetition.atDay,
    { kind: 'PRACTICE', effortUnits: 0.5, healthAvailability: 0.9 }), workload.readHead('career-a', 'p2')!.revision);
  expect(bindDevelopmentPracticeFromWorkload(workload, exhausted.episode, exhausted.practice)).toEqual(oldPractice);
  expect(timing.apply(fresh.sourceId, 0).profile.quickSpeedFactor).toBe(2);
  expect(timing.readHead('career-a', 'p2')?.revision).toBe(1);
  workload.close(); timing.close();
  const reopened = openSqlitePlayerWorkloadRecoveryStore(path, link); stores.push(reopened);
  expect(bindDevelopmentPracticeFromWorkload(reopened, exhausted.episode, exhausted.practice)).toEqual(oldPractice);
  expect(reopened.apply('rest', 4).fatigue).toBe(0);
  expect(reopened.readHead('career-a', 'p2')?.revision).toBe(8);
  const reopenedTiming = openSqlitePlayerPitchTimingStore(path, link); stores.push(reopenedTiming);
  expect(reopenedTiming.selectProfileAtDay('career-a', 'p2', 15).quickSpeedFactor).toBe(1.5);
  expect(reopenedTiming.selectProfileAtDay('career-a', 'p2', 35).quickSpeedFactor).toBe(2);
});

it('archives travel/rest chronology, returns exact original retries and rejects stale/changed/cross-scoped Sources', () => {
  const { baseline, baselines, activities, workload, record } = setup();
  const initial = workload.initialize(baseline.sourceId);
  const travel = activity('travel', 2, { kind: 'TRAVEL', distanceKm: 100 });
  const road = record(travel, 0);
  record(activity('rest', 2, { kind: 'RECOVERY', durationHours: 2, quality: 0.5, medicalAvailability: 1 }), 1);
  expect(workload.apply('travel', 0)).toEqual(road);
  expect(() => workload.apply('travel', 1)).toThrow(/revision/);
  activities.set('travel', { ...travel, distanceKm: 900 } as PlayerWorkloadActivity);
  expect(() => workload.apply('travel', 0)).toThrow(/frozen|differs/);
  expect(workload.readActivity('travel')?.before).toEqual(initial);
  expect(() => record(activity('old', 1, { kind: 'MATCH', effortUnits: 1 }), 2)).toThrow(/chronology/);
  expect(() => record(activity('stale', 3, { kind: 'MATCH', effortUnits: 1 }), 0)).toThrow(/revision/);
  expect(() => record({ ...travel, sourceEventId: 'other', playerId: 'missing' }, 0)).toThrow(/baseline/);
  baselines.set(baseline.sourceId, { ...baseline, fatigue: 0.9 });
  expect(() => workload.initialize(baseline.sourceId)).toThrow(/frozen|differs/);
  expect(workload.readHead('career-a', 'p2')?.revision).toBe(2);
});

it('requires actual Person scope and freezes policy content across Players', () => {
  const { baseline, baselines, workload } = setup();
  for (const input of [{ ...baseline, personLinkSourceId: 'missing' }, { ...baseline, personLinkSourceId: 'intake-p3' },
    { ...baseline, createdAtDay: 0 }, { ...baseline, policy: { ...baseline.policy, availableAtDay: 2 } }]) {
    baselines.set(baseline.sourceId, input);
    expect(() => workload.initialize(baseline.sourceId)).toThrow();
    expect(workload.readHead('career-a', 'p2')).toBeNull();
  }
  baselines.set(baseline.sourceId, baseline); workload.initialize(baseline.sourceId);
  baselines.set('baseline-p3', { ...baseline, sourceId: 'baseline-p3', playerId: 'p3', personLinkSourceId: 'intake-p3',
    policy: { ...baseline.policy, recoveryPerHour: 0.9 } });
  expect(() => workload.initialize('baseline-p3')).toThrow(/policy/);
  expect(workload.readHead('career-a', 'p3')).toBeNull();
  baselines.set('duplicate', { ...baseline, sourceId: 'duplicate' });
  expect(() => workload.initialize('duplicate')).toThrow();
});

it('rolls back activity and head on SQLite failure and detects corrupted history after reopen', () => {
  const { path, link, baseline, workload, record } = setup();
  const initial = workload.initialize(baseline.sourceId);
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(path); stores.push(db);
  db.exec("CREATE TRIGGER abort_workload BEFORE UPDATE ON world_player_workload_heads BEGIN SELECT RAISE(ABORT, 'forced workload failure'); END;");
  const fact = activity('match', 2, { kind: 'MATCH', effortUnits: 3 });
  expect(() => record(fact, 0)).toThrow('forced workload failure');
  expect(workload.readHead('career-a', 'p2')).toEqual(initial);
  expect(workload.readActivity(fact.sourceEventId)).toBeNull();
  db.exec('DROP TRIGGER abort_workload');
  expect(record(fact, 0).fatigue).toBeCloseTo(0.5);
  db.exec("UPDATE world_player_workload_activities SET before_json='{}' WHERE source_id='match'");
  workload.close(); const reopened = openSqlitePlayerWorkloadRecoveryStore(path, link); stores.push(reopened);
  expect(() => reopened.readHead('career-a', 'p2')).toThrow(/corrupt|diverged/);
  expect(() => reopened.readActivity('match')).toThrow(/corrupt|diverged/);
});

it('practice binding requires exact accepted practice scope/day and disallows caller fatigue', () => {
  const { workload, baseline, record } = setup(); workload.initialize(baseline.sourceId);
  const raw = learning('practice');
  expect(() => bindDevelopmentPracticeFromWorkload(workload, raw.episode, raw.practice)).toThrow(/practice/);
  for (const [index, repetition] of raw.practice.repetitions.entries()) record(activity(repetition.sourceEventId, repetition.atDay,
    index === 0 ? { kind: 'MATCH', effortUnits: 0 } : { kind: 'PRACTICE', effortUnits: 0, healthAvailability: 1 }), index);
  expect(() => bindDevelopmentPracticeFromWorkload(workload, raw.episode, raw.practice)).toThrow(/practice/);
  expect(() => bindDevelopmentPracticeFromWorkload(workload, raw.episode, { ...raw.practice,
    repetitions: raw.practice.repetitions.map((item) => ({ ...item, fatigue: 0 })) })).toThrow(/practice/);
});
