import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { classifyMeasuredTrait } from './index';
import { projectSourceTraits, compareSourceTraitRequests } from '../sources';
import type { SourceTraitRequest } from '../sources';
import { contactFixture, commandFixture, releaseFixture, spinFixture, time, value } from './MeasuredTraitFixtures.test-support';
import type { MeasuredTraitRequest } from './MeasuredTraitTypes';
const projectionRequest=(r:MeasuredTraitRequest,id:string):SourceTraitRequest=>{
  const measured=value(classifyMeasuredTrait(r));
  return {projectionId:id,scope:r.scope,time:r.time,worldRevision:r.source.revision,targetTeamId:null,
    currentSources:[r.source],policy:{policyId:'synthetic-projection-only',version:'1',families:[{
      familyId:r.model.rule.familyId,modelId:r.model.modelId,modelVersion:r.model.version,
      minimumRecognitionEpisodes:r.model.minimumEpisodes,minimumRecognitionDays:r.model.minimumDays}]},
    assessments:measured.assessment===null?[]:[measured.assessment]};
};
const rejected=(input:unknown,code?:string)=>{const x=classifyMeasuredTrait(input);assert.equal(x.ok,false);if(!x.ok&&code)assert.equal(x.reason.code,code);};
const mutate=(fn:(r:any)=>void,fixture:()=>MeasuredTraitRequest=contactFixture)=>{
  const r: any=structuredClone(fixture());fn(r);return r;
};
describe('measured traits input integrity',()=>{
  for(const [name,fn,code] of [
    ['foreign player',(r:any)=>r.observations[0].scope.playerId='other','SCOPE_MISMATCH'],
    ['foreign career',(r:any)=>r.source.careerId='other','SCOPE_MISMATCH'],
    ['wrong owner',(r:any)=>r.source.owner='PITCH_TRAJECTORY','SOURCE_CONFLICT'],
    ['future source',(r:any)=>r.source.time.day=100,'BACKDATED_EVALUATION'],
    ['observation after snapshot',(r:any)=>r.observations[0].time.day=4,'BACKDATED_EVALUATION'],
    ['contradictory seasons',(r:any)=>r.observations[0].time.season=2027,'BACKDATED_EVALUATION'],
    ['decreasing season with increasing day',(r:any)=>r.observations[2].time.season=2025,'INCONSISTENT_STATE'],
    ['duplicate event',(r:any)=>r.observations[1].eventId=r.observations[0].eventId,'INCONSISTENT_STATE'],
    ['duplicate instant under new IDs',(r:any)=>r.observations[1].time=r.observations[0].time,'INCONSISTENT_STATE'],
    ['sparse observation array',(r:any)=>delete r.observations[1],'INVALID_INPUT'],
    ['NaN launch velocity',(r:any)=>r.observations[0].exitVelocityMps.x=NaN,'INVALID_INPUT'],
    ['zero outgoing velocity',(r:any)=>r.observations[0].exitVelocityMps={x:0,y:0,z:0},'INVALID_INPUT'],
    ['invalid fraction',(r:any)=>r.model.rule.minimumFraction=1.1,'INVALID_INPUT'],
    ['zero fraction',(r:any)=>r.model.rule.minimumFraction=0,'INVALID_INPUT'],
    ['unordered angles',(r:any)=>r.model.rule.lowerAngleDeg=50,'INVALID_INPUT'],
    ['out of range angle',(r:any)=>r.model.rule.upperAngleDeg=100,'INVALID_INPUT'],
    ['negative time',(r:any)=>r.time.day=-1,'INVALID_INPUT'],
    ['fractional revision',(r:any)=>r.source.revision=0.5,'INVALID_INPUT'],
    ['empty version',(r:any)=>r.model.version=' ','INVALID_INPUT'],
    ['single episode calibration',(r:any)=>r.model.minimumEpisodes=1,'INVALID_INPUT'],
    ['impossible evidence span',(r:any)=>r.model.minimumDays=r.model.windowDays,'INVALID_INPUT'],
    ['outcome label injection',(r:any)=>r.observations[0].homeRun=true,'INVALID_INPUT'],
    ['effect injection',(r:any)=>r.effectMultiplier=2,'INVALID_INPUT'],
    ['failure injection in contact data',(r:any)=>r.observations[0].deliveryFailed=true,'INVALID_INPUT'],
  ] as const) it('rejects '+name,()=>rejected(mutate(fn),code));
  it('does not invoke getters while parsing',()=>{
    let called=false;const r:any=contactFixture();Object.defineProperty(r,'observations',{enumerable:true,get:()=>{called=true;return [];}});
    rejected(r,'INVALID_INPUT');assert.equal(called,false);
  });
  it('rejects non-plain object roots',()=>rejected(new Date(),'INVALID_INPUT'));
  it('rejects inherited observation fields',()=>{
    const r:any=contactFixture();r.observations[0]=Object.create(r.observations[0]);rejected(r,'INVALID_INPUT');
  });
  it('rejects overlapping pitcher minimum shares',()=>{
    const r:any=contactFixture();r.source.owner='PITCHING_CONTACT';r.model.rule={familyId:'pitcher_contact_distribution',groundUpperAngleDeg:10,flyLowerAngleDeg:30,minimumGroundFraction:0.5,minimumFlyFraction:0.5};
    rejected(r,'INVALID_INPUT');
  });
  it('rejects high-spin threshold below the gyro threshold',()=>rejected(mutate(r=>r.model.rule.highSpinRpm=1,spinFixture),'INVALID_INPUT'));
  it('rejects weaker high-spin minimum fraction',()=>rejected(mutate(r=>r.model.rule.minimumHighSpinGyroFraction=0.1,spinFixture),'INVALID_INPUT'));
  it('rejects zero pitch velocity instead of inventing an axis',()=>rejected(mutate(r=>r.observations[0].velocityMps={x:0,y:0,z:0},spinFixture),'INVALID_INPUT'));
  it('rejects overflow while converting spin units',()=>rejected(mutate(r=>r.observations[0].spinRadPerSecond={x:0,y:0,z:1e308},spinFixture),'OVERFLOW'));
  it('rejects overflow computing relative command errors',()=>rejected(mutate(r=>{
    r.observations[0].actual.horizontalM=1e308;r.observations[0].target.horizontalM=-1e308;
  },commandFixture),'OVERFLOW'));
  it('preserves a tiny but nonzero dispersion instead of false absence by squared underflow',()=>{
    const r:any=commandFixture();r.model.rule.minimumDispersionM=1e-200;
    r.observations=r.observations.map((o:any,i:number)=>({...o,target:{horizontalM:0,verticalM:0},
      actual:{horizontalM:i===1?-2e-200:2e-200,verticalM:0}}));
    const x=value(classifyMeasuredTrait(r));assert.equal(x.assessment?.stateId,'UNSTABLE');
    const sigma=x.metrics.find(m=>m.key==='dispersionM')!.value;
    assert.ok(sigma>1e-200&&sigma<2e-200);
  });
  it('rejects overflowing squared dispersion',()=>rejected(mutate(r=>r.observations[0].actual.horizontalM=1e200,commandFixture),'OVERFLOW'));
  it('does not accept pitch-command data as release-failure evidence',()=>rejected(mutate(r=>r.source.owner='PITCH_COMMAND',releaseFixture),'SOURCE_CONFLICT'));
  it('rejects hidden invalid old-window observations rather than laundering them by filtering',()=>{
    rejected(mutate(r=>{r.observations[0].exitVelocityMps.x=Infinity;r.time=time(5);r.model.windowDays=3;}),'INVALID_INPUT');
  });
  it('uses half-open contact angle ranges at zero',()=>{
    const r:any=contactFixture([0,0,0]);r.model.rule.lowerAngleDeg=0;
    assert.equal(value(classifyMeasuredTrait(r)).assessment?.stateId,'LINE_DRIVE');
    r.model.rule.lowerAngleDeg=-20;r.model.rule.upperAngleDeg=0;
    assert.equal(value(classifyMeasuredTrait(r)).assessment?.stateId,null);
  });
});
describe('actual numeric recognition -> existing PR33 projection',()=>{
  for(const [name,fixture,family,state] of [
    ['line drive',contactFixture,'line_drive','LINE_DRIVE'],
    ['gyro',spinFixture,'gyro_pitch_shape','GYRO'],
    ['command',commandFixture,'command_instability','UNSTABLE'],
    ['release',releaseFixture,'release_miss_pattern','DIRECTIONAL_MISS'],
  ] as const) it('projects '+name+' through the existing source owner',()=>{
    const projected=value(projectSourceTraits(projectionRequest(fixture(),'projection')));
    const entry=projected.entries.find(e=>e.familyId===family)!;
    assert.equal(entry.status,'PRESENT');assert.equal(entry.stateId,state);assert.equal(entry.route,'CURRENT_SOURCE_DESCRIPTION');
  });
  it('does not send an absent assessment when classifier evidence is insufficient',()=>{
    const r={...contactFixture(),observations:[]};const x=value(projectSourceTraits(projectionRequest(r,'empty')));
    assert.equal(x.entries.find(e=>e.familyId==='line_drive')?.status,'UNASSESSED');
  });
  it('invalidates the old measured assessment when the current source snapshot changes',()=>{
    const r=projectionRequest(contactFixture(),'projection');const s=r.currentSources[0]!;
    const x=value(projectSourceTraits({...r,currentSources:[{...s,revision:s.revision+1,snapshotId:'new-snapshot'}]}));
    assert.equal(x.entries.find(e=>e.familyId==='line_drive')?.status,'UNAVAILABLE');
  });
  it('computes a cleared descriptor from new measurements, not an outcome bonus',()=>{
    const before=projectionRequest(contactFixture(),'before'),r=contactFixture([-20,50,80]);
    const next={...r,classificationId:'after-measured',time:time(8),source:{...r.source,revision:2,snapshotId:'snapshot:2',time:time(7)},
      observations:r.observations.map((o,i)=>({...o,eventId:'new-event:'+i,episodeId:'new-episode:'+i,time:time(i+5)}))};
    const after=projectionRequest(next,'after'),difference=value(compareSourceTraitRequests(before,after));
    assert.equal(difference.changes.find(e=>e.familyId==='line_drive')?.transition,'CLEARED');
    assert.equal(value(classifyMeasuredTrait(next)).assessment?.changeKind,'RECOGNITION');
  });
  it('does not call missing new measurements an improvement',()=>{
    const r=contactFixture(),before=projectionRequest(r,'before');
    const after=projectionRequest({...r,classificationId:'empty-after',observations:[],source:{...r.source,revision:2,snapshotId:'snapshot:2'}},'after');
    assert.equal(value(compareSourceTraitRequests(before,after)).changes.find(e=>e.familyId==='line_drive')?.transition,'BECAME_UNAVAILABLE');
  });
  it('preserves identical statistics and evidence after JSON round trip',()=>{
    const r=commandFixture();assert.deepEqual(classifyMeasuredTrait(r),classifyMeasuredTrait(JSON.parse(JSON.stringify(r))));
  });
  it('is deterministic for an unordered multi-episode 300-observation window',()=>{
    const r:any=commandFixture(Array.from({length:300},(_,i)=>i%2?0.2:-0.2));
    r.model.windowDays=400;const x=value(classifyMeasuredTrait(r));
    assert.equal(x.sampleCount,300);assert.equal(x.episodeCount,300);
    assert.deepEqual(value(classifyMeasuredTrait({...r,observations:[...r.observations].reverse()})),x);
  });
});
