import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { asRuleProfileId } from '../../core/model/RuleProfileRef';
import type { CanonicalMatchState } from '../../core/model/CanonicalMatchState';
import { createPlayAdjudicationLedger, recordCorrectRuleSnapshot } from '../../core/adjudication/PlayAdjudicationLedger';
import { state } from '../../core/world/club/ClubFixtures.test-support';
import { createClubWageScheduleLedger } from '../../core/world/club/ClubWageScheduleLedger';
import { createBaseScheduleSnapshot } from '../../core/world/competition/LeagueSchedule';
import { SqliteOfficialStateStore } from '../SqliteOfficialStateStore';
import { initializeDomesticSeason, prepareDomesticMatch } from './DomesticSeasonRuntime';
import { openSqliteDomesticScheduleStore } from './SqliteDomesticScheduleStore';
import { openSqliteWorldSettlementStore } from './SqliteWorldSettlementStore';
import { openSqliteMatchdayAttendanceStore } from './SqliteMatchdayAttendanceStore';
import { openSqliteOfficialWorldSettlementOutbox } from './SqliteOfficialWorldSettlementOutbox';
import { openSqliteActualLivePlayClosureStore } from './SqliteActualLivePlayClosureStore';
import { openSqliteActualRoleWorkloadStore } from './SqliteActualRoleWorkloadStore';
import type { OfficialParticipantBinding } from './SqliteOfficialParticipationStore';
import type { AcceptedActualLivePlayClosure } from './ActualLivePlayClosureSource';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const positions = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'] as const;
export type MockPhysicalBoundary = { adjudication: any; end: any; baseField: any; players: any[] };
/** Synthetic accepted input values are test fixtures, never production calibration. */
export function actualDomesticFixture(physical: MockPhysicalBoundary, cleanup: (() => void)[], phase: (name: string) => void = () => {}) {
  phase('fixture_start');
  const directory = mkdtempSync(join(tmpdir(), 'actual-domestic-settlement-')), path = join(directory, 'world.sqlite');
  cleanup.push(() => rmSync(directory, { recursive: true, force: true }));
  const handles: { close(): void }[] = [];
  const keep = <T extends { close(): void }>(store: T): T => { handles.push(store); return store; };
  const world = keep(openSqliteWorldSettlementStore(path));
  const archive = keep(openSqliteDomesticScheduleStore(path));
  const match = keep(new SqliteOfficialStateStore(path));
  const outbox = keep(openSqliteOfficialWorldSettlementOutbox(path));
  const baseSchedule = createBaseScheduleSnapshot({ seasonId: 'league-season-1', leagueId: 'league-a',
    calendarProfileVersion: 'fixture-v1', generatorVersion: 'fixture-v1', scheduleSeed: 'fixture', opponentMatrixVersion: 'fixture-v1',
    regularSeasonGamesPerClub: 2, memberClubIds: ['club-a', 'club-b'],
    opponentMatrix: [{ homeClubId: 'club-a', awayClubId: 'club-b', gameCount: 2 }], allowedDays: [11, 12, 13], reservedWindows: [],
    series: [{ seriesId: 'series', homeClubId: 'club-a', awayClubId: 'club-b', startsOnDay: 11, gameCount: 2 }] });
  initializeDomesticSeason({ world, archive, match }, { careerId: 'career-a', baseSchedule,
    eventProfile: { version: 'fixture-v1', allStarEnabled: false, marketWindows: [], rosterExpansionEnabled: false, awardSelectionPolicyVersion: 'fixture-v1' },
    standingsPolicy: { version: 'fixture-v1', tieCreditNumerator: 1, tieCreditDenominator: 2, runDifferentialCapPerGame: 10 },
    clubs: [state(), { ...state(), identity: { ...state().identity, clubId: 'club-b' }, live: { ...state().live, references: {
      ...state().live.references, rivalryStateRefs: [{ fromClubId: 'club-b', toClubId: 'club-a', stateRef: 'rivalry-b-a' }] } } }] });
  const before: CanonicalMatchState = { ruleProfileId: asRuleProfileId('npb-2026'), inning: 9, half: 'top', outs: 2,
    balls: 0, strikes: 0, bases: { first: null, second: null, third: null }, score: { away: 1, home: 2 }, playId: 7 };
  const fixture = prepareDomesticMatch({ world, archive, match }, { careerId: 'career-a', seasonId: 'league-season-1', gameId: 'series:1', matchState: before });
  phase('domestic_initialized');
  const db = keep(new DatabaseSync(path));
  db.exec(`CREATE TABLE actual_live_adjudications(source_id TEXT);
    CREATE TABLE official_participant_bindings(game_id TEXT,player_id TEXT,binding_json TEXT,PRIMARY KEY(game_id,player_id));
    CREATE TABLE world_player_person_links(source_id TEXT,career_id TEXT,player_id TEXT,person_id TEXT,roster_revision INTEGER,accepted_at_day INTEGER,source_json TEXT);`);
  const bindings: OfficialParticipantBinding[] = [];
  for (let index = 0; index < 10; index++) {
    const playerId = index ? `HOME-${index - 1}` : 'AWAY-0', personId = `person-${playerId}`, personLinkSourceId = `link-${playerId}`;
    const binding: OfficialParticipantBinding = { gameId: 'series:1', careerId: 'career-a', competitionEditionId: 'league-season-1', gameDay: 11,
      clubId: index ? 'club-a' : 'club-b', side: index ? 'HOME' : 'AWAY', playerId, personId, personLinkSourceId, rosterRevision: 0,
      fixtureEventId: fixture.fixture.binding.fixtureEventId };
    bindings.push(binding);
    db.prepare('INSERT INTO official_participant_bindings VALUES(?,?,?)').run('series:1', playerId, json(binding));
    const person = { sourceId: personLinkSourceId, careerId: 'career-a', playerId, personId, sourceRecordId: `intake-${playerId}`,
      sourceVersion: 'fixture-v1', acceptedRevision: 0, acceptedAtDay: 10, rosterRevision: 0 };
    db.prepare('INSERT INTO world_player_person_links VALUES(?,?,?,?,?,?,?)').run(personLinkSourceId, 'career-a', playerId, personId, 0, 10, json(person));
  }
  const setup = { baseCenters: { first: { x: 1, z: 1 }, second: { x: 0, z: 2 }, third: { x: -1, z: 1 } },
    defenders: positions.map((registeredPosition, i) => ({ playerId: `HOME-${i}`, registeredPosition, position: { x: i, z: i } })), activePreviousPlayControllerIds: [] };
  const playEnd = { kind: 'play_end' as const, tick: 10, reason: 'live_action_complete' as const };
  const root = createPlayAdjudicationLedger({ playId: before.playId, ruleProfileId: before.ruleProfileId, playEnd });
  const ledger = recordCorrectRuleSnapshot(root, 0, { eventId: 'rule', tick: 10, snapshotId: 'rule', evidenceRevision: 1,
    ruling: { outsAfter: 3, basesAfter: before.bases, scoredRunnerIds: [] } });
  const timeline = { playId: before.playId, startedAtTick: 0, lastEventTick: 10, nextSequence: 1,
    status: { kind: 'live_ball_complete', count: { balls: 0, strikes: 0 }, contactTick: 1, playEndTick: 10,
      disposition: { kind: 'fair', fairDeterminationTick: 2 } }, events: [{ kind: 'LiveBallPlayEnded', sequence: 0, tick: 10, payload: { playEnd } }] };
  physical.adjudication = { kind: 'official_ready', pendingReasons: [], source: { sourceId: 'adjudication', physicalEndSourceId: 'end' },
    ledger, originalMatch: before, timeline: { kind: 'projected', timeline },
    endReference: { owner: 'actual_first_base_play_ends', sourceId: 'end', sourceVersion: 'fixture', sourceHash: 'a'.repeat(64), snapshotHash: 'b'.repeat(64) },
    wholeHistoryReference: { hash: 'c'.repeat(64), convention: 'owned_scheduled_whole_history_manifest_v1' } };
  physical.end = { gameId: 'series:1', playId: before.playId, playEnd, source: { sourceId: 'end', baseFieldSourceId: 'field', executionSourceId: 'execution' }, futureWork: ['retained-original-work'] };
  physical.baseField = { source: { sourceId: 'field' }, geometry: { geometry: { baseGeometry: { bases: Object.fromEntries(Object.entries(setup.baseCenters).map(([base, center]) => [base, { region: { center } }])) } } },
    response: { touch: { worldContact: { flight: { physicalPitch: { frame: { match: before, officialRevision: 0, activation: null,
      world: setup, batterActor: { binding: bindings[0] }, bindings: bindings.slice(1) } } } } } } };
  physical.players = bindings.map(b => ({ playerId: b.playerId, personId: b.personId, activeCommand: { sourceId: `command-${b.playerId}` } }));
  const source: AcceptedActualLivePlayClosure = { sourceId: 'closure', sourceVersion: 'fixture-v1', adjudicationSourceId: 'adjudication', applicationId: 'apply', closureTick: 11,
    nextStartedAtTick: null, worldSetup: null, controllerReset: 'rule_system_retire_original_play', gamePolicy: { version: 'fixture-v1', minimumInnings: 9, tiesAllowed: false },
    finalScoring: { sourceId: 'final-score', sourceVersion: 'fixture-v1', sourceKind: 'official_scorer_aggregate', scorerId: 'fixture-scorer',
      gameId: 'series:1', seasonId: 'league-season-1', closureSourceId: 'closure', playId: 7, expectedDurableRevision: 0, recordedAtTick: 11,
      adjudicationReference: { sourceId: 'adjudication', snapshotHash: hash(physical.adjudication) }, venueBinding: fixture.fixture.binding,
      lineScore: { innings: Array.from({ length: 9 }, (_, i) => ({ inning: i + 1, awayRuns: i ? 0 : 1, homeRuns: i === 8 ? null : i ? 0 : 2 })),
        totals: { away: { runs: 1, hits: 7, errors: 2 }, home: { runs: 2, hits: 8, errors: 1 } } } } };
  const closure = keep(openSqliteActualLivePlayClosureStore(path, { readAcceptedClosure: id => id === 'closure' ? source : null }));
  const gate = { factId: 'gate', careerId: 'career-a', gameId: 'series:1', sourceEventId: 'turnstile', stadiumId: 'stadium-a',
    observedAtDay: 11, availableAtDay: 11, venueRevisionAtObservation: 0, count: 120 };
  const attendance = keep(openSqliteMatchdayAttendanceStore(path, { world, archive, match }, { readAcceptedGateCount: id => id === 'gate' ? gate : null }));
  const baselines = new Map<string, any>(), assessments = new Map<string, any>();
  const personLinks = { readLink: (id: string) => { const row = db.prepare('SELECT source_json FROM world_player_person_links WHERE source_id=?').get(id);
    return row ? JSON.parse(String(row.source_json)) : null; } };
  const workload = keep(openSqliteActualRoleWorkloadStore(path, personLinks, {
    readAcceptedBaseline: id => baselines.get(id) ?? null, readAcceptedAssessment: id => assessments.get(id) ?? null }));
  function settleRoles() {
    const p = closure.read('closure')!.proposal;
    for (const a of p.actors) {
      const playerId = a.binding.playerId;
      baselines.set(`baseline:${playerId}`, { sourceId: `baseline:${playerId}`, sourceVersion: 'synthetic-fixture', personLinkSourceId: a.binding.personLinkSourceId,
        careerId: 'career-a', playerId, createdAtDay: 10, fatigue: 0.1, recoveryCapacity: 0.5,
        policy: { policyId: 'synthetic-fixture', version: 'v1', availableAtDay: 0, workloadFatiguePerUnit: 0.01, travelFatiguePerKm: 0.001, recoveryPerHour: 0.1 } });
      assessments.set(`assessment:${playerId}`, { sourceId: `assessment:${playerId}`, sourceVersion: 'synthetic-fixture', closureSourceId: 'closure',
        physicalEndReference: p.physicalEndReference, wholeHistoryReference: p.wholeHistoryReference,
        participantReference: { playerId, bindingHash: hash(a.binding), personHash: hash(a.person) }, effortUnits: 1,
        provenance: { assessmentSourceId: `accepted:${playerId}`, assessmentVersion: 'fixture', calibrationSourceId: 'synthetic-calibration', calibrationVersion: 'fixture' } });
    }
    for (const id of baselines.keys()) workload.initializeBaseline(id);
    phase('baselines_initialized');
    workload.acceptAssessments([...assessments.keys()]);
    phase('assessments_accepted');
    const result = workload.settle('closure');
    phase('roles_settled');
    return result;
  }
  const request = { closureSourceId: 'closure', attendanceFactId: 'gate', expectedSeasonRevision: 0, expectedClubRevision: 0,
    wageSchedules: createClubWageScheduleLedger('career-a', 'club-a'), finalizedAtDay: 11,
    revenuePolicy: { version: 'fixture-v1', availableAtDay: 11, seasonId: 'league-season-1', currency: 'SIM', recognizedMinorUnitsPerAttendee: 5 } };
  const stores = { world, archive, match, outbox, attendance, closure };
  const close = () => { while (handles.length) handles.pop()!.close(); phase('handles_closed'); };
  cleanup.push(close);
  const complete = () => { closure.submit('closure'); phase('closure_applied'); settleRoles(); attendance.accept('gate', 'league-season-1'); phase('fixture_complete'); };
  const reopen = () => {
    close();
    const world = keep(openSqliteWorldSettlementStore(path)), archive = keep(openSqliteDomesticScheduleStore(path)), match = keep(new SqliteOfficialStateStore(path));
    const outbox = keep(openSqliteOfficialWorldSettlementOutbox(path)), closure = keep(openSqliteActualLivePlayClosureStore(path));
    const attendance = keep(openSqliteMatchdayAttendanceStore(path, { world, archive, match }));
    const db = keep(new DatabaseSync(path));
    return { world, archive, match, outbox, closure, attendance, db };
  };
  phase('fixture_owners_open');
  return { path, db, keep, world, archive, match, outbox, closure, attendance, workload, personLinks, request, source, gate, before, stores, settleRoles, complete, reopen };
}
