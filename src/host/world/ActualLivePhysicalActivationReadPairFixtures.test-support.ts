// Test-only local closure/readiness boundary, adapted from ActualLiveInningHandoff.
// Adjudication/end, field/execution scope and player kinematics are synthetic.
// Closure ownership, official archives, ten role effects, readiness and all
// physical traversal/savepoint guards stay real. This is not full-graph proof.
import { vi } from 'vitest';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import type { CanonicalMatchState } from '../../core/model/CanonicalMatchState';
import type { BetweenPlayWorldSetup } from '../../core/adjudication/BetweenPlayWorldReset';
import type { OfficialParticipantBinding } from './SqliteOfficialParticipationStore';
import type { AcceptedActualLivePlayClosure } from './ActualLivePlayClosureSource';
import type { AcceptedActualRoleWorkloadAssessment } from './ActualRoleWorkloadAssessment';
import type { AcceptedPlayerWorkloadBaseline } from './SqlitePlayerWorkloadRecoveryStore';
import type { ActorDb } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

type Counts = { historicalEntries: number; historicalCompleted: number; closureAuthentications: number };
type Hooks = { beforeHistorical?: (db: ActorDb, sourceId: string) => void; afterHistorical?: (db: ActorDb, sourceId: string) => void };
type Observation = { sourceId: string; counts: Counts; hooks: Hooks };
const observed = vi.hoisted(() => new WeakMap<ActorDb, Observation>());
const physical = vi.hoisted(() => ({ adjudication: null as any, end: null as any, baseField: null as any, players: [] as any[] }));

import { asRuleProfileId } from '../../core/model/RuleProfileRef';
import { createPlayAdjudicationLedger, recordCorrectRuleSnapshot } from '../../core/adjudication/PlayAdjudicationLedger';
import { SqliteOfficialStateStore } from '../SqliteOfficialStateStore';
import { openSqliteActualLivePlayClosureStore } from './SqliteActualLivePlayClosureStore';
import { openSqliteActualRoleWorkloadStore } from './SqliteActualRoleWorkloadStore';
import { readActualLivePhysicalActivation } from './ActualLivePhysicalActivation';
import { withBattedWorldPhysicalReadTraversal } from './SqliteBattedWorldFieldExecutionStore';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import * as readinessModule from './ActualLivePlayReadinessFromSqlite';
import * as closureModule from './ActualLivePlayClosureEvidenceFromSqlite';
import * as adjudicationModule from './ActualLiveAdjudicationFromSqlite';
import * as endModule from './SqliteActualFirstBasePlayEndStore';
import * as fieldModule from './SqliteBattedWorldFieldStore';
import * as executionModule from './SqliteBattedWorldFieldExecutionStore';
import * as kinematicsModule from './ActualPlayerKinematicsFromPrefix';

