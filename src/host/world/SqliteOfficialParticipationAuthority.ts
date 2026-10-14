import type { SqliteDomesticCompetitionSeasonStore } from './SqliteDomesticCompetitionSeasonStore';
import { isDeepStrictEqual } from 'node:util';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { replayClubEvents } from '../../core/world/club/ClubEvents';
import type { MatchdayClubHistory } from
  '../../core/world/club/OfficialMatchdayRevenue';
import { applyScheduleRevisions } from
  '../../core/world/competition/LeagueSchedule';
import { bindDomesticFixtureVenue,
  matchesDomesticFixtureRevision } from
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
import type { ParticipationAuthority, OfficialParticipantBinding, SqliteOfficialParticipationStore } from
  './SqliteOfficialParticipationStore';

const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value === value.trim();
const clubAtDay = (history: MatchdayClubHistory,
  gameDay: number) => {
  const accepted = history.acceptedEvents.filter((event) =>
    event.command.effectiveDay <= gameDay);
  const atDay = replayClubEvents(history.checkpoint, accepted);
  return atDay.ok && atDay.value.effectiveDay <= gameDay
    ? atDay.value : null;
};

/** Resolves the domestic competition from accepted World, schedule, and Match heads. */
export const createDomesticParticipationAuthority = (sources: Readonly<{
  careerId: string;
  seasonId: string;
  world: SqliteWorldSettlementStore;
  schedule: SqliteDomesticScheduleStore;
  roster: SqliteManagerRosterDecisionStore;
  match: SqliteOfficialStateStore;
  /** The accepted global Player–Person link source. */
  personLinks: AcceptedPlayerPersonLinkAuthority;
  postseason?: Pick<SqliteDomesticCompetitionSeasonStore, 'readPostseasonGame'>;
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
      if (!game && sources.postseason) {
        const accepted = sources.postseason.readPostseasonGame(sources.careerId, sources.seasonId, gameId);
        if (!accepted || accepted.careerId !== sources.careerId || accepted.seasonId !== sources.seasonId
          || accepted.gameId !== gameId || !isDeepStrictEqual(accepted.fixture, fixture)) return null;
        return Object.freeze({ careerId: accepted.careerId, competitionEditionId: accepted.seasonId, gameDay: accepted.gameDay,
          homeClubId: accepted.homeClubId, awayClubId: accepted.awayClubId, fixtureEventId: fixture.fixtureEventId });
      }
      if (!game || !isDeepStrictEqual(season.schedule,
        captureOfficialStandingsSchedule(archive.baseSchedule,
          archive.revisions))
        || !matchesDomesticFixtureRevision(fixture,
          sources.careerId, archive.baseSchedule, archive.revisions)) {
        return null;
      }
      const homeHistory = sources.world.readClubHistory(sources.careerId,
        game.homeClubId);
      const awayHistory = sources.world.readClubHistory(sources.careerId,
        game.awayClubId);
      if (!homeHistory || !awayHistory) return null;
      const away = clubAtDay(awayHistory, game.day);
      if (!away || away.identity.clubId !== game.awayClubId
        || away.season.closureRef !== null
        || away.season.plan.startsOnDay > game.day
        || !away.season.plan.competitionEditionIds
          .includes(sources.seasonId)
        || away.season.plan.financialProfile.leagueId
          !== schedule.leagueId) {
        return null;
      }
      try {
        const venueParts = JSON.parse(fixture.fixtureEventId) as unknown[];
        const venueRevisionAtGame = venueParts[venueParts.length - 2];
        if (typeof venueRevisionAtGame !== 'number'
          || !isDeepStrictEqual(bindDomesticFixtureVenue({
            baseSchedule: archive.baseSchedule,
            revisions: archive.revisions, gameId,
            venueRevisionAtGame, history: homeHistory,
          }).binding, fixture)) return null;
      } catch {
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

/** Resolve only the identity fields of an explicitly selected participant. The
 * existing participation owner still validates eligibility and commits the
 * binding; this neither chooses a lineup nor records an actual appearance. */
export const bindDomesticPregameParticipantFromWorld = (
  sources: Parameters<typeof createDomesticParticipationAuthority>[0] & Readonly<{
    participation: Pick<SqliteOfficialParticipationStore, 'bindPregame' | 'readPregameBinding'>;
  }>,
  raw: Readonly<{ gameId: string; clubId: string; playerId: string; personLinkSourceId: string }>,
): OfficialParticipantBinding => {
  const input = cloneInert(raw), fields = ['gameId', 'clubId', 'playerId', 'personLinkSourceId'];
  if (!input || Object.keys(input).length !== fields.length || fields.some(key => !Object.hasOwn(input, key))
    || ![input.gameId, input.clubId, input.playerId, input.personLinkSourceId].every(id)) {
    throw new Error('invalid domestic pregame participant input');
  }
  const authority = createDomesticParticipationAuthority(sources);
  const game = authority.readGame(input.gameId), link = authority.readPersonLink(input.playerId, input.personLinkSourceId);
  if (!game || !link || ![game.homeClubId, game.awayClubId].includes(input.clubId)) {
    throw new Error('domestic pregame participant lacks accepted game or Person evidence');
  }
  const identity = { gameId: input.gameId, careerId: game.careerId, competitionEditionId: game.competitionEditionId,
    gameDay: game.gameDay, clubId: input.clubId, side: input.clubId === game.homeClubId ? 'HOME' as const : 'AWAY' as const,
    playerId: input.playerId, personId: link.personId, personLinkSourceId: link.sourceId, fixtureEventId: game.fixtureEventId };
  const prior = sources.participation.readPregameBinding(input.gameId, input.playerId);
  if (prior) {
    if (prior.nationalRegistrationEventId !== undefined || prior.nationalRosterSnapshotId !== undefined
      || Object.entries(identity).some(([key, value]) => prior[key as keyof OfficialParticipantBinding] !== value)) {
      throw new Error('domestic pregame binding already differs');
    }
    // Later roster or Match progress cannot rewrite the original accepted revision.
    return prior;
  }
  const roster = authority.readRoster(game.careerId, input.clubId);
  if (!roster) throw new Error('domestic pregame participant lacks accepted roster evidence');
  return sources.participation.bindPregame({ ...identity, rosterRevision: roster.revision });
};
