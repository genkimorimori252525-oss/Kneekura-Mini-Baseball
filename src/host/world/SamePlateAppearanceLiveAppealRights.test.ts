import { expect, it } from 'vitest';
import { deriveSamePaLiveAppealRights } from './SamePlateAppearanceLiveAppealRights';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';

// These are narrow projection inputs, not a claim of Native admission. Native
// must replay the original field, declaration and venue owners independently.
const fixture=()=>{
  const moment=(elapsedSeconds:number)=>({originTick:10,elapsedSeconds,tick:10+elapsedSeconds*1000});
  const viewSource={sourceId:'view',sourceVersion:'test'}, viewReference=reference('pa_lifecycle_v1_execution_views',{source:viewSource});
  const lineage={gameId:'game',playId:1}, pitch={owner:'pa_physical_v1_launches',sourceId:'pitch',sourceHash:hash('pitch'),snapshotHash:hash('pitch')};
  const field=(id:string,actionResult?:unknown):any=>({kind:'same_pa_physical_field_step_v1',source:{sourceId:id,sourceVersion:'test'},
    ...(actionResult===undefined?{}:{actionResult})});
  const indication=field('indication'), plan=field('failed-throw',{kind:'throw_plan_v1',appealIndicationReference:reference('pa_physical_v1_field_steps',indication)}), end=field('contact-frame');
  const endRef=reference('pa_physical_v1_field_steps',end), fields=[indication,plan,end];
  const point=(classification='inside_playable_region')=>({classification,regionIds:['region']});
  const interval=(startElapsedSeconds:number,endElapsedSeconds:number,classification='inside_playable_region',index=0)=>({segmentIndex:index,
    startElapsedSeconds,endElapsedSeconds,classification,regionIds:['region'],start:point(classification),end:point(classification)});
  const coverage=(intervals:any[])=>({kind:intervals.some(i=>i.classification==='unresolved')?'pending':'complete',intervals,uncertainSpans:[],firstCertainOutOfPlay:null});
  const play=(elapsedSeconds:number,declaration='play'):any=>({kind:'same_pa_live_ball_state_v1',source:{sourceId:declaration,sourceVersion:'test',declaration},
    state:declaration==='play'?'live':'dead',occurredAt:moment(elapsedSeconds)});
  const receipt:any={kind:'same_pa_physical_field_step_v1',source:{action:{kind:'appeal_contact_v1'},viewReference,previousFieldReference:endRef},
    actionResult:{kind:'appeal_contact_v1',execution:{kind:'executed',moment:moment(3),complianceEvidence:{firstTouch:{originTick:10,elapsedSeconds:0.5}}}}};
  const ballEvidence={horizon:{elapsedSeconds:3},acquisitions:[{kind:'secured',moment:{elapsedSeconds:1}}]};
  const pair:any={view:{source:viewSource,lineage},fields,actor:{match:{outs:1}},value:{physicalPitchReference:pitch,physicalOperationReference:endRef,
    evidence:{physical:{field:{evidence:ballEvidence}}}}};
  const history:any={kind:'same_pa_live_ball_history_v1',viewReference,lineage,physicalPitchReference:pitch,physicalOperationReference:endRef,
    evaluatedThrough:moment(3),actions:[play(0.25)]};
  const venue:any={kind:'same_pa_venue_legal_coverage_v1',policyReference:{sourceId:'venue-policy',sourceVersion:'test',policyHash:hash('venue'),throughReference:endRef},
    input:{originTick:10,ticksPerSecond:1000},coverage:coverage([interval(0,1),interval(1,2,'inside_playable_region',1),interval(2,3,'inside_playable_region',2)]),
    fieldSegments:[{constraint:'free'},{constraint:'carried'},{constraint:'free'}],carrierCoverage:[],unresolvedCarrierSpans:[],
    appealThrows:[{indicationReference:reference('pa_physical_v1_field_steps',indication),planReference:reference('pa_physical_v1_field_steps',plan),
      release:{moment:moment(2)},segmentIndexes:[2],coverage:coverage([interval(2,2),interval(2,3)])}]};
  return {pair,history,venue,receipt,play,moment,interval};
};
const derive=(h:ReturnType<typeof fixture>)=>deriveSamePaLiveAppealRights(h.pair,h.history,h.venue,h.receipt);
it('LAR01 defined original pre-contact live evidence preserves the positive extension without changing occurrence',()=>{
  const h=fixture(), before=JSON.stringify(h.receipt), result=derive(h);
  expect(result).toMatchObject({kind:'ready',evidence:{liveAtExecution:{kind:'live',at:h.moment(0.25),coveredThroughElapsedSeconds:3},
    window:{openedAtElapsedSeconds:1,closedAtElapsedSeconds:null},appealThrowForfeitures:[]}});
  expect(JSON.stringify(h.receipt)).toBe(before);
});
it('LAR02 unknown initial state and later Play cannot validate the earlier catch',()=>{
  const h=fixture();h.history.actions=[];
  expect(derive(h)).toEqual({kind:'pending',reason:'initial_live_ball_owner_missing'});
  h.history.actions=[h.play(1.25)];
  expect(derive(h)).toEqual({kind:'pending',reason:'original_live_state_before_first_fielder_touch_required'});
});
it('LAR03 a failed explicitly linked throw forfeits later appeals even without its own contact receipt',()=>{
  const h=fixture();h.history.actions=[h.play(1.25),h.play(2.75,'time')];
  h.venue.appealThrows[0].coverage.firstCertainOutOfPlay={...h.moment(2.5),regionIds:['dead']};
  h.venue.appealThrows[0].coverage.intervals[1]=h.interval(2,2.5,'unresolved');
  h.venue.appealThrows[0].coverage.intervals[1].end.classification='out_of_play';
  h.venue.appealThrows[0].coverage.kind='pending';
  const result=derive(h);
  expect(result).toMatchObject({kind:'ready',evidence:{appealThrowForfeitures:[{throwPlan:{sourceId:'failed-throw'},firstCertainDeadAtElapsedSeconds:2.5}]}});
  expect(h.pair.fields.some((f:any)=>f.actionResult?.kind==='appeal_contact_v1')).toBe(false);
});
it('LAR04 a throw during unknown initial state does not acquire forfeiture authority',()=>{
  const h=fixture();h.history.actions=[];
  h.venue.appealThrows[0].coverage.firstCertainOutOfPlay={...h.moment(2.5),regionIds:['dead']};
  h.venue.appealThrows[0].coverage.intervals[1]=h.interval(2,2.5,'unresolved');
  h.venue.appealThrows[0].coverage.intervals[1].end.classification='out_of_play';
  expect(derive(h)).toEqual({kind:'pending',reason:'initial_live_ball_owner_missing'});
});
it('LAR05 actual earlier Time proves dead while exact simultaneous Time stays unresolved',()=>{
  const h=fixture();h.history.actions=[h.play(2.5,'time')];
  expect(derive(h)).toMatchObject({kind:'ready',evidence:{liveAtExecution:{kind:'dead',at:h.moment(2.5)}}});
  h.history.actions=[h.play(3,'time')];
  expect(derive(h)).toEqual({kind:'pending',reason:'original_live_ball_coverage_required'});
});
it('LAR06 missing legal territory or carried outside geometry never becomes live or dead by default',()=>{
  const h=fixture();h.venue.coverage.intervals[2].classification='unresolved';
  expect(derive(h)).toEqual({kind:'pending',reason:'original_live_ball_coverage_required'});
  h.venue.coverage.intervals[2].end.classification='out_of_play';h.venue.fieldSegments[2].constraint='carried';
  expect(derive(h)).toEqual({kind:'pending',reason:'original_live_ball_coverage_required'});
  h.venue.fieldSegments[2].constraint='free';
  expect(derive(h)).toEqual({kind:'pending',reason:'original_live_ball_exact_order_required'});
});
it('LAR07 inning-ending departure and ordinary throw purpose retain their independent owners',()=>{
  const h=fixture();h.pair.actor.match.outs=2;
  expect(derive(h)).toEqual({kind:'pending',reason:'original_defense_departure_history_required'});
  h.pair.actor.match.outs=1;delete h.pair.fields[1].actionResult.appealIndicationReference;
  expect(derive(h)).toEqual({kind:'pending',reason:'original_nonappeal_play_rights_owner_required'});
});
it('LAR08 mismatched original physical cut is rejected before evidence is admitted',()=>{
  const h=fixture();h.history.evaluatedThrough=h.moment(4);
  expect(()=>derive(h)).toThrow(/original physical or legal cut/);
});
