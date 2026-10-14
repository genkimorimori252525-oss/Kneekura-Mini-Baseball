import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { battedWorldFieldFixture } from './BattedWorldFieldFixtures.test-support';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { battedEpisodeFieldBindingEvidenceFromSqlite, openSqliteBattedEpisodeFieldBindingStore } from './SqliteBattedEpisodeFieldBindingStore';
import { battedWorldFieldGeometry, battedWorldFieldRootIdentity, battedWorldFieldSourceRootIdentity,
  battedWorldFieldEpisodeBindingHash, type BattedWorldFieldRoot } from './BattedWorldFieldRoot';
import type { AcceptedBattedEpisodeFieldBinding, DurableBattedEpisodeFieldBinding } from './BattedEpisodeFieldBinding';

let directory: string, x: ReturnType<typeof battedWorldFieldFixture>, binding: DurableBattedEpisodeFieldBinding;
beforeAll(() => {
  directory = mkdtempSync(join(tmpdir(), 'episode-v3-contract-'));
  x = battedWorldFieldFixture(join(directory, 'world.sqlite'));
  const source: AcceptedBattedEpisodeFieldBinding = { sourceId: 'original-binding', sourceVersion: 'fixture-v1',
    version: 'batted_episode_field_binding_v1', responseSourceId: x.response.source.sourceId,
    fieldCalibrationSourceId: x.geometrySource.sourceId };
  binding = x.f.track(openSqliteBattedEpisodeFieldBindingStore(x.f.path, { readAcceptedBinding: () => source })).accept(source.sourceId);
}, 60_000);
afterAll(() => { x?.f.close(); if (directory) rmSync(directory, { recursive: true, force: true }); });
const source = (): AcceptedBattedEpisodeFieldBinding => ({ sourceId: binding.source.sourceId, sourceVersion: binding.source.sourceVersion,
  responseSourceId: binding.source.responseSourceId, fieldCalibrationSourceId: binding.source.fieldCalibrationSourceId,
  version: 'batted_episode_field_binding_v3',
  physicalActorSourceId: binding.response.touch.worldContact.flight.physicalPitch.frame.batterActor!.source.sourceId,
  completedOrigin: { kind: 'physical_play_closure', sourceId: 'named-completion' } });
// These are explicit selector projections, never accepted v3 owner receipts.
// Completed-origin authentication is exercised by the separate helper tests.
const root = (): Extract<BattedWorldFieldRoot, { rootKind: 'episode_field_binding_v3' }> => ({ rootKind: 'episode_field_binding_v3', episodeFieldBinding: { ...binding, source: source(),
  completedOriginProof: { sourceHash: hash('structural source'), completionHash: hash('structural completion'),
    applicationId: 'structural-application', durableRevision: 1 } },
  response: binding.response, geometry: binding.calibration });
const fieldSource = () => ({ ...x.source, episodeFieldBinding: { version: 'batted_episode_field_binding_v3' as const, sourceId: binding.source.sourceId } });

