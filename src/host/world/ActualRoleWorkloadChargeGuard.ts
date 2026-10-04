import { createHash } from 'node:crypto';
import type { DefensiveDb } from './ActualDefensiveContext';
import { defensiveMetadataId as identity } from './ActualDefensiveMetadata';
import { sqliteJsonMetadataNodes as nodes, type SqliteJsonMetadataPath } from './SqliteOwnershipMetadata';

export type ActualRoleWorkloadChargeScope = Readonly<{ careerId: string; gameId: string; playId: number; playerId: string }>;
type Mirror = readonly [document: string, path: SqliteJsonMetadataPath];
type ScopeMirrors = Readonly<Record<keyof ActualRoleWorkloadChargeScope, readonly Mirror[]>>;
const numericIdentity = (document: string, path: SqliteJsonMetadataPath) =>
  `EXISTS (SELECT 1 FROM (${nodes(document, path)}) charge_play WHERE charge_play.type IN ('integer','real') AND charge_play.atom=$playId)`;

/** Inspect ownership metadata only. Mixing index and raw JSON mirrors is deliberate:
 * a changed index, duplicate/escaped key, or aliased Source must not conceal a charge.
 * A matching claim fails closed even when the other owner's domain payload is corrupt.
 * No payload from unrelated games/players is hydrated or validated here. */
const assertUncharged = (db: DefensiveDb, scope: ActualRoleWorkloadChargeScope, table: string,
  playColumn: string, mirrors: ScopeMirrors, label: string): void => {
  if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table)) return;
  const columns = { careerId: 'career_id', gameId: 'game_id', playId: playColumn, playerId: 'player_id' };
  const claims = (Object.keys(columns) as (keyof ActualRoleWorkloadChargeScope)[]).map(key =>
    `(${columns[key]}=$${key} OR ${mirrors[key].map(([document, path]) => key === 'playId'
      ? numericIdentity(document, path) : identity(document, path, `$${key}`)).join(' OR ')})`);
  if (db.prepare(`SELECT 1 FROM ${table} WHERE ${claims.join(' AND ')} LIMIT 1`).get({
    careerId: scope.careerId, gameId: scope.gameId, playId: scope.playId, playerId: scope.playerId })) {
    throw new Error(`${label} workload charge already exists for this career/game/play/player`);
  }
};

const canonicalChargeId=(scope:ActualRoleWorkloadChargeScope,prefix:string)=>`${prefix}:${createHash('sha256').update(JSON.stringify([scope.careerId,scope.gameId,scope.playId,scope.playerId])).digest('hex')}`;

