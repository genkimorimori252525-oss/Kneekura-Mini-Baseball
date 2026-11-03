import { expect, it } from 'vitest';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaPhysicalEpisodeSourceInput as parse } from './SamePlateAppearancePhysicalEpisode';
import { fixture, value } from '../../core/world/psychology/batting/BattingFixtures.test-support';
import { measuredFixture } from '../../core/world/psychology/batting/MeasuredBattingFixtures.test-support';
import { calculateObservedSpinMotorPlanV123, type SpinMotorContextV123 } from '../../core/world/psychology/batting/SpinMotorPlanV123';
import { calculateObservedBattingMotorPlanV1, type BattingMotorPlanInputV1 } from '../../core/world/psychology/batting/BattingMotorPlanV1';
import * as binding from './SamePlateAppearanceSpinBindingV123';

const ref = (owner: string, sourceId = owner) => ({ owner, sourceId, sourceHash: hash(sourceId), snapshotHash: hash(['snapshot', sourceId]) });
const ordinary = () => ({ sourceId: 'spin-commit', sourceVersion: 'explicit-test-v1', capability: 'same_pa_physical_commitment_v1',
  viewReference: ref('pa_lifecycle_v1_execution_views'), launchReference: ref('pa_physical_v1_launches'),
  previousOperationReference: ref('pa_physical_v1_cuts'), inputReference: ref('batting_execution_v1_inputs'),
  intentReference: ref('batting_execution_v1_intents') });
const spin = () => ({ ...ordinary(), capability: 'same_pa_physical_commitment_v123', spinBindingV123: {
  kind: 'fixed_native_spin_binding_v123', modelReference: ref('world_player_batting_models'),
  intent: { technique: 'NO_SPIN_TARGET', selectedAtTick: 10 }, qualificationReferences: [] } });

it('SPN01 v123 is explicit and leaves the original v1 Source bytes unchanged', () => {
  const old = ordinary(), bytes = json(old);
  expect(json(parse(old))).toBe(bytes);
  expect(parse(spin())).toEqual(spin());
  expect(() => parse({ ...old, spinBindingV123: spin().spinBindingV123 })).toThrow();
  expect(() => parse({ ...spin(), spinBindingV123: undefined })).toThrow();
});

function motorFixture(measured = false) {
  const r = measured ? measuredFixture() : fixture(), s = r.source, p = s.predictions[1];
  const base: BattingMotorPlanInputV1 = { decisionTick: r.currentFrame.time.tick, aggression: 0.8,
    geometry: { handedness: s.handedness, centerOfMass: s.centerOfMass, batPhysical: s.batPhysical, plateZ: s.plateZ,
      strikeZone: s.strikeZone, bodyReadyTick: s.bodyReadyTick, latestMotorStartTick: s.latestMotorStartTick },
    motor: { motorLatencyTicks: s.motorLatencyTicks, technicalTimingOffsetTicks: s.technicalTimingOffsetTicks, maximumSweetSpotSpeedMps: s.maximumSweetSpotSpeedMps },
    repertoire: { repertoireId: s.repertoireId, repertoireVersion: s.repertoireVersion, profiles: s.profiles,
      ...(s.sampledProfiles ? { sampledProfiles: s.sampledProfiles } : {}) },
    forecast: { observedTick: p.observedTick, availableTick: p.availableTick, validUntilTick: p.validUntilTick, trajectory: p.trajectory } };
  const repertoireRef = { sourceId: 'original-accepted-repertoire', sourceVersion: 'test-v1' };
  const context: SpinMotorContextV123 = { atDay: 17, repertoireSourceRef: repertoireRef,
    intent: { technique: 'BACKSPIN', selectedAtTick: base.decisionTick }, techniques: [{ technique: 'BACKSPIN',
      qualificationRef: { sourceId: 'qualified-original-profile', sourceVersion: 'v1' }, acceptedAtDay: 16, repertoireRef,
      calibration: { sourceId: 'explicit-qualification-calibration', sourceVersion: 'v1', status: 'MODEL_VERIFIED' },
      motorProfileRefs: [{ profileId: s.profiles[0].profile.profileId, version: s.profiles[0].profile.version }] }] };
  return { base, context };
}

