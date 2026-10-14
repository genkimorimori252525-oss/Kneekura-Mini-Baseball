import type { CanonicalMatchState } from '../../model/CanonicalMatchState';
import type { OfficialPlayClosure } from '../../adjudication/PlayAdjudicationLedger';
import type { SupportedOfficialScoringRecord } from '../../adjudication/OfficialScoring';
import { aggregateOfficialPlayerOutcomes, type AttributedOfficialPlayerOutcome,
  type OfficialPlayerOutcomeStatisticsScope } from './OfficialPlayerOutcomeStatistics';

export type OfficialPlayerScoringFact = Readonly<{ kind: 'known'; value: number }>
  | Readonly<{ kind: 'unavailable'; reason: 'sacrifice_judgment_missing' | 'rbi_judgment_missing' | 'credited_hit_value_missing' }>;
export type OfficialPlayerScoringContribution = Readonly<{
  atBats: OfficialPlayerScoringFact; runsBattedIn: OfficialPlayerScoringFact; hitBases: OfficialPlayerScoringFact; pitchingOuts: number;
}>;
export type OfficialPlayerStatisticTotal = Readonly<{
  /** A partial subtotal must never masquerade as a complete statistic. */
  value: number | null; knownSubtotal: number;
  unavailable: readonly Readonly<{ attributionId: string; reason: Extract<OfficialPlayerScoringFact, { kind: 'unavailable' }>['reason'] }>[];
}>;
const count = (n: unknown): n is number => Number.isSafeInteger(n) && (n as number) >= 0;
const known = (value: number): OfficialPlayerScoringFact => Object.freeze({ kind: 'known', value });
const unavailable = (reason: Extract<OfficialPlayerScoringFact, { kind: 'unavailable' }>['reason']): OfficialPlayerScoringFact =>
  Object.freeze({ kind: 'unavailable', reason });

/** Original accepted scoring and closure only. These descriptive facts cannot
 * change the closed play or supply missing scorer judgments. OBR 9.02/9.04/9.08. */
export const deriveOfficialPlayerScoringContribution = (input: Readonly<{
  match: CanonicalMatchState; closure: OfficialPlayClosure; record: SupportedOfficialScoringRecord;
}>): OfficialPlayerScoringContribution => {
  const { match, closure, record } = input;
  const outs = closure.officialDelta.outsAfter - match.outs;
  if (record.playId !== match.playId || closure.playId !== match.playId || record.closureId !== closure.closureId
    || record.basisRulingId !== closure.finalRuling.rulingId || record.battingTeam !== (match.half === 'top' ? 'away' : 'home')
    || !count(record.runsScored) || record.runsScored !== closure.officialDelta.scoredRunnerIds.length
    || !count(match.outs) || match.outs > 2 || !count(outs) || closure.officialDelta.outsAfter > 3) {
    throw new Error('official player scoring original scope differs');
  }
  const classification = record.classification;
  if (!['base_on_balls', 'strikeout', 'foul_out', 'fly_out', 'ground_out', 'base_hit', 'reached_on_error', 'fielders_choice'].includes(classification)
    || record.hitsCredited !== (classification === 'base_hit' ? 1 : 0)
    || record.errorsCharged !== (classification === 'reached_on_error' ? 1 : 0)
    || (classification === 'base_on_balls' && (outs !== 0 || record.runsScored > 1))
    || (['strikeout', 'foul_out', 'fly_out', 'ground_out'].includes(classification) && outs !== 1)
    || (['strikeout', 'fly_out', 'ground_out'].includes(classification) && record.runsScored !== 0)) {
    throw new Error('official player scoring classification facts differ');
  }
  const awards = record.playerStatistics;
  if (awards && (!['base_hit', 'reached_on_error', 'fielders_choice', 'foul_out'].includes(classification)
    || Object.keys(awards).sort().join('|') !== ['runsBattedIn', ...(classification === 'base_hit' ? ['hitBases'] : []),
      ...(Object.hasOwn(awards, 'sacrifice') ? ['sacrifice'] : [])].sort().join('|')
    || Object.hasOwn(awards, 'sacrifice') && (!['none', 'bunt', 'fly'].includes(awards.sacrifice!)
      || awards.sacrifice !== 'none' && (!(classification === 'reached_on_error'
        || classification === 'fielders_choice' && awards.sacrifice === 'bunt'
        || classification === 'foul_out' && awards.sacrifice === 'fly') || match.outs >= 2))
    || !count(awards.runsBattedIn) || awards.runsBattedIn > record.runsScored
    || classification === 'base_hit' && ![1, 2, 3, 4].includes(awards.hitBases!))) {
    throw new Error('official player scoring accepted awards differ');
  }
  const noPriorRunners = Object.values(match.bases).every(runner => runner === null);
  // Hits and strikeouts count as AB. A sacrifice needs runners and fewer than
  // two outs; the supported caught-out paths without runs cannot be sacrifices.
  const atBats = awards?.sacrifice ? known(awards.sacrifice === 'none' ? 1 : 0) : classification === 'base_on_balls' ? known(0)
    : ['strikeout', 'base_hit', 'fly_out', 'ground_out'].includes(classification)
      || noPriorRunners || match.outs === 2 || classification === 'foul_out' && record.runsScored === 0
      ? known(1) : unavailable('sacrifice_judgment_missing');
  // A no-run play has zero RBI. The accepted non-live walk only advances forced
  // runners. Scoring H/E/FC or catches need their own RBI judgment/causal facts.
  const runsBattedIn = awards ? known(awards.runsBattedIn) : record.runsScored === 0 ? known(0)
    : classification === 'base_on_balls' ? known(record.runsScored) : unavailable('rbi_judgment_missing');
  const hitBases = classification !== 'base_hit' ? known(0) : awards ? known(awards.hitBases!) : unavailable('credited_hit_value_missing');
  return Object.freeze({ atBats, runsBattedIn, hitBases, pitchingOuts: outs });
};

