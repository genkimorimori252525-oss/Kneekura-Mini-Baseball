import { expect, it } from 'vitest';
import { battedWorldFieldSourceRootIdentity } from './BattedWorldFieldRoot';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

const source = (version: string) => ({ responseSourceId: 'accepted-response', geometrySourceId: 'accepted-calibration',
  episodeFieldBinding: { version, sourceId: 'accepted-binding' } });
it('admits the explicit v2 field Source as its distinct root identity', () => {
  expect(battedWorldFieldSourceRootIdentity(source('batted_episode_field_binding_v2') as never))
    .toBe(json(['episode_field_binding_v2', 'accepted-binding']));
});
it('retains the v1 field Source identity bytes', () => {
  expect(battedWorldFieldSourceRootIdentity(source('batted_episode_field_binding_v1') as never))
    .toBe(json(['episode_field_binding_v1', 'accepted-binding']));
});
it('keeps opaque provenance from selecting a field binding capability', () => {
  expect(battedWorldFieldSourceRootIdentity({ responseSourceId: 'response', geometrySourceId: 'geometry',
    sourceVersion: 'batted_episode_field_binding_v2' } as never)).toBe('legacy');
});
it('rejects an unknown field binding version', () => {
  expect(() => battedWorldFieldSourceRootIdentity(source('unknown') as never)).toThrow('invalid episode field binding opt-in');
});
it('rejects mixed runner and v2 episode capabilities', () => {
  expect(() => battedWorldFieldSourceRootIdentity({ ...source('batted_episode_field_binding_v2'), kind: 'owned_runner_field_v1' } as never))
    .toThrow('invalid episode field binding opt-in');
});
it('rejects inline geometry in the v2 field opt-in', () => {
  const value = source('batted_episode_field_binding_v2');
  expect(() => battedWorldFieldSourceRootIdentity({ ...value, episodeFieldBinding: { ...value.episodeFieldBinding, geometry: {} } } as never))
    .toThrow('invalid episode field binding opt-in');
});
it('rejects an invalid v2 binding reference', () => {
  const value = source('batted_episode_field_binding_v2');
  expect(() => battedWorldFieldSourceRootIdentity({ ...value, episodeFieldBinding: { ...value.episodeFieldBinding, sourceId: ' ' } } as never))
    .toThrow('invalid episode field binding opt-in');
});
