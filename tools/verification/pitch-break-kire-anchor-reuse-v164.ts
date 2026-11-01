import { cloneInert } from '../../src/core/adjudication/OfficialWindowPolicy';
import type { SourceFreeBallDescriptorV2 } from '../../src/core/sim/ball/SourceFreeBallKernel';
import type { PitchBreakLowSpinComparisonV158, PitchBreakLowSpinReferenceV158 } from './pitch-break-low-spin-v158';
import { createPitchBreakKireLevelsCasesV162, analyzePitchBreakKireLevelsV162 } from './pitch-break-kire-levels-v162';
import { PITCH_BREAK_KIRE_PHASE_CALIBRATION_PROTOCOL_V163, createPitchBreakKirePhaseCalibrationCasesV163,
  measurePitchBreakKirePhaseCalibrationCaseV163, type PitchBreakKirePhaseCalibrationCaseV163 } from './pitch-break-kire-phase-calibration-v163';

function assert(value:unknown,message:string):asserts value { if(!value)throw Error('pitch break kire anchor reuse: '+message); }
function freeze<T>(value:T):T {
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;
}
const protocol=PITCH_BREAK_KIRE_PHASE_CALIBRATION_PROTOCOL_V163,weakPhaseDegrees=protocol.weakMaterialPhaseDegrees,
  weakId=(phase:number)=>`spin-0.04_gyro-30_phase-${phase}`,middleId='spin-0.1_gyro-30_phase-270',strongId='spin-0.02_gyro-30_phase-0',
  middleFactors={spinScale:.1,gyroDegrees:30,materialPhaseDegrees:270};

export const PITCH_BREAK_KIRE_ANCHOR_REUSE_PROTOCOL_V164=freeze({...protocol,version:'pitch_break_kire_anchor_reuse_protocol_v164',
  fixedMiddle:middleFactors,nominalSourceFlightsRequired:0,anchorPreflightRequired:true,
  referenceMeaning:'REUSE_SAVED_V163_WEAK_AND_STRONG_WITH_SAVED_V162_MIDDLE_B_UNCHANGED_INPUTS'});

/** No Source evaluation: preserve all eighteen V163 cases and replace only
 * the fixed middle with the exact existing V162 B template. */
export function createPitchBreakKireAnchorReuseCasesV164(raw:SourceFreeBallDescriptorV2,refinementFactor:1|2=1){
  const previous=createPitchBreakKirePhaseCalibrationCasesV163(raw,refinementFactor),
    middle=createPitchBreakKireLevelsCasesV162(raw,refinementFactor).cases.find(item=>item.id===middleId)!,
    cases=previous.cases.map(item=>item.id===previous.roles.middleCaseId?middle:item),
    effectiveSteps=new Set(cases.map(item=>item.effectiveIntegrationStepTicks)),clock={...previous.clock,
      commonEffectiveIntegrationStepTicks:effectiveSteps.size===1?cases[0].effectiveIntegrationStepTicks:null,
      allCasesUseNominalStep:cases.every(item=>item.effectiveIntegrationStepTicks===previous.clock.nominalIntegrationStepTicks)};
  return freeze({clock,cases,reusableCaseIds:cases.map(item=>item.id),roles:{...previous.roles,middleCaseId:middle.id}});
}

export function measurePitchBreakKireAnchorReuseCaseV164(reference:PitchBreakLowSpinReferenceV158,item:PitchBreakKirePhaseCalibrationCaseV163,
  observationIntervals:160|640=160){
  return measurePitchBreakKirePhaseCalibrationCaseV163(reference,item,observationIntervals);
}

/** Pure pair preflight also exposes the original failed anchors without
 * changing their IDs or relabeling their stored observations. */
