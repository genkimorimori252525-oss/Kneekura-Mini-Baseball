import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { constants, copyFileSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, expect, it } from 'vitest';
import { geometryClosed, geometryFileHash, geometryRows } from './ActualLiveBaseGeometryContinuation.test-support';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';
import { battedBallFlightEvidenceFromSqlite, type DurableBattedBallFlight } from './SqliteBattedBallFlightStore';
import { battedWorldFrameBaseCenters } from './SqliteBattedWorldBaseGeometryStore';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
type Pin = { path: string; sha256: string };
type Input = { schema: string; input: Pin; receipt: Pin; terminal: Pin; precedingConfig: Pin; flightHash: string; expectedCenters: unknown };
let input: Input, flight: DurableBattedBallFlight;
const app = 'fixture-actual-live-application', closure = 'fixture-actual-live-closure';
const openCopy = () => {
  const directory = mkdtempSync(join(tmpdir(), 'actual-geometry-routing-')), path = join(directory, 'routing.sqlite');
  copyFileSync(input.input.path, path, constants.COPYFILE_EXCL); assert.equal(geometryFileHash(path), input.input.sha256);
  const db = new DatabaseSync(path);
  return { db, close() { db.close(); geometryClosed(path); assert.equal(geometryFileHash(input.input.path), input.input.sha256); } };
};
beforeAll(() => {
  const manifest = process.env.ACTUAL_LIVE_GEOMETRY_ROUTING_INPUT; assert(manifest, 'explicit pinned genuine flight required');
  input = JSON.parse(readFileSync(manifest, 'utf8')) as Input; assert.equal(input.schema, 'actual_live_setup_routing_input_v1');
  for (const pin of [input.input, input.receipt, input.terminal, input.precedingConfig]) assert.equal(geometryFileHash(pin.path), pin.sha256);
  const receipt = JSON.parse(readFileSync(input.receipt.path, 'utf8')), terminal = JSON.parse(readFileSync(input.terminal.path, 'utf8'));
  assert.equal(receipt.destinationSha256, input.input.sha256); assert.equal(receipt.flightHash, input.flightHash);
  assert.equal(receipt.freshWriter.delta, 2); assert.equal(receipt.retryWriter.delta, 0);
  assert.equal(receipt.allConnectionsClosedReopened, true); assert.equal(receipt.authorityFreeRetry, true);
  assert.equal(terminal.status, 'passed'); assert.equal(terminal.originalChildExit, 1);
  assert.equal(terminal.tests.expectedFailedCases, 1); assert.equal(terminal.tests.passedCases, 0); assert.deepEqual(terminal.tests.skipped, []);
  assert.deepEqual(terminal.remainingOwnedProcesses, []); assert.deepEqual(terminal.before, terminal.after);
  assert.equal(terminal.configSha256, input.precedingConfig.sha256);
  geometryClosed(input.input.path); const x = openCopy();
  try {
    flight = withSqliteReadTransaction(x.db, () => battedBallFlightEvidenceFromSqlite(x.db).read('fixture-next-actual-setup-flight'))!;
    assert(flight); assert.equal(hash(flight), input.flightHash); assert.equal(flight.source.searchDurationTicks, 0);
    assert.equal(flight.physicalPitch.frame.batterActor!.binding.playerId, 'away-2');
  } finally { x.close(); }
}, 180_000);

