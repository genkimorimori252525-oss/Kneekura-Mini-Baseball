import { createRequire } from 'node:module';
import type { PlayAdjudicationLedger } from '../../core/adjudication/PlayAdjudicationLedger';
import { actualLiveAdjudicationEvidenceFromSqlite, type ActualAdjudicationDb,
  type DurableActualLiveAdjudication } from './ActualLiveAdjudicationFromSqlite';
import { actualPostPlayReviewEvidenceFromSqlite } from './ActualPostPlayReviewFromSqlite';
import { assertNoUnpinnedPostPlayReview } from './ActualPostPlayReviewNativeMetadata';
import { actualLivePlayClosureInput, type AcceptedActualLivePlayClosure,
  type ActualLivePostPlayReviewReference } from './ActualLivePlayClosureSource';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

export type ActualLiveClosureAdjudication = Readonly<{
  adjudication: DurableActualLiveAdjudication; ledger: PlayAdjudicationLedger;
  postPlayReviewReference?: ActualLivePostPlayReviewReference;
}>;
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
// Private reduction receives only the freshly authenticated reader result below.
const select = (db: ActualAdjudicationDb, source: AcceptedActualLivePlayClosure,
  adjudication: DurableActualLiveAdjudication): ActualLiveClosureAdjudication => {
  const reference = source.postPlayReviewReference;
  if (reference === undefined) {
    assertNoUnpinnedPostPlayReview(db, source.adjudicationSourceId, adjudication);
    if (adjudication.kind !== 'official_ready') throw new Error(`actual official closure pending: ${adjudication.pendingReasons.join(', ')}`);
    // No new optional property is emitted into original v1 archives.
    return Object.freeze({ adjudication, ledger: adjudication.ledger });
  }
  const current = actualPostPlayReviewEvidenceFromSqlite(db).readCurrent(reference.sessionSourceId);
  if (!current) throw new Error('pinned post-play review session is missing');
  if (current.source.adjudicationSourceId !== source.adjudicationSourceId
    || current.source.adjudicationSnapshotHash !== hash(adjudication)
    || current.seed.gameId !== adjudication.gameId || current.seed.playId !== adjudication.playId
    || current.seed.physicalPitchSourceId !== adjudication.physicalPitchSourceId) {
    throw new Error('pinned post-play review adjudication seed or scope differs');
  }
  if (json(reference) !== json({ sessionSourceId: current.source.sourceId, revision: current.revision,
    headSourceId: current.headSourceId, headHash: current.headHash })) throw new Error('post-play closure pin differs from current revision/head');
  if (current.kind !== 'official_ready') throw new Error(`pinned post-play review pending: ${current.pendingReasons.join(', ')}`);
  if (source.closureTick < current.cursor.tick) throw new Error('actual closure tick precedes the post-play journal cursor');
  return Object.freeze({ adjudication, ledger: current.ledger, postPlayReviewReference: reference });
};

/** The closure's owned pair is produced here, never supplied by a caller. The
 * outer closure traversal retains its transaction/mutation guard through use. */
export const deriveActualLiveClosureAdjudicationWithInputs = (db: ActualAdjudicationDb, raw: AcceptedActualLivePlayClosure) => {
  const source = actualLivePlayClosureInput(raw, raw.sourceId), owner = actualLiveAdjudicationEvidenceFromSqlite(db);
  const transactional = db instanceof DatabaseSync && db.isTransaction;
  const pair = transactional ? owner.readWithClosureInputs(source.adjudicationSourceId) : null;
  const adjudication = transactional ? pair?.value : owner.read(source.adjudicationSourceId);
  if (!adjudication) throw new Error('accepted actual live adjudication is missing');
  return Object.freeze({ selected: select(db, source, adjudication), pair });
};
/** Historical readiness is readable; only the current head authorizes closure. */
export const deriveActualLiveClosureAdjudication = (db: ActualAdjudicationDb,
  raw: AcceptedActualLivePlayClosure): ActualLiveClosureAdjudication => deriveActualLiveClosureAdjudicationWithInputs(db, raw).selected;
