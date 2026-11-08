import { readFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import { resolveAerodynamicIntegrationStepTicksV1 } from '../../src/core/sim/pitching/AerodynamicPitchTrajectory';
import * as lowSpin from './pitch-break-low-spin-v158';
import { createPitchBreakKireLevelsCasesV162 } from './pitch-break-kire-levels-v162';
import { analyzePitchBreakSkillCandidatesV167 as existingAnalysis } from './pitch-break-skill-candidate-v167';
import { createPitchBreakKireGyroCasesV169, measurePitchBreakKireGyroCaseV169,
  analyzePitchBreakSkillCandidatesV167 } from './pitch-break-kire-gyro-domain-v169';

// Pure input construction and archived metadata only; no flight is evaluated.
const reference=JSON.parse(readFileSync(new URL('../../docs/verification/realism-debug-20261027/pitch-break-low-spin-v158-01/measurement-reference.json',import.meta.url),'utf8')) as lowSpin.PitchBreakLowSpinReferenceV158,
  oldCases=JSON.parse(readFileSync(new URL('../../docs/verification/realism-debug-20261027/kire-saved-onset-v165-01/cases.json',import.meta.url),'utf8')) as
    {id:string;comparison:lowSpin.PitchBreakLowSpinComparisonV158}[],
  templates=lowSpin.createPitchBreakLowSpinCasesV158(reference.sourceDescriptor).cases.filter(item=>item.factors.spinScale===.1&&item.factors.gyroDegrees!==30);
afterEach(()=>vi.restoreAllMocks());

it('generates exactly the twenty-four predeclared controls with no gyro30 or archived-case overlap',()=>{
  const generated=createPitchBreakKireGyroCasesV169(reference.sourceDescriptor),expected=new Set<string>();
  for(const spinScale of [.04,.08])for(const gyroDegrees of [0,60,85])for(const materialPhaseDegrees of [0,90,180,270])
    expected.add(`spin-${spinScale}_gyro-${gyroDegrees}_phase-${materialPhaseDegrees}`);
  expect(templates).toHaveLength(12);expect(generated.cases).toHaveLength(24);
  expect(new Set(generated.cases.map(item=>item.id))).toStrictEqual(expected);expect(oldCases).toHaveLength(56);
  const oldIds=new Set(oldCases.map(item=>item.id));
  expect(generated.cases.every(item=>item.factors.gyroDegrees!==30&&!oldIds.has(item.id))).toBe(true);
  expect(oldCases.every(item=>item.comparison.factors.gyroDegrees===30)).toBe(true);
});

it('scales only the existing .1 template spin by .4 or .8 and preserves its release, material and physical coefficients',()=>{
  const original=reference.sourceDescriptor,profile=createPitchBreakKireLevelsCasesV162(original).cases[0].descriptor.profile;
  for(const item of createPitchBreakKireGyroCasesV169(original).cases){
    const template=templates.find(row=>row.factors.gyroDegrees===item.factors.gyroDegrees&&row.factors.materialPhaseDegrees===item.factors.materialPhaseDegrees)!,
      multiplier=item.factors.spinScale===.04?.4:.8,spin=template.descriptor.initial.ball.spin,
      expectedSpin={x:spin.x*multiplier,y:spin.y*multiplier,z:spin.z*multiplier};
    expect(item.descriptor).toStrictEqual({...template.descriptor,
      initial:{...template.descriptor.initial,ball:{...template.descriptor.initial.ball,spin:expectedSpin}},profile});
    expect(item.descriptor.initial.ball.position).toStrictEqual(original.initial.ball.position);
    expect(item.descriptor.initial.ball.velocity).toStrictEqual(original.initial.ball.velocity);
    expect(item.descriptor.profile).toStrictEqual(original.profile);
    expect(item.descriptor.throughElapsedSeconds).toBe(original.throughElapsedSeconds);
  }
});

it('preserves each old quaternion raw component including a saved negative quaternion and signed zero',()=>{
  const descriptor={...reference.sourceDescriptor,materialOrientationAtStart:{w:-1,x:-0,y:-0,z:-0}},before=structuredClone(descriptor),
    saved=lowSpin.createPitchBreakLowSpinCasesV158(descriptor).cases.filter(item=>item.factors.spinScale===.1&&item.factors.gyroDegrees!==30);
  for(const item of createPitchBreakKireGyroCasesV169(descriptor).cases){
    const q=item.descriptor.materialOrientationAtStart!,expected=saved.find(row=>row.factors.gyroDegrees===item.factors.gyroDegrees&&
      row.factors.materialPhaseDegrees===item.factors.materialPhaseDegrees)!.descriptor.materialOrientationAtStart!;
    for(const component of ['w','x','y','z'] as const)expect(Object.is(q[component],expected[component])).toBe(true);
    if(item.factors.materialPhaseDegrees===0){expect(q.w).toBe(-1);expect(Object.is(q.x,-0)).toBe(true);}
  }
  expect(descriptor).toStrictEqual(before);expect(Object.isFrozen(descriptor.materialOrientationAtStart)).toBe(false);
});

it('uses nominal 5000 ticks and reports the actual Source step on every case without carrying the old 1083 clock',()=>{
  const generated=createPitchBreakKireGyroCasesV169(reference.sourceDescriptor);
  expect(generated.clock.originalEffectiveIntegrationStepTicks).toBe(1083);expect(generated.clock.nominalIntegrationStepTicks).toBe(5000);
  expect(generated.clock.commonEffectiveIntegrationStepTicks).toBe(5000);expect(generated.clock.allCasesUseNominalStep).toBe(true);
  for(const item of generated.cases){
    expect(item.descriptor.profile.air.integrationStepTicks).toBe(5000);
    expect(item.effectiveIntegrationStepTicks).toBe(resolveAerodynamicIntegrationStepTicksV1(item.descriptor.initial.ball.spin,item.descriptor.profile.air));
  }
});

it('isolates half-step refinement to the shared 2500 profile and per-case effective-step diagnostics',()=>{
  const original=reference.sourceDescriptor,nominal=createPitchBreakKireGyroCasesV169(original),half=createPitchBreakKireGyroCasesV169(original,2);
  expect(half.cases).toHaveLength(24);expect(half.clock.nominalIntegrationStepTicks).toBe(2500);
  expect(half.clock.commonEffectiveIntegrationStepTicks).toBe(2500);
  for(const [index,item] of half.cases.entries()){
    expect(item.id).toBe(nominal.cases[index].id);expect(item.factors).toStrictEqual(nominal.cases[index].factors);
    expect(item.descriptor).toStrictEqual({...nominal.cases[index].descriptor,
      profile:{...original.profile,air:{...original.profile.air,integrationStepTicks:2500}}});
    expect(item.effectiveIntegrationStepTicks).toBe(resolveAerodynamicIntegrationStepTicksV1(item.descriptor.initial.ball.spin,item.descriptor.profile.air));
  }
});

it('freezes owned output only, preserves the caller and rejects every undeclared refinement factor',()=>{
  const before=structuredClone(reference),generated=createPitchBreakKireGyroCasesV169(reference.sourceDescriptor);
  expect(Object.isFrozen(generated.cases[0].descriptor.initial.ball)).toBe(true);expect(Object.isFrozen(reference.sourceDescriptor.initial.ball)).toBe(false);
  for(const factor of [0,3,1.5,'1',null,NaN])expect(()=>Reflect.apply(createPitchBreakKireGyroCasesV169,undefined,[reference.sourceDescriptor,factor])).toThrow(/refinement/);
  expect(reference).toStrictEqual(before);
});

it('delegates sampling and reuses the exact V167 analyzer without evaluating a flight',()=>{
  const item=createPitchBreakKireGyroCasesV169(reference.sourceDescriptor).cases[0],sentinel=Error('sampling delegation'),
    spy=vi.spyOn(lowSpin,'measurePitchBreakLowSpinCaseV158').mockImplementation(()=>{throw sentinel;});
  expect(()=>measurePitchBreakKireGyroCaseV169(reference,item)).toThrow(sentinel);
  expect(()=>measurePitchBreakKireGyroCaseV169(reference,item,640)).toThrow(sentinel);
  expect(spy).toHaveBeenNthCalledWith(1,reference,item,160);expect(spy).toHaveBeenNthCalledWith(2,reference,item,640);
  expect(analyzePitchBreakSkillCandidatesV167).toBe(existingAnalysis);
});
