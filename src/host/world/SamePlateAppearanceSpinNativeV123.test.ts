import { appendFileSync,mkdirSync,writeFileSync } from 'node:fs';
import { Session } from 'node:inspector';
import { resolve } from 'node:path';
import { setImmediate as yieldNativeTestTurn } from 'node:timers/promises';
import { expect, it } from 'vitest';
import { REFERENCE_BASEBALL_AERODYNAMICS } from '../../core/sim/ball/BaseballAerodynamics';
import { calculateBattingExecution } from '../../core/world/psychology/batting/BattingCommitment';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { samePaPhysicalLifecycleFixture } from './SamePlateAppearancePhysicalLifecycleFixture.test-support';
import { prepareInFlightBattingSwing } from './InFlightBattingLifecycleFixture.test-support';
import { dispatchCalibrationValues } from './SamePlateAppearanceDispatchCalibration.test-support';
import { openSqliteSamePlateAppearancePhysicalEpisodeStore } from './SqliteSamePlateAppearancePhysicalEpisodeStore';
import type { SamePaPhysicalCommitmentSource } from './SamePlateAppearancePhysicalEpisode';
import { startNativeActorCpuV127 } from './NativeActorCpuV127.test-support';
import { witnessSqliteWrite } from './SqliteWriteWitness.test-support';

// Keep the normal 180s observation budget. An explicit larger functional run
// may finish the many real owner transactions without claiming a speed PASS.
const functionalBudgetMs = process.env.BASEBALL_NATIVE_FUNCTIONAL_BUDGET_MS === undefined ? 180_000
  : Number(process.env.BASEBALL_NATIVE_FUNCTIONAL_BUDGET_MS);
if (!Number.isSafeInteger(functionalBudgetMs) || functionalBudgetMs < 180_000 || functionalBudgetMs > 1_200_000)
  throw new Error('invalid Native spin functional test budget');

/** A real Native actor/input/physical owner chain, ending at contact. No field
 * or scoring fixture is prepared. This does not prove genuine skill adoption;
 * that needs accepted practice in this same career/player/calendar. */
