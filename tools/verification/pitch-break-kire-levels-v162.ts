import { cloneInert } from '../../src/core/adjudication/OfficialWindowPolicy';
import type { Vec3 } from '../../src/core/model/geometry';
import type { SourceFreeBallDescriptorV2 } from '../../src/core/sim/ball/SourceFreeBallKernel';
import { resolveAerodynamicIntegrationStepTicksV1 } from '../../src/core/sim/pitching/AerodynamicPitchTrajectory';
import { multiplyQuaternions, normalizeQuaternion, quaternionFromAxisAngle } from '../../src/core/sim/pitching/BaseballOrientation';
import { PITCH_BREAK_LOW_SPIN_PROTOCOL_V158, analyzePitchBreakLowSpinCasesV158, measurePitchBreakLowSpinCaseV158,
  type PitchBreakLowSpinComparisonV158, type PitchBreakLowSpinReferenceV158 } from './pitch-break-low-spin-v158';

function assert(value:unknown,message:string):asserts value { if(!value)throw Error('pitch break kire levels: '+message); }
function freeze<T>(value:T):T {
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;
}
const norm=(v:Vec3)=>Math.hypot(v.x,v.y,v.z),dot=(a:Vec3,b:Vec3)=>a.x*b.x+a.y*b.y+a.z*b.z,
  subtract=(a:Vec3,b:Vec3):Vec3=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z}),
  scale=(v:Vec3,k:number):Vec3=>({x:v.x*k,y:v.y*k,z:v.z*k});

export const PITCH_BREAK_KIRE_LEVELS_PROTOCOL_V162=freeze({
  ...PITCH_BREAK_LOW_SPIN_PROTOCOL_V158,version:'pitch_break_kire_levels_protocol_v162',
  spinScales:[.02,.04,.06,.08,.1] as const,gyroDegrees:[30] as const,materialPhaseDegrees:[0,45,90,135,180,225,270,315] as const,
  nominalIntegrationStepTicks:5000,integrationStepChoice:'NOMINAL_5000_WITH_EACH_CASE_SOURCE_RESOLVED_STEP_DIAGNOSTIC',
  referenceMeaning:'SAVED_V158_CURVE_LEVEL4_SEED3_RELEASE_PV_TREF_AND_AIRLESS_GRAVITY_NOT_V159_REAIMED_RELEASE',
  tripleAmountDirectionMeaning:'ALL_THREE_PAIRS_MUST_PASS_UNCHANGED_V158_AMOUNT_DIRECTION_SCREEN',
  tripleTimingMeaning:'STRICTLY_INCREASING_LATE20_AND_P50_WITH_UNCHANGED_V158_TIMING_OR_SCREEN_ON_BOTH_ADJACENT_PAIRS',
  oldMatrixRegenerated:false,actualSourceModifiedByAnalysis:false,
});

/** Reuses the V158 Source-space construction on the separately prescribed
 * forty inputs. A nominal clock is never promoted to an effective-clock claim. */
