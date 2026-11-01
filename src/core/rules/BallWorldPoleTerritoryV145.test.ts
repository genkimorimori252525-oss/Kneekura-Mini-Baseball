import {expect,it} from 'vitest';
import {deriveBallWorldFieldTerritory,deriveBallWorldFieldTerritoryWithPolesV145,type BallWorldFieldTerritoryInput} from './BallWorldFieldTerritory';
import {createSourceFreeBallPoleV136,type SourceFreeBallPoleV136} from '../sim/ball/SourceFreeBallPoleV136';
import {battedWorldBaseSurfaceId} from '../sim/ball/BattedWorldFieldMotion';
import {quantizeEventTick} from '../sim/ExactEventTime';
import type {BallWorldBattedRuleContactFrame} from './BallWorldBattedRuleEvidence';
import type {BallWorldBaseBoundaryContact} from '../sim/ball/BallWorldBaseBoundary';
import {querySourceFreeBallWorldWithPolesV136} from '../sim/ball/SourceFreeBallWorldQuery';
import type {SourceFreeBallDescriptorV2} from '../sim/ball/SourceFreeBallKernel';
import {REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS} from '../sim/ball/BaseballAerodynamics';

const v=(x:number,y:number,z:number)=>({x,y,z});
const moment=(t:number,x=10,z=-.19,y=1,tps=1e6)=>({originTick:0,elapsedSeconds:t,
  ball:{tick:quantizeEventTick(0,t,tps),position:v(x,y,z),velocity:v(0,0,1),spin:v(0,0,0)}});
const poles:readonly SourceFreeBallPoleV136[]=[{surfaceId:'left-pole',center:{x:10,z:0},minimumHeight:0,maximumHeight:5,radiusM:.1},
  {surfaceId:'right-pole',center:{x:0,z:10},minimumHeight:0,maximumHeight:5,radiusM:.1}];
function fixture(index=0,t=1,tps=1e6){
  const pole=poles[index],at=index?moment(t,-.19,10,1,tps):moment(t,10,-.19,1,tps),point=createSourceFreeBallPoleV136(pole).closest(at.ball.position);
  const delta=v(at.ball.position.x-point.x,at.ball.position.y-point.y,at.ball.position.z-point.z),n=Math.hypot(delta.x,delta.y,delta.z);
  const contact={kind:'pole' as const,surfaceId:pole.surfaceId,moment:at,point,normal:v(delta.x/n,delta.y/n,delta.z/n)};
  const contacts:BallWorldBattedRuleContactFrame[]=[{moment:at,contacts:[{kind:'surface',surfaceId:pole.surfaceId}]}];
  const baseContacts:BallWorldBaseBoundaryContact[]=[];
  const field={evidence:{batterRunnerId:'batter',defenderIds:['defender'],
    field:{homePlate:{x:0,z:0},firstBaseLineUnit:{x:1,z:0},thirdBaseLineUnit:{x:0,z:1}},
    bases:{homePlate:{x:0,z:0},firstBase:{x:2,z:0},secondBase:{x:2,z:2},thirdBase:{x:0,z:2}},
    ballRadiusMeters:.1,originTick:0,ticksPerSecond:tps,horizon:moment(3,10,1,1,tps),acquisitions:[],
    contacts},baseContacts} satisfies BallWorldFieldTerritoryInput;
  return {field,poles,poleContacts:[contact],policy:{version:'adopted_fair_pole_policy_v145' as const,
    sourceId:'explicit-synthetic-adopted-boundary',sourceVersion:'test-v145',ruleProfileId:'synthetic-rules',rulesRevision:'1',
    fairPoleSurfaceIds:poles.map(p=>p.surfaceId)}};
}

