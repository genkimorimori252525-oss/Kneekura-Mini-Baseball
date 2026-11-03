import {advancePlayerWorkloadRecovery,type PlayerWorkloadActivity} from '../../core/world/development/PlayerWorkloadRecovery';
import {afterEach,expect,it,vi} from 'vitest';
import {executionViewFixture} from './SamePlateAppearanceExecutionView.test-support';
import {samePaExecutionReference as reference} from './SamePlateAppearanceExecutionFromSqlite';
import {actorHash as hash} from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import * as original from './SamePlateAppearanceContinuationFromSqlite';
import * as second from './SamePlateAppearanceTakeSuccessorFromSqlite';
import * as claims from './SamePlateAppearanceContinuationClaimGuard';
import * as observationModels from './SqlitePlayerObservationModelStore';
import * as decisionModels from './SqlitePlayerDecisionModelStore';
import * as locomotionModels from './SqlitePlayerLocomotionModelStore';
import { dispatchCalibrationValues } from './SamePlateAppearanceDispatchCalibration.test-support';
import type { AcceptedSamePaLifecycleCalibration } from './SamePlateAppearanceLifecycleCalibration';
import {openSqliteSamePlateAppearanceLifecycleStore} from './SqliteSamePlateAppearanceLifecycleStore';
import {samePaLifecycleSchema} from './SamePlateAppearanceLifecycleStorage';
import type {SamePaContinuationView,SamePaNonemptyPrefix} from './SamePlateAppearanceContinuation';
import type {SamePaDispatchMember} from './SamePlateAppearanceDispatchRoles';
import type {AcceptedSamePaLifecyclePrefix,AcceptedSamePaLifecycleTotal,AcceptedSamePaLifecycleView,SamePaLifecyclePrefix} from './SamePlateAppearanceLifecycle';
import type {SamePaTakePitchBundle} from './SamePlateAppearanceTakeSuccessor';
const cleanup:(()=>void)[]=[];
afterEach(()=>{cleanup.splice(0).reverse().forEach(fn=>fn());vi.restoreAllMocks();});
/** Real new Native tables/transactions and workload states. Earlier completed
 * anchor/second-pitch owner proofs and metadata discovery are explicitly mocked.
 * No physical execution or genuine reservation qualification is asserted. */
