import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { battedWorldFieldFixture } from './BattedWorldFieldFixtures.test-support';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { openSqliteBattedEpisodeFieldBindingStore, battedEpisodeFieldBindingEvidenceFromSqlite } from './SqliteBattedEpisodeFieldBindingStore';
import type { AcceptedBattedEpisodeFieldBinding } from './BattedEpisodeFieldBinding';

const directories: string[] = [];
const freshPath = () => { const directory = mkdtempSync(join(tmpdir(), 'episode-binding-admission-')); directories.push(directory); return join(directory, 'world.sqlite'); };
afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }); });
const setup = () => {
  const x = battedWorldFieldFixture(freshPath());
  const source: AcceptedBattedEpisodeFieldBinding = { sourceId: 'episode-binding', sourceVersion: 'fixture-v1',
    version: 'batted_episode_field_binding_v1', responseSourceId: x.response.source.sourceId, fieldCalibrationSourceId: x.geometrySource.sourceId };
  const bindings = x.f.track(openSqliteBattedEpisodeFieldBindingStore(x.f.path, { readAcceptedBinding: id => id === source.sourceId ? source : null }));
  const advance = () => {
    const initial = x.response.touch.worldContact.flight.source;
    const later = { ...initial, sourceId: 'same-pitch-longer-horizon', previousFlightSourceId: initial.sourceId, searchDurationTicks: 1000 };
    x.acceptedFlights.set(later.sourceId, later);
    return x.flights.accept(later.sourceId);
  };
  return { ...x, source, bindings, advance };
};
it('requires the new response exact current flight instead of borrowing any valid later flight head', () => {
  const x = setup();
  try {
    const later = x.advance();
    expect(later.source.physicalPitchSourceId).toBe(x.response.touch.worldContact.flight.source.physicalPitchSourceId);
    expect(later.source.sourceId).not.toBe(x.response.touch.worldContact.flight.source.sourceId);
    expect(() => x.bindings.accept(x.source.sourceId)).toThrow(/current.*flight|flight.*current/);
    expect(x.f.db.prepare('SELECT count(*) AS n FROM main.batted_episode_field_bindings').get()!.n).toBe(0);
  } finally { x.f.close(); }
});
it('keeps historical receipt and calibration bytes after a genuine same-pitch flight advance but rejects new current work', () => {
  const x = setup();
  try {
    const original = x.bindings.accept(x.source.sourceId), calibration = json(x.geometry);
    x.advance();
    expect(x.bindings.read(x.source.sourceId)).toEqual(original);
    expect(x.bindings.accept(x.source.sourceId)).toEqual(original);
    expect(json(x.fields.readGeometry(x.geometrySource.sourceId))).toBe(calibration);
    const own = battedEpisodeFieldBindingEvidenceFromSqlite(x.f.db);
    expect(() => own.current(original)).toThrow(/current.*flight|flight.*current/);
    expect(x.f.db.isTransaction).toBe(false);
    // This is one physical pitch with a longer forecast, never a second episode.
    expect(x.f.db.prepare('SELECT count(DISTINCT physical_pitch_source_id) AS n FROM main.batted_ball_flights').get()!.n).toBe(1);
  } finally { x.f.close(); }
});
it('rejects an advanced non-root response without minting a fresh episode', () => {
  const x = battedWorldFieldFixture(freshPath(), false);
  const source: AcceptedBattedEpisodeFieldBinding = { sourceId: 'advanced-binding', sourceVersion: 'fixture-v1',
    version: 'batted_episode_field_binding_v1', responseSourceId: x.response.source.sourceId, fieldCalibrationSourceId: x.geometrySource.sourceId };
  try {
    expect(x.response.touch.worldContact.flight.source.searchDurationTicks).toBeGreaterThan(0);
    const bindings = x.f.track(openSqliteBattedEpisodeFieldBindingStore(x.f.path, { readAcceptedBinding: () => source }));
    expect(() => bindings.accept(source.sourceId)).toThrow(/unadvanced|root|contact/);
    expect(x.f.db.prepare('SELECT count(*) AS n FROM main.batted_episode_field_bindings').get()!.n).toBe(0);
  } finally { x.f.close(); }
});
it.each(['source_json', 'snapshot_json'] as const)('discovers duplicate hidden Source identity in %s', column => {
  const x = setup();
  try {
    x.bindings.accept(x.source.sourceId);
    const changed = column === 'source_json'
      ? `{"sourceId":${JSON.stringify(x.source.sourceId)},"sourceId":"hidden"}`
      : `{"source":{"sourceId":${JSON.stringify(x.source.sourceId)}},"source":{"sourceId":"hidden"}}`;
    x.f.db.prepare(`UPDATE main.batted_episode_field_bindings SET source_id='hidden',source_json='{}',snapshot_json='{}',${column}=?`).run(changed);
    expect(() => x.bindings.read(x.source.sourceId)).toThrow(/ownership|identity/);
  } finally { x.f.close(); }
});

