import { expect, it } from 'vitest';
import { fixture, value } from './BattingFixtures.test-support';
import * as api from './BattingCommitment';
function input(){const nominalRequest=fixture(),s=nominalRequest.source;return {nominalRequest,effectiveValues:{decision:s.decisionModel,
 motor:{motorLatencyTicks:s.motorLatencyTicks,technicalTimingOffsetTicks:s.technicalTimingOffsetTicks,maximumSweetSpotSpeedMps:s.maximumSweetSpotSpeedMps},
 repertoire:{repertoireId:s.repertoireId,repertoireVersion:s.repertoireVersion,profiles:s.profiles}},
 trialContext:{selectedProfile:{profileId:s.profiles[0].profile.profileId,version:s.profiles[0].profile.version},pair:{anchor:{x:0,y:1,z:0},target:{x:0,y:1.02,z:0}},
 transform:'PLATE_XY_TRANSLATION_V1',trace:{sourceId:'trial',observationIds:['capture'],cutoffTick:nominalRequest.currentFrame.time.tick,coordinateSystem:'NATIVE_RBOX_METERS_V1'}}};}
it('V226-E01 uses selected trial motor after SWING with original selected prediction',()=>{
 const x=input(),before=structuredClone(x),v=value(api.calculateBattingObservedSpinAimTrialV226(x));expect(v.algorithm).toBe('batting-observed-spin-aim-trial-v226');
 expect(v.commitment?.action).toBe('SWING');expect(v.commitment?.profileId).toBe('controlled');expect(v.observedSpinAimTrialV226?.futureTransferProven).toBe(false);expect(x).toEqual(before);
});
it('V226-E02 keeps TAKE and rejects unknown trial fields without creating a motor',()=>{
 const x=input();x.nominalRequest={...x.nominalRequest,source:{...x.nominalRequest.source,directive:'TAKE'}};
 const v=value(api.calculateBattingObservedSpinAimTrialV226(x));expect(v.commitment?.action).toBe('TAKE');expect(v.observedSpinAimTrialV226).toBeNull();
 expect(api.calculateBattingObservedSpinAimTrialV226({...x,trialContext:{...x.trialContext,extra:true}}).ok).toBe(false);
});

it('V226-E03 does not run a failing default profile before the selected profile',()=>{
 const x=structuredClone(input()),profiles=x.nominalRequest.source.profiles;
 Object.assign(profiles[1],{minimumAggression:.01});Object.assign(profiles[1].profile,{baseContactSweetSpotSpeedMps:1000});
 x.effectiveValues.repertoire.profiles=profiles;
 expect(api.calculateBattingExecution({nominalRequest:x.nominalRequest,effectiveValues:x.effectiveValues}).ok).toBe(false);
 const trial=api.calculateBattingObservedSpinAimTrialV226(x);expect(trial.ok,JSON.stringify(trial)).toBe(true);if(!trial.ok)throw Error('selected profile failed');
 expect(trial.value.commitment?.profileId).toBe('controlled');
});
it('V226-E04 preserves missed motor window and speed failure',()=>{
 const missed=structuredClone(input());Object.assign(missed.nominalRequest.source,{latestMotorStartTick:missed.nominalRequest.currentFrame.time.tick});
 const result=value(api.calculateBattingObservedSpinAimTrialV226(missed));expect(result.status).toBe('MOTOR_WINDOW_MISSED');expect(result.commitment).toBeNull();
 const fast=structuredClone(input());fast.effectiveValues.motor.maximumSweetSpotSpeedMps=1;expect(api.calculateBattingObservedSpinAimTrialV226(fast).ok).toBe(false);
});
