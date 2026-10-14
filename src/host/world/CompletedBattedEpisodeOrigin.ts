import type {DatabaseSync} from 'node:sqlite';
import type {AcceptedPhysicalPlayClosure} from './SqlitePhysicalPlayClosureStore';
import {cloneInert} from '../../core/adjudication/OfficialWindowPolicy';
import {actorJson as json,actorHash as hash,actorFreeze as freeze,readPhysicalPlateAppearanceActorFromSqlite,type DurablePhysicalPlateAppearanceActor} from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import {readPhysicalClosureProposal,assertPhysicalClosureStages,readPhysicalClosureWorkload} from './PhysicalPlayClosureEvidenceFromSqlite';
import {sqliteJsonMetadataNodes} from './SqliteOwnershipMetadata';
import {foulTerminalNextPlayReadinessFromSqlite} from './FoulTerminalNextPlayReadiness';

export type CompletedBattedEpisodeOrigin=Readonly<{kind:'physical_play_closure'|'foul_terminal_completion';sourceId:string}>;
export type CompletedBattedEpisodeOriginEvidence=Readonly<{applicationId:string;durableRevision:number;sourceHash:string;completionHash:string;
 match:DurablePhysicalPlateAppearanceActor['match'];world:DurablePhysicalPlateAppearanceActor['world'];baseCenters:AcceptedPhysicalPlayClosure['worldSetup']['baseCenters']}>;
const id=(v:unknown):v is string=>typeof v==='string'&&v.length>0&&v.trim()===v;
export const completedBattedEpisodeOriginInput=(raw:unknown):CompletedBattedEpisodeOrigin=>{
 const v=cloneInert(raw)as CompletedBattedEpisodeOrigin;
 if(!v||typeof v!=='object'||Array.isArray(v)||json(Object.keys(v).sort())!==json(['kind','sourceId'])
  ||!['physical_play_closure','foul_terminal_completion'].includes(v.kind)||!id(v.sourceId))throw new Error('completed episode origin reference differs');
 return freeze(v);
};
/** Historical completed evidence on the binding owner's private transaction.
 * Current/open-frame checks remain with that owner. An application hash alone
 * never establishes the physical closure, score or workload effects. */
