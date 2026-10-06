import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
import * as foulOwners from './SqliteActualFoulRuleConsumptionStore';
import { actualFoulRuleConsumptionEvidenceFromSqlite } from './SqliteActualFoulRuleConsumptionStore';
import { actualSettledFoulStopProducerEvidenceFromSqlite } from './SqliteActualSettledFoulStopProducerStore';
import { beginActualLivePlayWrite } from './ActualLivePlayFence';
import { installSyntheticObservation } from './ActualFieldObservationFixtures.test-support';
import { witnessSqliteWrite } from './SqliteWriteWitness.test-support';
import { originalFoulEndFixture, assertOriginalFoulEndPrerequisites, foulEndLogicalBytes, foulEndJournal,
  type OriginalFoulEndFixture } from './ActualFoulPlayEndFixtures.test-support';
import { requireFoulEndOpener, requireFoulClosedReader, requireFoulEndEncoding,
  type FoulEndSource, type FoulEndStore, type FoulEndedEvidence } from './ActualFoulPlayEndContracts.test-support';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { ownedScheduledWholeHistoryArchiveEncoding } from './OwnedScheduledMotionArchive';
import { resolveLivePlayRegistry } from '../../core/sim/liveAction/LivePlayRegistry';
import { expectedFoulEndProof } from './ActualFoulPlayEndExpectedProof.test-support';

const { DatabaseSync, constants } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
let directory: string, baselinePath: string, baselineHash: string, fixture: OriginalFoulEndFixture;
let path: string, db: InstanceType<typeof DatabaseSync>, stores: { close(): void }[] = [], sequence = 0;
let applicability: ReturnType<typeof assertOriginalFoulEndPrerequisites>;
let expectedProof: ReturnType<typeof expectedFoulEndProof>;
const sources = new Map<string, FoulEndSource>();
const fileHash = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex');
const track = <T extends { close(): void }>(store: T): T => { stores.push(store); return store; };
const source = (): FoulEndSource => ({ sourceId: 'original-foul-physical-end', sourceVersion: 'contract-v1',
  capability: 'actual_original_settled_foul_play_end_v1', ruleConsumptionSourceId: fixture.count.source.sourceId,
  baseFieldSourceId: fixture.foul.last.source.sourceId, executionSourceId: fixture.endpoint.source.sourceId });
const open = (): FoulEndStore => track(requireFoulEndOpener(foulOwners)(path, { readAcceptedEnd: id => sources.get(id) ?? null }));
const endRows = () => db.prepare('SELECT * FROM actual_foul_play_ends').all();
const sealRows = () => db.prepare('SELECT * FROM actual_live_play_fences').all();
const snapshot = () => foulEndLogicalBytes(db);

beforeAll(() => {
  directory = mkdtempSync(join(tmpdir(), 'foul-end-contract-')); baselinePath = join(directory, 'genuine-baseline.sqlite');
  fixture = originalFoulEndFixture(baselinePath);
  try { applicability = assertOriginalFoulEndPrerequisites(fixture);
    expectedProof = expectedFoulEndProof(fixture, applicability, source()); }
  finally { fixture.f.close(); }
  expect(() => fixture.f.db.prepare('SELECT 1').get()).toThrow();
  expect(!existsSync(baselinePath + '-wal') || statSync(baselinePath + '-wal').size === 0).toBe(true);
  baselineHash = fileHash(baselinePath);
}, 300_000);
beforeEach(() => {
  // These are byte copies of a fully closed, actually constructed original DB.
  // Each case reopens the real archives; no physical receipt is injected.
  expect(fileHash(baselinePath)).toBe(baselineHash);
  path = join(directory, 'case-' + ++sequence + '.sqlite'); copyFileSync(baselinePath, path);
  db = new DatabaseSync(path); stores = []; sources.clear(); sources.set(source().sourceId, source());
});
afterEach(() => { for (const store of stores.reverse()) store.close(); if (db?.isOpen) db.close(); });
afterAll(() => { if (baselineHash) expect(fileHash(baselinePath)).toBe(baselineHash);
  if (directory) rmSync(directory, { recursive: true, force: true }); });

