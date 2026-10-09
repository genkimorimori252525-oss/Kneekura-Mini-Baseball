import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { actualLiveAdjudicationProfile } from './ActualLiveAdjudicationSource';
import { deriveSamePaFairCatchEndFromSqlite, type SamePaFairCatchPhysicalEnd } from './SamePlateAppearanceFairCatchEndFromSqlite';
import { deriveSamePaCatchOfficialOpening, type SamePaCatchOfficialOpeningInput } from './SamePlateAppearanceCatchOfficial';
import { readSamePaCatchWorkFromSqlite } from './SamePlateAppearanceCatchWorkFromSqlite';
import { readSamePaPhysicalOperationFromSqlite } from './SamePlateAppearancePhysicalEpisodeFromSqlite';
import { readHistoricalSamePaLifecycleViewFromSqlite, readCurrentSamePaLifecycleViewFromSqlite, withSamePaLifecycleReadPhase } from './SamePlateAppearanceLifecycleFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { samePaCatchReviewSeedInput, type SamePaCatchReviewSeedSource } from './SamePlateAppearanceCatchReviewSource';
import type { ActualPostPlayReviewSeed } from './ActualPostPlayReviewState';
import type { PostPlayReviewNativeScope, PostPlayReviewDb } from './ActualPostPlayReviewNativeScope';
import { actorHash as hash, actorJson as json, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

export const samePaCatchOfficialOpeningInputFromSqlite = (db: DatabaseSync, sourceId: string,
  end: SamePaFairCatchPhysicalEnd, policy: SamePaCatchReviewSeedSource['policy']): SamePaCatchOfficialOpeningInput => {
  const work = readSamePaCatchWorkFromSqlite(db, end.catchWorkReference), action = work.originalInputs.action!;
  const owned = { ...reference('pa_catch_v1_work', work), sourceVersion: work.source.sourceVersion };
  const actionView = readHistoricalSamePaLifecycleViewFromSqlite(db, action.viewReference).view;
  const ruleEvidence = { ...reference('pa_lifecycle_v1_execution_views', actionView), sourceVersion: actionView.source.sourceVersion };
  return { sourceId, originalMatch: end.originalMatch, physicalEnd: end.playEnd, exactEnd: end.exactEnd,
    operative: end.operative, policy, callProvenance: { version: 'owned_live_call_import_v1',
      playId: work.lineage.playId, gameId: work.lineage.gameId, physicalPitchSourceId: end.physicalPitchReference.sourceId,
      clock: { originTick: end.exactEnd.originTick, ticksPerSecond: end.scoringEvidence.field.evidence.ticksPerSecond },
      calledAtElapsedSeconds: action.calledAt.elapsedSeconds, availableAtElapsedSeconds: action.calledAt.elapsedSeconds,
      importedAtElapsedSeconds: end.exactEnd.elapsedSeconds, call: owned, perception: owned, policy: owned, ruleEvidence, reception: owned } };
};

/** Read-only preparation of an accepted session's exact seed hash. No caller
 * ledger, physical timestamp or cached end proof enters this boundary. */
export const deriveSamePaCatchReviewSeedFromSqlite = (db: DatabaseSync, raw: SamePaCatchReviewSeedSource,
  mode: 'current' | 'historical' = 'current') => withSamePaLifecycleReadPhase(db, () => {
  const source = samePaCatchReviewSeedInput(raw), basis = (mode === 'current'
    ? readCurrentSamePaLifecycleViewFromSqlite : readHistoricalSamePaLifecycleViewFromSqlite)(db, source.viewReference);
  const end = deriveSamePaFairCatchEndFromSqlite(db, source.viewReference, source.catchWorkReference, mode);
  if (end.kind === 'pending') throw new Error('reserved catch review physical end pending: ' + end.reason);
  if (json(end.physicalOperationReference) !== json(source.physicalOperationReference)
    || json(end.originalMatch) !== json(basis.actor.match)) throw new Error('reserved catch review original physical cut differs');
  const physical = readSamePaPhysicalOperationFromSqlite(db, source.physicalOperationReference).record;
  const endReference = { ...source.physicalOperationReference, sourceVersion: physical.source.sourceVersion };
  const opening = deriveSamePaCatchOfficialOpening(samePaCatchOfficialOpeningInputFromSqlite(db, source.sourceId, end, source.policy));
  const actor = basis.actor, first = actor.binding, bindings = [first, ...actor.defenderBindings];
  const clubs = { HOME: actor.worldFixture.game.homeClubId, AWAY: actor.worldFixture.game.awayClubId };
  if (bindings.length !== 10 || new Set(bindings.map(b => b.playerId)).size !== 10
    || new Set(bindings.map(b => b.personId)).size !== 10 || clubs.HOME === clubs.AWAY
    || bindings.some(b => b.gameId !== first.gameId || b.careerId !== first.careerId
      || b.competitionEditionId !== first.competitionEditionId || b.fixtureEventId !== first.fixtureEventId
      || b.gameDay !== first.gameDay || b.clubId !== clubs[b.side])) throw new Error('reserved catch review original fixture participants differ');
  const applied = 'activationApplicationId' in actor.source
    ? db.prepare('SELECT result_json FROM main.applications WHERE application_id=? AND match_id=?').get(actor.source.activationApplicationId, first.gameId) : null;
  if ('activationApplicationId' in actor.source && !applied) throw new Error('reserved catch review original activation missing');
  const prior = applied ? JSON.parse(String(applied.result_json)) : null;
  const scope: PostPlayReviewNativeScope = { version: 'actual_post_play_review_scope_v1', gameId: first.gameId,
    playId: actor.match.playId, physicalPitchSourceId: end.physicalPitchReference.sourceId, careerId: first.careerId,
    seasonId: first.competitionEditionId, gameDay: first.gameDay, fixtureEventId: first.fixtureEventId, clubs,
    originalMatch: actor.match, originalOfficialRevision: actor.officialRevision,
    originalActivationJson: prior === null ? null : json({ activation: prior.activation, nextWorld: prior.nextWorld }) };
  const seed: ActualPostPlayReviewSeed = { source, snapshotHash: hash({ source, end, opening }), gameId: scope.gameId,
    playId: scope.playId, physicalPitchSourceId: scope.physicalPitchSourceId,
    ruleProfile: actualLiveAdjudicationProfile(actor.match.ruleProfileId, source.policy), exactEnd: end.exactEnd,
    endReference, kind: opening.pendingReasons.length ? 'official_pending' : 'official_ready',
    ledger: opening.ledger, pendingReasons: opening.pendingReasons };
  return freeze({ seed, scope });
});

export const deriveSamePaCatchReviewNativeSeed = (db: PostPlayReviewDb, source: SamePaCatchReviewSeedSource, current = false) => {
  const Native = (createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync;
  if (!(db instanceof Native) || !db.isTransaction) throw new Error('reserved catch review requires the Native read transaction');
  return deriveSamePaCatchReviewSeedFromSqlite(db, source, current ? 'current' : 'historical');
};
