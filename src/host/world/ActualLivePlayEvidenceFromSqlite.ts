import { actualLivePlayScopeArchiveEncoding as encode } from './ActualLivePlayArchive';
import { createLivePlayRegistry, resolveLivePlayRegistry, type LivePlaySource } from '../../core/sim/liveAction/LivePlayRegistry';
import { actualLivePlayScopeInput, deriveActualLivePlayScope, type AcceptedActualLivePlayScope,
  type DurableActualLivePlayScope, type ActualLivePlayPrefix, type ActualLivePhysicalLocalWork } from './ActualLivePlayScope';
import { readOriginalPhysicalPitchPrefixFromSqlite } from './PhysicalPitchEvidenceFromSqlite';
import { actorHash as hash, actorFreeze as freeze, assertPhysicalActorOpenFrame } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { battedWorldFieldEvidenceFromSqlite } from './SqliteBattedWorldFieldStore';
import { battedWorldFieldExecutionEvidenceFromSqlite } from './SqliteBattedWorldFieldExecutionStore';
import { actualLivePlayInventoryFromSqlite, actualLiveOwnerInstalled, type ActualLiveInventoryOwner } from './ActualLivePlayInventoryFromSqlite';
import { actualFieldObservationEvidenceFromSqlite } from './SqliteActualFieldObservationStore';
import { actualDefensiveDecisionEvidenceFromSqlite } from './SqliteActualDefensiveDecisionStore';
import { actualDefensiveDecisionLiveWorkFromSqlite } from './SqliteActualDefensiveDecisionLiveWork';
import { actualLocomotionEvidenceFromSqlite } from './SqliteActualLocomotionStore';

