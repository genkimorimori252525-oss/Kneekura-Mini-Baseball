import type { SourceFreeBallDescriptorV2 } from '../../src/core/sim/ball/SourceFreeBallKernel';
import { resolveAerodynamicIntegrationStepTicksV1 } from '../../src/core/sim/pitching/AerodynamicPitchTrajectory';
import { createPitchBreakLowSpinCasesV158, measurePitchBreakLowSpinCaseV158, type PitchBreakLowSpinReferenceV158 } from './pitch-break-low-spin-v158';
import { createPitchBreakKireLevelsCasesV162 } from './pitch-break-kire-levels-v162';
export { analyzePitchBreakSkillCandidatesV167 } from './pitch-break-skill-candidate-v167';

function freeze<T>(value:T):T {
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;
}
export const PITCH_BREAK_KIRE_GYRO_PROTOCOL_V169=freeze({version:'pitch_break_kire_gyro_protocol_v169',
  authority:'BOUNDED_SOURCE_INPUT_CONSTRUCTION_NOT_SKILL_ADMISSION',spinScales:[.04,.08] as const,gyroDegrees:[0,60,85] as const,
  materialPhaseDegrees:[0,90,180,270] as const,templateSpinScale:.1,spinMultipliers:[.4,.8] as const,
  nominalIntegrationStepTicks:5000,materialOrientationMeaning:'EXACT_V158_TEMPLATE_QUATERNION_NO_RECOMPOSITION',skillAdmission:false});

/** Pure input construction. V158 supplies twelve existing axis/material
 * templates; only spin magnitude and the V162 nominal clock are replaced. */
export function createPitchBreakKireGyroCasesV169(raw:SourceFreeBallDescriptorV2,refinementFactor:1|2=1){
  // V162 validates the declared refinement and owns the unchanged profile.
  const control=createPitchBreakKireLevelsCasesV162(raw,refinementFactor),profile=control.cases[0].descriptor.profile,
    protocol=PITCH_BREAK_KIRE_GYRO_PROTOCOL_V169,templates=createPitchBreakLowSpinCasesV158(raw).cases.filter(item=>
      item.factors.spinScale===protocol.templateSpinScale&&protocol.gyroDegrees.some(gyro=>gyro===item.factors.gyroDegrees)),cases=[];
  for(const [index,spinScale] of protocol.spinScales.entries())for(const template of templates){
    const multiplier=protocol.spinMultipliers[index],original=template.descriptor,spin=original.initial.ball.spin,
      chosenSpin={x:spin.x*multiplier,y:spin.y*multiplier,z:spin.z*multiplier},
      factors={...template.factors,spinScale},
      descriptor:SourceFreeBallDescriptorV2={...original,initial:{...original.initial,ball:{...original.initial.ball,spin:chosenSpin}},profile};
    cases.push({id:`spin-${spinScale}_gyro-${factors.gyroDegrees}_phase-${factors.materialPhaseDegrees}`,factors,descriptor,
      effectiveIntegrationStepTicks:resolveAerodynamicIntegrationStepTicksV1(chosenSpin,profile.air)});
  }
  const effectiveSteps=new Set(cases.map(item=>item.effectiveIntegrationStepTicks)),clock={...control.clock,
    commonEffectiveIntegrationStepTicks:effectiveSteps.size===1?cases[0].effectiveIntegrationStepTicks:null,
    allCasesUseNominalStep:cases.every(item=>item.effectiveIntegrationStepTicks===control.clock.nominalIntegrationStepTicks)};
  return freeze({clock,cases});
}

export type PitchBreakKireGyroCaseV169=ReturnType<typeof createPitchBreakKireGyroCasesV169>['cases'][number];
export function measurePitchBreakKireGyroCaseV169(reference:PitchBreakLowSpinReferenceV158,item:PitchBreakKireGyroCaseV169,
  observationIntervals:160|640=160){
  return measurePitchBreakLowSpinCaseV158(reference,item,observationIntervals);
}
