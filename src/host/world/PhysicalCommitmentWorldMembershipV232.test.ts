import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import type { SamePaPhysicalCommitment } from './SamePlateAppearancePhysicalEpisode';
import { samePaExecutionReference } from './SamePlateAppearanceExecutionFromSqlite';
import { describe, expect, it } from 'vitest';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { hashSpinAimDomainValueV228 as domainHash } from './SpinAimQualificationV228';
import { authenticatePhysicalCommitmentMembershipMetadataV232, assertQualificationDependencyRankV232, physicalCommitmentWorldEventV232 } from './PhysicalCommitmentWorldMembershipV232';
const ref = (owner: string, sourceId: string) => ({ owner, sourceId, sourceHash: hash(sourceId), snapshotHash: hash(['snapshot',sourceId]) });
const enrollment = ref('same_pa_enrollments','enrollment'), launch = ref('pa_physical_v1_launches','launch');
const source = { sourceId:'commit', sourceVersion:'v1', capability:'same_pa_physical_commitment_v1',
 viewReference:ref('pa_lifecycle_v1_execution_views','view'), launchReference:launch, previousOperationReference:ref('pa_physical_v1_cuts','cut'),
 inputReference:ref('batting_execution_v1_inputs','input'),intentReference:ref('batting_execution_v1_intents','intent') };
const snapshot={kind:'same_pa_physical_commitment_v1',stage:'committed',source,lineage:{enrollmentReference:enrollment,careerId:'career',gameId:'game',playId:7},
 pitchOrdinal:3,operationOrdinal:4,physicalPitchSourceId:'launch',beforeWorldRevision:0,afterWorldRevision:1,
 actionKey:json(['same-pa-effective-commitment-v1',enrollment,launch])};
const commitmentRef={owner:'pa_physical_v1_commitments',sourceId:source.sourceId,sourceHash:hash(source),snapshotHash:hash(snapshot)};
const row={source_id:source.sourceId,source_version:'v1',enrollment_source_id:'enrollment',career_id:'career',game_id:'game',play_id:7,
 physical_pitch_source_id:'launch',pitch_ordinal:3,operation_ordinal:4,view_source_id:'view',previous_owner:'pa_physical_v1_cuts',previous_source_id:'cut',
 canonical_key:json([enrollment,3,4]),source_json:json(source),source_hash:hash(source),snapshot_json:json(snapshot),snapshot_hash:hash(snapshot)};
const event={kind:'SAME_PA_EFFECTIVE_BATTING_COMMITMENT_V1',reference:commitmentRef,beforeWorldRevision:0,afterWorldRevision:1,actionKey:snapshot.actionKey};
const world={career_id:'career',world_revision:1,source_kind:event.kind,source_event_id:'commit',event_json:json(event)};
const claim={table:'pa_physical_v1_commitments',row,enrollmentSourceIds:['enrollment']};
const run=(claims=[claim],events=[world],prefix=[world])=>authenticatePhysicalCommitmentMembershipMetadataV232({careerId:'career',endWorldRevision:1,
 expectedWorldPrefixHash:domainHash(prefix),expectedWorldEventHash:domainHash(prefix[0]),prefix,claims,events});
