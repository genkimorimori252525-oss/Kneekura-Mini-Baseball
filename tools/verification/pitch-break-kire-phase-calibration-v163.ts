import { cloneInert } from '../../src/core/adjudication/OfficialWindowPolicy';
import type { SourceFreeBallDescriptorV2 } from '../../src/core/sim/ball/SourceFreeBallKernel';
import { multiplyQuaternions, normalizeQuaternion, quaternionFromAxisAngle } from '../../src/core/sim/pitching/BaseballOrientation';
import { PITCH_BREAK_KIRE_LEVELS_PROTOCOL_V162, createPitchBreakKireLevelsCasesV162, analyzePitchBreakKireLevelsV162 } from './pitch-break-kire-levels-v162';
import { measurePitchBreakLowSpinCaseV158, type PitchBreakLowSpinReferenceV158, type PitchBreakLowSpinComparisonV158 } from './pitch-break-low-spin-v158';

function assert(value:unknown,message:string):asserts value { if(!value)throw Error('pitch break kire phase calibration: '+message); }
function freeze<T>(value:T):T {
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;
}
const protocol=PITCH_BREAK_KIRE_LEVELS_PROTOCOL_V162,
  weakPhaseDegrees=[-20,-17.5,-15,-12.5,-10,-7.5,-5,-2.5,0,2.5,5,7.5,10,12.5,15,17.5,20] as const,
  weakId=(phase:number)=>`spin-0.04_gyro-30_phase-${phase}`,
  middleId='spin-0.08_gyro-30_phase-45',strongId='spin-0.02_gyro-30_phase-0',
  middleFactors={spinScale:.08,gyroDegrees:30,materialPhaseDegrees:45},strongFactors={spinScale:.02,gyroDegrees:30,materialPhaseDegrees:0};

export const PITCH_BREAK_KIRE_PHASE_CALIBRATION_PROTOCOL_V163=freeze({
  version:'pitch_break_kire_phase_calibration_protocol_v163',authority:protocol.authority,
  weakSpinScale:.04,gyroDegrees:30,weakMaterialPhaseDegrees:weakPhaseDegrees,fixedMiddle:middleFactors,fixedStrong:strongFactors,
  nominalIntegrationStepTicks:protocol.nominalIntegrationStepTicks,observationIntervals:protocol.observationIntervals,refinementFactors:protocol.refinementFactors,
  maximumAbsoluteAmountDifferenceMeters:protocol.maximumAbsoluteAmountDifferenceMeters,
  maximumRelativeAmountDifference:protocol.maximumRelativeAmountDifference,maximumDirectionDifferenceDegrees:protocol.maximumDirectionDifferenceDegrees,
  largeAmountMinimumMeters:protocol.largeAmountMinimumMeters,minimumP50FractionDifference:protocol.minimumP50FractionDifference,
  minimumLate20FractionDifference:protocol.minimumLate20FractionDifference,materialPhaseMeaning:protocol.materialPhaseMeaning,
  primaryBasis:protocol.primaryBasis,secondaryBasis:protocol.secondaryBasis,
  calibrationOrder:'WEAK_THEN_FIXED_MIDDLE_THEN_FIXED_STRONG',selectionRule:'MINIMUM_ABSOLUTE_WEAK_PHASE_THEN_SMALLER_SIGNED_PHASE',
  actualSourceModifiedByAnalysis:false,forceTimerAdded:false,seedSearch:false,nativeAdmission:false,
});

export type PitchBreakKirePhaseCalibrationCaseV163=Readonly<{id:string;
  factors:Readonly<{spinScale:number;gyroDegrees:number;materialPhaseDegrees:number}>;
  descriptor:SourceFreeBallDescriptorV2;effectiveIntegrationStepTicks:number}>;

/** Pure construction: V162 supplies the three exact saved-shape templates.
 * Only nonzero weak material phases receive a new world-left quaternion. */
