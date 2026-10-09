import { afterEach, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createPlayerWorkloadRecovery, advancePlayerWorkloadRecovery } from '../../core/world/development/PlayerWorkloadRecovery';
import type { DevelopmentLearningEventInput } from '../../core/world/development/DevelopmentLearningEpisode';
import { openSqliteDevelopmentInitiationStore, readOwnedDevelopmentEpisode } from './SqliteDevelopmentInitiationStore';
import { openSqliteNonPitchRepetitionStore } from './SqliteNonPitchRepetitionStore';
import { nonPitchDevelopmentFixtureSources } from './NonPitchDevelopment.test-support';
import { nonPitchAssessmentInput, type AcceptedNonPitchRepetitionAssessment, type NonPitchRepetitionOpportunity } from './NonPitchDevelopmentRepetition';
import * as physical from './NonPitchRepetitionEvidenceFromSqlite';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

// Native opportunity/assessment/episode writers are real. Original physical
// readers are substituted by tiny disk fixtures; this does not qualify physics.
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const cleanup: (() => void)[] = [];
afterEach(() => { try { while (cleanup.length) cleanup.pop()!(); } finally { vi.restoreAllMocks(); } });
const fixture = () => {
  const path = join(mkdtempSync(join(tmpdir(), 'non-pitch-repetition-')), 'small.sqlite'), db = new DatabaseSync(path);
  cleanup.push(() => db.close());
  const sources = nonPitchDevelopmentFixtureSources(), careerId = sources.person.read('person-1')!.careerId;
  const before = createPlayerWorkloadRecovery({ careerId, playerId: 'p2', createdAtDay: 1, fatigue: 0.2, recoveryCapacity: 0.5,
    policy: { policyId: 'workload', version: 'v1', availableAtDay: 1, workloadFatiguePerUnit: 0.01, travelFatiguePerKm: 0.001, recoveryPerHour: 0.1 } });
  const activity = { sourceEventId: 'original-match-work', sourceVersion: 'v1', evidenceId: 'closed-physical', careerId,
    playerId: 'p2', atDay: 12, kind: 'MATCH' as const, effortUnits: 1 };
  const workload = { activity, before, after: advancePlayerWorkloadRecovery(before, 0, activity) };
  const frame = { actor: { source: { sourceId: 'actor' } }, binding: { playerId: 'p2', personLinkSourceId: 'person-link' },
    person: { personId: 'person-p2', playerId: 'p2' }, careerId, gameId: 'game-1', playId: 7, playerId: 'p2', gameDay: 12 };
  db.exec('CREATE TABLE fixture_nonpitch_inputs(frame_json TEXT,workload_json TEXT,physical_revision INTEGER,started INTEGER)');
  db.prepare('INSERT INTO fixture_nonpitch_inputs VALUES(?,?,0,0)').run(json(frame), json(workload));
  vi.spyOn(physical, 'readNonPitchRepetitionFrame').mockImplementation((connection, source, fresh) => {
    expect(connection.isTransaction).toBe(true);
    const row = connection.prepare('SELECT * FROM fixture_nonpitch_inputs').get()!;
    if (fresh && row.started !== 0) throw new Error('opportunity must precede physical pitch');
    if (source.actorSourceId !== 'actor' || source.playerId !== 'p2') throw new Error('fixture original actor differs');
    return JSON.parse(String(row.frame_json)) as ReturnType<typeof physical.readNonPitchRepetitionFrame>;
  });
  vi.spyOn(physical, 'readNonPitchRepetitionCompletion').mockImplementation((connection, _frame, exercise, closureId) => {
    expect(connection.isTransaction).toBe(true);
    const row = connection.prepare('SELECT * FROM fixture_nonpitch_inputs').get()!;
    if (row.started !== 1 || closureId !== 'closure') throw new Error('original physical completion missing');
    const evidence = { exercise, revision: row.physical_revision };
    return { physicalProofHash: hash(evidence), closureProofHash: hash(['closure', evidence]),
      workload: JSON.parse(String(row.workload_json)), evidence } as unknown as ReturnType<typeof physical.readNonPitchRepetitionCompletion>;
  });
  const opportunities = new Map<string, NonPitchRepetitionOpportunity>(), assessments = new Map<string, AcceptedNonPitchRepetitionAssessment>();
  const learning = new Map<string, DevelopmentLearningEventInput>([['hypothesis', {
    eventId: 'hypothesis', sourceEventId: 'hypothesis', atDay: 11, kind: 'HYPOTHESIS_FORMED', domain: 'TECHNICAL' }]]);
  let owner: ReturnType<typeof openSqliteNonPitchRepetitionStore>;
  const learningAuthority = { readAcceptedLearningEvent: (id: string) => learning.get(id) ?? owner.learningAuthority.readAcceptedLearningEvent(id) };
  const development = openSqliteDevelopmentInitiationStore(path, sources, learningAuthority);
  cleanup.push(development.close);
  development.apply({ episodeId: 'episode-1', executionId: 'execution-1', playerId: 'p2', personSourceId: 'person-1',
    appraisalSourceId: 'appraisal-1', policySourceId: 'policy-1' });
  development.advance('episode-1', 'hypothesis', 1);
  const authority = { readAcceptedOpportunity: (id: string) => opportunities.get(id) ?? null,
    readAcceptedAssessment: (id: string) => assessments.get(id) ?? null };
  owner = openSqliteNonPitchRepetitionStore(path, development, authority); cleanup.push(owner.close);
  const source: NonPitchRepetitionOpportunity = { sourceId: 'opportunity', sourceVersion: 'v1', opportunityId: 'drill-intention',
    actorSourceId: 'actor', playerId: 'p2', personLinkSourceId: 'person-link', episodeId: 'episode-1', episodeRevision: 2,
    domain: 'TECHNICAL', exercise: 'BATTING_CONTACT' };
  opportunities.set(source.sourceId, source);
  const prepare = () => owner.prepare(source.sourceId);
  const complete = () => db.prepare('UPDATE fixture_nonpitch_inputs SET started=1').run();
  const assess = (relevant = true) => {
    const proof = owner.inspectCompletion(source.sourceId, 'closure');
    const assessment: AcceptedNonPitchRepetitionAssessment = { sourceId: 'assessment', sourceVersion: 'v1', opportunitySourceId: source.sourceId,
      closureSourceId: 'closure', physicalProofHash: proof.physicalProofHash, relevant,
      factors: { trainingStimulus: 1, coachingFit: 1, challengeFit: 1, healthAvailability: 0.8, motivation: 1, opportunity: 1, novelty: 1 },
      provenance: { assessmentSourceId: 'coach-observation', assessmentVersion: 'v1', calibrationSourceId: 'accepted-calibration', calibrationVersion: 'v1' } };
    assessments.set(assessment.sourceId, assessment); return owner.assess(assessment.sourceId);
  };
  return { path, db, careerId, sources, workload, development, owner, source, opportunities, assessments, learning, learningAuthority, prepare, complete, assess };
};

