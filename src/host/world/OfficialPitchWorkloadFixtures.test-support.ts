import { createRequire } from 'node:module';
import type { CanonicalMatchState } from '../../core/model/CanonicalMatchState';
import { createCanonicalPlateAppearanceTimeline, recordCountedPitch } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { resolveAndRecordPitchAgainstBatter } from '../../core/sim/pitching/PitchAgainstBatter';
import { applyStrikeoutPlateAppearanceToMatchState } from '../../core/sim/plateAppearance/PlateAppearanceMatchState';
import { closeOfficialPlay, createPlayAdjudicationLedger, recordCorrectRuleSnapshot } from '../../core/adjudication/PlayAdjudicationLedger';
import { state } from '../../core/world/club/ClubFixtures.test-support';
import { createRosterState } from '../../core/world/roster/RosterState';
import { SqliteOfficialStateStore, type PersistOfficialPlayInput } from '../SqliteOfficialStateStore';
import { openSqliteOfficialScoringStore } from '../SqliteOfficialScoringStore';
import { SqliteOfficialParticipationStore } from './SqliteOfficialParticipationStore';
import { match, worldSetup } from './OfficialParticipationPlayFixtures.test-support';
import { openSqliteWorldSettlementStore } from './SqliteWorldSettlementStore';
import { openSqliteManagerRosterDecisionStore } from './SqliteManagerRosterDecisionStore';
import { openSqlitePlayerPersonLinkStore } from './SqlitePlayerPersonLinkStore';

