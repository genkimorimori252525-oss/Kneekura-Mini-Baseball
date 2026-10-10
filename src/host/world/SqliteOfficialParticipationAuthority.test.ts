import { afterEach, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, sep } from 'node:path';
import { bootstrap, command, state, value } from '../../core/world/club/ClubFixtures.test-support';
import { applyClubCommand } from '../../core/world/club/ClubLifecycle';
import { createClubFromSeed } from '../../core/world/club';
import { createBaseScheduleSnapshot } from '../../core/world/competition/LeagueSchedule';
import { captureOfficialStandingsSchedule } from
  '../../core/world/competition/OfficialStandingsScheduleSource';
import { createRosterState } from '../../core/world/roster/RosterState';
import { asRuleProfileId } from '../../core/model/RuleProfileRef';
import type { CanonicalMatchState } from '../../core/model/CanonicalMatchState';
import { closeOfficialPlay, createPlayAdjudicationLedger,
  recordCorrectRuleSnapshot } from '../../core/adjudication/PlayAdjudicationLedger';
import { registerDomesticFixtureFromWorld } from '../RegisterDomesticFixture';
import { SqliteOfficialStateStore } from '../SqliteOfficialStateStore';
import { openSqliteWorldSettlementStore } from './SqliteWorldSettlementStore';
import { openSqliteDomesticScheduleStore } from './SqliteDomesticScheduleStore';
import { openSqliteManagerRosterDecisionStore } from './SqliteManagerRosterDecisionStore';
import { SqliteOfficialParticipationStore } from './SqliteOfficialParticipationStore';
import { createDomesticParticipationAuthority } from './SqliteOfficialParticipationAuthority';
import { bindDomesticPregameParticipantFromWorld } from './SqliteOfficialParticipationAuthority';
import { prepareDomesticOpeningMatch } from './DomesticSeasonRuntime';
import { NPB_2026_RULE_PROFILE } from '../../core/rules/RuleProfile';
import { appendAcceptedClubEvents } from './SqliteClubEventJournal';

const directories: string[] = [];
const stores: { close(): void }[] = [];
afterEach(() => {
  for (const store of stores.splice(0).reverse()) store.close();
  const root = realpathSync(tmpdir());
  for (const directory of directories.splice(0)) {
    const target = realpathSync(directory);
    if (!target.startsWith(`${root}${sep}`)
      || !basename(target).startsWith('kneekura-participation-authority-')) {
      throw new Error('test cleanup escaped temporary directory');
    }
    rmSync(target, { recursive: true, force: true });
  }
});

const secondClub = () => {
  const first = bootstrap();
  return value(createClubFromSeed({ ...first,
    context: { ...first.context, existingClubIds: ['club-a'] },
    seed: { ...first.seed, identity: { ...first.seed.identity,
      clubId: 'club-b', canonicalOriginId: 'source-b',
      foundingIdentityRef: 'founding-b' } },
    initial: { ...first.initial,
      brand: { displayName: 'Second Club', shortName: 'SC' },
      references: { ...first.initial.references,
        staffRoleLinks: [{ roleId: 'manager-role', roleKind: 'MANAGER',
          personId: 'manager-b', appointmentId: 'appointment-b' }],
        rivalryStateRefs: [] },
    },
  }));
};