/** Canonical global activity survives loss/corruption of a producer row. */
const assertNoArchivedCharge=(db:DefensiveDb,scope:ActualRoleWorkloadChargeScope,prefix:string,label:string)=>{
  if(!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='world_player_workload_activities'").get())return;
  const sourceId=canonicalChargeId(scope,prefix);
  if(db.prepare(`SELECT 1 FROM world_player_workload_activities WHERE source_id=$sourceId OR ${identity('source_json',['sourceEventId'],'$sourceId')} LIMIT 1`).get({sourceId}))throw new Error(`${label} workload charge already exists in the global activity archive`);
  const legacy=prefix==='official-physical-pitch-workload',owner=legacy?'applications':'actual_first_base_play_ends';
  if(!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(owner))return;
  const belongs=`${identity('w.source_json',['careerId'],'$careerId')} AND ${identity('w.source_json',['playerId'],'$playerId')}
    AND ${identity('w.source_json',['kind'],"'MATCH'")} AND ${identity('w.source_json',['sourceVersion'],'$version')}`;
  const evidence=(value:string)=>identity('w.source_json',['evidenceId'],value);
  const reference=legacy?`(${evidence('e.application_id')} OR EXISTS(SELECT 1 FROM (${nodes('e.result_json',['receipt','applicationId'])}) original WHERE original.type='text' AND ${evidence('original.atom')}))`
    :`(${evidence('e.source_id')} OR EXISTS(SELECT 1 FROM (${nodes('e.source_json',['sourceId'])} UNION ALL ${nodes('e.snapshot_json',['source','sourceId'])}) original WHERE original.type='text' AND ${evidence('original.atom')}))`;
  const game=legacy?`(e.match_id=$gameId OR ${identity('e.result_json',['activation','gameId'],'$gameId')})`:`(e.game_id=$gameId OR ${identity('e.snapshot_json',['gameId'],'$gameId')})`;
  const play=legacy?numericIdentity('e.result_json',['receipt','previousPlayId']):`(e.play_id=$playId OR ${numericIdentity('e.snapshot_json',['playId'])})`;
  if(db.prepare(`SELECT 1 FROM world_player_workload_activities w,${owner} e WHERE ${belongs} AND ${reference} AND ${game} AND ${play} LIMIT 1`)
    .get({careerId:scope.careerId,playerId:scope.playerId,gameId:scope.gameId,playId:scope.playId,version:`${prefix}-v1`}))throw new Error(`${label} workload charge already exists through the global archive's original evidence`);
};

/** Called by the legacy pitch producer before/within writes and when replaying a Source. */
export const assertNoActualRoleWorkloadCharge = (db: DefensiveDb, scope: ActualRoleWorkloadChargeScope): void => {
  assertNoArchivedCharge(db,scope,'actual-total-play-workload','actual role');
  assertUncharged(db, scope, 'actual_role_workload_assessments', 'play_id', {
    careerId: [['snapshot_json', ['careerId']], ['snapshot_json', ['activity', 'careerId']], ['snapshot_json', ['actor', 'binding', 'careerId']]],
    gameId: [['snapshot_json', ['gameId']], ['snapshot_json', ['actor', 'binding', 'gameId']]],
    playId: [['snapshot_json', ['playId']]],
    playerId: [['source_json', ['participantReference', 'playerId']], ['snapshot_json', ['source', 'participantReference', 'playerId']],
      ['snapshot_json', ['playerId']], ['snapshot_json', ['activity', 'playerId']], ['snapshot_json', ['actor', 'binding', 'playerId']]],
  }, 'actual role');
  const installed=(table:string)=>!!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table);
  if(!installed('actual_role_workload_assessments'))return;
  if(db.prepare(`SELECT 1 FROM actual_role_workload_assessments WHERE ${identity('snapshot_json',['activity','sourceEventId'],'$id')} LIMIT 1`)
    .get({id:canonicalChargeId(scope,'actual-total-play-workload')}))throw new Error('actual role workload charge already exists through its canonical activity identity');
  if(!installed('actual_live_play_closures'))return;
  // The accepted Source owns references, not replacement career/game identities.
  // Recover their qualified scope claims from the original closure too, so moving
  // every copied/indexed scope mirror cannot launder that same accepted charge.
  const sourceClosure=(value:string)=>`r.closure_source_id=${value} OR ${identity('r.source_json',['closureSourceId'],value)} OR ${identity('r.snapshot_json',['source','closureSourceId'],value)}`;
  const sourceEnd=(value:string)=>`${identity('r.source_json',['physicalEndReference','sourceId'],value)} OR ${identity('r.snapshot_json',['source','physicalEndReference','sourceId'],value)}`;
  const closureSource=`(${sourceClosure('c.source_id')} OR EXISTS(SELECT 1 FROM (${nodes('c.proposal_json',['source','sourceId'])}) original_id WHERE original_id.type='text' AND (${sourceClosure('original_id.atom')})))`;
  const endSource=`EXISTS(SELECT 1 FROM (${nodes('c.proposal_json',['physicalEndReference','sourceId'])} UNION ALL ${nodes('c.proposal_json',['controllerReset','physicalEndReference','sourceId'])}) original_end WHERE original_end.type='text' AND (${sourceEnd('original_end.atom')}))`;
  const player=`(r.player_id=$playerId OR ${identity('r.source_json',['participantReference','playerId'],'$playerId')} OR ${identity('r.snapshot_json',['source','participantReference','playerId'],'$playerId')})`;
  const game=`(c.game_id=$gameId OR ${identity('c.proposal_json',['gameId'],'$gameId')} OR ${identity('c.proposal_json',['application','matchId'],'$gameId')})`;
  const play=`(c.play_id=$playId OR ${numericIdentity('c.proposal_json',['playId'])} OR ${numericIdentity('c.proposal_json',['application','match','playId'])})`;
  const career=`(${identity('c.proposal_json',['seasonFixture','careerId'],'$careerId')} OR ${identity('c.proposal_json',['actors',{array:'all'},'binding','careerId'],'$careerId')})`;
  if(db.prepare(`SELECT 1 FROM actual_role_workload_assessments r,actual_live_play_closures c WHERE ${game} AND ${play} AND ${career} AND ${player} AND (${closureSource} OR ${endSource}) LIMIT 1`)
    .get({careerId:scope.careerId,gameId:scope.gameId,playId:scope.playId,playerId:scope.playerId}))throw new Error('actual role workload charge already exists through its original closure/end reference');
};

