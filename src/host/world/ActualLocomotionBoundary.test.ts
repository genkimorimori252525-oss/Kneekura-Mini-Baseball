import { expect, it } from 'vitest';
import { actualLocomotionFixture as fixture } from './ActualLocomotionFixtures.test-support';
import { deriveActualLocomotionReceipt } from './ActualLocomotion';
import { actualPlayerKinematicsEvidenceFromSqlite } from './SqliteActualPlayerKinematicsReader';

it('consumes calibration independently, brakes inherited velocity, retains nonzero relative commands and never clamps overspeed', () => {
  const x = fixture();
  try {
    const source = x.locomotionSource, own = actualPlayerKinematicsEvidenceFromSqlite(x.f.db);
    const self = own.read({ physicalPitchSourceId: source.physicalPitchSourceId, playerId: source.playerId,
      baseFieldSourceId: source.baseFieldSourceId, executionSourceId: source.executionSourceId, mode: 'original' });
    // Internal calculation cases start with actual owned identity; the public Native Source never accepts self or targets.
    const moving = { ...self, root: { ...self.root, velocity: { x: 1, y: 0, z: 0 } }, roles: self.roles.map(p => ({ ...p,
      relativeAcceleration: { x: 0.25, y: -0.5, z: 0.75 }, declaredPose: { ...p.declaredPose, relativeAcceleration: { x: 0.25, y: -0.5, z: 0.75 } } })) };
    const hold = { ...x.decision, receipt: { ...x.decision.receipt, selected: { ...x.decision.receipt.selected, intent: { kind: 'hold' as const } }, target: null } };
    const braking = deriveActualLocomotionReceipt(hold, x.model, moving);
    expect(braking.command.bodyAcceleration.x).toBeCloseTo(-x.model.source.calibration.brakingMps2, 9);
    expect(braking.segment.startVelocity).toEqual({ x: 1, z: 0 });
    expect(braking.command.primitiveMotions.every(p => p.offsetAcceleration.y === -0.5)).toBe(true);
    expect(braking.self.roles[0].canonicalActor).toEqual(self.roles[0].canonicalActor);
    const rated = (acceleration: number, routeEfficiency: number) => ({ ...x.model, fieldingModel: { ...x.model.fieldingModel,
      source: { ...x.model.fieldingModel.source, ratings: { ...x.model.fieldingModel.source.ratings, acceleration, routeEfficiency } } } });
    const slow = deriveActualLocomotionReceipt(x.decision, rated(0, 0), self), fast = deriveActualLocomotionReceipt(x.decision, rated(1, 0), self);
    expect(slow.route).toEqual(fast.route); expect(slow.parameters.accelerationMps2).toBe(2); expect(fast.parameters.accelerationMps2).toBe(6);
    const efficient = deriveActualLocomotionReceipt(x.decision, rated(0, 1), self);
    expect(efficient.parameters).toEqual(slow.parameters); expect(efficient.route!.lateralDetourMeters).toBe(0);
    expect(slow.route!.lateralDetourMeters).toBe(4);
    expect(() => deriveActualLocomotionReceipt(x.decision, x.model, { ...self, root: { ...self.root,
      velocity: { x: x.model.source.calibration.topSpeedMps + 1e-10, y: 0, z: 0 } } })).toThrow(/speed/);
    const residual = { ...self, roles: self.roles.map(p => ({ ...p, canonicalRoundingResidual: { ...p.canonicalRoundingResidual,
      acceleration: { x: 1e-13, y: 0, z: 0 } } })) };
    expect(() => deriveActualLocomotionReceipt(x.decision, x.model, residual)).toThrow(/retained|residual/);
  } finally { x.f.close(); }
});

it('rejects fractional/backdated/delayed issuance, exhausted coverage, and nonfinite derived route/step arithmetic', () => {
  const x = fixture();
  try {
    const s = x.locomotionSource, self = actualPlayerKinematicsEvidenceFromSqlite(x.f.db).read({ physicalPitchSourceId: s.physicalPitchSourceId,
      playerId: s.playerId, baseFieldSourceId: s.baseFieldSourceId, executionSourceId: s.executionSourceId, mode: 'original' });
    const at = { ...self.at, elapsedSeconds: self.at.elapsedSeconds + 1e-12 };
    expect(() => deriveActualLocomotionReceipt(x.decision, x.model, { ...self, at })).toThrow(/exact.*boundary/);
    const futureIssue = { ...x.decision, receipt: { ...x.decision.receipt, lifecycle: { ...x.decision.receipt.lifecycle, issuedAt: at } } };
    expect(() => deriveActualLocomotionReceipt(futureIssue, x.model, self)).toThrow(/backdate/);
    const pending = { ...x.decision, receipt: { ...x.decision.receipt, lifecycle: { status: 'pending_first_step' as const, issuedAt: null, issuedBySourceId: null } } };
    expect(() => deriveActualLocomotionReceipt(pending, x.model, self)).toThrow(/issued/);
    expect(() => deriveActualLocomotionReceipt(x.decision, x.model, { ...self,
      activeCommand: { ...self.activeCommand, acceptedThroughTick: self.at.tick } })).toThrow(/coverage/);
    const overflow = { ...x.decision, receipt: { ...x.decision.receipt, target: { x: Number.MAX_VALUE, z: Number.MAX_VALUE } } };
    expect(() => deriveActualLocomotionReceipt(overflow, x.model, { ...self,
      root: { ...self.root, position: { x: -Number.MAX_VALUE, y: 0, z: -Number.MAX_VALUE } } })).toThrow();
    const tooLong = { ...x.model, source: { ...x.model.source, calibration: { ...x.model.source.calibration, maxIntegrationStepTicks: Number.MAX_SAFE_INTEGER } } };
    expect(() => deriveActualLocomotionReceipt(x.decision, tooLong, self)).toThrow(/overflow/);
  } finally { x.f.close(); }
});
