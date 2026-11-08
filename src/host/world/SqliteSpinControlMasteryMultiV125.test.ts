import { createRequire } from 'node:module';
import { appendFileSync } from 'node:fs';
import { afterEach, expect, it } from 'vitest';
import { spinMasteryMultiFixtureV125 } from './SpinMasteryMultiV125.test-support';
import { openSqliteSpinControlMasteryV123 } from './SqliteSpinControlMasteryV123';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { fixture, value } from '../../core/world/psychology/batting/BattingFixtures.test-support';
import { calculateObservedSpinMotorPlanV123 } from '../../core/world/psychology/batting/SpinMotorPlanV123';
import {startSpinExposureCpuV126} from './SpinExposureCpuV126.test-support';

const cleanup: (() => void)[] = [];
afterEach(() => { while (cleanup.length) cleanup.pop()!(); });

it('SM125-01 two independently practiced Native techniques yield one Gold without granting unlearned techniques, survive reverse admission and offline replay', async () => {
  let stopDiagnostic=()=>{};cleanup.push(()=>stopDiagnostic());
  const stage = (name: string) => {
    if (process.env.BASEBALL_GATE_ERRORS) appendFileSync(process.env.BASEBALL_GATE_ERRORS + '.SM125-stages.jsonl', JSON.stringify({ name, at: Date.now() }) + '\n');
    if(name==='top-contact-settled-2')stopDiagnostic=startSpinExposureCpuV126();
  };
  const f = await spinMasteryMultiFixtureV125(cleanup, stage), beforeWork = f.snapshot('world_player_workload_activities');
  const owner = openSqliteSpinControlMasteryV123(f.path, f.authority); cleanup.push(owner.close);
  // Admit the later independent skill first; qualification history is not a
  // tier ladder and cannot make an earlier source depend on admission order.
  const top = owner.accept(f.top.source.sourceId);
  stage('top-qualification-ready');
  f.masterySources.set(f.back.source.sourceId, { ...f.back.source, sourceEffectIdentity: f.top.source.sourceEffectIdentity });
  expect(() => owner.accept(f.back.source.sourceId)).toThrow(/aliases/);
  expect(owner.read(f.back.source.sourceId)).toBeNull();
  f.masterySources.set(f.back.source.sourceId, { ...f.back.source, calibrationRef: f.top.source.calibrationRef });
  expect(() => owner.accept(f.back.source.sourceId)).toThrow(/another technique/);
  f.masterySources.set(f.back.source.sourceId, f.back.source);
  const back = owner.accept(f.back.source.sourceId);
  stage('back-qualification-ready');
  expect(top.projection.qualified[0].episodeId).not.toBe(back.projection.qualified[0].episodeId);
  expect(new Set([...top.contacts, ...back.contacts].map(c => c.eventId)).size).toBe(6);
  expect(top.calibration.sourceId).not.toBe(back.calibration.sourceId);
  expect(owner.selectAtDay('career-a', 'p1', 16).effectiveStateId).toBe('NONE');
  expect(owner.selectAtDay('career-a', 'p1', 17)).toMatchObject({ effectiveStateId: 'BLUE_BACKSPIN', masteredTechniqueSet: ['BACKSPIN'] });
  const inventory = owner.selectAtDay('career-a', 'p1', 57);
  expect(inventory).toMatchObject({ effectiveStateId: 'GOLD', masteredTechniqueSet: ['BACKSPIN', 'TOPSPIN'], rejected: [] });
  expect(inventory.qualified).toHaveLength(2); expect(inventory.motorQualifications).toHaveLength(2);
  expect(inventory.motorQualifications.map(q => q.technique)).toEqual(['BACKSPIN', 'TOPSPIN']);
  expect(f.count('world_spin_mastery_v123')).toBe(2);
  stage('single-gold-inventory-ready');
  // Native inventory supplies the qualifications; pure Core still falls back
  // for a third technique. This is not Native match adoption evidence.
  const r = fixture(), s = r.source, prediction = s.predictions[1];
  const result = value(calculateObservedSpinMotorPlanV123({ atDay: 57, repertoireSourceRef: f.back.source.repertoireRef,
    intent: { technique: 'SLICE', selectedAtTick: r.currentFrame.time.tick }, techniques: inventory.motorQualifications,
    base: { decisionTick: r.currentFrame.time.tick, aggression: 0.8,
      geometry: { handedness: s.handedness, centerOfMass: s.centerOfMass, batPhysical: s.batPhysical, plateZ: s.plateZ,
        strikeZone: s.strikeZone, bodyReadyTick: s.bodyReadyTick, latestMotorStartTick: s.latestMotorStartTick },
      motor: f.batting.capability.values,
      repertoire: f.batting.repertoire.values,
      forecast: { observedTick: prediction.observedTick, availableTick: prediction.availableTick, validUntilTick: prediction.validUntilTick, trajectory: prediction.trajectory } } }));
  expect(result).toMatchObject({ selectedIntent: 'NO_SPIN_TARGET', fallbackReason: 'UNMASTERED_TECHNIQUE' });
  expect(owner.accept(f.back.source.sourceId)).toEqual(back);
  expect(f.snapshot('world_player_workload_activities')).toBe(beforeWork);
  f.closeAllOriginalOwners();
  const offline = openSqliteSpinControlMasteryV123(f.path); cleanup.push(offline.close);
  expect(offline.selectAtDay('career-a', 'p1', 57)).toEqual(inventory);
  stage('offline-gold-inventory-ready');
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'), db = new DatabaseSync(f.path); cleanup.push(() => db.close());
  expect(db.prepare('SELECT count(*) n FROM world_spin_mastery_v123').get()!.n).toBe(2);
  db.prepare('UPDATE world_spin_mastery_v123 SET snapshot_hash=? WHERE source_id=?').run(hash('corrupt-top'), f.top.source.sourceId);
  expect(offline.selectAtDay('career-a', 'p1', 57)).toMatchObject({ effectiveStateId: 'BLUE_BACKSPIN', masteredTechniqueSet: ['BACKSPIN'],
    rejected: [{ sourceId: f.top.source.sourceId, technique: 'TOPSPIN', reason: 'ORIGINAL_SOURCE_INVALID' }] });
  stage('corrupt-top-preserves-backspin');
  db.prepare('UPDATE world_spin_mastery_v123 SET snapshot_hash=? WHERE source_id=?').run(hash(top), f.top.source.sourceId);
  db.prepare('UPDATE development_practice_exposures SET snapshot_hash=? WHERE source_id=?')
    .run(hash('corrupt-top-original-exposure'), f.top.source.exposureRef.sourceId);
  expect(offline.selectAtDay('career-a', 'p1', 57)).toMatchObject({ effectiveStateId: 'BLUE_BACKSPIN', masteredTechniqueSet: ['BACKSPIN'],
    rejected: [{ sourceId: f.top.source.sourceId, technique: 'TOPSPIN', reason: 'ORIGINAL_SOURCE_INVALID' }] });
  stage('corrupt-native-exposure-preserves-backspin');
}, 90_000);
