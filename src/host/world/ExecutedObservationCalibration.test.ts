import { beforeAll,afterAll,expect,it } from 'vitest';
import * as observation from './ExecutedFieldObservation';
import { playerObservationModelFixture } from './PlayerObservationModelFixtures.test-support';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { createPlayerObservationCalibration,type PlayerObservationCalibration } from '../../core/sim/perception/PlayerObservationCalibration';
import type { AcceptedActualFieldObservation } from './ActualFieldObservation';
let f:ReturnType<typeof playerObservationModelFixture>,model:ReturnType<ReturnType<typeof playerObservationModelFixture>['models']['accept']>;
beforeAll(()=>{f=playerObservationModelFixture();model=f.models.accept(f.source.sourceId);});afterAll(()=>f?.close());
const source:AcceptedActualFieldObservation={sourceId:'fixture-calculated-observation',sourceVersion:'fixture-only-calculation-v1',physicalPitchSourceId:'fixture-pitch',playerId:'player-a',
  baseFieldSourceId:'fixture-field',executionSourceId:null,observationModelSourceId:'observation-a',previousObservationSourceId:null,
  view:{poseVersion:'fixture-pose',bodyRelativeEyeOffset:{x:0,y:3,z:0},forward:{x:0,y:0,z:1},attentionTarget:{kind:'ball'}}};
const basis:Parameters<typeof observation.sampleExecutedFieldObservation>[1]={at:{originTick:0,elapsedSeconds:0,tick:0},ticksPerSecond:1000,matchSeed:19,playId:1,playerIds:['player-a'],
  actors:[{playerId:'player-a',primitive:{role:'body',radius:0.5,startTick:0,endTick:1000,ticksPerSecond:1000,startCenter:{x:0,y:0,z:0},startVelocity:{x:0,y:0,z:0},acceleration:{x:0,y:0,z:0}}}],surfaces:[],bases:[],
  ballMoment:{originTick:0,elapsedSeconds:0,ball:{tick:0,position:{x:0,y:3,z:10},velocity:{x:0,y:0,z:-1},spin:{x:0,y:0,z:0}}}};
type Calculation=(s:AcceptedActualFieldObservation,b:typeof basis,c:PlayerObservationCalibration,p:Parameters<typeof observation.sampleExecutedFieldObservation>[3])=>ReturnType<typeof observation.sampleExecutedFieldObservation>;
const calculate=()=>{const fn=(observation as unknown as {sampleExecutedFieldObservationWithCalibration?:Calculation}).sampleExecutedFieldObservationWithCalibration;
  expect(typeof fn,'EXPLICIT_OBSERVATION_CALCULATION_MISSING').toBe('function');return fn!;};
/** Pure synthetic executed geometry plus a real small nominal-model owner.
 * These values are explicit fixture declarations, never fatigue measurements,
 * an accepted dispatch calibration, or Native physical/consumer qualification. */
it('CC01 explicit effective observation values change real sampling while the nominal owner stays unchanged',()=>{
  const before=hash(model),legacy=observation.sampleExecutedFieldObservation(source,basis,model,null);
  // Captured on unchanged sampler code in the intended missing-entry-point RED.
  expect(hash(legacy)).toBe('c85c2e45a3faec862d8a9e8e9cce7a864f8e65968d0aa17f3ade26e91d87206c');
  const effective=createPlayerObservationCalibration({...model.source.calibration,errorParameters:{minimumDetectionQuality:0,minimumPositionErrorMeters:0,maximumPositionErrorMeters:0,minimumVelocityErrorMps:0,maximumVelocityErrorMps:0}});
  const result=calculate()(source,basis,effective,null);
  expect(result.samples.ball!.sample.estimate).toEqual({position:basis.ballMoment!.ball.position,velocity:basis.ballMoment!.ball.velocity});
  expect(result.samples.ball!.sample.estimate).not.toEqual(legacy.samples.ball!.sample.estimate);
  expect(hash(model)).toBe(before);expect(f.models.read(model.source.sourceId)).toEqual(model);
});
it('CC02 the original observation wrapper retains identical receipt bytes with its original calibration',()=>{
  const legacy=observation.sampleExecutedFieldObservation(source,basis,model,null);
  expect(calculate()(source,basis,model.source.calibration,null)).toEqual(legacy);
});
it('CC03 an explicit malformed observation calibration rejects before sampling',()=>{
  expect(()=>calculate()(source,basis,{...model.source.calibration,perceptionAbility:2},null)).toThrow(/observation calibration/);
});
