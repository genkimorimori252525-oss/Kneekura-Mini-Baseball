import type { OfficialGameResult } from '../competition/OfficialGameCompletion';
import { replayClubEvents } from './ClubEvents';
import { applyClubCommand } from './ClubLifecycle';
import type { ClubTransitionEvent, ClubWorldState } from './ClubTypes';
import { same } from './ClubValidation';

export type MatchdayAttendanceFact = Readonly<{
  factId: string;
  careerId: string;
  sourceEventId: string;
  gameId: string;
  stadiumId: string;
  observedAtDay: number;
  availableAtDay: number;
  venueRevisionAtObservation: number;
  count: number;
}>;
export type MatchdayClubHistory = Readonly<{
  checkpoint: ClubWorldState;
  acceptedEvents: readonly ClubTransitionEvent[];
}>;
export type MatchdayRevenuePolicy = Readonly<{
  version: string;
  availableAtDay: number;
  seasonId: string;
  currency: string;
  /** Already calibrated for the home club's recognized income; no league share is inferred. */
  recognizedMinorUnitsPerAttendee: number;
}>;
export type MatchdayRevenueBasis = Readonly<{
  gameId: string;
  seasonId: string;
  applicationId: string;
  attendanceFactId: string;
  attendanceSourceEventId: string;
  observedAtDay: number;
  finalizedAtDay: number;
  attendance: number;
  stadiumId: string;
  venueRevision: number;
  venueCapacity: number;
  policyVersion: string;
  policyAvailableAtDay: number;
  currency: string;
  amount: number;
}>;
export type MatchdayRevenueApplication = Readonly<{
  kind: 'RECORDED'; state: ClubWorldState;
  event: ClubTransitionEvent; basis: MatchdayRevenueBasis;
}>;

const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;
const day = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const exactFields = (value: unknown, fields: readonly string[]): boolean =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === fields.length
  && fields.every((field) => Object.hasOwn(value, field));

/** Convert a final official game and observed gate count into a club accounting event. */
export function applyOfficialMatchdayRevenue(
  club: ClubWorldState,
  result: OfficialGameResult,
  attendance: MatchdayAttendanceFact,
  policy: MatchdayRevenuePolicy,
  history: MatchdayClubHistory,
  finalizedAtDay: number,
): MatchdayRevenueApplication {
  if (!exactFields(attendance, ['factId', 'careerId', 'sourceEventId', 'gameId',
    'stadiumId', 'observedAtDay', 'availableAtDay',
    'venueRevisionAtObservation', 'count'])
    || !exactFields(policy, ['version', 'availableAtDay', 'seasonId',
      'currency', 'recognizedMinorUnitsPerAttendee'])
    || !id(result.gameId) || !id(result.seasonId)
    || !id(result.applicationId) || !id(result.closureId)
    || !id(attendance.factId) || !id(attendance.sourceEventId)
    || attendance.careerId !== club.careerId
    || !id(attendance.stadiumId) || !id(policy.version)
    || !id(policy.seasonId) || !id(policy.currency)
    || attendance.sourceEventId === result.applicationId
    || !day(attendance.observedAtDay) || !day(attendance.availableAtDay)
    || attendance.availableAtDay < attendance.observedAtDay
    || !day(policy.availableAtDay)
    || policy.availableAtDay > attendance.observedAtDay
    || !day(attendance.count)
    || !day(attendance.venueRevisionAtObservation)
    || !day(finalizedAtDay)
    || finalizedAtDay < attendance.observedAtDay
    || !day(policy.recognizedMinorUnitsPerAttendee)
    || attendance.gameId !== result.gameId
    || result.seasonId !== policy.seasonId
    || result.homeClubId !== club.identity.clubId
    || result.homeClubId === result.awayClubId
    || attendance.observedAtDay < club.season.plan.startsOnDay
    || club.season.closureRef !== null
    || !club.season.plan.competitionEditionIds.includes(result.seasonId)
    || policy.currency !== club.season.plan.financialProfile.currency) {
    throw new Error('invalid official matchday revenue source or policy');
  }
  const receiptId = `matchday/${encodeURIComponent(result.seasonId)}/${encodeURIComponent(result.gameId)}`;
  if (club.live.finance.receipts.some((receipt) =>
    receipt.receiptId === receiptId
    || (receipt.category === 'matchday'
      && receipt.causeEventIds.includes(attendance.sourceEventId)))) {
    throw new Error('DUPLICATE_ID: official matchday revenue source');
  }
  if (!history || !Array.isArray(history.acceptedEvents)
    || history.checkpoint.revision > attendance.venueRevisionAtObservation) {
    throw new Error('invalid matchday club history');
  }
  const current = replayClubEvents(history.checkpoint, history.acceptedEvents);
  if (!current.ok || !same(current.value, club)) {
    throw new Error('matchday club history does not reach current state');
  }
  const beforeObservation = history.acceptedEvents.filter((event) =>
    event.afterRevision <= attendance.venueRevisionAtObservation);
  const venueResult = replayClubEvents(history.checkpoint, beforeObservation);
  if (!venueResult.ok
    || venueResult.value.revision !== attendance.venueRevisionAtObservation) {
    throw new Error('matchday venue revision is absent from accepted history');
  }
  const venueAtObservation = venueResult.value;
  const nextEvent = history.acceptedEvents[beforeObservation.length];
  if (venueAtObservation.careerId !== club.careerId
    || venueAtObservation.identity.clubId !== club.identity.clubId
    || venueAtObservation.effectiveDay > attendance.observedAtDay
    || (nextEvent && nextEvent.command.effectiveDay < attendance.observedAtDay)
    || attendance.stadiumId !== venueAtObservation.institutional.stadium.stadiumId
    || attendance.count > venueAtObservation.institutional.stadium.capacity
    || !venueAtObservation.season.plan.competitionEditionIds.includes(result.seasonId)) {
    throw new Error('matchday venue does not match observed game-day state');
  }
  const product = BigInt(attendance.count)
    * BigInt(policy.recognizedMinorUnitsPerAttendee);
  if (product > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('matchday revenue amount overflow');
  }
  const amount = Number(product);
  const basis: MatchdayRevenueBasis = Object.freeze({
    gameId: result.gameId, seasonId: result.seasonId,
    applicationId: result.applicationId,
    attendanceFactId: attendance.factId,
    attendanceSourceEventId: attendance.sourceEventId,
    observedAtDay: attendance.observedAtDay,
    finalizedAtDay,
    attendance: attendance.count,
    stadiumId: attendance.stadiumId,
    venueRevision: venueAtObservation.revision,
    venueCapacity: venueAtObservation.institutional.stadium.capacity,
    policyVersion: policy.version,
    policyAvailableAtDay: policy.availableAtDay,
    currency: policy.currency, amount,
  });
  const applied = applyClubCommand(club, {
    eventId: receiptId,
    careerId: club.careerId,
    clubId: club.identity.clubId,
    expectedRevision: club.revision,
    effectiveDay: Math.max(club.effectiveDay,
      attendance.availableAtDay, finalizedAtDay),
    causeEventIds: [result.applicationId, attendance.sourceEventId],
    operations: [{ kind: 'RECORD_REVENUE', category: 'matchday',
      receiptId, amount, currency: policy.currency }],
  });
  if (!applied.ok) throw new Error(`${applied.reason.code}: official matchday revenue`);
  return Object.freeze({ kind: 'RECORDED', state: applied.state,
    event: applied.event, basis });
}
