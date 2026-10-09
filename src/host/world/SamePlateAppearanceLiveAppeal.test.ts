import { expect, it } from 'vitest';
import * as live from './SamePlateAppearanceLiveAppeal';
import { samePaPhysicalFieldActionInput } from './SamePlateAppearancePhysicalFieldAction';
import { fixture, material, throwInput, v } from '../../core/sim/ball/BattedWorldScheduledFieldThrow.test-support';
import { deriveInitialBattedWorldFieldMotion, deriveBattedWorldFieldMotionCheckpoint } from '../../core/sim/ball/BattedWorldFieldMotion';
import { prepareBattedWorldScheduledFieldAcquisition } from '../../core/sim/ball/BattedWorldScheduledFieldAcquisition';
import { deriveSamePaPhysicalFieldCapture } from './SamePlateAppearancePhysicalFieldCapture';
import { assertSamePaPhysicalThrowOwnership, samePaPhysicalPendingThrow, deriveSamePaPhysicalThrowPlan, deriveSamePaPhysicalThrowCheckpoint } from './SamePlateAppearancePhysicalFieldThrow';
import { deriveSamePaLiveWorkCensus } from './SamePlateAppearanceLiveWorkCensus';
import { deriveSamePaFieldRuleEvidence } from './SamePlateAppearanceFieldRuleEvidence';
import { createLivePlayRegistry, resolveLivePlayRegistry } from '../../core/sim/liveAction/LivePlayRegistry';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { createCanonicalPlateAppearanceTimeline, recordBatBallContact } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
const member = (playerId: string) => ({ playerId, bindingHash: hash(playerId), personHash: hash(playerId), baselineSourceId: playerId,
  reservedRevision: 0, reservedStateHash: hash(playerId), projectedStateHash: hash(playerId) });