const fixture=()=>{
  const f=executionViewFixture();cleanup.push(()=>f.close());
  // The ancestor is the mocked boundary for this structural test, so do not
  // reconstruct ten separately accepted old TOTALs merely to create its shape.
  const lineage={enrollmentReference:reference('same_pa_enrollments',f.enrollment),actorReference:f.source.actorReference,careerId:f.enrollment.careerId,gameId:f.enrollment.gameId,playId:f.enrollment.playId,firstPhysicalPitchSourceId:f.source.firstPhysicalPitchSourceId,
    participantReferences:f.enrollment.participants.map(p=>({playerId:p.binding.playerId,bindingHash:hash(p.binding),personHash:p.personHash,baselineSourceId:p.baselineSourceId,revision:p.state.revision,stateHash:hash(p.state)}))};
  const empty={lineage,participants:f.enrollment.participants.map(p=>{const activity:PlayerWorkloadActivity={sourceEventId:'explicit-fixture-event-'+p.binding.playerId,sourceVersion:'fixture-v1',evidenceId:'explicit-mocked-anchor',careerId:p.state.careerId,playerId:p.state.playerId,atDay:2,kind:'MATCH',effortUnits:0};const projectedState=advancePlayerWorkloadRecovery(p.state,p.state.revision,activity);
    return{playerId:p.binding.playerId,reservedState:p.state,activity,projectedState,projectedStateHash:hash(projectedState),totalReference:{owner:'reserved_pa_total_assessments' as const,sourceId:'mock-total-'+p.binding.playerId,sourceHash:hash('mock-total'),snapshotHash:hash('mock-total-result')}};})};
  const old:SamePaContinuationView={kind:'nonempty_basis_prepared',source:{sourceId:'mock-anchor-view',sourceVersion:'explicit-boundary-fixture-v1',capability:'same_pa_nonempty_cumulative_view_v1',enrollmentReference:empty.lineage.enrollmentReference,
    prefixReference:{owner:'pa_continuation_v1_work_prefixes',sourceId:'mock-anchor-prefix',sourceHash:hash('prefix'),snapshotHash:hash('prefix-value')},participantTotalReferences:[]},lineage:empty.lineage,coverageHash:hash('prior-covered-TAKE'),assessmentSetHash:hash('fixture-assessments'),evaluationTick:200,
    physicalCut:{kind:'completed_take_plate_crossing_v1',pitchReference:{owner:'pa_dispatch_v1_pitch_actions',sourceId:'mock-first',sourceHash:hash('first'),snapshotHash:hash('first-value')},originTick:100,ticksPerSecond:1_000_000,crossing:{tick:200,elapsedSeconds:0.0001,position:{x:0,y:1,z:0},velocity:{x:0,y:0,z:-30},spin:{x:0,y:0,z:0}},trajectoryHash:hash('trajectory'),timelineHash:hash('timeline')},
    participants:empty.participants.map(p=>({...p,totalReference:{...p.totalReference,owner:'pa_continuation_v1_total_assessments'}}))};
  const members:SamePaDispatchMember[]=empty.lineage.participantReferences.map(p=>({playerId:p.playerId,bindingHash:p.bindingHash,personHash:p.personHash,baselineSourceId:p.baselineSourceId,reservedRevision:p.revision,reservedStateHash:p.stateHash,projectedStateHash:empty.participants.find(x=>x.playerId===p.playerId)!.projectedStateHash}));
  const anchorRef=reference('pa_continuation_v1_execution_views',old),timeline={playId:f.actor.match.playId,startedAtTick:100,lastEventTick:300,nextSequence:2,status:{kind:'active' as const,count:{balls:0,strikes:2}},events:[]};
  const pitch={source:{sourceId:'mock-second',sourceVersion:'explicit-boundary-fixture-v1'},lineage:empty.lineage,result:{resolution:{timeline},delivery:{timeline:{followThroughEndUs:350}}}};
  const bundle={action:{source:{viewReference:anchorRef}},pitch} as unknown as SamePaTakePitchBundle;
  vi.spyOn(original,'readHistoricalSamePaContinuationViewFromSqlite').mockImplementation((_db,ref)=>{expect(ref).toEqual(anchorRef);return{actor:f.actor,view:old,members};});
  vi.spyOn(original,'readSamePaContinuationRecordFromSqlite').mockImplementation((_db,kind,id)=>{expect([kind,id]).toEqual(['prefix','mock-anchor-prefix']);return{kind:'nonempty_prefix',source:{operationReferences:[]}} as unknown as SamePaNonemptyPrefix;});
  vi.spyOn(second,'readSamePaSuccessorTakePitchFromSqlite').mockReturnValue(bundle);
  vi.spyOn(claims,'readSamePaContinuationClaimRows').mockImplementation(db=>Object.keys(samePaLifecycleSchema).filter(table=>db.prepare('SELECT 1 FROM sqlite_master WHERE name=?').get(table)).flatMap(table=>db.prepare('SELECT * FROM main.'+table).all().map(row=>({table,row}))));
  const sources=new Map<string,unknown>(),owner=openSqliteSamePlateAppearanceLifecycleStore(f.path,{readAcceptedPrefix:id=>sources.get(id)??null,readAcceptedTotal:id=>sources.get(id)??null,readAcceptedView:id=>sources.get(id)??null,readAcceptedCalibration:id=>sources.get(id)??null});cleanup.push(()=>owner.close());
  const prefixSource:AcceptedSamePaLifecyclePrefix={sourceId:'lifecycle-prefix',sourceVersion:'explicit-boundary-fixture-v1',capability:'same_pa_lifecycle_prefix_v1',enrollmentReference:empty.lineage.enrollmentReference,anchorViewReference:anchorRef,eventReferences:[reference('pa_take_successor_v1_pitch_actions',pitch)]};sources.set(prefixSource.sourceId,prefixSource);
  const prefix=()=>{const value=owner.acceptPrefix(prefixSource.sourceId);if(value.kind!=='same_pa_lifecycle_prefix')throw new Error('prefix pending');return value;};
  const totals=(prefix:SamePaLifecyclePrefix)=>empty.lineage.participantReferences.map((participantReference,i):AcceptedSamePaLifecycleTotal=>({sourceId:'lifecycle-total-'+i,sourceVersion:'explicit-zero-fixture-v1',capability:'same_pa_lifecycle_cumulative_total_v1',enrollmentReference:empty.lineage.enrollmentReference,prefixReference:reference('pa_lifecycle_v1_work_prefixes',prefix),participantReference,effortUnits:0,
    provenance:{assessmentSourceId:'explicit-lifecycle-fixture-assessment-'+i,assessmentVersion:'v1',calibrationSourceId:'explicit-zero-fixture',calibrationVersion:'v1'}}));
  const prepare=()=>{const pref=prefix(),ts=totals(pref);ts.forEach(s=>sources.set(s.sourceId,s));const set=owner.acceptTotalSet(ts.map(s=>s.sourceId));if(set.kind!=='same_pa_lifecycle_total_set')throw new Error('totals pending');
    const view:AcceptedSamePaLifecycleView={sourceId:'lifecycle-view',sourceVersion:'explicit-boundary-fixture-v1',capability:'same_pa_lifecycle_cumulative_view_v1',enrollmentReference:empty.lineage.enrollmentReference,prefixReference:reference('pa_lifecycle_v1_work_prefixes',pref),participantTotalReferences:set.participantTotalReferences};sources.set(view.sourceId,view);return{prefix:pref,totals:ts,view};};
  return{f,owner,sources,prefixSource,prefix,totals,prepare,empty};
};

