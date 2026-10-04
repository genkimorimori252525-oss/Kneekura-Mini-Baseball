import { expect, it } from 'vitest';
import { actualLocomotionFixture } from './ActualLocomotionFixtures.test-support';
import { actualPlayerKinematicsFromPrefix } from './ActualPlayerKinematicsFromPrefix';
import { battedWorldFieldEvidenceFromSqlite } from './SqliteBattedWorldFieldStore';
import { battedWorldFieldExecutionEvidenceFromSqlite, type AcceptedBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';
import { actualLivePlayQueueEvidenceFromSqlite } from './ActualLivePlayQueueEvidenceFromSqlite';

it('represents actual decision-to-motor adoption without consuming acquisition rule or custody successors', () => {
  const x = actualLocomotionFixture({ hold: true });
  try {
    const motor = x.locomotion.accept(x.locomotionSource.sourceId);
    const prefix = { baseField: x.baseField, fields: battedWorldFieldEvidenceFromSqlite(x.f.db).scope(x.baseField),
      executions: battedWorldFieldExecutionEvidenceFromSqlite(x.f.db).scope(x.baseField, x.executed.source.sourceId) };
    const selves = x.fieldSource.commands.map(c => actualPlayerKinematicsFromPrefix(c.playerId, prefix));
    const source: AcceptedBattedWorldFieldExecution = { ...x.source, sourceId: 'queue-motor-adopted', previousExecutionSourceId: x.executed.source.sourceId,
      action: { kind: 'owned_motion_v1', checkpointThroughTick: motor.receipt.coverageEndTick,
        contributions: selves.map(s => s.playerId === 'p2' ? { kind: 'motor', playerId: s.playerId, motorSourceId: motor.source.sourceId }
          : { kind: 'retained', playerId: s.playerId, command: s.activeCommand }),
        knownWork: selves.map(s => ({ playerId: s.playerId, decisionSourceId: s.playerId === 'p2' ? x.decision.source.sourceId : null,
          motorSourceId: s.playerId === 'p2' ? motor.source.sourceId : null })) } };
    x.sources.set(source.sourceId, source); x.executions.accept(source.sourceId);
    const result = actualLivePlayQueueEvidenceFromSqlite(x.f.db).derive({ sourceId: 'motor-queue-cut', sourceVersion: 'v1', capability: 'actual_live_play_scope_v1',
      physicalPitchSourceId: motor.source.physicalPitchSourceId, cut: { kind: 'field_execution', baseFieldSourceId: x.baseField.source.sourceId,
        executionSourceId: source.sourceId } });
    const issue = result.events.find(e => e.kind === 'intent_issued')!, adoption = result.events.find(e => e.kind === 'motor_adopted')!;
    expect(issue.owner.sourceId).toBe(x.decision.source.sourceId);
    expect(adoption.owner.sourceId).toBe(source.sourceId);
    expect(result.consumptions.find(c => c.consumerKind === 'motor_adoption')).toMatchObject({ eventKey: issue.eventKey, consumer: { sourceId: source.sourceId } });
    const rule = result.successors.find(s => s.kind === 'rule_evidence')!, custody = result.successors.find(s => s.kind === 'custody')!;
    expect(result.consumptions.some(c => c.successorKey === rule.successorKey || c.successorKey === custody.successorKey)).toBe(false);
    expect(result.generation).toBe('event_generation_coverage_pending'); expect(result.playEnd).toBeNull();
    expect(x.locomotion.read(motor.source.sourceId)?.receipt.lifecycle.status).toBe('adoption_pending');
  } finally { x.f.close(); }
});
