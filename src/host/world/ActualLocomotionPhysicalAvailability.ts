import type { DefensiveDb } from './ActualDefensiveContext';
import type { ActualPlayerKinematicsCut, OwnedActualPlayerKinematics } from './SqliteActualPlayerKinematicsReader';
import { battedWorldFieldEvidenceFromSqlite } from './SqliteBattedWorldFieldStore';
import { battedWorldFieldExecutionEvidenceFromSqlite } from './SqliteBattedWorldFieldExecutionStore';
import { actorFreeze as freeze, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

/** A local physical admission fence, not a second execution owner. Replays only the pinned
 * original prefix and applies the existing execution owner's pending-operation/cursor rules. */
export const actualLocomotionPhysicalAvailabilityFromSqlite = (db: DefensiveDb, cut: ActualPlayerKinematicsCut,
  self: Pick<OwnedActualPlayerKinematics, 'at'>) => {
  const base = battedWorldFieldEvidenceFromSqlite(db).read(cut.baseFieldSourceId);
  if (!base) throw new Error('actual locomotion original field is missing');
  const tables = db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name IN ('batted_world_field_executions','batted_world_field_execution_heads')").get()!;
  if (tables.n !== 0 && tables.n !== 2) throw new Error('actual locomotion physical owner tables differ');
  const prefix = tables.n === 2 ? battedWorldFieldExecutionEvidenceFromSqlite(db).scope(base, cut.executionSourceId) : [];
  if ((prefix.at(-1)?.source.sourceId ?? null) !== cut.executionSourceId) throw new Error('actual locomotion original physical cut differs');
  const reversed = [...prefix].reverse();
  const transfer = reversed.find(v => v.execution.kind === 'throw_plan');
  const transferAdvance = transfer && reversed.find(v => v.execution.kind === 'throw_advance' && v.execution.planSourceId === transfer.source.sourceId);
  if (transfer && (!transferAdvance || transferAdvance.execution.kind === 'throw_advance' && transferAdvance.execution.progress.kind === 'transfer')) {
    throw new Error('actual locomotion blocked by pending scheduled transfer');
  }
  const capture = reversed.find(v => v.execution.kind === 'acquisition_plan');
  const captureAdvance = capture && reversed.find(v => v.execution.kind === 'acquisition_advance' && v.execution.planSourceId === capture.source.sourceId);
  if (capture && (!captureAdvance || captureAdvance.execution.kind === 'acquisition_advance'
    && (captureAdvance.execution.progress.kind === 'capturing' || captureAdvance.execution.progress.kind === 'fence_pending'))) {
    throw new Error('actual locomotion blocked by pending scheduled acquisition');
  }
  const metadataOnly = ['whole_play_history', 'base_touch_history', 'first_base_race', 'throw_plan', 'acquisition_plan'];
  const physical = reversed.find(v => !metadataOnly.includes(v.execution.kind));
  let cursor = (prefix.at(-1)?.execution.field ?? base.field).motion.cursor;
  if (physical?.execution.kind === 'acquisition') {
    const a = physical.execution.acquisition;
    if (a.kind !== 'secured') throw new Error('actual locomotion blocked by unresolved acquisition');
    cursor = { moment: a.moment, previousContacts: [{ kind: 'actor', playerId: a.acquirerPlayerId, role: 'glove' }] };
  } else if (physical?.execution.kind === 'acquisition_advance') {
    if (physical.execution.progress.kind !== 'secured') throw new Error('actual locomotion blocked by unresolved scheduled acquisition');
    cursor = physical.execution.progress.cursor;
  }
  if (!cursor) throw new Error('actual locomotion blocked by unresolved physical contact');
  const at = { originTick: cursor.moment.originTick, elapsedSeconds: cursor.moment.elapsedSeconds, tick: cursor.moment.ball.tick };
  if (at.originTick !== self.at.originTick || at.elapsedSeconds !== self.at.elapsedSeconds || at.tick !== self.at.tick) {
    throw new Error('actual locomotion actual cursor differs from self cut');
  }
  return freeze({ status: 'unblocked_at_original_cut' as const, at,
    owner: physical ? 'batted_world_field_executions' as const : 'batted_world_field_actions' as const,
    lastPhysicalSourceId: physical?.source.sourceId ?? base.source.sourceId,
    lastPhysicalSourceHash: hash(physical?.source ?? base.source) });
};
