import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, normalize } from 'node:path';
import { withSqliteReadTransaction } from '../../../src/host/world/SqliteReadTransaction.test-support';
import { actorHash, actorJson } from '../../../src/host/world/PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { actualRoleWorkloadAssessmentInput } from '../../../src/host/world/ActualRoleWorkloadAssessment';
import { readActualRoleWorkloadState } from '../../../src/host/world/ActualRoleWorkloadState';
import { assertNoLegacyPitchWorkloadCharge } from '../../../src/host/world/ActualRoleWorkloadChargeGuard';
import { readOfficialActorPersonLink } from '../../../src/host/world/SqliteOfficialInitialWorldStore';
import { actualLiveAdjudicationProfile } from '../../../src/host/world/ActualLiveAdjudicationSource';
import { getRuleProfile, NPB_2026_RULE_PROFILE } from '../../../src/core/rules/RuleProfile';
import { createPlayerWorkloadRecovery } from '../../../src/core/world/development/PlayerWorkloadRecovery';
import type { ActualLivePlayClosureProposal } from '../../../src/host/world/ActualLivePlayClosureEvidenceFromSqlite';
import type { AcceptedActualRoleWorkloadAssessment } from '../../../src/host/world/ActualRoleWorkloadAssessment';
import type { AcceptedPlayerWorkloadBaseline } from '../../../src/host/world/SqlitePlayerWorkloadRecoveryStore';
import type { ActualLiveOfficialPolicy } from '../../../src/host/world/ActualLiveAdjudicationSource';
import type { OriginalOfficialReplayReceipt } from './official-read-replay-helper';

const { DatabaseSync }=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const PLAYERS=['away-1','home-1','home-2','home-3','home-4','home-5','home-6','home-7','home-8','p2'];
const POLICY={policyId:'explicit-role-workload-fixture',version:'fixture-v1',availableAtDay:0,
  workloadFatiguePerUnit:0.01,travelFatiguePerKm:0.001,recoveryPerHour:0.1};
const fileHash=(path:string)=>createHash('sha256').update(readFileSync(path)).digest('hex');
const closed=(path:string,expected:string)=>{
  assert(isAbsolute(path)&&normalize(path)===path&&realpathSync(path)===path);
  assert(!existsSync(`${path}-wal`)||statSync(`${path}-wal`).size===0);assert.equal(fileHash(path),expected);
};
/** Prerequisites only, after the caller admits the original eight and replay six
 * raw pins. The unchanged artifact hash binds these cheap reads to that genuine
 * authentication. No physical reconstruction, accepted assessment or write runs. */
