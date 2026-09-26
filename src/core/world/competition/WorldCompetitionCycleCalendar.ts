import type { ClubWorldRegion } from './ClubWorldBerths';

const REGIONS: readonly ClubWorldRegion[] = [
  'ASIA_PACIFIC', 'AMERICAS', 'EUROPE', 'AFRICA'];
const CONTINENTAL_MONTH: Readonly<Record<ClubWorldRegion, number>> =
  Object.freeze({ ASIA_PACIFIC: 11, AMERICAS: 2,
    EUROPE: 10, AFRICA: 4 });
export type WorldCompetitionKind = 'WBC' | 'CLUB_WORLD'
  | 'PREMIER_12' | 'REGIONAL_NATIONAL' | 'CONTINENTAL_CL';
export type WorldCompetitionWindow = Readonly<{
  startsOn: string;
  endsOn: string;
}>;
export type WorldFixedCompetitionWindow = Readonly<{
  kind: Exclude<WorldCompetitionKind, 'CONTINENTAL_CL'>;
  calendarYear: number;
  region?: ClubWorldRegion;
  window: WorldCompetitionWindow;
}>;
export type ContinentalWindowChoices = Readonly<{
  calendarYear: number;
  region: ClubWorldRegion;
  /** First candidate is the regional default; later entries are Flex Windows. */
  candidates: readonly WorldCompetitionWindow[];
}>;
export type WorldCompetitionCycleInput = Readonly<{
  careerStartYear: number;
  cycleOrdinal: number;
  calendarPolicyVersion: string;
  fixedEvents: readonly WorldFixedCompetitionWindow[];
  continentalChoices: readonly ContinentalWindowChoices[];
}>;
export type ReservedWorldCompetitionWindow = Readonly<{
  kind: WorldCompetitionKind;
  calendarYear: number;
  cycleYear: 1 | 2 | 3 | 4;
  region: ClubWorldRegion | null;
  priority: number;
  candidateIndex: number;
  window: WorldCompetitionWindow;
}>;
export type WorldCompetitionCyclePlan = Readonly<{
  careerStartYear: number;
  cycleOrdinal: number;
  calendarPolicyVersion: string;
  calendarYears: readonly number[];
  reservations: readonly ReservedWorldCompetitionWindow[];
}>;

const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;
const year = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value)
  && value >= 1 && value <= 9999;
const leap = (value: number): boolean =>
  value % 4 === 0 && (value % 100 !== 0 || value % 400 === 0);
