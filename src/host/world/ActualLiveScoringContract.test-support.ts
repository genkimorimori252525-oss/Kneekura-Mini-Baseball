import { expect } from 'vitest';
import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import * as entry from './SqliteActualLivePlayClosureStore';
import { actualDomesticFixture, type MockPhysicalBoundary } from './ActualLiveDomesticGameSettlement.test-support';
import { openSqliteActualLivePlayClosureStore } from './SqliteActualLivePlayClosureStore';
import type { AcceptedActualLivePlayClosure } from './ActualLivePlayClosureSource';
import type { OfficialFairBallScoringEvidence } from '../../core/adjudication/OfficialScoring';
import type { PersistedOfficialScoring } from '../SqliteOfficialScoringStore';
import { createPlayAdjudicationLedger, recordCorrectRuleSnapshot, recordOnFieldCall,
  getOfficialPlayClosure } from '../../core/adjudication/PlayAdjudicationLedger';
import { resolveBatBallContact } from '../../core/sim/contact/BatBallContact';
import { createCanonicalPlateAppearanceTimeline, recordBatBallContact, recordFairBattedBall,
  recordLiveBallPlayEnd } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

// Proposed API contract only. No production implementation is supplied here.
export type ScoringSource = Readonly<{
  sourceId: string; sourceVersion: string; gameId: string; scoringApplicationId: string;
  closureReference: Readonly<{ sourceId: string; proposalHash: string }>;
  evidence: OfficialFairBallScoringEvidence;
}>;
export type ScoringArchive = Readonly<{
  source: ScoringSource; status: 'QUEUED' | 'SCORED'; result: PersistedOfficialScoring | null;
}>;
export type ScoringAuthority = Readonly<{ readAcceptedScoringSource(sourceId: string): unknown }>;
export type ScoringStore = Readonly<{
  enqueue(sourceId: string): ScoringArchive; read(sourceId: string): ScoringArchive | null;
  resume(sourceId: string): PersistedOfficialScoring; submit(sourceId: string): PersistedOfficialScoring; close(): void;
}>;
export const scoringFactory = () => {
  const factory = (entry as unknown as Record<string, unknown>).openSqliteActualLiveScoringStore;
  expect(factory, 'separate downstream actual-live scorer admission/adapter').toBeTypeOf('function');
  return factory as (path: string, authority?: ScoringAuthority) => ScoringStore;
};
export const sourceTable = 'actual_live_scoring_sources';
export const rows = (db: Pick<DatabaseSync, 'prepare'>, table: string) =>
  db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all();

// Observe owned connections that execute SQL through exec or prepare. This is
// not constructor interception: a connection that never uses either method is
// outside this observer's evidence. No statement/result history is retained.
const trackConnections = (cleanup: (() => void)[]) => {
  const { DatabaseSync: Database } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const execDescriptor = Object.getOwnPropertyDescriptor(Database.prototype, 'exec')!;
  const prepareDescriptor = Object.getOwnPropertyDescriptor(Database.prototype, 'prepare')!;
  const opened = new Set<DatabaseSync>(); let requireClosed = false, boundaryObserved = false;
  const observe = (db: DatabaseSync) => {
    if (!opened.has(db) && requireClosed) {
      expect([...opened].filter(previous => previous.isOpen),
        'every previously observed owned SQL connection must be closed before reopen').toHaveLength(0);
      requireClosed = false; boundaryObserved = true;
    }
    opened.add(db);
  };
  const exec = function(this: DatabaseSync, ...args: Parameters<DatabaseSync['exec']>) {
    observe(this); return Reflect.apply(execDescriptor.value as DatabaseSync['exec'], this, args);
  };
  const prepare = function(this: DatabaseSync, ...args: Parameters<DatabaseSync['prepare']>) {
    observe(this); return Reflect.apply(prepareDescriptor.value as DatabaseSync['prepare'], this, args);
  };
  Object.defineProperty(Database.prototype, 'exec', { ...execDescriptor, value: exec });
  Object.defineProperty(Database.prototype, 'prepare', { ...prepareDescriptor, value: prepare });
  cleanup.push(() => {
    try { for (const db of [...opened].reverse()) if (db.isOpen) db.close(); }
    finally {
      Object.defineProperty(Database.prototype, 'exec', execDescriptor);
      Object.defineProperty(Database.prototype, 'prepare', prepareDescriptor);
    }
  });
  return { armClosedBoundary: () => { requireClosed = true; boundaryObserved = false; },
    assertClosedBoundary: () => expect(boundaryObserved).toBe(true) };
};

/** Physical and review projection readers are substituted by persisted fixture
 * input rows. Actual closure, Match, scoring, ten-role workload and readiness
 * owners are real. This is never original-chain physical/review acceptance. */