/** Called by the total-play producer; the existing global workload owner stays unchanged. */
export const assertNoLegacyPitchWorkloadCharge = (db: DefensiveDb, scope: ActualRoleWorkloadChargeScope): void => {
  assertNoArchivedCharge(db,scope,'official-physical-pitch-workload','legacy pitch');
  assertUncharged(db, scope, 'official_pitch_workload_sources', 'played_play_id', {
    careerId: [['source_json', ['careerId']], ['proof_json', ['pitcher', 'binding', 'careerId']],
      ['proof_json', ['physicalProgress', 'frame', 'workload', 'careerId']]],
    gameId: [['proof_json', ['pitcher', 'binding', 'gameId']], ['proof_json', ['scoring', 'matchId']]],
    playId: [['proof_json', ['pitcher', 'playedPlayId']], ['proof_json', ['pitcher', 'activatedMatchState', 'playId']],
      ['proof_json', ['physicalProgress', 'frame', 'match', 'playId']]],
    playerId: [['source_json', ['playerId']], ['proof_json', ['pitcher', 'binding', 'playerId']],
      ['proof_json', ['physicalProgress', 'frame', 'workload', 'playerId']]],
  }, 'legacy pitch');
  const installed=(table:string)=>!!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table);
  if(!installed('official_pitch_workload_sources'))return;
  if(db.prepare(`SELECT 1 FROM official_pitch_workload_sources WHERE source_id=$id OR ${identity('source_json',['sourceEventId'],'$id')} LIMIT 1`)
    .get({id:canonicalChargeId(scope,'official-physical-pitch-workload')}))throw new Error('legacy pitch workload charge already exists through its canonical Source identity');
  const career=`(r.career_id=$careerId OR ${identity('r.source_json',['careerId'],'$careerId')} OR ${identity('r.proof_json',['pitcher','binding','careerId'],'$careerId')})`;
  const player=`(r.player_id=$playerId OR ${identity('r.source_json',['playerId'],'$playerId')} OR ${identity('r.proof_json',['pitcher','binding','playerId'],'$playerId')})`;
  const directApp=(value:string)=>`(${identity('r.source_json',['evidenceId'],value)} OR ${identity('r.proof_json',['pitcher','closureApplicationId'],value)}
    OR ${identity('r.proof_json',['scoring','officialApplicationId'],value)} OR ${identity('r.proof_json',['officialEvidence','closure','application_id'],value)}
    OR ${identity('r.proof_json',['officialEvidence','scoring','official_application_id'],value)})`;
  const sourceScore=(value:string)=>`(r.scoring_application_id=${value} OR ${identity('r.request_json',['scoringApplicationId'],value)}
    OR ${identity('r.proof_json',['scoring','scoringApplicationId'],value)} OR ${identity('r.proof_json',['officialEvidence','scoring','scoring_application_id'],value)})`;
  const scoreIdentity=`(${sourceScore('s.scoring_application_id')} OR EXISTS(SELECT 1 FROM (${nodes('s.request_json',['input','scoringApplicationId'])} UNION ALL ${nodes('s.result_json',['scoringApplicationId'])}) score_id
    WHERE score_id.type='text' AND ${sourceScore('score_id.atom')}))`;
  const scoreOfficial=(value:string)=>`(s.official_application_id=${value} OR ${identity('s.request_json',['input','officialApplication','applicationId'],value)} OR ${identity('s.result_json',['officialApplicationId'],value)})`;
  const hasScoring=installed('official_scoring_applications');
  const appClaim=(value:string)=>`(${directApp(value)}${hasScoring?` OR EXISTS(SELECT 1 FROM official_scoring_applications s WHERE ${scoreIdentity} AND ${scoreOfficial(value)})`:''})`;
  const params={careerId:scope.careerId,gameId:scope.gameId,playId:scope.playId,playerId:scope.playerId};
  if(installed('applications')){
    const application=`(${appClaim('a.application_id')} OR EXISTS(SELECT 1 FROM (${nodes('a.result_json',['receipt','applicationId'])}) original_app WHERE original_app.type='text' AND ${appClaim('original_app.atom')}))`;
    const game=`(a.match_id=$gameId OR ${identity('a.result_json',['activation','gameId'],'$gameId')})`;
    const play=numericIdentity('a.result_json',['receipt','previousPlayId']);
    if(db.prepare(`SELECT 1 FROM official_pitch_workload_sources r,applications a WHERE ${game} AND ${play} AND ${career} AND ${player} AND ${application} LIMIT 1`).get(params))throw new Error('legacy pitch workload charge already exists through its original official application reference');
  }
  if(hasScoring){
    const game=`(s.match_id=$gameId OR ${identity('s.request_json',['input','officialApplication','matchId'],'$gameId')} OR ${identity('s.result_json',['matchId'],'$gameId')})`;
    const play=numericIdentity('s.request_json',['input','officialApplication','match','playId']);
    if(db.prepare(`SELECT 1 FROM official_pitch_workload_sources r,official_scoring_applications s WHERE ${game} AND ${play} AND ${career} AND ${player} AND ${scoreIdentity} LIMIT 1`).get(params))throw new Error('legacy pitch workload charge already exists through its original scoring application reference');
  }
};