const ruleProfileId = asRuleProfileId('test-rules');
const initialMatch = (): CanonicalMatchState => ({
  ruleProfileId, inning: 1, half: 'top', outs: 0, balls: 0, strikes: 0,
  bases: { first: null, second: null, third: null },
  score: { away: 0, home: 0 }, playId: 7,
});
const applyPlay = (store: SqliteOfficialStateStore,
  prior: CanonicalMatchState, revision: number,
  endTick: number) => {
  const playId = prior.playId;
  const playEnd = { kind: 'play_end' as const, tick: endTick,
    reason: 'live_action_complete' as const };
  let ledger = createPlayAdjudicationLedger({
    playId, ruleProfileId: prior.ruleProfileId, playEnd });
  ledger = recordCorrectRuleSnapshot(ledger, 0, {
    eventId: `rule-${playId}`, tick: endTick + 1,
    snapshotId: `snapshot-${playId}`, evidenceRevision: 1,
    ruling: { outsAfter: prior.outs + 1,
      basesAfter: prior.bases, scoredRunnerIds: [] },
  });
  ledger = closeOfficialPlay(ledger, 1, {
    eventId: `close-${playId}`, closureId: `closure-${playId}`,
    tick: endTick + 2,
  });
  return store.applyAndActivate({ kind: 'live_ball',
    matchId: 'series-a:1', applicationId: `application-${playId}`,
    expectedDurableRevision: revision, match: prior,
    physicalTimeline: { playId,
      startedAtTick: endTick - 400, lastEventTick: endTick,
      nextSequence: 1,
      status: { kind: 'live_ball_complete',
        count: { balls: 0, strikes: 0 },
        contactTick: endTick - 300, playEndTick: endTick,
        disposition: { kind: 'fair',
          fairDeterminationTick: endTick - 290 } },
      events: [{ tick: endTick, sequence: 0,
        kind: 'LiveBallPlayEnded', payload: { playEnd } }],
    }, adjudication: ledger, nextStartedAtTick: endTick + 3,
    worldSetup: {
      baseCenters: { first: { x: 27, z: 0 },
        second: { x: 27, z: 27 }, third: { x: 0, z: 27 } },
      defenders: (['P', 'C', '1B', '2B', '3B', 'SS', 'LF',
        'CF', 'RF'] as const).map((registeredPosition, index) => ({
        playerId: index === 0 ? 'player-a' : `home-${index}`,
        registeredPosition, position: { x: index, z: index },
      })),
      activePreviousPlayControllerIds: [],
    } });
};

const setup = () => {
  const directory = mkdtempSync(join(tmpdir(),
    'kneekura-participation-authority-'));
  directories.push(directory);
  const worldPath = join(directory, 'world.sqlite');
  const matchPath = join(directory, 'match.sqlite');
  const world = openSqliteWorldSettlementStore(worldPath);
  const archive = openSqliteDomesticScheduleStore(worldPath);
  const roster = openSqliteManagerRosterDecisionStore(worldPath);
  const match = new SqliteOfficialStateStore(matchPath);
  stores.push(world, archive, roster, match);
  const base = createBaseScheduleSnapshot({
    seasonId: 'league-season-1', leagueId: 'league-a',
    calendarProfileVersion: 'calendar-v1', generatorVersion: 'generator-v1',
    scheduleSeed: 'seed-a', opponentMatrixVersion: 'matrix-v1',
    regularSeasonGamesPerClub: 2, memberClubIds: ['club-a', 'club-b'],
    opponentMatrix: [{ homeClubId: 'club-a', awayClubId: 'club-b',
      gameCount: 2 }], allowedDays: [11, 12], reservedWindows: [],
    series: [{ seriesId: 'series-a', homeClubId: 'club-a',
      awayClubId: 'club-b', startsOnDay: 11, gameCount: 2 }],
  });
  world.initialize({ careerId: 'career-a',
    schedule: captureOfficialStandingsSchedule(base, []),
    standingsPolicy: { version: 'standings-v1',
      tieCreditNumerator: 1, tieCreditDenominator: 2,
      runDifferentialCapPerGame: 10 },
    clubs: [state(), secondClub()] });
  archive.initialize('career-a', base);
  roster.initialize({ careerId: 'career-a', clubId: 'club-a', mood: null,
    roster: createRosterState({ careerId: 'career-a', effectiveDay: 10,
      profiles: [{ profileId: 'league', version: 'v1', season: 1,
        competitionEditionId: 'league-season-1', activeLimit: null,
        allowedAssignmentKinds: ['FIRST_TEAM'],
        rehabParticipationAllowed: false }],
      units: [{ unitId: 'first-a', clubId: 'club-a', kind: 'FIRST_TEAM' }],
      players: [{ playerId: 'player-a',
        clubRights: { rightsHolderClubId: 'club-a', contractId: 'contract-a' },
        assignment: { unitId: 'first-a', clubId: 'club-a' },
        registrations: [{ competitionEditionId: 'league-season-1',
          clubId: 'club-a', status: 'ACTIVE', eligibility: 'ELIGIBLE',
          evidenceId: 'registration-a' }],
        availability: { status: 'AVAILABLE', evidenceId: 'health-a' },
      }],
    }) });
  registerDomesticFixtureFromWorld(world, archive, match, {
    careerId: 'career-a', seasonId: 'league-season-1',
    gameId: 'series-a:1',
  });
  return { world, archive, roster, match, matchPath, worldPath };
};

