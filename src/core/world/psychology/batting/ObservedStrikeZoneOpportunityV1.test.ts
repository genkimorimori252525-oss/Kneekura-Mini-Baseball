import assert from 'node:assert/strict';
import { test } from 'vitest';
import { fixture,value } from './BattingFixtures.test-support';
import { assessObservedStrikeZoneOpportunityV1 } from './ObservedStrikeZoneOpportunityV1';
import { cloneInert } from '../../../adjudication/OfficialWindowPolicy';

function input(){
  const r=structuredClone(fixture()),p=r.source.predictions[1];
  return {evaluatedAtTick:r.currentFrame.time.tick,forecast:{observedTick:p.observedTick,availableTick:p.availableTick,validUntilTick:p.validUntilTick,trajectory:p.trajectory},
    plateZ:r.source.plateZ,strikeZone:r.source.strikeZone,ballRadiusM:r.source.ball.radiusM};
}
test('uses perceived zone crossing, including ball radius, without a hit-rate or ability bonus',()=>{
  const i=input(),before=structuredClone(i),a=value(assessObservedStrikeZoneOpportunityV1(i));
  assert.equal(a.reason,'predicted_zone_overlap');assert.equal(a.score,1);assert.deepEqual(i,before);
  assert.deepEqual(cloneInert(a),JSON.parse(JSON.stringify(a)));
  Object.assign(i.forecast.trajectory.start.position,{x:3});
  const b=value(assessObservedStrikeZoneOpportunityV1(i));assert.equal(b.reason,'predicted_outside_zone');assert.equal(b.score,0);
});
test('no future plate crossing does not manufacture an opportunity',()=>{
  const i=input();Object.assign(i.forecast.trajectory.start.velocity,{z:1});
  assert.deepEqual(value(assessObservedStrikeZoneOpportunityV1(i)),{algorithm:'observed_strike_zone_opportunity_v1',score:0,reason:'no_future_plate_crossing',crossing:null});
});
test('refuses future/expired samples, radius mismatch and caller-supplied actual flight or score',()=>{
  for(const edit of [(i:any)=>i.forecast.availableTick=i.evaluatedAtTick+1,(i:any)=>i.forecast.validUntilTick=i.evaluatedAtTick-1,
    (i:any)=>i.ballRadiusM*=2,(i:any)=>i.actualTrajectory=i.forecast.trajectory,(i:any)=>i.score=1]){
    const i=input();edit(i);assert.equal(assessObservedStrikeZoneOpportunityV1(i).ok,false);
  }
});
test('opportunity changes with an explicitly changed observer-known gravity prior',()=>{
  const i=input();Object.assign(i.forecast.trajectory.parameters,{gravityY:-100});
  assert.equal(value(assessObservedStrikeZoneOpportunityV1(i)).score,0);
});
