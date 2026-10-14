import { afterEach, expect, it, vi } from 'vitest';
import { practiceFixture } from './PitchPracticeAttempt.test-support';
import { openSqliteNonPitchRepetitionStore } from './SqliteNonPitchRepetitionStore';
import { nonPitchRepetitionEventId, type AcceptedNonPitchRepetitionAssessment, type NonPitchRepetitionOpportunity } from './NonPitchDevelopmentRepetition';
import { openSqliteDevelopmentPracticeExposureStore, readNativeDevelopmentPracticeExposureFromSqlite, type AcceptedDevelopmentPracticeExposure } from './SqliteDevelopmentPracticeExposureStore';
import { readOwnedPitchPracticeRepetition, type SqlitePitchPracticeAttemptStore } from './SqlitePitchPracticeAttemptStore';
import * as physical from './NonPitchRepetitionEvidenceFromSqlite';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { advancePlayerWorkloadRecovery } from '../../core/world/development/PlayerWorkloadRecovery';

const cleanup: (() => void)[] = [];
afterEach(() => { try { while (cleanup.length) cleanup.pop()!(); } finally { vi.restoreAllMocks(); } });
const fixture = async () => {
  // Genuine consumed pitch owners; only the Match physical completion seam is
  // replaced by a tiny disk fixture. This does not qualify a batted game.
  const f = await practiceFixture(cleanup), pitchIds: string[] = [];
  let previous = f.complete(); f.assess(previous);
  const first = f.owner.settle(previous.attemptId);
  if (first.kind !== 'complete') throw new Error('first pitch fixture incomplete'); pitchIds.push(first.activity.sourceEventId);
  const next = f.nextOpportunity(previous); previous = f.complete(next.sourceId); f.assess(previous);
  const second = f.owner.settle(previous.attemptId);
  if (second.kind !== 'complete') throw new Error('second pitch fixture incomplete'); pitchIds.push(second.activity.sourceEventId);
  const source: NonPitchRepetitionOpportunity = { sourceId: 'game-opportunity', sourceVersion: 'v1', opportunityId: 'original-play',
    actorSourceId: 'actor', playerId: 'p1', personLinkSourceId: 'intake-p1', episodeId: 'episode',
    episodeRevision: f.sources.episodes.read('episode')!.episode.revision, domain: 'TECHNICAL', exercise: 'BATTING_CONTACT' };
  const frame = { actor: { source: { sourceId: 'actor' } }, binding: { playerId: 'p1', personLinkSourceId: 'intake-p1' },
    person: { personId: 'person-p1', playerId: 'p1' }, careerId: 'career-a', gameId: 'actual-game', playId: 4, playerId: 'p1', gameDay: 14 };
  f.db.exec('CREATE TABLE fixture_mixed_completion(revision INTEGER,started INTEGER)');
  f.db.exec('INSERT INTO fixture_mixed_completion VALUES(0,0)');
  const before = f.sources.workload.readHead('career-a', 'p1')!;
  const activity = { sourceEventId: 'original-match-work', sourceVersion: 'v1', evidenceId: 'closed-physical', careerId: 'career-a',
    playerId: 'p1', atDay: 14, kind: 'MATCH' as const, effortUnits: 1 };
  const workload = { activity, before, after: advancePlayerWorkloadRecovery(before, before.revision, activity) };
  vi.spyOn(physical, 'readNonPitchRepetitionFrame').mockImplementation((db, accepted, fresh) => {
    expect(db.isTransaction).toBe(true);
    if (accepted.actorSourceId !== 'actor' || fresh && db.prepare('SELECT started FROM fixture_mixed_completion').get()!.started !== 0) {
      throw new Error('original prospective frame differs');
    }
    return frame as unknown as ReturnType<typeof physical.readNonPitchRepetitionFrame>;
  });
  vi.spyOn(physical, 'readNonPitchRepetitionCompletion').mockImplementation(db => {
    expect(db.isTransaction).toBe(true);
    const evidence = db.prepare('SELECT * FROM fixture_mixed_completion').get()!;
    if (evidence.started !== 1) throw new Error('completion missing');
    return { evidence, physicalProofHash: hash(evidence), closureProofHash: hash('closure'), workload } as unknown as ReturnType<typeof physical.readNonPitchRepetitionCompletion>;
  });
  let assessment: AcceptedNonPitchRepetitionAssessment | null = null;
  const game = openSqliteNonPitchRepetitionStore(f.path, f.sources.episodes, {
    readAcceptedOpportunity: id => id === source.sourceId ? source : null, readAcceptedAssessment: () => assessment });
  cleanup.push(game.close); game.prepare(source.sourceId); f.db.exec('UPDATE fixture_mixed_completion SET started=1');
  assessment = { sourceId: 'game-assessment', sourceVersion: 'v1', opportunitySourceId: source.sourceId, closureSourceId: 'closure',
    physicalProofHash: game.inspectCompletion(source.sourceId, 'closure').physicalProofHash, relevant: true,
    factors: { trainingStimulus: 1, coachingFit: 1, challengeFit: 1, healthAvailability: 0.8, motivation: 1, opportunity: 1, novelty: 1 },
    provenance: { assessmentSourceId: 'game-observation', assessmentVersion: 'v1', calibrationSourceId: 'explicit-game-calibration', calibrationVersion: 'v1' } };
  game.assess(assessment.sourceId);
  const eventId = nonPitchRepetitionEventId('career-a', 'actual-game', 4, 'p1');
  f.learningEvents.set(eventId, game.learningAuthority.readAcceptedLearningEvent(eventId)!); game.adopt(source.sourceId);
  f.learningEvents.set('feedback', { eventId: 'feedback', sourceEventId: 'feedback', atDay: 15, kind: 'FEEDBACK_RECORDED', domain: 'TECHNICAL' });
  f.learningEvents.set('consolidation', { eventId: 'consolidation', sourceEventId: 'consolidation', atDay: 16, kind: 'CONSOLIDATION_RECORDED', domain: 'TECHNICAL' });
  f.sources.episodes.advance('episode', 'feedback', 5); f.sources.episodes.advance('episode', 'consolidation', 6);
  const accepted: AcceptedDevelopmentPracticeExposure = { sourceId: 'mixed-exposure', sourceVersion: 'v1', episodeId: 'episode', episodeRevision: 7,
    policy: { policyId: 'exposure', version: 'v1', availableAtDay: 10, selfDirectedShare: 0.5, minimumEffectiveExposure: 0.1, minimumDistinctPracticeDays: 1 },
    prior: { careerId: 'career-a', playerId: 'p1', atDay: 11, domain: 'TECHNICAL', receptivity: 1, profileVersion: 'v1', policyId: 'prior', policyVersion: 'v1' },
    pitchFactors: pitchIds.map(sourceEventId => ({ sourceEventId, trainingStimulus: 1, coachingFit: 1, challengeFit: 1, motivation: 1, opportunity: 1, novelty: 1 })),
    provenance: { assessmentSourceId: 'explicit-coaching', assessmentVersion: 'v1', calibrationSourceId: 'accepted-coefficients', calibrationVersion: 'v1' } };
  const acceptedSources = new Map([[accepted.sourceId, accepted]]);
  // The old fixture intentionally exposes a reduced structural test contract.
  const pitchOwner = () => f.owner as unknown as SqlitePitchPracticeAttemptStore;
  const exposure = openSqliteDevelopmentPracticeExposureStore(f.path, { development: f.sources.episodes, pitchPractice: pitchOwner() },
    { readAcceptedExposure: id => acceptedSources.get(id) ?? null }); cleanup.push(exposure.close);
  return { f, game, exposure, accepted, acceptedSources, eventId, pitchIds, pitchOwner };
};