export const actualScoringFixture = (cleanup: (() => void)[], options: { out?: boolean; reviewed?: boolean; apply?: boolean; opening?: boolean } = {}) => {
  const connections = trackConnections(cleanup);
  const physical: MockPhysicalBoundary = { adjudication: null, end: null, baseField: null, players: [] };
  const f = actualDomesticFixture(physical, cleanup);
  const match = options.opening ? { ...f.before, inning: 1, outs: 0, score: { away: 0, home: 0 }, playId: 0 } : f.before;
  if (options.opening) {
    f.db.prepare('UPDATE matches SET state_json=? WHERE match_id=?').run(json(match), 'series:1');
    physical.adjudication.originalMatch = match; physical.end.playId = match.playId;
    physical.baseField.response.touch.worldContact.flight.physicalPitch.frame.match = match;
  }
  const frame = physical.baseField.response.touch.worldContact.flight.physicalPitch.frame;
  const playEnd = physical.end.playEnd;
  const contact = resolveBatBallContact(
    { tick: 1, position: { x: 0, y: 1, z: 0.06 }, velocity: { x: 0, y: -1.5, z: -35 }, spin: { x: 0, y: 0, z: 0 } },
    { pose: { grip: { x: -0.42, y: 1, z: 0 }, tip: { x: 0.42, y: 1, z: 0 } },
      linearVelocity: { x: 0, y: 0, z: 22 }, angularVelocity: { x: 0, y: 0, z: 0 } });
  if (!contact) throw new Error('synthetic scorer fixture requires contact');
  const timeline = recordLiveBallPlayEnd(recordFairBattedBall(recordBatBallContact(
    createCanonicalPlateAppearanceTimeline(match, 0), contact), 2), playEnd);
  const ruling = { outsAfter: options.out ? 3 : match.outs,
    basesAfter: { first: options.out ? null : 'AWAY-0', second: null, third: null }, scoredRunnerIds: [] };
  let ledger = createPlayAdjudicationLedger({ playId: match.playId, ruleProfileId: match.ruleProfileId, playEnd });
  ledger = recordCorrectRuleSnapshot(ledger, 0, { eventId: 'rule-event', tick: 10,
    snapshotId: 'rule', evidenceRevision: 1, ruling });
  ledger = recordOnFieldCall(ledger, ledger.revision, { eventId: 'call-event', tick: 11,
    callId: 'original-call', basisSnapshotId: 'rule', basisEvidenceRevision: 1, ruling });
  physical.adjudication = { ...physical.adjudication, gameId: 'series:1', playId: match.playId,
    physicalPitchSourceId: 'pitch', ledger, timeline: { kind: 'projected', timeline } };
  physical.end.source.sourceId = 'end'; physical.baseField.source = { sourceId: 'field' };
  physical.baseField.fixturePlayers = physical.players;
  const pin = { sessionSourceId: 'review', revision: 1, headSourceId: 'review-ready', headHash: 'd'.repeat(64) };
  const review = { source: { sourceId: 'review', adjudicationSourceId: 'adjudication',
    adjudicationSnapshotHash: hash(physical.adjudication) }, seed: { gameId: 'series:1', playId: match.playId, physicalPitchSourceId: 'pitch' },
    revision: pin.revision, headSourceId: pin.headSourceId, headHash: pin.headHash,
    kind: 'official_ready', pendingReasons: [], cursor: { tick: 11 }, ledger };
  f.db.exec('CREATE TABLE fixture_scoring_inputs(kind TEXT PRIMARY KEY,value_json TEXT NOT NULL)');
  for (const [kind, value] of Object.entries({ ...physical, review })) {
    f.db.prepare('INSERT INTO fixture_scoring_inputs VALUES(?,?)').run(kind, json(value));
  }
  const closureSource: AcceptedActualLivePlayClosure = options.out
    ? { ...f.source, closureTick: 12, finalScoring: { ...f.source.finalScoring!, recordedAtTick: 12,
      adjudicationReference: { sourceId: 'adjudication', snapshotHash: hash(physical.adjudication) } } }
    : { sourceId: 'closure', sourceVersion: 'synthetic-scorer-fixture', adjudicationSourceId: 'adjudication', applicationId: 'apply',
      closureTick: 12, nextStartedAtTick: 13, controllerReset: 'rule_system_retire_original_play', worldSetup: frame.world,
      gamePolicy: f.source.gamePolicy!, ...(options.reviewed ? { postPlayReviewReference: pin } : {}) };
  const closure = f.keep(openSqliteActualLivePlayClosureStore(f.path, {
    readAcceptedClosure: id => id === 'closure' ? closureSource : null }));
  closure.enqueue('closure');
  if (options.apply !== false) { closure.resume('closure'); f.settleRoles(); }
  const proposal = closure.read('closure')!.proposal;
  const effective = getOfficialPlayClosure(proposal.application.adjudication)!;
  const source: ScoringSource = { sourceId: 'scorer-source', sourceVersion: 'synthetic-scorer-v1', gameId: proposal.gameId,
    scoringApplicationId: 'score-actual', closureReference: { sourceId: 'closure', proposalHash: hash(proposal) },
    evidence: { schemaVersion: 1, sourceEventId: 'scorer-source', sourceKind: 'official_scorer_judgment', scorerId: 'fixture-scorer',
      ruleProfileId: match.ruleProfileId, playId: match.playId, closureId: 'closure', basisRulingId: effective.finalRuling.rulingId,
      recordedAtTick: 14, contactSequence: 0, fairSequence: 1, batterRunnerId: 'AWAY-0', judgment: { kind: 'base_hit' } } };
  const sources = new Map<string, unknown>([[source.sourceId, source]]);
  const authority: ScoringAuthority = { readAcceptedScoringSource: id => sources.get(id) ?? null };
  const preserved = () => Object.fromEntries(['fixture_scoring_inputs', 'actual_live_play_closures', 'applications', 'matches',
    'actual_role_workload_assessments', 'actual_role_workload_settlements', 'world_player_workload_activities', 'world_player_workload_heads']
    .map(table => [table, rows(f.db, table)]));
  const open = (given: ScoringAuthority | undefined = authority) => f.keep(scoringFactory()(f.path, given));
  return { ...f, closure, proposal, source, sources, authority, preserved, open, connections };
};
