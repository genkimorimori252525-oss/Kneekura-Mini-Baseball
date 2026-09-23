import { fnv1a32 } from '../../rng/DeterministicRng';
import {
  createBaseScheduleSnapshot,
  type BaseScheduleSnapshot,
  type DomesticSeries,
  type LeagueScheduleInput,
} from './LeagueSchedule';

export type LeagueScheduleGeneratorInput = Omit<LeagueScheduleInput, 'series'> & Readonly<{
  preferredSeriesLength: 2 | 3 | 4;
  minimumDaysBetweenRounds: number;
}>;

const splitIntoSeries = (
  games: number,
  preferred: 2 | 3 | 4,
): readonly (2 | 3 | 4)[] => {
  if (!Number.isSafeInteger(games) || games <= 0) {
    throw new Error('invalid opponent matrix game count');
  }
  const best: Array<readonly (2 | 3 | 4)[] | null> = Array(games + 1).fill(null);
  best[0] = [];
  const lengths = ([2, 3, 4] as Array<2 | 3 | 4>)
    .sort((a, b) => Math.abs(a - preferred) - Math.abs(b - preferred) || b - a);
  for (let count = 1; count <= games; count += 1) {
    for (const length of lengths) {
      const previous = count >= length ? best[count - length] : null;
      if (previous === null) continue;
      const candidate = [...previous, length];
      const candidateCost = candidate.reduce((sum, part) => sum + Math.abs(part - preferred), 0);
      const current = best[count];
      const currentCost = current?.reduce((sum, part) => sum + Math.abs(part - preferred), 0);
      if (current === null || (currentCost !== undefined && candidateCost < currentCost)) {
        best[count] = candidate;
      }
    }
  }
  const result = best[games];
  if (result === null) throw new Error('schedule validation failure: opponent matrix cannot form legal series');
  return result;
};

/** Deterministic series-round generator. Hard failures never lower the official game volume. */
export const generateLeagueSchedule = (
  input: LeagueScheduleGeneratorInput,
): BaseScheduleSnapshot => {
  if (
    ![2, 3, 4].includes(input.preferredSeriesLength)
    || !Number.isSafeInteger(input.minimumDaysBetweenRounds)
    || input.minimumDaysBetweenRounds < 0
    || !input.scheduleSeed
  ) throw new Error('invalid schedule generator policy');
  const tasks = input.opponentMatrix.flatMap((entry) =>
    splitIntoSeries(entry.gameCount, input.preferredSeriesLength).map((gameCount, index) => ({
      seriesId: JSON.stringify([
        input.seasonId, entry.homeClubId, entry.awayClubId, index + 1,
      ]),
      homeClubId: entry.homeClubId,
      awayClubId: entry.awayClubId,
      gameCount,
    })));
  const pending = [...tasks];
  const series: DomesticSeries[] = [];
  const allowedDays = new Set(input.allowedDays);
  const lastAllowedDay = Math.max(...input.allowedDays);
  let earliestStartDay = Math.min(...input.allowedDays);
  while (pending.length > 0) {
    const remainingByClub = new Map<string, number>();
    for (const task of pending) {
      remainingByClub.set(task.homeClubId, (remainingByClub.get(task.homeClubId) ?? 0) + 1);
      remainingByClub.set(task.awayClubId, (remainingByClub.get(task.awayClubId) ?? 0) + 1);
    }
    const candidates = [...pending].sort((a, b) => (
      (remainingByClub.get(b.homeClubId)! + remainingByClub.get(b.awayClubId)!)
      - (remainingByClub.get(a.homeClubId)! + remainingByClub.get(a.awayClubId)!)
      || fnv1a32(`${input.scheduleSeed}:${a.seriesId}`)
        - fnv1a32(`${input.scheduleSeed}:${b.seriesId}`)
      || (a.seriesId < b.seriesId ? -1 : a.seriesId > b.seriesId ? 1 : 0)
    ));
    const usedClubs = new Set<string>();
    const round = candidates.filter((task) => {
      if (usedClubs.has(task.homeClubId) || usedClubs.has(task.awayClubId)) return false;
      usedClubs.add(task.homeClubId);
      usedClubs.add(task.awayClubId);
      return true;
    });
    const roundLength = Math.max(...round.map((task) => task.gameCount));
    let startsOnDay = earliestStartDay;
    while (startsOnDay + roundLength - 1 <= lastAllowedDay) {
      const datesAvailable = Array.from({ length: roundLength }, (_, index) => startsOnDay + index)
        .every((day) => allowedDays.has(day)
          && !input.reservedWindows.some((reserved) =>
            day >= reserved.startsOnDay && day <= reserved.endsOnDay));
      if (datesAvailable) break;
      startsOnDay += 1;
    }
    if (startsOnDay + roundLength - 1 > lastAllowedDay) {
      throw new Error('schedule validation failure: no legal series dates remain');
    }
    for (const task of round) {
      series.push({ ...task, startsOnDay });
      pending.splice(pending.findIndex((item) => item.seriesId === task.seriesId), 1);
    }
    earliestStartDay = startsOnDay + roundLength + input.minimumDaysBetweenRounds;
  }
  return createBaseScheduleSnapshot({ ...input, series });
};