const date = (value: unknown): Readonly<{ year: number;
  month: number; day: number; order: number }> | null => {
  if (typeof value !== 'string'
    || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const calendarYear = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const dayOfMonth = Number(value.slice(8, 10));
  const daysInMonth = [31, leap(calendarYear) ? 29 : 28, 31, 30,
    31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  if (!year(calendarYear) || !daysInMonth || dayOfMonth < 1
    || dayOfMonth > daysInMonth) return null;
  return { year: calendarYear, month, day: dayOfMonth,
    order: calendarYear * 372 + month * 31 + dayOfMonth };
};
const validWindow = (window: WorldCompetitionWindow,
  calendarYear: number): boolean => {
  const start = date(window?.startsOn);
  const end = date(window?.endsOn);
  return !!start && !!end && start.year === calendarYear
    && (end.year === calendarYear || end.year === calendarYear + 1)
    && start.order <= end.order;
};
const overlaps = (left: WorldCompetitionWindow,
  right: WorldCompetitionWindow): boolean =>
  date(left.startsOn)!.order <= date(right.endsOn)!.order
  && date(right.startsOn)!.order <= date(left.endsOn)!.order;
const conflicts = (left: ReservedWorldCompetitionWindow,
  right: ReservedWorldCompetitionWindow): boolean => {
  if (!overlaps(left.window, right.window)) return false;
  if (left.kind === 'REGIONAL_NATIONAL'
    && right.kind === 'REGIONAL_NATIONAL') {
    return left.region === right.region;
  }
  if (left.kind === 'CONTINENTAL_CL'
    && right.kind === 'CONTINENTAL_CL') {
    return left.region === right.region;
  }
  if (left.kind === 'REGIONAL_NATIONAL'
    || right.kind === 'REGIONAL_NATIONAL') {
    return true;
  }
  return true;
};
const priority = (kind: WorldCompetitionKind): number => ({
  WBC: 1, CLUB_WORLD: 2, PREMIER_12: 3,
  REGIONAL_NATIONAL: 4, CONTINENTAL_CL: 5,
})[kind];

/** Reserves fixed world windows first, then chooses each continental flex. */
export const planWorldCompetitionCycle = (
  input: WorldCompetitionCycleInput,
): WorldCompetitionCyclePlan => {
  if (!year(input?.careerStartYear)
    || !Number.isSafeInteger(input.cycleOrdinal)
    || input.cycleOrdinal < 0
    || !id(input.calendarPolicyVersion)
    || !Array.isArray(input.fixedEvents)
    || !Array.isArray(input.continentalChoices)) {
    throw new Error('invalid versioned world competition cycle');
  }
  const startYear = input.careerStartYear + input.cycleOrdinal * 4;
  if (!year(startYear) || !year(startYear + 3)) {
    throw new Error('world competition cycle exceeds calendar range');
  }
  const years = [startYear, startYear + 1,
    startYear + 2, startYear + 3];
  const expectedFixed = [
    ...REGIONS.map((region) => ({ kind: 'REGIONAL_NATIONAL' as const,
      calendarYear: years[0], region })),
    { kind: 'WBC' as const, calendarYear: years[1], region: null },
    { kind: 'CLUB_WORLD' as const, calendarYear: years[2], region: null },
    { kind: 'PREMIER_12' as const, calendarYear: years[3], region: null },
  ];
  const fixedKeys = input.fixedEvents.map((event) =>
    JSON.stringify([event.kind, event.calendarYear,
      event.region ?? null]));
  if (input.fixedEvents.length !== 7
    || new Set(fixedKeys).size !== 7
    || expectedFixed.some((event) => !fixedKeys.includes(JSON.stringify([
      event.kind, event.calendarYear, event.region])))
    || input.continentalChoices.length !== 16) {
    throw new Error('four-year cycle competition set is incomplete');
  }
  const reservations: ReservedWorldCompetitionWindow[] = [];
  for (const event of input.fixedEvents) {
    const start = date(event.window?.startsOn);
    const requiredMonth = event.kind === 'WBC' ? 3
      : event.kind === 'CLUB_WORLD' ? 12
        : event.kind === 'PREMIER_12' ? 11 : null;
    if (!validWindow(event.window, event.calendarYear)
      || (requiredMonth !== null && start?.month !== requiredMonth)) {
      throw new Error('fixed world event window contradicts its cycle');
    }
    const reservation = Object.freeze({ kind: event.kind,
      calendarYear: event.calendarYear,
      cycleYear: (event.calendarYear - startYear + 1) as 1 | 2 | 3 | 4,
      region: event.region ?? null,
      priority: priority(event.kind), candidateIndex: 0,
      window: Object.freeze({ ...event.window }) });
    if (reservations.some((item) => conflicts(item, reservation))) {
      throw new Error('fixed world windows conflict');
    }
    reservations.push(reservation);
  }
  const choiceKeys = input.continentalChoices.map((choice) =>
    JSON.stringify([choice.calendarYear, choice.region]));
  if (new Set(choiceKeys).size !== 16
    || years.some((calendarYear) => REGIONS.some((region) =>
      !choiceKeys.includes(JSON.stringify([calendarYear, region]))))) {
    throw new Error('annual continental windows are incomplete');
  }
  for (const calendarYear of years) {
    for (const region of REGIONS) {
      const choice = input.continentalChoices.find((item) =>
        item.calendarYear === calendarYear && item.region === region)!;
      if (!Array.isArray(choice.candidates)
        || choice.candidates.length === 0
        || choice.candidates.some((candidate: WorldCompetitionWindow) =>
          !validWindow(candidate, calendarYear))
        || date(choice.candidates[0].startsOn)!.month
          !== CONTINENTAL_MONTH[region]) {
        throw new Error('continental default and flex windows are invalid');
      }
      const candidates: ReservedWorldCompetitionWindow[] =
        choice.candidates.map((window: WorldCompetitionWindow,
          candidateIndex: number) =>
        Object.freeze({ kind: 'CONTINENTAL_CL' as const,
          calendarYear,
          cycleYear: (calendarYear - startYear + 1) as 1 | 2 | 3 | 4,
          region, priority: 5, candidateIndex,
          window: Object.freeze({ ...window }) }));
      const selected = candidates.find((candidate) =>
        !reservations.some((item) => conflicts(item, candidate)));
      if (!selected) {
        throw new Error('continental competition has no open Flex Window');
      }
      reservations.push(selected);
    }
  }
  return Object.freeze({ careerStartYear: input.careerStartYear,
    cycleOrdinal: input.cycleOrdinal,
    calendarPolicyVersion: input.calendarPolicyVersion,
    calendarYears: Object.freeze(years),
    reservations: Object.freeze(reservations) });
};
