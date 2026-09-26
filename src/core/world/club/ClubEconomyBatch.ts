import type { OfficialGameResult } from '../competition/OfficialGameCompletion';
import type { DomesticCompetitionSeasonInput,
  DomesticCompetitionSeasonSnapshot } from '../competition/DomesticCompetitionSeason';
import { replayClubEvents } from './ClubEvents';
import { readState } from './ClubSchemas';
import type { ClubTransitionEvent, ClubWorldState } from './ClubTypes';
import { same } from './ClubValidation';
import { applyOfficialMatchdayRevenue, type MatchdayAttendanceFact,
  type MatchdayClubHistory, type MatchdayRevenueBasis,
  type MatchdayRevenuePolicy } from './OfficialMatchdayRevenue';
import { applyOfficialDomesticPrizeRevenue,
  type DomesticPrizeAward, type DomesticPrizeBasis,
  type DomesticPrizePolicy } from './OfficialDomesticPrizeRevenue';
import { applyScheduledPlayerWagePayment,
  type AnnualWagePaymentPolicy,
  type ScheduledPlayerWagePaymentBasis } from './ScheduledPlayerWagePayment';
import { getClubSeasonWageAllocations,
  type ClubWageScheduleLedger } from './ClubWageScheduleLedger';

export type ClubEconomySource =
  | Readonly<{ kind: 'MATCHDAY'; result: OfficialGameResult;
    attendance: MatchdayAttendanceFact; policy: MatchdayRevenuePolicy;
    finalizedAtDay: number }>
  | Readonly<{ kind: 'DOMESTIC_PRIZE';
    source: DomesticCompetitionSeasonInput;
    snapshot: DomesticCompetitionSeasonSnapshot;
    policy: DomesticPrizePolicy; award: DomesticPrizeAward;
    finalizationEventId: string; finalizedAtDay: number }>
  | Readonly<{ kind: 'PLAYER_WAGE'; commitmentId: string;
    policy: AnnualWagePaymentPolicy; payrollRunEventId: string }>;
export type ClubEconomyApplication = Readonly<{
  kind: ClubEconomySource['kind'];
  event: ClubTransitionEvent;
  basis: MatchdayRevenueBasis | DomesticPrizeBasis
    | ScheduledPlayerWagePaymentBasis;
}>;
export type ClubEconomyBatchResult = Readonly<{
  state: ClubWorldState;
  events: readonly ClubTransitionEvent[];
  applications: readonly ClubEconomyApplication[];
}>;

/**
 * Ordered pure adoption of accepted economic sources. A rejected later source
 * cannot return a partial club state; the host must persist the final state
 * and all events together with durable compare-and-swap.
 */
export const applyClubEconomyBatch = (
  input: ClubWorldState,
  history: MatchdayClubHistory,
  wageSchedules: ClubWageScheduleLedger,
  sources: readonly ClubEconomySource[],
): ClubEconomyBatchResult => {
  const club = readState(input);
  if (!Array.isArray(sources) || sources.length === 0
    || !history || !Array.isArray(history.acceptedEvents)) {
    throw new Error('invalid club economy batch');
  }
  const prior = replayClubEvents(history.checkpoint,
    history.acceptedEvents);
  if (!prior.ok || !same(prior.value, club)) {
    throw new Error('club economy batch history mismatch');
  }
  getClubSeasonWageAllocations(wageSchedules, club);
  let current = club;
  const events: ClubTransitionEvent[] = [];
  const applications: ClubEconomyApplication[] = [];
  for (const source of sources) {
    if (source.kind === 'MATCHDAY') {
      const applied = applyOfficialMatchdayRevenue(current,
        source.result, source.attendance, source.policy, {
          checkpoint: history.checkpoint,
          acceptedEvents: [...history.acceptedEvents, ...events],
        }, source.finalizedAtDay);
      current = applied.state;
      events.push(applied.event);
      applications.push(Object.freeze({ kind: source.kind,
        event: applied.event, basis: applied.basis }));
    } else if (source.kind === 'DOMESTIC_PRIZE') {
      const applied = applyOfficialDomesticPrizeRevenue(current,
        source.source, source.snapshot, source.policy, source.award,
        source.finalizationEventId, source.finalizedAtDay);
      current = applied.state;
      events.push(applied.event);
      applications.push(Object.freeze({ kind: source.kind,
        event: applied.event, basis: applied.basis }));
    } else if (source.kind === 'PLAYER_WAGE') {
      const applied = applyScheduledPlayerWagePayment(current,
        wageSchedules, source.commitmentId, source.policy,
        source.payrollRunEventId);
      current = applied.state;
      events.push(applied.event);
      applications.push(Object.freeze({ kind: source.kind,
        event: applied.event, basis: applied.basis }));
    } else {
      throw new Error('unknown club economy source');
    }
  }
  return Object.freeze({ state: current,
    events: Object.freeze(events),
    applications: Object.freeze(applications) });
};