const assertEnd = (end: FoulEndedEvidence) => {
  const x = fixture, request = source(), count = x.count, at = { originTick: x.moment.originTick,
    elapsedSeconds: x.boundary.lastIncludedElapsedSeconds, tick: x.moment.ball.tick };
  expect(end.source).toEqual(request); expect(end.history).toEqual([request]); expect(end.revision).toBe(1);
  expect(end).toMatchObject({ kind: 'ended', gameId: x.runtime.gameId, playId: x.runtime.playId,
    physicalPitchSourceId: x.physical.source.sourceId, firstPhysicalPitchSourceId: count.firstPhysicalPitchSourceId,
    scopeId: x.runtime.membership.scopeId, exactEnd: at, playEnd: { kind: 'play_end', reason: 'dead_ball', tick: at.tick } });
  expect(end.wholeHistory).toEqual(applicability.history); expect(end.wholeHistory.end.kind).toBe('unestablished');
  expect(end.wholeHistoryHashConvention).toBe('owned_scheduled_whole_history_manifest_v1');
  expect(end.wholeHistoryHash).toBe(ownedScheduledWholeHistoryArchiveEncoding(applicability.history, end.physicalPitchSourceId, end.gameId).hash);
  // This entire oracle was assembled from the genuine fixture before the end
  // namespace was consulted. Exact equality excludes nested terminal premises.
  expect(end.preCorePhysicalProof).toEqual(expectedProof.proof);
  expect(end.physicalProofHash).toBe(hash(end.preCorePhysicalProof));
  expect(end.preCorePhysicalProof.boundary).toEqual(x.boundary);
  expect(end.preCorePhysicalProof.physicalCut).toEqual({ baseFieldSourceId: request.baseFieldSourceId, executionSourceId: request.executionSourceId });
  expect(end.preCorePhysicalProof.runtimeReference).toEqual({ owner: 'actual_live_play_runtimes', sourceId: x.runtime.source.sourceId,
    sourceHash: hash(x.runtime.source), snapshotHash: hash(x.runtime) });
  expect(end.preCorePhysicalProof.policyReference).toEqual(x.production.basis.policyReference);
  expect(end.preCorePhysicalProof.stopReference).toEqual({ owner: 'actual_settled_foul_stop_productions', sourceId: x.production.source.sourceId,
    sourceHash: hash(x.production.source), snapshotHash: hash(x.production) });
  const countReference = { owner: 'actual_foul_rule_consumptions', sourceId: count.source.sourceId, sourceHash: hash(count.source), snapshotHash: hash(count) };
  expect(end.preCorePhysicalProof.consumptionReference).toEqual(countReference);
  const producerIds = x.runtime.membership.producers.map(p => p.producerId);
  expect(end.generation.producerIds).toEqual(producerIds);
  expect(end.preCorePhysicalProof.domainProofs.map(p => p.producerId)).toEqual(producerIds);
  expect(end.preCorePhysicalProof.domainProofs.map(p => ({ producerId: p.producerId, domain: p.domain, playerId: p.playerId })))
    .toEqual(x.runtime.membership.producers);
  for (const proof of end.preCorePhysicalProof.domainProofs) {
    expect(proof.status).toBe('physical_dependencies_proved'); expect(proof.through).toEqual(at);
  }
  expect(end.preCorePhysicalProof.bodyBaseHistoryHashes).toEqual(applicability.baseHistories);
  expect(end.preCorePhysicalProof.admissionJournalHash).toBe(hash(applicability.admissions));
  expect(end.generation.admissionJournalHash).toBe(hash(applicability.admissions));
  // No proposed PlayEnd, future persisted receipt, or self-referential seal may
  // be used as a premise of the physical proof from which Core is resolved.
  for (const field of ['playEnd', 'registry', 'physicalAcknowledgement', 'fence', 'terminalReceipt', 'terminalSnapshotHash'])
    expect(end.preCorePhysicalProof).not.toHaveProperty(field);
  const parent = count.successor.successorKey;
  const physicalKey = json(['actual_foul_disposition_obligation_v1', parent, 'physical_end']);
  const officialKey = json(['actual_foul_disposition_obligation_v1', parent, 'official_disposition']);
  const physicalScope = { kind: 'physical_live_episode', gameId: x.runtime.gameId, playId: x.runtime.playId,
    physicalPitchSourceId: x.physical.source.sourceId, runtimeSourceId: x.runtime.source.sourceId, scopeId: x.runtime.membership.scopeId };
  expect(end.dispositionObligations).toEqual({ version: 'actual_foul_disposition_obligations_v1', consumptionReference: countReference,
    original: count.successor, physical: { obligationKey: physicalKey, originalSuccessorKey: parent, scope: physicalScope,
      causedAt: count.consumption.availableAt, throughTick: count.consumption.availableAt.tick },
    official: { obligationKey: officialKey, originalSuccessorKey: parent,
      scope: { ...physicalScope, kind: 'post_play_official_disposition', firstPhysicalPitchSourceId: count.firstPhysicalPitchSourceId, consumptionReference: countReference },
      status: 'pending', consumer: null, pendingReason: 'official_continuation_unowned', causedAt: count.consumption.availableAt, eligibleAfterPhysicalEndAt: at } });
  const acknowledgementId = json(['actual_foul_physical_end_acknowledgement_v1', physicalKey, request.sourceId]);
  expect(end.physicalAcknowledgement).toEqual({ version: 'actual_foul_physical_end_acknowledgement_v1', acknowledgementId,
    originalSuccessorKey: parent, obligationKey: physicalKey, scope: physicalScope, status: 'consumed',
    consumer: { owner: 'actual_foul_play_ends', sourceId: request.sourceId, sourceVersion: request.sourceVersion, sourceHash: hash(request) },
    basisReceiptId: count.consumption.receiptId, physicalProofHash: end.physicalProofHash,
    causedAt: count.consumption.availableAt, consumedAt: at });
  expect(end.generation.consumed).toContainEqual({ cause: x.production.event.eventKey, consumer: count.source.sourceId });
  expect(end.generation.consumed).toContainEqual({ cause: x.production.successor.successorKey, consumer: count.source.sourceId });
  const stopDomain = end.preCorePhysicalProof.domainProofs.find(p => p.domain === 'settled_foul_stop')!;
  expect(stopDomain.consumed).toEqual([
    { cause: x.production.event.eventKey, consumer: count.source.sourceId },
    { cause: x.production.successor.successorKey, consumer: count.source.sourceId },
  ]);
  expect(end.generation.consumed).toContainEqual({ cause: physicalKey, consumer: acknowledgementId });
  expect(end.generation.consumed.some(c => c.cause === parent || c.cause === officialKey)).toBe(false);
  const ruleId = x.runtime.membership.producers.find(p => p.domain === 'physical_rule_consumption')!.producerId;
  expect(end.generation.physicalRuleProjection).toEqual({ producerId: ruleId, physicalObligationKey: physicalKey,
    acknowledgementId, remainingOfficialObligationKey: officialKey });
  expect(end.registry.registry.sources.map(s => s.sourceId)).toEqual(producerIds);
  expect(end.registry.registry.sources).toEqual(expectedProof.sources);
  expect(end.registry.resolution).toMatchObject({ kind: 'ended', reason: 'dead_ball', playEnd: end.playEnd });
  expect(end.registry.frontier.actors).toEqual(x.runtime.membership.participants.map(p => ({ actorId: p.playerId, kind: 'acting' })));
  expect(end.registry.frontier.eventQueueSettledThroughTick).toBe(at.tick);
  expect(end.registry.frontier.ruleWindows).toEqual([]);
  const rule = end.registry.registry.sources.find(s => s.sourceId === ruleId)!;
  expect(rule.queue?.settledThroughTick).toBe(at.tick); expect(rule.completion).toBeUndefined();
  // Restore only the unacknowledged physical child in the actual Core input.
  // Dead-ball status must not bypass that still-live rule obligation.
  const unacknowledged = resolveLivePlayRegistry({ ...end.registry.registry,
    sources: end.registry.registry.sources.map(s => s.sourceId !== ruleId ? s : { ...s,
      queue: { sourceId: s.sourceId, settledThroughTick: -1, nextPendingTick: null },
      ruleWindows: [{ workId: physicalKey, kind: 'live_rule_window' as const, windowId: physicalKey, openedAtTick: count.consumption.availableAt.tick }] }) },
    { tick: at.tick, terminal: 'dead_ball', actors: end.registry.frontier.actors });
  expect(unacknowledged.resolution.kind).toBe('continues');
  if (unacknowledged.resolution.kind === 'continues')
    expect(unacknowledged.resolution.blockers).toContainEqual({ kind: 'pending_rule_window', workId: physicalKey });
  expect(end.futureWork).toEqual(expectedProof.futureWork);
  expect(end.pending).toEqual({ officialDisposition: end.dispositionObligations.official,
    controllerRetirement: 'unowned', workloadSettlement: 'unowned', reset: 'unowned', samePaResume: 'unowned' });
  const seen = new Set<object>();
  const deeplyFrozen = (value: unknown): void => {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value); expect(Object.isFrozen(value)).toBe(true); for (const child of Object.values(value)) deeplyFrozen(child);
  };
  expect(Object.isFrozen(end)).toBe(true);
  for (const value of [end.source, end.history, end.preCorePhysicalProof, end.dispositionObligations,
    end.physicalAcknowledgement, end.registry, end.pending, end.futureWork]) deeplyFrozen(value);
};

