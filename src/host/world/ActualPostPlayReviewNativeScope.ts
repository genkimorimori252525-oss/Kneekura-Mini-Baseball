import type { DatabaseSync } from 'node:sqlite';
import type { CanonicalMatchState } from '../../core/model/CanonicalMatchState';
import { readActualLiveOriginalFixture } from './ActualLiveOriginalFixtureFromSqlite';
import { actualLiveAdjudicationEvidenceFromSqlite } from './ActualLiveAdjudicationFromSqlite';
import { actualFirstBaseClosedEvidenceFromSqlite } from './SqliteActualFirstBasePlayEndStore';
import { battedWorldFieldEvidenceFromSqlite } from './SqliteBattedWorldFieldStore';
import { initializeActualPostPlayReview } from './ActualPostPlayReview';
import type { AcceptedActualPostPlayReviewSession } from './ActualPostPlayReviewSource';
import { actorHash as hash, actorJson as json, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

export type PostPlayReviewDb = Pick<DatabaseSync, 'prepare'>;
export type PostPlayReviewNativeScope = Readonly<{
  version: 'actual_post_play_review_scope_v1'; gameId: string; playId: number; physicalPitchSourceId: string;
  careerId: string; seasonId: string; gameDay: number; fixtureEventId: string;
  clubs: Readonly<{ HOME: string; AWAY: string }>;
  originalMatch: CanonicalMatchState; originalOfficialRevision: number; originalActivationJson: string | null;
}>;
/** Reuse the actual owners on the caller's transaction; never reconstruct physics here. */
export const derivePostPlayReviewSession = (db: PostPlayReviewDb, source: AcceptedActualPostPlayReviewSession) => {
  const adjudication = actualLiveAdjudicationEvidenceFromSqlite(db).read(source.adjudicationSourceId);
  if (!adjudication) throw new Error('accepted post-play adjudication seed is missing');
  const ends = actualFirstBaseClosedEvidenceFromSqlite(db), end = ends.read(adjudication.source.physicalEndSourceId);
  if (!end) throw new Error('sealed post-play physical end is missing');
  const reference = ends.reference(end.source.sourceId);
  if (!reference || json(reference) !== json(adjudication.endReference) || end.gameId !== adjudication.gameId
    || end.playId !== adjudication.playId || end.physicalPitchSourceId !== adjudication.physicalPitchSourceId) {
    throw new Error('post-play original seed/end scope differs');
  }
  const field = battedWorldFieldEvidenceFromSqlite(db).read(end.source.baseFieldSourceId);
  if (!field) throw new Error('post-play original field is missing');
  const pitch = field.response.touch.worldContact.flight.physicalPitch, frame = pitch.frame, batter = frame.batterActor;
  if (!batter || pitch.source.sourceId !== end.physicalPitchSourceId || frame.gameId !== end.gameId
    || frame.match.playId !== end.playId || json(frame.match) !== json(adjudication.originalMatch)
    || frame.officialRevision !== adjudication.originalOfficialRevision) throw new Error('post-play original frame differs');
  const bindings = [batter.binding, ...frame.bindings], first = batter.binding;
  if (bindings.length !== 10 || new Set(bindings.map(b => b.playerId)).size !== 10
    || new Set(bindings.map(b => b.personId)).size !== 10) throw new Error('post-play original frame participants differ');
  const fixture = db.prepare('SELECT * FROM official_fixtures WHERE game_id=?').get(end.gameId);
  const { game } = readActualLiveOriginalFixture(db, end.gameId, bindings);
  if (!fixture || fixture.fixture_event_id !== first.fixtureEventId) throw new Error('post-play original fixture ownership differs');
  const clubs = { HOME: game.homeClubId, AWAY: game.awayClubId };
  if (clubs.HOME === clubs.AWAY || bindings.some(b => b.careerId !== first.careerId || b.competitionEditionId !== first.competitionEditionId
    || b.gameId !== end.gameId || b.gameDay !== first.gameDay || b.fixtureEventId !== first.fixtureEventId
    || (b.side !== 'HOME' && b.side !== 'AWAY') || b.clubId !== clubs[b.side])
    || source.policy?.opportunities.some(o => !Object.values(clubs).includes(o.clubId))) throw new Error('post-play fixture side/Club ownership differs');
  const scope: PostPlayReviewNativeScope = { version: 'actual_post_play_review_scope_v1', gameId: end.gameId, playId: end.playId,
    physicalPitchSourceId: end.physicalPitchSourceId, careerId: first.careerId, seasonId: first.competitionEditionId,
    gameDay: first.gameDay, fixtureEventId: first.fixtureEventId, clubs,
    originalMatch: frame.match, originalOfficialRevision: frame.officialRevision,
    originalActivationJson: frame.activation === null ? null : json({ activation: frame.activation, nextWorld: frame.world }) };
  const value = initializeActualPostPlayReview({ source, seed: {
    source: adjudication.source, snapshotHash: hash(adjudication), gameId: adjudication.gameId, playId: adjudication.playId,
    physicalPitchSourceId: adjudication.physicalPitchSourceId, ruleProfile: adjudication.ruleProfile,
    exactEnd: end.exactEnd, endReference: reference, kind: adjudication.kind, ledger: adjudication.ledger, pendingReasons: adjudication.pendingReasons,
  } });
  const intakeReasons = value.pendingReasons.filter(reason => reason.startsWith('official_window_policy_unconfigured:')
    || reason === 'opening_event_unowned' || reason.startsWith('official_window_entitlement_unowned:'));
  return freeze({ version: 'actual_post_play_review_session_archive_v1' as const, scope, value, intakeReasons });
};
export const assertPostPlayOriginalMatchOpen = (db: PostPlayReviewDb, scope: PostPlayReviewNativeScope) => {
  const match = db.prepare('SELECT * FROM matches WHERE match_id=?').get(scope.gameId);
  if (!match || match.durable_revision !== scope.originalOfficialRevision || match.state_json !== json(scope.originalMatch)
    || match.activation_json !== scope.originalActivationJson) throw new Error('post-play original Match changed or is already applied');
};
