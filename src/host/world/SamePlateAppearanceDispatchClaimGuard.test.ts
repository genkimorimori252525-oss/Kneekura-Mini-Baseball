import { createRequire } from 'node:module';
import { afterEach, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { paDispatchSchema } from './SamePlateAppearanceDispatchStorage';
import { assertNoSamePaPlayerReservation, assertNoSamePaWorkReservation } from './SamePlateAppearanceReservationGuard';
import { assertNoReservedPaPlayerClaim, assertNoReservedPaWorkClaim } from './SamePlateAppearanceProvisionalClaimGuard';
const { DatabaseSync: Native } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const databases: DatabaseSync[] = [];
afterEach(() => databases.splice(0).forEach(db => db.close()));
const setup = () => { const db = new Native(':memory:'); databases.push(db); for (const sql of Object.values(paDispatchSchema)) db.exec(sql); return db; };
const orphan = (db: DatabaseSync, source: string, snapshot: string) => db.prepare('INSERT INTO pa_dispatch_v1_action_plans VALUES(?,?,?,?,?,?,?,?,?,?,?,?)')
  .run('moved', 'fixture-v1', 'moved-career', 'moved-game', 99, 'gone-enrollment', 'moved-pitch', 'gone-view', source, 'f'.repeat(64), snapshot, 'f'.repeat(64));
it('DG01 surviving dispatch roots block global writers before absent reservation and provisional returns', () => {
  const db = setup(); orphan(db, JSON.stringify({ firstPhysicalPitchSourceId: 'pitch' }), JSON.stringify({ lineage: { careerId: 'career', gameId: 'game', playId: 1, participantReferences: [{ playerId: 'player' }] } }));
  expect(() => assertNoSamePaPlayerReservation(db, { careerId: 'career', playerId: 'player' })).toThrow(/dispatch/);
  expect(() => assertNoSamePaWorkReservation(db, { gameId: 'game', playId: 1, physicalPitchSourceId: 'pitch' })).toThrow(/dispatch/);
});
it('DG02 direct provisional guards preserve dispatch orphan exclusion without older schemas', () => {
  const db = setup(); orphan(db, '{}', '{}');
  expect(() => assertNoReservedPaPlayerClaim(db, { careerId: 'moved-career', playerId: 'player' })).toThrow(/dispatch/);
  expect(() => assertNoReservedPaWorkClaim(db, { gameId: 'moved-game', playId: 99 })).toThrow(/dispatch/);
});
it('DG03 duplicate escaped raw claims cannot disappear behind moved indexes', () => {
  const db = setup(); orphan(db, '{"firstPhysicalPitchSourceId":"pitch","firstPhysicalPitchSourceId":"other"}', '{"lineage":{"gameId":"other","game\\u0049d":"game","playId":1}}');
  expect(() => assertNoSamePaWorkReservation(db, { gameId: 'game', playId: 1, physicalPitchSourceId: 'pitch' })).toThrow(/dispatch/);
});
it('DG04 surviving future action head consumption and admission claims reject without reading physical payloads', () => {
  for (const name of ['pa_dispatch_v1_pitch_actions', 'pa_dispatch_v1_consumptions', 'pa_dispatch_v1_episode_admissions'] as const) {
    const db = setup(), columns = db.prepare('PRAGMA table_info(' + name + ')').all();
    const values = columns.map(c => c.name === 'play_id' || c.name === 'progress_revision' ? 1 : c.name === 'game_id' ? 'game' : c.name === 'source_json' || c.name === 'snapshot_json' ? '"opaque future payload"' : 'claim');
    db.prepare('INSERT INTO ' + name + ' VALUES(' + values.map(() => '?').join(',') + ')').run(...values);
    expect(() => assertNoSamePaWorkReservation(db, { gameId: 'game', playId: 1 })).toThrow(/dispatch/);
  }
});
it('DG05 malformed dispatch namespace rejects even when both older families are absent', () => {
  const db = setup(); db.exec('DROP TABLE pa_dispatch_v1_rights');
  expect(() => assertNoSamePaWorkReservation(db, { gameId: 'game', playId: 1 })).toThrow(/dispatch/);
});
