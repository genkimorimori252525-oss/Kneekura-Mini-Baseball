import {expect,it} from 'vitest';
import {calculateBaseballAerodynamics,calculateOwnedBaseballFlightDerivativesV120,prepareOwnedBaseballAerodynamicsV98,
 REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS,REFERENCE_BASEBALL_AERODYNAMICS} from './BaseballAerodynamics';
import {calculateBaseballSpinDecayDerivative} from './BaseballSpinDecay';
import {IDENTITY_QUATERNION} from '../pitching/BaseballOrientation';
const freeze=<T>(v:T):T=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
it('owned intermediate stages preserve the full aerodynamic/torque operation graph including signed zero',()=>{
 for(const base of [REFERENCE_BASEBALL_AERODYNAMICS,REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS])
 for(const density of [0,1e-13,1e-12,1.225])for(const wind of [{x:0,y:-0,z:0},{x:3,y:-1,z:4}])
 for(const seam of [false,true]){
  const p=freeze({...structuredClone(base),airDensityKgM3:density,windVelocityMps:wind,
   ...(seam?{seamForce:{version:'baseball_seam_force_v1' as const,coefficientScale:.6}}:{})});
  prepareOwnedBaseballAerodynamicsV98(p);
  for(const velocity of [{x:0,y:-0,z:0},{x:1e-12,y:0,z:0},{x:3,y:-1,z:4},{x:30,y:-5,z:2},{x:-4,y:9,z:50}])
  for(const spin of [{x:-0,y:0,z:-0},{x:100,y:0,z:0},{x:0,y:300,z:-2},{x:200,y:-50,z:10}])
  for(const gravity of [-9.81,-0,0,9.81]){
   const q=seam?IDENTITY_QUATERNION:undefined,a=calculateBaseballAerodynamics(velocity,spin,p,q),
    decay=p.spinDecay?calculateBaseballSpinDecayDerivative(spin,{x:velocity.x-wind.x,y:velocity.y-wind.y,z:velocity.z-wind.z},p.spinDecay):{x:0,y:0,z:0},
    expected={velocity:{x:a.totalAcceleration.x,y:a.totalAcceleration.y+gravity,z:a.totalAcceleration.z},spin:decay},
    actual=calculateOwnedBaseballFlightDerivativesV120(velocity,spin,p,gravity,q);
   for(const kind of ['velocity','spin'] as const)for(const axis of ['x','y','z'] as const)
    expect(Object.is(actual[kind][axis],expected[kind][axis]),`${kind}.${axis}`).toBe(true);
  }
 }
});
it('does not grant raw or shallow-frozen input a numerical ownership exemption',()=>{
 const p={...REFERENCE_BASEBALL_AERODYNAMICS,windVelocityMps:{x:0,y:0,z:0}},v={x:0,y:0,z:1};
 expect(()=>calculateOwnedBaseballFlightDerivativesV120(v,v,p,-9.81)).toThrow('owned');
 expect(()=>prepareOwnedBaseballAerodynamicsV98(Object.freeze(p))).toThrow('deeply frozen');
 const seam=freeze({...REFERENCE_BASEBALL_AERODYNAMICS,airDensityKgM3:0,seamForce:{version:'baseball_seam_force_v1' as const,coefficientScale:1}});
 prepareOwnedBaseballAerodynamicsV98(seam);
 expect(()=>calculateOwnedBaseballFlightDerivativesV120(v,v,seam,-9.81)).toThrow('orientation');
});
