import { assertNoSamePaWorkReservation } from './SamePlateAppearanceReservationGuard';
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
const installed=(db:DefensiveDb,table:string)=>!!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table);
const scopeParameters=(scope:ActualRoleWorkloadChargeScope)=>({careerId:scope.careerId,gameId:scope.gameId,playId:scope.playId,playerId:scope.playerId});
const mirrorClaim=(mirrors:readonly Mirror[],value:string)=>mirrors.map(([document,path])=>identity(document,path,value)).join(' OR ');
/** Compare every original identity occurrence, rather than JSON.parse's last key. */
const originalReference=(index:string,mirrors:readonly Mirror[],claim:(value:string)=>string)=>
  `((${claim(index)}) OR EXISTS(SELECT 1 FROM (${mirrors.map(([document,path])=>nodes(document,path)).join(' UNION ALL ')}) charge_original
    WHERE charge_original.type='text' AND (${claim('charge_original.atom')})))`;
const endReference=(claim:(value:string)=>string)=>originalReference('e.source_id',[
  ['e.source_json',['sourceId']],['e.snapshot_json',['source','sourceId']],
],claim);
const endGame=`(e.game_id=$gameId OR ${identity('e.snapshot_json',['gameId'],'$gameId')})`;
const endPlay=`(e.play_id=$playId OR ${numericIdentity('e.snapshot_json',['playId'])})`;
const terminalGame=`(t.game_id=$gameId OR ${identity('t.proposal_json',['gameId'],'$gameId')}
  OR ${identity('t.proposal_json',['applicationBody','matchId'],'$gameId')}
  OR ${identity('t.result_json',['acknowledgement','applicationReference','matchId'],'$gameId')})`;
const terminalPlay=`(t.play_id=$playId OR ${numericIdentity('t.proposal_json',['playId'])}
  OR ${numericIdentity('t.proposal_json',['applicationBody','match','playId'])}
  OR ${numericIdentity('t.result_json',['acknowledgement','applicationReference','previousPlayId'])})`;
const terminalCareer=`(${identity('t.proposal_json',['seasonFixture','careerId'],'$careerId')}
  OR ${identity('t.proposal_json',['participants',{array:'all'},'binding','careerId'],'$careerId')})`;
const terminalPlayer=identity('t.proposal_json',['participants',{array:'all'},'binding','playerId'],'$playerId');
const terminalReference=(claim:(value:string)=>string)=>originalReference('t.source_id',[
  ['t.source_json',['sourceId']],['t.proposal_json',['source','sourceId']],['t.result_json',['sourceId']],
],claim);
const terminalEndReference=(claim:(value:string)=>string)=>originalReference('t.physical_end_source_id',[
  ['t.source_json',['physicalEndReference','sourceId']],['t.proposal_json',['physicalEndReference','sourceId']],
  ['t.proposal_json',['source','physicalEndReference','sourceId']],['t.result_json',['acknowledgement','physicalEndReference','sourceId']],
],claim);
const terminalApplicationReference=(claim:(value:string)=>string)=>originalReference('t.application_id',[
  ['t.source_json',['applicationId']],['t.proposal_json',['source','applicationId']],
  ['t.proposal_json',['applicationBody','applicationId']],['t.result_json',['official','receipt','applicationId']],
  ['t.result_json',['acknowledgement','applicationReference','applicationId']],
],claim);