type Route = 'defender_observation' | 'defender_decision' | 'defender_locomotion';
const prepared = () => {
  const f = fixture(), p = f.prepare(), view = f.owner.acceptView(p.view.sourceId);
  if (view.kind !== 'same_pa_lifecycle_view') throw new Error('structural view pending');
  const values = dispatchCalibrationValues(), models = new Map<string, unknown>();
  const modelOwner = { read: (id: string) => models.get(id), selectAtDay: (_career: string, player: string) =>
    [...models.values()].find(value => (value as { source: { playerId: string } }).source.playerId === player) };
  // Only nominal model adapters and prior ancestors are mocked. The new owner,
  // lifecycle Source/parser/assessment claims/row schema/transactions are real.
  vi.spyOn(observationModels, 'playerObservationModelEvidenceFromSqlite').mockReturnValue(modelOwner as never);
  vi.spyOn(decisionModels, 'playerDecisionModelEvidenceFromSqlite').mockReturnValue(modelOwner as never);
  vi.spyOn(locomotionModels, 'playerLocomotionModelEvidenceFromSqlite').mockReturnValue(modelOwner as never);
  const make = (id: string, route: Route = 'defender_observation', playerIndex = 0): AcceptedSamePaLifecycleCalibration => {
    const binding = f.f.actor.defenderBindings[playerIndex], person = f.f.actor.defenderPersons.find(person => person.playerId === binding.playerId)!;
    const model = { source: { sourceId: 'model:' + route + ':' + binding.playerId, sourceVersion: 'explicit-mocked-model-v1',
      careerId: binding.careerId, playerId: binding.playerId, personLinkSourceId: binding.personLinkSourceId, acceptedAtDay: 0 }, fieldingModel: { person } };
    models.set(model.source.sourceId, model);
    const owner = route === 'defender_observation' ? 'world_player_observation_models' : route === 'defender_decision' ? 'world_player_decision_models' : 'world_player_locomotion_models';
    const old = f.empty.lineage.participantReferences.find(member => member.playerId === binding.playerId)!;
    return { sourceId: id, sourceVersion: 'explicit-single-route-owner-test-v1', capability: 'same_pa_lifecycle_execution_calibration_v1',
      enrollmentReference: view.lineage.enrollmentReference, viewReference: reference('pa_lifecycle_v1_execution_views', view), firstPhysicalPitchSourceId: view.lineage.firstPhysicalPitchSourceId,
      member: { playerId: binding.playerId, bindingHash: old.bindingHash, personHash: old.personHash, baselineSourceId: old.baselineSourceId,
        reservedRevision: old.revision, reservedStateHash: old.stateHash, projectedStateHash: view.participants.find(member => member.playerId === binding.playerId)!.projectedStateHash },
      route, nominalReference: reference(owner, model), nominalParameterReference: null, acceptedAtDay: 0,
      provenance: { assessmentSourceId: id + ':assessment', assessmentVersion: 'explicit-test-v1', calibrationSourceId: id + ':declared-values', calibrationVersion: 'explicit-test-v1' },
      response: { kind: 'accepted_execution_values_v1', values: values[route] } } as AcceptedSamePaLifecycleCalibration;
  };
  const publish = <T extends { sourceId: string }>(source: T): T => { f.sources.set(source.sourceId, source); return source; };
  const count = () => f.f.db.prepare('SELECT count(*) AS n FROM pa_lifecycle_v1_execution_calibrations').get()!.n;
  return { ...f, p, view, make, publish, count };
};

