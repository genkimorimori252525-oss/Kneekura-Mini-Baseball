import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { Vec3 } from '../../core/model/geometry';
import { forecastObservedPitchV151, type ObservedPitchPositionV151 } from '../../core/decision/batting/ObservedPitchForecastV151';
import {forecastObservedPitchV246,type ObservedPitchForecastPolicyV246} from '../../core/decision/batting/ObservedPitchForecastV246';
import { validateBatterObservedMemoryPolicyV151, type BatterObservedMemoryPolicyV151 } from '../../core/decision/batting/BatterObservedMemoryV151';

/** An explicit operational model, never a measured human/Native calibration. */
export type LiveBatterObservationPolicyV151 = Readonly<{
  version:'live_batter_observation_v151';sourceId:string;ticksPerSecond:number;
  decisionAfterReleaseTicks:number;positionSampleIntervalTicks:number;deliveryLatencyTicks:number;
  maximumForecastAfterReleaseSeconds:number;memoryPolicy:BatterObservedMemoryPolicyV151;
  /** Omitted: decide at the fixed tick. Present: keep watching until the swing
   * must start, so a slower pitch gives a later and better look. */
  commitSwingSeconds?:number;
  /** Share of swings a batter keeps by count, [balls][strikes]. A hitter takes
   * hittable strikes early in a count, then protects the plate with two strikes. */
  countReadinessV1?:readonly (readonly number[])[];
  /** How far outside the zone a batter will expand with two strikes, as swing score. */
  twoStrikeExpansionV1?:number;
  /** Reads the player's speed ceiling at contact instead of over the whole motion. */
  contactSpeedCeilingV1?:boolean;
  /** Share of the follow-through allowance kept: late contact meets a faster bat, so 1 lets the top exit speeds run away. */
  contactSpeedCeilingShareV1?:number;
  /** League-wide bat speed level. A slower target keeps the swing on time, where a tighter ceiling would delay it. */
  targetSpeedScaleV1?:number;
  /** Late bat adjustment earned by contact skill: [best timing, worst timing, look at best, look at worst].
   * Plate vision alone used to grant it, which left every hitter under 75 vision with no adjustment at all. */
  meetLateLookV1?:readonly number[];
  /** The late adjustment comes from contact skill alone. Taking the larger of vision and contact let a good eye
   * rescue any swing, so strikeouts stopped rising with timing error. Vision still judges balls and strikes. */
  lateLookByMeetOnlyV1?:boolean;
  // A late contact keeps the bat velocity of the clip's own contact moment: past it the measured motion carries the
  // real swing's slowdown from its own ball.
  postContactHoldV1?:boolean;
  /** Metres from the sweet spot, [toward the tip, toward the handle], at which a wooden bat's ringing halves the
   * normal restitution, and optionally the least share kept (Nathan 2000 levels off near a third toward the handle).
   * The rigid bat keeps the same bounce along the whole barrel. */
  barrelVibrationLossV1?:readonly number[];
  /** Metres the swing aims the sweet spot below the ball's centre (0..0.05). Hitters who lift the ball meet it under centre,
   * which gives line drives their backspin; aimed at the centre, a rising bat tops them. */
  undercutAimV1?:number;
  /** Scale on the up-down part of the swing's aim error (0..2). Every swing missing by the same spread spread the launch angles
   * wider than MLB's; a tighter aim with the fooled swings of priorFooledChanceV1 keeps the misses. */
  aimVerticalScaleV1?:number;
  /** Power on (view of the flight at 40 m/s / this pitch's view) applied to the timing spread (0..6), the view being the flight
   * less the commit time. A fixed spread in seconds left a 162 km/h fastball barely harder to time than a 140 km/h one. */
  viewTimeTimingV1?:number;
  /** The same power law on the aim spread (0..6): a shorter view blurs where the ball will cross as well as when. */
  viewTimeAimV1?:number;
  /** Power on (look at a 0.44 s arrival / this look) applied to priorFooledChanceV1 (0..6), the look being the expected (remembered)
   * arrival less the commit time and motor latency. Two thirds of misses come from fooled swings, so a faster arm must fool more often,
   * and an off-speed pitch thrown after fastballs is met with the fastball's short look. */
  fooledViewPowerV1?:number;
  /** Expected arrival in seconds at which fooledViewPowerV1 leaves priorFooledChanceV1 unchanged (0.3..0.7, 0.44 when absent). */
  fooledViewReferenceV1?:number;
  /** [ball-strike judgment spread in metres at vision 70, vision points per factor e]: the spread follows the 1-100 vision
   * directly. With the maker's 100 points per e, a 100 eye walked barely more than a 70 one. */
  visionJudgmentV1?:readonly number[];
  /** Weight of the observed acceleration in the forecast at the swing decision (0..1); the rest is the pitcher's fastball bend,
   * flown from the same release. 1 or absent: the full observed bend (exact forecast). */
  accelerationPriorWeightV1?:number;
  /** Seconds: instead of a fixed weight, the observed bend counts look/(look + this), the look running from release to the
   * last sample, for the swing decision and the later look alike (0.01..2). */
  accelerationViewTimeV1?:number;
  /** [chance, degrees, ms]: the hitter fails to tell the pitch from his expected fastball with chance x exp(-hypot(heading
   * turn/degrees, arrival delay/ms)) and then reads it as that fastball (its bend and arrival); replaces the fooled draw. */
  pitchRecognitionV1?:readonly number[];
  /** [share 0..0.5, scale 1..10]: that share of swings misjudges the timing by scale times the usual spread. */
  timingTailV1?:readonly number[];
  /** [share 0..0.5, scale 1..10]: that share of swings misjudges the height by scale times the usual up-down spread. */
  aimTailV1?:readonly number[];
  /** [degrees, ms]: at the swing decision the hitter weighs every pitch the pitcher owns by how often he throws it times
   * exp(-d^2/2), d = hypot(heading turn/degrees, lag at the same depth/ms) against that pitch released the same way, and reads
   * the one drawn from those weights: his own pitch is read as it flies, another as that pitch (its bend and arrival).
   * Only what is visible by then is used. Takes the place of pitchRecognitionV1 when both are given. An optional third value
   * [degrees] adds the angle between the spin axes (the seams' turn he sees) to d, divided by it. */
  pitchRecognitionV2?:readonly number[];
  /** Standard deviation of the hitter's relative error in the ball's speed at the swing decision (0..0.3). Reading it faster
   * than it is, he expects it sooner and higher (it has less time to drop), slower the other way; one error moves both. */
  speedPerceptionV1?:number;
  /** The pitch target plan's choice temperature in runs (0.0005..0.5). Given, the plan forecasts the MLB hitter (swing by count,
   * contact, fouls and run value by region, a walk at its wOBA weight) and draws a spot on exp(-(cost - best) / temperature). */
  pitchTargetPlanV2?:number;
  /** [start, per pitch seen, cap] of the hitter's familiarity with this pitcher (0..1). The pitches he pictures spin as
   * that share of the pitcher's own and the rest of the league's pitch of the same type (leagueReferencePitchesV1, by the
   * pitcher's hand); the share grows with the pitches of this pitcher he has seen. Recognition, the read path and the
   * expected arrival all use the pictured pitch, so a pitch unlike the league's fools him until he knows it. */
  pitchFamiliarityV1?:readonly number[];
  /** The league's pitch of each type as a hitter expects it: spin (rad/s, as released), for right- and left-handed pitchers. */
  leagueReferencePitchesV1?:Readonly<{R:readonly Readonly<{pitchType:string;spinRadPerSecond:Vec3}>[];L:readonly Readonly<{pitchType:string;spinRadPerSecond:Vec3}>[]}>;
  /** With pitchTargetPlanV2: runs per unit of a pitch's zoneRateV1 above the pitcher's own mean that lean its target toward
   * the zone (0..5). The pitch's zone rate then works through the plan instead of moving the planned target. */
  pitchZoneLeanV2?:number;
  /** Share of the remembered pitch kept in where the bat goes (0..1); the arrival time keeps the full prior.
   * Blending a quarter of the last pitches into the height made hitters top low pitches and pop up high ones. */
  priorPlacementShareV1?:number;
  /** With pitch recognition, the share (0-1) of the deciding belief's pull toward the remembered pitch that the bat also follows. */
  placementJudgedV1?:number;
  /** Spread (swing-score units) of the swing cut-off: the batter swings with chance Phi((score - cut-off) / spread). */
  swingDecisionNoiseV1?:number;
  /** [weight, k]: the prior is the mean of this pitcher's pitches seen, shrunk to the zone's middle by n/(n+k), with weight weight*k/(n+k). */
  priorExpectationV1?:readonly number[];
  /** Late-look correction bounded by this extra hand acceleration (m/s^2) over the time left, instead of the meet share of the gap. */
  lateLookAccelerationV1?:number;
  /** Chance per swing that the hitter is fooled and puts the bat where he expected the pitch (the remembered one);
   * otherwise the bat goes where he saw it. Overrides priorPlacementShareV1. A blend on every swing made too many
   * half-missed balls for the strikeouts it produced. */
  priorFooledChanceV1?:number;
  /** Seconds of clip time before the clip's contact at which the attack angle is aimed, taken from the approaching
   * swing. Bat and ball touch about 6.8 cm (some 1 ms) before their centres meet, while the swing is still turning up. */
  contactLeadAlignV1?:number;
  /** Least room above the aimed speed, as a multiple of it. A swing aimed at its own ceiling has no speed left for the late adjustment. */
  swingSpeedRoomV1?:number;
  /** Swing threshold change per plate vision point around 70, so a good eye lays off more pitches. */
  visionSelectivityV1?:number;
  /** A manager's location order goes through the count plan instead of one fixed spot outside the zone. */
  pitchOrderPlanV1?:boolean;
  /** Highest sweet spot speed in the collision, as a multiple of the aimed speed. The measured clips keep
   * accelerating past contact, so a late swing would otherwise meet the ball far above the batter's power. */
  impactSpeedLimitV1?:number;
}>;
export const AUTHORED_LIVE_BATTER_OBSERVATION_V151:LiveBatterObservationPolicyV151 = Object.freeze({
  version:'live_batter_observation_v151',sourceId:'authored-position-observer-v151',ticksPerSecond:1_000_000,
  decisionAfterReleaseTicks:140_000,positionSampleIntervalTicks:20_000,deliveryLatencyTicks:0,
  maximumForecastAfterReleaseSeconds:2.5,
  memoryPolicy:Object.freeze({version:'batter_observed_memory_policy_v151',sourceId:'authored-recent-forecast-memory-v151',
    maximumEntriesPerPair:3,unprofiledPriorWeight:.25}),
});
/** The match default. 2026-11-04: MLB candidate 4 of the standard league: the late-contact bat held at its contact speed, the
 * barrel's ringing, the swing aimed 1 cm under the ball with a tighter up-down aim, and a quarter of swings fooled to where the
 * hitter expected the pitch (instead of blending the remembered pitch into every swing). Strikeouts, walks, average, launch
 * mix and bases per ball in play of MLB 2024; extra bases about four fifths of MLB's.
 * Candidate 5 (2026-11-04): the fooled chance grows with a shorter look at the expected pitch (strikeouts +8.8 points from 140 to
 * 162 km/h), and the impact speed may reach 1.05 of the aimed speed (late contacts no longer carry the clip's slowdown); against
 * 153 km/h standard pitchers, K .206, BB .077, AVG .245, ISO .147, HR .028.
 * Candidate 6 (2026-11-04): the hitter tells the pitch from his expected fastball or not (pitchRecognitionV1 [.65, 6°, 100 ms]),
 * replacing the fooled draw (kept only as the fallback when no fastball or forecast exists): whiffs per swing by pitch type near
 * MLB's (fastball .22 instead of .40, slider .33, curve .24, changeup .28), with ISO .155 and HR .029 at [.6, 6, 100]. */
