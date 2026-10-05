import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { state } from '../../core/world/club/ClubFixtures.test-support';
import { createRosterState } from '../../core/world/roster/RosterState';
import { openSqliteWorldSettlementStore } from './SqliteWorldSettlementStore';
import { openSqliteManagerRosterDecisionStore } from './SqliteManagerRosterDecisionStore';
import { openSqlitePlayerPersonLinkStore, type AcceptedPlayerIntakeSource } from './SqlitePlayerPersonLinkStore';
import { openSqlitePlayerFieldingModelStore, type AcceptedPlayerFieldingModel } from './SqlitePlayerFieldingModelStore';

export const playerFieldingModelFixture = (options: Readonly<{ initialRosterRevision?: number }> = {}) => {
  const path = join(mkdtempSync(join(tmpdir(), 'kneekura-fielding-model-')), 'state.sqlite'), stores: { close(): void }[] = [];
  const track = <T extends { close(): void }>(store: T): T => { stores.push(store); return store; };
  const world = track(openSqliteWorldSettlementStore(path)), roster = track(openSqliteManagerRosterDecisionStore(path));
  world.initialize({ careerId: 'career-a', clubs: [state()], schedule: { seasonId: 'league-season-1', leagueId: 'league-a',
    memberClubIds: ['club-a', 'club-b'], regularSeasonGamesPerClub: 1,
    games: [{ gameId: 'game-1', homeClubId: 'club-a', awayClubId: 'club-b' }], revisionEventIds: [] },
    standingsPolicy: { version: 'standings-v1', tieCreditNumerator: 1, tieCreditDenominator: 2, runDifferentialCapPerGame: 10 } });
  roster.initialize({ careerId: 'career-a', clubId: 'club-a', mood: null, roster: createRosterState({ careerId: 'career-a', effectiveDay: 10,
    ...(options.initialRosterRevision === undefined ? {} : { revision: options.initialRosterRevision }),
    profiles: [{ profileId: 'league', version: 'v1', season: 1, competitionEditionId: 'league-season-1', activeLimit: null,
      allowedAssignmentKinds: ['FIRST_TEAM'], rehabParticipationAllowed: false }], units: [{ unitId: 'first-a', clubId: 'club-a', kind: 'FIRST_TEAM' }],
    players: ['player-a', 'player-b'].map((playerId) => ({ playerId, clubRights: { rightsHolderClubId: 'club-a', contractId: `contract-${playerId}` },
      assignment: { unitId: 'first-a', clubId: 'club-a' }, registrations: [], availability: { status: 'AVAILABLE' as const, evidenceId: `health-${playerId}` } })) }) });
  const intake: AcceptedPlayerIntakeSource = { sourceId: 'intake-a', careerId: 'career-a', playerId: 'player-a', personId: 'person-a',
    sourceRecordId: 'actual-intake-a', sourceVersion: 'fixture-v1', acceptedRevision: 1, acceptedAtDay: 10, rosterRevision: options.initialRosterRevision ?? 0 };
  const links = track(openSqlitePlayerPersonLinkStore(path, { readAcceptedPlayerIntake: (id) => id === intake.sourceId ? intake : null }));
  const person = links.accept(intake.sourceId);
  const source: AcceptedPlayerFieldingModel = { sourceId: 'fielding-a', sourceVersion: 'fixture-v1', careerId: 'career-a', playerId: 'player-a',
    personLinkSourceId: intake.sourceId, acceptedAtDay: 10, ratings: { positionSuitability: { P: 0.5, C: 0.5, '1B': 0.5, '2B': 0.5,
      '3B': 0.5, SS: 0.5, LF: 0.5, CF: 0.5, RF: 0.5 }, firstStep: 0.5, acceleration: 0.5, battedBallRead: 0.5, routeEfficiency: 0.5,
      catching: 0.5, transfer: 0.5, armStrength: 0.5, throwingAccuracy: 0.5, situationalAwareness: 0.5, tagSkill: 0.5 },
    transferParameters: { minimumTransferDelayTicks: 100, maximumTransferDelayTicks: 300, fixedGripOffsetTicks: 10 },
    throwCalibration: { minimumReleaseSpeedMps: 10, maximumReleaseSpeedMps: 30, minimumTargetErrorMeters: 0, maximumTargetErrorMeters: 1 } };
  const sources = new Map([[source.sourceId, source]]), authority = { readAcceptedModel: (id: string) => sources.get(id) ?? null };
  const models = track(openSqlitePlayerFieldingModelStore(path, authority));
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'), db = track(new DatabaseSync(path));
  return { path, person, source, sources, authority, models, links, db, track, close: () => { stores.reverse().forEach((store) => store.close()); } };
};