it('owns one genuine original-foul dead-ball end with a physical child acknowledgement and the official child still pending', () => {
  // The real physical prerequisites above must all pass before this missing
  // production export can be classified as the selected RED.
  const ends = open(), before = foulEndLogicalBytes(db, ['actual_foul_play_ends', 'actual_live_play_fences']), journal = foulEndJournal(db);
  const end = ends.accept(source().sourceId); assertEnd(end);
  expect(endRows()).toHaveLength(1); expect(sealRows()).toEqual([{ game_id: end.gameId, play_id: end.playId,
    physical_pitch_source_id: end.physicalPitchSourceId, closure_source_id: end.source.sourceId }]);
  const encoded = requireFoulEndEncoding(foulOwners)(end);
  expect(endRows()[0]).toMatchObject({ source_json: json(end.source), source_hash: hash(end.source), snapshot_json: encoded.json, snapshot_hash: encoded.hash });
  expect(foulEndLogicalBytes(db, ['actual_foul_play_ends', 'actual_live_play_fences'])).toBe(before);
  expect(foulEndJournal(db)).toEqual(journal);
  expect(actualFoulRuleConsumptionEvidenceFromSqlite(db).read(fixture.count.source.sourceId)).toEqual(fixture.count);
  const bytes = snapshot();
  expect(() => { (end.dispositionObligations.official as { status: string }).status = 'consumed'; }).toThrow();
  expect(() => { (end.dispositionObligations.physical.scope as { playId: number }).playId += 1; }).toThrow();
  expect(() => { (end.preCorePhysicalProof.domainProofs[0].premises.runtimeReference as { sourceHash: string }).sourceHash = 'changed'; }).toThrow();
  expect(ends.read(source().sourceId)).toEqual(end); expect(ends.accept(source().sourceId)).toEqual(end); expect(snapshot()).toBe(bytes);
}, 240_000);

