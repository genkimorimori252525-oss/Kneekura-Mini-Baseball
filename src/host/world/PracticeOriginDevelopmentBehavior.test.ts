import { afterEach, expect, it } from 'vitest';
import type { AcceptedPracticeDiscoveryFixture } from './PracticeOriginDevelopment.test-support';
import { practiceOriginBehaviorFixture } from './PracticeOriginDevelopmentBehavior.test-support';

const cleanup: (() => void)[] = [];
afterEach(() => { while (cleanup.length) cleanup.pop()!(); });

it.each(['ENGAGED', 'ABANDONED'] as const)('adopts an explicitly accepted practice discovery as %s without roster or ability changes', outcome => {
  const f = practiceOriginBehaviorFixture(cleanup, outcome);
  const before = ['world_person_priors', 'world_pitch_timing_baselines', 'world_pitch_timing_updates', 'world_player_release_baselines',
    'world_player_release_changes', 'pitch_practice_attempts', 'world_player_workload_activities'].map(table => [table, f.base.snapshot(table)] as const);
  const result = f.episodes.applyPractice(f.packet.request);
  expect(result.episode.stage).toBe(outcome);
  expect(result.episode.revision).toBe(1);
  expect(result.episode.domain).toBeNull();
  expect(result.episode.catalyst).toEqual({ family: 'TECHNICAL_DISCOVERY', careerId: 'career-a', playerId: 'p1',
    occurredAtDay: f.packet.appraisal.discovery.occurredAtDay, sourceEventId: f.packet.appraisal.discovery.sourceEventId,
    causeEventId: f.origin.result.activity.sourceEventId, motifId: f.packet.appraisal.discovery.motifId });
  expect(result.episode.events.map(e => e.kind)).toEqual(['CATALYST', outcome === 'ENGAGED' ? 'APPRAISAL_ENGAGED' : 'APPRAISAL_DISMISSED']);
  expect(result.episode.practiceSourceEventIds).toEqual([]);
  expect(result.episode.feedbackSourceEventIds).toEqual([]);
  expect(result.assessment).toMatchObject({ episodeId: f.packet.request.episodeId, catalystSourceEventId: f.packet.appraisal.discovery.sourceEventId,
    appraisalSourceEventId: f.packet.appraisal.appraisal.sourceEventId, drawCount: 1, probability: outcome === 'ENGAGED' ? 1 : 0,
    initiated: outcome === 'ENGAGED', reason: 'ELIGIBLE' });
  expect(result.assessment.draw).toBeGreaterThanOrEqual(0);
  expect(result.assessment.draw).toBeLessThan(1);
  expect(f.base.count('world_roster_executions')).toBe(0);
  expect(f.base.count('world_development_initiations')).toBe(1);
  expect(f.base.count('world_development_learning_events')).toBe(0);
  for (const [table, bytes] of before) expect(f.base.snapshot(table), table).toBe(bytes);
});

it.each(['ENGAGED', 'ABANDONED'] as const)('reopens and retries the same %s assessment without live acceptance callbacks or a new draw', outcome => {
  const f = practiceOriginBehaviorFixture(cleanup, outcome), first = f.episodes.applyPractice(f.packet.request);
  const bytes = f.developmentSnapshot();
  expect(f.episodes.applyPractice(f.packet.request)).toEqual(first);
  f.appraisals.clear(); f.policies.clear(); f.reopen();
  expect(f.episodes.read(f.packet.request.episodeId)).toEqual(first);
  expect(f.episodes.applyPractice(f.packet.request)).toEqual(first);
  expect(f.developmentSnapshot()).toBe(bytes);
  expect(f.base.count('world_player_workload_activities')).toBe(1);
});

for (const outcome of ['ENGAGED', 'ABANDONED'] as const) {
  it.each(['episode', 'appraisal-alias', 'record-version'] as const)(`consumes the canonical ${outcome} discovery before a %s reroll`, alias => {
    const f = practiceOriginBehaviorFixture(cleanup, outcome), first = f.episodes.applyPractice(f.packet.request);
    const bytes = f.developmentSnapshot();
    const changed: AcceptedPracticeDiscoveryFixture = { ...f.packet.appraisal, episodeId: 'fixture-reroll-episode',
      sourceId: alias === 'episode' ? f.packet.appraisal.sourceId : 'fixture-appraisal-alias',
      sourceVersion: alias === 'record-version' ? 'fixture-v2' : f.packet.appraisal.sourceVersion };
    f.appraisals.set(changed.sourceId, changed);
    expect(() => f.episodes.applyPractice({ ...f.packet.request, episodeId: changed.episodeId, appraisalSourceId: changed.sourceId }))
      .toThrow(/canonical|discovery|consum|already|alias|identity|source.*differ|frozen/i);
    expect(f.developmentSnapshot()).toBe(bytes);
    f.appraisals.set(f.packet.appraisal.sourceId, f.packet.appraisal);
    expect(f.episodes.read(f.packet.request.episodeId)).toEqual(first);
    expect(f.base.count('world_development_initiations')).toBe(1);
  });
}

