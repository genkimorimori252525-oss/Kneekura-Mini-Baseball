import type { OfficialFairBallScoringEvidence, OfficialCaughtFoulScoringEvidence } from '../../core/adjudication/OfficialScoring';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { actualLivePlayFields as fields, actualLivePlayId as id } from './ActualLivePlayScope';
import { actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

/** Independent accepted scorer input. This never changes the closed play Source. */
export type AcceptedActualGroundOutScoringEvidence = Readonly<{
  schemaVersion: 1; sourceKind: 'owned_ground_out'; sourceEventId: string;
  playId: number; closureId: string; batterRunnerId: string;
}>;
export type AcceptedActualLiveScoringSource = Readonly<{
  sourceId: string; sourceVersion: string; gameId: string; scoringApplicationId: string;
  closureReference: Readonly<{ sourceId: string; proposalHash: string }>;
  evidence: OfficialFairBallScoringEvidence | OfficialCaughtFoulScoringEvidence | AcceptedActualGroundOutScoringEvidence;
}>;
export type ActualLiveScoringAuthority = Readonly<{ readAcceptedScoringSource(sourceId: string): unknown }>;

export const actualLiveScoringInput = (raw: unknown, sourceId: string): AcceptedActualLiveScoringSource => {
  const s = cloneInert(raw) as AcceptedActualLiveScoringSource;
  if (!fields(s, ['sourceId', 'sourceVersion', 'gameId', 'scoringApplicationId', 'closureReference', 'evidence'])
    || s.sourceId !== sourceId || ![sourceId, s.sourceVersion, s.gameId, s.scoringApplicationId].every(id)
    || !fields(s.closureReference, ['sourceId', 'proposalHash']) || !id(s.closureReference.sourceId)
    || typeof s.closureReference.proposalHash !== 'string' || !/^[a-f0-9]{64}$/.test(s.closureReference.proposalHash)
    || !s.evidence || s.evidence.sourceEventId !== sourceId || s.evidence.closureId !== s.closureReference.sourceId) {
    throw new Error('invalid accepted actual live scoring Source identity');
  }
  if (s.evidence.sourceKind === 'owned_ground_out') {
    if (!fields(s.evidence, ['schemaVersion', 'sourceKind', 'sourceEventId', 'playId', 'closureId', 'batterRunnerId'])
      || s.evidence.schemaVersion !== 1 || !id(s.evidence.batterRunnerId)
      || !Number.isSafeInteger(s.evidence.playId) || s.evidence.playId < 0) throw new Error('invalid owned actual ground-out Source');
    return freeze(s);
  }
  if (s.evidence.sourceKind === 'official_caught_foul_scorer_judgment') {
    if (!fields(s.evidence, ['schemaVersion', 'sourceKind', 'sourceEventId', 'scorerId', 'ruleProfileId', 'playId', 'closureId',
      'basisRulingId', 'recordedAtTick', 'contactSequence', 'catchSequence', 'batterRunnerId', 'catcherPlayerId', 'catcherRole', 'playerStatistics'])
      || s.evidence.schemaVersion !== 1) throw new Error('invalid accepted caught-foul scorer Source');
    return freeze(s);
  }
  if (!fields(s.evidence, ['schemaVersion', 'sourceEventId', 'sourceKind', 'scorerId', 'ruleProfileId', 'playId', 'closureId',
    'basisRulingId', 'recordedAtTick', 'contactSequence', 'fairSequence', 'batterRunnerId', 'judgment',
    ...(s.evidence.schemaVersion === 2 ? ['playerStatistics'] : [])]) || ![1, 2].includes(s.evidence.schemaVersion)) {
    throw new Error('invalid accepted actual live scoring Source identity');
  }
  const judgment = s.evidence.judgment;
  if (judgment?.kind === 'base_hit' ? !fields(judgment, ['kind'])
    : judgment?.kind === 'reached_on_error' ? !fields(judgment, ['kind', 'chargedFielderId'])
      : judgment?.kind !== 'fielders_choice' || !(fields(judgment, ['kind', 'retiredPriorRunnerId'])
        || s.evidence.schemaVersion === 2 && fields(judgment, ['kind', 'attemptedPriorRunnerId']))) {
    throw new Error('unsupported actual live scoring judgment');
  }
  return freeze(s);
};
