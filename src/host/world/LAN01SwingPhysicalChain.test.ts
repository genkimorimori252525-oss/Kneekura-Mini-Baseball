import { expect, it } from 'vitest';
import { prepareBattedWorldScheduledFieldAcquisition } from '../../core/sim/ball/BattedWorldScheduledFieldAcquisition';
import { evaluateBallWorldTagUpCompliance } from '../../core/rules/BallWorldTagUpCompliance';
import { dispatchCalibrationValues } from './SamePlateAppearanceDispatchCalibration.test-support';
import { lan01SwingCalibration } from './LAN01SwingCalibration.test-support';
import { continueLAN01SwingPhysicalChain, lan01SwingPhysicalFixture } from './LAN01SwingPhysicalChain.test-support';

it('LSP01 original LAN swing reaches ground below the unchanged p2 glove and capture stays rejected', () => {
  const h = lan01SwingPhysicalFixture('original'), ball = h.root.response.world.flight.initialBall;
  const glove = h.first.field.motion.actors.find(a => a.playerId === 'p2' && a.primitive.role === 'glove')!.primitive;
  const peak = ball.position.y + Math.max(0, ball.velocity.y) ** 2 / (-2 * h.inputs.fieldParameters.gravityY);
  expect(glove.startCenter).toEqual({ x: -0.065, y: 0.95 + 0.49, z: 0.7 });
  expect(glove.radius).toBe(0.08);
  expect(peak).toBeCloseTo(0.979949, 5);
  expect(peak).toBeLessThan(glove.startCenter.y - glove.radius - h.inputs.fieldParameters.ballRadius);
  expect(h.first.field.motion.world).toMatchObject({ kind: 'boundary', contacts: [{ kind: 'ground' }] });
  expect(h.first.field.motion.carrierPlayerId).toBeNull();
  expect(() => prepareBattedWorldScheduledFieldAcquisition({ response: h.root.response,
    geometry: h.root.geometry, field: h.first.field })).toThrow(/sole glove acquisition candidate is missing/);
});

it('LSP02 calibrated LAN swing executes both captures, linked throw and physical appeal with hold-backed fair-catch ruling', () => {
  const h = lan01SwingPhysicalFixture('calibrated'), before = structuredClone(h.inputs);
  const chain = continueLAN01SwingPhysicalChain(h);
  expect(h.first.field.motion.response.kind).toBe('capture_candidate');
  expect(chain.secured.field.motion.carrierPlayerId).toBe('p2');
  expect(chain.transfer.actionResult).toMatchObject({ kind: 'throw_checkpoint_v1', progress: { kind: 'transfer' } });
  expect(chain.released.actionResult).toMatchObject({ kind: 'throw_checkpoint_v1', progress: { kind: 'released' } });
  expect(chain.released.field.motion.carrierPlayerId).toBeNull();
  expect(chain.reception.field.motion.response.kind).toBe('capture_candidate');
  expect(chain.received.field.motion.carrierPlayerId).toBe('home-1');
  expect(chain.boundIndication).toEqual(chain.appeal.indicationReference);
  expect(chain.appeal.execution).toMatchObject({ kind: 'executed', attempt: { defenderId: 'home-1', runnerId: 'away-1', base: 1 },
    rights: { kind: 'pending', reason: 'original_live_ball_and_appeal_rights_required' } });
  if (chain.appeal.execution.kind !== 'executed') throw new Error('physical appeal missing');
  expect(evaluateBallWorldTagUpCompliance(chain.appeal.execution.complianceEvidence).kind).toBe('compliant');
  expect(chain.occupiedRunners.kind).toBe('same_pa_stationary_occupied_runners_v1');
  expect(chain.occupiedRunners.runners[0].history).toMatchObject({ contactAtStart: true, contactAtHorizon: true });
  expect(chain.fairCatch).toMatchObject({ kind: 'same_pa_fair_catch_rule_basis_v1',
    correctRuling: { outsAfter: 1, basesAfter: { first: 'away-1', second: null, third: null }, scoredRunnerIds: [] },
    physicalEnd: null, operativeCall: null });
  expect(chain.evidence.terminal).toEqual({ kind: 'pending', reason: 'reserved_live_play_end_owner_missing', physicalEnd: null });
  expect(h.fields.every(f => f.field.motion.actors.length === 55)).toBe(true);
  expect(h.inputs).toEqual(before);
});

it('LSP03 only the shared cut9 swing profile changes while original pitch, observer, motor and field inputs stay identical', () => {
  const original = lan01SwingPhysicalFixture('original'), calibrated = lan01SwingPhysicalFixture('calibrated');
  const { repertoire: originalRepertoire, ...originalInputs } = original.inputs;
  const { repertoire: calibratedRepertoire, ...calibratedInputs } = calibrated.inputs;
  expect(originalRepertoire).toEqual(dispatchCalibrationValues().batter_swing);
  expect(calibratedRepertoire).toEqual(lan01SwingCalibration().values);
  expect(lan01SwingCalibration().viewSourceId).toBe('lan01:occupied:cut9:view');
  expect(calibratedInputs).toEqual(originalInputs);
  expect(calibratedRepertoire).toEqual({ ...originalRepertoire, profiles: originalRepertoire.profiles.map(row => ({ ...row,
    profile: { ...row.profile, highAttackAngleDeg: 80, middleAttackAngleDeg: 80, lowAttackAngleDeg: 80,
      nominalContactSurfaceDistanceM: 0.0366 } })) });
  expect(original.motorDelayTicks).toBe(0);
  expect(calibrated.motorDelayTicks).toBe(0);
  expect(calibrated.inputs.bodies).toHaveLength(11);
  expect(calibrated.inputs.bodies.every(b => b.primitives.length === 5)).toBe(true);
});
