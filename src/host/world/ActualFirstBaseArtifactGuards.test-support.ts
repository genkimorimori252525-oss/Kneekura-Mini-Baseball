import type { DatabaseSync } from 'node:sqlite';
import type { OwnedActualDefensiveDecisionLiveWork } from './SqliteActualDefensiveDecisionLiveWork';
export const knownFirstBaseSealTrapSql = "CREATE TRIGGER corrupt_sealed_dependency AFTER INSERT ON actual_live_play_fences BEGIN UPDATE batted_world_field_executions SET snapshot_hash='changed-during-seal' WHERE source_id='actual-post-call-quantizer-tail'; END";
export const clearKnownFirstBaseTrapOnDisposableCopy = (db: DatabaseSync): 'absent' | 'removed_known_trap' => {
  if (db.isTransaction) throw new Error('fixture trap cleanup requires its own disposable-copy transaction');
  const normalize = (sql: string) => sql.replace(/\s+/g, ' ').trim().replace(/;$/, '');
  db.exec('BEGIN IMMEDIATE');
  try {
    const row = db.prepare("SELECT sql FROM sqlite_master WHERE type='trigger' AND name='corrupt_sealed_dependency'").get();
    if (!row) { db.exec('COMMIT'); return 'absent'; }
    if (typeof row.sql !== 'string' || normalize(row.sql) !== normalize(knownFirstBaseSealTrapSql)) throw new Error('unexpected artifact trap SQL');
    db.exec('DROP TRIGGER corrupt_sealed_dependency'); db.exec('COMMIT'); return 'removed_known_trap';
  } catch (error) { db.exec('ROLLBACK'); throw error; }
};
/** Preconditions only. The Native test obtains this value from the genuine same-connection decision owner. */
export const requireOriginalArtifactFutureDecision = (value: OwnedActualDefensiveDecisionLiveWork | null, scope: Readonly<{
  physicalPitchSourceId: string; baseFieldSourceId: string; ruleExecutionSourceId: string; throughTick: number; defenderIds: readonly string[];
}>): OwnedActualDefensiveDecisionLiveWork => {
  if (!value || value.decisionSourceId !== 'scheduled-decision-home-2' || value.work.physicalPitchSourceId !== scope.physicalPitchSourceId
    || !scope.defenderIds.includes(value.work.playerId) || value.work.phase !== 'pending_decision'
    || value.work.cut.baseFieldSourceId !== scope.baseFieldSourceId || value.work.cut.executionSourceId !== scope.ruleExecutionSourceId
    || value.work.availableAt.tick > scope.throughTick || value.work.deadlines.decision.tick <= scope.throughTick
    || value.work.deadlines.firstStep.tick <= scope.throughTick) throw new Error('original artifact future decision differs');
  return value;
};