it('DEC01 admits each explicit defender route singly and reopens idempotently without new effects', () => {
  for (const route of ['defender_observation', 'defender_decision', 'defender_locomotion'] as const) {
    const f = prepared(), source = f.publish(f.make('one:' + route, route));
    const value = f.owner.acceptDefenderExecutionCalibrationV1(source.sourceId);
    expect(value.kind).toBe('same_pa_lifecycle_calibration'); expect(f.count()).toBe(1);
    const changes = f.f.db.prepare('SELECT total_changes() n').get()!.n;
    expect(f.owner.acceptDefenderExecutionCalibrationV1(source.sourceId)).toEqual(value);
    expect(f.f.db.prepare('SELECT total_changes() n').get()!.n).toBe(changes);
    f.owner.close(); const cold = openSqliteSamePlateAppearanceLifecycleStore(f.f.path); cleanup.push(() => cold.close());
    expect(cold.acceptDefenderExecutionCalibrationV1(source.sourceId)).toEqual(value);
  }
});

it('DEC02 preserves pending, old throw-only and exact32 entry contracts', () => {
  const f = prepared(); expect(f.owner.acceptDefenderExecutionCalibrationV1('not-published')).toEqual({ kind: 'pending', missingAcceptedSourceIds: ['not-published'] });
  const source = f.publish(f.make('observation'));
  expect(() => f.owner.acceptThrowCalibration(source.sourceId)).toThrow(/requires defender_throw/);
  expect(() => f.owner.acceptCalibrationSet([source.sourceId])).toThrow(/exact participant set/);
  const wrong = f.publish({ ...source, sourceId: 'throw', route: 'defender_throw', nominalReference: { ...source.nominalReference, owner: 'world_player_fielding_models' },
    response: { kind: 'accepted_execution_values_v1', values: { transferParameters: { minimumTransferDelayTicks: 1, maximumTransferDelayTicks: 2, fixedGripOffsetTicks: 0 },
      throwCalibration: { minimumReleaseSpeedMps: 1, maximumReleaseSpeedMps: 2, minimumTargetErrorMeters: 0, maximumTargetErrorMeters: 1 } } } } as AcceptedSamePaLifecycleCalibration);
  expect(() => f.owner.acceptDefenderExecutionCalibrationV1(wrong.sourceId)).toThrow(/requires observation, decision or locomotion/);
  expect(f.count()).toBe(0);
});

