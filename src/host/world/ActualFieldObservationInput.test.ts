import { expect, it } from 'vitest';
import { actualFieldObservationInput, type AcceptedActualFieldObservation } from './ActualFieldObservation';

const source: AcceptedActualFieldObservation = { sourceId: 'observation', sourceVersion: 'explicit-v1', physicalPitchSourceId: 'pitch',
  playerId: 'player', baseFieldSourceId: 'field', executionSourceId: null, observationModelSourceId: 'model', previousObservationSourceId: null,
  view: { poseVersion: 'explicit-v1', bodyRelativeEyeOffset: { x: 0, y: 1, z: 0 }, forward: { x: 0, y: 0, z: 1 }, attentionTarget: { kind: 'ball' } } };
it('rejects delimiter-colliding vector keys in the accepted Source validator itself', () => {
  const malformed = { ...source, view: { ...source.view, bodyRelativeEyeOffset: { 'x|y': 0, z: 0 } } } as unknown as AcceptedActualFieldObservation;
  expect(() => actualFieldObservationInput(malformed, source.sourceId)).toThrow(/invalid/);
});
it('accepts exact coordinate fields regardless of insertion order and freezes the accepted input', () => {
  const reordered = { ...source, view: { ...source.view, bodyRelativeEyeOffset: { z: 0, x: 0, y: 1 } } };
  const accepted = actualFieldObservationInput(reordered, source.sourceId);
  expect(accepted).toEqual(source);
  expect(Object.isFrozen(accepted.view.bodyRelativeEyeOffset)).toBe(true);
});