const ref = (f: any): any => reference(f.kind === 'same_pa_physical_field_root_v1' ? 'pa_physical_v1_field_roots' : 'pa_physical_v1_field_steps', f);
const fn = (name: string): Function => { const f = (live as Record<string, unknown>)[name]; expect(f, name).toBeTypeOf('function'); return f as Function; };
const indication = { kind: 'appeal_indication_v1', member: member('carrier'), defenderId: 'receiver', runnerId: 'runner', base: 'first', contact: 'base' } as const;
// Real Core capture/throw/flight/reception in structural host records. This is
// not a complete Native admission fixture and carries no legal-rights proof.
const scene = (contactMode: 'base' | 'runner_body' = 'base', footX = 3, footVelocityX = 0) => {
  const original = fixture(0, 1, 5, 5), roles = ['body', 'glove', 'tag_hand', 'left_foot', 'right_foot'] as const;
  const actors = ['batter', 'carrier', 'receiver', 'runner'].flatMap((playerId, index) => roles.map(role => ({ playerId,
    primitive: { role, radius: 0.125, startTick: 0, endTick: 10_000_000, ticksPerSecond: 1_000_000,
      startCenter: role === 'glove' && playerId === 'carrier' ? v(2.25, 5, 5) : role === 'glove' && playerId === 'receiver' ? v(-2, 5, 5)
        : role.endsWith('foot') && ['runner','receiver'].includes(playerId) ? v(playerId==='receiver'?footX:3, 1, 0) : playerId==='runner' && role==='body' && contactMode==='runner_body' ? v(-2.25,5,5) : v(20 + 5 * index, 10, 5),
      startVelocity: playerId === 'receiver' && role.endsWith('foot') ? v(footVelocityX,0,0) : playerId === 'carrier' && role === 'glove' ? v(1, 0, 0) : playerId === 'runner' && !(role==='body' && contactMode==='runner_body') ? v(0, 0, 2) : v(0, 0, 0), acceleration: v(0, 0, 0) } })));
  const response: any = { ...original.response, world: { ...original.response.world, actors, throughTick: 10_000_000 },
    actors: actors.map(a => ({ playerId: a.playerId, profile: a.primitive.role === 'glove' ? original.response.actors[0].profile : { role: a.primitive.role, material } })) };
  const field = deriveInitialBattedWorldFieldMotion({ ...original, response, commands: actors.map(a => ({ playerId: a.playerId, role: a.primitive.role, acceleration: v(0,0,0) })) });
  const match: any = { ruleProfileId: 'npb-2026', playId: 1, inning: 1, half: 'top', outs: 0, balls: 0, strikes: 0,
    bases: { first: 'runner', second: null, third: null }, score: { away: 0, home: 0 } };
  const timeline = recordBatBallContact(createCanonicalPlateAppearanceTimeline(match, 0), response.world.flight.contact);
  const root: any = { kind:'same_pa_physical_field_root_v1', source:{sourceId:'root',sourceVersion:'fixture-only',parameters:response.world.parameters},
    physicalPitchSourceId:'pitch',pitchOrdinal:1,operationOrdinal:1,evaluationTick:field.motion.world.moment.ball.tick,response,geometry:original.geometry,field,lineage:{playId:1},timeline };
  const fields: any[] = [root];
  const source = (action: any, throughTick = fields.at(-1).evaluationTick): any => ({ sourceId:'step'+fields.length,sourceVersion:'fixture-only',
    previousFieldReference:ref(fields.at(-1)),previousOperationReference:ref(fields.at(-1)),fieldRootReference:ref(root),throughTick,...(action===undefined?{}:{action}) });
  const append = (s: any, value: any) => { const f = { ...root,kind:'same_pa_physical_field_step_v1',source:s,operationOrdinal:fields.length+1,...value }; fields.push(f); return f; };
  const capture = () => { const previous=fields.at(-1), plan=prepareBattedWorldScheduledFieldAcquisition({response,geometry:root.geometry,field:previous.field});
    const s=source({kind:'capture_checkpoint_v1',candidateReference:ref(previous),throughElapsedSeconds:plan.fenceElapsedSeconds},Math.ceil(plan.fenceElapsedSeconds*1_000_000));
    return append(s,deriveSamePaPhysicalFieldCapture(s,root,previous,previous)); };
  capture();
  const indicate = () => { const s=source({...indication,contact:contactMode}); const result=fn('deriveSamePaLiveAppealIndication')(s,root,fields.at(-1),match,['carrier','receiver']);
    return append(s,{field:fields.at(-1).field,evaluationTick:fields.at(-1).evaluationTick,timeline,actionResult:result}); };
  const throwToReceiver = (ind: any) => { const values=throwInput(original), s=source({kind:'throw_plan_v1',member:member('carrier'),
      calibrationReference:{owner:'pa_lifecycle_v1_execution_calibrations',sourceId:'calibration',sourceHash:hash('c'),snapshotHash:hash('c')},receiverPlayerId:'receiver',coverageThroughTick:5_000_000,appealIndicationReference:ref(ind)});
    const bound=fn('bindSamePaAppealThrow')(s,fields);
    const plan=append(s,deriveSamePaPhysicalThrowPlan(s,root,fields.at(-1),{physicalPitchSourceId:'pitch',source:{nominalPitch:{delivery:{matchSeed:42}}},actor:{defenderBindings:[{playerId:'carrier'},{playerId:'receiver'}]}} as any,
      {source:{playerId:'carrier',ratings:values.ratings}} as any,values));
    expect(bound).toEqual(ref(ind));
    const p=plan.actionResult.plan, releaseSource=source({kind:'throw_checkpoint_v1',planReference:ref(plan),throughElapsedSeconds:p.releaseElapsedSeconds},Math.ceil(p.releaseElapsedSeconds*1_000_000));
    const released=append(releaseSource,deriveSamePaPhysicalThrowCheckpoint(releaseSource,root,plan,fields));
    const motion=released.field.motion, s2=source(undefined,4_000_000);
    const received=deriveBattedWorldFieldMotionCheckpoint({response,geometry:root.geometry,actors:motion.actors,cursor:motion.cursor!,carrierPlayerId:null,
      availableAtTick:released.evaluationTick,coverageThroughTick:5_000_000,checkpointThroughTick:4_000_000,
      commands:motion.actors.map((a:any)=>({playerId:a.playerId,role:a.primitive.role,acceleration:a.primitive.acceleration}))});
    expect(received.motion.response.kind, JSON.stringify({world:received.motion.world,response:received.motion.response})).toBe('capture_candidate');
    append(s2,{field:received,evaluationTick:received.motion.world.moment.ball.tick,timeline}); capture(); return plan; };
  const contact = (ind:any,plan:any) => { const s=source({kind:'appeal_contact_v1',indicationReference:ref(ind),throwPlanReference:ref(plan)});
    return { source:s,result:fn('deriveSamePaLiveAppealContact')(s,root,fields.at(-1),fields,match,['carrier','receiver'],'batter') }; };
  const carry = (throughTick: number) => {
    const previous=fields.at(-1), motion=previous.field.motion, s=source(undefined,throughTick);
    const field=deriveBattedWorldFieldMotionCheckpoint({response,geometry:root.geometry,actors:motion.actors,cursor:motion.cursor!,carrierPlayerId:motion.carrierPlayerId,
      availableAtTick:previous.evaluationTick,coverageThroughTick:5_000_000,checkpointThroughTick:throughTick,
      commands:motion.actors.map((a:any)=>({playerId:a.playerId,role:a.primitive.role,acceleration:a.primitive.acceleration}))});
    expect(field.motion.response.kind).toBe('carried');
    return append(s,{field,evaluationTick:field.motion.world.moment.ball.tick,timeline});
  };
  return {root,fields,match,source,append,indicate,throwToReceiver,contact,carry};
};
it('LAP01 accepts explicit indication and purpose linkage without result or clock injection',()=>{
  expect(()=>samePaPhysicalFieldActionInput(indication as any)).not.toThrow();
  for(const key of ['tick','live','rights','out']) expect(()=>samePaPhysicalFieldActionInput({...indication,[key]:true} as any)).toThrow();
});
it('LAP02 preserves indicated work and records actual throw/reception/base contact with rights still unowned',()=>{
  const h=scene(), ind=h.indicate(), plan=h.throwToReceiver(ind), before=JSON.stringify(h.fields), result=h.contact(ind,plan).result;
  expect(result.execution).toMatchObject({kind:'executed',attempt:{defenderId:'receiver',runnerId:'runner',base:1},
    rights:{kind:'pending',reason:'original_live_ball_and_appeal_rights_required'}});
  expect(result.execution.moment.elapsedSeconds).toBe(h.fields.at(-1).field.motion.world.moment.elapsedSeconds);
  expect(result.execution.complianceEvidence.history.endElapsedSeconds).toBe(result.execution.moment.elapsedSeconds);
  expect(result.execution.indicatedAt).toEqual(ind.actionResult.indicatedAt);
  expect(result.execution).not.toHaveProperty('out'); expect(result.execution).not.toHaveProperty('playEnd');
  expect(JSON.stringify(h.fields)).toBe(before);
});
it('LAP03 an indication cannot substitute for its original throw plan',()=>{
  const h=scene(), ind=h.indicate();
  expect(()=>h.contact(ind,ind)).toThrow(/original indication or throw plan/);
});

