import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {simulateLivePitchV1,type LivePitchInputV1,type LiveMeasuredClipV1} from './LivePitchV1';
import {LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,LIVE_MATCH_PHYSICS_V1,createLiveBaseballMatchV1} from './LiveBaseballMatchV1';
import {createLiveBatPlaybackV88} from './LiveBatPlaybackV88';
import {applyLivePhysicalRosterV1} from './LivePhysicalRosterV1';
import {liveMatchFixture} from './LiveBaseballMatchV1.test-support';
const clips=JSON.parse(readFileSync(new URL('../../../docs/demos/measured-bat-motions.json',import.meta.url),'utf8')).clips as LiveMeasuredClipV1[];
const input=():LivePitchInputV1=>({originTick:1000000,seed:3,batter:{...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,heightMeters:1.8,bats:'R',
 maximumSweetSpotSpeedMps:50,targetSweetSpotSpeedMps:30,motorLatencySeconds:.04,timingStdSeconds:0,aimStdMeters:0},
 pitcher:{...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,commandStdMeters:0},measuredClips:clips,
 batting:'balanced',pitchType:'curve',location:'zone',physics:LIVE_MATCH_PHYSICS_V1});
const policy={version:'swing_policy_v121' as const,sourceId:'authored-test',effort:.8,compactness:.3,controlPriority:.5,
 effortVariation:0,twoStrikeEffortDelta:-.2,twoStrikeCompactnessDelta:.4,maximumClockAccelerationPerSecond:40};
it('PLV-02 preserves the prior 1/45/74/75 observed/intent/physical records',()=>{
 for(const plateVision of [1,45,74,75]){
  const base=input(),r=simulateLivePitchV1({...base,batter:{...base.batter,plateVision}}),hash=createHash('sha256')
   .update(JSON.stringify({frames:r.frames,contact:r.contact,call:r.call,endedAtTick:r.endedAtTick,diagnostics:r.diagnostics})).digest('hex');
  expect(hash).toMatchSnapshot(String(plateVision));
 }
});
it('connects personal continuous intent and clock to live physics and exact replay',()=>{
 const base=input(),r=simulateLivePitchV1({...base,batter:{...base.batter,swingPolicyV121:policy}});
 expect(r.diagnostics.swingMotorV121).toBeDefined();
 expect(r.diagnostics.swingMotorV121!.rampSeconds).toBeGreaterThan(0);
 expect(r.diagnostics.referenceMaximumSweetSpotSpeedMps).toBeLessThanOrEqual(50*(1+1e-10));
 const d=r.diagnostics.batPlaybackV88!;
 const replay=createLiveBatPlaybackV88({descriptor:d,measuredClip:clips.find(c=>c.id===r.clipId)!});
 for(let t=base.originTick;t<replay.throughTick;t+=7000)expect(replay.sampleAtTick(t)).toEqual(r.sampleBatAtTick(t));
});
it('uses legal late evidence without changing desired contact depth or motor intent',()=>{
 const base=input(),r=simulateLivePitchV1({...base,batter:{...base.batter,plateVision:100}}),d=r.diagnostics.lateEvidenceV121!;
 expect(d.headroom).toBe(1);expect(d.futureSourceUsed).toBe(false);
 expect(d.observedTick).toBeLessThanOrEqual(d.availableTick);
 expect(d.availableTick).toBeLessThanOrEqual(d.throughTick);
 expect(d.contactPlaneZ).toBe(r.diagnostics.battingSetupV94.contactPlaneZ);
});
it('old packets do not inherit a previously adopted swing policy or bat calibration',()=>{
 const fixture=liveMatchFixture(81),playerId=fixture.players[0].playerId,
  packet={version:'live_physical_roster_v1' as const,sourceId:'old-packet',entries:[{playerId,sourceId:'old',physical:{basis:'EXPLICIT_AUTHORED_SI_V1' as const}}]},
  edited=fixture.players.map(p=>p.playerId!==playerId?p:{...p,physical:{...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,swingPolicyV121:policy}}),
  projected=applyLivePhysicalRosterV1({players:edited,roster:packet});
 expect(projected.players[0].physical).not.toHaveProperty('swingPolicyV121');
 expect(packet.entries[0].physical).toEqual({basis:'EXPLICIT_AUTHORED_SI_V1'});
});
it('validates a calibrated target against the selected bat at import, including a lighter bat',()=>{
 const fixture=liveMatchFixture(81),playerId=fixture.players[0].playerId,model={modelId:'GENERIC_BAT_INERTIA_CALIBRATION_V121' as const,
  baselineBat:{lengthM:.84,massKg:.9,sweetSpotT:.8},calibration:{calibrationId:'authored-fixture',source:'test-only',inertiaExponent:.5,minimumInertiaRatio:.1,maximumInertiaRatio:10}},
  roster=(mass:number,target:number)=>({version:'live_physical_roster_v1' as const,sourceId:'calibrated',entries:[{playerId,sourceId:'author',physical:{basis:'EXPLICIT_AUTHORED_SI_V1' as const,
   batLengthM:.84,batMassKg:mass,sweetSpotT:.8,maximumSweetSpotSpeedMps:45,targetSweetSpotSpeedMps:target,batSwingCapacityV121:model}}]});
 expect(()=>applyLivePhysicalRosterV1({players:fixture.players,roster:roster(.45,50)})).not.toThrow();
 expect(()=>applyLivePhysicalRosterV1({players:fixture.players,roster:roster(1.8,40)})).toThrow('推定上限');
});
it('does not boost tiny-effort requests or stop Core on an unexecutable motor window',()=>{
 const base=input(),r=simulateLivePitchV1({...base,batter:{...base.batter,swingPolicyV121:{...policy,effort:.000001,maximumClockAccelerationPerSecond:.1}},batting:'balanced'});
 expect(r.diagnostics.swingMotorV121?.executable).toBe(false);
 expect(r.diagnostics.swingOffered).toBe(false);
 expect(r.diagnostics.unsupportedReason).toBe(null);
});
it('delivers an understood manager instruction only to the managed offense without changing slow policy',()=>{
 const fixture=liveMatchFixture(3),players=fixture.players.map(p=>({...p,physical:{...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,swingPolicyV121:policy}})),
  before=JSON.stringify(players),host=createLiveBaseballMatchV1({...fixture,players}),
  r=host.issuePitch({managedTeam:0,batting:'auto',pitchType:'auto',location:'auto',swingInstructionV121:{authority:'hard',effort:.4,compactness:.9}});
 expect((r.play.diagnostics as any).swingIntentV121).toMatchObject({effort:.4,compactness:.9,instructionAuthority:'hard'});
 expect(JSON.stringify(players)).toBe(before);
});