export function createPitchBreakKireLevelsCasesV162(raw:SourceFreeBallDescriptorV2,refinementFactor:1|2=1){
  const base=cloneInert(raw),air=base.profile.air,aero=air.aerodynamics,spin=base.initial.ball.spin,
    velocity=subtract(base.initial.ball.velocity,aero.windVelocityMps),spinMagnitude=norm(spin),airMagnitude=norm(velocity),
    material=base.materialOrientationAtStart;
  assert(refinementFactor===1||refinementFactor===2,'predeclared refinement one or two required');
  assert(base.initial.elapsedSeconds===0,'release-rooted elapsed clock required');
  assert(material!==undefined&&aero.seamForce!==undefined&&aero.seamForce.coefficientScale>0&&aero.spinDecay!==undefined,
    'saved material, enabled seam and spin decay required');
  assert(spinMagnitude>0&&airMagnitude>0,'nonzero spin and relative air required');
  const airUnit=scale(velocity,1/airMagnitude),transverse=subtract(spin,scale(airUnit,dot(spin,airUnit))),transverseMagnitude=norm(transverse);
  assert(transverseMagnitude>1e-12*spinMagnitude,'nonparallel spin-plane basis required');
  const transverseUnit=scale(transverse,1/transverseMagnitude),
    originalEffectiveIntegrationStepTicks=resolveAerodynamicIntegrationStepTicksV1(spin,air),
    nominalIntegrationStepTicks=PITCH_BREAK_KIRE_LEVELS_PROTOCOL_V162.nominalIntegrationStepTicks/refinementFactor,cases=[];
  for(const spinScale of PITCH_BREAK_KIRE_LEVELS_PROTOCOL_V162.spinScales)
    for(const gyroDegrees of PITCH_BREAK_KIRE_LEVELS_PROTOCOL_V162.gyroDegrees)
      for(const materialPhaseDegrees of PITCH_BREAK_KIRE_LEVELS_PROTOCOL_V162.materialPhaseDegrees){
        const radians=gyroDegrees*Math.PI/180,axis={x:transverseUnit.x*Math.cos(radians)+airUnit.x*Math.sin(radians),
          y:transverseUnit.y*Math.cos(radians)+airUnit.y*Math.sin(radians),z:transverseUnit.z*Math.cos(radians)+airUnit.z*Math.sin(radians)},
          chosenSpin=scale(axis,spinMagnitude*spinScale),orientation=materialPhaseDegrees===0?material:
            normalizeQuaternion(multiplyQuaternions(quaternionFromAxisAngle(chosenSpin,materialPhaseDegrees*Math.PI/180),material)),
          descriptor:SourceFreeBallDescriptorV2={...base,initial:{...base.initial,ball:{...base.initial.ball,spin:chosenSpin}},
            materialOrientationAtStart:orientation,profile:{...base.profile,air:{...air,integrationStepTicks:nominalIntegrationStepTicks}}};
        cases.push({id:`spin-${spinScale}_gyro-${gyroDegrees}_phase-${materialPhaseDegrees}`,
          factors:{spinScale,gyroDegrees,materialPhaseDegrees},descriptor,
          effectiveIntegrationStepTicks:resolveAerodynamicIntegrationStepTicksV1(chosenSpin,descriptor.profile.air)});
      }
  const effectiveSteps=new Set(cases.map(item=>item.effectiveIntegrationStepTicks)),
    clock={ticksPerSecond:air.ticksPerSecond,originalNominalStepTicks:air.integrationStepTicks,originalEffectiveIntegrationStepTicks,
      nominalIntegrationStepTicks,commonEffectiveIntegrationStepTicks:effectiveSteps.size===1?cases[0].effectiveIntegrationStepTicks:null,
      allCasesUseNominalStep:cases.every(item=>item.effectiveIntegrationStepTicks===nominalIntegrationStepTicks)};
  return freeze({clock,cases});
}

export type PitchBreakKireLevelCaseV162=ReturnType<typeof createPitchBreakKireLevelsCasesV162>['cases'][number];

/** V158 owns actual Source sampling, analytic gravity, own-plane comparison,
 * null/status/ground reasons and force observations. No result is corrected. */
export function measurePitchBreakKireLevelCaseV162(reference:PitchBreakLowSpinReferenceV158,item:PitchBreakKireLevelCaseV162,observationIntervals:160|640=160){
  return measurePitchBreakLowSpinCaseV158(reference,item,observationIntervals);
}

/** Pure metadata screen. Every unordered triple is retained, including failed
 * and unavailable observations. Strength ranks do not author a pitch or UI. */