it('retains participation authority for a pinned past venue after a later stadium change', () => {
  const { world, archive, roster, match, worldPath } = setup();
  const before = world.readClub('career-a', 'club-a')!;
  const changed = applyClubCommand(before.state, {
    ...command([{ kind: 'REPLACE_STADIUM', stadium: {
      ...before.state.institutional.stadium,
      stadiumId: 'stadium-later', geometryRef: 'geometry-later' } }],
    before.state, 'future-stadium'), effectiveDay: 12,
  });
  if (!changed.ok) throw new Error('fixture event was rejected');
  const Database = (createRequire(import.meta.url)('node:sqlite') as
    typeof import('node:sqlite')).DatabaseSync;
  const db = new Database(worldPath);
  const canonicalJson = (value: unknown): string => JSON.stringify(value,
    (_key, item: unknown) => item !== null && typeof item === 'object'
      && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) =>
        a < b ? -1 : a > b ? 1 : 0)) : item);
  db.exec('BEGIN IMMEDIATE');
  try {
    appendAcceptedClubEvents(db, before.state, [changed.event], changed.state);
    db.prepare(`UPDATE world_club_heads SET revision=?, state_json=?
      WHERE career_id=? AND club_id=? AND revision=?`).run(
        changed.state.revision, canonicalJson(changed.state),
        'career-a', 'club-a', before.revision);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  } finally {
    db.close();
  }
  const authority = createDomesticParticipationAuthority({
    careerId: 'career-a', seasonId: 'league-season-1',
    world, schedule: archive, roster, match,
    personLinks: { readAcceptedPlayerPersonLink: () => null },
  });
  expect(authority.readGame('series-a:1')).toMatchObject({
    gameDay: 11, homeClubId: 'club-a',
    fixtureEventId: match.getOfficialFixture('series-a:1')?.fixtureEventId,
  });
});

it('reads real World/Match SQLite heads and binds only an accepted person link', () => {
  const { world, archive, roster, match, matchPath } = setup();
  const authority = createDomesticParticipationAuthority({
    careerId: 'career-a', seasonId: 'league-season-1',
    world, schedule: archive, roster, match,
    personLinks: { readAcceptedPlayerPersonLink: (sourceId) =>
      sourceId === 'person-link-a'
        ? { careerId: 'career-a', playerId: 'player-a',
          personId: 'person-a' } : null },
  });
  const game = authority.readGame('series-a:1');
  expect(game).toEqual({ careerId: 'career-a',
    competitionEditionId: 'league-season-1', gameDay: 11,
    homeClubId: 'club-a', awayClubId: 'club-b',
    fixtureEventId: match.getOfficialFixture('series-a:1')?.fixtureEventId });
  expect(authority.readGame('missing')).toBeNull();
  expect(authority.readRoster('career-a', 'club-a')?.players[0]?.playerId)
    .toBe('player-a');
  expect(authority.readPersonLink('player-a', 'person-link-a'))
    .toEqual({ personId: 'person-a', sourceId: 'person-link-a' });
  expect(authority.readPersonLink('player-a', 'missing')).toBeNull();
  const participation = new SqliteOfficialParticipationStore(matchPath,
    authority);
  stores.push(participation);
  const binding = { ...game!, gameId: 'series-a:1',
    clubId: 'club-a', side: 'HOME' as const, playerId: 'player-a',
    personId: 'person-a', personLinkSourceId: 'person-link-a',
    rosterRevision: 0 };
  expect(participation.bindPregame(binding)).toEqual(binding);
  expect(() => participation.bindPregame({ ...binding,
    personLinkSourceId: 'missing', personId: 'other' }))
    .toThrow('already differs');
  match.initializeMatch('series-a:1', initialMatch());
  const first = applyPlay(match, initialMatch(), 0, 500);
  applyPlay(match, first.activation.nextMatchState, 1, 900);
  const receipt = participation.confirmPlayed('series-a:1', 'player-a',
    'DEFENDER', 'application-7', 'application-8');
  expect(participation.readAcceptedPopularityEvent(receipt.receiptId))
    .toMatchObject({ kind: 'OFFICIAL_GAME', personId: 'person-a',
      acceptedRevision: 2, occurredAtDay: 11 });
});

it('fails closed when the accepted player-person link is unavailable', () => {
  const { world, archive, roster, match, matchPath } = setup();
  const authority = createDomesticParticipationAuthority({
    careerId: 'career-a', seasonId: 'league-season-1',
    world, schedule: archive, roster, match,
    personLinks: { readAcceptedPlayerPersonLink: () => null },
  });
  const participation = new SqliteOfficialParticipationStore(matchPath,
    authority);
  stores.push(participation);
  const game = authority.readGame('series-a:1')!;
  expect(() => participation.bindPregame({ ...game,
    gameId: 'series-a:1', clubId: 'club-a', side: 'HOME',
    playerId: 'player-a', personId: 'person-a',
    personLinkSourceId: 'unaccepted', rosterRevision: 0 }))
    .toThrow('lacks accepted fixture, roster, or person source');
});