describe('commitment World membership metadata',()=>{
 it('joins exact authenticated metadata before capability-dependent derivation',()=>{const r=run();expect(r.commitments).toHaveLength(1);expect(r.commitments[0].reference).toEqual(commitmentRef)});
 it('rejects tampered mirrors, World payload, orphan events and duplicate identities',()=>{
  expect(()=>run([{...claim,row:{...row,career_id:'other'}}])).toThrow();
  expect(()=>run([claim],[{...world,event_json:json({...event,afterWorldRevision:2})}])).toThrow();
  expect(()=>run([claim],[])).toThrow();expect(()=>run([claim,claim])).toThrow();
 });
 it('rejects changed prefix independently of candidate records',()=>{expect(()=>authenticatePhysicalCommitmentMembershipMetadataV232({careerId:'career',endWorldRevision:1,
  expectedWorldPrefixHash:domainHash([world]),expectedWorldEventHash:domainHash(world),prefix:[{...world,event_json:'{}'}],claims:[claim],events:[world]})).toThrow()});
 it('rejects orphan, altered fullref and duplicate resolution claims',()=>{
  const resolutionSource={sourceId:'resolution',sourceVersion:'v1',capability:'same_pa_physical_resolution_v1',viewReference:ref('pa_lifecycle_v1_execution_views','view'),
    launchReference:launch,previousOperationReference:commitmentRef,throughTick:10,commitmentReference:commitmentRef};
  const resolutionSnapshot={kind:'same_pa_physical_resolution_v1',stage:'resolved',source:resolutionSource,lineage:snapshot.lineage,pitchOrdinal:3,operationOrdinal:5,physicalPitchSourceId:'launch'};
  const resolutionRow={...row,source_id:'resolution',operation_ordinal:5,previous_owner:'pa_physical_v1_commitments',previous_source_id:'commit',
    canonical_key:json([enrollment,3,5]),source_json:json(resolutionSource),source_hash:hash(resolutionSource),snapshot_json:json(resolutionSnapshot),snapshot_hash:hash(resolutionSnapshot)};
  const resolutionClaim={table:'pa_physical_v1_resolutions',row:resolutionRow,enrollmentSourceIds:['enrollment']};
  expect(run([claim,resolutionClaim]).resolutionCandidates).toHaveLength(1);
  expect(()=>run([resolutionClaim])).toThrow();
  const changed={...commitmentRef,snapshotHash:hash('wrong')},badSource={...resolutionSource,previousOperationReference:changed,commitmentReference:changed},badSnapshot={...resolutionSnapshot,source:badSource};
  expect(()=>run([claim,{...resolutionClaim,row:{...resolutionRow,source_json:json(badSource),source_hash:hash(badSource),snapshot_json:json(badSnapshot),snapshot_hash:hash(badSnapshot)}}])).toThrow();
  expect(()=>run([claim,resolutionClaim,resolutionClaim])).toThrow();
 });
 it('accepts a resolution candidate after a committed cut without claiming ancestry or cutoff',()=>{
  const cut=ref('pa_physical_v1_cuts','committed-cut');
  const rs={sourceId:'resolution-after-cut',sourceVersion:'v1',capability:'same_pa_physical_resolution_v1',viewReference:ref('pa_lifecycle_v1_execution_views','view'),
    launchReference:launch,previousOperationReference:cut,throughTick:10,commitmentReference:commitmentRef};
  const snap={kind:'same_pa_physical_resolution_v1',stage:'resolved',source:rs,lineage:snapshot.lineage,pitchOrdinal:3,operationOrdinal:6,physicalPitchSourceId:'launch'};
  const rr={...row,source_id:rs.sourceId,operation_ordinal:6,previous_owner:cut.owner,previous_source_id:cut.sourceId,canonical_key:json([enrollment,3,6]),
    source_json:json(rs),source_hash:hash(rs),snapshot_json:json(snap),snapshot_hash:hash(snap)};
  const c={table:'pa_physical_v1_resolutions',row:rr,enrollmentSourceIds:['enrollment']};
  expect(run([claim,c]).resolutionCandidates).toEqual([{reference:{owner:'pa_physical_v1_resolutions',sourceId:rs.sourceId,sourceHash:hash(rs),snapshotHash:hash(snap)},commitmentReference:commitmentRef}]);
 });
 it('rejects an event prefix not equal to the World rows and cross-table aliases',()=>{
  expect(()=>run([claim],[world,{...world,source_event_id:'other'}])).toThrow();
  expect(()=>run([claim,{...claim,table:'pa_physical_v1_cuts'}])).toThrow();
 });
 it('enforces strictly older qualification rank before any re-entry',()=>{expect(()=>assertQualificationDependencyRankV232(2,1,2)).toThrow();expect(()=>assertQualificationDependencyRankV232(2,2,2)).toThrow();expect(()=>assertQualificationDependencyRankV232(1,1,2)).not.toThrow()});
});

it('preserves canonical World event values for saved normal commitments',()=>{
 const parse=createRequire(import.meta.url)('../../../tools/verification/live-debug-record.mjs') as {parseDebugRecord(s:string):{commitment:SamePaPhysicalCommitment}};
 for(const [path,capability] of [
  ['docs/verification/realism-debug-20261027/native-post-input-resolution-v210-01/records/checkpoint-10-normal-cut10-current-cal32-physical-world-checkpoint.lossless.json','same_pa_physical_commitment_v123'],
  ['work/native-observed-spin-aim-trial-v226-01/records/stage-15-normal-cut10-current-cal32-physical-world-checkpoint.lossless.json','same_pa_physical_observed_spin_aim_trial_v226'],
 ] as const){
  const {commitment}=parse.parseDebugRecord(readFileSync(path,'utf8'));expect(commitment.kind).toBe('same_pa_physical_commitment_v1');expect(commitment.source.capability).toBe(capability);
  const old={kind:'SAME_PA_EFFECTIVE_BATTING_COMMITMENT_V1',reference:samePaExecutionReference('pa_physical_v1_commitments',commitment),
   beforeWorldRevision:commitment.beforeWorldRevision,afterWorldRevision:commitment.afterWorldRevision,actionKey:commitment.actionKey};
  const current=physicalCommitmentWorldEventV232(commitment);expect(current).toEqual(old);expect(json(current)).toBe(json(old));expect(hash(current)).toBe(hash(old));
  if(commitment.source.capability==='same_pa_physical_commitment_v123'){
   const {spinBindingV123: _spin,...ordinary}=commitment.source;void _spin;
   const synthetic:SamePaPhysicalCommitment={...commitment,source:{...ordinary,capability:'same_pa_physical_commitment_v1'}};
   const legacy={...old,reference:samePaExecutionReference('pa_physical_v1_commitments',synthetic)};
   expect(json(physicalCommitmentWorldEventV232(synthetic))).toBe(json(legacy));
  }
 }
});
