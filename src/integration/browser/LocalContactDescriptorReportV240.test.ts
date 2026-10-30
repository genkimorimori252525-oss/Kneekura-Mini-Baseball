import { describe,it,expect } from 'vitest';
import { createLocalContactDescriptorReportV240, appendAcceptedContactV240, readLocalSavedContactDescriptorReportV240, withLocalContactDescriptorRuleV240 } from './LocalContactDescriptorReportV240';
import type { LiveIssuedPitchV1 } from './LiveBaseballMatchV1';
const pitch=(velocity={x:1,y:1,z:0})=>({batterPlayerId:'p',play:{contact:{},contactMoment:{ball:{tick:7}},outgoingBallMoment:{ball:{velocity}}}} as unknown as LiveIssuedPitchV1);
const binding={sessionId:'s',configId:'c',buildId:'b',playerId:'p'};
describe('local contact report',()=>{it('counts accepted contacts once and preserves state on conflict',()=>{
 const base=createLocalContactDescriptorReportV240(binding,{reference:'r',lowerAngleDeg:0,upperAngleDeg:90,minimumFraction:1});
 const a=appendAcceptedContactV240(base,{pitch:pitch(),pitchOrdinal:1,playId:'a'});
 expect(a.report.summary).toMatchObject({count:1,fraction:1,status:'ASSESSED'});
 expect(appendAcceptedContactV240(a.report,{pitch:pitch(),pitchOrdinal:1,playId:'a'}).status).toBe('DUPLICATE');
 const conflict=appendAcceptedContactV240(a.report,{pitch:pitch({x:2,y:1,z:0}),pitchOrdinal:1,playId:'a'});
 expect(conflict.status).toBe('CONFLICT');expect(conflict.report).toBe(a.report);
});it('does not count no-contact and keeps absent rule unassessed',()=>{
 const base=createLocalContactDescriptorReportV240(binding,null);
 const no={batterPlayerId:'p',play:{contact:null,contactMoment:null,outgoingBallMoment:null}} as unknown as LiveIssuedPitchV1;
 expect(appendAcceptedContactV240(base,{pitch:no,pitchOrdinal:1,playId:'a'}).report.summary.status).toBe('UNASSESSED');
});});

it('labels imported records as self-reported and rejects foreign players',()=>{
 const base=createLocalContactDescriptorReportV240(binding,null);
 const saved=readLocalSavedContactDescriptorReportV240(appendAcceptedContactV240(base,{pitch:pitch(),pitchOrdinal:1,playId:'a'}).report);
 expect(saved.scope).toBe('LOCAL_SAVED_DEBUG');
 expect(()=>appendAcceptedContactV240(saved,{pitch:pitch(),pitchOrdinal:2,playId:'b'})).toThrow();
 expect(()=>readLocalSavedContactDescriptorReportV240({...saved,contacts:[{...saved.contacts[0],playerId:'other'}]})).toThrow();
});

it('rejects changed playId at the same ordinal',()=>{
 const base=createLocalContactDescriptorReportV240(binding,null);
 const a=appendAcceptedContactV240(base,{pitch:pitch(),pitchOrdinal:1,playId:'a'}).report;
 expect(appendAcceptedContactV240(a,{pitch:pitch(),pitchOrdinal:1,playId:'b'}).status).toBe('CONFLICT');
 expect(()=>readLocalSavedContactDescriptorReportV240({...a,contacts:[a.contacts[0],{...a.contacts[0],playId:'b'}]})).toThrow();
});

it('reassesses the same contact with an explicit rule and clears it atomically',()=>{
 const base=appendAcceptedContactV240(createLocalContactDescriptorReportV240(binding,null),{pitch:pitch(),pitchOrdinal:1,playId:'a'}).report;
 const rule={reference:'test-only',lowerAngleDeg:0,upperAngleDeg:60,minimumFraction:1};
 const assessed=withLocalContactDescriptorRuleV240(base,rule);expect(assessed.summary).toMatchObject({status:'ASSESSED',count:1,fraction:1,matched:true});
 expect(withLocalContactDescriptorRuleV240(assessed,null).summary.status).toBe('UNASSESSED');
 expect(()=>withLocalContactDescriptorRuleV240(assessed,{...rule,upperAngleDeg:-1})).toThrow();expect(assessed.rule).toEqual(rule);
 expect(withLocalContactDescriptorRuleV240(readLocalSavedContactDescriptorReportV240(assessed),rule).scope).toBe('LOCAL_SAVED_DEBUG');
});

it('rejects malformed and missing saved rule instead of silently treating it as null',()=>{
 const base=createLocalContactDescriptorReportV240(binding,null);
 for(const rule of [false,0,undefined,{reference:123,lowerAngleDeg:0,upperAngleDeg:45,minimumFraction:.5},{reference:'x',lowerAngleDeg:0,upperAngleDeg:45,minimumFraction:.5,extra:true}]){
  expect(()=>readLocalSavedContactDescriptorReportV240({...base,rule})).toThrow();
 }
 expect(readLocalSavedContactDescriptorReportV240({...base,rule:null}).rule).toBe(null);
 expect(readLocalSavedContactDescriptorReportV240({...base,rule:{reference:'explicit',lowerAngleDeg:0,upperAngleDeg:45,minimumFraction:.5}}).rule?.reference).toBe('explicit');
});
