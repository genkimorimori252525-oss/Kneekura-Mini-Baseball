import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { resolveFoulBallRule, type FoulBallRuleResult } from '../../core/rules/FoulBallRule';
import { battedVenueLegalEvidenceFromSqlite, battedVenueOriginalContactCount, type BattedVenueLegalEvidence } from './BattedVenueLegalEvidenceFromSqlite';
import { deriveOriginalBattingIntentEvidence, type OriginalBattingIntentEvidence } from './OriginalBattingIntent';
import { readOriginalPhysicalPitchPrefixFromSqlite } from './PhysicalPitchEvidenceFromSqlite';
import { actorJson as json, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { withBattedVenueLegalReadSnapshot } from './SqliteBattedVenueLegalPolicyStore';

export type BattedVenueFoulCountObservation = Readonly<{
  version: 'batted_venue_foul_count_observation_v1'; policySourceId: string;
  baseFieldSourceId: string; executionSourceId: string | null;
}>;
export type BattedVenueFoulCountEvidence = Readonly<{
  version: 'batted_venue_foul_count_evidence_v1';
  basis: BattedVenueLegalEvidence;
  battingIntent: OriginalBattingIntentEvidence;
  countConsequence: Readonly<{ kind: 'derived'; rule: Extract<FoulBallRuleResult, { kind: 'uncaught_foul' }> }>
    | Readonly<{ kind: 'unresolved'; reason: 'untouched_settled_foul_unproved' | 'original_batting_intent_missing' }>;
}>;

const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value === value.trim();

/** Read-only legal consequence over one authenticated original snapshot. It applies no count,
 * timeline event, causal dead-ball registration, PA resume or official closure. */
export const battedVenueFoulCountEvidenceFromSqlite = (db: DatabaseSync): Readonly<{
  read(request: BattedVenueFoulCountObservation): BattedVenueFoulCountEvidence;
}> => Object.freeze({ read(raw): BattedVenueFoulCountEvidence {
  const request = cloneInert(raw);
  if (!request || json(Object.keys(request).sort()) !== json(['baseFieldSourceId', 'executionSourceId', 'policySourceId', 'version'])
    || request.version !== 'batted_venue_foul_count_observation_v1' || !id(request.policySourceId) || !id(request.baseFieldSourceId)
    || request.executionSourceId !== null && !id(request.executionSourceId)) throw new Error('invalid venue foul count observation cut');
  return withBattedVenueLegalReadSnapshot(db, () => {
    const basis = battedVenueLegalEvidenceFromSqlite(db).read({ ...request, version: 'batted_venue_legal_observation_v1' });
    const pitch = readOriginalPhysicalPitchPrefixFromSqlite(db, basis.physicalPitchSourceId).at(-1);
    if (!pitch || pitch.source.sourceId !== basis.physicalPitchSourceId || pitch.frame.gameId !== basis.gameId
      || pitch.frame.match.playId !== basis.playId || pitch.frame.match.ruleProfileId !== basis.ruleProfileId
      || json(battedVenueOriginalContactCount(pitch)) !== json(basis.originalCount)) {
      throw new Error('venue foul count original pitch differs from its legal basis');
    }
    const battingIntent = deriveOriginalBattingIntentEvidence(pitch);
    let countConsequence: BattedVenueFoulCountEvidence['countConsequence'];
    if (basis.evidence.interpretation.kind !== 'dead_ball') {
      countConsequence = { kind: 'unresolved', reason: 'untouched_settled_foul_unproved' };
    } else if (battingIntent.intent.kind === 'unresolved') {
      countConsequence = { kind: 'unresolved', reason: 'original_batting_intent_missing' };
    } else {
      const rule = resolveFoulBallRule({ territory: 'foul', flyCatch: null,
        count: basis.originalCount.count, buntAttempt: battingIntent.intent.attempt === 'bunt' });
      if (rule.kind !== 'uncaught_foul') throw new Error('venue foul count rule differs from its settled-foul basis');
      countConsequence = { kind: 'derived', rule };
    }
    return freeze({ version: 'batted_venue_foul_count_evidence_v1', basis, battingIntent, countConsequence });
  });
} });
