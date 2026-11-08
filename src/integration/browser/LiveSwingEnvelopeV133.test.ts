import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import type { ReferenceBatEnvelopeV133 } from '../../core/sim/contact/ReferenceBatEnvelopeV133';
import { referenceWorldTickAtSourceV121 } from '../../core/sim/contact/ReferenceBatMotorV121';
import { registerMeasuredBatToFieldV1 } from './MeasuredBatFieldRegistrationV1';
import { createLiveBatPlaybackV88 } from './LiveBatPlaybackV88';
import { applyLivePhysicalRosterV1 } from './LivePhysicalRosterV1';
import { LIVE_MATCH_PHYSICS_V1 } from './LiveBaseballMatchV1';
import { simulateLivePitchV1, type LiveMeasuredClipV1, type LivePitchInputV1 } from './LivePitchV1';
import type { SwingExecutionV122 } from './LiveSwingExecutionV122';
import { selectLiveSwingEnvelopeRateV133 } from './LiveSwingEnvelopeV133';
import { createReferenceBatKinematicsV1 } from '../../core/sim/contact/ReferenceBatKinematicsV1';
import { resolveLiveBattingSetupV94 } from '../../core/sim/pitching/BattingSetupV94';

const clips = JSON.parse(readFileSync(new URL('../../../docs/demos/measured-bat-motions.json', import.meta.url), 'utf8')).clips as LiveMeasuredClipV1[];
const clip = clips.find(c => c.side === 'R')!, frames = registerMeasuredBatToFieldV1(clip.frames);
const limits: SwingExecutionV122 = { version: 'swing_execution_v122', sourceId: 'explicit-test-limits', interpolation: 'cubic-c1',
  maximumGripAccelerationMps2: 1e7, maximumAngularAccelerationRadPerSecond2: 1e7, maximumSweetSpotAccelerationMps2: 1e7, maximumCorrectionMeters: 1 };
const envelope = (): ReferenceBatEnvelopeV133 => ({ version: 'reference_bat_envelope_v133', sourceId: 'explicit-test-boundary-poses',
  preparation: { durationSeconds: .2, grip: { ...frames[0].grip }, orientation: { ...frames[0].orientation } },
  recovery: { durationSeconds: .25, grip: { ...frames.at(-1)!.grip }, orientation: { ...frames.at(-1)!.orientation } } });
type Input = LivePitchInputV1 & { batter: LivePitchInputV1['batter'] & { swingEnvelopeV133?: ReferenceBatEnvelopeV133 } };
const input = (): Input => ({ originTick: 0, seed: 1,
  batter: { heightMeters: 1.98, bats: 'R', batLengthM: .84, batMassKg: .88, swingRate: 1, timingStdSeconds: 0, aimStdMeters: 0,
    chaseMarginMeters: .2, clipId: clip.id, maximumSweetSpotSpeedMps: 90, motorLatencySeconds: .03,
    swingDecision: { approach: 'SWING', threshold: 0, aggressionWeight: 1 }, swingExecutionV122: limits, swingEnvelopeV133: envelope() },
  pitcher: { releaseSpeedMps: 42, spinRadPerSecond: { x: 230, y: 0, z: 0 }, commandStdMeters: 0 },
  measuredClips: [clip], batting: 'balanced', pitchType: 'fastball', location: 'zone', physics: LIVE_MATCH_PHYSICS_V1 });

it('keeps the authored pre-observation hold independent of current-ball location and the future AUTO swing/take result', () => {
  const source = input(), batter = { ...source.batter, chaseMarginMeters: 0,
    swingDecision: { approach: 'AUTO' as const, threshold: 0, aggressionWeight: 1 } };
  const swing = simulateLivePitchV1({ ...source, batter, location: 'zone' });
  const take = simulateLivePitchV1({ ...source, batter, location: 'outside' });
  expect(swing.diagnostics.swingOffered).toBe(true);
  expect(take.diagnostics.swingOffered).toBe(false);
  const through = Math.min(swing.diagnostics.predictionMadeAtElapsedSeconds, take.diagnostics.predictionMadeAtElapsedSeconds) * 1e6;
  for (const tick of [0, through / 2, Math.max(0, through - 1)]) {
    expect(swing.sampleBatAtTick(tick)).toEqual(take.sampleBatAtTick(tick));
    expect(swing.sampleBatAtTick(tick)).toEqual(swing.sampleBatAtTick(0));
  }
});

