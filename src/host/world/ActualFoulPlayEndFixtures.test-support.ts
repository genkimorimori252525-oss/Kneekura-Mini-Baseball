import { expect } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { originalSettledFoulRuntimeFixture } from './ActualSettledFoulStopFixtures.test-support';
import { openSqliteActualSettledFoulStopProducerStore } from './SqliteActualSettledFoulStopProducerStore';
import { actualFoulRuleConsumptionEvidenceFromSqlite, openSqliteActualFoulRuleConsumptionStore } from './SqliteActualFoulRuleConsumptionStore';
import { actualLiveRuntimeEvidenceFromSqlite } from './SqliteActualLivePlayRuntimeStore';
import { actualLiveAdmissionOwners } from './ActualLivePlayFence';
import { actualPlayersKinematicsFromPrefix } from './ActualPlayerKinematicsFromPrefix';
import { ownedMotionKnownWorkFromSqlite } from './OwnedMotionKnownWorkFromSqlite';
import { battedWorldFieldEvidenceFromSqlite } from './SqliteBattedWorldFieldStore';
import { battedWorldFieldExecutionEvidenceFromSqlite, openSqliteBattedWorldFieldExecutionStore,
  type AcceptedBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';
import { battedWorldPhysicalPrefixAndWholePlayHistory } from './WholePlayPhysicalHistoryFromPrefix';
import { deriveBallWorldPlayerBaseContactHistory } from '../../core/sim/ball/BallWorldPlayerBaseContactHistory';
import { deriveQuantizerClosedGenerationBoundary } from '../../core/sim/liveAction/QuantizerClosedGenerationBoundary';
import { quantizeEventTick } from '../../core/sim/ExactEventTime';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { ownedScheduledMotionArchiveHash } from './OwnedScheduledMotionArchive';
import type { FoulOwnerCensusEntry } from './ActualFoulPlayEndContracts.test-support';

export const foulEndLogicalBytes = (db: DatabaseSync, excluded: readonly string[] = []) =>
  json(db.prepare("SELECT name FROM main.sqlite_master WHERE type='table' ORDER BY name").all()
    .filter(row => !excluded.includes(String(row.name)))
    .map(row => ({ table: row.name, rows: db.prepare('SELECT * FROM main."' + String(row.name).replaceAll('"', '""') + '"').all() })));
export const foulEndJournal = (db: DatabaseSync) => db.prepare('SELECT * FROM actual_live_play_admissions ORDER BY sequence').all();
const rootOwners = ['physical_plate_appearance_actors', 'physical_pitch_progress_actions', 'batted_ball_flights',
  'batted_world_contacts', 'batted_first_fielder_touches', 'batted_contact_responses'] as const;
const rootBytes = (db: DatabaseSync) => rootOwners.map(owner => ({ owner,
  rows: db.prepare("SELECT 1 FROM main.sqlite_master WHERE type='table' AND name=?").get(owner)
    ? db.prepare('SELECT * FROM main.' + owner + ' ORDER BY source_id').all() : [] }));
/** Test-only inventory of this genuinely constructed single-play database.
 * No scope filter or payload decoding can hide a rival row from this oracle.
 * Global schema presence is excluded from this original-scope proof projection. */
const ownerCensus = (db: DatabaseSync): readonly FoulOwnerCensusEntry[] => {
  const headOwners: Readonly<Record<string, readonly string[]>> = {
    physical_pitch_progress_actions: ['physical_pitch_progress_heads'], batted_ball_flights: ['batted_ball_flight_heads'],
    batted_world_contacts: ['batted_world_contact_heads'], batted_post_response_flights: ['batted_post_response_flight_heads'],
    batted_world_continuations: ['batted_world_continuation_heads'], batted_world_motions: ['batted_world_motion_heads'],
    batted_world_executions: ['batted_world_execution_heads'], batted_world_field_actions: ['batted_world_field_heads'],
    batted_world_field_executions: ['batted_world_field_execution_heads'], actual_field_observations: ['actual_field_observation_heads'],
    actual_defensive_decisions: ['actual_defensive_decision_heads'], actual_locomotion_receipts: ['actual_locomotion_heads'],
    actual_call_communications: ['actual_call_communication_heads'],
  };
  const installed = (owner: string) => !!db.prepare("SELECT 1 FROM main.sqlite_master WHERE type='table' AND name=?").get(owner);
  return [...actualLiveAdmissionOwners, 'actual_communication_models'].map(owner => ({ owner,
    references: installed(owner) ? db.prepare('SELECT source_id,source_hash,snapshot_hash FROM main.' + owner + ' ORDER BY source_id').all()
      .map(row => ({ owner, sourceId: String(row.source_id), sourceHash: String(row.source_hash), snapshotHash: String(row.snapshot_hash) })) : [],
    heads: (headOwners[owner] ?? []).map(head => ({ owner: head,
      rows: installed(head) ? db.prepare('SELECT * FROM main.' + head).all().sort((a, b) => json(a).localeCompare(json(b))) : [] })),
  }));
};

/** Genuine original owners only. This creates a fresh end-policy enrollment
 * before work; it never upgrades the earlier count-policy fixture or writes a
 * physical/end snapshot directly. The proposed end owner is not called here. */
export const originalFoulEndFixture = (path: string, originalAttempt: 'ordinary_swing' | 'bunt' = 'ordinary_swing') => {
  const x = originalSettledFoulRuntimeFixture(path, {
    pitchPhysics: { velocity: { x: 3, y: 0, z: -30 } },
    originalContact: { precedingTakenPitches: 2, attempt: originalAttempt },
  });
  try {
    const originalRootBytes = json(rootBytes(x.f.db));
    const runtimeSource = { sourceId: 'foul-end-runtime', sourceVersion: 'contract-v1',
      capability: 'causal_original_settled_foul_end_runtime_v1', physicalPitchSourceId: x.physical.source.sourceId };
    x.runtimeSources.set(runtimeSource.sourceId, runtimeSource as never);
    const runtime = x.runtimes.accept(runtimeSource.sourceId), foul = x.advanceToFoul(), policy = x.acceptPolicy(foul.first);
    const stopSource = { sourceId: 'foul-end-stop', sourceVersion: 'contract-v1',
      capability: 'actual_original_settled_foul_stop_producer_v1' as const, physicalPitchSourceId: x.physical.source.sourceId,
      runtimeSourceId: runtime.source.sourceId, policySourceId: policy.policySource.sourceId,
      baseFieldSourceId: foul.last.source.sourceId, executionSourceId: null };
    const producer = x.f.track(openSqliteActualSettledFoulStopProducerStore(path, {
      readAcceptedProduction: id => id === stopSource.sourceId ? stopSource : null,
    }));
    const production = producer.accept(stopSource.sourceId);
    const countSource = { sourceId: 'foul-end-count', sourceVersion: 'contract-v1',
      capability: 'actual_original_settled_foul_rule_consumption_v1' as const,
      runtimeSourceId: runtime.source.sourceId, stopProductionSourceId: production.source.sourceId };
    const counts = x.f.track(openSqliteActualFoulRuleConsumptionStore(path, {
      readAcceptedConsumption: id => id === countSource.sourceId ? countSource : null,
    }));
    const count = counts.accept(countSource.sourceId), baseFieldSourceId = foul.last.source.sourceId;
    const query = { version: 'actual_foul_rule_consumers_v1' as const, runtimeSourceId: runtime.source.sourceId,
      cut: { kind: 'field_execution' as const, baseFieldSourceId, executionSourceId: null } };
    const historicalCensus = json(actualFoulRuleConsumptionEvidenceFromSqlite(x.f.db).census(query));
    const executionSources = new Map<string, AcceptedBattedWorldFieldExecution>();
    const executions = x.f.track(openSqliteBattedWorldFieldExecutionStore(path, x.fields, {
      readAcceptedExecution: id => executionSources.get(id) ?? null,
    }));
    const prefix = (db: DatabaseSync, executionSourceId: string | null) => {
      const fields = battedWorldFieldEvidenceFromSqlite(db), baseField = fields.read(baseFieldSourceId);
      if (!baseField) throw new Error('original foul end prerequisite field is missing');
      return { baseField, fields: fields.scope(baseField, baseFieldSourceId),
        executions: battedWorldFieldExecutionEvidenceFromSqlite(db).scope(baseField, executionSourceId) };
    };
    const ids = runtime.membership.participants.map(p => p.playerId), beforePrefix = prefix(x.f.db, null);
    const selves = actualPlayersKinematicsFromPrefix(ids, beforePrefix), moment = foul.last.field.motion.world.moment;
    const ticksPerSecond = foul.last.response.touch.worldContact.flight.source.execution.ballFlightParameters.ticksPerSecond;
    const boundary = deriveQuantizerClosedGenerationBoundary({ originTick: moment.originTick, throughTick: moment.ball.tick, ticksPerSecond });
    const executionSource: AcceptedBattedWorldFieldExecution = { sourceId: 'foul-end-quantizer-endpoint', sourceVersion: 'contract-v1',
      baseFieldSourceId, previousExecutionSourceId: null, action: { kind: 'owned_motion_v2',
        checkpoint: { kind: 'retained_quantizer_bucket_v1', throughTick: moment.ball.tick },
        knownWork: ownedMotionKnownWorkFromSqlite(x.f.db, x.physical.source.sourceId, ids),
        contributions: selves.map(self => ({ kind: 'retained', playerId: self.playerId, command: self.activeCommand })) } };
    executionSources.set(executionSource.sourceId, executionSource);
    const endpoint = executions.accept(executionSource.sourceId);
    return { ...x, originalAttempt, originalRootBytes, runtimeSource, runtime, foul, policy, producer, production, counts, count, query, historicalCensus,
      prefix, ids, selves, moment, ticksPerSecond, boundary, executionSource, executionSources, executions, endpoint };
  } catch (error) { x.f.close(); throw error; }
};
export type OriginalFoulEndFixture = ReturnType<typeof originalFoulEndFixture>;

/** Fixture applicability, not an end certificate. In this one freshly built DB
 * every governed row is inspected without scope filtering. Other games/opaque
 * rows are tested by the later production census contracts, not accepted here. */
export const assertOriginalFoulEndPrerequisites = (x: OriginalFoulEndFixture, db = x.f.db) => {
  const before = foulEndLogicalBytes(db), runtime = actualLiveRuntimeEvidenceFromSqlite(db).read(x.runtime.source.sourceId);
  expect(runtime).toEqual(x.runtime); expect(runtime!.source.capability).toBe('causal_original_settled_foul_end_runtime_v1');
  expect(runtime!.membership.liveRulePolicy).toBe('untouched_settled_foul_end_v1');
  expect(runtime!.membership.producers).toHaveLength(71); expect(new Set(runtime!.membership.producers.map(p => p.producerId)).size).toBe(71);
  expect(x.physical.frame.match.ruleProfileId).toBe('npb-2026');
  expect(x.policy.policySource.rulePolicy).toEqual({ version: 'untouched_settled_foul_dead_v1', ruleProfileId: 'npb-2026', rulesRevision: '2026' });
  expect(x.count.disposition.kind).toBe(x.originalAttempt === 'bunt' ? 'terminal_strikeout' : 'continue_same_pa');
  expect(x.count.countEvidence.basis.evidence.interpretation.kind).toBe('dead_ball');
  expect(x.count.successor).toMatchObject({ status: 'pending', pendingReason: x.originalAttempt === 'bunt'
    ? 'physical_end_and_terminal_official_closure_unowned' : 'physical_end_and_official_continuation_unowned' });
  const prefix = x.prefix(db, x.endpoint.source.sourceId), { physical, history } = battedWorldPhysicalPrefixAndWholePlayHistory(prefix);
  const endpoint = battedWorldFieldExecutionEvidenceFromSqlite(db).read(x.endpoint.source.sourceId);
  expect(endpoint).not.toBeNull();
  if (!endpoint || endpoint.execution.kind !== 'owned_motion_v2') throw new Error('genuine retained foul endpoint prerequisite is missing');
  expect(endpoint.execution.operation).toBeNull(); expect(endpoint.execution.composition.mode).toBe('retained');
  expect(endpoint.execution.composition.quantizerBoundary).toEqual(x.boundary);
  expect(endpoint.execution.adoption.executedThrough).toEqual({ originTick: x.moment.originTick,
    tick: x.moment.ball.tick, elapsedSeconds: x.boundary.lastIncludedElapsedSeconds });
  expect(x.boundary.lastIncludedElapsedSeconds).toBeGreaterThan(x.moment.elapsedSeconds);
  expect(quantizeEventTick(x.moment.originTick, x.boundary.lastIncludedElapsedSeconds, x.ticksPerSecond)).toBe(x.moment.ball.tick);
  expect(quantizeEventTick(x.moment.originTick, x.boundary.firstExcludedElapsedSeconds, x.ticksPerSecond)).toBeGreaterThan(x.moment.ball.tick);
  const pairs = x.ids.flatMap(id => ['body', 'glove', 'left_foot', 'right_foot', 'tag_hand'].map(role => json([id, role]))).sort();
  for (const segment of physical.segments) expect(segment.actors.map(a => json([a.playerId, a.primitive.role])).sort()).toEqual(pairs);
  const after = actualPlayersKinematicsFromPrefix(x.ids, prefix);
  expect(after).toHaveLength(10); expect(history.horizon.elapsedSeconds).toBe(x.boundary.lastIncludedElapsedSeconds);
  expect(history.end.kind).toBe('unestablished');
  const baseHistories = after.flatMap(self => {
    expect(self.roles).toHaveLength(5); expect(self.at.elapsedSeconds).toBe(x.boundary.lastIncludedElapsedSeconds);
    expect(self.activeCommand.acceptedThroughTick).toBeGreaterThan(x.moment.ball.tick);
    expect(self.ownedMotionCoverage?.roleAuthorities).toHaveLength(5);
    for (const role of self.ownedMotionCoverage!.roleAuthorities) expect(role.acceptedThroughTick).toBeGreaterThan(x.moment.ball.tick);
    return (['home', 'first', 'second', 'third'] as const).map(base => {
      const bag = prefix.baseField.geometry.geometry.baseGeometry.bases[base];
      const value = deriveBallWorldPlayerBaseContactHistory({ segments: physical.segments, playerId: self.playerId,
        base: bag.region, baseSurfaceHeightMeters: bag.surfaceHeightMeters });
      expect(value.endElapsedSeconds).toBe(x.boundary.lastIncludedElapsedSeconds);
      expect(value.events.filter(e => e.elapsedSeconds > x.moment.elapsedSeconds)).toEqual([]);
      return { playerId: self.playerId, base, hash: hash(value) };
    });
  });
  expect(ownedMotionKnownWorkFromSqlite(db, x.physical.source.sourceId, x.ids))
    .toEqual(x.ids.map(playerId => ({ playerId, decisionSourceId: null, motorSourceId: null })));
  const census = actualFoulRuleConsumptionEvidenceFromSqlite(db).census({ ...x.query,
    cut: { ...x.query.cut, executionSourceId: x.endpoint.source.sourceId } });
  expect(census.producer.events.map(event => event.eventKey)).toEqual([x.production.event.eventKey]);
  expect(census.producer.successors.map(successor => successor.successorKey)).toEqual([x.production.successor.successorKey]);
  expect(census.successors).toHaveLength(1); expect(census.successors[0].consumption).toEqual(x.count.consumption);
  expect(census.acceptedConsumptions).toEqual([x.count]); expect(census.dispositionSuccessors).toEqual([x.count.successor]);
  expect(census.futureConsumptionSourceIds).toEqual([]); expect(census.producer.producer.futureSourceIds).toEqual([]);
  const admissions = actualLiveRuntimeEvidenceFromSqlite(db).admissions(x.runtime);
  const expectedAdmissions = [
    ...x.foul.fields.map(value => ({ owner: 'batted_world_field_actions', sourceId: value.source.sourceId, sourceHash: hash(value.source), snapshotHash: hash(value) })),
    { owner: 'actual_settled_foul_stop_productions', sourceId: x.production.source.sourceId, sourceHash: hash(x.production.source), snapshotHash: hash(x.production) },
    { owner: 'actual_foul_rule_consumptions', sourceId: x.count.source.sourceId, sourceHash: hash(x.count.source), snapshotHash: hash(x.count) },
    { owner: 'batted_world_field_executions', sourceId: x.endpoint.source.sourceId, sourceHash: hash(x.endpoint.source), snapshotHash: ownedScheduledMotionArchiveHash(x.endpoint) },
  ];
  expect(admissions).toEqual(expectedAdmissions.map((a, i) => ({ sequence: i + 1, ...a })));
  const roots = new Set<string>(rootOwners);
  expect(json(rootBytes(db))).toBe(x.originalRootBytes);
  for (const owner of actualLiveAdmissionOwners) {
    if (!db.prepare("SELECT 1 FROM main.sqlite_master WHERE type='table' AND name=?").get(owner)) continue;
    const rows = db.prepare('SELECT source_id FROM main.' + owner + ' ORDER BY source_id').all();
    if (roots.has(owner)) continue; // Each real zero-horizon root was authenticated by R and the original physical prefix.
    expect(rows.map(row => row.source_id)).toEqual(expectedAdmissions.filter(a => a.owner === owner).map(a => a.sourceId).sort());
  }
  expect(foulEndLogicalBytes(db)).toBe(before);
  return { prefix, physical, history, after, baseHistories, admissions, census, ownerCensus: ownerCensus(db) };
};