it('LAP04 retains pending indication work until its real physical execution, without settling the play',()=>{
  const h=scene(),ind=h.indicate(), census=fn('deriveSamePaLiveAppealCensus')(h.fields);
  expect(census.pending).toHaveLength(1); expect(census.executed).toEqual([]);
  expect(census.sources[0].intents[0]).toMatchObject({kind:'issued_intent',actorId:'receiver',dueTick:ind.evaluationTick});
  expect(census.sources[0]).not.toHaveProperty('completion');
  const plan=h.throwToReceiver(ind), contacted=h.contact(ind,plan);
  h.append(contacted.source,{field:h.fields.at(-1).field,evaluationTick:h.fields.at(-1).evaluationTick,timeline:h.fields.at(-1).timeline,actionResult:contacted.result});
  const done=fn('deriveSamePaLiveAppealCensus')(h.fields);
  expect(done.pending).toEqual([]); expect(done.executed).toHaveLength(1); expect(done.sources[0].intents).toEqual([]);
  expect(done.sources[0].completion.basisEventId).toBe(contacted.source.sourceId);
  expect(contacted.result.execution.rights.kind).toBe('pending');
});
it.each(['foreign_receiver','wrong_base'])('LAP05 rejects %s in the original indication',fault=>{
  const h=scene(),a={...indication,...(fault==='foreign_receiver'?{defenderId:'outsider'}:{base:'second'})};
  expect(()=>fn('deriveSamePaLiveAppealIndication')(h.source(a),h.root,h.fields.at(-1),h.match,['carrier','receiver'])).toThrow(/participant/);
});
it('LAP06 a linked plan before real release stays pending',()=>{
  const h=scene(),ind=h.indicate(),plan=h.throwToReceiver(ind); h.fields.length=h.fields.indexOf(plan)+1;
  expect(h.contact(ind,plan).result.execution).toEqual({kind:'pending',reason:'original_appeal_throw_release_required'});
});
it('LAP07 cannot execute the same indicated physical attempt twice',()=>{
  const h=scene(),ind=h.indicate(),plan=h.throwToReceiver(ind),receipt=h.contact(ind,plan);
  h.append(receipt.source,{field:h.fields.at(-1).field,evaluationTick:h.fields.at(-1).evaluationTick,timeline:h.fields.at(-1).timeline,actionResult:receipt.result});
  expect(()=>h.contact(ind,plan)).toThrow(/already executed/);
});
it('LAP08 records actual receiver glove/body contact after the linked throw without base contact',()=>{
  const h=scene('runner_body',4),ind=h.indicate(),plan=h.throwToReceiver(ind),r=h.contact(ind,plan).result;
  expect(r.execution).toMatchObject({kind:'executed',contact:{kind:'runner_body',fact:{kind:'controlled_runner_tag',defenderId:'receiver',runnerId:'runner'}}});
});
it('LAP09 receiver possession without the selected current contact remains pending',()=>{
  const h=scene('base',4),ind=h.indicate(),plan=h.throwToReceiver(ind);
  expect(h.contact(ind,plan).result.execution).toMatchObject({kind:'pending',reason:'original_appeal_current_base_contact_required'});
});
it('LAP10 rejects an unrelated throw-purpose link',()=>{
  const h=scene(),ind=h.indicate(),s=h.source({kind:'throw_plan_v1',member:member('carrier'),receiverPlayerId:'other',appealIndicationReference:ref(ind)});
  expect(()=>fn('bindSamePaAppealThrow')(s,h.fields)).toThrow(/purpose/);
});

