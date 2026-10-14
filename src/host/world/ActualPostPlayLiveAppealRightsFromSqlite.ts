import { getPendingOwnedLiveAppealImports } from '../../core/adjudication/PlayAdjudicationLedger';
import { createRequire } from 'node:module';
import { readPostPlayOriginalLiveAppeal } from './ActualPostPlayLiveAppealFromSqlite';
import { readSamePaFieldRuleEvidenceWithInputsFromSqlite } from './SamePlateAppearanceFieldRuleEvidenceFromSqlite';
import { readSamePaLiveBallHistoryFromSqlite } from './SamePlateAppearanceLiveBallStateFromSqlite';
import { readSamePaVenueLegalCoverageFromPair } from './SamePlateAppearanceVenueLegalCoverage';
import { deriveSamePaLiveAppealRights } from './SamePlateAppearanceLiveAppealRights';
import type { PostPlayReviewDb, PostPlayReviewNativeScope } from './ActualPostPlayReviewNativeScope';
import type { AcceptedActualPostPlayReviewEvent } from './ActualPostPlayReviewSource';
import type { ActualPostPlayReviewProjection, PostPlayLiveAppealRights } from './ActualPostPlayReviewState';
import { actorFreeze as freeze, actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
export type PostPlayLiveAppealRightsAdmission=Readonly<{version:'actual_post_play_live_appeal_rights_admission_v1';kind:'live_appeal_rights';
  gameId:string;playId:number;physicalPitchSourceId:string;sourceId:string;sourceHash:string;originalSeedHash:string;liveAppealRights:PostPlayLiveAppealRights}>;
const pending=(reason:string)=>freeze({kind:'intent_pending' as const,reason});
/** Replay original receipt and original legal prefix at its own physical cut.
 * Admission may happen later; it cannot change when the attempt occurred. */
export const capturePostPlayLiveAppealRights=(db:PostPlayReviewDb,scope:PostPlayReviewNativeScope,
  previous:ActualPostPlayReviewProjection,source:AcceptedActualPostPlayReviewEvent,current:boolean)=>{
  if(source.action.kind!=='admit_live_appeal_rights') throw new Error('original live appeal rights action differs');
  const Native=(createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync;
  if(!(db instanceof Native)||!db.isTransaction) throw new Error('live appeal rights require the Native read transaction');
  const executionReference=source.action.executionReference;
  const original=readPostPlayOriginalLiveAppeal(db,scope,previous,executionReference,current);
  if(original.kind!=='ready') return original;
  const imported=getPendingOwnedLiveAppealImports(previous.ledger).find(i=>i.provenance.execution.owner===executionReference.owner
    &&i.provenance.execution.sourceId===executionReference.sourceId);
  if(!imported) throw new Error('live appeal rights require its pending original imported execution');
  const {importedAtElapsedSeconds:_,...saved}=imported.provenance;
  const {importedAtElapsedSeconds:__,...replayed}=original.liveAppealImport.provenance;
  if(json(saved)!==json(replayed)||json(imported.attempt)!==json(original.liveAppealImport.attempt)
    ||json(imported.complianceEvidence)!==json(original.liveAppealImport.complianceEvidence))
    throw new Error('live appeal rights original imported physical receipt differs');
  const view=original.receipt.source.viewReference;
  const pair=readSamePaFieldRuleEvidenceWithInputsFromSqlite(db,view,'historical');
  if(pair.kind!=='same_pa_field_rule_read_pair_v1') return pending('original_live_appeal_legal_prefix_required');
  const venue=readSamePaVenueLegalCoverageFromPair(pair);
  if(venue.kind==='pending') return pending(venue.reason);
  const history=readSamePaLiveBallHistoryFromSqlite(db,view,'historical');
  const rights=deriveSamePaLiveAppealRights(pair,history,venue,original.receipt);
  if(rights.kind==='pending') return pending(rights.reason);
  const liveAppealRights:PostPlayLiveAppealRights={provenance:{version:'owned_live_appeal_rights_admission_v1',
    originalImport:imported.provenance,admittedAtElapsedSeconds:previous.seed.exactEnd.elapsedSeconds+previous.cursor.offsetTicks/previous.cursor.ticksPerSecond,
    legalState:rights.legalStateReference,venue:rights.venueReference},evidence:rights.evidence};
  const evidence:PostPlayLiveAppealRightsAdmission={version:'actual_post_play_live_appeal_rights_admission_v1',kind:'live_appeal_rights',
    gameId:scope.gameId,playId:scope.playId,physicalPitchSourceId:scope.physicalPitchSourceId,sourceId:source.sourceId,sourceHash:hash(source),
    originalSeedHash:previous.seed.snapshotHash,liveAppealRights};
  return freeze({kind:'admitted' as const,evidence});
};
