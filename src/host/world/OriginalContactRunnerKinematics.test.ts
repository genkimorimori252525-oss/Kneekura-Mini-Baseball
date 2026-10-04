import { expect, it, vi } from 'vitest';
import { prePitchRunnerContactFixture } from './PrePitchRunnerContactFixtures.test-support';
import { battedWorldContactEvidenceFromSqlite } from './SqliteBattedWorldContactStore';
import { battedWorldOriginalContactPrefix } from './BattedWorldOriginalContactPrefix';
import { actualPlayerKinematicsFromOriginalContact } from './ActualPlayerKinematicsFromOriginalContact';
import { sampleDefenderPhysicalPrimitiveSegment } from '../../core/sim/fielding/DefenderPhysicalPrimitive';
const state = vi.hoisted(() => ({ flight: null as any }));
vi.mock('./SqliteBattedBallFlightStore', () => ({ battedBallFlightEvidenceFromSqlite: () => ({ read: () => state.flight }) }));
const fixture = () => { const x = prePitchRunnerContactFixture(); state.flight = x.flight;
  return { ...x, contact: () => battedWorldContactEvidenceFromSqlite(x.db).derive(x.source, x.model, null) }; };

it('connects exactly eleven original identities to a bounded executed contact prefix without inventing field execution', () => {
  const x = fixture();
  try {
    const contact = x.contact(), prefix = battedWorldOriginalContactPrefix(contact);
    expect(prefix.version).toBe('owned_runner_original_contact_prefix_v1');
    expect(prefix.participants).toHaveLength(11); expect(prefix.segments).toHaveLength(1);
    expect(prefix.segments[0].actors).toEqual(contact.actors); expect(prefix.segments[0].actors).toHaveLength(55);
    expect(prefix.participants.find(p => p.playerId === 'runner')).toMatchObject({ personId: 'runner-person', role: 'runner',
      authority: { owner: 'physical_pitch_progress_actions', sourceId: 'pitch', runnerSourceId: 'runner-motion' } });
    expect(prefix.at.tick).toBe(contact.result.kind === 'contact' ? contact.result.tick : contact.result.throughTick);
    expect(prefix.at.tick).toBeLessThan(contact.flight.flight.contact.tick + contact.flight.source.searchDurationTicks);
    expect(prefix).not.toHaveProperty('field'); expect(prefix).not.toHaveProperty('playEnd');
    expect(prefix).not.toHaveProperty('ruleEvidence'); expect(prefix).not.toHaveProperty('controlWindows');
  } finally { x.db.close(); }
});

it('reconstructs original runner root and all five relative parts at the actual executed horizon, with prospectively owned source identities', () => {
  const x = fixture();
  try {
    const contact = x.contact(), value = actualPlayerKinematicsFromOriginalContact('runner', contact);
    const elapsed = (value.at.tick - x.flight.physicalPitch.frame.world.tick) / 1_000_000;
    expect(value.origin).toMatchObject({ kind: 'pre_pitch_runner_controller', physicalPitchSourceId: 'pitch', runnerSourceId: 'runner-motion',
      at: { tick: x.flight.physicalPitch.frame.world.tick } });
    expect(value.root.position).toEqual({ x: 10 + elapsed * elapsed, y: 0.3, z: 5 });
    expect(value.root.velocity).toEqual({ x: 2 * elapsed, y: 0, z: 0 });
    expect(value.root.acceleration).toEqual({ x: 2, y: 0, z: 0 });
    expect(value.roles).toHaveLength(5); expect(value).not.toHaveProperty('activeCommand');
    for (const role of value.roles) {
      const actual = sampleDefenderPhysicalPrimitiveSegment(role.canonicalActor.primitive, value.at.tick);
      for (const axis of ['x', 'y', 'z'] as const) {
        expect(value.root.position[axis] + role.offset[axis]).toBeCloseTo(actual.center[axis], 12);
        expect(value.root.velocity[axis] + role.relativeVelocity[axis]).toBeCloseTo(actual.velocity[axis], 12);
        expect(value.root.acceleration[axis] + role.relativeAcceleration[axis]).toBeCloseTo(actual.acceleration[axis], 12);
      }
    }
    expect(Object.isFrozen(value.roles)).toBe(true);
    expect(actualPlayerKinematicsFromOriginalContact('batter', contact).origin.kind).toBe('batter_swing_grip');
    for (const p of x.flight.physicalPitch.frame.batterActor.defenderBindings) {
      expect(actualPlayerKinematicsFromOriginalContact(p.playerId, contact).origin.kind).toBe('defender_world_projection');
    }
  } finally { x.db.close(); }
});