it('derives the physical acknowledgement before Core without persisting a proposed receipt or seal', () => {
  const ends = open(), before = snapshot(), proposal = ends.evaluate(source().sourceId);
  expect(proposal.kind).toBe('ended'); if (proposal.kind !== 'ended') throw new Error('genuine foul proposal unexpectedly pending');
  assertEnd(proposal); expect(endRows()).toEqual([]); expect(sealRows()).toEqual([]);
  expect(ends.read(source().sourceId)).toBeNull(); expect(snapshot()).toBe(before);
  expect(ends.accept(source().sourceId)).toEqual(proposal);
}, 240_000);

it.each(['terminal', 'dead', 'count', 'timeline', 'producerIds', 'watermark', 'actorDisposition', 'occurredAt'] as const)
  ('rejects caller-supplied %s before any terminal receipt or seal', field => {
    const ends = open(), original = source(), before = snapshot(); sources.set(original.sourceId, { ...original, [field]: true });
    expect(() => ends.accept(original.sourceId)).toThrow(/invalid.*Source|accepted.*Source/i); expect(snapshot()).toBe(before);
    sources.set(original.sourceId, original); expect(ends.accept(original.sourceId).kind).toBe('ended');
  }, 240_000);

it('rejects a changed same-ID Source while preserving the original terminal and all admissions', () => {
  const ends = open(), end = ends.accept(source().sourceId), before = snapshot();
  sources.set(end.source.sourceId, { ...end.source, sourceVersion: 'changed-version' });
  expect(() => ends.accept(end.source.sourceId)).toThrow(/frozen differently|Source.*differ/); expect(snapshot()).toBe(before);
  sources.set(end.source.sourceId, end.source); expect(ends.accept(end.source.sourceId)).toEqual(end); expect(snapshot()).toBe(before);
}, 240_000);