it('resolves only the known box stance offset once and returns independent held observations', () => {
  const source = input(), batter = { ...source.batter, battingSetupV94: { boxPosition: 'front' as const } },
    expectedZ = envelope().preparation.grip.z * (batter.heightMeters / 1.8) + resolveLiveBattingSetupV94(batter).stanceOffsetZ;
  const take = simulateLivePitchV1({ ...source, batter, batting: 'take' });
  const pose = take.sampleBatAtTick(0)!;
  expect(pose.grip.z).toBe(expectedZ);
  (pose.grip as { z: number }).z = 999;
  expect(take.sampleBatAtTick(0)!.grip.z).toBe(expectedZ);
  const swing = simulateLivePitchV1({ ...source, batter });
  expect(swing.diagnostics.batPlaybackV88!.reference.executionEnvelopeV133!.preparation.grip.z).toBe(expectedZ);
  expect(swing.sampleBatAtTick(0)).toEqual(take.sampleBatAtTick(0));
  const replay = createLiveBatPlaybackV88({ descriptor: swing.diagnostics.batPlaybackV88!, measuredClip: clip });
  expect(replay.sampleAtTick(0)).toEqual(swing.sampleBatAtTick(0));
});

it('accepts a selected window after a synthetic fast angular prefix (the provisional bridge rejection was not reproduced here)', () => {
  const q = { x: 0, y: 0, z: 0, w: 1 }, quarter = { x: 0, y: 0, z: 1, w: 0 };
  // Synthetic browser-unit fixture only; no library file or Native provenance
  // is changed/admitted by this test.
  const synthetic = { ...clip, id: 'obp-synthetic-provisional-bridge-counterexample', contactTimeSeconds: .3,
    frames: [{ tick: 0, grip: { x: 0, y: 1, z: 0 }, orientation: q },
      { tick: 1, grip: { x: 0, y: 1, z: 0 }, orientation: quarter },
      ...[100000, 200000, 300000, 400000, 500000].map(tick => ({ tick, grip: { x: tick / 1e6, y: 1, z: 0 }, orientation: quarter }))] };
  const boundary = { version: 'reference_bat_envelope_v133' as const, sourceId: 'synthetic-world-hold',
    preparation: { durationSeconds: 10, grip: { x: 0, y: 1, z: 0 }, orientation: quarter },
    recovery: { durationSeconds: 1, grip: { x: .5, y: 1, z: 0 }, orientation: quarter } };
  const source = input();
  const result = simulateLivePitchV1({ ...source, measuredClips: [synthetic], batter: { ...source.batter, clipId: synthetic.id,
    heightMeters: 1.8, preContactSeconds: .05, followThroughSeconds: .05, targetSweetSpotSpeedMps: 1,
    swingEnvelopeV133: boundary } });
  expect(result.diagnostics.swingEnvelopeV133?.status).toBe('APPLIED');
  expect(result.diagnostics.batPlaybackV88!.sourceFirstTick).toBeGreaterThan(1);
});

