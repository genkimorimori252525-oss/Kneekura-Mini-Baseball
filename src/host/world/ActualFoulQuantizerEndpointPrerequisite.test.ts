import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { quantizeEventTick } from '../../core/sim/ExactEventTime';
import { deriveQuantizerClosedGenerationBoundary } from '../../core/sim/liveAction/QuantizerClosedGenerationBoundary';
import { deriveBallWorldPlayerBaseContactHistory } from '../../core/sim/ball/BallWorldPlayerBaseContactHistory';
import { originalFoulRuleFixture } from './ActualFoulRuleFixtures.test-support';
import { actualPlayersKinematicsFromPrefix } from './ActualPlayerKinematicsFromPrefix';
import { ownedMotionKnownWorkFromSqlite } from './OwnedMotionKnownWorkFromSqlite';
import { battedWorldFieldEvidenceFromSqlite } from './SqliteBattedWorldFieldStore';
import { battedWorldFieldExecutionEvidenceFromSqlite, openSqliteBattedWorldFieldExecutionStore,
  type AcceptedBattedWorldFieldExecution, type DurableBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';
import { battedWorldFieldPhysicalPrefix } from './BattedWorldFieldPhysicalPrefix';
import { wholePlayPhysicalHistoryFromPrefix } from './WholePlayPhysicalHistoryFromPrefix';
import { ownedScheduledMotionArchiveJson, ownedScheduledMotionArchiveHash } from './OwnedScheduledMotionArchive';
import { actualLivePlayEvidenceFromSqlite } from './ActualLivePlayEvidenceFromSqlite';
import { actualFoulRuleConsumptionEvidenceFromSqlite } from './SqliteActualFoulRuleConsumptionStore';
import { actualSettledFoulStopProducerEvidenceFromSqlite } from './SqliteActualSettledFoulStopProducerStore';
import { actorJson as json, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { OwnedMotionV2Action } from './OwnedScheduledBattedWorldMotion';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
type Db = InstanceType<typeof DatabaseSync>;
type Fixture = ReturnType<typeof originalFoulRuleFixture>;
let directory: string, fixture: Fixture | undefined, executions: ReturnType<typeof openSqliteBattedWorldFieldExecutionStore>;
let consumed: ReturnType<Fixture['store']['accept']>, saved: DurableBattedWorldFieldExecution | undefined;
let originalCensus: string, baseFieldSourceId: string;
const sources = new Map<string, AcceptedBattedWorldFieldExecution>();
const current = () => { if (!fixture) throw new Error('original foul prerequisite fixture is closed'); return fixture; };
const journal = (db: Db) => db.prepare('SELECT * FROM actual_live_play_admissions ORDER BY sequence').all();
const logicalBytes = (db: Db) => json(db.prepare("SELECT name FROM main.sqlite_master WHERE type='table' ORDER BY name").all()
  .map(row => ({ table: row.name, rows: db.prepare('SELECT * FROM main."' + String(row.name).replaceAll('"', '""') + '"').all() })));
const prefix = (db: Db, through: string | null) => {
  const fields = battedWorldFieldEvidenceFromSqlite(db), baseField = fields.read(baseFieldSourceId);
  if (!baseField) throw new Error('original foul prerequisite field disappeared');
  return { baseField, fields: fields.scope(baseField, baseFieldSourceId),
    executions: battedWorldFieldExecutionEvidenceFromSqlite(db).scope(baseField, through) };
};
const endpoint = () => { if (!saved) throw new Error('genuine foul quantizer prerequisite has not passed'); return saved; };

beforeAll(() => {
  directory = mkdtempSync(join(tmpdir(), 'foul-quantizer-prerequisite-'));
  fixture = originalFoulRuleFixture(join(directory, 'original.sqlite'), 'ordinary_2');
  try {
    const f = current(); baseFieldSourceId = f.foul.last.source.sourceId;
    consumed = f.store.accept(f.source.sourceId);
    executions = f.f.track(openSqliteBattedWorldFieldExecutionStore(f.f.path, f.fields, {
      readAcceptedExecution: id => sources.get(id) ?? null,
    }));
    originalCensus = json(actualFoulRuleConsumptionEvidenceFromSqlite(f.f.db).census(f.query));
  } catch (error) { fixture?.f.close(); fixture = undefined; throw error; }
}, 180_000);
afterAll(() => { fixture?.f.close(); if (directory) rmSync(directory, { recursive: true, force: true }); });

it('admits a real retained foul quantizer endpoint with all ten original actor histories after rejecting a stale command', () => {
  const f = current(), beforePrefix = prefix(f.f.db, null), before = logicalBytes(f.f.db), admissions = journal(f.f.db);
  const ids = f.runtime.membership.participants.map(p => p.playerId), selves = actualPlayersKinematicsFromPrefix(ids, beforePrefix);
  const moment = beforePrefix.baseField.field.motion.world.moment;
  const ticksPerSecond = beforePrefix.baseField.response.touch.worldContact.flight.source.execution.ballFlightParameters.ticksPerSecond;
  const boundary = deriveQuantizerClosedGenerationBoundary({ originTick: moment.originTick, throughTick: moment.ball.tick, ticksPerSecond });
  expect(ids).toHaveLength(10); expect(new Set(ids).size).toBe(10);
  expect(f.runtime.membership.producers).toHaveLength(71);
  expect(boundary.lastIncludedElapsedSeconds).toBeGreaterThan(moment.elapsedSeconds);
  const action: OwnedMotionV2Action = { kind: 'owned_motion_v2',
    checkpoint: { kind: 'retained_quantizer_bucket_v1', throughTick: moment.ball.tick },
    knownWork: ownedMotionKnownWorkFromSqlite(f.f.db, f.physical.source.sourceId, ids),
    contributions: selves.map(self => ({ kind: 'retained', playerId: self.playerId, command: self.activeCommand })) };
  const source: AcceptedBattedWorldFieldExecution = { sourceId: 'original-foul-quantizer-endpoint', sourceVersion: 'contract-v1',
    baseFieldSourceId, previousExecutionSourceId: null, action };
  const stale = { ...source, sourceId: 'stale-original-foul-quantizer-command', action: { ...action,
    contributions: action.contributions.map((c, i) => i === 0 && c.kind === 'retained'
      ? { ...c, command: { ...c.command, sourceHash: 'changed-retained-command-hash' } } : c) } };
  sources.set(stale.sourceId, stale);
  expect(() => executions.accept(stale.sourceId)).toThrow(/retained command.*stale/);
  expect(logicalBytes(f.f.db)).toBe(before);
  sources.set(source.sourceId, source); saved = executions.accept(source.sourceId);
  if (saved.execution.kind !== 'owned_motion_v2') throw new Error('genuine owned foul endpoint was not executed');
  const e = saved.execution;
  expect(e.operation).toBeNull(); expect(e.composition.mode).toBe('retained');
  expect(e.adoption.status).toBe('checkpoint_reached'); expect(e.composition.quantizerBoundary).toEqual(boundary);
  expect(e.adoption.executedThrough).toEqual({ originTick: moment.originTick,
    elapsedSeconds: boundary.lastIncludedElapsedSeconds, tick: moment.ball.tick });
  expect(quantizeEventTick(moment.originTick, boundary.lastIncludedElapsedSeconds, ticksPerSecond)).toBe(moment.ball.tick);
  expect(boundary.firstExcludedElapsedSeconds).toBeGreaterThan(boundary.lastIncludedElapsedSeconds);
  expect(quantizeEventTick(moment.originTick, boundary.firstExcludedElapsedSeconds, ticksPerSecond)).toBeGreaterThan(moment.ball.tick);
  expect(e.field.motion.actors).toEqual(beforePrefix.baseField.field.motion.actors);
  expect(e.composition.contributors).toHaveLength(10);
  for (const contributor of e.composition.contributors) {
    expect(contributor.roleAuthorities).toHaveLength(5); expect(contributor.retainedRoles).toHaveLength(5);
    expect(contributor.motorSourceId).toBeNull();
  }
  const afterPrefix = prefix(f.f.db, saved.source.sourceId), physical = battedWorldFieldPhysicalPrefix(afterPrefix);
  const history = wholePlayPhysicalHistoryFromPrefix(afterPrefix), after = actualPlayersKinematicsFromPrefix(ids, afterPrefix);
  const expectedActors = ids.flatMap(id => ['body', 'glove', 'left_foot', 'right_foot', 'tag_hand'].map(role => json([id, role]))).sort();
  for (const segment of physical.segments) {
    expect(segment.actors.map(a => json([a.playerId, a.primitive.role])).sort()).toEqual(expectedActors);
  }
  expect(physical.segments.at(-1)).toMatchObject({ startElapsedSeconds: moment.elapsedSeconds,
    endElapsedSeconds: boundary.lastIncludedElapsedSeconds });
  expect(history.horizon.elapsedSeconds).toBe(boundary.lastIncludedElapsedSeconds); expect(history.end.kind).toBe('unestablished');
  for (const self of after) {
    const original = selves.find(s => s.playerId === self.playerId)!;
    expect(self.at.elapsedSeconds).toBe(boundary.lastIncludedElapsedSeconds);
    expect(self.roles).toHaveLength(5); expect(self.adoptions).toHaveLength(original.adoptions.length);
    expect(self.activeCommand).toMatchObject({ sourceId: original.activeCommand.sourceId, sourceHash: original.activeCommand.sourceHash,
      adoptionSourceId: original.activeCommand.adoptionSourceId, acceptedThroughTick: original.activeCommand.acceptedThroughTick });
    for (const base of ['home', 'first', 'second', 'third'] as const) {
      const bag = afterPrefix.baseField.geometry.geometry.baseGeometry.bases[base];
      const feet = deriveBallWorldPlayerBaseContactHistory({ segments: physical.segments, playerId: self.playerId,
        base: bag.region, baseSurfaceHeightMeters: bag.surfaceHeightMeters });
      expect(feet.endElapsedSeconds).toBe(boundary.lastIncludedElapsedSeconds);
    }
  }
  expect(journal(f.f.db).slice(0, -1)).toEqual(admissions);
  expect(journal(f.f.db).at(-1)).toMatchObject({ owner: 'batted_world_field_executions', source_id: source.sourceId,
    source_hash: hash(source), snapshot_hash: ownedScheduledMotionArchiveHash(saved) });
  expect(f.inputArchiveBytes()).toBe(f.beforePhysicalBytes);
  expect(JSON.stringify(f.f.official.getMatch('game-1'))).toBe(f.originalMatchBytes);
}, 240_000);

it('preserves historical foul stop and count ownership after the real endpoint while generation remains pending', () => {
  const f = current(), value = endpoint(), before = logicalBytes(f.f.db);
  expect(f.producer.read(f.production.source.sourceId)).toEqual(f.production);
  expect(f.producer.accept(f.production.source.sourceId)).toEqual(f.production);
  expect(f.store.read(consumed.source.sourceId)).toEqual(consumed); expect(f.store.accept(consumed.source.sourceId)).toEqual(consumed);
  const reader = actualFoulRuleConsumptionEvidenceFromSqlite(f.f.db);
  expect(json(reader.census(f.query))).toBe(originalCensus);
  const cut = { kind: 'field_execution' as const, baseFieldSourceId, executionSourceId: value.source.sourceId };
  const live = actualLivePlayEvidenceFromSqlite(f.f.db).derive({ sourceId: 'foul-endpoint-scope', sourceVersion: 'contract-v1',
    capability: 'actual_live_play_scope_v1', physicalPitchSourceId: f.physical.source.sourceId, cut }, true);
  expect(live.scope.producers).toHaveLength(70); expect(f.runtime.membership.producers).toHaveLength(71);
  const census = reader.census({ ...f.query, cut });
  expect(census.acceptedConsumptions).toEqual([consumed]); expect(census.generation).toBe('event_generation_coverage_pending');
  expect(census.physicalEnd).toBeNull(); expect(census.officialClosure).toBeNull(); expect(census.samePaResume).toBeNull();
  expect(ownedScheduledMotionArchiveJson(executions.accept(value.source.sourceId))).toBe(ownedScheduledMotionArchiveJson(value));
  expect(logicalBytes(f.f.db)).toBe(before);
}, 180_000);

it('reopens the real foul endpoint and original receipts offline after all construction handles close', () => {
  const f = current(), value = endpoint(), path = f.f.path, before = logicalBytes(f.f.db), production = f.production;
  const bytes = ownedScheduledMotionArchiveJson(value), query = f.query;
  f.f.close(); fixture = undefined; sources.clear();
  expect(() => f.f.db.prepare('SELECT 1').get()).toThrow();
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    expect(ownedScheduledMotionArchiveJson(battedWorldFieldExecutionEvidenceFromSqlite(db).read(value.source.sourceId)!)).toBe(bytes);
    expect(actualSettledFoulStopProducerEvidenceFromSqlite(db).read(production.source.sourceId)).toEqual(production);
    const reader = actualFoulRuleConsumptionEvidenceFromSqlite(db);
    expect(reader.read(consumed.source.sourceId)).toEqual(consumed); expect(json(reader.census(query))).toBe(originalCensus);
    expect(wholePlayPhysicalHistoryFromPrefix(prefix(db, value.source.sourceId)).horizon.elapsedSeconds)
      .toBe(value.execution.field.motion.world.moment.elapsedSeconds);
    expect(logicalBytes(db)).toBe(before);
  } finally { db.close(); }
}, 180_000);
