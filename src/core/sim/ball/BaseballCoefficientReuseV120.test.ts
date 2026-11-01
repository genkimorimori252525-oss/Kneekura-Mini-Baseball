import {expect,it} from 'vitest';
import {createAeroGroundBallPhysicsProfile} from './VersionedBattedBallPhysics';
import {REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS} from './BaseballAerodynamics';
import {resolveBaseballAerodynamicCoefficients as resolve} from './BaseballAerodynamicCoefficientProfile';
it('keeps owned compiled coefficients bit-identical to the generic validated table at knots, blends and out-of-range values',()=>{
 const physics=createAeroGroundBallPhysicsProfile({kind:'aero_ground_v1',air:{ticksPerSecond:1e6,integrationStepTicks:4000,gravityY:-9.81,aerodynamics:REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS},
  ground:{ticksPerSecond:1e6,gravityMps2:9.81,radiusM:.0366,inertiaRatio:.378,restingVerticalSpeedMps:.15,
   material:{restitution:.4,slidingFriction:.25,rollingDecelerationMps2:1,normalSpinDecayPerSecond:.5}}}),
  owned=physics.air.aerodynamics.coefficientProfile!,raw=structuredClone(owned),spins=[0,-0,.05,.1,.15,.15-1e-14,.15+1e-14,...Array.from({length:401},(_,i)=>i*.003)];
 for(const re of [0,1e4,1e5,144000,175000,2e5,250000,1e6,1e9])for(const s of spins){const a=resolve(owned,re,s),b=resolve(raw,re,s);
  expect(Object.is(a.dragCoefficient,b.dragCoefficient)).toBe(true);expect(Object.is(a.liftCoefficient,b.liftCoefficient)).toBe(true);}
 expect(()=>resolve(owned,NaN,.2)).toThrow();expect(()=>resolve(owned,1e5,-.1)).toThrow();
 const bad=structuredClone(raw);Object.assign(bad.spinKnots[1],{dragCoefficientAtReferenceRe:-1});expect(()=>resolve(bad,1e5,.2)).toThrow();
});
