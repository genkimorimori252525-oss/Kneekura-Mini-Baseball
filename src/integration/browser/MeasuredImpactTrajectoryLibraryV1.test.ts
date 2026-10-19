import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect, it } from 'vitest';
import { createReferenceBatKinematicsV1, type ReferenceBatKinematicsInputV1 } from '../../core/sim/contact/ReferenceBatKinematicsV1';
import { DEFAULT_IMPACT_TRAJECTORY_V1, withReferenceImpactTrajectoryV1 } from '../../core/sim/contact/ReferenceBatImpactTrajectoryV1';
import { IDENTITY_QUATERNION } from '../../core/sim/pitching/BaseballOrientation';
import { registerMeasuredBatToFieldV1 } from './MeasuredBatFieldRegistrationV1';
import type { LiveMeasuredClipV1 } from './LivePitchV1';
import { createLiveBaseballMatchV1, LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1 } from './LiveBaseballMatchV1';
import { liveMatchFixture } from './LiveBaseballMatchV1.test-support';

let cachedClips:LiveMeasuredClipV1[]|undefined;
function fullCatalog(){
  if(cachedClips)return cachedClips;
  const root=new URL('../../../',import.meta.url),sandbox={} as {KneekuraMeasuredBatLibrary:{decode:(s:string)=>{clips:LiveMeasuredClipV1[]}}};
  runInNewContext(readFileSync(new URL('tools/browser-bridge/measured-bat-library-v1.js',root),'utf8'),sandbox);
  cachedClips=JSON.parse(JSON.stringify(sandbox.KneekuraMeasuredBatLibrary.decode(readFileSync(new URL('docs/demos/measured-bat-library-v1.json',root),'utf8')))).clips as LiveMeasuredClipV1[];
  return cachedClips;
}