it('connects one prospective game repetition to learning/exposure without a second workload charge', () => {
  const f = fixture(), reservation = f.prepare(); f.complete(); const assessed = f.assess();
  expect(assessed.repetition).toMatchObject({ fatigue: 0.2, healthAvailability: 0.8, atDay: 12 });
  const savedWork = f.db.prepare('SELECT workload_json FROM fixture_nonpitch_inputs').get();
  const recorded = f.owner.adopt(f.source.sourceId); expect(recorded.kind).toBe('recorded');
  expect(f.owner.adopt(f.source.sourceId)).toEqual(recorded);
  expect(f.owner.readRepetition(reservation.eventId)).toEqual(assessed.repetition);
  expect(f.db.prepare('SELECT workload_json FROM fixture_nonpitch_inputs').get()).toEqual(savedWork);
  f.learning.set('feedback', { eventId: 'feedback', sourceEventId: 'feedback', atDay: 12, kind: 'FEEDBACK_RECORDED', domain: 'TECHNICAL' });
  f.learning.set('consolidation', { eventId: 'consolidation', sourceEventId: 'consolidation', atDay: 13, kind: 'CONSOLIDATION_RECORDED', domain: 'TECHNICAL' });
  f.development.advance('episode-1', 'feedback', 3); f.development.advance('episode-1', 'consolidation', 4);
  const exposure = f.owner.assessExposure('episode-1', 5, {
    policy: { policyId: 'exposure', version: 'v1', availableAtDay: 1, selfDirectedShare: 0.5, minimumEffectiveExposure: 0.1, minimumDistinctPracticeDays: 1 },
    prior: { careerId: f.careerId, playerId: 'p2', atDay: 10, domain: 'TECHNICAL', receptivity: 1, profileVersion: 'trajectory-v1', policyId: 'receptivity-v1', policyVersion: 'v1' } });
  expect(exposure).toMatchObject({ eligible: true, distinctPracticeDays: 1, effectiveExposure: 0.6400000000000001 });
  f.owner.close(); f.development.close();
  const reopenedDevelopment = openSqliteDevelopmentInitiationStore(f.path, f.sources); cleanup.push(reopenedDevelopment.close);
  const reopened = openSqliteNonPitchRepetitionStore(f.path, reopenedDevelopment); cleanup.push(reopened.close);
  expect(reopened.prepare(f.source.sourceId)).toEqual(reservation);
  expect(reopened.assess('assessment')).toEqual(assessed);
  expect(reopened.adopt(f.source.sourceId)).toEqual(recorded);
});