export const LIVE_MATCH_BATTER_OBSERVATION_V2:LiveBatterObservationPolicyV151 = Object.freeze({...AUTHORED_LIVE_BATTER_OBSERVATION_V151,
  commitSwingSeconds:.26,contactSpeedCeilingV1:true,impactSpeedLimitV1:1.05,twoStrikeExpansionV1:.22,meetLateLookV1:Object.freeze([.0045,.014,.85,.3]),swingSpeedRoomV1:1.16,visionSelectivityV1:.004,pitchOrderPlanV1:true,
  lateLookByMeetOnlyV1:true,priorPlacementShareV1:.45,postContactHoldV1:true,barrelVibrationLossV1:Object.freeze([.1,.145,.35]),undercutAimV1:.01,aimVerticalScaleV1:.6,priorFooledChanceV1:.25,fooledViewPowerV1:1,fooledViewReferenceV1:.49,pitchRecognitionV1:Object.freeze([.65,6,100]),
  countReadinessV1:Object.freeze([[.62,.85,1],[.72,.9,1],[.72,.95,1],[.12,.85,1]].map(row=>Object.freeze(row)))});
function assert(value:unknown,message:string):asserts value {if(!value)throw Error('live batter observation v151: '+message);}
export function meetLateLookV1(timingStdSeconds:number,look:readonly number[]){
  const [best,worst,high,low]=look as [number,number,number,number],t=Math.min(1,Math.max(0,Math.log(timingStdSeconds/best)/Math.log(worst/best)));
  return high+(low-high)*t;
}
export function validateLiveBatterObservationPolicyV151(raw:unknown):LiveBatterObservationPolicyV151 {
  const p=cloneInert(raw) as LiveBatterObservationPolicyV151,keys=['version','sourceId','ticksPerSecond','decisionAfterReleaseTicks',
    'positionSampleIntervalTicks','deliveryLatencyTicks','maximumForecastAfterReleaseSeconds','memoryPolicy'];
  if(Object.hasOwn(p,'commitSwingSeconds')){keys.push('commitSwingSeconds');assert(Number.isFinite(p.commitSwingSeconds)&&p.commitSwingSeconds!>0&&p.commitSwingSeconds!<=1,'invalid commit swing seconds');}
  if(Object.hasOwn(p,'countReadinessV1')){keys.push('countReadinessV1');assert(Array.isArray(p.countReadinessV1)&&p.countReadinessV1.length===4&&p.countReadinessV1.every(row=>Array.isArray(row)&&row.length===3&&row.every(v=>Number.isFinite(v)&&v>=0&&v<=1)),'invalid count readiness');}
  if(Object.hasOwn(p,'targetSpeedScaleV1')){keys.push('targetSpeedScaleV1');assert(Number.isFinite(p.targetSpeedScaleV1)&&p.targetSpeedScaleV1!>=.5&&p.targetSpeedScaleV1!<=1.5,'invalid target speed scale');}
  if(Object.hasOwn(p,'contactSpeedCeilingShareV1')){keys.push('contactSpeedCeilingShareV1');assert(Number.isFinite(p.contactSpeedCeilingShareV1)&&p.contactSpeedCeilingShareV1!>=0&&p.contactSpeedCeilingShareV1!<=1,'invalid contact speed share');}
  if(Object.hasOwn(p,'meetLateLookV1')){keys.push('meetLateLookV1');assert(Array.isArray(p.meetLateLookV1)&&p.meetLateLookV1.length===4&&p.meetLateLookV1.every(v=>Number.isFinite(v)&&v>0&&v<=1),'invalid meet late look');}
  if(Object.hasOwn(p,'impactSpeedLimitV1')){keys.push('impactSpeedLimitV1');assert(Number.isFinite(p.impactSpeedLimitV1)&&p.impactSpeedLimitV1!>=1&&p.impactSpeedLimitV1!<=2,'invalid impact speed limit');}
  if(Object.hasOwn(p,'swingSpeedRoomV1')){keys.push('swingSpeedRoomV1');assert(Number.isFinite(p.swingSpeedRoomV1)&&p.swingSpeedRoomV1!>=1&&p.swingSpeedRoomV1!<=2,'invalid swing speed room');}
  if(Object.hasOwn(p,'visionSelectivityV1')){keys.push('visionSelectivityV1');assert(Number.isFinite(p.visionSelectivityV1)&&p.visionSelectivityV1!>=0&&p.visionSelectivityV1!<=.02,'invalid vision selectivity');}
  if(Object.hasOwn(p,'pitchOrderPlanV1')){keys.push('pitchOrderPlanV1');assert(typeof p.pitchOrderPlanV1==='boolean','invalid pitch order plan');}
  if(Object.hasOwn(p,'contactLeadAlignV1')){keys.push('contactLeadAlignV1');assert(Number.isFinite(p.contactLeadAlignV1)&&p.contactLeadAlignV1!>=0&&p.contactLeadAlignV1!<=.02,'invalid contact lead');}
  if(Object.hasOwn(p,'priorFooledChanceV1')){keys.push('priorFooledChanceV1');assert(Number.isFinite(p.priorFooledChanceV1)&&p.priorFooledChanceV1!>=0&&p.priorFooledChanceV1!<=1,'invalid prior fooled chance');}
  if(Object.hasOwn(p,'lateLookAccelerationV1')){keys.push('lateLookAccelerationV1');assert(Number.isFinite(p.lateLookAccelerationV1)&&p.lateLookAccelerationV1!>=1&&p.lateLookAccelerationV1!<=300,'invalid late look acceleration');}
  if(Object.hasOwn(p,'priorExpectationV1')){keys.push('priorExpectationV1');assert(Array.isArray(p.priorExpectationV1)&&p.priorExpectationV1.length===2&&p.priorExpectationV1[0]>=0&&p.priorExpectationV1[0]<=1&&p.priorExpectationV1[1]>0&&p.priorExpectationV1[1]<=200,'invalid prior expectation');}
  if(Object.hasOwn(p,'swingDecisionNoiseV1')){keys.push('swingDecisionNoiseV1');assert(Number.isFinite(p.swingDecisionNoiseV1)&&p.swingDecisionNoiseV1!>=.01&&p.swingDecisionNoiseV1!<=2,'invalid swing decision noise');}
  if(Object.hasOwn(p,'placementJudgedV1')){keys.push('placementJudgedV1');assert(Number.isFinite(p.placementJudgedV1)&&p.placementJudgedV1!>=0&&p.placementJudgedV1!<=1,'invalid judged placement');}
  if(Object.hasOwn(p,'priorPlacementShareV1')){keys.push('priorPlacementShareV1');assert(Number.isFinite(p.priorPlacementShareV1)&&p.priorPlacementShareV1!>=0&&p.priorPlacementShareV1!<=1,'invalid prior placement share');}
  if(Object.hasOwn(p,'lateLookByMeetOnlyV1')){keys.push('lateLookByMeetOnlyV1');assert(typeof p.lateLookByMeetOnlyV1==='boolean','invalid late look source');}
  if(Object.hasOwn(p,'barrelVibrationLossV1')){keys.push('barrelVibrationLossV1');assert(Array.isArray(p.barrelVibrationLossV1)&&p.barrelVibrationLossV1.length>=2&&p.barrelVibrationLossV1.length<=4&&p.barrelVibrationLossV1.every((v:unknown,i:number)=>typeof v==='number'&&(i<2?v>=.01&&v<=1:i===2?v>=0&&v<1:v>=.5&&v<=4)),'invalid barrel vibration loss');}
  if(Object.hasOwn(p,'aimTailV1')){keys.push('aimTailV1');assert(Array.isArray(p.aimTailV1)&&p.aimTailV1.length===2&&p.aimTailV1[0]>=0&&p.aimTailV1[0]<=.5&&p.aimTailV1[1]>=1&&p.aimTailV1[1]<=10,'invalid aim tail');}
  if(Object.hasOwn(p,'timingTailV1')){keys.push('timingTailV1');assert(Array.isArray(p.timingTailV1)&&p.timingTailV1.length===2&&p.timingTailV1[0]>=0&&p.timingTailV1[0]<=.5&&p.timingTailV1[1]>=1&&p.timingTailV1[1]<=10,'invalid timing tail');}
  if(Object.hasOwn(p,'pitchRecognitionV1')){keys.push('pitchRecognitionV1');assert(Array.isArray(p.pitchRecognitionV1)&&p.pitchRecognitionV1.length===3&&p.pitchRecognitionV1[0]>=0&&p.pitchRecognitionV1[0]<=1&&p.pitchRecognitionV1[1]>0&&p.pitchRecognitionV1[1]<=30&&p.pitchRecognitionV1[2]>0&&p.pitchRecognitionV1[2]<=300,'invalid pitch recognition');}
  if(Object.hasOwn(p,'pitchRecognitionV2')){keys.push('pitchRecognitionV2');assert(Array.isArray(p.pitchRecognitionV2)&&(p.pitchRecognitionV2.length===2||p.pitchRecognitionV2.length===3)&&p.pitchRecognitionV2[0]>0&&p.pitchRecognitionV2[0]<=30&&p.pitchRecognitionV2[1]>0&&p.pitchRecognitionV2[1]<=500
    &&(p.pitchRecognitionV2.length===2||p.pitchRecognitionV2[2]>0&&p.pitchRecognitionV2[2]<=360),'invalid pitch recognition v2');}
  if(Object.hasOwn(p,'pitchFamiliarityV1')){keys.push('pitchFamiliarityV1');assert(Array.isArray(p.pitchFamiliarityV1)&&p.pitchFamiliarityV1.length===3
    &&p.pitchFamiliarityV1.every((v:unknown)=>typeof v==='number'&&v>=0&&v<=1)&&Object.hasOwn(p,'leagueReferencePitchesV1'),'invalid pitch familiarity');}
  if(Object.hasOwn(p,'leagueReferencePitchesV1')){keys.push('leagueReferencePitchesV1');const r=p.leagueReferencePitchesV1 as Record<string,unknown>;
    assert(r&&typeof r==='object'&&['R','L'].every(h=>Array.isArray(r[h])&&(r[h] as unknown[]).every(e=>{const x=e as {pitchType?:unknown;spinRadPerSecond?:Record<string,unknown>};
      return typeof x?.pitchType==='string'&&x.spinRadPerSecond!==undefined&&['x','y','z'].every(k=>typeof x.spinRadPerSecond![k]==='number'&&Number.isFinite(x.spinRadPerSecond![k] as number));})),
      'invalid league reference pitches');}
  if(Object.hasOwn(p,'pitchZoneLeanV2')){keys.push('pitchZoneLeanV2');assert(typeof p.pitchZoneLeanV2==='number'&&p.pitchZoneLeanV2>=0&&p.pitchZoneLeanV2<=5,'invalid pitch zone lean v2');}
  if(Object.hasOwn(p,'pitchTargetPlanV2')){keys.push('pitchTargetPlanV2');assert(typeof p.pitchTargetPlanV2==='number'&&p.pitchTargetPlanV2>=.0005&&p.pitchTargetPlanV2<=.5,'invalid pitch target plan v2');}
  if(Object.hasOwn(p,'speedPerceptionV1')){keys.push('speedPerceptionV1');assert(typeof p.speedPerceptionV1==='number'&&p.speedPerceptionV1>=0&&p.speedPerceptionV1<=.3,'invalid speed perception');}
  if(Object.hasOwn(p,'accelerationViewTimeV1')){keys.push('accelerationViewTimeV1');assert(typeof p.accelerationViewTimeV1==='number'&&p.accelerationViewTimeV1>=.01&&p.accelerationViewTimeV1<=2,'invalid acceleration view time');}
  if(Object.hasOwn(p,'accelerationPriorWeightV1')){keys.push('accelerationPriorWeightV1');assert(typeof p.accelerationPriorWeightV1==='number'&&p.accelerationPriorWeightV1>=0&&p.accelerationPriorWeightV1<=1,'invalid acceleration prior weight');}
  if(Object.hasOwn(p,'visionJudgmentV1')){keys.push('visionJudgmentV1');assert(Array.isArray(p.visionJudgmentV1)&&p.visionJudgmentV1.length===2&&p.visionJudgmentV1[0]>0&&p.visionJudgmentV1[0]<=.2&&p.visionJudgmentV1[1]>=5&&p.visionJudgmentV1[1]<=500,'invalid vision judgment');}
  if(Object.hasOwn(p,'fooledViewReferenceV1')){keys.push('fooledViewReferenceV1');assert(typeof p.fooledViewReferenceV1==='number'&&p.fooledViewReferenceV1>=.3&&p.fooledViewReferenceV1<=.7,'invalid fooled view reference');}
  if(Object.hasOwn(p,'fooledViewPowerV1')){keys.push('fooledViewPowerV1');assert(typeof p.fooledViewPowerV1==='number'&&p.fooledViewPowerV1>=0&&p.fooledViewPowerV1<=6,'invalid fooled view power');}
  if(Object.hasOwn(p,'viewTimeAimV1')){keys.push('viewTimeAimV1');assert(typeof p.viewTimeAimV1==='number'&&p.viewTimeAimV1>=0&&p.viewTimeAimV1<=6,'invalid view time aim');}
  if(Object.hasOwn(p,'viewTimeTimingV1')){keys.push('viewTimeTimingV1');assert(typeof p.viewTimeTimingV1==='number'&&p.viewTimeTimingV1>=0&&p.viewTimeTimingV1<=6,'invalid view time timing');}
  if(Object.hasOwn(p,'aimVerticalScaleV1')){keys.push('aimVerticalScaleV1');assert(typeof p.aimVerticalScaleV1==='number'&&p.aimVerticalScaleV1>=0&&p.aimVerticalScaleV1<=2,'invalid vertical aim scale');}
  if(Object.hasOwn(p,'undercutAimV1')){keys.push('undercutAimV1');assert(typeof p.undercutAimV1==='number'&&p.undercutAimV1>=0&&p.undercutAimV1<=.05,'invalid undercut aim');}
  if(Object.hasOwn(p,'postContactHoldV1')){keys.push('postContactHoldV1');assert(typeof p.postContactHoldV1==='boolean','invalid post-contact hold');}
  if(Object.hasOwn(p,'contactSpeedCeilingV1')){keys.push('contactSpeedCeilingV1');assert(typeof p.contactSpeedCeilingV1==='boolean','invalid contact speed ceiling');}
  if(Object.hasOwn(p,'twoStrikeExpansionV1')){keys.push('twoStrikeExpansionV1');assert(Number.isFinite(p.twoStrikeExpansionV1)&&p.twoStrikeExpansionV1!>=0&&p.twoStrikeExpansionV1!<=1,'invalid two strike expansion');}
  assert(p&&typeof p==='object'&&!Array.isArray(p)&&Object.keys(p).length===keys.length&&keys.every(key=>Object.hasOwn(p,key))
    &&p.version==='live_batter_observation_v151'&&typeof p.sourceId==='string'&&p.sourceId.trim()===p.sourceId&&p.sourceId.length>0&&p.sourceId.length<=150,
  'invalid explicit position observation policy');
  assert([p.ticksPerSecond,p.decisionAfterReleaseTicks,p.positionSampleIntervalTicks].every(value=>Number.isSafeInteger(value)&&value>0)
    &&Number.isSafeInteger(p.deliveryLatencyTicks)&&p.deliveryLatencyTicks>=0
    &&Number.isFinite(p.maximumForecastAfterReleaseSeconds)&&p.maximumForecastAfterReleaseSeconds>0&&p.maximumForecastAfterReleaseSeconds<=2.5
    &&p.decisionAfterReleaseTicks<=p.maximumForecastAfterReleaseSeconds*p.ticksPerSecond
    &&Math.ceil(p.maximumForecastAfterReleaseSeconds*p.ticksPerSecond/p.positionSampleIntervalTicks)<=512,
  'invalid observation clock or bounded sampling window');
  return Object.freeze({...p,memoryPolicy:validateBatterObservedMemoryPolicyV151(p.memoryPolicy)});
}

