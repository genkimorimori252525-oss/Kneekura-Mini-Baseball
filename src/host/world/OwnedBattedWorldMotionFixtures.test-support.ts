import { battedWorldFieldExecutionFixture } from './BattedWorldFieldExecutionFixtures.test-support';
import { actualPlayerKinematicsFromPrefix } from './ActualPlayerKinematicsFromPrefix';
import { battedWorldFieldEvidenceFromSqlite } from './SqliteBattedWorldFieldStore';
import { battedWorldFieldExecutionEvidenceFromSqlite, type AcceptedBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';

export const ownedBattedWorldMotionFixture = (path?: string, coverageTicks = 2000) => {
  const x = battedWorldFieldExecutionFixture(path), at = x.baseField.field.motion.world.moment.ball.tick;
  const batterId = x.baseField.response.touch.worldContact.flight.physicalPitch.frame.batterActor!.binding.playerId;
  const bootstrap: AcceptedBattedWorldFieldExecution = { ...x.source, sourceId: 'owned-motion-bootstrap', action: {
    kind: 'motion_checkpoint_v1', availableAtTick: x.fieldSource.availableAtTick, coverageThroughTick: at + coverageTicks, checkpointThroughTick: at + 100,
    commands: x.fieldSource.commands.map(c => ({ ...c, bodyAcceleration: { x: 0.03, y: c.playerId === batterId ? 0.02 : 0, z: -0.015 },
      primitiveMotions: c.primitiveMotions.map((p, i) => ({ ...p, offsetAcceleration: { x: 0.002 * (i + 1), y: -0.003 * (i + 1), z: 0.004 * (i + 1) } })) })),
  } };
  x.sources.set(bootstrap.sourceId, bootstrap); const first = x.executions.accept(bootstrap.sourceId);
  const prefix = (through: string) => ({ baseField: x.baseField, fields: battedWorldFieldEvidenceFromSqlite(x.f.db).scope(x.baseField),
    executions: battedWorldFieldExecutionEvidenceFromSqlite(x.f.db).scope(x.baseField, through) });
  const retain = (through: string, checkpointThroughTick: number, sourceId = 'owned-motion-retained'): AcceptedBattedWorldFieldExecution => {
    const p = prefix(through), self = x.fieldSource.commands.map(c => actualPlayerKinematicsFromPrefix(c.playerId, p));
    return { ...x.source, sourceId, previousExecutionSourceId: through, action: { kind: 'owned_motion_v1', checkpointThroughTick,
      contributions: self.map(s => ({ kind: 'retained', playerId: s.playerId, command: s.activeCommand })),
      knownWork: self.map(s => ({ playerId: s.playerId, decisionSourceId: null, motorSourceId: null })) } } as unknown as AcceptedBattedWorldFieldExecution;
  };
  return { ...x, at, batterId, first, bootstrap, prefix, retain };
};
