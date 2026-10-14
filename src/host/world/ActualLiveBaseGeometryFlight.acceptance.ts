import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { closeSync, constants, copyFileSync, fsyncSync, mkdtempSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { geometryClosed, geometryFileHash, geometryRows } from './ActualLiveBaseGeometryContinuation.test-support';
import { witnessSqliteWrite } from './SqliteWriteWitness.test-support';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';
import { withBattedWorldPhysicalReadTraversal } from './SqliteBattedWorldFieldExecutionStore';
import { readPhysicalPitchProgressFromSqlite } from './PhysicalPitchEvidenceFromSqlite';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { openSqlitePhysicalPitchProgressStore } from './SqlitePhysicalPitchProgressStore';
import { battedBallFlightEvidenceFromSqlite, openSqliteBattedBallFlightStore, type AcceptedBattedBallFlight, type DurableBattedBallFlight } from './SqliteBattedBallFlightStore';
import { battedWorldFrameBaseCenters } from './SqliteBattedWorldBaseGeometryStore';
import { SqliteOfficialStateStore } from '../SqliteOfficialStateStore';
import { SqliteOfficialParticipationStore } from './SqliteOfficialParticipationStore';
import { openSqliteOfficialInitialWorldStore } from './SqliteOfficialInitialWorldStore';
import { openSqlitePlayerPersonLinkStore } from './SqlitePlayerPersonLinkStore';
import { openSqlitePlayerWorkloadRecoveryStore } from './SqlitePlayerWorkloadRecoveryStore';
import { openSqlitePlayerPitchTimingStore } from './SqlitePlayerPitchTimingStore';
import { openSqlitePlayerReleaseGeometryStore } from './SqlitePlayerReleaseGeometryStore';
import { openSqlitePitchFatiguePolicyStore } from './SqlitePitchFatiguePolicyStore';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
type Pin = Readonly<{ path: string; sha256: string }>;
type Input = Readonly<{ schema: string; input: Pin; receipt: Pin; terminal: Pin; precedingConfig: Pin;
  swingSourceHash: string; swingSnapshotHash: string; originalFlightSourceHash: string;
  flight: AcceptedBattedBallFlight; expectedCenters: unknown }>;
const preserveFlightOnlyDelta = (before: ReturnType<typeof geometryRows>, after: ReturnType<typeof geometryRows>, flight: DurableBattedBallFlight) => {
  const expected = structuredClone(before), tables = expected.tables;
  const append = (table: string, row: object) => {
    const rowid = Math.max(0, ...tables[table].map(bytes => Number(JSON.parse(bytes).__rowid))) + 1;
    tables[table].push(json({ __rowid: rowid, ...row }));
  };
  append('batted_ball_flights', { source_id: flight.source.sourceId, physical_pitch_source_id: flight.source.physicalPitchSourceId,
    game_id: flight.physicalPitch.frame.gameId, play_id: flight.physicalPitch.frame.match.playId, revision: flight.revision,
    previous_source_id: flight.source.previousFlightSourceId, source_json: json(flight.source), source_hash: hash(flight.source),
    snapshot_json: json(flight), snapshot_hash: hash(flight) });
  append('batted_ball_flight_heads', { physical_pitch_source_id: flight.source.physicalPitchSourceId, source_id: flight.source.sourceId, revision: flight.revision });
  assert.deepEqual(after, expected, 'flight gate changed another rowid, schema, head or admission');
};

/** Observe the exact real owner connection and the two concrete writer statements.
 * No SQL, argument, returned statement/result, or production callback is replaced. */
const observeFlightWriter = <T>(work: () => T) => {
  const descriptor = Object.getOwnPropertyDescriptor(DatabaseSync.prototype, 'prepare')!;
  const prepare = DatabaseSync.prototype.prepare;
  const changes = (db: InstanceType<typeof DatabaseSync>) => Number(Reflect.apply(prepare, db, ['SELECT total_changes() AS n']).get()!.n);
  let owner: InstanceType<typeof DatabaseSync> | null = null, before = -1;
  const writes: { owner: 'flight' | 'head'; totalChanges: number }[] = [];
  const capture: typeof prepare = function (this: InstanceType<typeof DatabaseSync>, ...args: Parameters<typeof prepare>) {
    if (owner === null && args[0] === 'SELECT * FROM batted_ball_flights WHERE source_id=?') { owner = this; before = changes(this); }
    return Reflect.apply(prepare, this, args);
  };
  Object.defineProperty(DatabaseSync.prototype, 'prepare', { ...descriptor, value: capture });
  const flight = witnessSqliteWrite('INSERT INTO batted_ball_flights VALUES (?,?,?,?,?,?,?,?,?,?)', db => {
    assert.equal(db, owner); writes.push({ owner: 'flight', totalChanges: changes(db) }); return true;
  });
  const head = witnessSqliteWrite(/^INSERT INTO batted_ball_flight_heads VALUES/, db => {
    assert.equal(db, owner); writes.push({ owner: 'head', totalChanges: changes(db) }); return true;
  });
  try {
    const value = work(); assert(owner, 'actual flight owner connection was not observed');
    const after = changes(owner);
    return { value, counters: { before, after, delta: after - before, writes,
      flightInsertWitness: flight.wasReached(), headInsertWitness: head.wasReached() } };
  } finally {
    try { head.close(); } finally {
      try { flight.close(); } finally {
        const unchanged = DatabaseSync.prototype.prepare === capture;
        Object.defineProperty(DatabaseSync.prototype, 'prepare', descriptor);
        assert(unchanged, 'flight writer observer changed during its scope');
      }
    }
  }
};

it('GEO-F01 reads actual-live setup centers after one genuine zero-horizon flight from the reauthenticated SWING', () => {
  const manifest = process.env.ACTUAL_LIVE_GEOMETRY_FLIGHT_INPUT; assert(manifest, 'explicit pinned retained-SWING input required');
  const m = JSON.parse(readFileSync(manifest, 'utf8')) as Input; assert.equal(m.schema, 'actual_live_geometry_flight_input_v1');
  const pins = [m.input, m.receipt, m.terminal, m.precedingConfig];
  const checkPins = () => { for (const pin of pins) assert.equal(geometryFileHash(pin.path), pin.sha256); };
  checkPins(); geometryClosed(m.input.path);
  const receipt = JSON.parse(readFileSync(m.receipt.path, 'utf8')), terminal = JSON.parse(readFileSync(m.terminal.path, 'utf8'));
  assert.equal(receipt.schema, 'actual_live_geometry_recovered_swing_v1'); assert.equal(receipt.destinationSha256, m.input.sha256);
  assert.equal(receipt.sourceHash, m.swingSourceHash); assert.equal(receipt.snapshotHash, m.swingSnapshotHash);
  assert.equal(receipt.nativeReplay, true); assert.equal(receipt.authorityFreeRetry, true); assert.equal(receipt.allConnectionsClosedReopened, true);
  assert.equal(receipt.zeroWriteRetry, true); assert.deepEqual(receipt.exactAdditions, { physicalPitch: 1, physicalHeadUpdates: 1, admission: 0, flight: 0 });
  assert.equal(terminal.status, 'passed'); assert.equal(terminal.originalChildExit, 0); assert.deepEqual(terminal.remainingOwnedProcesses, []);
  assert.deepEqual(terminal.before, terminal.after); assert.equal(terminal.configSha256, m.precedingConfig.sha256);
  assert.equal(terminal.groupChildExits.length, terminal.ownedIdentities.length);
  for (const identity of terminal.ownedIdentities) {
    const exits = terminal.groupChildExits.filter((exit: { identity: number[] }) => json(exit.identity) === json(identity));
    assert.equal(exits.length, 1); assert.equal(exits[0].exitCode, 0); assert.equal(exits[0].rawWaitStatus, 0);
  }
  assert.deepEqual([m.flight.sourceId, m.flight.sourceVersion, m.flight.physicalPitchSourceId, m.flight.previousFlightSourceId, m.flight.searchDurationTicks],
    ['fixture-next-actual-setup-flight', 'fixture-setup-routing-v1', 'fixture-next-actual-setup-swing', null, 0]);
  const directory = mkdtempSync(join(tmpdir(), 'actual-geometry-flight-')), path = join(directory, 'flight.sqlite');
  const checkpoint = (phase: string, evidence: object) => {
    const file = join(directory, `${phase}.checkpoint.json`);
    writeFileSync(file, `${json({ schema: 'actual_geometry_flight_phase_checkpoint_v1', phase, at: new Date().toISOString(),
      manifestSha256: geometryFileHash(manifest), independentlyQualified: false, ...evidence })}\n`, { flag: 'wx' });
    const fd = openSync(file, 'r'); try { fsyncSync(fd); } finally { closeSync(fd); }
    const folder = openSync(directory, 'r'); try { fsyncSync(folder); } finally { closeSync(folder); }
  };
  copyFileSync(m.input.path, path, constants.COPYFILE_EXCL); assert.equal(geometryFileHash(path), m.input.sha256);
  const resources: { close(): void }[] = [], track = <T extends { close(): void }>(value: T): T => { resources.push(value); return value; };
  const drain = () => { while (resources.length) resources.pop()!.close(); };
  try {
    let db = track(new DatabaseSync(path)); const before = geometryRows(db);
    checkpoint('reauthentication-start', { rowsHash: hash(before) });
    const original = withSqliteReadTransaction(db, () => withBattedWorldPhysicalReadTraversal(db, () => {
      const history = readPhysicalPitchProgressFromSqlite(db, 'game-1', 8); assert.equal(history.length, 2);
      const swing = history[1]; assert.equal(swing.source.sourceId, m.flight.physicalPitchSourceId);
      assert.equal(hash(swing.source), m.swingSourceHash); assert.equal(hash(swing), m.swingSnapshotHash);
      assert.equal(swing.result.pitch.resolution.timeline.status.kind, 'batted_ball_pending');
      assert.deepEqual(swing.beforeTimeline, history[0].result.pitch.resolution.timeline);
      const contacts = swing.result.pitch.resolution.timeline.events.slice(swing.beforeTimeline.events.length).filter(e => e.kind === 'BatBallContact');
      assert.equal(contacts.length, 1); assert.equal(contacts[0].sequence, 2); assert.equal(contacts[0].tick, 35_470_251);
      const prior = battedBallFlightEvidenceFromSqlite(db).read('flight-1'); assert(prior);
      assert.equal(hash(prior.source), m.originalFlightSourceHash); assert.deepEqual(m.flight.execution, prior.source.execution);
      assert.equal(db.prepare('SELECT count(*) AS n FROM actual_live_play_runtimes WHERE game_id=? AND play_id=?').get('game-1', 8)!.n, 0);
      assert.equal(db.prepare('SELECT count(*) AS n FROM batted_ball_flights WHERE physical_pitch_source_id=?').get(swing.source.sourceId)!.n, 0);
      return swing;
    }));
    checkpoint('reauthentication-returned', { valueHash: hash(original), rowsHash: hash(geometryRows(db)) });
    const actor = original.frame.batterActor!, binding = actor.binding, game = actor.worldFixture.game;
    const openSources = () => {
      const links = track(openSqlitePlayerPersonLinkStore(path)), official = track(new SqliteOfficialStateStore(path));
      const participation = track(new SqliteOfficialParticipationStore(path, { readGame: id => id !== 'game-1' ? null : {
        careerId: binding.careerId, competitionEditionId: binding.competitionEditionId, gameDay: binding.gameDay,
        homeClubId: game.homeClubId, awayClubId: game.awayClubId, fixtureEventId: binding.fixtureEventId }, readRoster: () => null,
        readPersonLink: (playerId, sourceId) => { const link = links.readLink(sourceId); return link?.playerId === playerId ? { sourceId, personId: link.personId } : null; } }));
      const initialWorlds = track(openSqliteOfficialInitialWorldStore(path, { matches: official, participation }));
      const workload = track(openSqlitePlayerWorkloadRecoveryStore(path, links)), timing = track(openSqlitePlayerPitchTimingStore(path, links));
      const release = track(openSqlitePlayerReleaseGeometryStore(path, links)), policies = track(openSqlitePitchFatiguePolicyStore(path));
      const runtime = { workload, timing, release, policies, effortPolicies: { readAcceptedPolicy: (id: string) => id === original.source.effortPolicy.sourceId ? original.source.effortPolicy : null } };
      return track(openSqlitePhysicalPitchProgressStore(path, { matches: official, participation, initialWorlds, runtime }));
    };
    let pitches = openSources();
    const flights = track(openSqliteBattedBallFlightStore(path, pitches, { readAcceptedFlight: id => id === m.flight.sourceId ? m.flight : null }));
    checkpoint('genuine-flight-accept-start', { acceptedSourceHash: hash(m.flight) });
    const accepted = observeFlightWriter(() => flights.accept(m.flight.sourceId)), flight = accepted.value;
    assert.equal(accepted.counters.delta, 2);
    assert.deepEqual(accepted.counters.writes, [{ owner: 'flight', totalChanges: accepted.counters.before + 1 },
      { owner: 'head', totalChanges: accepted.counters.before + 2 }]);
    assert.equal(accepted.counters.flightInsertWitness, true); assert.equal(accepted.counters.headInsertWitness, true);
    checkpoint('genuine-flight-accept-returned', { writer: accepted.counters, valueHash: hash(flight), rowsHash: hash(geometryRows(db)) });
    assert.equal(json(flight.physicalPitch), json(original)); assert.equal(flight.revision, 1);
    assert.deepEqual(flight.source, m.flight); preserveFlightOnlyDelta(before, geometryRows(db), flight);
    const after = geometryRows(db); drain(); geometryClosed(path);
    checkpoint('all-flight-connections-closed', { databaseSha256: geometryFileHash(path) });
    db = track(new DatabaseSync(path)); pitches = openSources();
    const reopened = track(openSqliteBattedBallFlightStore(path, pitches));
    checkpoint('authority-free-flight-retry-start', { rowsHash: hash(geometryRows(db)) });
    const retry = observeFlightWriter(() => reopened.accept(m.flight.sourceId)), retried = retry.value;
    assert.equal(retry.counters.delta, 0); assert.deepEqual(retry.counters.writes, []);
    assert.equal(retry.counters.flightInsertWitness, false); assert.equal(retry.counters.headInsertWitness, false);
    checkpoint('authority-free-flight-retry-returned', { writer: retry.counters, valueHash: hash(retried), rowsHash: hash(geometryRows(db)) });
    assert.equal(json(retried), json(flight)); assert.deepEqual(geometryRows(db), after);
    drain(); geometryClosed(path); checkPins();
    writeFileSync(join(directory, 'flight-prerequisites.json'), `${json({ schema: 'actual_live_geometry_flight_prerequisites_v1',
      manifestSha256: geometryFileHash(manifest), inputSha256: m.input.sha256, destinationPath: path, destinationSha256: geometryFileHash(path),
      acceptedSourceHash: hash(m.flight), flightHash: hash(flight), physicalSourceHash: hash(original.source), physicalSnapshotHash: hash(original),
      beforeRowsHash: hash(before), afterRowsHash: hash(after), exactAdditions: { flight: 1, flightHead: 1, pitch: 0, admission: 0 },
      allConnectionsClosedReopened: true, authorityFreeRetry: true, zeroWriteRetry: true,
      freshWriter: accepted.counters, retryWriter: retry.counters, geometryRedObserved: false,
      originalConstructionProven: false, newSwingConstructionProven: false, repeatedEpisodeBindingProven: false })}\n`, { flag: 'wx' });
    const receiptFile = openSync(join(directory, 'flight-prerequisites.json'), 'r');
    try { fsyncSync(receiptFile); } finally { closeSync(receiptFile); }
    const receiptFolder = openSync(directory, 'r'); try { fsyncSync(receiptFolder); } finally { closeSync(receiptFolder); }
    db = track(new DatabaseSync(path)); checkpoint('fresh-flight-read-and-geometry-start', { rowsHash: hash(geometryRows(db)) });
    try {
      withSqliteReadTransaction(db, () => {
        const fresh = battedBallFlightEvidenceFromSqlite(db).read(m.flight.sourceId); assert(fresh); assert.equal(hash(fresh), hash(flight));
        checkpoint('fresh-flight-read-returned', { valueHash: hash(fresh), rowsHash: hash(geometryRows(db)) });
        expect(battedWorldFrameBaseCenters(db, fresh)).toEqual(m.expectedCenters);
      });
    } catch (error) { checkpoint('geometry-assertion-threw', { message: error instanceof Error ? error.message : String(error) }); throw error; }
    finally { assert.deepEqual(geometryRows(db), after); drain(); geometryClosed(path); checkPins(); }
  } finally { drain(); checkPins(); }
});