it('withholds practice when the accepted assessment declares no relevant repetition', () => {
  const f = fixture(); f.prepare(); f.complete(); f.assess(false);
  expect(f.owner.adopt(f.source.sourceId)).toEqual({ kind: 'not_relevant' });
  expect(f.development.read('episode-1')?.episode.practiceSourceEventIds).toEqual([]);
});
it('requires prospective/current admission, original episode scope and one canonical game/Player reservation', () => {
  const f = fixture(); f.complete(); expect(f.prepare).toThrow('precede');
  f.db.prepare('UPDATE fixture_nonpitch_inputs SET started=0').run();
  f.opportunities.set('wrong', { ...f.source, sourceId: 'wrong', domain: 'RECOVERY' });
  expect(() => f.owner.prepare('wrong')).toThrow('episode');
  f.prepare();
  f.opportunities.set('alias', { ...f.source, sourceId: 'alias', opportunityId: 'another', exercise: 'RUNNING_MOTION' });
  expect(() => f.owner.prepare('alias')).toThrow('already reserved');
});
it.each(['assessment', 'learning'] as const)('rolls back %s INSERT when original physical evidence changes inside the writer', phase => {
  const f = fixture(); f.prepare(); f.complete();
  if (phase === 'learning') f.assess();
  const table = phase === 'assessment' ? 'non_pitch_repetition_assessments' : 'world_development_learning_events';
  f.db.exec(`CREATE TRIGGER corrupt_physical AFTER INSERT ON ${table} BEGIN UPDATE fixture_nonpitch_inputs SET physical_revision=1; END;`);
  expect(() => phase === 'assessment' ? f.assess() : f.owner.adopt(f.source.sourceId)).toThrow('physical proof');
  expect(f.db.prepare('SELECT physical_revision FROM fixture_nonpitch_inputs').get()).toEqual({ physical_revision: 0 });
  expect(f.development.read('episode-1')?.episode.revision).toBe(2);
});
it('rolls back opportunity admission when a writer trigger starts the original pitch', () => {
  const f = fixture();
  f.db.exec('CREATE TRIGGER late_opportunity AFTER INSERT ON non_pitch_repetition_opportunities BEGIN UPDATE fixture_nonpitch_inputs SET started=1; END;');
  expect(f.prepare).toThrow('precede');
  expect(f.db.prepare('SELECT count(*) AS n FROM non_pitch_repetition_opportunities').get()).toEqual({ n: 0 });
  expect(f.db.prepare('SELECT started FROM fixture_nonpitch_inputs').get()).toEqual({ started: 0 });
});
it('retains canonical ownership when indexes and event IDs are remapped but original frame claims survive', () => {
  const f = fixture(); f.prepare();
  f.db.prepare("UPDATE non_pitch_repetition_opportunities SET game_id='other',play_id=99,player_id='other',opportunity_id='other',event_id='other',snapshot_json=json_set(snapshot_json,'$.eventId','other')").run();
  f.opportunities.set('alias', { ...f.source, sourceId: 'alias', opportunityId: 'new' });
  expect(() => f.owner.prepare('alias')).toThrow('already reserved');
});
it.each(['$.source.playerId', '$.frame.binding.playerId', '$.frame.person.playerId', '$.episode.playerId'])(
  'retains canonical ownership when only original Player mirror %s survives', survivingPath => {
    const f = fixture(); f.prepare();
    f.db.prepare(`UPDATE non_pitch_repetition_opportunities SET player_id='moved',opportunity_id='moved',event_id='moved',
      source_json=json_set(source_json,'$.playerId','moved','$.opportunityId','moved'),
      snapshot_json=json_set(snapshot_json,'$.eventId','moved','$.source.opportunityId','moved',
        '$.source.playerId','moved','$.frame.playerId','moved','$.frame.binding.playerId','moved',
        '$.frame.person.playerId','moved','$.episode.playerId','moved',?,'p2')`).run(survivingPath);
    const retained = f.db.prepare('SELECT * FROM non_pitch_repetition_opportunities').all();
    f.opportunities.set('alias', { ...f.source, sourceId: 'alias', opportunityId: 'different' });
    expect(() => f.owner.prepare('alias')).toThrow('already reserved');
    expect(f.db.prepare('SELECT * FROM non_pitch_repetition_opportunities').all()).toEqual(retained);
    expect(() => f.prepare()).toThrow('original actor differs');
  });