it.each(['person', 'extra_actor', 'missing_role', 'wrong_owner', 'controller', 'root', 'runner_part', 'defender_part', 'batter_part', 'future_horizon', 'caller_state'])
('rejects %s instead of presenting a fabricated prefix or kinematics', kind => {
  const x = fixture();
  try {
    const contact = structuredClone(x.contact()) as any;
    if (kind === 'person') contact.modelActorEvidence.find((p: any) => p.binding.playerId === 'runner').binding.personId = 'other';
    if (kind === 'extra_actor') contact.actors.push({ ...contact.actors[0], playerId: 'reserve' });
    if (kind === 'missing_role') contact.actors = contact.actors.filter((p: any) => !(p.playerId === 'runner' && p.primitive.role === 'glove'));
    if (kind === 'wrong_owner') contact.source.prePitchRunnerSourceId = 'other';
    if (kind === 'controller') contact.flight.physicalPitch.frame.prePitchRunner.controller.trajectory.segments[0].accelerationMps2 += 1;
    if (kind === 'root') contact.flight.physicalPitch.frame.prePitchRunner.canonical.position.x += 1;
    if (['runner_part', 'defender_part', 'batter_part'].includes(kind)) {
      const playerId = kind === 'runner_part' ? 'runner' : kind === 'defender_part' ? 'defender-0' : 'batter';
      contact.actors.find((p: any) => p.playerId === playerId && p.primitive.role === 'body').primitive.startCenter.x += 1;
    }
    if (kind === 'future_horizon') contact.result.tick = contact.flight.flight.contact.tick + contact.flight.source.searchDurationTicks + 1;
    if (kind === 'caller_state') contact.flight.physicalPitch.source.prePitchRunner.startMotion.speedMps = 1;
    expect(() => battedWorldOriginalContactPrefix(contact)).toThrow();
  } finally { x.db.close(); }
});

it('does not expose the declared future coverage as executed kinematics or allow arbitrary caller sampling', () => {
  const x = fixture();
  try {
    const contact = x.contact(), prefix = battedWorldOriginalContactPrefix(contact);
    expect(prefix.segments[0].endElapsedSeconds).toBe(prefix.at.elapsedSeconds);
    expect(prefix.at.tick).toBeLessThan(x.flight.physicalPitch.frame.prePitchRunner.source.coverageThroughTick);
    expect(() => actualPlayerKinematicsFromOriginalContact('reserve', contact)).toThrow();
    const { kind: _kind, prePitchRunnerSourceId: _source, ...legacy } = contact.source;
    expect(() => battedWorldOriginalContactPrefix({ ...contact, source: legacy })).toThrow();
  } finally { x.db.close(); }
});

it('preserves a nonzero canonical runner root below primitive cleanup tolerance instead of silently rebasing it', async () => {
  const x = fixture();
  try {
    const { buildPrePitchRunnerController } = await import('./PrePitchRunnerExecution');
    const flight = structuredClone(x.flight), owned = flight.physicalPitch.frame.prePitchRunner;
    const source = { ...owned.source, route: { segments: [{ kind: 'line' as const, start: { x: 10, z: 1e-13 }, end: { x: 100, z: 1e-13 } }] },
      bodyPose: { ...owned.source.bodyPose, primitiveMotions: owned.source.bodyPose.primitiveMotions.map(p => ({ ...p, startOffset: { ...p.startOffset, z: 5 - 1e-13 } })) } };
    const canonical = { ...owned.canonical, position: { x: 10, z: 1e-13 } };
    flight.physicalPitch.frame.world.runners[0].position = canonical.position;
    flight.physicalPitch.source.prePitchRunner = source;
    flight.physicalPitch.frame.prePitchRunner = { ...owned, source, canonical, controller: buildPrePitchRunnerController(source, canonical) };
    state.flight = flight;
    const model = { ...x.model, actors: x.model.actors.map(a => a.playerId === 'runner' ? { ...a,
      primitives: a.primitives.map(p => ({ ...p, offset: source.bodyPose.primitiveMotions.find(m => m.role === p.role)!.startOffset })) } : a) };
    const contact = battedWorldContactEvidenceFromSqlite(x.db).derive(x.source, model, null);
    const value = actualPlayerKinematicsFromOriginalContact('runner', contact);
    expect(value.root.position.z).toBe(1e-13);
    expect(value.roles.find(p => p.role === 'body')!.declaredPose.offset.z).toBe(5 - 1e-13);
  } finally { x.db.close(); }
});