it('uses a distinct v3 root/Source identity while retaining exact venue calibration bytes', () => {
  const value = root(), before = json(value);
  expect(battedWorldFieldRootIdentity(value)).toBe(json(['episode_field_binding_v3', binding.source.sourceId]));
  expect(battedWorldFieldSourceRootIdentity(fieldSource())).toBe(battedWorldFieldRootIdentity(value));
  expect(battedWorldFieldGeometry({ ...value, source: fieldSource() })).toBe(binding.geometry);
  expect(battedWorldFieldEpisodeBindingHash(value)).toBe(hash(value.episodeFieldBinding));
  expect(json(value)).toBe(before); expect(json(value.geometry)).toBe(json(binding.calibration));
});
it.each(['v1', 'v2'] as const)('rejects a v3 receipt under the %s root discriminator', version => {
  expect(() => battedWorldFieldRootIdentity({ ...root(), rootKind: `episode_field_binding_${version}` } as BattedWorldFieldRoot)).toThrow();
});
it.each(['v1', 'v2'] as const)('rejects a %s Source paired with the v3 root', version => {
  expect(() => battedWorldFieldGeometry({ ...root(), source: { ...fieldSource(),
    episodeFieldBinding: { version: `batted_episode_field_binding_${version}`, sourceId: binding.source.sourceId } } })).toThrow();
});
it('rejects a v3 field opt-in pointing at a genuine v1 binding before a field write', () => {
  const proposed = fieldSource(); x.sources.set(proposed.sourceId, proposed as never);
  expect(() => x.fields.accept(proposed.sourceId)).toThrow('actual field episode binding or redundant original references differ');
  expect(x.f.db.prepare('SELECT count(*) AS n FROM batted_world_field_actions').get()!.n).toBe(0);
});
it.each(['missing', 'extra', 'unknown', 'inline'] as const)('rejects %s completed-origin Source input before derivation', mode => {
  const proposed = source();
  const changed = mode === 'missing' ? Object.fromEntries(Object.entries(proposed).filter(([key]) => key !== 'completedOrigin'))
    : { ...proposed, completedOrigin: mode === 'extra' ? { kind: 'physical_play_closure', sourceId: 'named-completion', applicationHash: 'untrusted' }
      : mode === 'unknown' ? { kind: 'application', sourceId: 'named-completion' } : { kind: 'physical_play_closure', sourceId: { inline: true } } };
  expect(() => battedEpisodeFieldBindingEvidenceFromSqlite(x.f.db).derive(changed as never)).toThrow(/Source|origin/);
});
it.each(['v1', 'v2'] as const)('does not add completed-origin capability to %s', version => {
  expect(() => battedEpisodeFieldBindingEvidenceFromSqlite(x.f.db).derive({ ...source(), version: `batted_episode_field_binding_${version}` } as never))
    .toThrow('invalid accepted episode field binding Source');
});
it('rejects the original initial-world actor as a new completed-origin episode', () => {
  expect(() => battedEpisodeFieldBindingEvidenceFromSqlite(x.f.db).derive(source())).toThrow('episode v3 requires its distinct completed-origin actor and earlier calibration play');
});
it('rejects a v3 root with its completed-origin proof omitted', () => {
  const value = root();
  expect(() => battedWorldFieldRootIdentity({ ...value, episodeFieldBinding: { ...value.episodeFieldBinding!, completedOriginProof: undefined } }))
    .toThrow('invalid completed-origin field binding proof');
});
it('gives the explicit current-ten v4 arm a separate root and dependency hash with the same venue calibration', () => {
  const original = root();
  const value: BattedWorldFieldRoot = { ...original, rootKind: 'episode_field_binding_v4',
    episodeFieldBinding: { ...original.episodeFieldBinding!, source: { ...source(), version: 'batted_episode_field_binding_v4' } as AcceptedBattedEpisodeFieldBinding } };
  const proposed = { ...fieldSource(), episodeFieldBinding: { version: 'batted_episode_field_binding_v4' as const, sourceId: binding.source.sourceId } };
  expect(battedWorldFieldRootIdentity(value)).toBe(json(['episode_field_binding_v4', binding.source.sourceId]));
  expect(battedWorldFieldSourceRootIdentity(proposed)).toBe(battedWorldFieldRootIdentity(value));
  expect(battedWorldFieldGeometry({ ...value, source: proposed })).toBe(binding.geometry);
  expect(battedWorldFieldEpisodeBindingHash(value)).not.toBe(battedWorldFieldEpisodeBindingHash(original));
  expect(() => battedWorldFieldGeometry({ ...value, source: fieldSource() })).toThrow();
  expect(() => battedWorldFieldRootIdentity({ ...value, rootKind: 'episode_field_binding_v3' })).toThrow();
});
it('rejects v4 activation of an earlier-calibration frame or a v1 receipt without writing', () => {
  const own = battedEpisodeFieldBindingEvidenceFromSqlite(x.f.db);
  expect(() => own.derive({ ...source(), version: 'batted_episode_field_binding_v4' } as AcceptedBattedEpisodeFieldBinding))
    .toThrow('episode v4 requires its actual current completed-origin actor and earlier venue calibration');
  const proposed = { ...fieldSource(), episodeFieldBinding: { version: 'batted_episode_field_binding_v4' as const, sourceId: binding.source.sourceId } };
  x.sources.set(proposed.sourceId, proposed as never);
  expect(() => x.fields.accept(proposed.sourceId)).toThrow('actual field episode binding or redundant original references differ');
  expect(x.f.db.prepare('SELECT count(*) AS n FROM batted_world_field_actions').get()!.n).toBe(0);
});