export const aggregateOfficialPlayerScoring = (input: readonly Readonly<{
  outcome: AttributedOfficialPlayerOutcome; contribution: OfficialPlayerScoringContribution;
}>[], scope: OfficialPlayerOutcomeStatisticsScope) => {
  const admitted = new Set(aggregateOfficialPlayerOutcomes(input.map(item => item.outcome), scope).attributionIds);
  const atBats = { knownSubtotal: 0, unavailable: [] as OfficialPlayerStatisticTotal['unavailable'][number][] };
  const runsBattedIn = { knownSubtotal: 0, unavailable: [] as OfficialPlayerStatisticTotal['unavailable'][number][] };
  const hits = Array.from({ length: 5 }, () => ({ knownSubtotal: 0, unavailable: [] as OfficialPlayerStatisticTotal['unavailable'][number][] }));
  let pitchingOuts = 0;
  const add = (left: number, right: number): number => {
    if (!count(left + right)) throw new Error('official player scoring total overflow');
    return left + right;
  };
  for (const { outcome, contribution } of input) {
    if (!contribution || !count(contribution.pitchingOuts) || contribution.pitchingOuts > 3
      || [contribution.atBats, contribution.runsBattedIn, contribution.hitBases].some(fact => !fact || (fact.kind === 'known'
        ? !count(fact.value) : fact.kind !== 'unavailable' || !['sacrifice_judgment_missing', 'rbi_judgment_missing', 'credited_hit_value_missing'].includes(fact.reason)))) {
      throw new Error('invalid official player scoring contribution');
    }
    if (!admitted.has(outcome.attributionId)) continue;
    if (outcome.batterPlayerId === scope.playerId) {
      for (const [total, fact] of [[atBats, contribution.atBats], [runsBattedIn, contribution.runsBattedIn]] as const) {
        if (fact.kind === 'known') total.knownSubtotal = add(total.knownSubtotal, fact.value);
        else total.unavailable.push(Object.freeze({ attributionId: outcome.attributionId, reason: fact.reason }));
      }
      hits.forEach((total, index) => {
        const fact = contribution.hitBases;
        if (fact.kind === 'unavailable') total.unavailable.push(Object.freeze({ attributionId: outcome.attributionId, reason: fact.reason }));
        else total.knownSubtotal = add(total.knownSubtotal, index === 4 ? fact.value : fact.value === index + 1 ? 1 : 0);
      });
    } else pitchingOuts = add(pitchingOuts, contribution.pitchingOuts);
  }
  const total = (value: typeof atBats): OfficialPlayerStatisticTotal => Object.freeze({
    value: value.unavailable.length ? null : value.knownSubtotal, knownSubtotal: value.knownSubtotal,
    unavailable: Object.freeze(value.unavailable.sort((a, b) => a.attributionId.localeCompare(b.attributionId))),
  });
  return Object.freeze({ coverage: 'attributed_supported_plays_only' as const,
    batting: Object.freeze({ atBats: total(atBats), runsBattedIn: total(runsBattedIn),
      singles: total(hits[0]), doubles: total(hits[1]), triples: total(hits[2]), homeRuns: total(hits[3]), totalBases: total(hits[4]) }),
    pitching: Object.freeze({ outsRecorded: pitchingOuts, inningsPitched: Object.freeze({
      completeInnings: Math.floor(pitchingOuts / 3), remainderOuts: pitchingOuts % 3,
    }) }),
  });
};