it('characterizes the pre-existing full-clip clock limit separately from certification of a selected envelope window', () => {
  const q = { x: 0, y: 0, z: 0, w: 1 }, source = input();
  const synthetic = { ...clip, id: 'obp-synthetic-discarded-prefix', contactTimeSeconds: .3,
    frames: [{ tick: 0, grip: { x: 10000, y: 1, z: 0 }, orientation: q },
      ...[100000, 200000, 300000, 400000, 500000].map(tick => ({ tick, grip: { x: tick / 1e6, y: 1, z: 0 }, orientation: q }))] };
  const boundary = { version: 'reference_bat_envelope_v133' as const, sourceId: 'synthetic-finite-selected-hold',
    preparation: { durationSeconds: .2, grip: { x: -.2, y: 1, z: 0 }, orientation: q },
    recovery: { durationSeconds: .25, grip: { x: -.5, y: 1, z: 0 }, orientation: q } };
  const authored: LivePitchInputV1 = { ...source, measuredClips: [synthetic], batter: { ...source.batter, clipId: synthetic.id,
    heightMeters: 1.8, preContactSeconds: .05, followThroughSeconds: .05, targetSweetSpotSpeedMps: 1,
    swingEnvelopeV133: boundary, swingPolicyV121: { version: 'swing_policy_v121', sourceId: 'explicit-test-phase-policy', effort: 1,
      compactness: 0, controlPriority: 0, effortVariation: 0, twoStrikeEffortDelta: 0, twoStrikeCompactnessDelta: 0, maximumClockAccelerationPerSecond: 100 } } };
  const result = simulateLivePitchV1(authored), { swingEnvelopeV133: _envelope, ...legacyBatter } = authored.batter;
  expect(result.diagnostics.swingOffered).toBe(false);
  expect(() => simulateLivePitchV1({ ...authored, batter: legacyBatter })).toThrow(/authored motor rate is outside this finite reference model/);
  const { swingPolicyV121: _policy, ...withoutPolicy } = authored.batter,
    selected = simulateLivePitchV1({ ...authored, batter: withoutPolicy });
  expect(selected.diagnostics.swingEnvelopeV133?.status).toBe('APPLIED');
  expect(selected.diagnostics.batPlaybackV88!.sourceFirstTick).toBeGreaterThan(100000);
});

it('executes a finite preparation only after observation/latency and replays the complete recovery without rescaling the saved poses twice', () => {
  const source = input(), before = JSON.stringify(source), result = simulateLivePitchV1(source), d = result.diagnostics,
    recipe = d.batPlaybackV88!, actual = recipe.reference.executionEnvelopeV133;
  expect(actual).toBeDefined();
  expect(actual!.preparation.grip.x).toBe(source.batter.swingEnvelopeV133!.preparation.grip.x * (source.batter.heightMeters / 1.8));
  expect(actual!.preparation.orientation).toEqual(source.batter.swingEnvelopeV133!.preparation.orientation);
  const status = (d as typeof d & { swingEnvelopeV133?: { status: string; motionStartTick: number; motionThroughTick: number } }).swingEnvelopeV133;
  expect(status?.status).toBe('APPLIED');
  expect(status!.motionStartTick).toBeGreaterThanOrEqual(source.originTick + Math.round(d.predictionMadeAtElapsedSeconds * 1e6) + 30000);
  expect(result.sampleBatAtTick(source.originTick)).toEqual(result.sampleBatAtTick(status!.motionStartTick - 1));
  const playback = createLiveBatPlaybackV88(JSON.parse(JSON.stringify({ descriptor: recipe, measuredClip: clip })));
  expect(playback.throughTick).toBe(status!.motionThroughTick);
  const measuredThrough = referenceWorldTickAtSourceV121({ ...recipe.reference, frames: frames.filter(f => f.tick >= recipe.sourceFirstTick && f.tick <= recipe.sourceLastTick) }, recipe.sourceLastTick);
  expect(playback.throughTick).toBeGreaterThan(measuredThrough);
  for (const tick of [source.originTick, status!.motionStartTick, recipe.reference.startTick,
    measuredThrough, measuredThrough + .1e6, playback.throughTick]) {
    expect(playback.sampleAtTick(tick)).toEqual(result.sampleBatAtTick(tick));
  }
  expect(result.sampleBatAtTick(playback.throughTick + 1)).toBeNull();
  expect(JSON.stringify(source)).toBe(before);
  expect(d.swingExecutionV122!.bounds.maximumSweetSpotAccelerationMps2).toBeLessThanOrEqual(limits.maximumSweetSpotAccelerationMps2);
});