it('rolls back the complete terminal write when its receipt INSERT changes unrelated Match state', () => {
  const ends = open(), revision = db.prepare("SELECT durable_revision FROM matches WHERE match_id='game-1'").get()!.durable_revision;
  db.exec("CREATE TRIGGER foul_end_match_mutation AFTER INSERT ON actual_foul_play_ends BEGIN UPDATE matches SET durable_revision=durable_revision+1 WHERE match_id='game-1'; END");
  const before = snapshot(), witness = witnessSqliteWrite(/INSERT INTO actual_foul_play_ends\b/, connection =>
    connection.prepare("SELECT durable_revision FROM matches WHERE match_id='game-1'").get()!.durable_revision !== revision);
  try { expect(() => ends.accept(source().sourceId)).toThrow(); expect(witness.wasReached()).toBe(true);
    expect(snapshot()).toBe(before); expect(endRows()).toEqual([]); expect(sealRows()).toEqual([]); }
  finally { witness.close(); db.exec('DROP TRIGGER foul_end_match_mutation'); }
  expect(ends.accept(source().sourceId).kind).toBe('ended');
}, 300_000);

it('rolls back both real INSERTs when the seal trigger adds a foreign-indexed terminal alias', () => {
  const ends = open();
  db.exec(`CREATE TRIGGER foul_end_hidden_alias AFTER INSERT ON actual_live_play_fences BEGIN
    INSERT INTO actual_foul_play_ends SELECT 'hidden-foul-end','foreign',99,'foreign-pitch',
      json_set(source_json,'$.sourceId','hidden-foul-end'),source_hash,
      json_set(snapshot_json,'$.source.sourceId','hidden-foul-end'),snapshot_hash
      FROM actual_foul_play_ends WHERE source_id='original-foul-physical-end'; END`);
  const before = snapshot(), witness = witnessSqliteWrite(/INSERT INTO actual_live_play_fences\b/, connection =>
    connection.prepare("SELECT count(*) AS n FROM actual_foul_play_ends WHERE source_id='hidden-foul-end'").get()!.n === 1);
  try { expect(() => ends.accept(source().sourceId)).toThrow(/ownership|terminal|claim|closure/);
    expect(witness.wasReached()).toBe(true); expect(snapshot()).toBe(before); expect(endRows()).toEqual([]); expect(sealRows()).toEqual([]); }
  finally { witness.close(); db.exec('DROP TRIGGER foul_end_hidden_alias'); }
  expect(ends.accept(source().sourceId).kind).toBe('ended');
}, 300_000);

