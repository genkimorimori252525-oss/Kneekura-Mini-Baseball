import { expect, it } from 'vitest';
import { planWbcFinalsGroups } from '../../core/world/competition/WbcFinalsGroups';
import { planWbcFinalsSchedule } from '../../core/world/competition/WbcFinalsSchedule';
import { wbcFinalsInput } from './WbcFinalsFixtures.test-support';

const { edition, berths, knockoutEdition } = wbcFinalsInput(
  { startsOnDay: 426, endsOnDay: 445 }, 'cutoff');
const plan = planWbcFinalsGroups(edition, berths);
const policy = { version: 'wbc-test-schedule-v1', gamesPerVenuePerDay: 2,
  minimumOffDaysBetweenRounds: 1 };

it('schedules every WBC game with venue capacity and nation rest across rounds', () => {
  const schedule = planWbcFinalsSchedule(edition, plan, knockoutEdition, policy);
  expect(planWbcFinalsSchedule(edition, plan, knockoutEdition, policy)).toEqual(schedule);
  expect(schedule.games).toHaveLength(51);
  expect(new Set(schedule.games.map((game) => game.gameId)).size).toBe(51);
  const groupGames = plan.groups.flatMap((group) => group.games);
  for (const nationId of berths.entrantNationIds) {
    const days = schedule.games.filter((slot) => groupGames.some((game) =>
      game.gameId === slot.gameId && [game.homeNationId, game.awayNationId].includes(nationId)))
      .map((slot) => slot.gameDay);
    expect(days).toEqual([426, 428, 430]);
  }
  expect(schedule.games.filter((game) => game.stage === 'ROUND_OF_16')
    .map((game) => game.gameDay)).toEqual([432, 432, 432, 432, 433, 433, 433, 433]);
  expect(schedule.games.filter((game) => game.stage === 'FINAL')[0].gameDay).toBe(439);
  for (const game of schedule.games) expect(game.venueGameOrdinal).toBeLessThan(2);
});

it('rejects incomplete windows, invalid US knockout metadata and invalid capacity', () => {
  expect(() => planWbcFinalsSchedule({ ...edition,
    calendarWindow: { startsOnDay: 426, endsOnDay: 438 } }, plan, knockoutEdition, policy))
    .toThrow('window cannot contain');
  expect(() => planWbcFinalsSchedule(edition, plan, { ...knockoutEdition,
    roundOf16HubIndices: [9, ...knockoutEdition.roundOf16HubIndices.slice(1)] }, policy))
    .toThrow('knockout edition');
  expect(() => planWbcFinalsSchedule(edition, plan, knockoutEdition,
    { ...policy, gamesPerVenuePerDay: 0 })).toThrow('policy');
});
