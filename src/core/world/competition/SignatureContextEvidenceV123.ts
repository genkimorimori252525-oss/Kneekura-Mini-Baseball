import type { CanonicalMatchState } from '../../model/CanonicalMatchState';
import { aggregateOfficialPlayerOutcomes, type AttributedOfficialPlayerOutcome,
  type OfficialPlayerOutcomeStatisticsScope } from './OfficialPlayerOutcomeStatistics';
import type { OfficialPlayerScoringFact } from './OfficialPlayerScoringStatistics';

export type SignatureContextObservationV123 = Readonly<{
  outcome: AttributedOfficialPlayerOutcome;
  /** Original accepted application's PRE-play state, never its final delta. */
  before: Pick<CanonicalMatchState, 'bases' | 'outs' | 'balls' | 'strikes'>;
  atBats: OfficialPlayerScoringFact; hits: OfficialPlayerScoringFact;
}>;
export type SignatureContextMetricV123 = Readonly<{ value: number | null; knownSubtotal: number; unknownCount: number }>;
export type SignatureContextBucketV123 = Readonly<{
  bases: 'basesEmpty' | 'runnersOn'; outs: number; balls: number; strikes: number; plays: number;
  atBats: SignatureContextMetricV123; hits: SignatureContextMetricV123;
}>;
const fields = (v: unknown, keys: readonly string[]): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).length === keys.length && keys.every(key => Object.hasOwn(v, key));
const count = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
const add = (left: number, right: number) => {
  const value = left + right;
  if (!count(value)) throw new Error('signature context count overflow');
  return value;
};
const metric = () => ({ knownSubtotal: 0, unknownCount: 0 });
const buckets = () => (['basesEmpty', 'runnersOn'] as const).flatMap(bases => Array.from({ length: 3 }, (_, outs) =>
  Array.from({ length: 4 }, (_, balls) => Array.from({ length: 3 }, (_, strikes) => ({
    bases, outs, balls, strikes, plays: 0, atBats: metric(), hits: metric(),
  }))).flat()).flat());
const factValid = (fact: OfficialPlayerScoringFact) => fact && (fact.kind === 'known' ? count(fact.value) && fact.value <= 1
  : fact.kind === 'unavailable' && ['sacrifice_judgment_missing', 'rbi_judgment_missing', 'credited_hit_value_missing'].includes(fact.reason));

/** Descriptive, fixed 72-context partition per role. Host authenticates the
 * complete original edition before calling this pure aggregation. No trait,
 * recognition, causal effect, significance or population baseline is inferred.
 * Output is bounded; input scan/storage is not an incremental checkpoint. */
export const aggregateSignatureContextEvidenceV123 = (input: readonly SignatureContextObservationV123[], scope: OfficialPlayerOutcomeStatisticsScope) => {
  // Existing scope, Source identity and duplicate-play rules also validate
  // excluded/future evidence, before applying this read's temporal filter.
  const admitted = new Set(aggregateOfficialPlayerOutcomes(input.map(item => item.outcome), scope).attributionIds);
  const batting = buckets(), pitching = buckets();
  for (const item of input) {
    const before = item.before;
    if (!fields(before, ['bases', 'outs', 'balls', 'strikes']) || !fields(before.bases, ['first', 'second', 'third'])
      || Object.values(before.bases).some(runner => runner !== null && (typeof runner !== 'string' || !runner || runner.trim() !== runner))
      || !count(before.outs) || before.outs > 2 || !count(before.balls) || before.balls > 3 || !count(before.strikes) || before.strikes > 2
      || !factValid(item.atBats) || !factValid(item.hits)) throw new Error('invalid signature pre-play context or scoring fact');
    if (!admitted.has(item.outcome.attributionId)) continue;
    const occupied = Object.values(before.bases).some(runner => runner !== null);
    const role = item.outcome.batterPlayerId === scope.playerId ? batting : pitching;
    const bucket = role[(occupied ? 36 : 0) + before.outs * 12 + before.balls * 3 + before.strikes];
    bucket.plays = add(bucket.plays, 1);
    for (const [total, fact] of [[bucket.atBats, item.atBats], [bucket.hits, item.hits]] as const) {
      if (fact.kind === 'known') total.knownSubtotal = add(total.knownSubtotal, fact.value);
      else total.unknownCount = add(total.unknownCount, 1);
    }
  }
  const seal = (values: typeof batting): readonly SignatureContextBucketV123[] => Object.freeze(values.map(bucket => {
    const total = (m: ReturnType<typeof metric>): SignatureContextMetricV123 => Object.freeze({
      value: m.unknownCount ? null : m.knownSubtotal, ...m,
    });
    return Object.freeze({ ...bucket, atBats: total(bucket.atBats), hits: total(bucket.hits) });
  }));
  return Object.freeze({ schemaVersion: 'signature-context-evidence-v123' as const,
    scope: Object.freeze({ careerId: scope.careerId, competitionEditionId: scope.competitionEditionId, playerId: scope.playerId, asOfDay: scope.asOfDay }),
    coverage: 'attributed_supported_plays_only' as const, contextAuthority: 'accepted_application_pre_play_match' as const,
    batting: seal(batting), pitching: seal(pitching),
    connections: Object.freeze({ opponentAdjustment: 'NOT_CONNECTED' as const, leagueAdjustment: 'NOT_CONNECTED' as const, eraAdjustment: 'NOT_CONNECTED' as const,
      parkAdjustment: 'NOT_CONNECTED' as const, causalMotorEvidence: 'NOT_CONNECTED' as const, sampleCalibration: 'UNVERIFIED' as const,
      multipleTesting: 'NOT_CONNECTED' as const, holdoutValidation: 'NOT_CONNECTED' as const, incrementalCheckpoint: 'NOT_CONNECTED' as const }) });
};
