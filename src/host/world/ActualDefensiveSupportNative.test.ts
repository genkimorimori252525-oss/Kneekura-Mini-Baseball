import { expect, it } from 'vitest';
import { actualLocomotionFixture } from './ActualLocomotionFixtures.test-support';
import { ownedMotionKnownWorkFromSqlite } from './OwnedMotionKnownWorkFromSqlite';
import { actualPlayersKinematicsFromPrefix } from './ActualPlayerKinematicsFromPrefix';
import { battedWorldFieldEvidenceFromSqlite } from './SqliteBattedWorldFieldStore';
import { battedWorldFieldExecutionEvidenceFromSqlite, openSqliteBattedWorldFieldExecutionStore } from './SqliteBattedWorldFieldExecutionStore';
import { openSqliteActualDefensiveDecisionStore } from './SqliteActualDefensiveDecisionStore';
import { openSqliteActualLocomotionStore } from './SqliteActualLocomotionStore';
import type { OwnedMotionV2Action } from './OwnedScheduledBattedWorldMotion';

it('AS01 authentic support Source issues rated relay and adopts physical movement with independent reopen', () => {
  const x = actualLocomotionFixture({ supportRole: 'relay' });
  try {
    expect(x.decision.receipt.selected.intent.kind).toBe('relay');
    const motor = x.locomotion.accept(x.locomotionSource.sourceId);
    expect(motor.receipt.intent.kind).toBe('relay');
    const players = x.fieldSource.commands.map(c => c.playerId), pitchId = x.decision.source.physicalPitchSourceId;
    const prefix = { baseField: x.baseField, fields: battedWorldFieldEvidenceFromSqlite(x.f.db).scope(x.baseField),
      executions: battedWorldFieldExecutionEvidenceFromSqlite(x.f.db).scope(x.baseField, x.executed.source.sourceId) };
    const before = actualPlayersKinematicsFromPrefix(players, prefix), known = ownedMotionKnownWorkFromSqlite(x.f.db, pitchId, players);
    const action: OwnedMotionV2Action = { kind: 'owned_motion_v2', checkpoint: { kind: 'motion', throughTick: motor.receipt.segment.startTick + 1 },
      knownWork: known, contributions: before.map(s => s.playerId === 'p2' ? { kind: 'motor', playerId: s.playerId, motorSourceId: motor.source.sourceId }
        : { kind: 'retained', playerId: s.playerId, command: s.activeCommand }) };
    const source = { ...x.source, sourceId: 'actual-support-relay-adoption', previousExecutionSourceId: x.executed.source.sourceId, action };
    x.sources.set(source.sourceId, source);
    const moved = x.executions.accept(source.sourceId);
    expect(moved.execution.kind).toBe('owned_motion_v2');
    const later = actualPlayersKinematicsFromPrefix(players, { ...prefix, executions: [...prefix.executions, moved] });
    const originalSelf = before.find(s => s.playerId === 'p2')!, self = later.find(s => s.playerId === 'p2')!;
    expect(Math.hypot(self.root.position.x - originalSelf.root.position.x, self.root.position.z - originalSelf.root.position.z)).toBeGreaterThan(0);
    expect(x.f.track(openSqliteActualDefensiveDecisionStore(x.f.path)).read(x.decision.source.sourceId)).toEqual(x.decision);
    expect(x.f.track(openSqliteActualLocomotionStore(x.f.path)).read(motor.source.sourceId)).toEqual(motor);
    expect(x.f.track(openSqliteBattedWorldFieldExecutionStore(x.f.path, x.fields)).read(moved.source.sourceId)).toEqual(moved);
    if (x.executed.execution.kind !== 'acquisition_advance' || x.executed.execution.progress.kind !== 'secured') throw new Error('original capture fence missing');
    expect(moved.execution.field.motion.carrierPlayerId).toBe(x.executed.execution.progress.acquisition.acquirerPlayerId);
  } finally { x.f.close(); }
}, 120_000);
