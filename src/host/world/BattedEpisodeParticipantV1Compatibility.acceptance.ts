import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { battedWorldFieldFixture } from './BattedWorldFieldFixtures.test-support';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { battedWorldFieldRootIdentity } from './BattedWorldFieldRoot';
import { openSqliteBattedEpisodeFieldBindingStore } from './SqliteBattedEpisodeFieldBindingStore';
import type { AcceptedBattedEpisodeFieldBinding } from './BattedEpisodeFieldBinding';

it('retains genuine v1 binding bytes and retry while rejecting v2 on the original actor', () => {
  const directory = mkdtempSync(join(tmpdir(), 'episode-v1-compatibility-'));
  const x = battedWorldFieldFixture(join(directory, 'compatibility.sqlite'));
  const source: AcceptedBattedEpisodeFieldBinding = { sourceId: 'episode-v1-compatibility', sourceVersion: 'fixture-v1',
    version: 'batted_episode_field_binding_v1', responseSourceId: x.response.source.sourceId, fieldCalibrationSourceId: x.geometrySource.sourceId };
  const pitch = x.response.touch.worldContact.flight.physicalPitch;
  const accepted = new Map<string, AcceptedBattedEpisodeFieldBinding>([[source.sourceId, source]]);
  const owner = openSqliteBattedEpisodeFieldBindingStore(x.f.path, { readAcceptedBinding: id => accepted.get(id) ?? null });
  try {
    const contact = pitch.result.pitch.resolution.timeline.events.find(event => event.kind === 'BatBallContact')!;
    const expected = { source, gameId: pitch.frame.gameId, playId: pitch.frame.match.playId,
      physicalPitchSourceId: pitch.source.sourceId, contactSequence: contact.sequence, contactTick: contact.tick,
      response: x.response, calibration: x.geometry, geometry: x.geometry.geometry };
    const value = owner.accept(source.sourceId); expect(json(value)).toBe(json(expected));
    const row = x.f.db.prepare('SELECT source_json,snapshot_json FROM main.batted_episode_field_bindings WHERE source_id=?').get(source.sourceId)!;
    expect(row.source_json).toBe(json(source)); expect(row.snapshot_json).toBe(json(expected));
    const root = { rootKind: 'episode_field_binding_v1' as const, episodeFieldBinding: value, response: value.response, geometry: value.calibration };
    expect(battedWorldFieldRootIdentity(root)).toBe(json(['episode_field_binding_v1', source.sourceId]));
    accepted.clear(); expect(json(owner.accept(source.sourceId))).toBe(json(expected));
    expect(json(owner.read(source.sourceId))).toBe(json(expected));
    const v2: AcceptedBattedEpisodeFieldBinding = { ...source, sourceId: 'rejected-original-actor-v2', version: 'batted_episode_field_binding_v2',
      physicalActorSourceId: pitch.frame.batterActor!.source.sourceId };
    accepted.set(v2.sourceId, v2);
    expect(() => battedWorldFieldRootIdentity({ ...root, episodeFieldBinding: { ...value, source: v2 } }))
      .toThrow('invalid actual field episode root kind or binding receipt');
    expect(() => owner.accept(v2.sourceId)).toThrow('episode v2 requires its distinct current actual-live actor and earlier calibration play');
    expect(x.f.db.prepare('SELECT count(*) AS n FROM main.batted_episode_field_bindings').get()!.n).toBe(1);
    expect(json(owner.read(source.sourceId))).toBe(json(expected));
  } finally { owner.close(); x.f.close(); }
});