/** Explicit physical/profile fixtures; no production counts or calibration defaults. */
export const officialPitchWorkloadFixture = (physical = true) => {
  const path = `file:official-pitch-workload-${crypto.randomUUID()}?mode=memory&cache=shared`;
  const stores: { close(): void }[] = [];
  const track = <T extends { close(): void }>(store: T): T => { stores.push(store); return store; };
  const world = track(openSqliteWorldSettlementStore(path)), roster = track(openSqliteManagerRosterDecisionStore(path));
  world.initialize({ careerId: 'career-a', clubs: [state()], schedule: { leagueId: 'league-a', seasonId: 'league-season-1',
    memberClubIds: ['club-a', 'club-b'], regularSeasonGamesPerClub: 1,
    revisionEventIds: [], games: [{ gameId: 'game-1', homeClubId: 'club-a', awayClubId: 'club-b' }] },
    standingsPolicy: { version: 'v1', tieCreditNumerator: 1, tieCreditDenominator: 2, runDifferentialCapPerGame: 10 } });
  roster.initialize({ careerId: 'career-a', clubId: 'club-a', mood: null, roster: createRosterState({ careerId: 'career-a', effectiveDay: 1,
    profiles: [{ profileId: 'fixture-league', version: 'v1', season: 1, competitionEditionId: 'league-season-1', activeLimit: null,
      allowedAssignmentKinds: ['FIRST_TEAM'], rehabParticipationAllowed: false }],
    units: [{ unitId: 'first-a', clubId: 'club-a', kind: 'FIRST_TEAM' }], players: [{ playerId: 'p2',
      clubRights: { rightsHolderClubId: 'club-a', contractId: 'contract-p2' }, assignment: { unitId: 'first-a', clubId: 'club-a' },
      registrations: [{ competitionEditionId: 'league-season-1', clubId: 'club-a', status: 'ACTIVE', eligibility: 'ELIGIBLE', evidenceId: 'fixture-registration' }],
      availability: { status: 'AVAILABLE', evidenceId: 'fixture-health' } }] }) });
  const links = track(openSqlitePlayerPersonLinkStore(path, { readAcceptedPlayerIntake: (sourceId) => sourceId === 'intake-p2' ? {
    sourceId, careerId: 'career-a', playerId: 'p2', personId: 'person-p2', sourceRecordId: 'accepted-intake', sourceVersion: 'v1',
    acceptedRevision: 0, acceptedAtDay: 1, rosterRevision: 0 } : null }));
  links.accept('intake-p2');
  const official = track(new SqliteOfficialStateStore(path));
  official.registerOfficialFixture({ gameId: 'game-1', venueId: 'venue-1', fixtureEventId: 'fixture-1', fixtureRevision: 0 });
  const authority = { readGame: (gameId: string) => gameId === 'game-1' && world.readSeason('career-a', 'league-season-1') ? {
    careerId: 'career-a', competitionEditionId: 'league-season-1', gameDay: 10, homeClubId: 'club-a', awayClubId: 'club-b', fixtureEventId: 'fixture-1' } : null,
    readRoster: (careerId: string, clubId: string) => roster.readHead(careerId, clubId)?.roster ?? null,
    readPersonLink: (playerId: string, sourceId: string) => { const link = links.readLink(sourceId); return link?.playerId === playerId ? {
      personId: link.personId, sourceId: link.sourceId } : null; } };
  const participation = track(new SqliteOfficialParticipationStore(path, authority));
  participation.bindPregame({ gameId: 'game-1', careerId: 'career-a', competitionEditionId: 'league-season-1', gameDay: 10,
    clubId: 'club-a', side: 'HOME', playerId: 'p2', personId: 'person-p2', personLinkSourceId: 'intake-p2', rosterRevision: 0, fixtureEventId: 'fixture-1' });
  const application = (before: CanonicalMatchState, durableRevision: number, startedAtTick: number,
    applicationId: string): Extract<PersistOfficialPlayInput, { kind: 'non_live' }> => {
    let timeline = createCanonicalPlateAppearanceTimeline(before, startedAtTick);
    for (let index = 0; index < 3; index += 1) {
      const tick = timeline.lastEventTick + 100_000;
      if (!physical) timeline = recordCountedPitch(timeline, tick, { kind: 'called_strike' });
      else timeline = resolveAndRecordPitchAgainstBatter(timeline, { action: { kind: 'take' }, trajectory: {
        start: { tick, position: { x: 0, y: 1.5, z: 18 }, velocity: { x: 0, y: 0, z: -30 }, spin: { x: 0, y: 100, z: 0 } },
        acceleration: { x: 0, y: 0, z: 0 }, endTick: tick + 700_000, ticksPerSecond: 1_000_000 },
        plateZ: 0, strikeZone: { centerX: 0, halfWidth: 0.2, lowerY: 1.4, upperY: 1.6 }, ballRadiusMeters: 0.0366 }).timeline;
    }
    const next = applyStrikeoutPlateAppearanceToMatchState(before, timeline);
    let adjudication = createPlayAdjudicationLedger({ playId: before.playId, ruleProfileId: before.ruleProfileId, playEnd: null });
    adjudication = recordCorrectRuleSnapshot(adjudication, 0, { eventId: `rule-${applicationId}`, tick: timeline.lastEventTick + 1,
      snapshotId: `rule-${applicationId}`, evidenceRevision: 1, ruling: { outsAfter: next.outs, basesAfter: next.bases, scoredRunnerIds: [] } });
    adjudication = closeOfficialPlay(adjudication, 1, { eventId: `close-${applicationId}`, closureId: applicationId, tick: timeline.lastEventTick + 2 });
    return { kind: 'non_live', matchId: 'game-1', applicationId, expectedDurableRevision: durableRevision, match: before,
      timeline, adjudication, context: { kind: 'strikeout' }, nextStartedAtTick: timeline.lastEventTick + 3, worldSetup: worldSetup('p2') };
  };
  const initial = match(); official.initializeMatch('game-1', initial);
  const firstInput = application(initial, 0, 0, 'application-1'), first = official.applyAndActivate(firstInput);
  const secondInput = application(first.activation.nextMatchState, 1, firstInput.nextStartedAtTick, 'application-2');
  official.applyAndActivate(secondInput);
  const scoring = track(openSqliteOfficialScoringStore(path));
  scoring.apply({ scoringApplicationId: 'scoring-2', officialApplication: secondInput });
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = track(new DatabaseSync(path));
  return { path, world, roster, links, official, participation, authority, scoring, secondInput, db, track,
    close: () => stores.reverse().forEach((store) => store.close()) };
};