export function analyzePitchBreakKireLevelsV162(raw:readonly PitchBreakLowSpinComparisonV158[]){
  const cases=cloneInert(raw),analysis=analyzePitchBreakLowSpinCasesV158(cases),triples=[],
    pairByIds=new Map<string,Map<string,typeof analysis.pairs[number]>>();
  for(const pair of analysis.pairs){
    let group=pairByIds.get(pair.caseAId);
    if(!group){group=new Map();pairByIds.set(pair.caseAId,group);}group.set(pair.caseBId,pair);
  }
  const findPair=(a:string,b:string)=>pairByIds.get(a)?.get(b)??pairByIds.get(b)!.get(a)!;
  for(let i=0;i<cases.length;i++)for(let j=i+1;j<cases.length;j++)for(let k=j+1;k<cases.length;k++){
    const rows=[cases[i],cases[j],cases[k]] as const,caseIds=rows.map(item=>item.id),
      allPairs=[findPair(caseIds[0],caseIds[1]),findPair(caseIds[0],caseIds[2]),findPair(caseIds[1],caseIds[2])],
      nearAmountAndDirection=allPairs.every(pair=>pair.matchedAmountAndDirection),largeAmountBand=allPairs.every(pair=>pair.largeAmountBand),
      timingAvailable=rows.every(item=>item.commonTime.p50Fraction!==null&&item.commonTime.late20Fraction!==null),
      ordered=timingAvailable?[...rows].sort((a,b)=>a.commonTime.late20Fraction!-b.commonTime.late20Fraction!):null,
      orderedCaseIds=ordered===null?null:ordered.map(item=>item.id),
      increasingLate20=ordered!==null&&ordered[0].commonTime.late20Fraction!<ordered[1].commonTime.late20Fraction!&&
        ordered[1].commonTime.late20Fraction!<ordered[2].commonTime.late20Fraction!,
      increasingP50=ordered!==null&&ordered[0].commonTime.p50Fraction!<ordered[1].commonTime.p50Fraction!&&
        ordered[1].commonTime.p50Fraction!<ordered[2].commonTime.p50Fraction!,
      strictlyIncreasingLate20AndP50=increasingLate20&&increasingP50,
      adjacentTimeShapeCandidate=orderedCaseIds!==null&&findPair(orderedCaseIds[0],orderedCaseIds[1]).timeShapeCandidate&&
        findPair(orderedCaseIds[1],orderedCaseIds[2]).timeShapeCandidate,
      qualified=nearAmountAndDirection&&strictlyIncreasingLate20AndP50&&adjacentTimeShapeCandidate,reasons=[];
    if(!nearAmountAndDirection)reasons.push('AMOUNT_DIRECTION_OR_CLASSIFICATION_NOT_MATCHED_IN_ALL_THREE_PAIRS');
    if(!timingAvailable)reasons.push('MISSING_P50_OR_LATE20');
    else{
      if(!increasingLate20)reasons.push('LATE20_NOT_STRICTLY_INCREASING');
      if(!increasingP50)reasons.push('P50_ORDER_DOES_NOT_FOLLOW_LATE20');
      if(!adjacentTimeShapeCandidate)reasons.push('ADJACENT_PAIR_DOES_NOT_PASS_UNCHANGED_V158_TIMING_SCREEN');
    }
    triples.push({caseIds,orderedCaseIds,nearAmountAndDirection,largeAmountBand,strictlyIncreasingLate20AndP50,adjacentTimeShapeCandidate,qualified,reasons});
  }
  const qualified=triples.filter(item=>item.qualified),large=qualified.filter(item=>item.largeAmountBand);
  // Keep the original records in the caller's transport. The analysis returns
  // only compact IDs/diagnostics, never substituted observations or descriptors.
  return freeze({pairs:analysis.pairs,triples,summary:{...analysis.summary,tripleCount:triples.length,
    nearAmountAndDirectionTripleCount:triples.filter(item=>item.nearAmountAndDirection).length,
    qualifiedTripleCount:qualified.length,largeAmountQualifiedTripleCount:large.length,
    qualifiedTriples:qualified.map(item=>({caseIds:item.caseIds,orderedCaseIds:item.orderedCaseIds,largeAmountBand:item.largeAmountBand})),
    screenVerdict:large.length?'LARGE_AMOUNT_THREE_LEVEL_MODEL_TIMING_CANDIDATES':qualified.length?'ONLY_LOW_AMOUNT_THREE_LEVEL_MODEL_TIMING_CANDIDATES':
      'THREE_LEVELS_NOT_DEMONSTRATED_IN_PRESCRIBED_MATRIX'}});
}
