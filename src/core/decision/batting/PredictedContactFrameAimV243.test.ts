import {describe,it,expect} from 'vitest';
import {createPredictedContactFrameCandidatesV243,selectPredictedContactFrameCandidateV243} from './PredictedContactFrameAimV243';
const v=(x:number,y:number,z:number)=>({x,y,z});
describe('bounded contact-frame policy',()=>{
 it('generates fixed tangent 3D candidates and preserves the 2cm limit',()=>{
  const r=createPredictedContactFrameCandidatesV243({normal:v(0,1,1),normalExitVelocity:v(0,0,1),bats:'R',technique:'HOOK'});expect(r.status).toBe('READY');if(r.status!=='READY')return;
  expect(r.candidates).toHaveLength(25);expect(r.candidates.some(c=>Math.abs(c.delta.z)>1e-5)).toBe(true);
  for(const c of r.candidates){expect(Math.hypot(c.delta.x,c.delta.y,c.delta.z)).toBeLessThanOrEqual(.020000000001);expect(Math.abs(c.delta.x*r.normal.x+c.delta.y*r.normal.y+c.delta.z*r.normal.z)).toBeLessThan(1e-12)}
 });
 it.each([['BACKSPIN','R',v(-1,0,0)],['TOPSPIN','L',v(1,0,0)],['HOOK','R',v(0,-1,0)],['HOOK','L',v(0,1,0)],['SLICE','R',v(0,1,0)],['SLICE','L',v(0,-1,0)]] as const)('maps %s %s through flight basis',(technique,bats,axis)=>{
  const r=createPredictedContactFrameCandidatesV243({normal:v(0,0,1),normalExitVelocity:v(0,0,1),bats,technique});expect(r.status).toBe('READY');if(r.status==='READY')expect(r.targetSpinAxis).toEqual(axis);
 });
 it('rejects degenerate normal, target axis and flight frame',()=>{
  expect(createPredictedContactFrameCandidatesV243({normal:v(0,0,0),normalExitVelocity:v(0,0,1),bats:'R',technique:'TOPSPIN'}).status).toBe('NO_TARGET');
  expect(createPredictedContactFrameCandidatesV243({normal:v(0,0,1),normalExitVelocity:v(0,1,0),bats:'R',technique:'TOPSPIN'}).status).toBe('NO_TARGET');
  expect(createPredictedContactFrameCandidatesV243({normal:v(1,0,0),normalExitVelocity:v(0,0,1),bats:'R',technique:'TOPSPIN'}).status).toBe('NO_TARGET');
 });
 it('ranks by signed requested component, then norm and ordinal',()=>{
  const input={normalComponent:2,minimumComponent:3,minimumImprovement:1,candidates:[{ordinal:3,norm:.02,component:5},{ordinal:2,norm:.01,component:5},{ordinal:1,norm:.01,component:5},{ordinal:0,norm:0,component:2}]};
  expect(selectPredictedContactFrameCandidateV243(input)?.ordinal).toBe(1);
 });
});

it('uses the rotated flight basis rather than fixed world axes',()=>{
 const result=createPredictedContactFrameCandidatesV243({normal:{x:0,y:1,z:0},normalExitVelocity:{x:1,y:0,z:0},bats:'R',technique:'BACKSPIN'});
 expect(result.status).toBe('READY');if(result.status==='READY')expect(result.targetSpinAxis).toEqual({x:0,y:0,z:1});
});
