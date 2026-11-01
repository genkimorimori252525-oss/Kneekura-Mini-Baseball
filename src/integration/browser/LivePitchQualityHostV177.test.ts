import { expect, it } from 'vitest';
import { createLiveBaseballMatchV1, LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1 } from './LiveBaseballMatchV1';
import { liveMatchFixture } from './LiveBaseballMatchV1.test-support';
import { createPitchSnapshotFromPresetV78 } from './LivePitchAuthoringV78';
import { buildPitcherWorkbenchInputV77, simulatePitcherWorkbenchV77 } from './PitcherWorkbenchV77';
import { setLiveTraitProfileV77 } from './LiveTraitRuntimeV77';
import { applyLivePhysicalRosterV1 } from './LivePhysicalRosterV1';
import type { LiveTraitRosterInputV1 } from './LiveTraitProfilesV1';
import type { simulateLivePitchV1 } from './LivePitchV1';

const states=['KIRE_CIRCLE','KIRE_DOUBLE_CIRCLE','THREATENING_DOUBLE_CIRCLE'] as const;
function fixture(){
  const game=liveMatchFixture(1234),pitcherId=game.teams[1].pitcherId,batterId=game.teams[0].battingOrder[0],catcherId=game.teams[1].defense.C,
    pitch=createPitchSnapshotFromPresetV78({presetId:'curve',pitchId:'saved-quality-curve',physical:LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1}),
    physical={...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,pitchRepertoireV78:{version:'pitch_repertoire_v78' as const,pitches:[pitch]}},
    roster:LiveTraitRosterInputV1={version:'live_physical_roster_v1',sourceId:'quality-roster-v177',
      entries:[{playerId:pitcherId,sourceId:'quality-pitcher-v177',physical}]};
  return {game,pitcherId,batterId,catcherId,pitch,roster};
}
function playersFor(data:ReturnType<typeof fixture>,roster:LiveTraitRosterInputV1){
  const players=data.game.players.map(player=>player.playerId===data.pitcherId?{...player,throws:'R' as const}:player);
  return applyLivePhysicalRosterV1({players,roster}).players;
}
function firstPitch(data:ReturnType<typeof fixture>,roster:LiveTraitRosterInputV1){
  const players=playersFor(data,roster),before=JSON.stringify(players),host=createLiveBaseballMatchV1({...data.game,players}),
    record=host.issuePitch({batting:'take',pitchType:'curve',pitchId:data.pitch.pitchId,location:'zone',managedTeam:1}),
    trialInput=buildPitcherWorkbenchInputV77({players,pitcherId:data.pitcherId,batterId:data.batterId,catcherId:data.catcherId,
      measuredClips:data.game.measuredClips,seed:(data.game.seed+Math.imul(1,0x9e3779b9))>>>0,
      pitchType:'curve',pitchId:data.pitch.pitchId,location:'zone'}),
    trial=simulatePitcherWorkbenchV77({pitch:trialInput,context:{pitcherId:data.pitcherId,batterId:data.batterId}}),
    diagnostic=record.play.diagnostics as ReturnType<typeof simulateLivePitchV1>['diagnostics'];
  expect(JSON.stringify(players)).toBe(before);
  expect(trial.pitch.diagnostics.sourceDescriptor).toStrictEqual(diagnostic.sourceDescriptor);
  return {trial,diagnostic};
}

it.each(states)('uses saved/reloaded %s through the ordinary Host and pitcher workbench',qualityState=>{
  const data=fixture(),before=JSON.stringify(data.roster),edited=setLiveTraitProfileV77({roster:data.roster,playerId:data.pitcherId,
    familyId:'breaking_ball_quality',stateId:qualityState}).roster,reloaded=JSON.parse(JSON.stringify(edited)) as LiveTraitRosterInputV1,
    {trial,diagnostic}=firstPitch(data,reloaded);
  expect(diagnostic.pitchQualityV177).toMatchObject({status:'APPLIED',requestSource:'PITCHER_PROFILE',request:{qualityState}});
  expect(trial.pitch.diagnostics.pitchQualityV177).toStrictEqual(diagnostic.pitchQualityV177);
  expect(reloaded.entries[0].physical).toStrictEqual(data.roster.entries[0].physical);
  expect(JSON.stringify(data.roster)).toBe(before);
});

it('restores the saved original physical pitch through both ordinary consumers when the selection is cleared',()=>{
  const data=fixture(),edited=setLiveTraitProfileV77({roster:data.roster,playerId:data.pitcherId,
    familyId:'breaking_ball_quality',stateId:states[2]}).roster,
    cleared=setLiveTraitProfileV77({roster:JSON.parse(JSON.stringify(edited)),playerId:data.pitcherId,
      familyId:'breaking_ball_quality',stateId:null}).roster,
    restored=firstPitch(data,cleared),original=firstPitch(data,data.roster);
  expect(restored.diagnostic).not.toHaveProperty('pitchQualityV177');
  expect(restored.diagnostic.sourceDescriptor).toStrictEqual(original.diagnostic.sourceDescriptor);
  expect(restored.trial.pitch.diagnostics.sourceDescriptor).toStrictEqual(original.trial.pitch.diagnostics.sourceDescriptor);
  expect(cleared.entries[0].physical).toStrictEqual(data.roster.entries[0].physical);
});