it('SPN03 Native NO_SPIN_TARGET retains v1 motor/contact, exact adoption and offline replay', async () => {
  console.info('SPN03_TEST_BUDGET', JSON.stringify({ milliseconds: functionalBudgetMs,
    purpose: functionalBudgetMs === 180_000 ? 'NORMAL_OBSERVATION' : 'FUNCTIONAL_COMPLETION_NOT_PERFORMANCE_PASS' }));
  // Flush the runner's start acknowledgement before long synchronous owners.
  // These yields occur outside every Native transaction, not on a sim clock.
  await yieldNativeTestTurn();
  // Optional diagnostic only: write each COMPLETED stage before an external
  // timeout can interrupt the next synchronous Native proof. No simulation
  // clock, owner check or accepted Source is replaced by profiling data.
  const profileFolder=process.env.BASEBALL_CPU_STAGE_PROFILES,profiler=profileFolder?new Session():null;
  let profileIndex=0,previousStage='start',stopDiagnostic=()=>{};
  if(profiler){mkdirSync(profileFolder!,{recursive:true});profiler.connect();profiler.post('Profiler.enable');}
  const stage = (name: string) => {
    const diagnostic=startNativeActorCpuV127(name);if(diagnostic)stopDiagnostic=diagnostic;
    if(profiler){if(profileIndex){profiler.post('Profiler.stop',(error,result)=>{
      if(error)throw error;writeFileSync(resolve(profileFolder!,String(profileIndex).padStart(2,'0')+'-'+previousStage+'-to-'+name+'.cpuprofile'),JSON.stringify(result.profile),{flag:'wx'});
    });}previousStage=name;profileIndex++;profiler.post('Profiler.start');}
    if (process.env.BASEBALL_GATE_ERRORS) appendFileSync(process.env.BASEBALL_GATE_ERRORS + '.SPN03-stages.jsonl', JSON.stringify({ name, at: Date.now() }) + '\n');
  };
  stage('fixture-start');
  const sensor = dispatchCalibrationValues().batter_observation;
  const h = samePaPhysicalLifecycleFixture({ onFixtureStage: stage, explicitBatterObservation: { ...sensor, calibration: { ...sensor.calibration,
    errorParameters: { ...sensor.calibration.errorParameters, minimumPositionErrorMeters: 0, maximumPositionErrorMeters: 0,
      minimumVelocityErrorMps: 0, maximumVelocityErrorMps: 0 } } } }), { f } = h;
  try {
    stage('fixture-ready');
    await yieldNativeTestTurn();
    const current = h.current(), readyAtUs = Math.max(current.view.cut.evaluationTick, current.view.cut.bodyCut.completedAtTick);
    const action = h.prepareAction('spin-native:pitch3', 'observer_decision', { ...h.original.nominalPitch,
      delivery: { ...h.original.nominalPitch.delivery, readyAtUs, physics: { velocity: { x: 0, y: 3.5, z: -40 }, spin: { x: 0, y: 0, z: 0 } } } },
      { ticksPerSecond: 1_000_000, integrationStepTicks: 2_000, gravityY: -9.81, aerodynamics: REFERENCE_BASEBALL_AERODYNAMICS });
    stage('action-ready');
    await yieldNativeTestTurn();
    const s = prepareInFlightBattingSwing(h, action, 'spin-native:pitch3', undefined, { onStage: stage, prepareCommitment(source, input) {
      stage('input-ready');
      const { buntProfileBinding: _buntProfileBinding, ...ordinarySource } = source;
      const v123: SamePaPhysicalCommitmentSource = { ...ordinarySource, capability: 'same_pa_physical_commitment_v123', spinBindingV123: {
        kind: 'fixed_native_spin_binding_v123', modelReference: action.action.source.batterModelReference,
        intent: { technique: 'NO_SPIN_TARGET', selectedAtTick: input.nominalRequest.currentFrame.time.tick }, qualificationReferences: [] } };
      const before = f.db.prepare('SELECT * FROM pa_physical_v1_heads').all(), world = h.worldOwner.readHead(f.actor.binding.careerId);
      const invalid = [
        { ...v123, sourceId: 'spin-native:future', spinBindingV123: { ...v123.spinBindingV123,
          intent: { technique: 'SLICE' as const, selectedAtTick: input.nominalRequest.currentFrame.time.tick + 1 } } },
        { ...v123, sourceId: 'spin-native:wrong-model', spinBindingV123: { ...v123.spinBindingV123,
          modelReference: { ...v123.spinBindingV123.modelReference, snapshotHash: hash('foreign-model') } } },
        { ...v123, sourceId: 'spin-native:missing-skill', spinBindingV123: { ...v123.spinBindingV123,
          qualificationReferences: [{ owner: 'world_spin_mastery_v123' as const, sourceId: 'missing', sourceHash: hash('missing'), snapshotHash: hash('missing') }] } },
      ];
      for (const rejected of invalid) {
        h.save(rejected); expect(() => h.physical.acceptOperation(rejected.sourceId)).toThrow();
        expect(f.db.prepare('SELECT 1 FROM pa_physical_v1_commitments WHERE source_id=?').get(rejected.sourceId)).toBeUndefined();
        expect(f.db.prepare('SELECT * FROM pa_physical_v1_heads').all()).toEqual(before);
        expect(h.worldOwner.readHead(f.actor.binding.careerId)).toEqual(world);
      }
      stage('rejections-ready');
      const interrupted = h.save({ ...v123, sourceId: 'spin-native:interrupted' });
      let interruptedAtEvent = false;
      const interruption = witnessSqliteWrite('INSERT INTO main.world_decision_revision_events VALUES(?,?,?,?,?)', db => {
        const event = db.prepare('SELECT source_kind FROM main.world_decision_revision_events WHERE career_id=? AND source_event_id=?')
          .get(f.actor.binding.careerId, interrupted.sourceId);
        if (!event) return false;
        if (event.source_kind !== 'SAME_PA_EFFECTIVE_BATTING_COMMITMENT_V1') throw new Error('spin interruption reached a different World event');
        interruptedAtEvent = true;
        throw new Error('spin adoption interrupted');
      });
      try { expect(() => h.physical.acceptOperation(interrupted.sourceId)).toThrow(/spin adoption interrupted/); }
      finally { interruption.close(); }
      expect(interruptedAtEvent).toBe(true);
      expect(f.db.prepare('SELECT * FROM pa_physical_v1_heads').all()).toEqual(before);
      expect(h.worldOwner.readHead(f.actor.binding.careerId)).toEqual(world);
      expect(f.db.prepare('SELECT 1 FROM pa_physical_v1_commitments WHERE source_id=?').get(interrupted.sourceId)).toBeUndefined();
      stage('rollback-ready');
      return v123;
    } });
    stage('contact-ready');
    const ordinary = calculateBattingExecution({ nominalRequest: s.input.nominalRequest, effectiveValues: s.input.effectiveValues });
    expect(ordinary.ok).toBe(true);
    if (!ordinary.ok) throw Error('existing calculation failed');
    expect(s.commitment.calculation.algorithm).toBe('batting-spin-execution-calculation-v123');
    expect(s.commitment.commitment).toEqual(ordinary.value.commitment);
    expect(s.commitment.calculation.nominalRequest).toEqual(s.input.nominalRequest);
    expect(s.commitment.calculation.effectiveValues).toEqual(s.input.effectiveValues);
    expect(s.resolution.contact).not.toBeNull();
    expect(s.resolution.timeline.events.filter(e => e.kind === 'BatBallContact')).toHaveLength(1);
    expect(s.commitment.afterWorldRevision).toBe(s.preparedWorldRevision + 1);
    expect(f.db.prepare('SELECT count(*) n FROM pa_physical_v1_commitments').get()!.n).toBe(1);
    const archived = f.db.prepare('SELECT * FROM pa_physical_v1_commitments').all();
    const reopened = f.x.f.track(openSqliteSamePlateAppearancePhysicalEpisodeStore(f.path));
    expect(reopened.acceptOperation(s.commitment.source.sourceId)).toEqual(s.commitment);
    expect(reopened.readOperation(reference('pa_physical_v1_resolutions', s.resolution)).record).toEqual(s.resolution);
    expect(f.db.prepare('SELECT * FROM pa_physical_v1_commitments').all()).toEqual(archived);
    expect(h.worldOwner.readHead(f.actor.binding.careerId)!.worldRevision).toBe(s.commitment.afterWorldRevision);
    stage('offline-replay-ready');
  } finally { h.close();stopDiagnostic();if(profiler){stage('fixture-end');profiler.post('Profiler.stop');profiler.disconnect();} }
}, functionalBudgetMs);
