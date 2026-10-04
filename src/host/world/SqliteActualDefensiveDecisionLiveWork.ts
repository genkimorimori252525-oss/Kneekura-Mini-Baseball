import { createRequire } from 'node:module';
import { deriveActualDefensiveDecisionLiveWork, type ActualDefensiveDecisionLiveWork } from '../../core/sim/liveAction/ActualDefensiveDecisionLiveWork';
import { actualObservationId as id } from './ActualFieldObservation';
import type { DefensiveDb } from './ActualDefensiveContext';
import { actualDefensiveDecisionEvidenceFromSqlite } from './SqliteActualDefensiveDecisionStore';
import { actualFieldObservationEvidenceFromSqlite } from './SqliteActualFieldObservationStore';
import { actorHash as hash, actorJson as json, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

export type OwnedActualDefensiveDecisionLiveWork = Readonly<{
  decisionSourceId: string; decisionHash: string; observationHash: string;
  decisionModelSourceId: string; decisionModelHash: string; planSourceId: string; planHash: string;
  work: ActualDefensiveDecisionLiveWork;
}>;

/** Same-connection seam. The caller owns the read transaction/snapshot; no caller receipt or latest authority is consumed. */
export const actualDefensiveDecisionLiveWorkFromSqlite = (db: DefensiveDb) => {
  const decisions = actualDefensiveDecisionEvidenceFromSqlite(db), observations = actualFieldObservationEvidenceFromSqlite(db);
  return Object.freeze({ read(sourceId: string): OwnedActualDefensiveDecisionLiveWork | null {
    if (!id(sourceId)) throw new Error('invalid actual defensive decision live-work identity');
    const decision = decisions.read(sourceId);
    if (!decision) return null;
    const { source, receipt, revision } = decision, observation = observations.read(source.observationSourceId);
    if (!observation || hash(observation) !== decision.observationHash
      || observation.source.physicalPitchSourceId !== source.physicalPitchSourceId || observation.source.playerId !== source.playerId
      || json(observation.receipt.at) !== json(receipt.observedThrough)) throw new Error('actual defensive decision live-work observation differs');
    const intentKind = receipt.selected.intent.kind;
    if (intentKind !== 'ball_handler' && intentKind !== 'hold') throw new Error('unsupported actual defensive decision live-work intent');
    const work = deriveActualDefensiveDecisionLiveWork({ physicalPitchSourceId: source.physicalPitchSourceId, playerId: source.playerId,
      originDecisionSourceId: receipt.originDecisionSourceId, decisionSourceId: source.sourceId, revision,
      originObservationSourceId: receipt.originObservationSourceId, ticksPerSecond: receipt.ticksPerSecond, availableAt: receipt.availability,
      cut: { observationSourceId: source.observationSourceId, baseFieldSourceId: observation.source.baseFieldSourceId,
        executionSourceId: observation.source.executionSourceId, at: receipt.observedThrough },
      scheduling: receipt.scheduling, lifecycle: receipt.lifecycle, intentKind, evidence: receipt.evidence });
    return freeze({ decisionSourceId: source.sourceId, decisionHash: hash(decision), observationHash: decision.observationHash,
      decisionModelSourceId: source.decisionModelSourceId, decisionModelHash: decision.decisionModelHash,
      planSourceId: source.planSourceId, planHash: decision.planHash, work });
  } });
};

/** Read-only Native adapter: no schema creation, writes, Source callbacks, current-head acquisition or physical advancement. */
export const openSqliteActualDefensiveDecisionLiveWork = (path: string) => {
  if (!id(path)) throw new Error('invalid actual defensive decision live-work path');
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(path, { readOnly: true });
  try { db.exec('PRAGMA query_only=ON; PRAGMA busy_timeout=5000;'); } catch (error) { db.close(); throw error; }
  const own = actualDefensiveDecisionLiveWorkFromSqlite(db); let closed = false;
  return Object.freeze({ read(sourceId: string): OwnedActualDefensiveDecisionLiveWork | null {
    if (closed) throw new Error('closed actual defensive decision live-work reader');
    if (!id(sourceId)) throw new Error('invalid actual defensive decision live-work identity');
    db.exec('BEGIN');
    try { const value = own.read(sourceId); db.exec('COMMIT'); return value; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  }, close() { if (!closed) { db.close(); closed = true; } } });
};