// This tests the Host transfer rule using synthetic, already-authenticated
// payloads. It does not manufacture a Native qualification or match receipt.
it('SPN04 same-ID/version calibration cannot transfer mastery to a changed effective profile payload', () => {
  const { base, context } = motorFixture(), original = structuredClone(base.repertoire), effective = structuredClone(original);
  (effective.profiles[0].profile as { baseContactSweetSpotSpeedMps: number }).baseContactSweetSpotSpeedMps -= 1;
  const changedBase = { ...base, repertoire: effective };
  // Reproduce the cause: pure Core accepts ID/version and assumes Host admission.
  expect(value(calculateObservedSpinMotorPlanV123({ ...context, base: changedBase })).selectedIntent).toBe('BACKSPIN');
  const before = json([original, effective, context]);
  const techniques = binding.samePaSpinTechniquesForEffectiveRepertoireV123(context.techniques, original, effective);
  expect(techniques).toEqual([]);
  const result = value(calculateObservedSpinMotorPlanV123({ ...context, base: changedBase, techniques }));
  expect(result.selectedIntent).toBe('NO_SPIN_TARGET');
  expect(result.plan).toEqual(value(calculateObservedBattingMotorPlanV1(changedBase)));
  expect(json([original, effective, context])).toBe(before);
  expect(binding.samePaSpinTechniquesForEffectiveRepertoireV123(context.techniques, original, structuredClone(original))).toEqual(context.techniques);
  const unrelated = structuredClone(original);
  (unrelated.profiles[1].profile as { baseContactSweetSpotSpeedMps: number }).baseContactSweetSpotSpeedMps -= 1;
  expect(binding.samePaSpinTechniquesForEffectiveRepertoireV123(context.techniques, original, unrelated)).toEqual(context.techniques);
});

it('SPN05 measured motion payload and repertoire registration mode must also match the certified motor', () => {
  const { base, context } = motorFixture(true), original = structuredClone(base.repertoire);
  const changed = structuredClone(original);
  (changed.sampledProfiles![0] as { playbackRate: number }).playbackRate += 0.1;
  for (const effective of [changed, { ...original, sampledProfiles: [] }, { ...original, repertoireVersion: original.repertoireVersion + ':other-registration' }]) {
    expect(binding.samePaSpinTechniquesForEffectiveRepertoireV123(context.techniques, original, effective)).toEqual([]);
  }
  const ordinary = motorFixture(), added = { ...ordinary.base.repertoire, sampledProfiles: original.sampledProfiles };
  expect(binding.samePaSpinTechniquesForEffectiveRepertoireV123(ordinary.context.techniques, ordinary.base.repertoire, added)).toEqual([]);
});

it('SPN06 incompatible candidates do not invalidate a separately certified unchanged profile', () => {
  const { base, context } = motorFixture(), original = structuredClone(base.repertoire), effective = structuredClone(original);
  const technique = { ...context.techniques[0], motorProfileRefs: original.profiles.map(p => ({ profileId: p.profile.profileId, version: p.profile.version })) };
  (effective.profiles[0].profile as { baseContactSweetSpotSpeedMps: number }).baseContactSweetSpotSpeedMps -= 1;
  expect(binding.samePaSpinTechniquesForEffectiveRepertoireV123([technique], original, effective)).toEqual([
    { ...technique, motorProfileRefs: [technique.motorProfileRefs[1]] },
  ]);
  const threshold = structuredClone(original);
  (threshold.profiles[0] as { minimumAggression: number }).minimumAggression += 0.01;
  expect(binding.samePaSpinTechniquesForEffectiveRepertoireV123(context.techniques, original, threshold)).toEqual([]);
});

it('SPN02 fixed qualification binding rejects aliases, extra authority, malformed intent and foreign owners', () => {
  const s = spin(), q = ref('world_spin_mastery_v123', 'qualification');
  expect(parse({ ...s, spinBindingV123: { ...s.spinBindingV123, qualificationReferences: [q] } })).toBeDefined();
  for (const binding of [
    { ...s.spinBindingV123, qualificationReferences: [q, q] },
    { ...s.spinBindingV123, qualificationReferences: [ref('raw_episode')] },
    { ...s.spinBindingV123, qualificationReferences: [{ ...q, sourceHash: 'bad' }] },
    { ...s.spinBindingV123, qualificationReferences: Array.from({ length: 5 }, (_, n) => ref('world_spin_mastery_v123', String(n))) },
    { ...s.spinBindingV123, intent: { technique: 'GOLD', selectedAtTick: 10 } },
    { ...s.spinBindingV123, intent: { technique: 'SLICE', selectedAtTick: -1 } },
    { ...s.spinBindingV123, modelReference: ref('world_spin_mastery_v123') },
    { ...s.spinBindingV123, spinBonus: 1 },
  ]) expect(() => parse({ ...s, spinBindingV123: binding })).toThrow();
});
