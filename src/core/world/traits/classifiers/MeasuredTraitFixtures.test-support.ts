import assert from 'node:assert/strict';
import type { TraitResult } from '../TraitTypes';
import type { MeasuredTraitRequest, ContactObservation, MeasurementRule } from './MeasuredTraitTypes';
export function value<T>(result: TraitResult<T>): T { if (!result.ok) assert.fail(JSON.stringify(result.reason)); return result.value; }
export const time = (day: number, sequence = 0) => ({ season: 2026, day, sequence });
export const scope = { careerId: 'career', playerId: 'player' };
export const velocity = (angleDeg: number) => ({ x: 0, y: 40 * Math.sin(angleDeg * Math.PI / 180), z: 40 * Math.cos(angleDeg * Math.PI / 180) });
export function contactFixture(angles = [15, 20, 25]): MeasuredTraitRequest {
  const observations: ContactObservation[] = angles.map((angle, i) => ({ scope: { ...scope }, episodeId: 'episode:' + i,
    eventId: 'event:' + i, time: time(i + 1), exitVelocityMps: velocity(angle) }));
  return { classificationId: 'classification', scope: { ...scope }, time: time(4),
    source: { careerId: 'career', subjectId: 'player', owner: 'BATTING_CONTACT', sourceKey: 'all-observed-contacts',
      revision: 1, snapshotId: 'snapshot:1', time: time(3) },
    model: { modelId: 'synthetic-only', version: '1', minimumEpisodes: 3, minimumDays: 2, windowDays: 10, maximumSourceAgeDays: 1,
      rule: { familyId: 'line_drive', lowerAngleDeg: 10, upperAngleDeg: 30, minimumFraction: 0.6 } }, observations };
}
export function withRule(r: MeasuredTraitRequest, rule: MeasurementRule, owner = r.source.owner): MeasuredTraitRequest {
  return { ...r, source: { ...r.source, owner }, model: { ...r.model, rule } };
}

export const rpm = (n: number) => n * Math.PI / 30;
const gyroRule: MeasurementRule = { familyId:'gyro_pitch_shape', minimumAxisAlignment:0.95, minimumSpinRpm:500,
  highSpinRpm:2500, minimumGyroFraction:0.6, minimumHighSpinGyroFraction:0.6 };
const releaseRule: MeasurementRule = {familyId:'release_miss_pattern',minimumMissM:0.1,minimumFailureFraction:0.25,
  minimumDirectionalConcentration:0.8,minimumFailedEpisodes:2};
export function spinFixture(spins=[1500,1500,1500]): MeasuredTraitRequest {
  const r=contactFixture();return {...r,time:time(spins.length+1),source:{...r.source,owner:'PITCH_TRAJECTORY',time:time(spins.length)},
    model:{...r.model,rule:gyroRule,windowDays:20},observations:spins.map((s,i)=>({scope,episodeId:'ep:'+i,eventId:'pitch:'+i,time:time(i+1),
      velocityMps:{x:0,y:0,z:-40},spinRadPerSecond:{x:0,y:0,z:rpm(s)}}))};
}
export function commandFixture(errors=[0.2,-0.2,0.2]): MeasuredTraitRequest {
  const r=contactFixture();return {...r,time:time(errors.length+1),source:{...r.source,owner:'PITCH_COMMAND',time:time(errors.length)},
    model:{...r.model,rule:{familyId:'command_instability',minimumDispersionM:0.1},windowDays:20},
    observations:errors.map((e,i)=>({scope,episodeId:'ep:'+i,eventId:'pitch:'+i,time:time(i+1),
      target:{horizontalM:i*0.3,verticalM:0.5},actual:{horizontalM:i*0.3+e,verticalM:0.5}}))};
}
export function releaseFixture(errors=[0.2,0.3,0.4]): MeasuredTraitRequest {
  const r=contactFixture();return {...r,time:time(errors.length+1),source:{...r.source,owner:'RELEASE_FAILURE',time:time(errors.length)},
    model:{...r.model,rule:releaseRule,windowDays:20},observations:errors.map((e,i)=>({scope,episodeId:'ep:'+i,eventId:'pitch:'+i,time:time(i+1),
      deliveryFailed:e!==0,releaseMissM:{horizontalM:e,verticalM:0}}))};
}
