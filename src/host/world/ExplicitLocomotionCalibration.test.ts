import {beforeAll,afterAll,expect,it} from 'vitest';
import * as locomotion from './ActualLocomotion';
import {actualLocomotionFixture} from './ActualLocomotionFixtures.test-support';
import {createPlayerLocomotionCalibration,type PlayerLocomotionCalibration} from '../../core/sim/fielding/PlayerLocomotionCalibration';
import {actorHash as hash} from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
let f:ReturnType<typeof actualLocomotionFixture>,self:Parameters<typeof locomotion.deriveActualLocomotionReceipt>[2],legacy:ReturnType<typeof locomotion.deriveActualLocomotionReceipt>;
beforeAll(()=>{f=actualLocomotionFixture();self=f.locomotion.accept(f.locomotionSource.sourceId).receipt.self;legacy=locomotion.deriveActualLocomotionReceipt(f.decision,f.model,self);});afterAll(()=>f?.f.close());
type Calculation=(d:typeof f.decision,m:typeof f.model,s:typeof self,c:PlayerLocomotionCalibration)=>typeof legacy;
const calculate=()=>{const fn=(locomotion as unknown as {deriveActualLocomotionReceiptWithCalibration?:Calculation}).deriveActualLocomotionReceiptWithCalibration;
 expect(typeof fn,'EXPLICIT_LOCOMOTION_CALCULATION_MISSING').toBe('function');return fn!;};
/** Existing small Native motion fixture plus a separately declared numerical
 * alternative. This tests calculation, not a new accepted dispatch owner. */
it('CC07 explicit effective acceleration changes the Core motion calculation without changing the nominal model',()=>{
 const before=hash(f.model);expect(hash(legacy)).toBe('71772ccebc544667a4dc82a718dbd4cc7e33fb858257c061a182f69ed040e0fe');
 const nominal=f.model.source.calibration,effective=createPlayerLocomotionCalibration({...nominal,accelerationRatingCalibration:{lowestAbilityAccelerationMps2:1,highestAbilityAccelerationMps2:3}});
 const result=calculate()(f.decision,f.model,self,effective);
 expect(result.parameters.accelerationMps2).toBe(legacy.parameters.accelerationMps2/2);
 expect(result.segment.acceleration).not.toEqual(legacy.segment.acceleration);
 expect(hash(f.model)).toBe(before);expect(result.self).toEqual(legacy.self);expect(result.retainedRoles).toEqual(legacy.retainedRoles);
});
it('CC08 nominal locomotion wrapper retains exactly the original calculation result',()=>{
 expect(calculate()(f.decision,f.model,self,f.model.source.calibration)).toEqual(legacy);
});