it('DEC03 rejects a same-view/member/route alias without changing the accepted row', () => {
  const f = prepared(), first = f.publish(f.make('canonical')); f.owner.acceptDefenderExecutionCalibrationV1(first.sourceId);
  const alias = f.publish({ ...first, sourceId: 'alias', provenance: { ...first.provenance, assessmentSourceId: 'alias:assessment' } });
  expect(() => f.owner.acceptDefenderExecutionCalibrationV1(alias.sourceId)).toThrow(/canonical Source alias/); expect(f.count()).toBe(1);
});

it('DEC04 rejects committed assessment reuse across distinct single routes/members and across TOTAL owners', () => {
  const f = prepared(), first = f.publish(f.make('first')); f.owner.acceptDefenderExecutionCalibrationV1(first.sourceId);
  for (const [index, assessment] of [first.provenance.assessmentSourceId, first.sourceId, f.p.totals[0].provenance.assessmentSourceId].entries()) {
    const next = f.make('collision:' + index, 'defender_decision', 1);
    f.publish({ ...next, provenance: { ...next.provenance, assessmentSourceId: assessment } });
    expect(() => f.owner.acceptDefenderExecutionCalibrationV1(next.sourceId)).toThrow(/assessment identity already claimed/);
  }
  expect(f.count()).toBe(1);
});

it('DEC05 rejects forged current member/view/nominal scope and changed accepted provenance before effects', () => {
  const f = prepared(), original = f.make('forged');
  const bad = [{ ...original, viewReference: { ...original.viewReference, snapshotHash: hash('forged-view') } },
    { ...original, member: { ...original.member, projectedStateHash: hash('wrong-current') } },
    { ...original, nominalReference: { ...original.nominalReference, snapshotHash: hash('wrong-model') } },
    { ...original, acceptedAtDay: f.f.actor.binding.gameDay + 1 },
    { ...original, provenance: { ...original.provenance, assessmentVersion: '' } }];
  for (const source of bad) { f.publish(source); expect(() => f.owner.acceptDefenderExecutionCalibrationV1(source.sourceId)).toThrow(); expect(f.count()).toBe(0); }
  f.publish(original); f.owner.acceptDefenderExecutionCalibrationV1(original.sourceId);
  f.publish({ ...original, provenance: { ...original.provenance, assessmentVersion: 'changed' } });
  expect(() => f.owner.acceptDefenderExecutionCalibrationV1(original.sourceId)).toThrow(/exact write or original Source differs/); expect(f.count()).toBe(1);
});

it('DEC06 leaves legacy32 partial-set repair rejected after a new single admission', () => {
  const f = prepared(), first = f.publish(f.make('partial:0')); f.owner.acceptDefenderExecutionCalibrationV1(first.sourceId);
  const ids = [first.sourceId];
  for (let i = 1; i < 32; i++) { const source = f.make('partial:' + i); f.publish(source); ids.push(source.sourceId); }
  expect(() => f.owner.acceptCalibrationSet(ids)).toThrow(/partial accepted set cannot be repaired/); expect(f.count()).toBe(1);
});

it('DEC07 rejects a formerly valid current view after additional typed-discovered work', () => {
  const f = prepared(), source = f.publish(f.make('stale-current'));
  vi.mocked(claims.readSamePaContinuationClaimRows).mockReturnValue([{ table: 'pa_physical_v1_cuts', row: {
    source_id: 'later-owned-work', source_hash: hash('later-source'), snapshot_hash: hash('later-result') } }]);
  expect(() => f.owner.acceptDefenderExecutionCalibrationV1(source.sourceId)).toThrow(/coverage/);
  expect(f.count()).toBe(0);
});