it('requires explicit C1 SI limits, validates boundary Source, and clears an omitted old roster envelope instead of inheriting it', () => {
  const source = input(), players = [{ playerId: 'b', name: 'test', heightMeters: 1.98, bats: 'R' as const }];
  const { swingExecutionV122: _limits, ...withoutLimits } = source.batter;
  const roster = (physical: object) => ({ version: 'live_physical_roster_v1' as const, sourceId: 'author', entries: [{ playerId: 'b', sourceId: 'author-b', physical: { basis: 'EXPLICIT_AUTHORED_SI_V1', ...physical } }] });
  expect(() => simulateLivePitchV1({ ...source, batter: withoutLimits })).toThrow(/上限|C1|execution/);
  expect(() => applyLivePhysicalRosterV1({ players, roster: roster({ swingEnvelopeV133: envelope() }) })).toThrow();
  const accepted = applyLivePhysicalRosterV1({ players, roster: roster({ swingExecutionV122: limits, swingEnvelopeV133: envelope() }) });
  expect(accepted.players[0].physical.swingEnvelopeV133).toEqual(envelope());
  const old = applyLivePhysicalRosterV1({ players: accepted.players, roster: roster({}) });
  expect(old.players[0].physical).not.toHaveProperty('swingEnvelopeV133');
  for (const duration of [0, -1, 11]) expect(() => simulateLivePitchV1({ ...source, batter: { ...source.batter,
    swingEnvelopeV133: { ...envelope(), preparation: { ...envelope().preparation, durationSeconds: duration } } } })).toThrow();
});

it.each(['take', 'bunt'] as const)('retains a validated authored envelope without executing it for %s', batting => {
  const source = input(), { swingEnvelopeV133: _envelope, ...batter } = source.batter,
    old = simulateLivePitchV1({ ...source, batting, batter }), current = simulateLivePitchV1({ ...source, batting });
  if (batting === 'bunt') { expect(current.frames).toEqual(old.frames); expect(current.contact).toEqual(old.contact); }
  else {
    expect(current.diagnostics.swingOffered).toBe(false);
    const scale = source.batter.heightMeters / 1.8;
    expect(current.sampleBatAtTick(0)?.grip).toEqual({ x: envelope().preparation.grip.x * scale,
      y: envelope().preparation.grip.y * scale, z: envelope().preparation.grip.z * scale });
    expect(current.sampleBatAtTick(10000)).toEqual(current.sampleBatAtTick(0));
  }
  expect(current.diagnostics).not.toHaveProperty('batPlaybackV88');
  expect((current.diagnostics as typeof current.diagnostics & { swingEnvelopeV133?: { status: string } }).swingEnvelopeV133?.status).toBe('NOT_APPLIED');
});

it('certifies a middle rate when a fixed-duration 1D preparation/recovery makes both the lowest and requested rates infeasible', () => {
  const orientation = { x: 0, y: 0, z: 0, w: 1 };
  const feasible = (rate: number) => createReferenceBatKinematicsV1({ provenance: { clipId: 'synthetic-1d-counterexample', sourceSha256: '0'.repeat(64) },
    frames: [{ tick: 0, grip: { x: 0, y: 0, z: 0 }, orientation }, { tick: 1000000, grip: { x: 1, y: 0, z: 0 }, orientation }],
    batLengthM: .84, sweetSpotT: .8, sourceTicksPerSecond: 1000000, startTick: 1000000, ticksPerSecond: 1000000, playbackRate: rate,
    transform: { rotation: orientation, translation: { x: 0, y: 0, z: 0 }, scale: 1 }, executionInterpolationV122: 'cubic-c1',
    executionEnvelopeV133: { version: 'reference_bat_envelope_v133', sourceId: 'synthetic-1d-boundaries',
      preparation: { durationSeconds: 1, grip: { x: -1, y: 0, z: 0 }, orientation },
      recovery: { durationSeconds: 1, grip: { x: 2, y: 0, z: 0 }, orientation } } }).maximumGripAccelerationMps2! <= 3;
  expect(feasible(.01)).toBe(false); expect(feasible(3)).toBe(false); expect(feasible(2)).toBe(true);
  const selected = selectLiveSwingEnvelopeRateV133(3, feasible);
  expect(selected).not.toBeNull(); expect(feasible(selected!.rate)).toBe(true);
  expect(selected!.globalMaximumGuaranteed).toBe(false);
  expect(selected!.candidates.length).toBeLessThanOrEqual(26);
  expect(selectLiveSwingEnvelopeRateV133(1, () => false)).toBeNull();
});

