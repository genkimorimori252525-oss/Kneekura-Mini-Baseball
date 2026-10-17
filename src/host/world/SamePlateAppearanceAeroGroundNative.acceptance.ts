import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { NPB_2026_RULE_PROFILE } from '../../core/rules/RuleProfile';
import { REFERENCE_BASEBALL_AERODYNAMICS, REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS } from '../../core/sim/ball/BaseballAerodynamics';
import { createSourceFreeBallKernel } from '../../core/sim/ball/SourceFreeBallKernel';
import { samePaPhysicalLifecycleFixture } from './SamePlateAppearancePhysicalLifecycleFixture.test-support';
import { dispatchCalibrationValues } from './SamePlateAppearanceDispatchCalibration.test-support';
import { prepareInFlightBattingSwing } from './InFlightBattingLifecycleFixture.test-support';
import { prepareFreshPhysicalFieldFixture } from './SamePlateAppearancePhysicalFieldFixture.test-support';
import { openSqliteSamePlateAppearancePhysicalEpisodeStore } from './SqliteSamePlateAppearancePhysicalEpisodeStore';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

// Deliberately opt-in: genuine SamePA batting preparation is expensive. This
// case grants no nine-body execution, custody, official result or scoring proof.
it('AGPA01 original Native rigid contact admits explicit Aero/ground free field root and step and independently reopens', () => {
  const raw = process.env.MINI_BASEBALL_SAMEPA_AERO_EVIDENCE_DIR;
  if (!raw) throw new Error('opt-in requires a new workspace work/ evidence directory');
  const directory = resolve(raw), work = resolve('../'), inside = relative(work, directory);
  if (!inside || inside.startsWith('..') || isAbsolute(inside) || existsSync(directory)) throw new Error('opt-in evidence directory must be new and inside workspace work/');
  mkdirSync(directory);
  if (process.env.BASEBALL_NATIVE_DATABASE_DIRECTORY) throw new Error('opt-in requires its own new Native database directory');
  process.env.BASEBALL_NATIVE_DATABASE_DIRECTORY = directory;
  const started = Date.now(), Native = (createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync;
  const sha = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex');
  let h: ReturnType<typeof samePaPhysicalLifecycleFixture> | undefined, ordinal = 0;
  const stage = (name: string, closedSnapshot = false) => {
    if (h) writeFileSync(join(directory, 'accepted-sources.json'), JSON.stringify([...h.accepted], null, 2));
    let snapshot: string | null = null;
    if (h && closedSnapshot) {
      snapshot = join(directory, String(++ordinal).padStart(2, '0') + '-boundary.sqlite');
      const db = new Native(h.f.path, { readOnly: true });
      try { db.prepare('VACUUM INTO ?').run(snapshot); } finally { db.close(); }
    }
    appendFileSync(join(directory, 'stages.jsonl'), JSON.stringify({ name, at: Date.now(), elapsedMilliseconds: Date.now()-started,
      snapshot, snapshotSha256: snapshot ? sha(snapshot) : null, rss: process.memoryUsage().rss })+'\n');
  };
  stage('fixture-start');
  try {
    const declared = dispatchCalibrationValues();
    h = samePaPhysicalLifecycleFixture({ profile: { ruleProfileId: NPB_2026_RULE_PROFILE.id },
      explicitBatterObservation: { ...declared.batter_observation, calibration: { ...declared.batter_observation.calibration,
        errorParameters: { ...declared.batter_observation.calibration.errorParameters, minimumPositionErrorMeters: 0, maximumPositionErrorMeters: 0,
          minimumVelocityErrorMps: 0, maximumVelocityErrorMps: 0 } } },
      originalBaseCenters: { first: { x: 19.09, z: 19.09 }, second: { x: 0, z: 38.18 }, third: { x: -19.09, z: 19.09 } } });
    stage('fixture-ready', true);
    const originalSave = h.save, originalAdvance = h.advance;
    h.save = source => { const result = originalSave(source); stage('source-published:'+source.sourceId); return result; };
    h.advance = ref => { const value = originalAdvance(ref); stage('actual-cut:'+ref.sourceId, true); return value; };
    const before = h.current(), readyAtUs = Math.max(before.view.cut.evaluationTick, before.view.cut.bodyCut.completedAtTick);
    const prepared = h.prepareAction('aero-native:pitch3', 'observer_decision', { ...h.original.nominalPitch,
      delivery: { ...h.original.nominalPitch.delivery, readyAtUs, physics: { velocity: { x: 0, y: 3.5, z: -40 }, spin: { x: 0, y: 0, z: 0 } } } },
      { ticksPerSecond: 1_000_000, integrationStepTicks: 2_000, gravityY: -9.81, aerodynamics: REFERENCE_BASEBALL_AERODYNAMICS });
    const ballPhysics = { kind: 'aero_ground_v1' as const,
      air: { ticksPerSecond: 1_000_000, integrationStepTicks: 2_000, gravityY: -9.81, aerodynamics: REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS },
      ground: { ticksPerSecond: 1_000_000, gravityMps2: 9.81, radiusM: 0.0366, inertiaRatio: 0.378, restingVerticalSpeedMps: 0.15,
        material: { restitution: 0.4, slidingFriction: 0.25, rollingDecelerationMps2: 1, normalSpinDecayPerSecond: 0.5 } } };
    const preparations: ReturnType<typeof prepareFreshPhysicalFieldFixture>[] = [];
    const swing = prepareInFlightBattingSwing(h, prepared, 'aero-native:pitch3', owned => {
      preparations.push(prepareFreshPhysicalFieldFixture(h!, prepared, owned.posture, owned.postureReference, 'aero-native:field', { ballPhysics }));
      stage('actual-field-calibration', true);
    });
    expect(swing.resolution.contact).not.toBeNull(); stage('actual-rigid-contact', true);
    expect(preparations).toHaveLength(1);
    const field = preparations[0].appendField(swing.resolution, swing.resolutionReference);
    const rootCurve = field.root.response.world.sourceCurve!, cursor = field.step.field.motion.cursor;
    expect(rootCurve.initial.ball).toEqual(field.root.response.world.flight.initialBall);
    expect(rootCurve.initial.originTick).toBe(swing.resolution.contact!.tick);
    expect(rootCurve.profile).toEqual(ballPhysics);
    expect(field.root.response.world.parameters.groundRestitution).not.toBe(ballPhysics.ground.material.restitution);
    expect(field.root.response.world.parameters.groundFriction).not.toBe(ballPhysics.ground.material.slidingFriction);
    const kernel = createSourceFreeBallKernel({ ...rootCurve, throughElapsedSeconds: 2 });
    const moment = field.step.field.motion.world.moment;
    expect(moment).toEqual(kernel.evaluateAt(moment.elapsedSeconds, field.step.field.motion.world.kind==='boundary'?'incoming':'outgoing').moment);
    if (cursor) {
      expect(cursor.sourceCurve!.initial).toEqual(rootCurve.initial);
      expect(cursor.moment).toEqual(kernel.evaluateAt(cursor.moment.elapsedSeconds, 'outgoing').moment);
    }
    stage('actual-free-field-step', true);
    const reopened = openSqliteSamePlateAppearancePhysicalEpisodeStore(h.f.path);
    try {
      expect(reopened.readOperation(field.rootReference).record).toEqual(field.root);
      expect(reopened.readOperation(field.stepReference).record).toEqual(field.step);
    } finally { reopened.close(); }
    stage('original-owner-reopen', true);
    writeFileSync(join(directory, 'receipt.json'), JSON.stringify({ status: 'PASS_ACTUAL_SAMEPA_AERO_FREE_ROOT_STEP_ORIGINAL_OWNER_REOPEN',
      rootReference: field.rootReference, stepReference: field.stepReference, rootSource: field.root.source,
      actualContact: swing.resolution.contact, actualMoment: moment, responseKind: field.step.field.motion.response.kind,
      rootHeaderHash: hash(field.root.response.world.parameters), elapsedMilliseconds: Date.now()-started,
      actorPrimitives: field.root.field.motion.actors.length, authorityMapSha256: sha(join(directory, 'accepted-sources.json')),
      teamExecutionCredit: 0, custodyConnected: false, officialResult: null, scoringResult: null }, null, 2));
  } finally {
    h?.f.close(); delete process.env.BASEBALL_NATIVE_DATABASE_DIRECTORY;
  }
}, 600_000);
