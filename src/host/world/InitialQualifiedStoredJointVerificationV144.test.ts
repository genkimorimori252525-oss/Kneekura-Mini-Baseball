import { appendFileSync } from 'node:fs';
import {createRequire} from 'node:module';
import { deepStrictEqual } from 'node:assert';
import { expect, it } from 'vitest';
import { createSourceFreeBallKernel } from '../../core/sim/ball/SourceFreeBallKernel';
import { createReferenceBatKinematicsV1 } from '../../core/sim/contact/ReferenceBatKinematicsV1';
import { createCoupledHeldMeasuredBatBodyControlV1 } from '../../core/sim/contact/HeldToMeasuredBatControlV1';
import type { Vec3 } from '../../core/model/geometry';
import { initialQualifiedHeadsV135,readInitialQualifiedDecisionV135 } from './InitialQualifiedPitchV135.test-support';
import { databaseCensusV139, replayInitialQualifiedJointV139 } from './InitialQualifiedJointV139.test-support';

import {openSqliteInitialJointPhysicalExecutionStore,type InitialJointPhysicalExecutionSource} from './SqliteInitialJointPhysicalExecutionStore';
import {initialJointRightTable,initialJointExecutionTable} from './InitialJointPhysicalExecutionMetadata';
import {samePaExecutionReference as reference} from './SamePlateAppearanceExecutionFromSqlite';
import {readInitialOwnedJointControlPreparation} from './InitialOwnedJointControlPreparationFromSqlite';

const cross = (a: Vec3, b: Vec3): Vec3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const manifest = process.env.BASEBALL_INITIAL_QUALIFIED_MANIFEST_V139;
const Native=(createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync;

it.skipIf(!manifest)('IQJ144-B retries the accepted original qualified execution and verifies actual bat contact inside the original measured interval and replays the same Native execution without providers or head consumption', () => {
  const start = Date.now(), stage = (name: string) => {
    const record = { name, elapsedMs: Date.now() - start };
    process.stdout.write('IQJ144-B-stage ' + name + ' ' + record.elapsedMs + 'ms\n');
    if (process.env.BASEBALL_GATE_ERRORS) appendFileSync(process.env.BASEBALL_GATE_ERRORS + '.IQJ144-B-stages.jsonl', JSON.stringify(record) + '\n');
  };
  if (!manifest) throw Error('explicit qualified Native manifest locator is required');
  const {prefix,decision}=readInitialQualifiedDecisionV135(manifest),{path}=prefix;
  if(decision.calculation.algorithm!=='batting-spin-execution-calculation-v123')throw Error('original qualified v123 decision required');
  expect(decision.calculation.status).toBe('READY');expect(decision.calculation.commitment?.action).toBe('SWING');
  expect(decision.calculation.spinMotorPlanV123?.selectedIntent).toBe('BACKSPIN');
  expect(decision.calculation.spinMotorPlanV123?.fallbackReason).toBe(null);
  // Existence is only a no-repair precondition. The regular Owner below must
  // still authenticate every dependency, row, pin and physical result.
  const locator=new Native(path,{readOnly:true});
  try{if(!locator.prepare('SELECT source_id FROM main.'+initialJointExecutionTable+' WHERE source_id=?').get('iqj141:execution'))
    throw Error('original accepted execution required; a new admission is forbidden');}finally{locator.close();}
  const originalDatabase=databaseCensusV139(path),beforeHeads=initialQualifiedHeadsV135(path);
  const sources=new Map<string,InitialJointPhysicalExecutionSource>();
  const owner=openSqliteInitialJointPhysicalExecutionStore(path,{readAcceptedSource:id=>sources.get(id)??null});
  const result=(()=>{
    try{
      stage('original-right-owner-read-start');
      const right=owner.readRight('iqj141:right');if(!right)throw Error('original right required; no repair');
      expect(right.source.sourceVersion).toBe('explicit-synthetic-qualified-initial-joint-preparation-v141');
      expect(right.source.calculation.controls.batter.decisionReference).toEqual(prefix.decisionReference);
      expect(right.source.calculation.controls.batter.initialBatReference).toEqual(prefix.initialBatReference);
      expect(right.launchReference).toEqual(prefix.launchReference);
      const source:InitialJointPhysicalExecutionSource={sourceId:'iqj141:execution',
        sourceVersion:'explicit-synthetic-qualified-initial-joint-preparation-v141',capability:'initial_joint_physical_execution_v1',
        rightReference:reference(initialJointRightTable,right)};
      sources.set(source.sourceId,source);stage('original-execution-retry-start');
      const execution=owner.accept(source.sourceId);
      if(execution.kind!=='initial_joint_physical_execution_v1')throw Error('original accepted execution required');
      expect(execution.source).toEqual(source);stage('original-execution-retry-ready');
      const duplicate={...source,sourceId:'iqj144:duplicate-execution'};sources.set(duplicate.sourceId,duplicate);
      expect(()=>owner.accept(duplicate.sourceId)).toThrow(/executed joint physical work/);
      expect(()=>readInitialOwnedJointControlPreparation(path,right.source.calculation.controls)).toThrow(/executed joint physical work/);
      expect(databaseCensusV139(path)).toEqual(originalDatabase);expect(initialQualifiedHeadsV135(path)).toBe(beforeHeads);
      stage('duplicate-and-current-control-refused');
      const m=execution.calculation.input.batterControl.bat.measured;
      return {execution,executionReference:reference(initialJointExecutionTable,execution),prefix:{path},beforeHeads,
        measuredEnd:m.startTick+(m.frames.at(-1)!.tick-m.frames[0].tick)/m.sourceTicksPerSecond/m.playbackRate*m.ticksPerSecond};
    }finally{owner.close();}
  })(),{execution}=result;
  const physical = execution.calculation.result;
  if (physical.kind !== 'bat_contact') throw Error('mandatory actual measured bat contact missing: ' + physical.kind);
  const batControl = execution.calculation.input.batterControl.bat;
  if(batControl.version!=='held_to_measured_bat_control_v141')throw Error('explicit prospective preparation required');
  expect(batControl.preparationV141.waypoints).toHaveLength(1);
  expect(batControl.preparationV141.waypoints[0].grip).toEqual({...batControl.initial.grip,y:1.45});
  expect(batControl.preparationV141.waypoints[0].orientation).toEqual(batControl.initial.orientation);
  expect(batControl.preparationV141.waypoints[0].tick).toBe(Math.floor((batControl.bridgeStartTick+batControl.measured.startTick)/2));
  const measured = batControl.measured;
  expect(measured).toEqual(decision.calculation.commitment?.sampledTrajectoryV1);
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
  expect(execution.motionIssued).toBe(true);expect(execution.physicalExecutionAdmitted).toBe(true);
  expect(execution.stop.nextMotionAllowed).toBe(false);expect(execution.stop.workloadTotalAdmitted).toBe(false);
  expect(execution.physicalWork.assessmentStatus).toBe('REQUIRES_NONEMPTY_WORKLOAD_SETTLEMENT');
  const before = databaseCensusV139(result.prefix.path);
  stage('provider-free-joint-reopen-start');
  // The retry Owner/provider facade has closed before this fresh q1 read.
  const restored = replayInitialQualifiedJointV139(result.prefix.path, result.executionReference);
  deepStrictEqual(restored, execution);
  deepStrictEqual(databaseCensusV139(result.prefix.path), before);
  expect(initialQualifiedHeadsV135(result.prefix.path)).toBe(result.beforeHeads);
  stage('provider-free-joint-reopen-ready');
}, 120_000);