/** Source-local projections only. No forecast, tail or plan becomes an event. */
export const actualLivePhysicalSources = (history: readonly ActualLivePhysicalLocalWork[]): LivePlaySource[] => {
  const sources = new Map<string, LivePlaySource>();
  // Legacy operation revisions intentionally share one local source identity.
  // Preserve the original latest-revision projection of the authenticated prefix.
  const add = (source: LivePlaySource) => { sources.set(source.sourceId, source); };
  for (const entry of history) {
    const work = entry.work;
    if ('source' in work) add(work.source);
    if ('handoffs' in work) for (const h of work.handoffs) add(h.source);
    if ('handoff' in work && work.handoff) add(work.handoff.source);
    if ('operation' in work && work.operation) {
      add(work.operation.source);
      for (const handoff of work.operation.handoffs) add(handoff.source);
    }
  }
  return [...sources.values()];
};
type Db = Pick<import('node:sqlite').DatabaseSync, 'prepare'>;
/** Same-connection reader only. No accepted callback receipt, terminal flag, caller list or watermark is read. */
export const actualLivePlayEvidenceFromSqlite = (db: Db) => {
  const dependencies = (raw: AcceptedActualLivePlayScope, current: boolean) => {
    const source = actualLivePlayScopeInput(raw), pitch = readOriginalPhysicalPitchPrefixFromSqlite(db, source.physicalPitchSourceId).at(-1)!;
    const fields = battedWorldFieldEvidenceFromSqlite(db), executions = battedWorldFieldExecutionEvidenceFromSqlite(db);
    let prefix: ActualLivePlayPrefix | null = null;
    if (source.cut.kind === 'field_execution') {
      const baseField = fields.read(source.cut.baseFieldSourceId);
      if (!baseField) throw new Error('actual live-play original field is missing');
      const installed = actualLiveOwnerInstalled(db, 'batted_world_field_executions', 'batted_world_field_execution_heads');
      prefix = { baseField, fields: fields.scope(baseField, source.cut.baseFieldSourceId),
        executions: installed ? executions.scope(baseField, source.cut.executionSourceId) : [] };
      if ((prefix.executions.at(-1)?.source.sourceId ?? null) !== source.cut.executionSourceId) throw new Error('actual live-play original execution is missing');
      if (current) {
        fields.current(baseField);
        const last = prefix.executions.at(-1);
        if (last) executions.current(last);
        else if (installed && executions.scope(baseField).length) throw new Error('actual live-play execution cut is stale');
      }
    }
    if (current) {
      if (!pitch.frame.batterActor) throw new Error('actual live-play original batter participant missing');
      assertPhysicalActorOpenFrame(db, pitch.frame.batterActor);
      const head = db.prepare('SELECT revision,last_source_id FROM physical_pitch_progress_heads WHERE game_id=? AND play_id=?').get(pitch.frame.gameId, pitch.frame.match.playId);
      if (!head || head.last_source_id !== source.physicalPitchSourceId || head.revision !== pitch.progressRevision) throw new Error('actual live-play pitch cut is stale');
    }
    return { source, pitch, prefix };
  };
  // The prefix is freshly authenticated by this reader, never supplied by a caller.
  const deriveWithPhysicalPrefix = (raw: AcceptedActualLivePlayScope, current = false) => {
    const { source, pitch, prefix } = dependencies(raw, current);
    const physicalLocalHistory: ActualLivePhysicalLocalWork[] = [];
    for (const v of prefix?.executions ?? []) if ('liveWork' in v.execution) physicalLocalHistory.push({
      owner: 'batted_world_field_executions', sourceId: v.source.sourceId, revision: v.revision, work: v.execution.liveWork });
    const value: DurableActualLivePlayScope = freeze({ source, revision: 1, history: [source],
      scope: deriveActualLivePlayScope(source, pitch, prefix), physicalLocalHistory });
    return { value, prefix };
  };
  const derive = (raw: AcceptedActualLivePlayScope, current = false): DurableActualLivePlayScope =>
    deriveWithPhysicalPrefix(raw, current).value;
  const evaluate = (value: DurableActualLivePlayScope) => {
    const scope = value.scope, inventory = actualLivePlayInventoryFromSqlite(db, scope);
    const evidence: { owner: string; sourceId: string; playerId: string | null; snapshotHash: string }[] = [
      { owner: 'physical_pitch_progress_actions', sourceId: scope.physicalPitchSourceId, playerId: null, snapshotHash: scope.originalPitchHash },
      ...scope.physicalReferences.map(r => ({ owner: r.owner, sourceId: r.sourceId, playerId: null, snapshotHash: r.hash })),
    ];
    // Local receipts/successors never certify global generation or retire an actor.
    const actual: LivePlaySource[] = actualLivePhysicalSources(value.physicalLocalHistory);
    const latest = <T extends { player_id: string }>(rows: readonly T[]) => scope.participants.flatMap(p => {
      const row = rows.filter(r => r.player_id === p.playerId).at(-1); return row ? [row] : [];
    });
    for (const row of latest(inventory.observations)) {
      const observation = actualFieldObservationEvidenceFromSqlite(db).read(row.source_id);
      if (!observation) throw new Error('actual live-play owned observation disappeared');
      evidence.push({ owner: 'actual_field_observations', sourceId: row.source_id, playerId: row.player_id, snapshotHash: hash(observation) });
    }
    for (const row of latest(inventory.decisions)) {
      const decision = actualDefensiveDecisionEvidenceFromSqlite(db).read(row.source_id);
      const live = actualDefensiveDecisionLiveWorkFromSqlite(db).read(row.source_id);
      if (!decision || !live) throw new Error('actual live-play owned decision disappeared');
      evidence.push({ owner: 'actual_defensive_decisions', sourceId: row.source_id, playerId: row.player_id, snapshotHash: hash(decision) });
      actual.push(live.work.source);
      if (live.work.handoff) {
        // A pending motor receipt is retained unless the actual execution archive owns its adoption.
        const motor = inventory.motors.find(m => m.decision_source_id === row.source_id);
        const cut = scope.cut, prefix = cut.kind === 'field_execution' ? dependencies(value.source, false).prefix : null;
        const adopted = motor && prefix?.executions.some(e => (e.execution.kind === 'owned_motion_v1' || e.execution.kind === 'owned_motion_v2')
          && e.execution.adoption.contributors.some(c => c.motorSourceId === motor.source_id && c.playerId === row.player_id));
        if (!adopted) actual.push(live.work.handoff.source);
      }
    }
    for (const row of inventory.motors) {
      const motor = actualLocomotionEvidenceFromSqlite(db).read(row.source_id);
      if (!motor) throw new Error('actual live-play owned motor disappeared');
      evidence.push({ owner: 'actual_locomotion_receipts', sourceId: row.source_id, playerId: row.player_id, snapshotHash: hash(motor) });
    }
    const producers = scope.producers.map(p => {
      const hasEvidence = evidence.some(e => e.owner === p.owner && (p.playerId === null || e.playerId === p.playerId || p.domain === 'body_motion'));
      const installed = p.owner !== null && (p.owner in inventory.installed ? inventory.installed[p.owner as ActualLiveInventoryOwner]
        : actualLiveOwnerInstalled(db, p.owner));
      return { ...p, evidenceState: p.owner === null ? 'generator_unowned' as const : !installed ? 'owner_not_installed' as const
        : hasEvidence ? 'owned_output' as const : 'no_owned_output' as const,
      generation: 'uncertified' as const, consumption: 'uncertified' as const };
    });
    // These are missing producer proof obligations, not fictional information/decision events.
    // Never expose Core's empty-source/currentTick shortcut as Native closure evidence.
    const sources: LivePlaySource[] = producers.map(p => ({ sourceId: p.producerId, revision: 1,
      queue: { sourceId: p.producerId, settledThroughTick: -1, nextPendingTick: null },
      physical: [], intents: [], information: [], decisions: [], ruleWindows: [] }));
    sources.push(...actual);
    const registry = resolveLivePlayRegistry(createLivePlayRegistry({ playId: scope.playId, revision: 1, sources }), {
      tick: scope.at.tick, terminal: 'none', actors: scope.participants.map(p => ({ actorId: p.playerId, kind: 'acting' as const })),
    });
    if (registry.resolution.kind !== 'continues') throw new Error('actual live-play pending-only boundary cannot emit PlayEnd');
    return freeze({ version: 'actual_live_play_pending_v1' as const, kind: 'pending' as const, playEnd: null, scopeId: scope.scopeId,
      at: scope.at, participation: scope.participation, coverage: 'uncertified' as const,
      // Core acting means no proved settlement here; no physical actor command is issued.
      actorDispositionEvidence: 'not_established' as const, producerMetadataHash: inventory.metadataHash, producers, evidence, registry: { ...registry, resolution: registry.resolution } });
  };
  const current = (value: DurableActualLivePlayScope) => {
    const current = encode(derive(value.source, true)), original = encode(value);
    if (current.json !== original.json || current.hash !== original.hash) throw new Error('actual live-play dependencies changed during write');
  };
  return { derive, deriveWithPhysicalPrefix, evaluate, current };
};
export type ActualLivePlayPending = ReturnType<ReturnType<typeof actualLivePlayEvidenceFromSqlite>['evaluate']>;
