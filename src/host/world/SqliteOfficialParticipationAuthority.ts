import { isDeepStrictEqual } from 'node:util';
import { applyScheduleRevisions } from
  '../../core/world/competition/LeagueSchedule';
import { matchesDomesticFixtureRevision } from
  '../../core/world/competition/DomesticFixtureVenue';
import { captureOfficialStandingsSchedule } from
  '../../core/world/competition/OfficialStandingsScheduleSource';
import type { SqliteOfficialStateStore } from '../SqliteOfficialStateStore';
import type { SqliteDomesticScheduleStore } from './SqliteDomesticScheduleStore';
import type { SqliteWorldSettlementStore } from './SqliteWorldSettlementStore';
import type { SqliteManagerRosterDecisionStore } from
  './SqliteManagerRosterDecisionStore';
import type { AcceptedPlayerPersonLinkAuthority } from
  './SqliteFreeAgentContractStore';
import type { ParticipationAuthority } from
  './SqliteOfficialParticipationStore';

const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value === value.trim();

/** Resolves the domestic competition from accepted World, schedule, and Match heads. */
export const createDomesticParticipationAuthority = (sources: Readonly<{
  careerId: string;
  seasonId: string;
  world: SqliteWorldSettlementStore;
  schedule: SqliteDomesticScheduleStore;
  roster: SqliteManagerRosterDecisionStore;
  match: SqliteOfficialStateStore;
  /** No general durable Player–Person store exists yet. */
  personLinks: AcceptedPlayerPersonLinkAuthority;
}>): ParticipationAuthority => {
  if (!sources || !id(sources.careerId) || !id(sources.seasonId)
    || !sources.world || !sources.schedule || !sources.roster
    || !sources.match || !sources.personLinks
    || typeof sources.personLinks.readAcceptedPlayerPersonLink !== 'function') {
    throw new Error('domestic participation sources are incomplete');
  }
  return Object.freeze({
    readGame(gameId: string) {
      if (!id(gameId)) return null;
      const archive = sources.schedule.read(sources.careerId,
        sources.seasonId);
      const season = sources.world.readSeason(sources.careerId,
        sources.seasonId);
      const fixture = sources.match.getOfficialFixture(gameId);
      if (!archive || !season || !fixture) return null;
      const schedule = applyScheduleRevisions(archive.baseSchedule,
        archive.revisions);
      const game = schedule.games.find((item) => item.gameId === gameId);
      if (!game || !isDeepStrictEqual(season.schedule,
        captureOfficialStandingsSchedule(archive.baseSchedule,
          archive.revisions))
        || !matchesDomesticFixtureRevision(fixture,
          sources.careerId, archive.baseSchedule, archive.revisions)) {
        return null;
      }
      const home = sources.world.readClub(sources.careerId,
        game.homeClubId);
      const away = sources.world.readClub(sources.careerId,
        game.awayClubId);
      const venueParts = JSON.parse(fixture.fixtureEventId) as unknown[];
      if (!home || !away || [home, away].some((club) =>
        club.state.season.closureRef !== null
        || club.state.effectiveDay > game.day
        || club.state.season.plan.startsOnDay > game.day
        || !club.state.season.plan.competitionEditionIds
          .includes(sources.seasonId)
        || club.state.season.plan.financialProfile.leagueId
          !== schedule.leagueId)
        || home.state.institutional.stadium.stadiumId
          !== fixture.venueId
        || venueParts[venueParts.length - 2] !== home.revision) {
        return null;
      }
      return Object.freeze({ careerId: sources.careerId,
        competitionEditionId: sources.seasonId,
        gameDay: game.day, homeClubId: game.homeClubId,
        awayClubId: game.awayClubId,
        fixtureEventId: fixture.fixtureEventId });
    },
    readRoster(careerId: string, clubId: string) {
      if (careerId !== sources.careerId || !id(clubId)) return null;
      return sources.roster.readHead(careerId, clubId)?.roster ?? null;
    },
    readPersonLink(playerId: string, sourceId: string) {
      if (!id(playerId) || !id(sourceId)) return null;
      const link = sources.personLinks.readAcceptedPlayerPersonLink(sourceId);
      if (!link || link.careerId !== sources.careerId
        || link.playerId !== playerId || !id(link.personId)) return null;
      return Object.freeze({ personId: link.personId, sourceId });
    },
  });
};