const { DatabaseSync: NativeDatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const positions = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'] as const;
const policy = { version: 'accepted-nine-inning-v1', minimumInnings: 9, tiesAllowed: false };
export const targetSourceId = 'closure', applicationId = 'apply', gameId = 'game';
export const probeTable = 'activation_read_pair_probe';
export type ActivationReadPairFixtureOptions = { retainedTargetFence?: boolean; settled?: boolean; finalGame?: boolean };

export function fixture(options: ActivationReadPairFixtureOptions = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'actual-activation-read-pair-')), path = join(directory, 'state.sqlite');
  const cleanups: (() => void)[] = [() => rmSync(directory, { recursive: true, force: true })];
  const restorations: (() => void)[] = [];
  const hooks: Hooks = {}, counters: Counts = { historicalEntries: 0, historicalCompleted: 0, closureAuthentications: 0 };
  const observation: Observation = { sourceId: targetSourceId, counts: counters, hooks };
  let selectedDb: ActorDb | undefined;
  const close = () => {
    delete hooks.beforeHistorical; delete hooks.afterHistorical;
    if (selectedDb) observed.delete(selectedDb);
    const errors: unknown[] = [];
    // Restore injected statement/exec failures before attempting owned cleanup.
    for (const stack of [restorations, cleanups]) while (stack.length) {
      try { stack.pop()!(); } catch (error) { errors.push(error); }
    }
    if (errors.length) throw new AggregateError(errors, 'activation-read-pair fixture cleanup failed', { cause: errors[0] });
  };
  const ownConnection = (db: DatabaseSync) => {
    cleanups.push(() => {
      const errors: unknown[] = [];
      try { if (db.isTransaction) db.exec('ROLLBACK'); } catch (error) { errors.push(error); }
      try { db.close(); } catch (error) { errors.push(error); }
      if (errors.length) throw new AggregateError(errors, 'activation-read-pair connection cleanup failed', { cause: errors[0] });
    });
    return db;
  };
  try {
    // The failed setup reached real kinematics through a circular import and
    // never reached its RED witness. Install the same five synthetic seams on
    // initialized namespaces; the synthetic inputs below remain unchanged.
    const originalAdjudication = adjudicationModule.actualLiveAdjudicationEvidenceFromSqlite;
    const originalEnd = endModule.actualFirstBaseClosedEvidenceFromSqlite;
    const originalField = fieldModule.battedWorldFieldEvidenceFromSqlite;
    const originalExecution = executionModule.battedWorldFieldExecutionEvidenceFromSqlite;
    // Factory construction only creates lazy owner methods; no domain rows are
    // read until those methods are invoked. Keep non-substituted methods real.
    const adjudicationSpy = vi.spyOn(adjudicationModule, 'actualLiveAdjudicationEvidenceFromSqlite');
    restorations.push(() => adjudicationSpy.mockRestore());
    adjudicationSpy.mockImplementation((...args) => {
      const owner = originalAdjudication(...args);
      return { ...owner, read: () => physical.adjudication,
        // This existing test boundary deliberately has source-ID-only execution
        // entries. The cast does not add fields or claim complete physical proof.
        readWithClosureInputs: () => ({ value: physical.adjudication, end: physical.end,
          prefix: { baseField: physical.baseField, fields: [], executions: [{ source: { sourceId: physical.end.source.executionSourceId } }] },
        } as unknown as ReturnType<typeof owner.readWithClosureInputs>),
      };
    });
    const endSpy = vi.spyOn(endModule, 'actualFirstBaseClosedEvidenceFromSqlite');
    restorations.push(() => endSpy.mockRestore());
    endSpy.mockImplementation((...args) => ({ ...originalEnd(...args), read: () => physical.end }));
    const fieldSpy = vi.spyOn(fieldModule, 'battedWorldFieldEvidenceFromSqlite');
    restorations.push(() => fieldSpy.mockRestore());
    fieldSpy.mockImplementation((...args) => ({ ...originalField(...args), read: () => physical.baseField, scope: () => [] }));
    const executionSpy = vi.spyOn(executionModule, 'battedWorldFieldExecutionEvidenceFromSqlite');
    restorations.push(() => executionSpy.mockRestore());
    executionSpy.mockImplementation((...args) => ({ ...originalExecution(...args), scope: () => [] }));
    const kinematicsSpy = vi.spyOn(kinematicsModule, 'actualPlayersKinematicsFromPrefix');
    restorations.push(() => kinematicsSpy.mockRestore());
    kinematicsSpy.mockImplementation(() => physical.players);
    // Install observers after the mutually importing real modules initialize.
    // This removes an unobserved instrumentation-undercount risk, not an
    // observed domain failure. Arguments and original results pass unchanged.
    const originalReadiness = readinessModule.actualLivePlayReadinessFromSqlite;
    const originalClosure = closureModule.actualLivePlayClosureEvidenceFromSqlite;
    const readinessSpy = vi.spyOn(readinessModule, 'actualLivePlayReadinessFromSqlite');
    restorations.push(() => readinessSpy.mockRestore());
    readinessSpy.mockImplementation((...args) => {
      const [db] = args, owner = originalReadiness(...args);
      return { ...owner, readHistorical: (...readArgs: Parameters<typeof owner.readHistorical>) => {
        const [sourceId] = readArgs, observation = observed.get(db);
        const selected = observation?.sourceId === sourceId ? observation : undefined;
        if (selected) { selected.counts.historicalEntries++; selected.hooks.beforeHistorical?.(db, sourceId); }
        const result = owner.readHistorical(...readArgs);
        if (selected) { selected.counts.historicalCompleted++; selected.hooks.afterHistorical?.(db, sourceId); }
        return result;
      } };
    });
    const closureSpy = vi.spyOn(closureModule, 'actualLivePlayClosureEvidenceFromSqlite');
    restorations.push(() => closureSpy.mockRestore());
    closureSpy.mockImplementation((...args) => {
      const [db] = args, owner = originalClosure(...args);
      return { ...owner, read: (...readArgs: Parameters<typeof owner.read>) => {
        const [sourceId] = readArgs, result = owner.read(...readArgs), observation = observed.get(db);
        if (result !== null && observation?.sourceId === sourceId) observation.counts.closureAuthentications++;
        return result;
      } };
    });
    const match: CanonicalMatchState = { ruleProfileId: asRuleProfileId('npb-2026'), inning: options.finalGame ? 9 : 1,
      half: 'top', outs: 2, balls: 0, strikes: 0, bases: { first: null, second: null, third: null },
      score: options.finalGame ? { away: 1, home: 2 } : { away: 0, home: 0 }, playId: 7 };
    const setup = (side: 'HOME' | 'AWAY'): BetweenPlayWorldSetup => ({
      baseCenters: { first: { x: 1, z: 1 }, second: { x: 0, z: 2 }, third: { x: -1, z: 1 } },
      defenders: positions.map((registeredPosition, i) => ({ playerId: `${side}-${i}`, registeredPosition, position: { x: i, z: i } })),
      activePreviousPlayControllerIds: [],
    });
    const nextSetup = setup('AWAY'), originalWorld = setup('HOME');
    const official = new SqliteOfficialStateStore(path); let officialOpen = true;
    const closeOfficial = () => { if (officialOpen) { official.close(); officialOpen = false; } };
    cleanups.push(closeOfficial);
    official.registerOfficialFixture({ gameId, venueId: 'venue', fixtureEventId: 'fixture', fixtureRevision: 0 });
    official.initializeMatch(gameId, match); closeOfficial();
    const db = ownConnection(new NativeDatabaseSync(path));
    db.exec(`PRAGMA busy_timeout=0;
      CREATE TABLE actual_live_adjudications(source_id TEXT);
      CREATE TABLE official_participant_bindings(game_id TEXT,player_id TEXT,binding_json TEXT,PRIMARY KEY(game_id,player_id));
      CREATE TABLE world_season_heads(career_id TEXT,season_id TEXT,schedule_json TEXT);
      CREATE TABLE world_player_person_links(source_id TEXT,career_id TEXT,player_id TEXT,person_id TEXT,roster_revision INTEGER,accepted_at_day INTEGER,source_json TEXT);
      CREATE TABLE activation_read_pair_probe(value INTEGER NOT NULL);
      INSERT INTO activation_read_pair_probe VALUES(0);`);
    db.prepare('INSERT INTO world_season_heads VALUES(?,?,?)').run('career', 'season', JSON.stringify({
      seasonId: 'season', games: [{ gameId, homeClubId: 'home', awayClubId: 'away' }],
    }));
    const bindings: OfficialParticipantBinding[] = [];
    for (const side of ['HOME', 'AWAY'] as const) for (let i = 0; i < 9; i++) {
      const playerId = `${side}-${i}`, personId = `person-${playerId}`, personLinkSourceId = `link-${playerId}`;
      const binding: OfficialParticipantBinding = { gameId, careerId: 'career', competitionEditionId: 'season', gameDay: 2,
        clubId: side === 'HOME' ? 'home' : 'away', side, playerId, personId, personLinkSourceId, rosterRevision: 0, fixtureEventId: 'fixture' };
      bindings.push(binding);
      db.prepare('INSERT INTO official_participant_bindings VALUES(?,?,?)').run(gameId, playerId, JSON.stringify(binding));
      const person = { sourceId: personLinkSourceId, careerId: 'career', playerId, personId, sourceRecordId: `intake-${playerId}`,
        sourceVersion: 'v1', acceptedRevision: 0, acceptedAtDay: 1, rosterRevision: 0 };
      db.prepare('INSERT INTO world_player_person_links VALUES(?,?,?,?,?,?,?)').run(personLinkSourceId, 'career', playerId, personId, 0, 1, json(person));
    }
    const originalBindings = [bindings.find(binding => binding.playerId === 'AWAY-0')!, ...bindings.filter(binding => binding.side === 'HOME')];
    const playEnd = { kind: 'play_end' as const, tick: 10, reason: 'live_action_complete' as const };
    const root = createPlayAdjudicationLedger({ playId: match.playId, ruleProfileId: match.ruleProfileId, playEnd });
    const ledger = recordCorrectRuleSnapshot(root, 0, { eventId: 'rule', tick: 10, snapshotId: 'rule', evidenceRevision: 1,
      ruling: { outsAfter: match.outs + 1, basesAfter: match.bases, scoredRunnerIds: [] } });
    const timeline = { playId: match.playId, startedAtTick: 0, lastEventTick: 10, nextSequence: 1,
      status: { kind: 'live_ball_complete' as const, count: { balls: 0, strikes: 0 }, contactTick: 1, playEndTick: 10,
        disposition: { kind: 'fair' as const, fairDeterminationTick: 2 } },
      events: [{ kind: 'LiveBallPlayEnded' as const, sequence: 0, tick: 10, payload: { playEnd } }] };
    physical.adjudication = { kind: 'official_ready', pendingReasons: [], source: { sourceId: 'adjudication', physicalEndSourceId: 'end' },
      ledger, originalMatch: match, timeline: { kind: 'projected', timeline },
      endReference: { owner: 'actual_first_base_play_ends', sourceId: 'end', sourceVersion: 'fixture', sourceHash: 'a'.repeat(64), snapshotHash: 'b'.repeat(64) },
      wholeHistoryReference: { hash: 'c'.repeat(64), convention: 'owned_scheduled_whole_history_manifest_v1' } };
    physical.end = { gameId, playId: match.playId, playEnd,
      source: { sourceId: 'end', baseFieldSourceId: 'field', executionSourceId: 'execution' }, futureWork: ['retained-original-work'] };
    physical.baseField = { source: { sourceId: 'field' },
      geometry: { geometry: { baseGeometry: { bases: Object.fromEntries(Object.entries(nextSetup.baseCenters)
        .map(([base, center]) => [base, { region: { center } }])) } } },
      response: { touch: { worldContact: { flight: { physicalPitch: { frame: { match, officialRevision: 0, activation: null,
        world: originalWorld, batterActor: { binding: originalBindings[0] }, bindings: originalBindings.slice(1) } } } } } } };
    physical.players = originalBindings.map(binding => ({ playerId: binding.playerId, personId: binding.personId,
      activeCommand: { sourceId: `command-${binding.playerId}` } }));
    const common = { sourceId: targetSourceId, sourceVersion: 'v1', adjudicationSourceId: 'adjudication', applicationId,
      closureTick: 11, controllerReset: 'rule_system_retire_original_play' as const, gamePolicy: policy };
    const source: AcceptedActualLivePlayClosure = options.finalGame ? { ...common, worldSetup: null, nextStartedAtTick: null,
      finalScoring: { sourceId: 'final-score', sourceVersion: 'accepted-aggregate-v1', sourceKind: 'official_scorer_aggregate',
        scorerId: 'accepted-scorer', gameId, seasonId: 'season', closureSourceId: targetSourceId, playId: match.playId,
        expectedDurableRevision: 0, recordedAtTick: 11,
        adjudicationReference: { sourceId: 'adjudication', snapshotHash: hash(physical.adjudication) },
        venueBinding: { gameId, venueId: 'venue', fixtureEventId: 'fixture', fixtureRevision: 0 },
        lineScore: { innings: Array.from({ length: match.inning }, (_, i) => ({ inning: i + 1, awayRuns: i ? 0 : match.score.away,
          homeRuns: i === match.inning - 1 ? null : i ? 0 : match.score.home })),
          totals: { away: { runs: match.score.away, hits: 7, errors: 2 }, home: { runs: match.score.home, hits: 8, errors: 1 } } } },
    } : { ...common, nextStartedAtTick: 12, worldSetup: nextSetup };
    const owner = openSqliteActualLivePlayClosureStore(path, { readAcceptedClosure: id => id === targetSourceId ? source : null });
    cleanups.push(() => owner.close());
    owner.submit(targetSourceId);
    const proposal = owner.read(targetSourceId)!.proposal;
    const baselines = new Map<string, AcceptedPlayerWorkloadBaseline>(), assessments = new Map<string, AcceptedActualRoleWorkloadAssessment>();
    for (const actor of proposal.actors) {
      const playerId = actor.binding.playerId;
      baselines.set(`baseline:${playerId}`, { sourceId: `baseline:${playerId}`, sourceVersion: 'synthetic-fixture',
        personLinkSourceId: actor.binding.personLinkSourceId, careerId: actor.binding.careerId, playerId, createdAtDay: 1,
        fatigue: 0.1, recoveryCapacity: 0.5,
        policy: { policyId: 'synthetic-fixture', version: 'v1', availableAtDay: 0, workloadFatiguePerUnit: 0.01,
          travelFatiguePerKm: 0.001, recoveryPerHour: 0.1 } });
      assessments.set(`assessment:${playerId}`, { sourceId: `assessment:${playerId}`, sourceVersion: 'synthetic-fixture',
        closureSourceId: targetSourceId, physicalEndReference: proposal.physicalEndReference, wholeHistoryReference: proposal.wholeHistoryReference,
        participantReference: { playerId, bindingHash: hash(actor.binding), personHash: hash(actor.person) }, effortUnits: 1,
        provenance: { assessmentSourceId: `accepted:${playerId}`, assessmentVersion: 'fixture',
          calibrationSourceId: 'synthetic-calibration', calibrationVersion: 'fixture' } });
    }
    const workload = openSqliteActualRoleWorkloadStore(path, { readLink: id => {
      const row = db.prepare('SELECT source_json FROM world_player_person_links WHERE source_id=?').get(id);
      return row ? JSON.parse(String(row.source_json)) : null;
    } }, { readAcceptedBaseline: id => baselines.get(id) ?? null, readAcceptedAssessment: id => assessments.get(id) ?? null });
    cleanups.push(() => workload.close());
    for (const id of baselines.keys()) workload.initializeBaseline(id);
    workload.acceptAssessments([...assessments.keys()]);
    const settlement = options.settled === false ? null : workload.settle(targetSourceId);
    if (settlement && (settlement.kind !== 'complete' || settlement.participants.length !== 10 || settlement.participants.some(p => !p.applied))) {
      throw new Error('activation-read-pair fixture requires ten completed real role effects');
    }
    if (options.retainedTargetFence) {
      db.exec('CREATE TABLE actual_live_play_fences(game_id TEXT,play_id INTEGER)');
      db.prepare('INSERT INTO actual_live_play_fences VALUES(?,?)').run(gameId, match.playId);
    }
    const peer = ownConnection(new NativeDatabaseSync(path)); peer.exec('PRAGMA busy_timeout=0');
    const resetCounts = (connection: ActorDb = db) => {
      if (selectedDb) observed.delete(selectedDb);
      selectedDb = connection; observed.set(connection, observation);
      counters.historicalEntries = 0; counters.historicalCompleted = 0; counters.closureAuthentications = 0;
    };
    const activate = (connection: ActorDb = db, requestedGame = gameId, requestedApplication = applicationId) =>
      readActualLivePhysicalActivation(connection, requestedGame, requestedApplication);
    // The legacy autocommit path remains the byte reference after the repair.
    // Pending/final fixtures have no legal activation reference.
    const reference = options.settled === false || options.finalGame ? null : activate();
    if (!options.finalGame && options.settled !== false && reference === null) throw new Error('activation-read-pair fixture reference is missing');
    resetCounts();
    return {
      db, path, peer, source, proposal, settlement, match, reference, owner, workload, hooks,
      targetSourceId, applicationId, gameId, probeTable, activate, resetCounts,
      counts: (): Counts => ({ ...counters }),
      roleEffects: () => Number(db.prepare("SELECT count(*) AS n FROM world_player_workload_activities WHERE json_extract(source_json,'$.kind')='MATCH'").get()!.n),
      syntheticBytes: () => json({ physical, source, baselines: [...baselines.values()], assessments: [...assessments.values()] }),
      // All user tables include closure/application/Match/policy, role/settlement,
      // workload policies/baselines/heads/activities, bindings and Person links.
      // Serialize raw row fields, preserving archived JSON strings verbatim.
      archiveBytes: () => json(db.prepare("SELECT name,sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()
        .map(table => ({ name: table.name, sql: table.sql,
          rows: db.prepare(`SELECT * FROM "${String(table.name).replaceAll('"', '""')}"`).all().map(row => json(row)).sort() }))),
      transaction<T>(body: () => T): T {
        db.exec('BEGIN');
        try { const result = body(); db.exec('COMMIT'); return result; }
        catch (error) {
          try { if (db.isTransaction) db.exec('ROLLBACK'); }
          catch (cleanupError) { throw new AggregateError([error, cleanupError], 'activation-read-pair transaction cleanup failed', { cause: error }); }
          throw error;
        }
      },
      owned: <T>(body: () => T): T => withBattedWorldPhysicalReadTraversal(db, body),
      restore: (cleanup: () => void) => { restorations.push(cleanup); },
      close,
    };
  } catch (error) {
    try { close(); }
    catch (cleanupError) { throw new AggregateError([error, cleanupError], 'activation-read-pair fixture setup failed', { cause: error }); }
    throw error;
  }
}

/** Preserve an assertion/sentinel as the cause if fixture cleanup also fails. */
export function withFixture<T>(value: ReturnType<typeof fixture>, body: (value: ReturnType<typeof fixture>) => T): T {
  let failed = false, failure: unknown, result!: T;
  try { result = body(value); } catch (error) { failed = true; failure = error; }
  try { value.close(); }
  catch (cleanupError) {
    if (failed) throw new AggregateError([failure, cleanupError], 'activation-read-pair body and cleanup failed', { cause: failure });
    throw cleanupError;
  }
  if (failed) throw failure;
  return result;
}