export function preflightPitchBreakKireAnchorsV164(middle:PitchBreakLowSpinComparisonV158,strong:PitchBreakLowSpinComparisonV158){
  const pair=analyzePitchBreakKireLevelsV162([middle,strong]).pairs[0],one=middle.commonTime,two=strong.commonTime,
    strictlyIncreasingLate20AndP50=one.p50Fraction!==null&&two.p50Fraction!==null&&one.late20Fraction!==null&&two.late20Fraction!==null&&
      one.p50Fraction<two.p50Fraction&&one.late20Fraction<two.late20Fraction,
    feasible=pair.eligible&&pair.matchedAmountAndDirection&&pair.timeShapeCandidate&&strictlyIncreasingLate20AndP50,reasons=[];
  if(!pair.eligible)reasons.push('ANCHOR_PAIR_NOT_ELIGIBLE');
  if(!pair.matchedAmountAndDirection)reasons.push('ANCHOR_AMOUNT_OR_DIRECTION_NOT_MATCHED');
  if(!pair.timeShapeCandidate)reasons.push('ANCHOR_TIME_SHAPE_DIFFERENCE_NOT_DEMONSTRATED');
  if(!strictlyIncreasingLate20AndP50)reasons.push('ANCHOR_P50_OR_LATE20_NOT_STRICTLY_INCREASING');
  return freeze({...pair,strictlyIncreasingLate20AndP50,feasible,reasons});
}

/** The fixed pair is checked before the full unchanged V162 metadata screen.
 * Failed anchors retain all trial/global diagnostics and yield no targets. */
export function analyzePitchBreakKireAnchorReuseV164(raw:readonly PitchBreakLowSpinComparisonV158[]){
  const cases=cloneInert(raw),byId=new Map(cases.map(item=>[item.id,item])),
    allowed=new Map<string,PitchBreakLowSpinComparisonV158['factors']>([
      ...weakPhaseDegrees.map(phase=>[weakId(phase),{spinScale:.04,gyroDegrees:30,materialPhaseDegrees:phase}] as const),
      [middleId,middleFactors],[strongId,protocol.fixedStrong],
    ]);
  assert(byId.has(middleId)&&byId.has(strongId),'fixed middle and strong observations required');
  for(const item of cases){
    const expected=allowed.get(item.id);
    assert(expected!==undefined&&(['spinScale','gyroDegrees','materialPhaseDegrees'] as const).every(key=>item.factors[key]===expected[key]),
      'predeclared case IDs and factors required');
  }
  const anchorPreflight=preflightPitchBreakKireAnchorsV164(byId.get(middleId)!,byId.get(strongId)!),analysis=analyzePitchBreakKireLevelsV162(cases),
    key=(ids:readonly string[])=>JSON.stringify([...ids].sort()),
    tripleByIds=new Map(analysis.triples.map(item=>[key(item.caseIds),item])),calibrationTrials=[];
  for(const phaseDegrees of weakPhaseDegrees){
    const weakCaseId=weakId(phaseDegrees);if(!byId.has(weakCaseId))continue;
    const expectedOrderedCaseIds=[weakCaseId,middleId,strongId],primary=tripleByIds.get(key(expectedOrderedCaseIds))!,orderedCaseIds=primary.orderedCaseIds,
      roleOrderMatched=orderedCaseIds!==null&&expectedOrderedCaseIds.every((id,index)=>id===orderedCaseIds[index]),
      primaryQualified=primary.qualified,qualified=anchorPreflight.feasible&&primaryQualified&&roleOrderMatched,reasons=[...primary.reasons];
    if(!anchorPreflight.feasible)reasons.push('FIXED_ANCHOR_PREFLIGHT_FAILED');
    if(!roleOrderMatched)reasons.push('PRIMARY_ORDER_DOES_NOT_MATCH_WEAK_MIDDLE_STRONG');
    calibrationTrials.push({phaseDegrees,weakCaseId,middleCaseId:middleId,strongCaseId:strongId,expectedOrderedCaseIds,orderedCaseIds,
      primaryQualified,roleOrderMatched,largeAmountBand:primary.largeAmountBand,qualified,reasons});
  }
  const qualifiedCalibrations=calibrationTrials.filter(item=>item.qualified)
    .sort((a,b)=>Math.abs(a.phaseDegrees)-Math.abs(b.phaseDegrees)||a.phaseDegrees-b.phaseDegrees),
    additionalMeasurementCaseIds=[...new Set(qualifiedCalibrations.flatMap(item=>item.expectedOrderedCaseIds))].sort();
  return freeze({...analysis,anchorPreflight,calibrationTrials,additionalMeasurementCaseIds,
    summary:{...analysis.summary,calibrationTrialCount:calibrationTrials.length,qualifiedCalibrationCount:qualifiedCalibrations.length,
      qualifiedCalibrations,selectedCalibration:qualifiedCalibrations[0]??null}});
}
