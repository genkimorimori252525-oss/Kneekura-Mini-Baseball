import { isDeepStrictEqual } from 'node:util';
import { withCompetitionSourceReadScope } from './CompetitionSourceReadScope';
import { registerWbcFinalsFixtureFromWorld } from './WbcFinalsFixtureFromWorld';
import { registerPremierTwelveFixtureFromWorld } from './PremierTwelveFixtureFromWorld';
import { registerRegionalNationalFixtureFromWorld } from './RegionalNationalFixtureFromWorld';
import type { SqliteOfficialStateStore } from '../SqliteOfficialStateStore';
import type { SqliteNationalCallupStore } from './SqliteNationalCallupStore';
import type { SqliteManagerRosterDecisionStore } from './SqliteManagerRosterDecisionStore';
import type { SqliteNationalRosterSnapshotStore } from './SqliteNationalRosterSnapshotStore';
import type { SqlitePlayerPersonLinkStore } from './SqlitePlayerPersonLinkStore';
import type { ParticipationAuthority, OfficialParticipantBinding } from './SqliteOfficialParticipationStore';

export type NationalParticipationFixtureSources =
  | (Readonly<{ kind: 'WBC' }> & Omit<Parameters<typeof registerWbcFinalsFixtureFromWorld>[0], 'matches'>)
  | (Readonly<{ kind: 'PREMIER_12' }> & Omit<Parameters<typeof registerPremierTwelveFixtureFromWorld>[0], 'matches'>)
  | (Readonly<{ kind: 'REGIONAL_NATIONAL' }> & Omit<Parameters<typeof registerRegionalNationalFixtureFromWorld>[0], 'matches'>);
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value === value.trim();

/** Resolve existing accepted World fixtures read-only, and keep National registration separate from Club assignment. */
export const createNationalParticipationAuthority = (sources: Readonly<{
  careerId: string; editionId: string; fixtures: NationalParticipationFixtureSources;
  matches: Pick<SqliteOfficialStateStore, 'getOfficialFixture'>;
  callups: Pick<SqliteNationalCallupStore, 'readActiveRoster' | 'readEligibilityAtDay'>;
  roster: Pick<SqliteManagerRosterDecisionStore, 'readHead'>;
  rosterSnapshots: Pick<SqliteNationalRosterSnapshotStore, 'readSnapshot'>;
  personLinks: Pick<SqlitePlayerPersonLinkStore, 'readLink'>;
}>): ParticipationAuthority & Required<Pick<ParticipationAuthority, 'readNationalRegistration'>> => {
  if (!id(sources?.careerId) || !id(sources.editionId) || !sources.fixtures
    || !['WBC', 'PREMIER_12', 'REGIONAL_NATIONAL'].includes(sources.fixtures.kind)) throw new Error('invalid National participation sources');
  const readGame: ParticipationAuthority['readGame'] = (gameId) => withCompetitionSourceReadScope(() => {
    if (!id(gameId)) return null;
    const accepted = sources.matches.getOfficialFixture(gameId);
    if (!accepted) return null;
    const schedule = sources.fixtures.schedules.readSchedule(sources.careerId, sources.editionId);
    const slot = schedule?.games.find((item) => item.gameId === gameId);
    if (!slot) return null;
    // Reuse World fixture validation with a reader adapter: source traversal performs no writes.
    const matches: Pick<SqliteOfficialStateStore, 'registerOfficialFixture'> = { registerOfficialFixture(expected) {
      if (!isDeepStrictEqual(expected, accepted)) throw new Error('National participation fixture differs from accepted Match fixture');
      return accepted;
    } };
    const input = { careerId: sources.careerId, editionId: sources.editionId, gameId, gameDay: slot.gameDay };
    const fixture = sources.fixtures.kind === 'WBC'
      ? registerWbcFinalsFixtureFromWorld({ ...sources.fixtures, matches }, input)
      : sources.fixtures.kind === 'PREMIER_12'
        ? registerPremierTwelveFixtureFromWorld({ ...sources.fixtures, matches }, input)
        : registerRegionalNationalFixtureFromWorld({ ...sources.fixtures, matches }, input);
    return Object.freeze({ careerId: sources.careerId, competitionEditionId: sources.editionId,
      gameDay: fixture.gameDay, homeClubId: fixture.game.homeNationId, awayClubId: fixture.game.awayNationId,
      fixtureEventId: fixture.binding.fixtureEventId, competitionScope: 'NATIONAL' as const });
  });
  return Object.freeze({
    readGame,
    readRoster: () => null,
    readPersonLink(playerId: string, sourceId: string) {
      if (!id(playerId) || !id(sourceId)) return null;
      const link = sources.personLinks.readLink(sourceId);
      return link?.careerId === sources.careerId && link.playerId === playerId
        ? Object.freeze({ personId: link.personId, sourceId }) : null;
    },
    readNationalRegistration(binding: OfficialParticipantBinding) {
      return withCompetitionSourceReadScope(() => {
        if (binding.careerId !== sources.careerId || binding.competitionEditionId !== sources.editionId
          || !id(binding.nationalRegistrationEventId) || !id(binding.nationalRosterSnapshotId)) return null;
        const game = readGame(binding.gameId);
        if (!game || game.gameDay !== binding.gameDay
          || (binding.side === 'HOME' ? game.homeClubId : game.awayClubId) !== binding.clubId) return null;
        const registration = sources.callups.readActiveRoster(sources.careerId, sources.editionId, binding.clubId, game.gameDay)
          .find((entry) => entry.input.eventId === binding.nationalRegistrationEventId && entry.input.playerId === binding.playerId);
        if (!registration || registration.input.personId !== binding.personId
          || registration.input.personLinkSourceId !== binding.personLinkSourceId) return null;
        if (!sources.callups.readEligibilityAtDay(sources.careerId, registration.input.eventId, game.gameDay)?.decision.eligible) return null;
        const snapshot = sources.rosterSnapshots.readSnapshot(sources.careerId, binding.nationalRosterSnapshotId);
        const head = sources.roster.readHead(sources.careerId, registration.input.rosterContextClubId);
        const link = sources.personLinks.readLink(binding.personLinkSourceId);
        if (!snapshot || !head || !isDeepStrictEqual(head.roster, snapshot.roster)
          || snapshot.revision !== binding.rosterRevision || snapshot.effectiveDay > game.gameDay
          || !link || link.careerId !== sources.careerId || link.playerId !== binding.playerId || link.personId !== binding.personId
          || link.acceptedAtDay > game.gameDay || link.rosterRevision > snapshot.revision
          || snapshot.roster.players.find((player) => player.playerId === binding.playerId)?.availability.status !== 'AVAILABLE') return null;
        return Object.freeze({ careerId: sources.careerId, competitionEditionId: sources.editionId, nationId: binding.clubId,
          playerId: binding.playerId, personId: binding.personId, personLinkSourceId: binding.personLinkSourceId,
          eventId: registration.input.eventId, registeredAtDay: registration.input.registeredAtDay,
          rosterRevision: snapshot.revision, rosterSnapshotId: snapshot.snapshotId });
      });
    },
  });
};