export function createPitchBreakKirePhaseCalibrationCasesV163(raw:SourceFreeBallDescriptorV2,refinementFactor:1|2=1){
  const templates=createPitchBreakKireLevelsCasesV162(raw,refinementFactor),
    weak=templates.cases.find(item=>item.id===weakId(0))!,middle=templates.cases.find(item=>item.id===middleId)!,
    strong=templates.cases.find(item=>item.id===strongId)!,q=weak.descriptor.materialOrientationAtStart!,
    cases:PitchBreakKirePhaseCalibrationCaseV163[]=weakPhaseDegrees.map(phase=>phase===0?weak:{...weak,id:weakId(phase),
      factors:{...weak.factors,materialPhaseDegrees:phase},descriptor:{...weak.descriptor,
        materialOrientationAtStart:normalizeQuaternion(multiplyQuaternions(
          quaternionFromAxisAngle(weak.descriptor.initial.ball.spin,phase*Math.PI/180),q))}});
  cases.push(middle,strong);
  const effectiveSteps=new Set(cases.map(item=>item.effectiveIntegrationStepTicks)),clock={...templates.clock,
    commonEffectiveIntegrationStepTicks:effectiveSteps.size===1?cases[0].effectiveIntegrationStepTicks:null,
    allCasesUseNominalStep:cases.every(item=>item.effectiveIntegrationStepTicks===templates.clock.nominalIntegrationStepTicks)};
  return freeze({clock,cases,reusableCaseIds:[weak.id,middle.id,strong.id],
    roles:{weakCaseIds:weakPhaseDegrees.map(weakId),weakZeroCaseId:weak.id,middleCaseId:middle.id,strongCaseId:strong.id}});
}

/** Uses the existing generic metadata API; no trajectory correction or
 * alternate force law is introduced for negative or fractional phases. */
export function measurePitchBreakKirePhaseCalibrationCaseV163(reference:PitchBreakLowSpinReferenceV158,item:PitchBreakKirePhaseCalibrationCaseV163,
  observationIntervals:160|640=160){
  return measurePitchBreakLowSpinCaseV158(reference,item,observationIntervals);
}

/** Retains the complete V162 primary analysis and separately screens only
 * weak + fixed middle + fixed strong trials, including refinement subsets. */
export function analyzePitchBreakKirePhaseCalibrationV163(raw:readonly PitchBreakLowSpinComparisonV158[]){
  const cases=cloneInert(raw),analysis=analyzePitchBreakKireLevelsV162(cases),byId=new Map(cases.map(item=>[item.id,item])),
    allowed=new Map<string,PitchBreakLowSpinComparisonV158['factors']>([
      ...weakPhaseDegrees.map(phase=>[weakId(phase),{spinScale:.04,gyroDegrees:30,materialPhaseDegrees:phase}] as const),
      [middleId,middleFactors],[strongId,strongFactors],
    ]);
  assert(byId.has(middleId)&&byId.has(strongId),'fixed middle and strong observations required');
  for(const item of cases){
    const expected=allowed.get(item.id);
    assert(expected!==undefined&&(['spinScale','gyroDegrees','materialPhaseDegrees'] as const).every(key=>item.factors[key]===expected[key]),
      'predeclared case IDs and factors required');
  }
  const key=(ids:readonly string[])=>JSON.stringify([...ids].sort()),
    tripleByIds=new Map(analysis.triples.map(item=>[key(item.caseIds),item])),calibrationTrials=[];
  for(const phaseDegrees of weakPhaseDegrees){
    const weakCaseId=weakId(phaseDegrees);if(!byId.has(weakCaseId))continue;
    const expectedOrderedCaseIds=[weakCaseId,middleId,strongId],primary=tripleByIds.get(key(expectedOrderedCaseIds))!,
      orderedCaseIds=primary.orderedCaseIds,
      roleOrderMatched=orderedCaseIds!==null&&expectedOrderedCaseIds.every((id,index)=>id===orderedCaseIds[index]),
      primaryQualified=primary.qualified,qualified=primaryQualified&&roleOrderMatched,reasons=[...primary.reasons];
    if(!roleOrderMatched)reasons.push('PRIMARY_ORDER_DOES_NOT_MATCH_WEAK_MIDDLE_STRONG');
    calibrationTrials.push({phaseDegrees,weakCaseId,middleCaseId:middleId,strongCaseId:strongId,expectedOrderedCaseIds,orderedCaseIds,
      primaryQualified,roleOrderMatched,largeAmountBand:primary.largeAmountBand,qualified,reasons});
  }
  const qualifiedCalibrations=calibrationTrials.filter(item=>item.qualified)
    .sort((a,b)=>Math.abs(a.phaseDegrees)-Math.abs(b.phaseDegrees)||a.phaseDegrees-b.phaseDegrees);
  return freeze({...analysis,calibrationTrials,summary:{...analysis.summary,calibrationTrialCount:calibrationTrials.length,
    qualifiedCalibrationCount:qualifiedCalibrations.length,qualifiedCalibrations,selectedCalibration:qualifiedCalibrations[0]??null}});
}
