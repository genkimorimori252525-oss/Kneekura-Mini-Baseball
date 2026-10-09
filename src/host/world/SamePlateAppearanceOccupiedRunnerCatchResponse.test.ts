import { expect, it, vi } from 'vitest';
import { samePaBatterRunFixture } from './SamePlateAppearanceBatterRunFixtures.test-support';
import { deriveSamePaOccupiedRunnerCatchResponse, deriveSamePaOccupiedRunnerCatchMotion, assertSamePaOccupiedRunnerCatchOwnership } from './SamePlateAppearanceOccupiedRunnerCatchResponse';
import { deriveSamePaOccupiedRunnerCatchCensus } from './SamePlateAppearanceOccupiedRunnerCatchCensus';
import { deriveSamePaCatchOperativeRuling } from './SamePlateAppearanceCatchOperativeRuling';
import { resolveExactCommunicationReception } from '../../core/sim/perception/ExactCommunication';
import { DeterministicRng } from '../../core/rng/DeterministicRng';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
const mocks = vi.hoisted(() => ({ work: null as any, journal: null as any, pair: null as any, hold: null as any }));
vi.mock('./SamePlateAppearanceCatchWorkFromSqlite', () => ({ readSamePaCatchWorkFromSqlite: () => mocks.work }));
vi.mock('./SamePlateAppearanceLifecycleFromSqlite', () => ({ readSamePaLifecycleRecordFromSqlite: () => mocks.journal }));
vi.mock('./SamePlateAppearanceFieldRuleEvidenceFromSqlite', () => ({ readSamePaFieldRuleEvidenceWithInputsFromSqlite: () => mocks.pair }));
vi.mock('./SqliteSamePlateAppearanceOccupiedRunnerHoldStore', () => ({ readSamePaOccupiedRunnerHoldFromSqlite: () => mocks.hold }));
const ref = (owner: string, sourceId: string) => ({ owner, sourceId, sourceHash: hash(sourceId), snapshotHash: hash(sourceId) });
/** Structural Native seams only. Real Core executes reception and all five-part
 * motion; Native admission remains the integration suite's responsibility. */