it('reports finite-candidate failure as an authoring adjustment instead of claiming physical impossibility', () => {
  const source = input();
  const impossibleWithinTechnicalRateRange = { ...envelope(), preparation: { ...envelope().preparation, durationSeconds: .001,
    grip: { x: 100, y: 100, z: 100 } } };
  expect(() => simulateLivePitchV1({ ...source, batter: { ...source.batter, swingEnvelopeV133: impossibleWithinTechnicalRateRange,
    swingExecutionV122: { ...limits, maximumGripAccelerationMps2: 100, maximumAngularAccelerationRadPerSecond2: 100, maximumSweetSpotAccelerationMps2: 100 } } }))
    .toThrow(/時間を延ばす.*移動量.*不可能判定ではありません/);
});

it('includes delivered late-aim correction and recovery in the final certificate and in the same playback sampler', () => {
  const source = input(), r = simulateLivePitchV1({ ...source, originTick: 1000000, batter: { ...source.batter,
    plateVision: 100, maximumSweetSpotSpeedMps: 90, targetSweetSpotSpeedMps: 10,
    batterApproachV122: { version: 'batter_approach_v122', sourceId: 'wrong-test-prior', priorReliance: 1, directionCommitment: 0,
      twoStrikeCommitmentDelta: 0, preferredWhenCommitted: { pull: 1, center: 0, opposite: 0 }, targetPullAnglesDegrees: { pull: 25, center: 0, opposite: -25 } } },
    batterBeliefV122: { observerPlayerId: 'b', pitcherId: 'p', belief: { version: 'batter_belief_v122', sourceId: 'own-prior', observerPlayerId: 'b', pitcherId: 'p',
      capturedAtTick: 1000000, observedThroughTick: 800000, confidence: 1, evidenceRefs: ['own-old-test'],
      candidates: [{ familyId: 'hypothesis', regionId: 'high', probability: 1, prediction: { x: .3, y: 1.5, arrivalAfterReleaseSeconds: .5 } }] } } });
  expect(r.diagnostics.lateEvidenceV121?.applied).toBe(true);
  expect(r.diagnostics.swingEnvelopeV133?.status).toBe('APPLIED');
  expect(r.diagnostics.swingExecutionV122!.bounds.maximumSweetSpotAccelerationMps2).toBeLessThanOrEqual(limits.maximumSweetSpotAccelerationMps2);
  const playback = createLiveBatPlaybackV88({ descriptor: r.diagnostics.batPlaybackV88!, measuredClip: clip });
  for (let i = 0; i <= 31; i++) {
    const tick = 1000000 + (playback.throughTick - 1000000) * i / 31;
    expect(playback.sampleAtTick(tick)).toEqual(r.sampleBatAtTick(tick));
  }
});