/** The physical owner exposes only a position and its canonical event tick.
 * Missing finite Source windows stop capture; no window extension is inferred. */
export function createLiveBatterPositionObserverV151(input:Readonly<{policy:LiveBatterObservationPolicyV151;originTick:number;planeZ:number;forecastPolicyV246?:ObservedPitchForecastPolicyV246;motorLatencySeconds?:number}>,
  positionAtSeconds:(seconds:number)=>Readonly<{tick:number;position:Vec3}>|null, captureSnapshotV222=false) {
  const p=validateLiveBatterObservationPolicyV151(input.policy),origin=input.originTick,planeZ=input.planeZ;
  assert(Number.isSafeInteger(origin)&&origin>=0&&Number.isFinite(planeZ)
    &&Number.isSafeInteger(origin+Math.ceil(p.maximumForecastAfterReleaseSeconds*p.ticksPerSecond)+p.deliveryLatencyTicks),'invalid origin or observation plane');
  const deepFreeze=<T>(value:T):T=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(deepFreeze);Object.freeze(value)}return value};
  const policyDescriptor=Object.getOwnPropertyDescriptor(input,'forecastPolicyV246');
  assert(policyDescriptor===undefined||'value' in policyDescriptor,'V246 policy must be inert data');
  const policyV246=policyDescriptor===undefined?undefined:deepFreeze(cloneInert(policyDescriptor.value as ObservedPitchForecastPolicyV246));
  if(policyDescriptor!==undefined)forecastObservedPitchV246({originTick:origin,ticksPerSecond:p.ticksPerSecond,cutoffTick:origin,planeZ,maximumAfterReleaseSeconds:p.maximumForecastAfterReleaseSeconds,observations:[]},policyV246!);
  const observationsV246=new Map<number,readonly ObservedPitchPositionV151[]>(),resultsV246=new Map<number,ReturnType<typeof forecastObservedPitchV246>>();
  const cache=new Map<number,ReturnType<typeof forecastObservedPitchV151>>(), snapshots=new Map<number,Readonly<{originTick:number;ticksPerSecond:number;cutoffTick:number;planeZ:number;maximumAfterReleaseSeconds:number;observations:readonly ObservedPitchPositionV151[];forecast:ReturnType<typeof forecastObservedPitchV151>}>>();
  function forecastAt(cutoffTick:number) {
    assert(Number.isSafeInteger(cutoffTick)&&cutoffTick>=origin,'invalid observation cutoff');
    const previous=cache.get(cutoffTick);if(previous)return previous;
    const observations:ObservedPitchPositionV151[]=[],through=Math.min(cutoffTick-origin-p.deliveryLatencyTicks,
      Math.floor(p.maximumForecastAfterReleaseSeconds*p.ticksPerSecond));
    for(let offset=p.positionSampleIntervalTicks;offset<=through;offset+=p.positionSampleIntervalTicks){
      const sampled=positionAtSeconds(offset/p.ticksPerSecond);if(sampled===null)break;
      assert(Number.isSafeInteger(sampled.tick)&&sampled.tick>=origin&&Number.isFinite(sampled.position.x)
        &&Number.isFinite(sampled.position.y)&&Number.isFinite(sampled.position.z),'invalid Source position sample');
      if(observations.at(-1)?.observedTick===sampled.tick)continue;
      observations.push({observationId:p.sourceId+':'+sampled.tick,observedTick:sampled.tick,
        availableTick:sampled.tick+p.deliveryLatencyTicks,position:{...sampled.position}});
      if(sampled.position.z<=planeZ)break;
    }
    if(policyV246)observationsV246.set(cutoffTick,deepFreeze(cloneInert(observations.filter(o=>o.observedTick<=cutoffTick&&o.availableTick<=cutoffTick).sort((a,b)=>a.observedTick-b.observedTick).slice(-7))));
    const result=forecastObservedPitchV151({originTick:origin,ticksPerSecond:p.ticksPerSecond,cutoffTick,planeZ,
      maximumAfterReleaseSeconds:p.maximumForecastAfterReleaseSeconds,observations});cache.set(cutoffTick,result);
    if(captureSnapshotV222){const selected=result.usedObservationIds.map(id=>observations.find(o=>o.observationId===id)!);
      snapshots.set(cutoffTick,deepFreeze(cloneInert({originTick:origin,ticksPerSecond:p.ticksPerSecond,cutoffTick,planeZ,maximumAfterReleaseSeconds:p.maximumForecastAfterReleaseSeconds,observations:selected,forecast:result})));}
    return result;
  }
  function forecastAtV246(cutoffTick:number) {
    assert(policyV246,'V246 policy not supplied');forecastAt(cutoffTick);const cached=resultsV246.get(cutoffTick);if(cached)return cached;
    const observations=observationsV246.get(cutoffTick)!;const result=deepFreeze(forecastObservedPitchV246({originTick:origin,ticksPerSecond:p.ticksPerSecond,cutoffTick,planeZ,maximumAfterReleaseSeconds:p.maximumForecastAfterReleaseSeconds,observations},policyV246));resultsV246.set(cutoffTick,result);return result;
  }
  /** Each step reads only what was observed by that tick, so the commitment
   * time comes from the batter's own forecast and never from the true arrival. */
  function commitTick() {
    let tick=origin+p.decisionAfterReleaseTicks;
    if(p.commitSwingSeconds===undefined)return tick;
    const lead=p.commitSwingSeconds+(input.motorLatencySeconds??0);
    for(;;){
      const seen=forecastAt(tick).prediction;
      if(!seen||(tick-origin)/p.ticksPerSecond+lead>=seen.arrivalAfterReleaseSeconds)return tick;
      const next=tick+p.positionSampleIntervalTicks;
      if(next-origin>p.maximumForecastAfterReleaseSeconds*p.ticksPerSecond||forecastAt(next).status!=='PREDICTED')return tick;
      tick=next;
    }
  }
  return Object.freeze({policy:p,decisionTick:commitTick(),forecastAt,
    ...(captureSnapshotV222?{snapshotAt:(cutoffTick:number)=>{forecastAt(cutoffTick);return snapshots.get(cutoffTick)}}:{}),
    ...(policyV246?{forecastAtV246,snapshotAtV246:(cutoffTick:number)=>{const result=forecastAtV246(cutoffTick);return deepFreeze({version:'live_observed_forecast_snapshot_v246' as const,originTick:origin,ticksPerSecond:p.ticksPerSecond,cutoffTick,planeZ,maximumAfterReleaseSeconds:p.maximumForecastAfterReleaseSeconds,policy:policyV246,observations:observationsV246.get(cutoffTick)!,result});}}:{})});
}