it('GEO-G01 authenticates the actual-live setup in a Native snapshot with exactly zero writes', () => {
  const x = openCopy();
  try {
    const before = geometryRows(x.db), changes = x.db.prepare('SELECT total_changes() AS n').get()!.n;
    expect(withSqliteReadTransaction(x.db, () => battedWorldFrameBaseCenters(x.db, flight))).toEqual(input.expectedCenters);
    expect(geometryRows(x.db)).toEqual(before); expect(x.db.prepare('SELECT total_changes() AS n').get()!.n).toBe(changes);
    expect(x.db.isTransaction).toBe(false); expect(x.db.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
  } finally { x.close(); }
});
it('GEO-G02 owns and restores its Native read snapshot for a reopened autocommit caller', () => {
  const x = openCopy();
  try {
    const before = geometryRows(x.db), changes = x.db.prepare('SELECT total_changes() AS n').get()!.n;
    expect(battedWorldFrameBaseCenters(x.db, flight)).toEqual(input.expectedCenters);
    expect(geometryRows(x.db)).toEqual(before); expect(x.db.prepare('SELECT total_changes() AS n').get()!.n).toBe(changes);
    expect(x.db.isTransaction).toBe(false); expect(x.db.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
  } finally { x.close(); }
});
const competingScore = (db: InstanceType<typeof DatabaseSync>, hidden = false) => {
  // Adversarial claims only: this transaction must be rejected and rolled back.
  assert.equal(db.prepare('PRAGMA foreign_keys').get()!.foreign_keys, 1);
  if (hidden) {
    db.prepare('INSERT INTO matches(match_id,durable_revision,state_json,activation_json) VALUES (?,?,?,?)')
      .run('fault-foreign-game', 0, json({ playId: 999 }), null);
    db.prepare('INSERT INTO applications(application_id,match_id,closure_id,request_hash,result_json) VALUES (?,?,?,?,?)')
      .run('fault-foreign-application', 'fault-foreign-game', 'fault-foreign-parent', 'adversarial-untrusted-hash',
        json({ receipt: { applicationId: 'fault-foreign-application', closureId: 'fault-foreign-parent', previousPlayId: 999 } }));
  }
  const officialId = hidden ? 'fault-foreign-application' : app;
  db.prepare(`INSERT INTO official_scoring_applications(scoring_application_id,match_id,official_application_id,
    closure_id,source_event_id,request_json,result_json) VALUES (?,?,?,?,?,?,?)`).run('fault-score', 'game-1', officialId,
    'fault-close', 'fault-event', json({ input: { officialApplication: { applicationId: app,
      worldSetup: { baseCenters: input.expectedCenters } } } }), '{}');
  const inserted = db.prepare('SELECT match_id,official_application_id FROM official_scoring_applications WHERE scoring_application_id=?').get('fault-score');
  assert.deepEqual({ ...inserted }, { match_id: 'game-1', official_application_id: officialId });
};
const faults: [string, (db: InstanceType<typeof DatabaseSync>) => void][] = [
  ['missing owner', db => { db.prepare('DELETE FROM actual_live_play_closures WHERE source_id=?').run(closure); }],
  ['missing owner cannot fall back to a scoring claim', db => { db.prepare('DELETE FROM actual_live_play_closures WHERE source_id=?').run(closure); competingScore(db); }],
  ['foreign application mirror', db => { db.prepare("UPDATE actual_live_play_closures SET application_id='foreign' WHERE source_id=?").run(closure); }],
  ['hidden duplicate application key', db => { db.prepare('UPDATE actual_live_play_closures SET application_id=?,source_json=? WHERE source_id=?')
    .run('foreign', `{"applicationId":"${app}","applicationId":"foreign"}`, closure); }],
  ['competing actual owner', db => {
    const row = db.prepare('SELECT * FROM actual_live_play_closures WHERE source_id=?').get(closure)!;
    const changed = { ...row, source_id: 'fault-duplicate', application_id: 'foreign', play_id: 999 };
    const columns = Object.keys(changed); assert(columns.every(c => /^[a-z_]+$/.test(c)));
    db.prepare(`INSERT INTO actual_live_play_closures (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`).run(...Object.values(changed));
  }],
  ['changed accepted setup', db => { db.prepare("UPDATE actual_live_play_closures SET source_json=json_set(source_json,'$.worldSetup.baseCenters.first.x',28) WHERE source_id=?").run(closure); }],
  ['changed source hash', db => { db.prepare("UPDATE actual_live_play_closures SET source_hash='changed' WHERE source_id=?").run(closure); }],
  ['changed proposal', db => { db.prepare("UPDATE actual_live_play_closures SET proposal_json=json_set(proposal_json,'$.expectedOfficial.nextWorld.tick',1) WHERE source_id=?").run(closure); }],
  ['changed application', db => { db.prepare("UPDATE applications SET result_json=json_set(result_json,'$.nextWorld.tick',1) WHERE application_id=?").run(app); }],
  ['changed fixture', db => { db.prepare("UPDATE official_fixtures SET fixture_event_id='foreign' WHERE game_id='game-1'").run(); }],
  ['mixed scoring owner', db => competingScore(db)],
  ['hidden mixed scoring owner', db => competingScore(db, true)],
];
it.each(faults)('GEO-G03 rejects %s without fallback or helper writes', (_name, mutate) => {
  const x = openCopy();
  try {
    const before = geometryRows(x.db); x.db.exec('BEGIN IMMEDIATE'); mutate(x.db);
    const changed = geometryRows(x.db); expect(json(changed)).not.toBe(json(before));
    const changes = x.db.prepare('SELECT total_changes() AS n').get()!.n;
    const rejection = _name === 'mixed scoring owner' || _name === 'hidden mixed scoring owner'
      ? 'actual setup scoring claim lacks its unique owner'
      : _name.startsWith('missing owner') ? 'actual live setup owner is missing or ambiguous' : undefined;
    expect(() => battedWorldFrameBaseCenters(x.db, flight)).toThrow(rejection);
    expect(x.db.isTransaction).toBe(true); expect(x.db.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
    expect(geometryRows(x.db)).toEqual(changed); expect(x.db.prepare('SELECT total_changes() AS n').get()!.n).toBe(changes);
    x.db.exec('ROLLBACK'); expect(geometryRows(x.db)).toEqual(before);
  } finally { if (x.db.isTransaction) x.db.exec('ROLLBACK'); x.close(); }
});
it.each(['world', 'fixture', 'readiness', 'missing readiness'] as const)('GEO-G04 rejects an unbound %s frame', kind => {
  const x = openCopy();
  try {
    const wrong = JSON.parse(json(flight)) as DurableBattedBallFlight;
    const frame = wrong.physicalPitch.frame as unknown as { world: { tick: number }; batterActor: { fixtureHash: string; origin: { actualLiveReadiness?: { closureSourceId: string } } } };
    if (kind === 'world') frame.world.tick++;
    if (kind === 'fixture') frame.batterActor.fixtureHash = 'foreign';
    if (kind === 'readiness') frame.batterActor.origin.actualLiveReadiness!.closureSourceId = 'foreign';
    if (kind === 'missing readiness') delete frame.batterActor.origin.actualLiveReadiness;
    expect(() => battedWorldFrameBaseCenters(x.db, wrong)).toThrow();
  } finally { x.close(); }
});
it('GEO-G05 rejects a prepare-only facade for actual-live authentication', () => {
  const x = openCopy(); try { expect(() => battedWorldFrameBaseCenters({ prepare: x.db.prepare.bind(x.db) }, flight)).toThrow(); }
  finally { x.close(); }
});
it('GEO-G06 preserves historical setup after genuine accepted day-level workload recovery', async () => {
  const x = openCopy();
  const { openSqlitePlayerPersonLinkStore } = await import('./SqlitePlayerPersonLinkStore');
  const { openSqlitePlayerWorkloadRecoveryStore } = await import('./SqlitePlayerWorkloadRecoveryStore');
  const path = String(x.db.prepare('PRAGMA database_list').all().find(row => row.name === 'main')!.file);
  const original = flight.physicalPitch.frame.workload;
  const activity = { sourceEventId: 'fixture-geometry-history-recovery', sourceVersion: 'fixture-v1', evidenceId: 'explicit-fixture-recovery',
    careerId: original.careerId, playerId: original.playerId, atDay: flight.physicalPitch.frame.bindings[0].gameDay,
    kind: 'RECOVERY' as const, durationHours: 1, quality: 1, medicalAvailability: 1 };
  const links = openSqlitePlayerPersonLinkStore(path);
  const workload = openSqlitePlayerWorkloadRecoveryStore(path, links, { readAcceptedBaseline: () => null,
    readAcceptedActivity: id => id === activity.sourceEventId ? activity : null });
  try {
    expect(workload.apply(activity.sourceEventId, original.revision).revision).toBe(original.revision + 1);
    const before = geometryRows(x.db), changes = x.db.prepare('SELECT total_changes() AS n').get()!.n;
    expect(battedWorldFrameBaseCenters(x.db, flight)).toEqual(input.expectedCenters);
    expect(geometryRows(x.db)).toEqual(before); expect(x.db.prepare('SELECT total_changes() AS n').get()!.n).toBe(changes);
  } finally { workload.close(); links.close(); x.close(); }
});
it('GEO-G07 rejects rollback and rebegin within its actual-live read bracket', () => {
  const x = openCopy(), original = x.db.prepare, before = geometryRows(x.db); let reached = false;
  Object.defineProperty(x.db, 'prepare', { configurable: true, value: function (sql: string) {
    if (!reached && sql.startsWith('SELECT * FROM actual_live_play_closures WHERE application_id=')) {
      reached = true; x.db.exec('ROLLBACK; BEGIN');
    }
    return Reflect.apply(original, x.db, [sql]);
  } });
  try {
    expect(() => battedWorldFrameBaseCenters(x.db, flight)).toThrow(); expect(reached).toBe(true);
    expect(x.db.isTransaction).toBe(false); expect(x.db.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
    expect(geometryRows(x.db)).toEqual(before);
  } finally { Reflect.deleteProperty(x.db, 'prepare'); if (x.db.isTransaction) x.db.exec('ROLLBACK'); x.close(); }
});
