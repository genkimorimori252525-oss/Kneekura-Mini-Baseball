import type { OfficialFairBallScoringEvidence } from '../../core/adjudication/OfficialScoring';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { actualLivePlayFields as fields, actualLivePlayId as id } from './ActualLivePlayScope';
import { actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

/** Independent accepted scorer input. This never changes the closed play Source. */
export type AcceptedActualLiveScoringSource = Readonly<{
  sourceId: string; sourceVersion: string; gameId: string; scoringApplicationId: string;
  closureReference: Readonly<{ sourceId: string; proposalHash: string }>;
  evidence: OfficialFairBallScoringEvidence;
}>;
export type ActualLiveScoringAuthority = Readonly<{ readAcceptedScoringSource(sourceId: string): unknown }>;

export const actualLiveScoringInput = (raw: unknown, sourceId: string): AcceptedActualLiveScoringSource => {
  const s = cloneInert(raw) as AcceptedActualLiveScoringSource;
  if (!fields(s, ['sourceId', 'sourceVersion', 'gameId', 'scoringApplicationId', 'closureReference', 'evidence'])
    || s.sourceId !== sourceId || ![sourceId, s.sourceVersion, s.gameId, s.scoringApplicationId].every(id)
    || !fields(s.closureReference, ['sourceId', 'proposalHash']) || !id(s.closureReference.sourceId)
    || typeof s.closureReference.proposalHash !== 'string' || !/^[a-f0-9]{64}$/.test(s.closureReference.proposalHash)
    || !fields(s.evidence, ['schemaVersion', 'sourceEventId', 'sourceKind', 'scorerId', 'ruleProfileId', 'playId', 'closureId',
      'basisRulingId', 'recordedAtTick', 'contactSequence', 'fairSequence', 'batterRunnerId', 'judgment'])
    || s.evidence.sourceEventId !== sourceId || s.evidence.closureId !== s.closureReference.sourceId) {
    throw new Error('invalid accepted actual live scoring Source identity');
  }
  const judgment = s.evidence.judgment;
  if (judgment?.kind === 'base_hit' ? !fields(judgment, ['kind'])
    : judgment?.kind === 'reached_on_error' ? !fields(judgment, ['kind', 'chargedFielderId'])
      : judgment?.kind !== 'fielders_choice' || !fields(judgment, ['kind', 'retiredPriorRunnerId'])) {
    throw new Error('unsupported actual live scoring judgment');
  }
  return freeze(s);
};
