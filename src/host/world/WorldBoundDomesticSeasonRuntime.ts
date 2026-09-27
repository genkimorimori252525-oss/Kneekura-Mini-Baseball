import type { ClubWorldRegion } from
  '../../core/world/competition/ClubWorldBerths';
import type { LeagueScheduleGeneratorInput } from
  '../../core/world/competition/LeagueScheduleGenerator';
import type { LeagueSeasonEventProfile } from
  '../../core/world/competition/LeagueSeasonEvents';
import { generateWorldBoundLeagueSchedule } from
  '../../core/world/competition/WorldLeagueSchedule';
import { initializeDomesticSeason,
  type DomesticSeasonStores } from './DomesticSeasonRuntime';
import type { DurableDomesticSchedule } from
  './SqliteDomesticScheduleStore';
import type { InitializeWorldSeason } from
  './SqliteWorldSettlementStore';
import type { SqliteWorldCompetitionCycleStore } from
  './SqliteWorldCompetitionCycleStore';

export type WorldBoundDomesticSeasonInput =
  Omit<InitializeWorldSeason, 'schedule'> & Readonly<{
    cycleOrdinal: number;
    leagueRegion: ClubWorldRegion;
    seasonDayOne: string;
    generatorInput: LeagueScheduleGeneratorInput;
    eventProfile: LeagueSeasonEventProfile;
  }>;
export type DurableWorldBoundDomesticSeason = Readonly<{
  schedule: DurableDomesticSchedule;
  worldWindowSnapshotId: string;
}>;

/** Reserve the frozen World cycle before committing a domestic base schedule. */
export const initializeWorldBoundDomesticSeason = (
  stores: DomesticSeasonStores & Readonly<{
    cycle: Pick<SqliteWorldCompetitionCycleStore, 'readCycle'>;
  }>,
  input: WorldBoundDomesticSeasonInput,
): DurableWorldBoundDomesticSeason => {
  const cycle = stores.cycle.readCycle(input.careerId,
    input.cycleOrdinal);
  if (!cycle) throw new Error('accepted World cycle is missing');
  const bound = generateWorldBoundLeagueSchedule(input.generatorInput,
    cycle, input.leagueRegion, input.seasonDayOne);
  const schedule = initializeDomesticSeason(stores, {
    careerId: input.careerId, clubs: input.clubs,
    standingsPolicy: input.standingsPolicy,
    baseSchedule: bound.schedule,
    eventProfile: input.eventProfile,
  });
  return Object.freeze({ schedule,
    worldWindowSnapshotId: bound.worldWindowSnapshotId });
};
