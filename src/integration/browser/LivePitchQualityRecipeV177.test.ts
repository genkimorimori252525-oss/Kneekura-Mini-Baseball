import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Vec3 } from '../../core/model/geometry';
import type { SourceFreeBallDescriptorV2 } from '../../core/sim/ball/SourceFreeBallKernel';
import { createPitchBreakKireLevelsCasesV162 } from '../../../tools/verification/pitch-break-kire-levels-v162';
import { resolveLivePitchReleasePlanV168 } from './LivePitchReleasePlanV168';
import type { PitchSnapshotV78 } from './LivePitchAuthoringV78';
import { createLivePitchQualityReleasePlanV177, validateLivePitchQualityRequestV177,
  type LivePitchQualityRequestV177 } from './LivePitchQualityRecipeV177';

// Reuse the public authored reference as finite data; no kernel/flight is run.
const reference = JSON.parse(readFileSync(new URL('../../../docs/verification/realism-debug-20261027/pitch-break-low-spin-v158-01/measurement-reference.json', import.meta.url), 'utf8'))
  .sourceDescriptor as SourceFreeBallDescriptorV2;
const choices = [
  ['KIRE_CIRCLE', .04, 225], ['KIRE_DOUBLE_CIRCLE', .02, 0], ['THREATENING_DOUBLE_CIRCLE', .1, 270],
] as const;
const request = (qualityState:LivePitchQualityRequestV177['qualityState']='KIRE_CIRCLE'):LivePitchQualityRequestV177 => ({
  version:'live_pitch_quality_request_v177', qualityState,
});
const fixture = () => {
  const selected:PitchSnapshotV78 = { pitchId:'recipe-curve', name:'Recipe curve', pitchType:'curve',
    source:{kind:'preset',id:'curve',revision:1},releaseSpeedMps:34,
    spinRadPerSecond:{...reference.initial.ball.spin}, releaseOrientation:{...reference.materialOrientationAtStart!},
    seamForce:{...reference.profile.air.aerodynamics.seamForce!} };
  return {selected,request:request(),referenceReleaseVelocity:{...reference.initial.ball.velocity},
    windVelocityMps:{...reference.profile.air.aerodynamics.windVelocityMps},throws:'R' as const,
    effectiveSeamForce:{...reference.profile.air.aerodynamics.seamForce!},maximumPitchSpeedMps:34};
};
function assertMutable(value:unknown):void {
  if(value&&typeof value==='object'){expect(Object.isFrozen(value)).toBe(false);Object.values(value).forEach(assertMutable);}
}
function assertFrozen(value:unknown):void {
  if(value&&typeof value==='object'){expect(Object.isFrozen(value)).toBe(true);Object.values(value).forEach(assertFrozen);}
}
const polarMirror=(v:Vec3):Vec3=>({x:-v.x,y:v.y,z:v.z}),axialMirror=(v:Vec3):Vec3=>({x:v.x,y:-v.y,z:-v.z});