export const readCompletedBattedEpisodeOrigin=(db:DatabaseSync,rawActor:DurablePhysicalPlateAppearanceActor,
 rawOrigin:CompletedBattedEpisodeOrigin):CompletedBattedEpisodeOriginEvidence=>{
 if(!db.isTransaction)throw new Error('completed episode origin requires the owner transaction');
 const origin=completedBattedEpisodeOriginInput(rawOrigin),actor=cloneInert(rawActor);
 if(!actor||!('activationApplicationId'in actor.source)||actor.origin.initialWorldHash!==null)throw new Error('completed episode origin requires an activated actor');
 const accepted=readPhysicalPlateAppearanceActorFromSqlite(db,actor.source.sourceId);
 if(!accepted||json(accepted)!==json(actor))throw new Error('completed episode actor archive differs');
 const applicationId=actor.source.activationApplicationId;
 let proof:CompletedBattedEpisodeOriginEvidence;
 if(origin.kind==='physical_play_closure'){
  if(actor.origin.actualLiveReadiness||actor.origin.foulTerminalReadiness)throw new Error('episode ordinary completion origin differs');
  const storage=db.prepare("SELECT name,type FROM main.sqlite_master WHERE lower(name)=lower('physical_play_closures')").all();
  if(storage.length!==1||storage[0].name!=='physical_play_closures'||storage[0].type!=='table')throw new Error('episode completed physical owner storage differs');
  const claims:readonly [string,readonly string[],string][]=[['source_json',['sourceId'],origin.sourceId],['source_json',['applicationId'],applicationId],
   ['proposal_json',['application','applicationId'],applicationId],['proposal_json',['expectedOfficial','receipt','applicationId'],applicationId],
   ['result_json',['sourceId'],origin.sourceId],['result_json',['official','receipt','applicationId'],applicationId]];
  const clauses=claims.map(([document,path])=>`EXISTS(SELECT 1 FROM (${sqliteJsonMetadataNodes(document,path)}) n,
   json_tree(CASE WHEN n.type IN ('array','object') THEN n.value ELSE json_quote(n.atom) END) claim WHERE claim.type='text' AND claim.atom=?)`);
  const rows=db.prepare('SELECT source_id,application_id FROM main.physical_play_closures WHERE source_id=? OR application_id=? OR '+clauses.join(' OR '))
   .all(origin.sourceId,applicationId,...claims.map(c=>c[2]));
  if(rows.length!==1||rows[0].source_id!==origin.sourceId||rows[0].application_id!==applicationId)throw new Error('episode completed physical ownership differs');
  const saved=readPhysicalClosureProposal(db,origin.sourceId);
  if(!saved||saved.row.status!=='COMPLETED'||saved.row.game_id!==actor.source.gameId||saved.source.applicationId!==applicationId)throw new Error('episode named physical closure is not completed for this actor');
  const binding=saved.proposal.physicalPitch.frame.bindings[0];
  if(!binding||(['careerId','competitionEditionId','fixtureEventId','gameDay']as const).some(key=>binding[key]!==actor.binding[key]))throw new Error('episode completed physical fixture or day differs');
  // Non-null authenticated workload below also requires scoring, effort and application through these stage checks.
  assertPhysicalClosureStages(db,saved.proposal);const workload=readPhysicalClosureWorkload(db,saved.proposal),official=saved.proposal.expectedOfficial;
  const result={sourceId:saved.source.sourceId,gameId:saved.row.game_id,playId:saved.row.play_id,official,scoring:saved.proposal.expectedScoring,workload};
  if(!workload||saved.row.result_json!==json(result)||!('activation'in official)||!('nextWorld'in official))throw new Error('episode physical closure effects or continuing result differ');
  if(official.receipt.applicationId!==applicationId||official.activation.applicationId!==applicationId||official.activation.previousPlayId!==saved.row.play_id)throw new Error('episode physical closure application lineage differs');
  proof={applicationId,durableRevision:official.receipt.durableRevision,sourceHash:hash(saved.source),completionHash:hash(result),match:official.activation.nextMatchState,world:official.nextWorld,baseCenters:saved.source.worldSetup.baseCenters};
 }else{
  if(actor.origin.actualLiveReadiness)throw new Error('episode terminal completion origin differs');
  const ready=foulTerminalNextPlayReadinessFromSqlite(db).readHistorical(origin.sourceId),archive=ready.archive,completion=archive.result.completion;
  const binding=archive.proposal.participants[0]?.binding;
  if(!binding||(['careerId','competitionEditionId','fixtureEventId','gameDay']as const).some(key=>binding[key]!==actor.binding[key]))throw new Error('episode completed terminal fixture or day differs');
  if(archive.proposal.gameId!==actor.source.gameId||archive.source.applicationId!==applicationId||ready.reference.terminalSourceId!==origin.sourceId
   ||json(actor.origin.foulTerminalReadiness)!==json(ready.reference)||completion.activation.applicationId!==applicationId)throw new Error('episode terminal completion lineage differs');
  proof={applicationId,durableRevision:archive.result.official.receipt.durableRevision,sourceHash:hash(archive.source),completionHash:completion.snapshotHash,match:completion.activation.nextMatchState,world:completion.nextWorld,baseCenters:completion.source.worldSetup.baseCenters};
 }
 const application=db.prepare('SELECT * FROM main.applications WHERE application_id=? AND match_id=?').get(applicationId,actor.source.gameId);
 if(!application||hash(application)!==actor.origin.applicationHash||proof.durableRevision!==actor.officialRevision
  ||json(proof.match)!==json(actor.match)||json(proof.world)!==json(actor.world))throw new Error('episode completed origin does not match the exact actor activation');
 return freeze(proof);
};