it('admits all 673 measured forms and four research levels through the actual shared continuous Core sampler', () => {
  const clips=fullCatalog();
  expect(clips).toHaveLength(673); expect(clips.filter(c => c.defaultSelection === true)).toHaveLength(12);
  let variants = 0, left = 0, right = 0;
  for (const clip of clips) {
    if (clip.side === 'L') left++; else right++;
    const input: ReferenceBatKinematicsInputV1 = { provenance: { clipId: clip.id, sourceSha256: clip.source.sha256 },
      frames: registerMeasuredBatToFieldV1(clip.frames), batLengthM: clip.normalization.batLengthM, sweetSpotT: clip.normalization.sweetSpotT,
      sourceTicksPerSecond: 1e6, startTick: 1e6, ticksPerSecond: 1e6, playbackRate: 1,
      transform: { rotation: IDENTITY_QUATERNION, translation: { x: 0, y: 0, z: 0 }, scale: 1 } },
      sourceContact = clip.contactTimeSeconds * 1e6, original = createReferenceBatKinematicsV1(input), oldContact = original.sampleAtSourceTick(sourceContact);
    for (const level of [1, 2, 3, 4] as const) {
      const adjusted = createReferenceBatKinematicsV1(withReferenceImpactTrajectoryV1(input, sourceContact, { ...DEFAULT_IMPACT_TRAJECTORY_V1, level })),
        contact = adjusted.sampleAtSourceTick(sourceContact), d = { x: contact.sweetSpot.x - oldContact.sweetSpot.x, y: contact.sweetSpot.y - oldContact.sweetSpot.y, z: contact.sweetSpot.z - oldContact.sweetSpot.z };
      expect(contact.tick).toBe(oldContact.tick); expect(Math.hypot(d.x, d.y, d.z)).toBeLessThan(1e-12);
      expect(Number.isFinite(adjusted.maximumSweetSpotSpeedMps)).toBe(true);
      expect(adjusted.maximumSweetSpotSpeedMps).toBeGreaterThanOrEqual(Math.hypot(contact.sweetSpotVelocity.x, contact.sweetSpotVelocity.y, contact.sweetSpotVelocity.z));
      for (const sourceTick of [input.frames[0].tick, sourceContact - 120_000, sourceContact + 70_000, input.frames.at(-1)!.tick])
        expect(adjusted.sampleAtSourceTick(sourceTick)).toEqual(original.sampleAtSourceTick(sourceTick));
      const length = Math.hypot(contact.state.pose.tip.x - contact.state.pose.grip.x, contact.state.pose.tip.y - contact.state.pose.grip.y, contact.state.pose.tip.z - contact.state.pose.grip.z);
      expect(length).toBeCloseTo(input.batLengthM, 10); variants++;
    }
  }
  expect({ left, right, variants }).toEqual({ left: 178, right: 495, variants: 2692 });
}, 120_000);
it('accepts the bounded full catalog while preserving old automatic pitch records and using new explicit forms',()=>{
  const fixture=liveMatchFixture(2468),clips=fullCatalog(),before=JSON.stringify(clips),
    old=createLiveBaseballMatchV1(fixture),expanded=createLiveBaseballMatchV1({...fixture,measuredClips:clips}),
    command={batting:'balanced' as const,pitchType:'auto',location:'auto',managedTeam:0 as const};
  for(let i=0;i<3;i++)expect(expanded.issuePitch(command)).toEqual(old.issuePitch(command));
  const playerId=fixture.teams[0].battingOrder[0],bats=fixture.players.find(p=>p.playerId===playerId)!.bats,
    selected=clips.find(c=>c.side===bats&&!c.defaultSelection)!,edited={...fixture,measuredClips:clips,players:fixture.players.map(p=>p.playerId===playerId?{...p,
      physical:{...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,clipId:selected.id,impactTrajectory:{...DEFAULT_IMPACT_TRAJECTORY_V1,level:3 as const}}}:p)},
    host=createLiveBaseballMatchV1(edited),record=host.issuePitch(command);
  expect((record.play.diagnostics as {measuredClipId:string}).measuredClipId).toBe(selected.id);
  expect((record.play.diagnostics as {impactTrajectory:{level:number}}).impactTrajectory.level).toBe(3);
  expect(JSON.stringify(clips)).toBe(before);
},120_000);
it('rejects unknown or wrong-handed form IDs and unsupported windows before issuing any pitch, without invoking accessors',()=>{
  const fixture=liveMatchFixture(2468),clips=fullCatalog(),playerId=fixture.teams[0].battingOrder[0],player=fixture.players.find(p=>p.playerId===playerId)!,
    opposite=clips.find(c=>c.side!==player.bats)!,valid=clips.find(c=>c.side===player.bats)!,
    edited=(clipId:string,afterSeconds=.06)=>({...fixture,measuredClips:clips,players:fixture.players.map(p=>p.playerId===playerId?{...p,
      physical:{...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,clipId,impactTrajectory:{...DEFAULT_IMPACT_TRAJECTORY_V1,afterSeconds}}}:p)});
  expect(()=>createLiveBaseballMatchV1(edited('obp-missing'))).toThrow(/unknown measured clip/);
  expect(()=>createLiveBaseballMatchV1(edited(opposite.id))).toThrow(/wrong batting side/);
  expect(()=>createLiveBaseballMatchV1(edited(valid.id,.3))).toThrow(/window exceeds/);
  let invoked=false;const raw=Object.defineProperty({...fixture},'measuredClips',{enumerable:true,get(){invoked=true;return clips;}});
  expect(()=>createLiveBaseballMatchV1(raw)).toThrow(/inert measured/);expect(invoked).toBe(false);
  const sparse=[...fixture.measuredClips];delete sparse[0];expect(()=>createLiveBaseballMatchV1({...fixture,measuredClips:sparse})).toThrow(/dense measured/);
  const duplicated=[...fixture.measuredClips,fixture.measuredClips[0]];expect(()=>createLiveBaseballMatchV1({...fixture,measuredClips:duplicated})).toThrow(/duplicate measured/);
},120_000);
