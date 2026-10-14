/// <reference types="vite/client" />
import { expect, test } from 'vitest';
import { dispatchCalibrationSources } from './SamePlateAppearanceDispatchCalibration.test-support';
const modules = import.meta.glob('./SamePlateAppearanceDispatchSource.ts');
const implementation = async () => {
  const load = modules['./SamePlateAppearanceDispatchSource.ts'];
  expect(load, 'dispatch calibration implementation missing').toBeTypeOf('function');
  return await load() as { samePaDispatchSourceInput(raw: unknown): any; assertSamePaDispatchSourceBasis(source: unknown, basis: unknown): void };
};

test('DC07 independently declared parser fixtures retain all eight response domains and original references', async () => {
  const api = await implementation(), sources = dispatchCalibrationSources(); expect(sources).toHaveLength(8);
  for (const source of sources) {
    const parsed = api.samePaDispatchSourceInput(source); expect(parsed).toEqual(source);
    expect(parsed).not.toBe(source); expect(Object.isFrozen(parsed.response)).toBe(true);
    expect(parsed.nominalReference).toEqual(source.nominalReference); expect(parsed.nominalParameterReference).toEqual(source.nominalParameterReference);
  }
});

test('DC08 route-specific numerical and exact nested-domain violations reject before any owner work', async () => {
  const api = await implementation(), sources = dispatchCalibrationSources();
  const changes: Record<string, (s: any) => void> = {
    pitch_delivery: s => s.response.policyReference.owner = 'world_player_locomotion_models',
    batter_motor: s => s.response.values.motorLatencyTicks = 0,
    batter_decision: s => s.response.values.threshold = 1.1,
    batter_swing: s => s.response.values.profiles[0].profile.batLengthM = -1,
    batter_observation: s => s.response.values.deliveryLatencyTicks = 0,
    defender_observation: s => s.response.values.qualityParameters.weights.ability = -1,
    defender_decision: s => s.response.values.firstStepTimingParameters.maximumFirstStepDelayTicks = -1,
    defender_locomotion: s => s.response.values.preferredSide = 0,
  };
  for (const source of sources) {
    const changed = structuredClone(source); changes[source.route](changed); expect(() => api.samePaDispatchSourceInput(changed)).toThrow();
    const extra = structuredClone(source) as any; extra.response.cachedPhysicalPath = [];
    expect(() => api.samePaDispatchSourceInput(extra)).toThrow();
    const foreign = structuredClone(source) as any; foreign.nominalReference.owner = 'pa_dispatch_v1_pitch_actions';
    expect(() => api.samePaDispatchSourceInput(foreign)).toThrow();
    if (source.nominalParameterReference) {
      const wrong = structuredClone(source) as any; wrong.nominalParameterReference.parameterKey = 'equipment';
      expect(() => api.samePaDispatchSourceInput(wrong)).toThrow();
    }
  }
});

test('DC09 calibration acceptance day is bounded by the authenticated game day and exact view basis', async () => {
  const api = await implementation();
  for (const raw of dispatchCalibrationSources()) {
    const source = api.samePaDispatchSourceInput(raw), basis = { enrollmentReference: raw.enrollmentReference,
      viewReference: raw.viewReference, firstPhysicalPitchSourceId: raw.firstPhysicalPitchSourceId, gameDay: 11 };
    api.assertSamePaDispatchSourceBasis(source, basis);
    expect(() => api.assertSamePaDispatchSourceBasis(source, { ...basis, gameDay: 10 })).toThrow();
    expect(() => api.assertSamePaDispatchSourceBasis(source, { ...basis, gameDay: NaN })).toThrow();
    expect(() => api.assertSamePaDispatchSourceBasis(source, { ...basis, gameDay: undefined })).toThrow();
  }
});
