import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { classifyMeasuredTrait } from './index';
import { contactFixture, value, withRule, time } from './MeasuredTraitFixtures.test-support';
import type { ContactObservation } from './MeasuredTraitTypes';
const pitcher = (angles: number[]) => withRule(contactFixture(angles), {
  familyId: 'pitcher_contact_distribution', groundUpperAngleDeg: 10, flyLowerAngleDeg: 30,
  minimumGroundFraction: 0.6, minimumFlyFraction: 0.6 }, 'PITCHING_CONTACT');
describe('measured contact distributions', () => {
  it('recognizes actual line-drive launch distribution without development or an effect', () => {
    const x = value(classifyMeasuredTrait(contactFixture()));
    assert.equal(x.status, 'READY'); assert.equal(x.assessment?.stateId, 'LINE_DRIVE');
    assert.equal(x.assessment?.changeKind, 'RECOGNITION'); assert.equal(Object.hasOwn(x, 'effect'), false);
    assert.equal(x.sampleCount, 3); assert.equal(x.episodeCount, 3);
  });
  it('confirms absence only with sufficient observed launch evidence', () => {
    const x = value(classifyMeasuredTrait(contactFixture([-20, 50, 80])));
    assert.equal(x.status, 'READY'); assert.equal(x.assessment?.stateId, null);
  });
  for (const [angles, state] of [[[-10,0,0],'GROUND_BALL'],[[45,60,80],'FLY_BALL'],[[-10,20,50],null]] as const)
    it('classifies pitcher distribution ' + state, () => assert.equal(value(classifyMeasuredTrait(pitcher([...angles]))).assessment?.stateId, state));
  it('uses Y-up rather than world Z as height', () => {
    const r = contactFixture(); const observations = r.observations.map(o => ({ ...o, exitVelocityMps: { x: 30, y: 0, z: 30 } }));
    assert.equal(value(classifyMeasuredTrait({ ...r, observations })).assessment?.stateId, null);
  });
  it('is invariant under horizontal rotation and speed rescaling', () => {
    const r = contactFixture(); const observations = (r.observations as readonly ContactObservation[]).map(o => ({ ...o,
      exitVelocityMps: { x: o.exitVelocityMps.z * 0.5, y: o.exitVelocityMps.y * 0.5, z: 0 } }));
    assert.equal(value(classifyMeasuredTrait({ ...r, observations })).assessment?.stateId, 'LINE_DRIVE');
  });
  it('handles straight-up and straight-down velocities', () => {
    const r = pitcher([90,90,90]); assert.equal(value(classifyMeasuredTrait(r)).assessment?.stateId, 'FLY_BALL');
    assert.equal(value(classifyMeasuredTrait(pitcher([-90,-90,-90]))).assessment?.stateId, 'GROUND_BALL');
  });
  it('honors explicit classification thresholds instead of a built-in standard', () => {
    const r = contactFixture([15,20,60]);
    assert.equal(value(classifyMeasuredTrait(r)).assessment?.stateId, 'LINE_DRIVE');
    const strict = withRule(r, { familyId: 'line_drive', lowerAngleDeg: 10, upperAngleDeg: 30, minimumFraction: 0.9 });
    assert.equal(value(classifyMeasuredTrait(strict)).assessment?.stateId, null);
  });
  it('returns no assessment for empty evidence', () => {
    const x = value(classifyMeasuredTrait({ ...contactFixture(), observations: [] }));
    assert.equal(x.status, 'UNAVAILABLE'); assert.equal(x.assessment, null);
    assert.deepEqual(x.reasons, ['INSUFFICIENT_EVIDENCE']);
  });
  it('does not count several events of one episode as repeated practice', () => {
    const r = contactFixture(); const observations = r.observations.map(o => ({ ...o, episodeId: 'same' }));
    const x = value(classifyMeasuredTrait({ ...r, observations }));
    assert.equal(x.episodeCount, 1); assert.equal(x.status, 'UNAVAILABLE');
  });
  it('does not count repeated same-day events as multiple days', () => {
    const r = contactFixture(); const observations = r.observations.map((o,i) => ({ ...o,time:time(3,i) }));
    const x = value(classifyMeasuredTrait({ ...r,source:{ ...r.source,time:time(3,3) },observations }));
    assert.equal(x.status, 'UNAVAILABLE'); assert.equal(x.evidenceSpanDays, 0);
  });
  it('does not turn a stale snapshot into confirmed absence', () => {
    const x = value(classifyMeasuredTrait({ ...contactFixture(),time:time(5) }));
    assert.equal(x.status, 'UNAVAILABLE'); assert.equal(x.assessment,null); assert.ok(x.reasons.includes('STALE_SOURCE'));
  });
  it('selects only observations in the configured trailing window', () => {
    const r = contactFixture(); const x = value(classifyMeasuredTrait({ ...r,time:time(4),model:{ ...r.model,windowDays:3 } }));
    assert.equal(x.sampleCount,2); assert.equal(x.status,'UNAVAILABLE');
  });
  it('accepts source age at the inclusive boundary', () => assert.equal(value(classifyMeasuredTrait(contactFixture())).status,'READY'));
  it('retains deterministic sorted evidence under input permutations', () => {
    const r=contactFixture();assert.deepEqual(value(classifyMeasuredTrait(r)), value(classifyMeasuredTrait({ ...r,observations:[...r.observations].reverse() })));
  });
  it('groups episode event IDs instead of inventing events', () => {
    const r=contactFixture([20,20,20,20]); const observations=r.observations.map((o,i)=>({ ...o,time:time(Math.min(i+1,3),i),episodeId:'episode:'+Math.min(i,2) }));
    const x=value(classifyMeasuredTrait({ ...r,source:{ ...r.source,time:time(3,4) },observations }));
    assert.equal(x.assessment?.episodes.length,3); assert.deepEqual(x.assessment?.episodes[2]?.eventIds,['event:2','event:3']);
  });
  it('returns detached frozen data without mutating inputs', () => {
    const r=contactFixture(), before=JSON.stringify(r), x=value(classifyMeasuredTrait(r));
    assert.equal(JSON.stringify(r),before);assert.notEqual(x.request,r);assert.ok(Object.isFrozen(x.request.observations));
    assert.ok(!Object.isFrozen(r));assert.ok(Object.isFrozen(x.assessment?.bindings));
  });
});