it('LAP11 exposes the live appeal in the original census while retaining controller coverage',()=>{
  const h=scene(),ind=h.indicate();
  const census=()=>deriveSamePaLiveWorkCensus({fields:h.fields,participantIds:['batter','carrier','receiver','runner'],observationPolicies:[],
    possessionEvidence:deriveSamePaFieldRuleEvidence({fields:h.fields,batterRunnerId:'batter',defenderIds:['carrier','receiver'],occupiedRunnerIds:['runner'],outsAtStart:0}).rule.possessionEvidence});
  expect(census().liveAppeals?.pending[0].indicationReference).toEqual(ref(ind));
  expect(census().participantCurves).toHaveLength(4);
  const plan=h.throwToReceiver(ind),receipt=h.contact(ind,plan);
  h.append(receipt.source,{field:h.fields.at(-1).field,evaluationTick:h.fields.at(-1).evaluationTick,timeline:h.fields.at(-1).timeline,actionResult:receipt.result});
  const result=census();
  expect(result.liveAppeals?.executed).toHaveLength(1);
  expect(result.pendingPhysical).toEqual({captures:[],throw:null});
  expect(result.participantCurves.every(c=>c.coverageThroughTick>result.originalFieldPrefix.at.tick)).toBe(true);
  const registry=createLivePlayRegistry({playId:1,revision:1,sources:result.liveAppeals!.sources});
  expect(registry.sources[0].completion?.basisEventId).toBe(receipt.source.sourceId);
});
it('LAP12 pending physical contact cannot consume the explicit intent in the frontier',()=>{
  const h=scene('base',4),ind=h.indicate(),plan=h.throwToReceiver(ind),receipt=h.contact(ind,plan);
  h.append(receipt.source,{field:h.fields.at(-1).field,evaluationTick:h.fields.at(-1).evaluationTick,timeline:h.fields.at(-1).timeline,actionResult:receipt.result});
  const census=live.deriveSamePaLiveAppealCensus(h.fields);
  expect(census.pending).toHaveLength(1); expect(census.executed).toEqual([]);
  const result=resolveLivePlayRegistry(createLivePlayRegistry({playId:1,revision:1,sources:census.sources}),
    {tick:h.fields.at(-1).evaluationTick,terminal:'none',actors:[]});
  expect(result.resolution.kind).toBe('continues'); expect(result.frontier.intents).toHaveLength(1);
});
it('LAP13 rejects a duplicate execution in census and forged purpose reference',()=>{
  const h=scene(),ind=h.indicate(),plan=h.throwToReceiver(ind),receipt=h.contact(ind,plan);
  const value={field:h.fields.at(-1).field,evaluationTick:h.fields.at(-1).evaluationTick,timeline:h.fields.at(-1).timeline,actionResult:receipt.result};
  h.append(receipt.source,value);
  h.append(h.source(receipt.source.action),value);
  expect(()=>live.deriveSamePaLiveAppealCensus(h.fields)).toThrow(/already executed/);
  const other=scene(),i=other.indicate(),s=other.source({kind:'throw_plan_v1',member:member('carrier'),receiverPlayerId:'receiver',
    appealIndicationReference:{...ref(i),snapshotHash:hash('different')}});
  expect(()=>live.bindSamePaAppealThrow(s,other.fields)).toThrow(/linkage/);
});
it('LAP14 appeal metadata cannot hide the existing transfer owner',()=>{
  const h=scene(),ind=h.indicate(),plan=h.throwToReceiver(ind); h.fields.length=h.fields.indexOf(plan)+1;
  const s=h.source(indication);
  h.append(s,{field:plan.field,evaluationTick:plan.evaluationTick,timeline:plan.timeline,actionResult:ind.actionResult});
  expect(samePaPhysicalPendingThrow(h.fields)?.step).toBe(plan);
  expect(()=>assertSamePaPhysicalThrowOwnership(h.source({kind:'appeal_contact_v1',indicationReference:ref(ind),throwPlanReference:ref(plan)}),h.fields)).toThrow(/transfer owns/);
});
it('LAP15 a later unlinked throw cannot supply the indicated throw contact',()=>{
  const h=scene(),ind=h.indicate(),plan=h.throwToReceiver(ind),prior=h.fields.at(-1);
  h.append(h.source({...plan.source.action,appealIndicationReference:ref(ind)}),{field:prior.field,evaluationTick:prior.evaluationTick,timeline:prior.timeline,actionResult:plan.actionResult});
  expect(h.contact(ind,plan).result.execution).toEqual({kind:'pending',reason:'original_appeal_linked_throw_custody_required'});
});

