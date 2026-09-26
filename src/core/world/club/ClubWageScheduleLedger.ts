import { readState } from './ClubSchemas';
import type { ClubTransitionEvent, ClubWorldState } from './ClubTypes';
import { exact } from './ClubValidation';
import type { PlayerWageSeasonAllocation } from './ClubPayrollPrecheck';

export type ClubWageSchedule = Readonly<{
  commitmentId: string;
  contractRef: string;
  sourceClubEventId: string;
  sourceClubRevision: number;
  availableAtDay: number;
  totalMinorUnits: number;
  annualAmounts: readonly Readonly<{ season: number; amount: number }>[];
}>;
export type ClubWageScheduleLedger = Readonly<{
  careerId: string;
  clubId: string;
  revision: number;
  schedules: readonly ClubWageSchedule[];
}>;
export type ClubWageScheduleInput = Readonly<Pick<ClubWageSchedule,
  'commitmentId' | 'contractRef' | 'annualAmounts'>>;

const identifier = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;
const onlyKeys = (value: object, keys: readonly string[]): boolean =>
  Object.keys(value).every((key) => keys.includes(key));

const validateLedger = (ledger: ClubWageScheduleLedger): void => {
  if (!ledger || typeof ledger !== 'object'
    || !onlyKeys(ledger, ['careerId', 'clubId', 'revision', 'schedules'])
    || !identifier(ledger.careerId) || !identifier(ledger.clubId)
    || !Number.isSafeInteger(ledger.revision)
    || !Array.isArray(ledger.schedules)
    || ledger.revision !== ledger.schedules.length) {
    throw new Error('invalid wage schedule ledger');
  }
  const ids = new Set<string>();
  for (const schedule of ledger.schedules) {
    if (!schedule || typeof schedule !== 'object'
      || !onlyKeys(schedule, ['commitmentId', 'contractRef',
        'sourceClubEventId', 'sourceClubRevision', 'availableAtDay',
        'totalMinorUnits', 'annualAmounts'])
      || !identifier(schedule.commitmentId)
      || !identifier(schedule.contractRef)
      || !identifier(schedule.sourceClubEventId)
      || !Number.isSafeInteger(schedule.sourceClubRevision)
      || schedule.sourceClubRevision <= 0
      || !Number.isSafeInteger(schedule.availableAtDay)
      || schedule.availableAtDay < 0
      || !Number.isSafeInteger(schedule.totalMinorUnits)
      || schedule.totalMinorUnits <= 0
      || !Array.isArray(schedule.annualAmounts)
      || schedule.annualAmounts.length === 0
      || ids.has(schedule.commitmentId)) {
      throw new Error('invalid wage schedule ledger record');
    }
    ids.add(schedule.commitmentId);
    let previousSeason = -1;
    for (const annual of schedule.annualAmounts) {
      if (!annual || typeof annual !== 'object'
        || !onlyKeys(annual, ['season', 'amount'])
        || !Number.isSafeInteger(annual.season)
        || annual.season <= previousSeason
        || !Number.isSafeInteger(annual.amount)
        || annual.amount <= 0) {
        throw new Error('invalid wage schedule annual record');
      }
      previousSeason = annual.season;
    }
    if (exact(schedule.annualAmounts.map((annual: { amount: number }) =>
      annual.amount),
      'wageSchedule.total') !== schedule.totalMinorUnits) {
      throw new Error('wage schedule ledger total mismatch');
    }
  }
};

export const createClubWageScheduleLedger = (
  careerId: string,
  clubId: string,
): ClubWageScheduleLedger => {
  if (!identifier(careerId) || !identifier(clubId)) {
    throw new Error('wage schedule ledger requires career and club IDs');
  }
  return Object.freeze({ careerId, clubId, revision: 0,
    schedules: Object.freeze([]) });
};

