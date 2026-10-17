import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { deepStrictEqual, strictEqual } from 'node:assert';
import { readAuthoredNativeMatchV1, type AuthoredNativeMatchReadPinsV1 } from '../../../src/integration/native-game/AuthoredNativeMatchV1';

// Run against a private copy of the immutable closed genesis evidence. Native
// constructors may change SQLite journal/header bytes when opening a new copy;
// original schemas and ALL logical rows must remain exactly unchanged.
const [databasePath, pinsPath, expectedPath, reportPath] = process.argv.slice(2);
if (!databasePath || !pinsPath || !expectedPath || !reportPath) throw new Error('requires database pins expected report');
const Native = (createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync;
const audit = () => {
  const db = new Native(databasePath, { readOnly: true });
  try {
    strictEqual(db.prepare('PRAGMA integrity_check').get()!.integrity_check, 'ok');
    const schema = db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all();
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
    const rows = tables.map(t => [t.name, db.prepare('SELECT * FROM "' + String(t.name).replaceAll('"', '""') + '"').all().map(r => JSON.stringify(r)).sort()]);
    return { schema, rows };
  } finally { db.close(); }
};
const sha = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const beforeFileHash = sha(readFileSync(databasePath)), before = audit();
const pins = JSON.parse(readFileSync(pinsPath, 'utf8')) as AuthoredNativeMatchReadPinsV1;
const result = readAuthoredNativeMatchV1(databasePath, pins);
deepStrictEqual(JSON.parse(JSON.stringify(result)), JSON.parse(readFileSync(expectedPath, 'utf8')));
deepStrictEqual(audit(), before);
strictEqual(result.models.length, 18); strictEqual(result.materializations.length, 19); strictEqual(result.initial.world.defenders.length, 9);
strictEqual(result.actor.defenderBindings.length, 9); strictEqual(result.scene.actors.flatMap(a => a.primitives).length, 50);
const report = { status: 'PASS_INDEPENDENT_NATIVE_GENESIS_REOPEN', ownerMocks: false, modelAuthorCallbacks: false,
  gameAuthority: 'PINNED_ORIGINAL_GAME_SCOPE_CHECKED_AGAINST_NATIVE_SEASON_FIXTURE_AND_PERSON', schemasAndAllRowsUnchanged: true,
  beforeFileHash, afterFileHash: sha(readFileSync(databasePath)), tableCount: before.rows.length,
  logicalStateSha256: sha(JSON.stringify(before)), expectedReadbackSha256: sha(readFileSync(expectedPath)),
  models: result.models.length, materializations: result.materializations.length, sceneActors: result.scene.actors.length,
  physicalActor: true, nativeLiveExecution: false, nativeMatchReady: false, officialResult: null };
writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
process.stdout.write(JSON.stringify({ status: report.status, tables: report.tableCount, nativeLiveExecution: false }) + '\n');
