import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { initializeAuthoredNativeMatchV1, readAuthoredNativeMatchV1 } from './AuthoredNativeMatchV1';
import { authoredNativeMatchFixture } from './AuthoredNativeMatchV1.test-support';
const Native = (createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync;
const sha = (file: string | URL) => createHash('sha256').update(readFileSync(file)).digest('hex');
const temp = () => join(mkdtempSync(join(tmpdir(), 'baseball-authored-genesis-')), 'state.sqlite');
const audit = (path: string) => {
  const db = new Native(path, { readOnly: true });
  try {
    const schemas = db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all();
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
    return { schemas, rows: tables.map(t => [t.name, db.prepare('SELECT * FROM "' + String(t.name).replaceAll('"', '""') + '"').all().map(row => JSON.stringify(row)).sort()]) };
  } finally { db.close(); }
};

it('creates two real Native SI model cohorts, official initial World and nineteen bodies without legacy fixtures or owner mocks', () => {
  const declaration = authoredNativeMatchFixture(), path = temp(), original = JSON.stringify(declaration);
  const result = initializeAuthoredNativeMatchV1(path, declaration);
  expect(result.models).toHaveLength(18); expect(result.materializations).toHaveLength(19);
  expect(result.scene.actors).toHaveLength(10); expect(result.scene.actors.flatMap(a => a.primitives)).toHaveLength(50);
  expect(result.initial.world.defenders).toHaveLength(9); expect(result.initial.bindings).toHaveLength(9);
  expect(result.actor.defenderBindings).toHaveLength(9); expect(result.actor.binding.playerId).toBe(declaration.clocks[1].defenders[0].playerId);
  expect(result.initial.world.defenders.map(d => d.playerId)).toEqual(declaration.clocks[0].defenders.map(p => p.playerId));
  expect(result.models.every(m => m.observation.source.calibration.memoryDecayParameters.ticksPerSecond === 1e6
    && m.locomotion.source.calibration.maxIntegrationStepTicks === 2000)).toBe(true);
  expect(result.materializations.filter(m => m.source.role === 'pitcher').map(m => m.releaseGeometry?.body.heightMeters)).toEqual([1.8, 1.8]);
  expect(result.nativeLiveExecution).toBe(false); expect(result.nativeMatchReady).toBe(false); expect(result.officialResult).toBeNull();
  expect(JSON.stringify(declaration)).toBe(original);
  const before = audit(path);
  const reopened = readAuthoredNativeMatchV1(path, result.readPins);
  expect(reopened).toEqual({ initial: result.initial, actor: result.actor, models: result.models, materializations: result.materializations, scene: result.scene });
  expect(audit(path)).toEqual(before);
  expect(() => readAuthoredNativeMatchV1(path, { ...result.readPins, game: { ...result.readPins.game, gameDay: declaration.gameDay + 1 } })).toThrow();
  expect(audit(path)).toEqual(before);
  expect(() => initializeAuthoredNativeMatchV1(path, declaration)).toThrow();
  expect(audit(path)).toEqual(before);
  const evidencePath = process.env.BASEBALL_AUTHORED_GENESIS_EVIDENCE;
  if (evidencePath) {
    mkdirSync(evidencePath, { recursive: false });
    const db = new Native(path, { readOnly: true }), copy = join(evidencePath, 'genesis.sqlite');
    try { db.prepare('VACUUM INTO ?').run(copy); } finally { db.close(); }
    writeFileSync(join(evidencePath, 'declaration.json'), JSON.stringify(declaration, null, 2), { flag: 'wx' });
    writeFileSync(join(evidencePath, 'accepted-sources.json'), JSON.stringify(result.acceptedSources, null, 2), { flag: 'wx' });
    writeFileSync(join(evidencePath, 'read-pins.json'), JSON.stringify(result.readPins, null, 2), { flag: 'wx' });
    writeFileSync(join(evidencePath, 'expected-readback.json'), JSON.stringify(reopened), { flag: 'wx' });
    writeFileSync(join(evidencePath, 'manifest.json'), JSON.stringify({ status: 'NATIVE_INITIAL_WORLD_AND_BODY_MODELS_REOPENED',
      databaseHash: sha(copy), ownerMocks: false, sameProcessNewConnections: true, independentProcessReopen: false,
      models: 18, materializations: 19, sceneActors: 10, scenePrimitives: 50, defenders: 9, physicalActor: true,
      authoring: declaration.authority, nativeLiveExecution: false, nativeMatchReady: false, officialResult: null,
      sourceHash: sha(new URL('./AuthoredNativeMatchV1.ts', import.meta.url)) }, null, 2), { flag: 'wx' });
  }
}, 120000);

it('rejects mixed namespaces, repeated people and a fabricated score before creating the new DB', () => {
  for (const mutate of [
    (d: any) => { d.clocks[1].namespace = 'another-namespace'; },
    (d: any) => { d.intakes[1].personId = d.intakes[0].personId; },
    (d: any) => { d.match.score.home = 1; },
    (d: any) => { d.clocks[1] = d.clocks[0]; },
  ]) {
    const d = structuredClone(authoredNativeMatchFixture()), path = temp(); mutate(d);
    expect(() => initializeAuthoredNativeMatchV1(path, d)).toThrow(); expect(existsSync(path)).toBe(false);
  }
});

it('keeps missing original schema read-only instead of creating replacement Native tables', () => {
  const path = temp(), db = new Native(path); db.exec('CREATE TABLE marker (value TEXT); INSERT INTO marker VALUES (\'retained\')'); db.close();
  const before = sha(path);
  expect(() => readAuthoredNativeMatchV1(path, { initialWorldSourceId: 'absent', sceneSourceId: 'absent', actorSourceId: 'absent', models: [], materializations: [],
    game: { gameId: 'absent', careerId: 'absent', competitionEditionId: 'absent', gameDay: 0, homeClubId: 'a', awayClubId: 'b', fixtureEventId: 'absent' } })).toThrow('schema');
  expect(sha(path)).toBe(before);
});