it('explicitly reduces a late correction when a short recovery exceeds the full envelope certificate', () => {
  const source = input(), boundary = { ...envelope(), recovery: { ...envelope().recovery, durationSeconds: .05 } };
  const prior = { version: 'batter_approach_v122' as const, sourceId: 'wrong-short-recovery-prior', priorReliance: 1, directionCommitment: 0,
    twoStrikeCommitmentDelta: 0, preferredWhenCommitted: { pull: 1, center: 0, opposite: 0 }, targetPullAnglesDegrees: { pull: 25, center: 0, opposite: -25 } };
  const belief = { observerPlayerId: 'b', pitcherId: 'p', belief: { version: 'batter_belief_v122' as const, sourceId: 'own-short-recovery-prior', observerPlayerId: 'b', pitcherId: 'p',
    capturedAtTick: 1000000, observedThroughTick: 800000, confidence: 1, evidenceRefs: ['own-old-test'],
    candidates: [{ familyId: 'hypothesis', regionId: 'high', probability: 1, prediction: { x: .3, y: 1.5, arrivalAfterReleaseSeconds: .5 } }] } };
  const baselineInput = { ...source, originTick: 1000000, batterBeliefV122: belief,
    batter: { ...source.batter, swingEnvelopeV133: boundary, targetSweetSpotSpeedMps: 10, batterApproachV122: prior } };
  // Explicit synthetic fixture: place the saved recovery hold at the already
  // composed, uncorrected terminal pose. A correction then has to return to
  // this fixed world hold rather than moving the hold with its aim transform.
  const preliminary = simulateLivePitchV1(baselineInput), recipe = preliminary.diagnostics.batPlaybackV88!, scale = recipe.heightScale;
  const selected = frames.filter(f => f.tick >= recipe.sourceFirstTick && f.tick <= recipe.sourceLastTick)
    .map(f => ({ ...f, grip: { x: f.grip.x * scale, y: f.grip.y * scale, z: f.grip.z * scale } }));
  const endpoint = createReferenceBatKinematicsV1({ ...recipe.reference, frames: selected }).sampleAtSourceTick(recipe.sourceLastTick);
  boundary.recovery = { durationSeconds: .001, grip: { x: endpoint.state.pose.grip.x / scale,
    y: endpoint.state.pose.grip.y / scale, z: endpoint.state.pose.grip.z / scale }, orientation: endpoint.orientation };
  const base = simulateLivePitchV1(baselineInput), bounds = base.diagnostics.swingExecutionV122!.bounds;
  // Synthetic fixture limits, explicitly derived for this regression; never
  // saved as an athlete's measured ability or used as a product default.
  const tight = { ...limits, maximumGripAccelerationMps2: Math.min(1e7, bounds.maximumGripAccelerationMps2 * 1.05 + 1),
    maximumAngularAccelerationRadPerSecond2: Math.min(1e7, bounds.maximumAngularAccelerationRadPerSecond2 * 1.05 + 1),
    maximumSweetSpotAccelerationMps2: Math.min(1e7, bounds.maximumSweetSpotAccelerationMps2 * 1.05 + 1) };
  const result = simulateLivePitchV1({ ...baselineInput, batter: { ...baselineInput.batter, plateVision: 100, swingExecutionV122: tight } });
  const info = result.diagnostics.swingEnvelopeV133;
  expect(info?.status).toBe('APPLIED');
  if (info?.status !== 'APPLIED') throw Error('explicit envelope not executed');
  expect(info.lateAimScale).toBeLessThan(1);
  expect(info.finalEnvelopeCertificateChecked).toBe(true);
  const final = result.diagnostics.swingExecutionV122!.bounds;
  for (const key of ['maximumGripAccelerationMps2', 'maximumAngularAccelerationRadPerSecond2', 'maximumSweetSpotAccelerationMps2'] as const)
    expect(final[key]).toBeLessThanOrEqual(tight[key]);
  const replay = createLiveBatPlaybackV88({ descriptor: result.diagnostics.batPlaybackV88!, measuredClip: clip });
  expect(replay.sampleAtTick(replay.throughTick - .5)).toEqual(result.sampleBatAtTick(replay.throughTick - .5));
});