export const verifyActualRoleInputPrerequisites=(input:Readonly<{artifactPath:string;artifactSha256:string;
  originalReceipt:OriginalOfficialReplayReceipt;observation:Readonly<Record<string,unknown>>;observationSha256:string}>)=>{
  assert.equal(createHash('sha256').update(JSON.stringify(input.observation)).digest('hex'),input.observationSha256);
  const original=input.originalReceipt,observation=input.observation;
  assert.equal(original.output.path,input.artifactPath);assert.equal(original.output.sha256,input.artifactSha256);
  assert.deepEqual(observation.artifact,original.output);closed(input.artifactPath,input.artifactSha256);
  const db=new DatabaseSync(input.artifactPath,{readOnly:true});
  let report;
  try{report=withSqliteReadTransaction(db,()=>{
    assert.equal(db.prepare('PRAGMA query_only').get()!.query_only,1);assert.equal(db.isTransaction,true);
    assert.equal(db.prepare('PRAGMA database_list').all().find(row=>row.name==='main')!.file,input.artifactPath);
    assert.equal(db.prepare('PRAGMA journal_mode').get()!.journal_mode,'wal');
    const names=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(row=>String(row.name));
    const rowCounts=Object.fromEntries(names.map(name=>[name,Number(db.prepare(`SELECT count(*) AS n FROM "${name.replaceAll('"','""')}"`).get()!.n)]));
    assert.deepEqual(rowCounts,original.output.rowCounts);
    for(const table of ['actual_role_workload_assessments','actual_role_workload_settlements','world_player_workload_activities'])assert.equal(rowCounts[table]??0,0);
    for(const table of ['applications','physical_pitch_progress_actions','actual_first_base_play_ends','actual_live_play_fences'])assert.equal(rowCounts[table],1);
    const row=db.prepare('SELECT * FROM actual_live_play_closures WHERE source_id=?').get(original.closureSourceId);assert(row);
    const p=JSON.parse(String(row.proposal_json)) as ActualLivePlayClosureProposal,source=JSON.parse(String(row.source_json));
    assert.equal(row.source_hash,actorHash(source));assert.equal(row.source_json,actorJson(source));assert.deepEqual(source,p.source);
    assert.equal(row.proposal_hash,actorHash(p));assert.equal(row.proposal_json,actorJson(p));assert.equal(row.status,'OFFICIAL_APPLIED');
    assert.equal(p.source.sourceId,original.closureSourceId);assert.equal(p.application.applicationId,original.applicationId);
    assert.equal(row.application_id,original.applicationId);assert.equal(row.game_id,p.gameId);assert.equal(row.play_id,p.playId);
    assert.equal(observation.closureProposalHash,actorHash(p));assert.deepEqual(p.adjudicationReference,observation.adjudicationReference);
    assert.deepEqual(p.physicalEndReference,original.adjudicationEvidence.physicalEndReference);
    assert.deepEqual(p.wholeHistoryReference,original.adjudicationEvidence.wholeHistoryReference);
    assert('activation' in p.expectedOfficial,'bounded role input must continue the game');
    assert.deepEqual(p.expectedOfficial.receipt,original.officialReceipt);
    const match=db.prepare('SELECT * FROM matches WHERE match_id=?').get(p.gameId);assert(match);
    assert.equal(match.durable_revision,p.expectedOfficial.receipt.durableRevision);
    assert.equal(match.state_json,actorJson(p.expectedOfficial.activation.nextMatchState));
    assert.equal(match.activation_json,actorJson({activation:p.expectedOfficial.activation,nextWorld:p.expectedOfficial.nextWorld}));
    assert.equal(getRuleProfile(p.application.match.ruleProfileId),NPB_2026_RULE_PROFILE);
    const adj=db.prepare('SELECT * FROM actual_live_adjudications WHERE source_id=?').get(p.source.adjudicationSourceId);assert(adj);
    const adjSource=JSON.parse(String(adj.source_json)) as {sourceId:string;physicalEndSourceId:string;policy:ActualLiveOfficialPolicy|null};
    assert.equal(adj.source_id,adjSource.sourceId);assert.equal(adj.source_json,actorJson(adjSource));assert.equal(adj.source_hash,actorHash(adjSource));
    assert.equal(adj.snapshot_hash,p.adjudicationReference.snapshotHash);assert.equal(adjSource.physicalEndSourceId,p.physicalEndReference.sourceId);
    assert.equal(adj.snapshot_hash,actorHash(JSON.parse(String(adj.snapshot_json))));
    const profile=actualLiveAdjudicationProfile(p.application.match.ruleProfileId,adjSource.policy);
    assert.deepEqual(profile.officialWindows,{appeal:{available:true},review:{available:false},challenge:{available:false}});
    const actors=[...p.actors].sort((a,b)=>a.binding.playerId<b.binding.playerId?-1:a.binding.playerId>b.binding.playerId?1:0);
    assert.deepEqual(actors.map(a=>a.binding.playerId),PLAYERS);assert.equal(new Set(actors.map(a=>a.person.personId)).size,10);
    const references=actors.map(a=>({playerId:a.binding.playerId,personId:a.person.personId,clubId:a.binding.clubId,
      careerId:a.binding.careerId,gameId:a.binding.gameId,playId:p.playId,gameDay:a.binding.gameDay,bindingHash:actorHash(a.binding),personHash:actorHash(a.person)}));
    assert.deepEqual(references,observation.participantReferences);
    const assessments:AcceptedActualRoleWorkloadAssessment[]=[],addedBaselines:AcceptedPlayerWorkloadBaseline[]=[],retainedBaselines:AcceptedPlayerWorkloadBaseline[]=[];
    for(const [effortUnits,actor]of actors.entries()){
      const b=actor.binding;assert.equal(b.careerId,'career-a');assert.equal(b.gameId,p.gameId);assert.equal(b.gameDay,10);
      assert.equal(b.fixtureEventId,'fixture-1');assert.equal(b.rosterRevision,0);assert.equal(b.personLinkSourceId,`intake-${b.playerId}`);
      assert.equal(b.side,b.playerId==='away-1'?'AWAY':'HOME');assert.equal(b.clubId,b.playerId==='away-1'?'club-b':'club-a');
      const saved=db.prepare('SELECT binding_json FROM official_participant_bindings WHERE game_id=? AND player_id=?').get(p.gameId,b.playerId);assert(saved);
      assert.deepEqual(JSON.parse(String(saved.binding_json)),b);assert.deepEqual(readOfficialActorPersonLink(db,b),actor.person);
      assertNoLegacyPitchWorkloadCharge(db,{careerId:b.careerId,gameId:p.gameId,playId:p.playId,playerId:b.playerId});
      const assessment={sourceId:`fixture-total-effort:${b.playerId}`,sourceVersion:'fixture-v1',closureSourceId:p.source.sourceId,
        physicalEndReference:p.physicalEndReference,wholeHistoryReference:p.wholeHistoryReference,
        participantReference:{playerId:b.playerId,bindingHash:actorHash(b),personHash:actorHash(actor.person)},effortUnits,
        provenance:{assessmentSourceId:`explicit-fixture-assessment:${b.playerId}`,assessmentVersion:'fixture-v1',calibrationSourceId:'explicit-fixture-total-effort',calibrationVersion:'fixture-v1'}};
      assessments.push(actualRoleWorkloadAssessmentInput(assessment,assessment.sourceId));
      const state=readActualRoleWorkloadState(db,b.careerId,b.playerId,undefined,b.personLinkSourceId);
      if(state){
        assert.equal(b.playerId,'p2');assert.equal(state.revision,0);assert.equal(state.fatigue,0);assert.equal(state.effectiveDay,1);
        const baseline=JSON.parse(String(db.prepare('SELECT source_json FROM world_player_workload_baselines WHERE career_id=? AND player_id=?').get(b.careerId,b.playerId)!.source_json)) as AcceptedPlayerWorkloadBaseline;
        assert.deepEqual(baseline.policy,state.policy);assert(baseline.createdAtDay<=b.gameDay);retainedBaselines.push(baseline);
      }else{
        const baseline:AcceptedPlayerWorkloadBaseline={sourceId:`fixture-role-baseline:${b.playerId}`,sourceVersion:'fixture-v1',personLinkSourceId:b.personLinkSourceId,
          careerId:b.careerId,playerId:b.playerId,createdAtDay:b.gameDay,fatigue:0.1,recoveryCapacity:0.5,policy:POLICY};
        createPlayerWorkloadRecovery({careerId:baseline.careerId,playerId:baseline.playerId,createdAtDay:baseline.createdAtDay,
          fatigue:baseline.fatigue,recoveryCapacity:baseline.recoveryCapacity,policy:baseline.policy});addedBaselines.push(baseline);
      }
    }
    assert.deepEqual(retainedBaselines.map(b=>b.playerId),['p2']);assert.deepEqual(addedBaselines.map(b=>b.playerId),PLAYERS.slice(0,-1));
    assert.deepEqual(observation.preparedPlan,{kind:'pending',missingAssessments:PLAYERS,missingBaselines:PLAYERS.slice(0,-1)});
    assert.equal(rowCounts.world_player_workload_baselines,2);assert.equal(rowCounts.world_player_workload_heads,2);assert.equal(rowCounts.official_participant_bindings,18);
    assert.equal(db.prepare('SELECT total_changes() AS n').get()!.n,0);
    return {kind:'actual_role_prerequisites_only',wholePipelinePassed:false,readOnly:true,physicalContextReads:0,acceptedAssessments:0,acceptedBaselines:0,workloadActivitiesWritten:0,
      closureSourceId:p.source.sourceId,applicationId:p.application.applicationId,originalPlayId:p.playId,registeredRuleProfileId:profile.id,rowCounts,
      participantReferences:references,assessments,addedBaselines,retainedBaselines,recipeSha256:actorHash({assessments,addedBaselines,retainedBaselines}),
      pendingObligations:['all ten real assessment/freeze/workload effects','three real INSERT rollback witnesses','stale and interrupted settlement','complete retries/reopen','isolated accepted day-level recovery']};
  });assert.equal(db.isTransaction,false);}finally{db.close();}
  closed(input.artifactPath,input.artifactSha256);assert.equal(db.isOpen,false);return {...report,allConnectionsClosed:true,originalArtifactUnchanged:true};
};
