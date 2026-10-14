import type {DatabaseSync} from 'node:sqlite';
import type {FoulTerminalAcknowledgedResult,FoulTerminalApplicationProposal} from './ActualFoulTerminalApplication';
import type {FoulTerminalFinalCompletion} from './ActualFoulTerminalPostPlayCompletion';
import {resolveOfficialGameBoundary,resolveOfficialGameProgression} from '../../core/world/competition/OfficialGameCompletion';
import {readPhysicalClosureScoringHistory,derivePhysicalClosureLineScore} from './PhysicalPlayClosureEvidenceFromSqlite';
import {foulTerminalScoringEvidenceFromSqlite} from './ActualFoulTerminalScoringEvidenceFromSqlite';
import {withBattedVenueLegalReadSnapshot} from './SqliteBattedVenueLegalPolicyStore';
import {withBattedWorldPhysicalReadTraversal} from './SqliteBattedWorldFieldExecutionStore';
import {withFoulTerminalOriginalScope} from './FoulTerminalCompletionAncestryGuard';
import {foulApplicationOwnershipRows} from './ActualFoulTerminalApplicationOwnership';
import {actorJson as json,actorHash as hash,actorFreeze as freeze} from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
const same=(a:unknown,b:unknown,message:string)=>{if(json(a)!==json(b))throw new Error('terminal final '+message);};
/** Read only earlier revisions. The current pending score is appended once;
 * neither its completed application nor its completion can hash itself. */
export const deriveFoulTerminalFinalHistory=(db:DatabaseSync,original:FoulTerminalAcknowledgedResult,p:FoulTerminalApplicationProposal):
 Pick<FoulTerminalFinalCompletion,'scoringHistoryReference'|'finalResult'>=>withBattedVenueLegalReadSnapshot(db,()=>withBattedWorldPhysicalReadTraversal(db,()=>
 withFoulTerminalOriginalScope(db,p.source.sourceId,p.gameId,p.playId,()=>{
  const game=p.applicationBody.game,receipt=original.official.receipt;
  if(!game||receipt.durableRevision!==p.originalOfficialRevision+1)throw new Error('terminal final original policy or revision differs');
  const progression=resolveOfficialGameProgression({...game,gameId:p.gameId,priorMatch:p.applicationBody.match,application:receipt});
  same(progression,original.official.pendingPostPlay.gameProgression,'original progression differs');
  if(progression.kind!=='GAME_FINAL_PENDING_SCORING')throw new Error('terminal final requires original pending finality');
  const policy={seasonId:game.seasonId,homeClubId:game.homeClubId,awayClubId:game.awayClubId,policy:game.policy};
  for(const row of foulApplicationOwnershipRows(db,'physical_closure_game_policies',{game_id:'TEXT',policy_json:'TEXT'}).filter(r=>r.game_id===p.gameId)){
   if(typeof row.policy_json!=='string'||row.policy_json!==json(JSON.parse(row.policy_json)))throw new Error('terminal final shared policy encoding differs');
   same(JSON.parse(row.policy_json),policy,'shared policy differs');
  }
  const earlier=readPhysicalClosureScoringHistory(db,{gameId:p.gameId,officialRevision:p.originalOfficialRevision});
  if(earlier.length!==p.originalOfficialRevision||new Set(earlier.map(e=>e.applicationId)).size!==earlier.length
   ||new Set(earlier.map(e=>e.scoringApplicationId)).size!==earlier.length)throw new Error('terminal final earlier history interval differs');
  for(const e of earlier){
   if(e.after.playId!==e.before.playId+1)throw new Error('terminal final earlier play sequence differs');
   if(e.applicationId===receipt.applicationId)throw new Error('terminal final current application cannot be its own history');
   const applications=db.prepare('SELECT * FROM main.applications WHERE application_id=?').all(e.applicationId);
   const scores=db.prepare('SELECT * FROM main.official_scoring_applications WHERE official_application_id=?').all(e.applicationId);
   const app=applications[0],score=scores[0];
   if(applications.length!==1||scores.length!==1||hash(app)!==e.closureRowHash||hash(score)!==e.scoringRowHash
    ||typeof app.result_json!=='string'||typeof score.request_json!=='string')throw new Error('terminal final earlier authenticated rows differ');
   const result=JSON.parse(app.result_json),request=JSON.parse(score.request_json);
   if(result.finalResult||result.result||result.completion?.kind==='game_final')throw new Error('terminal final history contains an earlier final result');
   const priorGame=request.input?.officialApplication?.game;
   if(priorGame!==null&&priorGame!==undefined){
    same({seasonId:priorGame.seasonId,homeClubId:priorGame.homeClubId,awayClubId:priorGame.awayClubId,policy:priorGame.policy},policy,'earlier accepted game policy differs');
    if(priorGame.venueBinding!==undefined)same(priorGame.venueBinding,game.venueBinding,'earlier fixture differs');
   }
  }
  const scoring=foulTerminalScoringEvidenceFromSqlite(db).prepare(p.source.sourceId);
  if(!scoring?.result||earlier.some(e=>e.scoringApplicationId===scoring.result!.scoringApplicationId))throw new Error('terminal final current scoring effect missing or recursive');
  same(scoring.saved.proposal,p,'current scoring original proposal differs');
  same(scoring.saved.result,original,'current scoring original acknowledgement differs');
  const lineScore=derivePhysicalClosureLineScore([...earlier,{before:p.applicationBody.match,after:receipt.appliedMatchState,scoring:scoring.result}]);
  const boundary=resolveOfficialGameBoundary({...game,gameId:p.gameId,priorMatch:p.applicationBody.match,application:receipt,lineScore});
  if(boundary.kind!=='GAME_FINAL'||boundary.result.completionReason!==progression.completionReason)throw new Error('terminal final boundary differs');
  return freeze({scoringHistoryReference:{throughDurableRevision:p.originalOfficialRevision,earlier:earlier.map(({applicationId,scoringApplicationId,closureRowHash,scoringRowHash})=>
   ({applicationId,scoringApplicationId,closureRowHash,scoringRowHash}))},finalResult:boundary.result});
 })));