it.each([0,1])('uses adopted physical pole %i rather than the ball center alone, without HR or possession authority',index=>{
  const p=fixture(index),before=structuredClone(p),result=deriveBallWorldFieldTerritoryWithPolesV145(p);
  expect(result).toMatchObject({kind:'resolved',territory:'fair',basis:'pole_contact',surfaceId:poles[index].surfaceId,moment:p.poleContacts[0].moment});
  expect(result).not.toHaveProperty('homeRun');expect(result).not.toHaveProperty('playEnd');expect(result).not.toHaveProperty('possession');
  expect(p).toEqual(before);
  expect(deriveBallWorldFieldTerritory(p.field)).toMatchObject({kind:'unresolved',reason:'surface_policy_pending'});
});
it('preserves a foul already decided by an earlier fielder even if a later ball hits a fair pole',()=>{
  const p=fixture();p.field.evidence.contacts.unshift({moment:moment(.5,-2,-2),contacts:[{kind:'actor',playerId:'defender',role:'glove'}]});
  expect(deriveBallWorldFieldTerritoryWithPolesV145(p)).toMatchObject({territory:'foul',basis:'fielder_touch',moment:{elapsedSeconds:.5}});
});
it('preserves an earlier grounded foul beyond the bases and an earlier fair bag contact',()=>{
  const p=fixture(),at=moment(.5,3,-1,.1);
  p.field.evidence.contacts.unshift({moment:at,contacts:[{kind:'ground'}]});
  expect(deriveBallWorldFieldTerritoryWithPolesV145(p)).toMatchObject({territory:'foul',basis:'ground'});
  const q=fixture(),bag=moment(.5,2,0);
  q.field={...q.field,baseContacts:[{kind:'base',baseId:'first',moment:bag,point:bag.ball.position,normal:v(1,0,0)}],
    evidence:{...q.field.evidence,contacts:[{moment:bag,contacts:[{kind:'surface',surfaceId:battedWorldBaseSurfaceId('first')}]},...q.field.evidence.contacts]}};
  expect(deriveBallWorldFieldTerritoryWithPolesV145(q)).toMatchObject({territory:'fair',basis:'base_contact',moment:bag});
});
it('orders actual elapsed moments within the same recorded tick',()=>{
  const p=fixture(0,1.1,1);
  p.field.evidence.contacts.push({moment:moment(1.2,-2,-2,1,1),contacts:[{kind:'actor',playerId:'defender',role:'glove'}]});
  expect(deriveBallWorldFieldTerritoryWithPolesV145(p)).toMatchObject({territory:'fair',basis:'pole_contact',moment:{elapsedSeconds:1.1}});
});
it('blocks earlier unknown surfaces while later unknown surfaces cannot erase the pole decision',()=>{
  const p=fixture();p.field.evidence.contacts.unshift({moment:moment(.5),contacts:[{kind:'surface',surfaceId:'unknown-wall'}]});
  expect(deriveBallWorldFieldTerritoryWithPolesV145(p)).toMatchObject({kind:'unresolved',reason:'surface_policy_pending'});
  const q=fixture();q.field.evidence.contacts.push({moment:moment(2),contacts:[{kind:'surface',surfaceId:'unknown-wall'}]});
  expect(deriveBallWorldFieldTerritoryWithPolesV145(q)).toMatchObject({territory:'fair',basis:'pole_contact'});
});
it('keeps an unadopted physical pole pending and preserves simultaneous contacts',()=>{
  const p=fixture();p.policy.fairPoleSurfaceIds=['right-pole'];
  expect(deriveBallWorldFieldTerritoryWithPolesV145(p)).toMatchObject({kind:'unresolved',reason:'surface_policy_pending'});
  const q=fixture(),frame=q.field.evidence.contacts[0];
  q.field.evidence.contacts[0]={...frame,contacts:[...frame.contacts,{kind:'actor',playerId:'defender',role:'glove'}]};
  expect(deriveBallWorldFieldTerritoryWithPolesV145(q)).toMatchObject({kind:'unresolved',reason:'simultaneous_contact'});
});
it.each(['normal','continuing'] as const)('preserves %s physical ambiguity instead of manufacturing a fair decision',fault=>{
  const p=fixture();
  const poleContacts=fault==='normal'?[{...p.poleContacts[0],normal:null}]:[{...p.poleContacts[0],continuing:true as const}];
  expect(deriveBallWorldFieldTerritoryWithPolesV145({...p,poleContacts})).toMatchObject({kind:'unresolved',reason:'physical_contact_pending'});
});
it.each(['missing','duplicate','geometry','point','normal','clock','policy','reserved','injection'] as const)('rejects %s evidence or policy without skipping original validation',fault=>{
  const p=fixture();
  if(fault==='missing')p.poleContacts=[];
  if(fault==='duplicate')p.poleContacts.push(p.poleContacts[0]);
  if(fault==='geometry')p.poles=[{...p.poles[0],center:{x:20,z:0}},p.poles[1]];
  if(fault==='point')p.poleContacts[0].point=v(0,0,0);
  if(fault==='normal')p.poleContacts[0].normal=v(2,0,0);
  if(fault==='clock')p.poleContacts[0]={...p.poleContacts[0],moment:moment(1.2)};
  if(fault==='policy')p.policy.fairPoleSurfaceIds=['absent-pole'];
  if(fault==='reserved')p.poles=[{...p.poles[0],surfaceId:battedWorldBaseSurfaceId('first')},p.poles[1]];
  const raw=fault==='injection'?{...p,territory:'fair'}:p;
  expect(()=>deriveBallWorldFieldTerritoryWithPolesV145(raw)).toThrow();
});