it('LAP16 reaches the selected base after two real carried advances without losing linked custody',()=>{
  const h=scene('base',5,-0.4),ind=h.indicate(),plan=h.throwToReceiver(ind);
  const receivedAt=h.fields.at(-1).field.motion.world.moment.elapsedSeconds;
  expect(h.contact(ind,plan).result.execution, String(receivedAt)).toMatchObject({kind:'pending',reason:'original_appeal_current_base_contact_required'});
  h.carry(4_500_000); h.carry(4_750_000);
  const result=h.contact(ind,plan).result.execution;
  expect(result).toMatchObject({kind:'executed',contact:{control:{startElapsedSeconds:receivedAt,endElapsedSeconds:4.75,endInclusive:true}}});
  expect(result.complianceEvidence.history.endElapsedSeconds).toBe(4.75);
});
it('LAP17 custody union preserves exact gaps and exclusive current endpoints',()=>{
  const control=fn('samePaContinuousAppealControl');
  const w=(startElapsedSeconds:number,endElapsedSeconds:number,endInclusive=true)=>({startElapsedSeconds,endElapsedSeconds,endInclusive});
  expect(control([w(1,2,false),w(2,3)],1,3)).toEqual(w(1,3));
  expect(control([w(1,2),w(2.000001,3)],1,3)).toBeNull();
  expect(control([w(1,3,false),w(3,3,false)],1,3)).toBeNull();
  expect(control([w(1,2,false),w(2,3,false),w(3,3)],1,3)).toEqual(w(1,3));
  expect(control([w(1,1,false)],1,1)).toBeNull();
});