it('authenticates original physical evidence on later generic episode reads and exact retry', () => {
  const f = fixture(); f.prepare(); f.complete(); f.assess(); f.owner.adopt(f.source.sourceId);
  f.db.prepare('UPDATE fixture_nonpitch_inputs SET physical_revision=1').run();
  expect(() => f.development.read('episode-1')).toThrow('physical proof');
  expect(() => f.owner.adopt(f.source.sourceId)).toThrow('physical proof');
});
it('pins only the earlier episode prefix and requires a real owner on an active Native connection', () => {
  const f = fixture(); f.prepare(); f.complete(); f.assess(); f.owner.adopt(f.source.sourceId);
  f.db.exec('BEGIN');
  try {
    expect(readOwnedDevelopmentEpisode(f.development, f.db, 'episode-1', 2)?.episode.stage).toBe('HYPOTHESIS');
    expect(() => readOwnedDevelopmentEpisode({ read: f.development.read }, f.db, 'episode-1', 2)).toThrow('owned Native');
    expect(() => readOwnedDevelopmentEpisode(f.development, f.db, 'episode-1', 9)).toThrow('unavailable');
  } finally { f.db.exec('ROLLBACK'); }
  expect(() => readOwnedDevelopmentEpisode(f.development, f.db, 'episode-1', 2)).toThrow('transaction');
});
it('rejects accepted factor defaults, wrong original proof and a stale learning destination', () => {
  const f = fixture(); f.prepare(); f.complete(); const a = f.assess().assessment;
  expect(() => nonPitchAssessmentInput({ ...a, factors: { ...a.factors, healthAvailability: undefined } }, a.sourceId)).toThrow(/assessment|inert/);
  f.learning.set('other-practice', { eventId: 'other-practice', sourceEventId: 'other-practice', atDay: 12, kind: 'PRACTICE_RECORDED', domain: 'TECHNICAL' });
  f.development.advance('episode-1', 'other-practice', 2);
  expect(() => f.owner.adopt(f.source.sourceId)).toThrow('stale');
  expect(f.owner.read(f.source.sourceId)?.assessment).toEqual(a);
});