it.each(['embedded_response', 'embedded_pitch'] as const)('discovers hidden binding ownership through the %s identity alone', kind => {
  const x = setup();
  try {
    const original = x.bindings.accept(x.source.sourceId);
    const saved = JSON.parse(json(original)) as typeof original;
    const flight = saved.response.touch.worldContact.flight;
    const hidden = { ...saved, physicalPitchSourceId: 'hidden', source: { ...saved.source, sourceId: 'hidden', responseSourceId: 'hidden' },
      response: { ...saved.response, source: { ...saved.response.source, sourceId: kind === 'embedded_response' ? saved.response.source.sourceId : 'hidden' },
        touch: { ...saved.response.touch, worldContact: { ...saved.response.touch.worldContact,
          flight: { ...flight, source: { ...flight.source, physicalPitchSourceId: 'hidden' },
            physicalPitch: { ...flight.physicalPitch, source: { ...flight.physicalPitch.source,
              sourceId: kind === 'embedded_pitch' ? flight.physicalPitch.source.sourceId : 'hidden' } } } } } } };
    x.f.db.prepare(`UPDATE main.batted_episode_field_bindings SET source_id='hidden',physical_pitch_source_id='hidden',response_source_id='hidden',
      source_json=?,snapshot_json=?`).run(json(hidden.source), json(hidden));
    const alias = { ...x.source, sourceId: 'another-binding' };
    const owner = x.f.track(openSqliteBattedEpisodeFieldBindingStore(x.f.path, { readAcceptedBinding: id => id === alias.sourceId ? alias : null }));
    expect(() => owner.accept(alias.sourceId)).toThrow(/ownership|owner/);
    expect(x.f.db.prepare('SELECT count(*) AS n FROM main.batted_episode_field_bindings').get()!.n).toBe(1);
  } finally { x.f.close(); }
});

it('rejects Source identity getters in direct evidence derivation without evaluating them', () => {
  const x = setup();
  try {
    let reads = 0;
    const source = Object.defineProperty({ ...x.source }, 'sourceId', { enumerable: true,
      get: () => { reads++; return x.source.sourceId; } });
    expect(() => battedEpisodeFieldBindingEvidenceFromSqlite(x.f.db).derive(source)).toThrow();
    expect(reads).toBe(0);
    expect(x.f.db.prepare('SELECT count(*) AS n FROM main.batted_episode_field_bindings').get()!.n).toBe(0);
  } finally { x.f.close(); }
});

it.each(['missing', 'changed'] as const)('rejects a %s original batter Person dependency before binding insertion', kind => {
  const x = setup();
  try {
    const personSourceId = x.response.touch.worldContact.flight.physicalPitch.frame.batterActor!.binding.personLinkSourceId;
    expect(x.f.db.prepare('SELECT source_id FROM main.world_player_person_links WHERE source_id=?').get(personSourceId)).toBeDefined();
    if (kind === 'missing') x.f.db.prepare('DELETE FROM main.world_player_person_links WHERE source_id=?').run(personSourceId);
    else x.f.db.prepare("UPDATE main.world_player_person_links SET person_id='foreign-person' WHERE source_id=?").run(personSourceId);
    expect(() => x.bindings.accept(x.source.sourceId)).toThrow();
    expect(x.f.db.prepare('SELECT count(*) AS n FROM main.batted_episode_field_bindings').get()!.n).toBe(0);
  } finally { x.f.close(); }
});