it.each(['side','cap','rim'] as const)('accepts the unrounded actual nonlinear %s contact moment/point/normal',caseName=>{
  const pole:SourceFreeBallPoleV136={surfaceId:'actual-query-'+caseName,center:{x:caseName==='side'?1:0,z:0},minimumHeight:0,maximumHeight:3,radiusM:.1};
  const descriptor:SourceFreeBallDescriptorV2={kind:'aero_ground_continuous_source_kernel_v2',throughElapsedSeconds:.1,
    initial:{originTick:0,elapsedSeconds:0,ball:{tick:0,position:caseName==='side'?v(0,1,0):v(caseName==='rim'?.12:0,4,0),
      velocity:caseName==='side'?v(30,0,0):v(0,-30,0),spin:v(0,0,0)}},
    profile:{kind:'aero_ground_v1',air:{ticksPerSecond:1e6,integrationStepTicks:2000,gravityY:-9.81,aerodynamics:REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS},
      ground:{ticksPerSecond:1e6,gravityMps2:9.81,radiusM:.0366,inertiaRatio:.378,restingVerticalSpeedMps:.15,
        material:{restitution:.4,slidingFriction:.25,rollingDecelerationMps2:1,normalSpinDecayPerSecond:.5}}}};
  const world=querySourceFreeBallWorldWithPolesV136({poles:[pole],world:{descriptor,moment:descriptor.initial,side:'outgoing',
    throughElapsedSeconds:descriptor.throughElapsedSeconds,actors:[],surfaces:[]}});
  expect(world.kind).toBe('boundary');if(world.kind!=='boundary')throw Error('actual pole boundary required');
  expect(world.contacts).toHaveLength(1);const c=world.contacts[0];if(c.kind!=='surface')throw Error('actual pole surface required');
  const p=fixture(),query={...p,poles:[pole],policy:{...p.policy,fairPoleSurfaceIds:[pole.surfaceId]},
    field:{...p.field,evidence:{...p.field.evidence,ballRadiusMeters:descriptor.profile.ground.radiusM,horizon:world.moment,
      contacts:[{moment:world.moment,contacts:[{kind:'surface' as const,surfaceId:pole.surfaceId}]}]}},
    poleContacts:[{kind:'pole' as const,surfaceId:pole.surfaceId,moment:c.moment,point:c.point,normal:c.normal}]};
  expect(deriveBallWorldFieldTerritoryWithPolesV145(query)).toEqual({kind:'resolved',territory:'fair',basis:'pole_contact',surfaceId:pole.surfaceId,moment:world.moment});
});
