import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { createCanonicalLineScoreSnapshot, type CanonicalLineScoreSnapshot } from '../../core/model/CanonicalLineScoreSnapshot';
import type { OfficialGameVenueBinding } from '../../core/world/competition/OfficialGameCompletion';
import { actualLivePlayFields as fields, actualLivePlayId as id } from './ActualLivePlayScope';
import { actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
/** Accepted official-scorer aggregate under contract07 §10.2. These H/E values
 * describe the game; they are never physical evidence or a per-play judgment. */
export type AcceptedActualLiveFinalScoring = Readonly<{
  sourceId: string; sourceVersion: string; sourceKind: 'official_scorer_aggregate'; scorerId: string;
  gameId: string; seasonId: string; closureSourceId: string; playId: number; expectedDurableRevision: number; recordedAtTick: number;
  adjudicationReference: Readonly<{ sourceId: string; snapshotHash: string }>;
  venueBinding: OfficialGameVenueBinding; lineScore: CanonicalLineScoreSnapshot;
}>;
const integer = (value: unknown) => Number.isSafeInteger(value) && (value as number) >= 0;
export const actualLiveFinalScoringInput = (raw: AcceptedActualLiveFinalScoring): AcceptedActualLiveFinalScoring => {
  const s = cloneInert(raw);
  if (!fields(s, ['sourceId', 'sourceVersion', 'sourceKind', 'scorerId', 'gameId', 'seasonId', 'closureSourceId', 'playId',
    'expectedDurableRevision', 'recordedAtTick', 'adjudicationReference', 'venueBinding', 'lineScore'])
    || ![s.sourceId, s.sourceVersion, s.scorerId, s.gameId, s.seasonId, s.closureSourceId].every(id)
    || s.sourceKind !== 'official_scorer_aggregate' || ![s.playId, s.expectedDurableRevision, s.recordedAtTick].every(integer)
    || !fields(s.adjudicationReference, ['sourceId', 'snapshotHash']) || !id(s.adjudicationReference.sourceId)
    || typeof s.adjudicationReference.snapshotHash !== 'string' || !/^[a-f0-9]{64}$/.test(s.adjudicationReference.snapshotHash)
    || !fields(s.venueBinding, ['gameId', 'venueId', 'fixtureEventId', 'fixtureRevision'])
    || ![s.venueBinding.gameId, s.venueBinding.venueId, s.venueBinding.fixtureEventId].every(id) || !integer(s.venueBinding.fixtureRevision)
    || !fields(s.lineScore, ['innings', 'totals']) || !Array.isArray(s.lineScore.innings)
    || s.lineScore.innings.some(inning => !fields(inning, ['inning', 'awayRuns', 'homeRuns']))
    || !fields(s.lineScore.totals, ['away', 'home'])
    || !fields(s.lineScore.totals.away, ['runs', 'hits', 'errors']) || !fields(s.lineScore.totals.home, ['runs', 'hits', 'errors'])) {
    throw new Error('invalid accepted actual live final scoring Source');
  }
  return freeze({ ...s, lineScore: createCanonicalLineScoreSnapshot(s.lineScore) });
};