const selectedParticipant = { gameId: 'series-a:1', clubId: 'club-a', playerId: 'player-a', personLinkSourceId: 'person-link-a' };
const openingParticipation = () => {
  const storesInput = setup();
  const sources = { ...storesInput, careerId: 'career-a', seasonId: 'league-season-1', schedule: storesInput.archive,
    personLinks: { readAcceptedPlayerPersonLink: (sourceId: string) => sourceId === 'person-link-a' || sourceId === 'person-link-other'
      ? { careerId: 'career-a', playerId: 'player-a', personId: 'person-a' } : null } };
  const participation = new SqliteOfficialParticipationStore(sources.matchPath, createDomesticParticipationAuthority(sources));
  stores.push(participation);
  const prepared = prepareDomesticOpeningMatch(sources, { careerId: sources.careerId, seasonId: sources.seasonId,
    gameId: selectedParticipant.gameId, ruleProfileId: NPB_2026_RULE_PROFILE.id, playId: 7 });
  return { ...sources, participation, prepared };
};

it('binds an explicitly selected opening participant using the accepted schedule, roster and Person identity', () => {
  const sources = openingParticipation();
  const result = bindDomesticPregameParticipantFromWorld(sources, selectedParticipant);
  expect(result).toEqual({ ...selectedParticipant, careerId: 'career-a', competitionEditionId: 'league-season-1', gameDay: 11,
    side: 'HOME', personId: 'person-a', rosterRevision: 0, fixtureEventId: sources.prepared.fixture.binding.fixtureEventId });
  expect(sources.participation.readPregameBinding(selectedParticipant.gameId, selectedParticipant.playerId)).toEqual(result);
  const advanced = applyPlay(sources.match, sources.prepared.match.matchState, 0, 500);
  expect(bindDomesticPregameParticipantFromWorld(sources, selectedParticipant)).toEqual(result);
  expect(sources.match.getMatch(selectedParticipant.gameId)?.durableRevision).toBe(advanced.receipt.durableRevision);
  expect(() => bindDomesticPregameParticipantFromWorld(sources, { ...selectedParticipant, personLinkSourceId: 'person-link-other' }))
    .toThrow('binding already differs');
});

it.each([
  { ...selectedParticipant, gameId: 'not-scheduled' },
  { ...selectedParticipant, clubId: 'not-in-game' },
  { ...selectedParticipant, clubId: 'club-b' },
  { ...selectedParticipant, personLinkSourceId: 'missing' },
  { ...selectedParticipant, personId: 'caller-person' },
  { ...selectedParticipant, rosterRevision: 100 },
])('refuses missing or caller-replaced original participant evidence: %j', request => {
  const sources = openingParticipation();
  expect(() => bindDomesticPregameParticipantFromWorld(sources, request as never))
    .toThrow(/domestic pregame/);
  expect(sources.participation.readPregameBinding(selectedParticipant.gameId, selectedParticipant.playerId)).toBeNull();
});

it('reopens after an interrupted participant write and retains the existing binding identity', () => {
  const sources = openingParticipation();
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(sources.matchPath); stores.push(db);
  db.exec("CREATE TRIGGER fail_binding BEFORE INSERT ON official_participant_bindings BEGIN SELECT RAISE(ABORT,'binding interrupted'); END");
  expect(() => bindDomesticPregameParticipantFromWorld(sources, selectedParticipant)).toThrow('binding interrupted');
  expect(sources.participation.readPregameBinding(selectedParticipant.gameId, selectedParticipant.playerId)).toBeNull();
  db.exec('DROP TRIGGER fail_binding');
  const participation = new SqliteOfficialParticipationStore(sources.matchPath, createDomesticParticipationAuthority(sources));
  stores.push(participation);
  const result = bindDomesticPregameParticipantFromWorld({ ...sources, participation }, selectedParticipant);
  expect(bindDomesticPregameParticipantFromWorld(sources, selectedParticipant)).toEqual(result);
  expect(db.prepare('SELECT count(*) AS n FROM official_participant_bindings').get()?.n).toBe(1);
  expect(db.prepare('SELECT count(*) AS n FROM official_participation_receipts').get()?.n).toBe(0);
});
