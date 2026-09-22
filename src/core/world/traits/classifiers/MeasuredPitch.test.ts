import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { classifyMeasuredTrait } from './index';
import { value, spinFixture, commandFixture, releaseFixture, rpm } from './MeasuredTraitFixtures.test-support';
const metric=(r:ReturnType<typeof classifyMeasuredTrait>,key:string)=>value(r).metrics.find(m=>m.key===key)?.value;
describe('measured spin and pitching descriptors',()=>{
  it('recognizes gyro from spin/velocity axes',()=>assert.equal(value(classifyMeasuredTrait(spinFixture())).assessment?.stateId,'GYRO'));
  it('recognizes high spin only on the same gyro observations',()=>assert.equal(value(classifyMeasuredTrait(spinFixture([3000,3000,3000]))).assessment?.stateId,'HIGH_SPIN_GYRO'));
  it('is independent of spin direction sign',()=>assert.equal(value(classifyMeasuredTrait(spinFixture([-1500,-1500,-1500]))).assessment?.stateId,'GYRO'));
  it('zero spin is not gyro',()=>assert.equal(value(classifyMeasuredTrait(spinFixture([0,0,0]))).assessment?.stateId,null));
  it('transverse high spin is not high-spin gyro',()=>{
    const r=spinFixture();const observations=r.observations.map(o=>({...o,spinRadPerSecond:{x:rpm(5000),y:0,z:0}}));
    assert.equal(value(classifyMeasuredTrait({...r,observations})).assessment?.stateId,null);
  });
  it('does not combine low-spin gyro and unrelated high-spin transverse pitches',()=>{
    const r=spinFixture([1500,1500,9000]);const observations=r.observations.map((o,i)=>i===2?{...o,spinRadPerSecond:{x:rpm(9000),y:0,z:0}}:o);
    const x=value(classifyMeasuredTrait({...r,observations}));assert.equal(x.assessment?.stateId,'GYRO');
    assert.equal(x.metrics.find(m=>m.key==='highSpinGyroFraction')?.value,0);
  });
  it('converts radians per second to rpm',()=>assert.ok(Math.abs(metric(classifyMeasuredTrait(spinFixture()),'meanSpinRpm')!-1500)<1e-9));
  it('keeps high-spin and normal gyro mutually exclusive',()=>{
    const x=value(classifyMeasuredTrait(spinFixture([3000,3000,3000])));assert.equal(x.assessment?.stateId,'HIGH_SPIN_GYRO');
    assert.equal(Array.isArray(x.assessment?.stateId),false);
  });
  it('does not use absolute actual pitch position as command variance',()=>{
    const x=value(classifyMeasuredTrait(commandFixture([0,0,0])));assert.equal(x.assessment?.stateId,null);
    assert.equal(x.metrics.find(m=>m.key==='dispersionM')?.value,0);
  });
  it('separates stable aim bias from random dispersion',()=>{
    const r=commandFixture([0.5,0.5,0.5]),x=value(classifyMeasuredTrait(r));assert.equal(x.assessment?.stateId,null);
    assert.ok(Math.abs(metric(classifyMeasuredTrait(r),'biasMagnitudeM')!-0.5)<1e-10);
  });
  it('recognizes unstable target-relative errors',()=>assert.equal(value(classifyMeasuredTrait(commandFixture())).assessment?.stateId,'UNSTABLE'));
  it('reports centered population dispersion rather than RMS total error',()=>{
    const x=metric(classifyMeasuredTrait(commandFixture([0.2,-0.2,0.2])),'dispersionM')!;
    assert.ok(Math.abs(x-Math.sqrt(8/225))<1e-12);
  });
  it('includes vertical command error',()=>{
    const r=commandFixture();const observations=r.observations.map((o,i)=>({...o,target:{horizontalM:0,verticalM:0.5},actual:{horizontalM:0,verticalM:i===1?0.2:0.8}}));
    assert.equal(value(classifyMeasuredTrait({...r,observations})).assessment?.stateId,'UNSTABLE');
  });
  it('recognizes repeated directional delivery failures',()=>assert.equal(value(classifyMeasuredTrait(releaseFixture())).assessment?.stateId,'DIRECTIONAL_MISS'));
  it('does not call balanced opposite directions a directional failure pattern',()=>assert.equal(value(classifyMeasuredTrait(releaseFixture([0.3,-0.3,0.3,-0.3]))).assessment?.stateId,null));
  it('confirms absence when enough deliveries are explicitly failure-free',()=>{
    const x=value(classifyMeasuredTrait(releaseFixture([0,0,0])));assert.equal(x.status,'READY');assert.equal(x.assessment?.stateId,null);
  });
  it('does not count a tiny failure as a directional miss above the threshold',()=>assert.equal(value(classifyMeasuredTrait(releaseFixture([0.01,0.01,0.01]))).assessment?.stateId,null));
  it('does not recognize a rare failure below the fraction threshold',()=>assert.equal(value(classifyMeasuredTrait(releaseFixture([0,0,0,0,0.3]))).assessment?.stateId,null));
  it('returns unavailable instead of absence for a high-rate but unconfirmed single failure episode',()=>{
    const x=value(classifyMeasuredTrait(releaseFixture([0,0,0.3])));assert.equal(x.status,'UNAVAILABLE');assert.equal(x.assessment,null);
    assert.deepEqual(x.reasons,['INSUFFICIENT_FAILURE_EPISODES']);
  });
  it('counts distinct failure episodes, not the number of failed pitches',()=>{
    const r=releaseFixture([0,0.3,0.3,0.3]),observations=r.observations.map((o,i)=>({...o,episodeId:i===0?'ok':'same-failure'}));
    const x=value(classifyMeasuredTrait({...r,model:{...r.model,minimumEpisodes:2},observations}));
    assert.equal(x.status,'UNAVAILABLE');assert.deepEqual(x.reasons,['INSUFFICIENT_FAILURE_EPISODES']);
  });
  it('uses unit directions, not the largest failure vector as an extra vote',()=>{
    const x=value(classifyMeasuredTrait(releaseFixture([100,-0.2,-0.2])));assert.equal(x.assessment?.stateId,null);
    assert.ok(Math.abs(x.metrics.find(m=>m.key==='directionalConcentration')!.value-1/3)<1e-12);
  });
  it('does not manufacture a successful-delivery miss vector',()=>{
    const r=releaseFixture(),observations=r.observations.map(o=>({...o,deliveryFailed:false}));
    const x=classifyMeasuredTrait({...r,observations});assert.equal(x.ok,false);if(!x.ok)assert.equal(x.reason.code,'SOURCE_CONFLICT');
  });
});
