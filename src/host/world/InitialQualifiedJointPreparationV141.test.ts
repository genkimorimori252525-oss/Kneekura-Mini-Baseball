import { appendFileSync } from 'node:fs';
import { deepStrictEqual } from 'node:assert';
import { expect, it } from 'vitest';
import { createSourceFreeBallKernel } from '../../core/sim/ball/SourceFreeBallKernel';
import { createReferenceBatKinematicsV1 } from '../../core/sim/contact/ReferenceBatKinematicsV1';
import { createCoupledHeldMeasuredBatBodyControlV1 } from '../../core/sim/contact/HeldToMeasuredBatControlV1';
import type { Vec3 } from '../../core/model/geometry';
import { initialQualifiedHeadsV135 } from './InitialQualifiedPitchV135.test-support';
import { databaseCensusV139, executeInitialQualifiedJointV139, replayInitialQualifiedJointV139 } from './InitialQualifiedJointV139.test-support';

const cross = (a: Vec3, b: Vec3): Vec3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const manifest = process.env.BASEBALL_INITIAL_QUALIFIED_MANIFEST_V139;

it.skipIf(!manifest)('IQJ141-B resumes authenticated existing components to one qualified actual bat contact inside the original measured interval and replays the same Native execution without providers or head consumption', () => {
  const start = Date.now(), stage = (name: string) => {
    const record = { name, elapsedMs: Date.now() - start };
    process.stdout.write('IQJ141-B-stage ' + name + ' ' + record.elapsedMs + 'ms\n');
    if (process.env.BASEBALL_GATE_ERRORS) appendFileSync(process.env.BASEBALL_GATE_ERRORS + '.IQJ141-B-stages.jsonl', JSON.stringify(record) + '\n');
  };
  if (!manifest) throw Error('explicit qualified Native manifest locator is required');
  const result = executeInitialQualifiedJointV139(manifest, stage, 'READ_EXISTING_COMPONENTS_WITH_PREPARATION_V141'), { execution } = result;
  const physical = execution.calculation.result;
  if (physical.kind !== 'bat_contact') throw Error('mandatory actual measured bat contact missing: ' + physical.kind);
  const batControl = execution.calculation.input.batterControl.bat;
  if(batControl.version!=='held_to_measured_bat_control_v141')throw Error('explicit prospective preparation required');
  expect(batControl.preparationV141.waypoints).toHaveLength(1);
  expect(batControl.preparationV141.waypoints[0].grip).toEqual({...batControl.initial.grip,y:1.45});
  expect(batControl.preparationV141.waypoints[0].orientation).toEqual(batControl.initial.orientation);
  expect(batControl.preparationV141.waypoints[0].tick).toBe(Math.floor((batControl.bridgeStartTick+batControl.measured.startTick)/2));
  const measured = batControl.measured;
  const exactTick = physical.moment.originTick + physical.moment.elapsedSeconds * 1_000_000;
  expect(exactTick).toBeGreaterThanOrEqual(measured.startTick); expect(exactTick).toBeLessThan(result.measuredEnd);
  expect(physical.contact.tick).toBeGreaterThanOrEqual(measured.startTick); expect(physical.contact.tick).toBeLessThan(result.measuredEnd);
  const coupled = createCoupledHeldMeasuredBatBodyControlV1(execution.calculation.input.batterControl);
  const actualBat = coupled.sampleContinuous(exactTick), originalBat = createReferenceBatKinematicsV1(measured).sampleContinuous(exactTick);
  expect(actualBat.phase).toBe('measured'); deepStrictEqual(actualBat.state, originalBat.state);
  expect(physical.contact.normalImpulseNs).toBeGreaterThan(0);
  const canonical = execution.timeline.events.filter(e => e.kind === 'BatBallContact');
  expect(canonical).toHaveLength(1);
  deepStrictEqual(canonical[0].payload.contact.exitSpin, physical.contact.exitSpin);
  deepStrictEqual(canonical[0].payload.contact.exitVelocity, physical.contact.exitVelocity);
  const incoming = createSourceFreeBallKernel(execution.calculation.input.pitch.descriptor).evaluateAt(physical.moment.elapsedSeconds, 'incoming').moment.ball;
  deepStrictEqual(incoming, physical.moment.ball);
  const ball = execution.calculation.input.ball, lever = { x: -physical.contact.normal.x * ball.radiusM,
    y: -physical.contact.normal.y * ball.radiusM, z: -physical.contact.normal.z * ball.radiusM };
  const torque = cross(lever, physical.contact.totalImpulseNs), inertia = ball.massKg * ball.rotationalInertiaFactor * ball.radiusM ** 2;
  for (const axis of ['x', 'y', 'z'] as const) {
    expect(physical.contact.exitVelocity[axis]).toBeCloseTo(incoming.velocity[axis] + physical.contact.totalImpulseNs[axis] / ball.massKg, 9);
    expect(physical.contact.exitSpin[axis]).toBeCloseTo(incoming.spin[axis] + torque[axis] / inertia, 8);
  }
  expect(execution.stop.postImpactBatControlRequiresSuccessor).toBe(true);
  const before = databaseCensusV139(result.prefix.path);
  stage('provider-free-joint-reopen-start');
  // executeInitialQualifiedJointV139 has closed every author/writer facade.
  const restored = replayInitialQualifiedJointV139(result.prefix.path, result.executionReference);
  deepStrictEqual(restored, execution);
  deepStrictEqual(databaseCensusV139(result.prefix.path), before);
  expect(initialQualifiedHeadsV135(result.prefix.path)).toBe(result.beforeHeads);
  stage('provider-free-joint-reopen-ready');
}, 120_000);
