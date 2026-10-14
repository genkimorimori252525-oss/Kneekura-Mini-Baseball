import { expect, it } from 'vitest';
import { request } from '../../core/world/psychology/execution/ExecutionFixtures.test-support';
import { createHumanControlState } from '../../core/world/control/HumanControl';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { battingEmotionExecutionInput, battingEmotionFrame, deriveBattingEmotionExecution } from './NativeBattingEmotionExecution';
import type { AcceptedBattingEmotionExecution } from './NativeBattingEmotionExecution';
const ref = (owner: string, sourceId: string) => ({ owner, sourceId, sourceHash: hash(['source', sourceId]), snapshotHash: hash(['record', sourceId]) });
/** Pure Source/Core binding tests. The metadata shapes below confer no Native
 * actor, received-event, view or World authority; real owner integration is a
 * separate case in the consolidated batch. All numeric inputs are Core fixture declarations. */
const fixture = () => {
  const r = structuredClone(request()), actor = { source: { sourceId: 'actor', gameId: 'match' }, binding: { careerId: 'career', playerId: 'player', clubId: 'club', competitionEditionId: 'league' },
    match: { playId: 1 }, worldFixture: { game: { homeClubId: 'opponent', awayClubId: 'club' } } } as Parameters<typeof battingEmotionFrame>[1];
  const control = createHumanControlState({ revision: 0, controllerId: 'fixture-controller', controlledClubId: null, domainIds: ['BATTING'], manualDomainIds: [] });
  const worldBefore = { head: { careerId: 'career', worldRevision: 10, control }, controlJson: JSON.stringify(control) };
  const { frame: _frame, ...baseline } = r.baseline;
  const source = { sourceId: 'fixture-emotion', sourceVersion: 'fixture-only-v1', capability: 'owned_batting_emotion_execution_v1', executionId: 'execution-1',
    viewReference: ref('pa_continuation_v1_execution_views', 'view'), observationReference: ref('batting_observation_v1_observations', 'observation'),
    deliveryReference: ref('batting_observation_v1_deliveries', 'delivery'), genesisReference: ref('batting_emotion_v1_geneses', 'genesis'), previousExecutionReference: null,
    member: { playerId: 'player', bindingHash: hash('binding'), personHash: hash('person'), baselineSourceId: 'baseline', reservedRevision: 0, reservedStateHash: hash('reserved'), projectedStateHash: hash('projected') },
    expectedWorld: { careerId: 'career', worldRevision: 10, controlRevision: 0, controlHash: hash(control) }, appraisalAssessment: r.appraisal, baseline, executionModel: r.model,
    provenance: { assessmentSourceId: 'fixture-appraisal-assessment', assessmentVersion: 'fixture-v1', calibrationSourceId: 'existing-core-fixture', calibrationVersion: 'fixture-v1' } } as AcceptedBattingEmotionExecution;
  const time = { tick: 100, sequence: 1 }, frame = battingEmotionFrame(source, actor, worldBefore, time);
  const a = source.appraisalAssessment as any;
  a.importance.time = time; a.importance.contextId = frame.contextId; a.event.contextId = frame.contextId;
  a.event.eventId = 'delivery'; a.event.stamp = { sourceId: 'delivery', revision: 1, time }; a.evidenceEventIds = ['delivery'];
  const basis = { actor, worldBefore, beforeEmotion: r.beforeEmotion, time,
    lineage: { careerId: 'career', gameId: 'match' }, physicalPitchReference: ref('pa_dispatch_v1_pitch_actions', 'pitch'),
    observation: { source: { sourceId: 'observation', deliveryCutTick: 100 }, eventSequence: 1, calculation: { status: 'AWAITING_DELIVERY' } },
    delivery: { source: { sourceId: 'delivery', observationReference: source.observationReference }, eventSequence: 1, delivery: { kind: 'batting_observation_delivered', evaluatedAtTick: 100 } } } as Parameters<typeof deriveBattingEmotionExecution>[1];
  (basis.delivery as any).originalCaptureHash = hash(basis.observation);
  return { source, basis };
};
it('BE01 accepted appraisal parameters bind the exact factual scope and produce Core acceptance without a scoring formula', () => {
  const { source, basis } = fixture(), before = hash(source), parsed = battingEmotionExecutionInput(source, source.sourceId), result = deriveBattingEmotionExecution(parsed, basis);
  expect(result.acceptance.afterWorldRevision).toBe(11); expect(result.acceptance.beforeEmotionRevision).toBe(0); expect(result.acceptance.afterEmotionRevision).toBe(1);
  expect(result.acceptance.proposal.request.runner).toBeNull(); expect(result.worldBefore).toEqual(basis.worldBefore); expect(hash(source)).toBe(before);
});
it('BE02 foreign competition, undelivered event and changed actual World fail before acceptance', () => {
  for (const edit of [(f: ReturnType<typeof fixture>) => { (f.source.appraisalAssessment as any).importance.competition.competitionId = 'other'; },
    (f: ReturnType<typeof fixture>) => { (f.basis.delivery.delivery as any).evaluatedAtTick = 101; },
    (f: ReturnType<typeof fixture>) => { (f.source.expectedWorld as any).worldRevision = 9; },
    (f: ReturnType<typeof fixture>) => { (f.source.appraisalAssessment.event as any).eventId = 'unowned-event'; }]) {
    const f = fixture(); edit(f); expect(() => deriveBattingEmotionExecution(battingEmotionExecutionInput(f.source), f.basis)).toThrow();
  }
});
it('BE03 supplied acceptance or emotion state, missing baseline and invalid appraisal values cannot become defaults', () => {
  for (const edit of [(s: any) => { s.acceptance = {}; }, (s: any) => { s.beforeEmotion = {}; }, (s: any) => { delete s.baseline; },
    (s: any) => { s.appraisalAssessment.event.perceivedOutcome = NaN; }]) {
    const s = fixture().source; edit(s); expect(() => battingEmotionExecutionInput(s)).toThrow();
  }
});