it('freezes one complete mixed bundle with original fatigue/health and exact retry/reopen', async () => {
  const { f, exposure, accepted, eventId, pitchIds, pitchOwner } = await fixture();
  const work = f.snapshot('world_player_workload_activities'), saved = exposure.accept(accepted.sourceId);
  expect(saved.bundle.repetitions.map(value => value.sourceEventId)).toEqual([...pitchIds, eventId]);
  expect(saved.bundle.repetitions.map(value => [value.fatigue, value.healthAvailability])).toEqual([[0.2, 0.9], [0.30000000000000004, 0.9], [0.4, 0.8]]);
  expect(saved.assessment.effectiveExposure).toBeCloseTo(1.83); expect(saved.assessment.eligible).toBe(true);
  expect(exposure.accept(accepted.sourceId)).toEqual(saved); expect(f.snapshot('world_player_workload_activities')).toBe(work);
  exposure.close(); f.recordRecovery(); f.reopen();
  const reopened = openSqliteDevelopmentPracticeExposureStore(f.path, { development: f.sources.episodes, pitchPractice: pitchOwner() }); cleanup.push(reopened.close);
  expect(reopened.read(accepted.sourceId)).toEqual(saved); expect(reopened.accept(accepted.sourceId)).toEqual(saved);
  f.db.exec('BEGIN');
  try { expect(readNativeDevelopmentPracticeExposureFromSqlite(f.db, accepted.sourceId)).toEqual(saved); }
  finally { f.db.exec('ROLLBACK'); }
});

