import { expect, it } from 'vitest';
import { receivedRenewalMotorFixture as fixture } from './ActualReceivedUmpireRenewalMotorFixtures.test-support';
import type { deriveReceivedRenewalMotorReceipt } from './ActualReceivedUmpireRenewalMotor';

const motor = async (): Promise<typeof deriveReceivedRenewalMotorReceipt> => {
  const path = './ActualReceivedUmpireRenewalMotor';
  const module = await import(path).catch(() => null);
  expect(module?.deriveReceivedRenewalMotorReceipt, 'RENEWAL_MOTOR_IMPLEMENTATION_MISSING').toBeTypeOf('function');
  return module.deriveReceivedRenewalMotorReceipt;
};

it('RM01 preserves separate retained role authorities beyond the incumbent root horizon', async () => {
  const derive = await motor(), x = fixture(), before = structuredClone(x), r = derive(x.decision, x.model, x.self);
  expect(r.coverageEndTick).toBe(220);
  expect(r.roleAuthorities).toEqual(x.self.ownedMotionCoverage!.roleAuthorities);
  expect(r.retainedRoles.map(p => [p.role, p.command, p.acceptedThroughTick])).toEqual(
    x.self.ownedMotionCoverage!.roleAuthorities.map(p => [p.role, p.command, p.acceptedThroughTick]));
  expect(r.command.primitiveMotions.map(p => p.offsetAcceleration)).toEqual(x.self.roles.map(p => p.declaredPose.relativeAcceleration));
  expect(r.self).toEqual(x.self); expect(r.self).not.toBe(x.self); expect(x).toEqual(before);
  expect(r.startAt).toEqual(x.self.at); expect(r.ticksPerSecond).toBe(1000); expect(r.movementStartTick).toBe(150);
  expect(r.segment.startTick).toBe(150); expect(r.segment.endTick).toBe(220);
  expect(r.lifecycle).toEqual({ status: 'adoption_pending', executedThrough: null });
  expect(Object.isFrozen(r.roleAuthorities[0].command)).toBe(true); expect(Object.isFrozen(r.self.roles)).toBe(true);
});

it('RM02 reuses independent acceleration and route ratings with the accepted segment bound', async () => {
  const derive = await motor(), x = fixture();
  const rated = (acceleration: number, routeEfficiency: number) => ({ ...x.model,
    source: { ...x.model.source, calibration: { ...x.model.source.calibration, maxIntegrationStepTicks: 10 } },
    fieldingModel: { ...x.model.fieldingModel, source: { ...x.model.fieldingModel.source,
      ratings: { ...x.model.fieldingModel.source.ratings, acceleration, routeEfficiency } } } });
  const slow = derive(x.decision, rated(0, 0), x.self), fast = derive(x.decision, rated(1, 0), x.self), efficient = derive(x.decision, rated(0, 1), x.self);
  expect(slow.coverageEndTick).toBe(160); expect(slow.parameters.accelerationMps2).toBe(2); expect(fast.parameters.accelerationMps2).toBe(6);
  expect(slow.route).toEqual(fast.route); expect(efficient.parameters).toEqual(slow.parameters);
  expect(slow.route!.lateralDetourMeters).toBe(4); expect(efficient.route!.lateralDetourMeters).toBe(0);
  expect(slow.segment.startVelocity).toEqual({ x: 0, z: 0 }); expect(slow.command.bodyAcceleration.y).toBe(0);
});

it('RM03 brakes a held inherited velocity while retaining every declared relative command', async () => {
  const derive = await motor(), x = fixture();
  const r = derive({ ...x.decision, selected: { ...x.decision.selected, intent: { kind: 'hold' } }, target: null }, x.model,
    { ...x.self, root: { ...x.self.root, velocity: { x: 1, y: 0, z: 0 } } });
  expect(r.route).toBeNull(); expect(r.firstWaypoint).toBeNull(); expect(r.command.bodyAcceleration.x).toBeCloseTo(-8, 12);
  expect(r.segment.startVelocity).toEqual({ x: 1, z: 0 });
  expect(r.command.primitiveMotions[1].offsetAcceleration).toEqual({ x: 0.25, y: -0.5, z: 0.75 });
});

