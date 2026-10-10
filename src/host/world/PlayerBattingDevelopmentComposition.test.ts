import { expect, it } from 'vitest';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { battingModelSourceInput, type AcceptedPlayerBattingModelV1,
  type DurablePlayerBattingModelV1 } from './PlayerBattingModel';
import { assertBattingDevelopmentComposition } from './PlayerBattingModelEvidence';
import type { DurableDevelopmentPracticeExposure } from './SqliteDevelopmentPracticeExposureStore';

const ref = (sourceId: string) => ({ sourceId, sourceVersion: 'explicit-test-v1' });
const scope = { careerId: 'career', playerId: 'player', personId: 'person', personLinkSourceId: 'intake' };
const source = (): AcceptedPlayerBattingModelV1 => ({ ...ref('original-model'), ...scope, acceptedAtDay: 12,
  bodyMaterializationRef: ref('body-materialization'), bodyRef: ref('body'), poseRef: ref('pose'),
  capabilityRef: ref('original-capability'), repertoireRef: ref('repertoire'), decisionModelRef: ref('decision'),
  equipmentRef: ref('equipment'), observationCalibrationRef: ref('observation'), predictionCalibrationRef: ref('prediction') });

/** Deliberately partial, synthetic semantic inputs: these tests prove no Native
 * exposure/body provenance, physical repetition, or production calibration. */
const fixture = () => {
  const original = { source: source(), person: { sourceId: scope.personLinkSourceId },
    bodyMaterialization: { source: ref('body-materialization') },
    capability: { ...ref('original-capability'), ...scope, acceptedAtDay: 12,
      values: { motorLatencyTicks: 20_000, technicalTimingOffsetTicks: 0, maximumSweetSpotSpeedMps: 50 } },
    repertoire: { ...ref('repertoire'), values: { kept: 'repertoire' } },
    decisionModel: { ...ref('decision'), values: { kept: 'decision' } },
    equipment: { ...ref('equipment'), values: { kept: 'equipment' } },
    observationCalibration: { ...ref('observation'), values: { kept: 'observation' } },
    predictionCalibration: { ...ref('prediction'), values: { kept: 'prediction' } },
  } as unknown as DurablePlayerBattingModelV1;
  const exposure = { source: ref('exposure'), episode: { episodeId: 'episode', careerId: scope.careerId,
    playerId: scope.playerId, startedAtDay: 10, effectiveDay: 14, stage: 'CONSOLIDATED', domain: 'TECHNICAL' },
    assessment: { eligible: true, atDay: 14 } } as unknown as DurableDevelopmentPracticeExposure;
  const capability = { ...original.capability, ...ref('replacement-capability'), acceptedAtDay: 14,
    values: { ...original.capability.values, technicalTimingOffsetTicks: 3_000 } };
  const value: DurablePlayerBattingModelV1 = { ...original, capability,
    source: { ...original.source, ...ref('replacement-model'), acceptedAtDay: 14, capabilityRef: ref(capability.sourceId),
      developmentProvenance: { kind: 'accepted_batting_capability_development_v1', originalModelRef: ref(original.source.sourceId),
        originalModelSourceHash: hash(original.source), originalModelSnapshotHash: hash(original),
        exposureRef: ref(exposure.source.sourceId), exposureSourceHash: hash(exposure.source), exposureSnapshotHash: hash(exposure),
        assessmentRef: ref('explicit-capability-assessment'), calibrationRef: ref('explicit-capability-calibration'),
        replacementCapabilityHash: hash(capability) } } };
  const repin = (next: DurablePlayerBattingModelV1, prior = original, evidence = exposure): DurablePlayerBattingModelV1 => ({ ...next,
    source: { ...next.source, developmentProvenance: { ...next.source.developmentProvenance!,
      originalModelSourceHash: hash(prior.source), originalModelSnapshotHash: hash(prior),
      exposureSourceHash: hash(evidence.source), exposureSnapshotHash: hash(evidence), replacementCapabilityHash: hash(next.capability) } } });
  return { original, exposure, value, repin };
};

