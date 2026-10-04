import { expect, it } from 'vitest';
import { actualFieldObservationInput } from './ActualFieldObservation';
import { actualCommunicationInput, actualCommunicationModelInput } from './ActualCallCommunication';
const source = { sourceId: 'obs', sourceVersion: 'v1', physicalPitchSourceId: 'pitch', playerId: 'p1', baseFieldSourceId: 'field',
  executionSourceId: 'exec', observationModelSourceId: 'model', previousObservationSourceId: null,
  view: { poseVersion: 'pose', bodyRelativeEyeOffset: { x: 0, y: 1, z: 0 }, forward: { x: 1, y: 0, z: 0 }, attentionTarget: { kind: 'ball' as const } } };
it('accepts a source-bound communication opt-in without changing legacy observation bytes', () => {
  expect(actualFieldObservationInput(source, source.sourceId)).toEqual(source);
  expect(actualFieldObservationInput({ ...source, communicationSourceId: 'call-communication' }, source.sourceId)).toEqual({ ...source, communicationSourceId: 'call-communication' });
});
it('refuses caller supplied received content, participant omission, times, completed counts or watermark claims', () => {
  const s = { sourceId: 'comm', sourceVersion: 'v1', callSourceId: 'call', modelSourceId: null, currentExecutionSourceId: 'exec', previousCommunicationSourceId: null };
  for (const field of ['recipients', 'receivedAt', 'content', 'completedCount', 'settledThroughTick']) expect(() => actualCommunicationInput({ ...s, [field]: [] }, s.sourceId)).toThrow();
  expect(actualCommunicationInput(s, s.sourceId)).toEqual(s);
});
it('does not accept unspecified timing versions, duplicate receiver conditions or extra outcome fields', () => {
  const s = { sourceId: 'model', sourceVersion: 'v1', gameId: 'game', physicalPitchSourceId: 'pitch', parameters: null };
  expect(actualCommunicationModelInput(s, s.sourceId)).toEqual(s);
  expect(() => actualCommunicationModelInput({ ...s, content: 'out' } as any, s.sourceId)).toThrow();
});