it('RM04 rejects incomplete full-cut equality and inexact integer locomotion boundaries', async () => {
  const derive = await motor(), x = fixture();
  for (const cut of [{ ...x.decision.cut, elapsedSeconds: 0.0500000000001 }, { ...x.decision.cut, originTick: 101, elapsedSeconds: 0.049 },
    { ...x.decision.cut, ticksPerSecond: 2000, elapsedSeconds: 0.025 }, { ...x.decision.cut, tick: 151, elapsedSeconds: 0.051 }]) {
    expect(() => derive({ ...x.decision, cut }, x.model, x.self)).toThrow(/cut|boundary|clock/);
  }
  expect(() => derive(x.decision, x.model, { ...x.self, at: { ...x.self.at, elapsedSeconds: 0.0499999999999 } })).toThrow(/cut|boundary/);
  for (const movementStartTick of [149, 151, 150.5]) expect(() => derive({ ...x.decision, movementStartTick }, x.model, x.self)).toThrow(/movement|cut|due/);
});

it('RM05 rejects decision and accepted model Player Person fielding and day mismatches', async () => {
  const derive = await motor(), x = fixture();
  for (const decision of [{ ...x.decision, playerId: 'other' }, { ...x.decision, physicalPitchSourceId: 'other' },
    { ...x.decision, personId: 'other' }, { ...x.decision, personLinkSourceId: 'other' }, { ...x.decision, gameDay: 9 }]) {
    expect(() => derive(decision, x.model, x.self)).toThrow(/identity|scope|model/);
  }
  for (const source of [{ ...x.model.source, playerId: 'other' }, { ...x.model.source, personLinkSourceId: 'other' },
    { ...x.model.source, fieldingModelSourceId: 'other' }, { ...x.model.source, acceptedAtDay: 11 }]) {
    expect(() => derive(x.decision, { ...x.model, source }, x.self)).toThrow(/identity|scope|model/);
  }
  expect(() => derive(x.decision, { ...x.model, fieldingModel: { ...x.model.fieldingModel,
    person: { ...x.model.fieldingModel.person, personId: 'other' } } }, x.self)).toThrow(/identity|scope|model/);
});

it('RM06 rejects missing duplicate and mismatched role authorities without global-command fallback', async () => {
  const derive = await motor(), x = fixture(), coverage = x.self.ownedMotionCoverage!;
  const { ownedMotionCoverage: _, ...withoutCoverage } = x.self;
  expect(() => derive(x.decision, x.model, withoutCoverage)).toThrow(/role|coverage/);
  for (const roleAuthorities of [coverage.roleAuthorities.slice(1), [...coverage.roleAuthorities.slice(1), coverage.roleAuthorities[1]]]) {
    expect(() => derive(x.decision, x.model, { ...x.self, ownedMotionCoverage: { ...coverage, roleAuthorities } })).toThrow(/role/);
  }
  const wrong = { ...x.self.roles[0], canonicalActor: { ...x.self.roles[0].canonicalActor, playerId: 'other' } };
  expect(() => derive(x.decision, x.model, { ...x.self, roles: [wrong, ...x.self.roles.slice(1)] })).toThrow(/role/);
  expect(() => derive(x.decision, x.model, { ...x.self, roles: [...x.self.roles.slice(1), x.self.roles[1]] })).toThrow(/role/);
});