it.each(['pitch', 'non-pitch'] as const)('rejects original %s corruption on exposure read and exact retry', async kind => {
  const { f, exposure, accepted } = await fixture(); exposure.accept(accepted.sourceId);
  if (kind === 'pitch') f.db.exec("UPDATE pitch_practice_attempts SET immutable_hash='broken' WHERE sequence=1");
  else f.db.exec('UPDATE fixture_mixed_completion SET revision=1');
  expect(() => exposure.read(accepted.sourceId)).toThrow(); expect(() => exposure.accept(accepted.sourceId)).toThrow();
});

it('rolls back exposure when its INSERT changes an original repetition', async () => {
  const { f, exposure, accepted } = await fixture();
  f.db.exec('CREATE TRIGGER corrupt_mixed AFTER INSERT ON development_practice_exposures BEGIN UPDATE fixture_mixed_completion SET revision=1; END');
  expect(() => exposure.accept(accepted.sourceId)).toThrow('physical proof');
  expect(f.count('development_practice_exposures')).toBe(0);
  expect(f.db.prepare('SELECT revision FROM fixture_mixed_completion').get()).toEqual({ revision: 0 });
});

it('rejects a moved pitch attempt alias whose original opportunity claims survive', async () => {
  const { f, exposure, accepted } = await fixture();
  f.db.exec(`CREATE TEMP TABLE moved_pitch_alias AS SELECT * FROM pitch_practice_attempts WHERE sequence=1;
    UPDATE moved_pitch_alias SET sequence=NULL,attempt_id='moved',source_id='moved',activity_id='moved',career_id='moved',
      player_id='moved',opportunity_id='moved',ordinal=99,assessment_source_id='moved',
      assessment_json=json_set(assessment_json,'$.attemptId','moved');
    INSERT INTO pitch_practice_attempts SELECT * FROM moved_pitch_alias;`);
  expect(() => exposure.accept(accepted.sourceId)).toThrow('ownership');
  expect(f.count('development_practice_exposures')).toBe(0);
});

it('requires exact coefficient coverage and registered pitch ownership on the Native snapshot', async () => {
  const { f, exposure, accepted, acceptedSources, pitchIds, pitchOwner } = await fixture();
  acceptedSources.set(accepted.sourceId, { ...accepted, pitchFactors: [] });
  expect(() => exposure.accept(accepted.sourceId)).toThrow('coefficients');
  acceptedSources.set(accepted.sourceId, { ...accepted, pitchFactors: [...accepted.pitchFactors, { ...accepted.pitchFactors[0], sourceEventId: 'unrelated' }] });
  expect(() => exposure.accept(accepted.sourceId)).toThrow('unconsumed');
  expect(f.count('development_practice_exposures')).toBe(0);
  expect(() => readOwnedPitchPracticeRepetition(pitchOwner(), f.db, pitchIds[0])).toThrow('Native');
  f.db.exec('BEGIN');
  try { expect(() => readOwnedPitchPracticeRepetition({ read: pitchOwner().read }, f.db, pitchIds[0])).toThrow('owned Native'); }
  finally { f.db.exec('ROLLBACK'); }
});
