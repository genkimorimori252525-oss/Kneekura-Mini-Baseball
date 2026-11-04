import { expect, it } from 'vitest';
import { validatePitchRepertoireV78 } from './LivePitchAuthoringV78';

const pitch = (pitchId: string, extra: Record<string, unknown> = {}) => ({ pitchId, name: pitchId, pitchType: pitchId === 'ff' ? 'fastball' : 'slider',
  releaseSpeedMps: 40, spinRadPerSecond: { x: 200, y: 0, z: 0 }, source: { kind: 'original', id: pitchId, revision: 1 }, ...extra });
const repertoire = (...pitches: unknown[]) => ({ version: 'pitch_repertoire_v78', pitches });

it('accepts usage weights on every pitch, or on none', () => {
  expect(() => validatePitchRepertoireV78(repertoire(pitch('ff'), pitch('sl')))).not.toThrow();
  expect(validatePitchRepertoireV78(repertoire(pitch('ff', { usageWeightV1: 60 }), pitch('sl', { usageWeightV1: 0 }))).pitches[1].usageWeightV1).toBe(0);
});

it('rejects a partial, all-zero or out-of-range usage weight', () => {
  expect(() => validatePitchRepertoireV78(repertoire(pitch('ff', { usageWeightV1: 60 }), pitch('sl')))).toThrow(/usage weights/);
  expect(() => validatePitchRepertoireV78(repertoire(pitch('ff', { usageWeightV1: 0 }), pitch('sl', { usageWeightV1: 0 })))).toThrow(/usage weights/);
  expect(() => validatePitchRepertoireV78(repertoire(pitch('ff', { usageWeightV1: -1 }), pitch('sl', { usageWeightV1: 1 })))).toThrow(/usage weight/);
  expect(() => validatePitchRepertoireV78(repertoire(pitch('ff', { usageWeightV1: 1001 }), pitch('sl', { usageWeightV1: 1 })))).toThrow(/usage weight/);
});