it('RM07 rejects each expired role and any claimed coverage beyond its own command', async () => {
  const derive = await motor(), x = fixture(), coverage = x.self.ownedMotionCoverage!;
  for (let i = 0; i < 5; i++) for (const acceptedThroughTick of [150, 149, 300, 220.5]) {
    const roleAuthorities = coverage.roleAuthorities.map((a, j) => j === i ? { ...a, acceptedThroughTick } : a);
    expect(() => derive(x.decision, x.model, { ...x.self, ownedMotionCoverage: { ...coverage, roleAuthorities } })).toThrow(/role|coverage/);
  }
  const roleAuthorities = coverage.roleAuthorities.map((a, i) => i ? a : { ...a, acceptedThroughTick: 170 });
  const r = derive(x.decision, x.model, { ...x.self, ownedMotionCoverage: { ...coverage, roleAuthorities } });
  expect(r.coverageEndTick).toBe(170); expect(r.retainedRoles[0].command.acceptedThroughTick).toBe(220);
  expect(r.retainedRoles[0].acceptedThroughTick).toBe(170);
});

it('RM08 rejects unsupported vertical and acceleration residual states and strict inherited overspeed', async () => {
  const derive = await motor(), x = fixture();
  for (const root of [{ ...x.self.root, velocity: { x: 7 + 1e-10, y: 0, z: 0 } },
    { ...x.self.root, velocity: { x: 0, y: 1e-13, z: 0 } }, { ...x.self.root, acceleration: { x: 0, y: 1e-13, z: 0 } }]) {
    expect(() => derive(x.decision, x.model, { ...x.self, root })).toThrow(/speed|vertical/);
  }
  for (const p of [{ ...x.self.roles[0], canonicalRoundingResidual: { ...x.self.roles[0].canonicalRoundingResidual,
    acceleration: { x: 1e-13, y: 0, z: 0 } } }, { ...x.self.roles[0], relativeAcceleration: { x: 1e-13, y: 0, z: 0 } }]) {
    expect(() => derive(x.decision, x.model, { ...x.self, roles: [p, ...x.self.roles.slice(1)] })).toThrow(/residual|acceleration/);
  }
});

it('RM09 rejects unsupported intent target combinations and nonfinite derived arithmetic', async () => {
  const derive = await motor(), x = fixture();
  for (const decision of [{ ...x.decision, target: null }, { ...x.decision, selected: { ...x.decision.selected, intent: { kind: 'hold' as const } } },
    { ...x.decision, selected: { ...x.decision.selected, intent: { kind: 'relay' as const, target: x.decision.target! } } }]) {
    expect(() => derive(decision, x.model, x.self)).toThrow(/intent|target/);
  }
  expect(() => derive({ ...x.decision, target: { x: Number.MAX_VALUE, z: Number.MAX_VALUE } }, x.model,
    { ...x.self, root: { ...x.self.root, position: { x: -Number.MAX_VALUE, y: 1, z: -Number.MAX_VALUE } } })).toThrow();
  expect(() => derive(x.decision, { ...x.model, source: { ...x.model.source,
    calibration: { ...x.model.source.calibration, maxIntegrationStepTicks: Number.MAX_SAFE_INTEGER } } }, x.self)).toThrow(/overflow/);
});

it('RM10 rejects future or expired physical role state and preserves supported position residuals', async () => {
  const derive = await motor(), x = fixture(), p = x.self.roles[0];
  for (const primitive of [{ ...p.canonicalActor.primitive, startTick: 151 }, { ...p.canonicalActor.primitive, endTick: 149 },
    { ...p.canonicalActor.primitive, ticksPerSecond: 2000 }, { ...p.canonicalActor.primitive, role: 'body' as const }]) {
    expect(() => derive(x.decision, x.model, { ...x.self, roles: [{ ...p, canonicalActor: { ...p.canonicalActor, primitive } }, ...x.self.roles.slice(1)] })).toThrow(/role|coverage/);
  }
  const roles = [{ ...p, canonicalRoundingResidual: { ...p.canonicalRoundingResidual, position: { x: 1e-13, y: 0, z: 0 } } }, ...x.self.roles.slice(1)];
  expect(derive(x.decision, x.model, { ...x.self, roles }).self.roles).toEqual(roles);
});