it('rejects changed accepted content under its original source and version rather than returning a cached episode', () => {
  const f = practiceOriginBehaviorFixture(cleanup);
  f.episodes.applyPractice(f.packet.request);
  const bytes = f.developmentSnapshot();
  f.appraisals.set(f.packet.appraisal.sourceId, { ...f.packet.appraisal,
    appraisal: { ...f.packet.appraisal.appraisal, novelty: 0 } });
  expect(() => f.episodes.applyPractice(f.packet.request)).toThrow(/changed|different|differ|frozen|appraisal/i);
  expect(f.developmentSnapshot()).toBe(bytes);
});

it.each(['appraisal', 'policies'] as const)('requires explicit accepted %s and writes no default initiation', missing => {
  const f = practiceOriginBehaviorFixture(cleanup);
  if (missing === 'appraisal') f.appraisals.clear(); else f.policies.clear();
  const bytes = f.developmentSnapshot(), workload = f.base.snapshot('world_player_workload_activities');
  expect(() => f.episodes.applyPractice(f.packet.request)).toThrow(/accepted|appraisal|polic|missing/i);
  expect(f.developmentSnapshot()).toBe(bytes);
  expect(f.base.snapshot('world_player_workload_activities')).toBe(workload);
});

it.each(['same', 'different'] as const)('admits distinct discoveries from one completion with %s motifs after a dismissal', motif => {
  const f = practiceOriginBehaviorFixture(cleanup, 'ABANDONED');
  expect(f.episodes.applyPractice(f.packet.request).episode.stage).toBe('ABANDONED');
  const next: AcceptedPracticeDiscoveryFixture = { ...f.packet.appraisal, sourceId: 'fixture-next-appraisal', episodeId: 'fixture-next-episode',
    appraisal: { ...f.packet.appraisal.appraisal, sourceEventId: 'fixture-next-appraisal-response' },
    discovery: { ...f.packet.appraisal.discovery, sourceEventId: 'fixture-distinct-discovery',
      motifId: motif === 'same' ? f.packet.appraisal.discovery.motifId : 'fixture-distinct-motif' } };
  const policies = { ...f.initialPolicies, sourceId: 'fixture-next-policies',
    initiation: { ...f.initialPolicies.initiation, policyId: 'fixture-next-initiation', baseChance: 1 } };
  f.appraisals.set(next.sourceId, next); f.policies.set(policies.sourceId, policies);
  const admitted = f.episodes.applyPractice({ ...f.packet.request, episodeId: next.episodeId, appraisalSourceId: next.sourceId, policySourceId: policies.sourceId });
  expect(admitted.assessment.reason).toBe('ELIGIBLE');
  expect(admitted.assessment.probability).toBeCloseTo(motif === 'same' ? 1 / (1 + f.initialPolicies.initiation.sameMotifSaturation) : 1, 15);
  expect(admitted.assessment.drawCount).toBe(1);
  expect(f.base.count('world_development_initiations')).toBe(2);
  expect(f.base.count('world_player_workload_activities')).toBe(1);
});

it.each(['completion-hash', 'discovery-before-practice', 'appraisal-before-discovery', 'foreign-player'] as const)
  ('rejects %s scope before committing an origin', invalid => {
    const f = practiceOriginBehaviorFixture(cleanup), a = f.packet.appraisal;
    const changed: AcceptedPracticeDiscoveryFixture = { ...a,
      ...(invalid === 'foreign-player' ? { playerId: 'foreign-player' } : {}),
      appraisal: { ...a.appraisal, ...(invalid === 'appraisal-before-discovery' ? { atDay: 12 } : {}) },
      discovery: { ...a.discovery, ...(invalid === 'discovery-before-practice' ? { occurredAtDay: 12 } : {}),
        completionReference: { ...a.discovery.completionReference, ...(invalid === 'completion-hash' ? { hash: '0'.repeat(64) } : {}) } } };
    f.appraisals.set(changed.sourceId, changed);
    const bytes = f.developmentSnapshot();
    expect(() => f.episodes.applyPractice(f.packet.request)).toThrow(/scope|chronolog|day|completion|hash|player|discovery|evidence/i);
    expect(f.developmentSnapshot()).toBe(bytes);
    expect(f.base.count('world_player_workload_activities')).toBe(1);
  });

it('rolls back writer-local original-practice corruption with the origin reservation and permits the corrected retry', () => {
  const f = practiceOriginBehaviorFixture(cleanup), development = f.developmentSnapshot();
  const physical = f.base.snapshot('pitch_practice_attempts'), workload = f.base.snapshot('world_player_workload_activities');
  f.base.db.exec("CREATE TRIGGER corrupt_practice_origin BEFORE INSERT ON world_development_initiations BEGIN UPDATE pitch_practice_attempts SET frame_json=json_set(frame_json,'$.workload.fatigue',0.01); END;");
  expect(() => f.episodes.applyPractice(f.packet.request)).toThrow(/frame|source|evidence|corrupt|differ/i);
  expect(f.developmentSnapshot()).toBe(development);
  expect(f.base.snapshot('pitch_practice_attempts')).toBe(physical);
  expect(f.base.snapshot('world_player_workload_activities')).toBe(workload);
  f.base.db.exec('DROP TRIGGER corrupt_practice_origin');
  expect(f.episodes.applyPractice(f.packet.request).episode.stage).toBe('ENGAGED');
  expect(f.base.count('world_development_initiations')).toBe(1);
});