const fixture = () => {
  const h = samePaBatterRunFixture(true), root = h.root, pitch = ref('pa_physical_v1_launches', 'pitch');
  root.lineage.enrollmentReference = ref('same_pa_enrollments', 'enrollment');
  const body = {...h.plan.exitState.body, bodyOriginHeightMeters: 1};
  mocks.hold = { source: {sourceId:'hold', sourceVersion:'test', playerId:'batter', personId:'person',
    enrollmentReference:root.lineage.enrollmentReference, coverageThroughTick:5_000_000}, body:{actor:body},
    setup:{position:{x:0,z:0}}, model:{source:{motion:{ticksPerSecond:1_000_000,reactionDelayTicks:100_000}}} };
  const holdReference = reference('world_same_pa_occupied_runner_holds', mocks.hold), workReference = ref('pa_catch_v1_work','work');
  const at = { originTick:0, elapsedSeconds:0, tick:0 };
  const action:any = {sourceId:'call',sourceVersion:'test',capability:'same_pa_explicit_catch_action_v1',
    assignmentReference:{sourceId:'assignment',sourceVersion:'test',sourceHash:hash('a')}, officialId:'umpire',personId:'person-umpire',
    viewReference:ref('pa_lifecycle_v1_execution_views','call-view'),judgment:'caught',calledAt:at};
  const match:any = {playId:1,ruleProfileId:'npb-2026',outs:0,bases:{first:'batter',second:null,third:null}};
  const occupiedRunners:any={kind:'same_pa_stationary_occupied_runners_v1',runners:[{playerId:'batter',startingBase:'first',holdReference,history:{playerId:'batter',originTick:0,ticksPerSecond:1_000_000,startElapsedSeconds:0,endElapsedSeconds:0,contactAtStart:true,contactAtHorizon:true,episodes:[{startElapsedSeconds:0,endElapsedSeconds:0}],events:[{kind:'touch',originTick:0,elapsedSeconds:0,tick:0}]}}]};
  const operative = deriveSamePaCatchOperativeRuling({action,originalMatch:match,batterRunnerId:'hitter',basisTick:0,basisEvidenceRevision:1,occupiedRunners,
    fairCatch:{kind:'pending',reason:'actual_fair_catch_required'}});
  const emitted = {sourceId:'umpire',targetScope:{kind:'nearby' as const},kind:'callout' as const,issuedAt:0,
    content:{actionSourceId:'call',officialId:'umpire',personId:'person-umpire',judgment:'caught' as const,calledAt:at}};
  const reception = resolveExactCommunicationReception(emitted,0,{originTick:0,ticksPerSecond:1_000_000},
    {propagationDelayTicks:0,recognitionBaseDelayTicks:0,maxAdditionalRecognitionDelayTicks:0,audibility:1,recognition:1,attention:1,minimumRecognizableQuality:0.5},new DeterministicRng(1));
  const physical = reference('pa_physical_v1_field_roots',root);
  mocks.work = {lineage:root.lineage,physicalPitchReference:pitch,physicalOperationReference:physical,originalInputs:{action},operative,
    communication:{clock:{originTick:0,ticksPerSecond:1_000_000},evaluatedThrough:at,emitted,
      recipients:[{kind:'received',playerId:'batter',reception,receiverPosition:{x:0,y:1,z:0}}]}};
  mocks.pair = {kind:'same_pa_field_rule_read_pair_v1',value:{occupiedRunners:{kind:'same_pa_stationary_occupied_runners_v1',runners:[{playerId:'batter',holdReference}]}}};
  mocks.journal = {kind:'same_pa_lifecycle_prefix',source:{eventReferences:[workReference]}};
  const member = {playerId:'batter',bindingHash:hash('b'),personHash:hash('p'),baselineSourceId:'baseline',reservedRevision:0,reservedStateHash:hash('s'),projectedStateHash:hash('ps')};
  const basis:any = {actor:{binding:{playerId:'hitter'}},members:[member],view:{source:{prefixReference:ref('pa_lifecycle_v1_work_prefixes','prefix')},cut:{physicalPitchReference:pitch,physicalOperationReference:physical}}};
  const source:any = {sourceId:'response',sourceVersion:'test',throughTick:0,viewReference:ref('pa_lifecycle_v1_execution_views','view'),action:{kind:'occupied_runner_catch_response_v1',
    member,catchWorkReference:workReference,holdReference,intent:{kind:'hold',issuedTick:0},endTick:2_000_000,provenance:{sourceRecordId:'original-response',sourceVersion:'test'}}};
  const prefix:any[] = [root], respond = () => deriveSamePaOccupiedRunnerCatchResponse({} as any,source,root,root,basis,prefix);
  const admit = () => {const result = respond(), step = {...root,kind:'same_pa_physical_field_step_v1',source,actionResult:result};prefix.push(step);return step;};
  const move = (throughTick:number) => {
    const response = prefix[1], motionSource:any = {sourceId:'motion'+prefix.length,sourceVersion:'test',throughTick,
      action:{kind:'occupied_runner_catch_motion_v1',responseReference:reference('pa_physical_v1_field_steps',response)}};
    const result = deriveSamePaOccupiedRunnerCatchMotion(motionSource,root,prefix.at(-1),prefix), step = {...prefix.at(-1),...result,source:motionSource};prefix.push(step);return step;
  };
  return {...h,source,prefix,respond,admit,move};
};
it('OCR01 separately accepts the received hold, requires real adoption and retains reaction plus finite controller work', () => {
  const h=fixture(), before=JSON.stringify(h.root.field);h.admit();
  expect(JSON.stringify(h.prefix[1].field)).toBe(before);
  expect(mocks.work.operative.ledger.events[0].kind).toBe('UnresolvedCorrectRuleSnapshotRecorded');
  expect(mocks.work.operative.onFieldCall.ruling.basesAfter.first).toBe('batter');
  expect(deriveSamePaOccupiedRunnerCatchCensus(h.prefix).pending[0].work).toEqual([{kind:'adoption',dueTick:0,due:'due'}]);
  expect(() => assertSamePaOccupiedRunnerCatchOwnership({...h.source,action:undefined,throughTick:1},h.prefix)).toThrow(/first physical/);
  expect(() => assertSamePaOccupiedRunnerCatchOwnership({...h.source,action:{kind:'occupied_runner_catch_motion_v1',responseReference:ref('pa_physical_v1_field_steps','foreign')}},h.prefix)).toThrow(/own first/);
  const moved=h.move(50_000), census=deriveSamePaOccupiedRunnerCatchCensus(h.prefix);
  expect(census.pending).toEqual([]);expect(census.adopted).toHaveLength(1);
  expect(census.adopted[0].work).toEqual([{kind:'reaction',dueTick:100_000,due:'future'},{kind:'controller_end',dueTick:2_000_000,due:'future'}]);
  expect(moved.field.motion.actors.filter((a:any)=>a.playerId==='batter').every((a:any)=>Object.values(a.primitive.startVelocity).every(v=>v===0))).toBe(true);
  expect(() => assertSamePaOccupiedRunnerCatchOwnership({...h.source,action:undefined,throughTick:50_001},h.prefix)).not.toThrow();
  h.move(100_000);expect(deriveSamePaOccupiedRunnerCatchCensus(h.prefix).adopted[0].work).toEqual([{kind:'controller_end',dueTick:2_000_000,due:'future'}]);
});
it.each(['scheduled','dropped','not_caught','unadmitted','moving_history','foreign_hold','expired','duplicate'] as const)('OCR02 rejects %s as original received adoption authority', fault => {
  const h=fixture();
  if(fault==='scheduled')mocks.work.communication.recipients[0].kind='scheduled';
  if(fault==='dropped')mocks.work.communication.recipients[0]={kind:'dropped',playerId:'batter',reason:'not_recognizable'};
  if(fault==='not_caught')mocks.work.operative={kind:'active',runnerId:'hitter',onFieldCall:null,ledger:null};
  if(fault==='unadmitted')mocks.journal.source.eventReferences=[];
  if(fault==='moving_history')mocks.pair.value.occupiedRunners={kind:'pending',reason:'moving'};
  if(fault==='foreign_hold')h.source.action.holdReference=ref('world_same_pa_occupied_runner_holds','foreign');
  if(fault==='expired')h.source.action.endTick=5_000_001;
  if(fault==='duplicate')h.admit();
  expect(h.respond).toThrow();
});
it('OCR03 physical adoption rejects a changed body and cannot extend the original hold horizon', () => {
  const h=fixture();h.admit();const previous=h.prefix.at(-1);previous.field=structuredClone(previous.field);
  previous.field.motion.actors[0].primitive.startVelocity.x=1;
  expect(()=>h.move(50_000)).toThrow(/moving original/);
  const f=fixture();f.admit();expect(()=>f.move(2_000_001)).toThrow(/coverage/);
});