describe('V177 three-choice nominal release recipe',()=>{
  it.each(choices)('matches the existing pure V162 construction exactly for %s', (qualityState,spinScale,materialPhaseDegrees)=>{
    const input={...fixture(),request:request(qualityState)},before=structuredClone(input),
      expected=createPitchBreakKireLevelsCasesV162(reference).cases.find(row=>row.factors.spinScale===spinScale&&row.factors.materialPhaseDegrees===materialPhaseDegrees)!,
      result=createLivePitchQualityReleasePlanV177(input);
    expect(result.status).toBe('APPLIED');if(result.status!=='APPLIED')throw Error('expected finite authored recipe');
    expect(result.plan.nominal).toStrictEqual({spinRadPerSecond:expected.descriptor.initial.ball.spin,
      releaseOrientation:expected.descriptor.materialOrientationAtStart});
    expect(result.recipe).toMatchObject({version:'kire_release_recipe_v177',qualityState,spinScale,gyroDegrees:30,
      materialPhaseDegrees,gyroLongitudinalSign:1});
    const resolved=resolveLivePitchReleasePlanV168({selected:input.selected,request:result.plan,maximumPitchSpeedMps:34});
    expect(resolved.spinRadPerSecond).toStrictEqual(result.plan.nominal.spinRadPerSecond);
    expect(result.plan.expectedBase).toStrictEqual({releaseSpeedMps:input.selected.releaseSpeedMps,
      spinRadPerSecond:input.selected.spinRadPerSecond,releaseOrientation:input.selected.releaseOrientation,seamForce:input.selected.seamForce});
    expect(input).toStrictEqual(before);assertMutable(input);assertFrozen(result);
  });

  it('keeps raw nonidentity q/-q and signed zero for the zero-phase choice, without inventing an optional seam',()=>{
    for(const sign of [1,-1]){
      const input=fixture(),q={w:sign*.5*(1+2e-10),x:sign*-.5*(1+2e-10),y:sign*.5*(1+2e-10),z:sign*-.5*(1+2e-10)};
      input.selected={...input.selected,releaseOrientation:q,spinRadPerSecond:{x:60,y:-0,z:80}};
      delete (input.selected as {seamForce?:unknown}).seamForce;
      input.request=request('KIRE_DOUBLE_CIRCLE');const before=structuredClone(input),result=createLivePitchQualityReleasePlanV177(input);
      expect(result.status).toBe('APPLIED');if(result.status!=='APPLIED')throw Error('expected active environment seam');
      for(const key of ['w','x','y','z'] as const)expect(Object.is(result.plan.nominal.releaseOrientation[key],q[key])).toBe(true);
      expect(Object.is(result.plan.expectedBase.spinRadPerSecond.y,-0)).toBe(true);
      expect(Object.hasOwn(result.plan.expectedBase,'seamForce')).toBe(false);
      expect(result.plan.nominal.releaseOrientation).not.toBe(q);expect(input).toStrictEqual(before);assertMutable(input);
    }
  });

  it('uses the already mirrored left snapshot with the opposite longitudinal gyro sign',()=>{
    for(const [qualityState] of choices){
      const right=fixture(),q={w:.5,x:-.5,y:.5,z:-.5};right.selected={...right.selected,releaseOrientation:q};right.request=request(qualityState);
      const left={...structuredClone(right),throws:'L' as const,
        selected:{...structuredClone(right.selected),spinRadPerSecond:axialMirror(right.selected.spinRadPerSecond),
          releaseOrientation:{w:q.w,x:q.x,y:-q.y,z:-q.z}},
        referenceReleaseVelocity:polarMirror(right.referenceReleaseVelocity),windVelocityMps:polarMirror(right.windVelocityMps)},
        r=createLivePitchQualityReleasePlanV177(right),l=createLivePitchQualityReleasePlanV177(left);
      expect(r.status).toBe('APPLIED');expect(l.status).toBe('APPLIED');if(r.status!=='APPLIED'||l.status!=='APPLIED')throw Error('expected reflected recipes');
      const expected= axialMirror(r.plan.nominal.spinRadPerSecond),rq=r.plan.nominal.releaseOrientation,lq=l.plan.nominal.releaseOrientation;
      for(const key of ['x','y','z'] as const)expect(l.plan.nominal.spinRadPerSecond[key]).toBeCloseTo(expected[key],13);
      expect(l.recipe.gyroLongitudinalSign).toBe(-1);
      expect(lq.w).toBeCloseTo(rq.w,13);expect(lq.x).toBeCloseTo(rq.x,13);
      expect(lq.y).toBeCloseTo(-rq.y,13);expect(lq.z).toBeCloseTo(-rq.z,13);
    }
  });

  it('reports legal missing/degenerate inputs without inventing material, force or an axis',()=>{
    const noMaterial=fixture();delete (noMaterial.selected as {releaseOrientation?:unknown}).releaseOrientation;delete (noMaterial.selected as {seamForce?:unknown}).seamForce;
    const noSeam=fixture();delete (noSeam as {effectiveSeamForce?:unknown}).effectiveSeamForce;
    const inactive=fixture();inactive.selected={...inactive.selected,seamForce:{version:'baseball_seam_force_v1',coefficientScale:0}};
    inactive.effectiveSeamForce={version:'baseball_seam_force_v1',coefficientScale:0};
    const zeroSpin=fixture();zeroSpin.selected={...zeroSpin.selected,spinRadPerSecond:{x:0,y:0,z:0}};
    const zeroAir=fixture();zeroAir.referenceReleaseVelocity={...zeroAir.windVelocityMps};
    const parallel=fixture();parallel.referenceReleaseVelocity={x:0,y:0,z:-30};parallel.windVelocityMps={x:0,y:0,z:0};parallel.selected={...parallel.selected,spinRadPerSecond:{x:0,y:0,z:10}};
    const tiny=fixture();tiny.selected={...tiny.selected,spinRadPerSecond:{x:1e-14,y:0,z:0}};
    for(const [input,reason] of [[noMaterial,'MATERIAL_ORIENTATION_NOT_AUTHORED'],[noSeam,'EFFECTIVE_SEAM_NOT_ACTIVE'],
      [inactive,'EFFECTIVE_SEAM_NOT_ACTIVE'],[zeroSpin,'ZERO_SPIN'],[zeroAir,'ZERO_RELATIVE_AIR_SPEED'],
      [parallel,'TRANSVERSE_SPIN_BASIS_DEGENERATE'],[tiny,'MATERIAL_PHASE_AXIS_BELOW_NUMERIC_RESOLUTION']] as const){
      const before=structuredClone(input),result=createLivePitchQualityReleasePlanV177(input);
      expect(result).toStrictEqual({status:'NOT_APPLICABLE',reason,pitchId:input.selected.pitchId,
        qualityState:input.request.qualityState,recipeVersion:'kire_release_recipe_v177'});
      expect(Object.hasOwn(result,'plan')).toBe(false);expect(input).toStrictEqual(before);assertMutable(input);assertFrozen(result);
    }
  });

  it('validates exactly three request states and rejects fields, nonfinite vectors and invalid existing physical data',()=>{
    for(const [qualityState] of choices){const raw=request(qualityState),before=structuredClone(raw),validated=validateLivePitchQualityRequestV177(raw);
      expect(validated).toStrictEqual(raw);expect(validated).not.toBe(raw);assertFrozen(validated);expect(raw).toStrictEqual(before);assertMutable(raw);}
    for(const bad of [null,{}, {...request(),version:'other'}, {...request(),qualityState:'UNKNOWN'}, {...request(),timer:.3}, {...request(),effectScale:2}])
      expect(()=>validateLivePitchQualityRequestV177(bad)).toThrow();
    const good=fixture();
    for(const bad of [{...good,extra:1},{...good,throws:'?'},{...good,referenceReleaseVelocity:{x:NaN,y:0,z:0}},
      {...good,windVelocityMps:{x:0,y:Infinity,z:0}},{...good,windVelocityMps:{...good.windVelocityMps,extra:0}},
      {...good,effectiveSeamForce:undefined},{...good,effectiveSeamForce:{version:'baseball_seam_force_v1',coefficientScale:3}},
      {...good,selected:{...good.selected,releaseOrientation:{w:1,x:1,y:0,z:0}}},
      {...good,maximumPitchSpeedMps:33.9},{...good,request:{...request(),extra:0}}]){
      const before=structuredClone(bad);expect(()=>createLivePitchQualityReleasePlanV177(bad as never)).toThrow();
      expect(bad).toStrictEqual(before);assertMutable(bad);
    }
  });
});
