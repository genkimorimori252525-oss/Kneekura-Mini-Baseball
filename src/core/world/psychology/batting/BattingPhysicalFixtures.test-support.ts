import { createCanonicalPlateAppearanceTimeline } from '../../../sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { asRuleProfileId } from '../../../model/RuleProfileRef';
import { prepareBattingExecution } from './BattingCommitment';
import { acceptBattingExecution } from './BattingAcceptance';
import { fixture, flight, value } from './BattingFixtures.test-support';
import type { BattingPhysicalRequest } from './BattingTypes';
export function physical(r=fixture(),actual=flight()):BattingPhysicalRequest {
 const p=value(prepareBattingExecution(r)),accepted=value(acceptBattingExecution(r,p));
 const currentFrame={...r.currentFrame,snapshotId:'physical-start',worldRevision:accepted.afterWorldRevision,
  time:{tick:p.commitment!.motorStartTick??p.commitment!.decisionTick,sequence:1}};
 return {currentFrame,currentEmotion:r.currentEmotion,accepted,sourceId:'actual-pitch',revision:0,ballId:r.source.ballId,
  playId:r.source.playId,pitchOrdinal:r.source.pitchOrdinal,actualTrajectory:actual,
  timeline:createCanonicalPlateAppearanceTimeline({ruleProfileId:asRuleProfileId('npb-2026'),inning:1,half:'top',outs:0,
   balls:r.source.count.balls,strikes:r.source.count.strikes,bases:{first:null,second:null,third:null},score:{away:0,home:0},playId:r.source.playId},0)};
}