it('keeps a genuinely admitted observation explicitly pending without retiring the original actors or writing an end', () => {
  const ends = open(), x = fixture;
  const observed = installSyntheticObservation({ f: { path, track }, baseField: x.foul.last }, x.runtime.membership.participants.find(p => p.role === 'defender')!.playerId,
    x.endpoint.source.sourceId);
  const value = observed.observations.accept(observed.observationSource.sourceId);
  expect(foulEndJournal(db).at(-1)).toMatchObject({ owner: 'actual_field_observations', source_id: value.source.sourceId });
  const before = snapshot(), result = ends.evaluate(source().sourceId);
  expect(result).toMatchObject({ kind: 'pending', playEnd: null });
  if (result.kind !== 'pending') throw new Error('unsupported actual observation was silently consumed');
  expect(result.pendingReasons).toContain('unsupported_live_owner:actual_field_observations');
  expect(() => ends.accept(source().sourceId)).toThrow(/pending/); expect(snapshot()).toBe(before);
  expect(endRows()).toEqual([]); expect(sealRows()).toEqual([]);
}, 240_000);

it('rejects a missing seal on historical read while the raw foul terminal still blocks new live work', () => {
  const ends = open(), end = ends.accept(source().sourceId); db.exec('DELETE FROM actual_live_play_fences'); const before = snapshot();
  expect(() => ends.read(end.source.sourceId)).toThrow(/fence|seal|archive/);
  db.exec('BEGIN IMMEDIATE');
  try { expect(() => beginActualLivePlayWrite(db, { gameId: end.gameId, playId: end.playId, physicalPitchSourceId: end.physicalPitchSourceId },
    { owner: 'batted_world_field_executions', sourceId: 'late-after-foul-end' })).toThrow(/terminal|sealed|closure/); }
  finally { db.exec('ROLLBACK'); }
  expect(snapshot()).toBe(before);
}, 240_000);

it('reopens the same physical end offline with its immutable mixed successor and caller read transaction intact', () => {
  const ends = open(), end = ends.accept(source().sourceId), before = snapshot();
  for (const store of stores.reverse()) store.close(); stores = []; db.close(); sources.clear();
  db = new DatabaseSync(path); const reopened = track(requireFoulEndOpener(foulOwners)(path));
  expect(reopened.read(end.source.sourceId)).toEqual(end); expect(reopened.accept(end.source.sourceId)).toEqual(end);
  const reader = requireFoulClosedReader(foulOwners)(db);
  db.setAuthorizer(code => code === constants.SQLITE_DELETE ? constants.SQLITE_DENY : constants.SQLITE_OK);
  db.exec('BEGIN; PRAGMA query_only=ON');
  try { expect(reader.read(end.source.sourceId)).toEqual(end); expect(db.isTransaction).toBe(true);
    expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(1);
    expect(() => db.prepare('DELETE FROM actual_foul_play_ends')).toThrow(/authorized/i);
    expect(actualSettledFoulStopProducerEvidenceFromSqlite(db).read(fixture.production.source.sourceId)).toEqual(fixture.production);
    expect(actualFoulRuleConsumptionEvidenceFromSqlite(db).read(fixture.count.source.sourceId)).toEqual(fixture.count);
    expect(json(actualFoulRuleConsumptionEvidenceFromSqlite(db).census(fixture.query))).toBe(fixture.historicalCensus);
    expect(snapshot()).toBe(before);
  } finally { db.exec('ROLLBACK; PRAGMA query_only=OFF'); db.setAuthorizer(null); }
}, 300_000);
