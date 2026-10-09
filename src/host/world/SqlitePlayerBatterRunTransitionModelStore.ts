import type { DatabaseSync } from 'node:sqlite';
import { sqliteJsonMetadataNodes as nodes } from './SqliteOwnershipMetadata';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { playerRunnerDecisionMotionModelEvidenceFromSqlite } from './SqlitePlayerRunnerDecisionMotionModelStore';
import { playerBatterRunTransitionModelInput as input, type AcceptedPlayerBatterRunTransitionModel as Source,
  type DurablePlayerBatterRunTransitionModel as Value } from './PlayerBatterRunTransitionModel';
import { batterRunArchiveFromSqlite, openBatterRunSourceArchive, type BatterRunArchiveOwner } from './BatterRunSourceArchive';
const table='world_player_batter_run_transition_models' as const;
const make=(db:DatabaseSync):BatterRunArchiveOwner<Source,Value>=>({
  input,
  derive(source){
    const runnerModel=playerRunnerDecisionMotionModelEvidenceFromSqlite(db).read(source.runnerModelReference.sourceId);
    if(!runnerModel||source.runnerModelReference.sourceHash!==hash(runnerModel.source)||source.runnerModelReference.snapshotHash!==hash(runnerModel)
      ||source.careerId!==runnerModel.source.careerId||source.playerId!==runnerModel.source.playerId
      ||source.personLinkSourceId!==runnerModel.source.personLinkSourceId||source.acceptedAtDay<runnerModel.source.acceptedAtDay
      ||source.parameters.ticksPerSecond!==runnerModel.source.motion.ticksPerSecond)throw new Error('batter-run original runner model, Person, day or clock differs');
    return freeze({source,runnerModel});
  },
  key:s=>json([s.careerId,s.playerId]),
  scope(s){
    const pair=(column:string,path:readonly string[])=>`EXISTS(SELECT 1 FROM (${nodes(column,path)}) o,
      json_each(CASE WHEN o.type='object' THEN o.value ELSE '{}' END) c,json_each(CASE WHEN o.type='object' THEN o.value ELSE '{}' END) p
      WHERE c.key='careerId' AND c.type='text' AND c.atom=? AND p.key='playerId' AND p.type='text' AND p.atom=?)`;
    return {sql:[pair('source_json',[]),pair('snapshot_json',['source']),pair('snapshot_json',['runnerModel','source']),pair('snapshot_json',['runnerModel','person'])].join(' OR '),
      values:[s.careerId,s.playerId,s.careerId,s.playerId,s.careerId,s.playerId,s.careerId,s.playerId]};
  },
});
export const playerBatterRunTransitionModelEvidenceFromSqlite=(db:DatabaseSync)=>batterRunArchiveFromSqlite(db,table,make(db));
export const openSqlitePlayerBatterRunTransitionModelStore=(path:string,authority?:Readonly<{readAcceptedModel(id:string):Source|null}>)=>
  openBatterRunSourceArchive(path,table,make,authority?.readAcceptedModel.bind(authority));
