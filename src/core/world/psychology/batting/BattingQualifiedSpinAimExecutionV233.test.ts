import { expect, it } from 'vitest';
import { fixture, value } from './BattingFixtures.test-support';
import * as api from './BattingCommitment';
function input(){const nominalRequest=fixture(),s=nominalRequest.source;return {nominalRequest,effectiveValues:{decision:s.decisionModel,
 motor:{motorLatencyTicks:s.motorLatencyTicks,technicalTimingOffsetTicks:s.technicalTimingOffsetTicks,maximumSweetSpotSpeedMps:s.maximumSweetSpotSpeedMps},
 repertoire:{repertoireId:s.repertoireId,repertoireVersion:s.repertoireVersion,profiles:s.profiles}},
 trialContext:{selectedProfile:{profileId:s.profiles[0].profile.profileId,version:s.profiles[0].profile.version},pair:{anchor:{x:0,y:1,z:0},target:{x:0,y:1.02,z:0}},
 transform:'PLATE_XY_TRANSLATION_V1',trace:{sourceId:'trial',observationIds:['capture'],cutoffTick:nominalRequest.currentFrame.time.tick,coordinateSystem:'NATIVE_RBOX_METERS_V1'}}};}
it('V233 qualified calculation preserves the V226 pure motor and TAKE values',()=>{
 for(const directive of ['SWING','TAKE'] as const){const x=input();if(directive==='TAKE')x.nominalRequest={...x.nominalRequest,source:{...x.nominalRequest.source,directive:'TAKE'}};
  const prior=value(api.calculateBattingObservedSpinAimTrialV226(x)),next=value(api.calculateBattingQualifiedSpinAimV233(x));expect(next.algorithm).toBe('batting-qualified-spin-aim-v233');expect({...next,algorithm:prior.algorithm}).toEqual(prior);}
});