/** Canonical global activity survives loss/corruption of a producer row. */
const assertNoArchivedCharge=(db:DefensiveDb,scope:ActualRoleWorkloadChargeScope,prefix:string,label:string)=>{
  if(!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='world_player_workload_activities'").get())return;
  const sourceId=canonicalChargeId(scope,prefix);
  if(db.prepare(`SELECT 1 FROM world_player_workload_activities WHERE source_id=$sourceId OR ${identity('source_json',['sourceEventId'],'$sourceId')} LIMIT 1`).get({sourceId}))throw new Error(`${label} workload charge already exists in the global activity archive`);
  const legacy=prefix==='official-physical-pitch-workload';
  const belongs=`${identity('w.source_json',['careerId'],'$careerId')} AND ${identity('w.source_json',['playerId'],'$playerId')}
    AND ${identity('w.source_json',['kind'],"'MATCH'")} AND ${identity('w.source_json',['sourceVersion'],'$version')}`;
  const evidence=(value:string)=>identity('w.source_json',['evidenceId'],value);
  const reference=legacy?`(${evidence('e.application_id')} OR EXISTS(SELECT 1 FROM (${nodes('e.result_json',['receipt','applicationId'])}) original WHERE original.type='text' AND ${evidence('original.atom')}))`
    :endReference(evidence);
  const game=legacy?`(e.match_id=$gameId OR ${identity('e.result_json',['activation','gameId'],'$gameId')})`:endGame;
  const play=legacy?numericIdentity('e.result_json',['receipt','previousPlayId']):endPlay;
  const params={...scopeParameters(scope),version:`${prefix}-v1`};
  for(const owner of legacy?['applications']:['actual_first_base_play_ends','actual_foul_play_ends']){
    if(installed(db,owner) && db.prepare(`SELECT 1 FROM world_player_workload_activities w,${owner} e WHERE ${belongs} AND ${reference} AND ${game} AND ${play} LIMIT 1`)
      .get(params))throw new Error(`${label} workload charge already exists through the global archive's original evidence`);
  }
  // A terminal proposal/acknowledgement retains the original E and official
  // application identities even when the selected evidence owner row is gone.
  const terminalEvidence=legacy?terminalApplicationReference(evidence):terminalEndReference(evidence);
  if(installed(db,'actual_foul_terminal_applications') && db.prepare(`SELECT 1 FROM world_player_workload_activities w,actual_foul_terminal_applications t
    WHERE ${belongs} AND ${terminalGame} AND ${terminalPlay} AND ${terminalEvidence} LIMIT 1`).get(params))
    throw new Error(`${label} workload charge already exists through the global archive's original terminal evidence`);
};

/** A frozen settlement owns all original participants. Its claim must survive
 * loss of the selected assessment/activity row, including a removed plan member. */
const assertNoTerminalOrSettlementCharge=(db:DefensiveDb,scope:ActualRoleWorkloadChargeScope)=>{
  const params=scopeParameters(scope);
  for(const settlement of [false,true]){
    const table=settlement?'actual_role_workload_settlements':'actual_role_workload_assessments';
    if(!installed(db,table))continue;
    const career=settlement?`(r.career_id=$careerId OR ${mirrorClaim([
      ['r.plan_json',['careerId']],['r.plan_json',['participants',{array:'all'},'activity','careerId']],
      ['r.plan_json',['participants',{array:'all'},'before','careerId']],['r.plan_json',['participants',{array:'all'},'after','careerId']],
    ],'$careerId')})`:`(r.career_id=$careerId OR ${mirrorClaim([
      ['r.snapshot_json',['careerId']],['r.snapshot_json',['activity','careerId']],['r.snapshot_json',['actor','binding','careerId']],
    ],'$careerId')})`;
    const player=settlement?`(${mirrorClaim([
      ['r.plan_json',['playerId']],['r.plan_json',['participants',{array:'all'},'playerId']],
      ['r.plan_json',['participants',{array:'all'},'activity','playerId']],['r.plan_json',['participants',{array:'all'},'before','playerId']],
      ['r.plan_json',['participants',{array:'all'},'after','playerId']],
    ],'$playerId')})`:`(r.player_id=$playerId OR ${mirrorClaim([
      ['r.source_json',['participantReference','playerId']],['r.snapshot_json',['source','participantReference','playerId']],
      ['r.snapshot_json',['playerId']],['r.snapshot_json',['activity','playerId']],['r.snapshot_json',['actor','binding','playerId']],
    ],'$playerId')})`;
    const source=(value:string)=>`r.closure_source_id=${value} OR ${mirrorClaim(settlement?[
      ['r.plan_json',['terminalSourceId']],['r.plan_json',['terminalReference','sourceId']],
    ]:[['r.source_json',['terminalReference','sourceId']],['r.snapshot_json',['source','terminalReference','sourceId']]],value)}`;
    const end=(value:string)=>mirrorClaim(settlement?[
      ['r.plan_json',['physicalEndReference','sourceId']],['r.plan_json',['participants',{array:'all'},'activity','evidenceId']],
    ]:[['r.source_json',['physicalEndReference','sourceId']],['r.snapshot_json',['source','physicalEndReference','sourceId']],
      ['r.snapshot_json',['activity','evidenceId']]],value);
    if(settlement){
      const game=`(r.game_id=$gameId OR ${identity('r.plan_json',['gameId'],'$gameId')})`;
      const play=`(r.play_id=$playId OR ${numericIdentity('r.plan_json',['playId'])})`;
      if(db.prepare(`SELECT 1 FROM ${table} r WHERE ${career} AND ${game} AND ${play} AND ${player} LIMIT 1`).get(params))
        throw new Error('actual role workload charge already exists through its frozen settlement scope');
      if(db.prepare(`SELECT 1 FROM ${table} r WHERE ${identity('r.plan_json',['participants',{array:'all'},'activity','sourceEventId'],'$id')} LIMIT 1`)
        .get({id:canonicalChargeId(scope,'actual-total-play-workload')}))throw new Error('actual role workload charge already exists through its frozen canonical activity identity');
    }
    if(installed(db,'actual_foul_terminal_applications') && db.prepare(`SELECT 1 FROM ${table} r,actual_foul_terminal_applications t
      WHERE ${terminalGame} AND ${terminalPlay} AND (${terminalCareer} OR ${career})
      AND (${player}${settlement?` OR ${terminalPlayer}`:''}) AND (${terminalReference(source)} OR ${terminalEndReference(end)}) LIMIT 1`).get(params))
      throw new Error('actual role workload charge already exists through its original terminal/end reference');
    if(installed(db,'actual_foul_play_ends') && db.prepare(`SELECT 1 FROM ${table} r,actual_foul_play_ends e
      WHERE ${career} AND ${player} AND ${endGame} AND ${endPlay} AND ${endReference(end)} LIMIT 1`).get(params))
      throw new Error('actual role workload charge already exists through its original foul end reference');
  }
};

/** The terminal missing-settlement path cannot use assessment ownership as a
 * charge, but must still reject surviving original TOTAL activity provenance. */
export const assertNoArchivedActualRoleWorkloadCharge = (db: DefensiveDb, scope: ActualRoleWorkloadChargeScope): void => {
  assertNoArchivedCharge(db,scope,'actual-total-play-workload','actual role');
};

/** Called by the legacy pitch producer before/within writes and when replaying a Source. */
export const assertNoActualRoleWorkloadCharge = (db: DefensiveDb, scope: ActualRoleWorkloadChargeScope, ownEnrollmentSourceId?: string): void => {
  assertNoSamePaWorkReservation(db,scope,ownEnrollmentSourceId);
  assertNoArchivedActualRoleWorkloadCharge(db,scope);
  assertNoTerminalOrSettlementCharge(db,scope);
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
export const assertNoLegacyPitchWorkloadCharge = (db: DefensiveDb, scope: ActualRoleWorkloadChargeScope, ownEnrollmentSourceId?: string): void => {
  assertNoSamePaWorkReservation(db,scope,ownEnrollmentSourceId);
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
  if(installed('actual_foul_terminal_applications') && db.prepare(`SELECT 1 FROM official_pitch_workload_sources r,actual_foul_terminal_applications t
    WHERE ${terminalGame} AND ${terminalPlay} AND ${career} AND ${player} AND ${terminalApplicationReference(appClaim)} LIMIT 1`).get(params))
    throw new Error('legacy pitch workload charge already exists through its original terminal application reference');
};
