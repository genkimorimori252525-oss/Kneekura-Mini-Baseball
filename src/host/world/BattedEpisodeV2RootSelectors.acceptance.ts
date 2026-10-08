import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { actorJson as json, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { battedWorldFieldFixture } from './BattedWorldFieldFixtures.test-support';
import { battedWorldFieldGeometry, battedWorldFieldRootIdentity, battedWorldFieldSourceRootIdentity, battedWorldFieldEpisodeBindingHash,
  type BattedWorldFieldRoot } from './BattedWorldFieldRoot';
import { openSqliteBattedEpisodeFieldBindingStore } from './SqliteBattedEpisodeFieldBindingStore';
import type { AcceptedBattedEpisodeFieldBinding, DurableBattedEpisodeFieldBinding } from './BattedEpisodeFieldBinding';

let fixture: ReturnType<typeof battedWorldFieldFixture>, value: DurableBattedEpisodeFieldBinding;
beforeAll(() => {
  fixture = battedWorldFieldFixture(join(mkdtempSync(join(tmpdir(), 'episode-v2-selectors-')), 'selectors.sqlite'));
  const source: AcceptedBattedEpisodeFieldBinding = { sourceId: 'selector-original-binding', sourceVersion: 'existing-fixture',
    version: 'batted_episode_field_binding_v1', responseSourceId: fixture.response.source.sourceId,
    fieldCalibrationSourceId: fixture.geometrySource.sourceId };
  const owner = openSqliteBattedEpisodeFieldBindingStore(fixture.f.path, { readAcceptedBinding: id => id === source.sourceId ? source : null });
  try { value = owner.accept(source.sourceId); } finally { owner.close(); }
});
afterAll(() => fixture?.f.close());
const original = (): BattedWorldFieldRoot => ({ rootKind: 'episode_field_binding_v1', episodeFieldBinding: value,
  response: value.response, geometry: value.calibration });
// Structural selector projection only. The Native owner never accepts this v2
// projection; current-batter authentication belongs to the later retained-input
// root/read gate, which must obtain its actual binding through the Native reader.
const projection = () => {
  const source: AcceptedBattedEpisodeFieldBinding = { ...value.source, version: 'batted_episode_field_binding_v2',
    physicalActorSourceId: value.response.touch.worldContact.flight.physicalPitch.frame.batterActor!.source.sourceId };
  const root = { rootKind: 'episode_field_binding_v2', episodeFieldBinding: { ...value, source }, response: value.response, geometry: value.calibration };
  return root as unknown as BattedWorldFieldRoot;
};
const fieldSource = () => ({ responseSourceId: value.source.responseSourceId, geometrySourceId: value.source.fieldCalibrationSourceId,
  episodeFieldBinding: { version: 'batted_episode_field_binding_v1' as const, sourceId: value.source.sourceId } });

it('gives the explicit v2 selector projection its distinct root identity', () => {
  expect(battedWorldFieldRootIdentity(projection())).toBe(json(['episode_field_binding_v2', value.source.sourceId]));
});
it('selects exact v2 physical geometry while retaining the original calibration archive', () => {
  const root = projection(), before = json(root);
  expect(battedWorldFieldGeometry(root)).toBe(value.geometry); expect(json(root)).toBe(before);
  expect(json(root.geometry)).toBe(json(value.calibration));
});
it('preserves legacy and v1 identity encodings and geometry', () => {
  expect(battedWorldFieldRootIdentity({ response: value.response, geometry: value.calibration })).toBe('legacy');
  expect(battedWorldFieldRootIdentity(original())).toBe(json(['episode_field_binding_v1', value.source.sourceId]));
  expect(battedWorldFieldSourceRootIdentity(fieldSource())).toBe(json(['episode_field_binding_v1', value.source.sourceId]));
  expect(battedWorldFieldGeometry(original())).toBe(value.geometry);
});
it('rejects a v2 binding presented with the v1 root kind', () => {
  expect(() => battedWorldFieldRootIdentity({ ...projection(), rootKind: 'episode_field_binding_v1' } as BattedWorldFieldRoot))
    .toThrow('invalid actual field episode root kind or binding receipt');
});
it('rejects a v1 binding presented with the v2 root kind', () => {
  expect(() => battedWorldFieldRootIdentity({ ...original(), rootKind: 'episode_field_binding_v2' } as unknown as BattedWorldFieldRoot))
    .toThrow('invalid actual field episode root kind or binding receipt');
});
it('rejects an unknown root discriminator', () => {
  expect(() => battedWorldFieldRootIdentity({ ...projection(), rootKind: 'unknown' } as unknown as BattedWorldFieldRoot))
    .toThrow('invalid actual field episode root kind or binding receipt');
});
it('matches the explicit v2 field Source identity to its v2 root', () => {
  expect(battedWorldFieldSourceRootIdentity({ ...fieldSource(), episodeFieldBinding: {
    version: 'batted_episode_field_binding_v2', sourceId: value.source.sourceId } })).toBe(battedWorldFieldRootIdentity(projection()));
});
it('rejects a v2 field opt-in targeting a v1 receipt before any action is accepted', () => {
  const source = { ...fixture.source, sourceId: 'unreleased-v2-field-action', episodeFieldBinding: {
    version: 'batted_episode_field_binding_v2', sourceId: value.source.sourceId } };
  fixture.sources.set(source.sourceId, source as never);
  const before = json(fixture.f.db.prepare('SELECT * FROM main.batted_world_field_actions').all());
  expect(() => fixture.fields.accept(source.sourceId)).toThrow('actual field episode binding or redundant original references differ');
  expect(json(fixture.f.db.prepare('SELECT * FROM main.batted_world_field_actions').all())).toBe(before);
});
it('pins both v1 and v2 venue dependencies to the exact versioned binding bytes', () => {
  expect(battedWorldFieldEpisodeBindingHash(original())).toBe(hash(value));
  const root = projection(); expect(battedWorldFieldEpisodeBindingHash(root)).toBe(hash(root.episodeFieldBinding));
  expect(battedWorldFieldEpisodeBindingHash(root)).not.toBe(battedWorldFieldEpisodeBindingHash(original()));
});
it('retains the absent legacy venue binding dependency', () => {
  expect(battedWorldFieldEpisodeBindingHash({ response: value.response, geometry: value.calibration })).toBeUndefined();
});
it('rejects a mixed version before hashing a venue binding dependency', () => {
  expect(() => battedWorldFieldEpisodeBindingHash({ ...original(), rootKind: 'episode_field_binding_v2' } as BattedWorldFieldRoot))
    .toThrow('invalid actual field episode root kind or binding receipt');
});
it('rejects a v1 field Source paired with a v2 read-only root', () => {
  expect(() => battedWorldFieldGeometry({ ...projection(), source: fieldSource() })).toThrow('actual field Source and root binding mode differ');
});
it('rejects changed response identity in a v2 selector projection', () => {
  const root = projection(); expect(() => battedWorldFieldGeometry({ ...root,
    response: { ...value.response, source: { ...value.response.source, sourceId: 'foreign' } } }))
    .toThrow('actual field episode binding physical root or geometry differs');
});
it('rejects changed calibration identity in a v2 selector projection', () => {
  const root = projection(); expect(() => battedWorldFieldGeometry({ ...root,
    geometry: { ...value.calibration, source: { ...value.calibration.source, sourceId: 'foreign' } } }))
    .toThrow('actual field episode binding physical root or geometry differs');
});
