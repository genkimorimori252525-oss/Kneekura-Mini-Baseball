import { expect, it } from 'vitest';
import { validateSpinMotionBindingSourceV225 } from './SpinMotionBindingV225';
const h='a'.repeat(64),ref={owner:'world_spin_mastery_v123',sourceId:'mastery',sourceHash:h,snapshotHash:h};
const source={version:'spin_motion_binding_source_v225',sourceId:'binding',sourceVersion:'v1',careerId:'c',playerId:'p',personLinkSourceId:'link',acceptedAtDay:20,
 technique:'BACKSPIN',masteryReference:ref,evidenceReferences:[0,1,2].map(i=>({sourceEventId:'e'+i,sourceRef:{sourceId:'s'+i,sourceVersion:'1'},acceptedEvidenceHash:h,physicalProofHash:h})),
 ruleVersion:'ORIGINAL_DRILL_RELEASE_NEUTRAL_PLATE_V1'};
it('V225-P01 validates an immutable original-practice source without granting a future transfer',()=>{
 const value=validateSpinMotionBindingSourceV225(source,'binding');expect(value).toEqual(source);expect(Object.isFrozen(value)).toBe(true);expect(Object.isFrozen(value.evidenceReferences)).toBe(true);
});
it('V225-P02 rejects unknown rule, aliased events and nonstandard reference shape',()=>{
 for(const bad of [{...source,ruleVersion:'unknown'},{...source,evidenceReferences:[source.evidenceReferences[0],source.evidenceReferences[0],source.evidenceReferences[2]]},
  {...source,masteryReference:{...ref,sourceVersion:'extra'}},{...source,technique:'NOT_A_TECHNIQUE'}])expect(()=>validateSpinMotionBindingSourceV225(bad,'binding')).toThrow();
});

it('V225-P03 preserves actual plan and neutral anchor as separate exact values without technique-derived offsets',async()=>{
 const {deriveSpinMotionBindingV225}=await import('./SpinMotionBindingV225');const {actorHash}=await import('./PhysicalPlateAppearanceActorEvidenceFromSqlite');
 const mastery={source:{sourceId:'mastery',careerId:'c',playerId:'p',personLinkSourceId:'link',technique:'BACKSPIN',acceptedAtDay:10,repertoireRef:{sourceId:'rep',sourceVersion:'1'}},
  person:{personId:'person'},projection:{qualified:[{episodeId:'episode'}]},contacts:[0,1,2].map(i=>({eventId:'e'+i,proofHash:'a'.repeat(64),sourceRef:{sourceId:'s'+i,sourceVersion:'1'},profileRef:{profileId:'course',version:'1'}}))};
 const m=mastery as unknown as Parameters<typeof deriveSpinMotionBindingV225>[1],reference={owner:'world_spin_mastery_v123' as const,sourceId:'mastery',sourceHash:actorHash(m.source),snapshotHash:actorHash(m)};
 const input={...source,masteryReference:reference,evidenceReferences:source.evidenceReferences.map(e=>({...e,sourceRef:{...e.sourceRef}}))} as Parameters<typeof deriveSpinMotionBindingV225>[0];
 const evidence=source.evidenceReferences.map((ref,i)=>({sourceEventId:ref.sourceEventId,acceptedEvidenceHash:ref.acceptedEvidenceHash,physicalProofHash:ref.physicalProofHash,
  source:{sourceId:'s'+i,sourceVersion:'1',careerId:'c',playerId:'p',personLinkSourceId:'link',episodeId:'episode',atDay:8,ticksPerSecond:1_000_000,
   command:{kind:'BATTING_CONTACT',profileId:'course',profileVersion:'1',issuedTick:0,spinIntentV123:{technique:'BACKSPIN'},
    plan:{handedness:'R',targetBallCenterAtPlate:{x:.1,y:1.54,z:0},contactTick:800000},parameters:{ticksPerSecond:1_000_000,gravityY:0,aerodynamics:{airDensityKgM3:0,dragCoefficient:0}}}},
  model:{source:{personId:'person',repertoireRef:mastery.source.repertoireRef},repertoire:{sourceId:'rep'},equipment:{sourceId:'equip'}},
  plannedDelivery:{release:{releaseAtUs:100000,position:{x:.1,y:1.52,z:17},velocity:{x:0,y:0,z:-30}}},consumedRelease:{attemptId:'pitch'},implementationFamily:'COURSE_AWARE_V1',contact:{},ball:{}})) as unknown as Parameters<typeof deriveSpinMotionBindingV225>[2];
 const value=deriveSpinMotionBindingV225(input,m,evidence);expect(value.futureTransferProven).toBe(false);expect(value.observations[0].neutralAnchor.y).toBe(1.52);
 expect(value.observations[0].absoluteTarget.y).toBe(1.54);expect(value.observations[0].targetAnchorOperation).toBe('EXACT_TARGET_ANCHOR_PAIR_NO_TRANSFER');
 const bad=structuredClone(evidence);(bad[0].source.command.parameters as {gravityY:number}).gravityY=-9.81;
 expect(()=>deriveSpinMotionBindingV225(input,m,bad)).toThrow(/outside declared rule/);
});
