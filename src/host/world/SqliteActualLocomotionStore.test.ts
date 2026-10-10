import { createRequire } from 'node:module';
import { expect, it, vi } from 'vitest';
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

// Passive instrumentation of the real fixture/owners. Removing the public motor
// read phases must fail this test without substituting any original evidence.
it('shares completed original roots only within fresh locomotion owner phases', async () => {
  const physical = await import('./SqliteBattedWorldFieldStore');
  const responses = await import('./SqliteBattedContactResponseStore');
  const x = fixture();
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  let connection: import('node:sqlite').DatabaseSync | undefined, responseReads = 0, corruptInCallback = false;
  const reads: { frame: object | null; roots: number }[] = [];
  const responseOwner = responses.battedContactResponseEvidenceFromSqlite;
  const responseWitness = vi.spyOn(responses, 'battedContactResponseEvidenceFromSqlite').mockImplementation(db => {
    const own = responseOwner(db);
    return { ...own, read(id: string) { responseReads++; return own.read(id); } };
  });
  const fieldOwner = physical.battedWorldFieldEvidenceFromSqlite;
  const fieldWitness = vi.spyOn(physical, 'battedWorldFieldEvidenceFromSqlite').mockImplementation(db => {
    if (!(db instanceof DatabaseSync)) throw new Error('locomotion phase witness requires Native ownership');
    connection ??= db;
    const own = fieldOwner(db);
    return { ...own, read(id: string) {
      const before = responseReads, frame = physical.activeBattedWorldFieldReadFrame(db);
      const value = own.read(id); reads.push({ frame, roots: responseReads - before }); return value;
    } };
  });
  const outsidePhase = () => {
    expect(connection!.isTransaction).toBe(false);
    expect(physical.activeBattedWorldFieldReadFrame(connection!)).toBeNull();
    expect(connection!.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
  };
  const store = x.f.track(openSqliteActualLocomotionStore(x.f.path, { readAcceptedLocomotion() {
    // First admission has no prior receipt/dependency factory yet. Retried
    // admission must end its first read before calling the external authority.
    if (connection) outsidePhase();
    if (corruptInCallback) x.f.db.prepare("UPDATE batted_contact_responses SET snapshot_hash='callback-corruption' WHERE source_id=?")
      .run(x.baseField.response.source.sourceId);
    return x.locomotionSource;
  } }));
  const rows = () => ['actual_locomotion_receipts', 'actual_locomotion_heads', 'actual_defensive_decisions',
    'actual_defensive_decision_heads', 'actual_field_observations', 'batted_world_field_actions',
    'batted_world_field_executions', 'batted_contact_responses']
    .map(name => x.f.db.prepare(`SELECT rowid,* FROM ${name} ORDER BY rowid`).all());
  const threeFreshRoots = () => {
    expect(reads.every(read => read.frame !== null)).toBe(true);
    const frames = [...new Set(reads.map(read => read.frame))];
    expect(frames).toHaveLength(3);
    const phases = frames.map(frame => reads.filter(read => read.frame === frame));
    expect(phases.map(phase => phase.reduce((sum, read) => sum + read.roots, 0))).toEqual([1, 1, 1]);
    expect(phases.every(phase => phase.length > 1 && phase.some(read => read.roots === 0))).toBe(true);
    return frames;
  };
  try {
    const saved = store.accept(x.locomotionSource.sourceId);
    expect(saved.source).toEqual(x.locomotionSource);
    const firstFrames = threeFreshRoots(), accepted = rows(); reads.length = 0;
    expect(store.accept(saved.source.sourceId)).toEqual(saved);
    expect(store.read(saved.source.sourceId)).toEqual(saved);
    const laterFrames = threeFreshRoots();
    expect(laterFrames.every(frame => !firstFrames.includes(frame))).toBe(true);
    expect(rows()).toEqual(accepted);
    corruptInCallback = true;
    expect(() => store.accept(saved.source.sourceId)).toThrow(/corrupt original batted response archive/);
    outsidePhase();
  } finally { fieldWitness.mockRestore(); responseWitness.mockRestore(); x.f.close(); }
}, 60_000);