/** Register an annual split only for the actual newly recorded wage liability. */
export const appendClubWageSchedule = (
  ledger: ClubWageScheduleLedger,
  expectedRevision: number,
  input: ClubWorldState,
  event: ClubTransitionEvent,
  source: ClubWageScheduleInput,
): ClubWageScheduleLedger => {
  const club = readState(input);
  validateLedger(ledger);
  if (expectedRevision !== ledger.revision) {
    throw new Error('stale wage schedule revision');
  }
  if (ledger.careerId !== club.careerId
    || ledger.clubId !== club.identity.clubId) {
    throw new Error('wage schedule club scope mismatch');
  }
  if (club.season.closureRef !== null || !source
    || !identifier(source.commitmentId)
    || !identifier(source.contractRef)
    || Object.keys(source).some((field) => ![
      'commitmentId', 'contractRef', 'annualAmounts',
    ].includes(field))) {
    throw new Error('invalid wage schedule source');
  }
  if (ledger.schedules.some((schedule) =>
    schedule.commitmentId === source.commitmentId)) {
    throw new Error('duplicate wage schedule commitment');
  }
  if (!event || event.kind !== 'CLUB_CHANGED'
    || event.command.careerId !== club.careerId
    || event.command.clubId !== club.identity.clubId
    || event.afterRevision !== club.revision
    || event.command.expectedRevision + 1 !== club.revision
    || event.command.effectiveDay !== club.effectiveDay
    || !identifier(event.command.eventId)) {
    throw new Error('wage schedule requires the current club event');
  }
  const matchingOperations = event.command.operations.filter((op) =>
    op.kind === 'RECORD_COMMITMENT'
      && op.commitmentId === source.commitmentId);
  const op = matchingOperations[0];
  const commitment = club.live.finance.commitments.find((item) =>
    item.commitmentId === source.commitmentId);
  if (matchingOperations.length !== 1 || !op
    || op.kind !== 'RECORD_COMMITMENT' || !commitment
    || op.category !== 'playerWages' || op.budgetBucket !== 'payroll'
    || op.contractRef !== source.contractRef
    || op.amount !== commitment.amount
    || op.currency !== club.season.plan.financialProfile.currency
    || commitment.contractRef !== source.contractRef
    || commitment.reservationSeason !== club.season.plan.season
    || commitment.paidBeforeSeason !== 0
    || commitment.paidThisSeason !== 0
    || commitment.cancelledAmount !== 0) {
    throw new Error('wage schedule does not match signed liability');
  }
  if (!Array.isArray(source.annualAmounts)
    || source.annualAmounts.length === 0) {
    throw new Error('wage schedule requires annual amounts');
  }
  let priorSeason = club.season.plan.season - 1;
  for (const annual of source.annualAmounts) {
    if (annual === null || typeof annual !== 'object'
      || Object.keys(annual).some((field) =>
        !['season', 'amount'].includes(field))
      || !Number.isSafeInteger(annual.season)
      || annual.season <= priorSeason
      || !Number.isSafeInteger(annual.amount)
      || annual.amount <= 0) {
      throw new Error('invalid wage schedule annual amount');
    }
    priorSeason = annual.season;
  }
  if (exact(source.annualAmounts.map((annual) => annual.amount),
    'wageSchedule.total') !== commitment.amount) {
    throw new Error('wage schedule total does not match liability');
  }
  const record: ClubWageSchedule = Object.freeze({
    commitmentId: source.commitmentId,
    contractRef: source.contractRef,
    sourceClubEventId: event.command.eventId,
    sourceClubRevision: club.revision,
    availableAtDay: club.effectiveDay,
    totalMinorUnits: commitment.amount,
    annualAmounts: Object.freeze(source.annualAmounts.map((annual) =>
      Object.freeze({ season: annual.season, amount: annual.amount }))),
  });
  return Object.freeze({ careerId: ledger.careerId, clubId: ledger.clubId,
    revision: ledger.revision + 1,
    schedules: Object.freeze([...ledger.schedules, record]) });
};

/** An absent or stale legal schedule never becomes a guessed payroll value. */
export const getClubSeasonWageAllocations = (
  ledger: ClubWageScheduleLedger,
  input: ClubWorldState,
): readonly PlayerWageSeasonAllocation[] => {
  const club = readState(input);
  validateLedger(ledger);
  if (ledger.careerId !== club.careerId
    || ledger.clubId !== club.identity.clubId) {
    throw new Error('wage schedule club scope mismatch');
  }
  const season = club.season.plan.season;
  const allocations = club.live.finance.commitments
    .filter((commitment) => commitment.category === 'playerWages')
    .map((commitment): PlayerWageSeasonAllocation => {
      const schedule = ledger.schedules.find((item) =>
        item.commitmentId === commitment.commitmentId);
      if (!schedule || schedule.contractRef !== commitment.contractRef
        || commitment.budgetBucket !== 'payroll'
        || schedule.totalMinorUnits !== commitment.amount
        || commitment.cancelledAmount !== 0
        || schedule.sourceClubRevision > club.revision
        || schedule.availableAtDay > club.effectiveDay) {
        throw new Error('missing or stale wage schedule');
      }
      const pastDue = exact(schedule.annualAmounts
        .filter((annual) => annual.season < season)
        .map((annual) => annual.amount), 'wageSchedule.pastDue');
      const annualMinorUnits = schedule.annualAmounts
        .find((annual) => annual.season === season)?.amount ?? 0;
      if (commitment.paidBeforeSeason > pastDue
        || commitment.paidThisSeason > annualMinorUnits) {
        throw new Error('wage schedule payment mismatch');
      }
      return Object.freeze({ commitmentId: commitment.commitmentId,
        contractRef: commitment.contractRef, season,
        annualMinorUnits, availableAtDay: schedule.availableAtDay,
        sourceEventId: schedule.sourceClubEventId });
    });
  return Object.freeze(allocations);
};
