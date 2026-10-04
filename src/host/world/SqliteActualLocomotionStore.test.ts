import { expect, it } from 'vitest';
import { actualLocomotionFixture as fixture } from './ActualLocomotionFixtures.test-support';
import { openSqliteActualLocomotionStore } from './SqliteActualLocomotionStore';
import { actualPlayerKinematicsEvidenceFromSqlite } from './SqliteActualPlayerKinematicsReader';

it('owns one first-waypoint integration step from exact issued intent and self, preserving archives and original coverage', () => {
  const x = fixture();
  try {
    const tables = ['batted_world_field_actions', 'batted_world_field_executions', 'actual_defensive_decisions', 'actual_field_observations'];
    const archives = () => tables.map(t => x.f.db.prepare(`SELECT * FROM ${t}`).all()), before = archives();
    expect(x.decision.receipt.lifecycle.status).toBe('issued');
    const saved = x.locomotion.accept(x.locomotionSource.sourceId), r = saved.receipt;
    expect(r.physicalAvailability.status).toBe('unblocked_at_original_cut');
    expect(r.physicalAvailability.at).toEqual(r.self.at);
    expect(r.physicalAvailability.lastPhysicalSourceId).toBe(x.executed.source.sourceId);
    expect(r.lifecycle).toEqual({ status: 'adoption_pending', executedThrough: null });
    expect(r.target).toEqual(x.decision.receipt.target);
    expect(r.firstWaypoint).toEqual(r.route!.waypoints[0]);
    expect(r.segment.target).toEqual(r.firstWaypoint);
    expect(r.segment.endTick - r.segment.startTick).toBe(x.model.source.calibration.maxIntegrationStepTicks);
    expect(r.issuedAt).toEqual(x.decision.receipt.lifecycle.issuedAt);
    const self = actualPlayerKinematicsEvidenceFromSqlite(x.f.db).read({ playerId: 'p2', physicalPitchSourceId: x.locomotionSource.physicalPitchSourceId,
      baseFieldSourceId: x.baseField.source.sourceId, executionSourceId: x.executed.source.sourceId, mode: 'original' });
    expect(r.self).toEqual(self);
    expect(self.roles.some(p => p.relativeAcceleration.y !== 0)).toBe(true);
    expect(self.roles.find(p => p.role === 'body')!.offset.x).not.toBe(0);
    expect(r.command.primitiveMotions).toEqual(self.roles.map(p => ({ role: p.role, offsetAcceleration: p.relativeAcceleration })));
    expect(r.retainedRoles.map(p => p.acceptedThroughTick)).toEqual(self.roles.map(p => Math.min(p.canonicalActor.primitive.endTick, self.activeCommand.acceptedThroughTick)));
    expect(r.segment.startPosition).toEqual({ x: self.root.position.x, z: self.root.position.z });
    expect(r.segment.startVelocity).toEqual({ x: self.root.velocity.x, z: self.root.velocity.z });
    expect(x.locomotion.accept(saved.source.sourceId)).toEqual(saved);
    expect(x.f.track(openSqliteActualLocomotionStore(x.f.path)).accept(saved.source.sourceId)).toEqual(saved);
    expect(Object.isFrozen(saved.receipt.self.roles[0])).toBe(true);
    expect(archives()).toEqual(before);
    x.locomotionSources.set('second-step', { ...x.locomotionSource, sourceId: 'second-step' });
    expect(() => x.locomotion.accept('second-step')).toThrow(/initial|already/);
  } finally { x.f.close(); }
});

it('uses null-target hold without claiming physical settlement', () => {
  const x = fixture({ hold: true });
  try {
    const r = x.locomotion.accept(x.locomotionSource.sourceId).receipt;
    expect(r.intent.kind).toBe('hold'); expect(r.target).toBeNull(); expect(r.route).toBeNull(); expect(r.firstWaypoint).toBeNull();
    expect(r.segment.target).toBeNull(); expect(r.lifecycle.status).toBe('adoption_pending');
    expect(r).not.toHaveProperty('settled'); expect(r).not.toHaveProperty('playEnd');
  } finally { x.f.close(); }
});