it('preserves untagged Source bytes and accepts only an explicit complete development tag', () => {
  const f = fixture(), originalBytes = json(f.original.source);
  expect(json(battingModelSourceInput(f.original.source, f.original.source.sourceId))).toBe(originalBytes);
  expect(battingModelSourceInput(f.value.source, f.value.source.sourceId)).toEqual(f.value.source);
  expect(() => battingModelSourceInput({ ...f.value.source, developmentProvenance: undefined }, f.value.source.sourceId)).toThrow();
  expect(() => battingModelSourceInput({ ...f.value.source,
    developmentProvenance: { ...f.value.source.developmentProvenance!, replacementCapabilityHash: 'unverified' } }, f.value.source.sourceId)).toThrow();
  expect(() => battingModelSourceInput({ ...f.value.source, developmentProvenance: { ...f.value.source.developmentProvenance!,
    originalModelRef: ref(f.value.source.sourceId) } }, f.value.source.sourceId)).toThrow();
});

it('allows explicit consolidation-day acceptance and an earlier model effective during the episode without calculating a gain', () => {
  const f = fixture(), before = json([f.value, f.original, f.exposure]);
  expect(() => assertBattingDevelopmentComposition(f.value, f.original, f.exposure, scope.personLinkSourceId)).not.toThrow();
  expect(f.original.source.acceptedAtDay).toBeGreaterThan(f.exposure.episode.startedAtDay);
  expect(f.value.source.acceptedAtDay).toBe(f.exposure.episode.effectiveDay);
  expect(json([f.value, f.original, f.exposure])).toBe(before);
});

it.each(['originalModelSourceHash', 'originalModelSnapshotHash', 'exposureSourceHash', 'exposureSnapshotHash', 'replacementCapabilityHash'] as const)
('rejects an incorrect explicit %s pin', key => {
  const f = fixture(), changed = { ...f.value, source: { ...f.value.source,
    developmentProvenance: { ...f.value.source.developmentProvenance!, [key]: hash('other') } } };
  expect(() => assertBattingDevelopmentComposition(changed, f.original, f.exposure, scope.personLinkSourceId)).toThrow();
});

it.each(['same-day-model', 'future-original', 'future-exposure', 'early-capability', 'foreign-player', 'foreign-person', 'ineligible'] as const)
('rejects %s even when all supplied hashes match the changed semantic inputs', kind => {
  const f = fixture(); let value = f.value, original = f.original, exposure = f.exposure;
  if (kind === 'same-day-model') original = { ...original, source: { ...original.source, acceptedAtDay: 14 } };
  if (kind === 'future-original') { original = { ...original, source: { ...original.source, acceptedAtDay: 15 } };
    value = { ...value, source: { ...value.source, acceptedAtDay: 16 } }; }
  if (kind === 'future-exposure') exposure = { ...exposure, episode: { ...exposure.episode, effectiveDay: 15 },
    assessment: { ...exposure.assessment, atDay: 15 } };
  if (kind === 'early-capability') value = { ...value, capability: { ...value.capability, acceptedAtDay: 13 } };
  if (kind === 'foreign-player') exposure = { ...exposure, episode: { ...exposure.episode, playerId: 'other' } };
  if (kind === 'foreign-person') original = { ...original, source: { ...original.source, personId: 'other' } };
  if (kind === 'ineligible') exposure = { ...exposure, assessment: { ...exposure.assessment, eligible: false } };
  expect(() => assertBattingDevelopmentComposition(f.repin(value, original, exposure), original, exposure, scope.personLinkSourceId)).toThrow();
});

it('requires the exact original Person link authenticated by the initiation owner', () => {
  const f = fixture();
  expect(() => assertBattingDevelopmentComposition(f.value, f.original, f.exposure, 'other-intake')).toThrow();
});

it.each(['bodyMaterialization', 'repertoire', 'decisionModel', 'equipment', 'observationCalibration', 'predictionCalibration'] as const)
('keeps original %s bytes pinned when accepting a capability', key => {
  const f = fixture(), changed = { ...f.value, [key]: { ...f.value[key], extra: 'unrelated-change' } };
  expect(() => assertBattingDevelopmentComposition(changed, f.original, f.exposure, scope.personLinkSourceId)).toThrow('only the explicit capability');
});
