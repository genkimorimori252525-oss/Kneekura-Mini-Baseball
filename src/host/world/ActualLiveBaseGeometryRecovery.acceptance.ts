import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { appendFileSync, closeSync, constants, copyFileSync, existsSync, fsyncSync, mkdtempSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { it } from 'vitest';
import { geometryClosed, geometryFileHash, geometryRows } from './ActualLiveBaseGeometryContinuation.test-support';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';
import { withBattedWorldPhysicalReadTraversal } from './SqliteBattedWorldFieldExecutionStore';
import { readPhysicalPitchProgressFromSqlite } from './PhysicalPitchEvidenceFromSqlite';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { openSqlitePhysicalPitchProgressStore, type DurablePhysicalPitch } from './SqlitePhysicalPitchProgressStore';
import { SqliteOfficialStateStore } from '../SqliteOfficialStateStore';
import { SqliteOfficialParticipationStore } from './SqliteOfficialParticipationStore';
import { openSqliteOfficialInitialWorldStore } from './SqliteOfficialInitialWorldStore';
import { openSqlitePlayerPersonLinkStore } from './SqlitePlayerPersonLinkStore';
import { openSqlitePlayerWorkloadRecoveryStore } from './SqlitePlayerWorkloadRecoveryStore';
import { openSqlitePlayerPitchTimingStore } from './SqlitePlayerPitchTimingStore';
import { openSqlitePlayerReleaseGeometryStore } from './SqlitePlayerReleaseGeometryStore';
import { openSqlitePitchFatiguePolicyStore } from './SqlitePitchFatiguePolicyStore';
const { DatabaseSync, backup } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
type Pin = Readonly<{ path: string; sha256: string; bytes?: number }>;
type Input = Readonly<{ schema: string; baseline: Pin; tuple: Record<'main' | 'wal' | 'shm', Pin>;
  failedTerminal: Pin; declaredAction: Pin; failedConfig: Pin; inventory: Pin;
  sourceHash: string; snapshotHash: string }>;
const sourceId = 'fixture-next-actual-setup-swing';

const assertSwingOnlyDelta = (baseline: ReturnType<typeof geometryRows>, current: ReturnType<typeof geometryRows>, swing: DurablePhysicalPitch) => {
  const expected = structuredClone(baseline), t = expected.tables;
  const next = Math.max(0, ...t.physical_pitch_progress_actions.map(bytes => Number(JSON.parse(bytes).__rowid))) + 1;
  t.physical_pitch_progress_actions.push(json({ __rowid: next, source_id: swing.source.sourceId, game_id: swing.frame.gameId,
    play_id: swing.frame.match.playId, progress_revision: swing.progressRevision, source_json: json(swing.source),
    source_hash: hash(swing.source), snapshot_json: json(swing), snapshot_hash: hash(swing) }));
  let heads = 0;
  t.physical_pitch_progress_heads = t.physical_pitch_progress_heads.map(bytes => {
    const row = JSON.parse(bytes);
    if (row.game_id !== 'game-1' || row.play_id !== 8) return bytes;
    assert.equal(row.revision, 1); assert.equal(row.last_source_id, 'fixture-next-actual-pitch'); heads++;
    return json({ ...row, revision: 2, last_source_id: sourceId });
  });
  assert.equal(heads, 1);
  assert.deepEqual(current, expected, 'recovery changed schema, rowids, old rows or added an unexpected owner/admission/flight');
};

/** Passive same-Native-connection census: statements, arguments and returned
 * objects are untouched. There is no validation cache or result substitution. */
const prepareCensus = (record: (value: object) => void) => {
  const descriptor = Object.getOwnPropertyDescriptor(DatabaseSync.prototype, 'prepare')!;
  const original = DatabaseSync.prototype.prepare, started = performance.now();
  const counts = new Map<string, { sqlHash: string; prepares: number; connection: number }>();
  const connections = new WeakMap<object, number>(); let nextConnection = 0, total = 0, overflow = 0, phase = 'installed';
  const checkpoint = (name: string, detailed = true) => { phase = name; record({ kind: 'native-prepare-census', phase, elapsedMs: performance.now() - started,
    prepares: total, overflow, connections: nextConnection, queries: [...counts.values()].sort((a, b) => b.prepares - a.prepares).slice(0, detailed ? 4096 : 64) }); };
  const instrumented: typeof original = function (this: InstanceType<typeof DatabaseSync>, sql: string) {
    let connection = connections.get(this); if (connection === undefined) { connection = ++nextConnection; connections.set(this, connection); }
    const key = `${connection}:${sql}`, known = counts.get(key);
    if (known) known.prepares++;
    else if (counts.size < 4096) counts.set(key, { sqlHash: createHash('sha256').update(sql).digest('hex'), prepares: 1, connection });
    else overflow++;
    total++; if (total % 10_000 === 0) checkpoint(phase, false);
    return Reflect.apply(original, this, [sql]);
  };
  Object.defineProperty(DatabaseSync.prototype, 'prepare', { ...descriptor, value: instrumented });
  return { checkpoint, close() {
    const unchanged = DatabaseSync.prototype.prepare === instrumented;
    Object.defineProperty(DatabaseSync.prototype, 'prepare', descriptor);
    assert(unchanged, 'Native prepare census changed during its scope');
  } };
};

it('GEO-C01 reauthenticates the retained SWING with authority-free retry and complete close/reopen', async () => {
  const manifest = process.env.ACTUAL_LIVE_GEOMETRY_RECOVERY_INPUT;
  assert(manifest, 'explicit pinned recovery input required');
  const m = JSON.parse(readFileSync(manifest, 'utf8')) as Input;
  assert.equal(m.schema, 'actual_live_geometry_recovery_input_v1');
  const pins = [m.baseline, ...Object.values(m.tuple), m.failedTerminal, m.declaredAction, m.failedConfig, m.inventory];
  const verifyPins = () => { for (const pin of pins) { assert.equal(geometryFileHash(pin.path), pin.sha256); if (pin.bytes !== undefined) assert.equal(readFileSync(pin.path).length, pin.bytes); } };
  verifyPins();
  const terminal = JSON.parse(readFileSync(m.failedTerminal.path, 'utf8'));
  assert.equal(terminal.status, 'failed'); assert.equal(terminal.originalChildExit, -15);
  assert(terminal.failures.some((failure: { error: string }) => failure.error === "ValueError('wall budget exceeded')"));
  assert.deepEqual(terminal.remainingOwnedProcesses, []); assert.deepEqual(terminal.before, terminal.after);
  assert.equal(terminal.groupChildExits.length, terminal.ownedIdentities.length);
  for (const identity of terminal.ownedIdentities) {
    const exits = terminal.groupChildExits.filter((exit: { identity: number[] }) => json(exit.identity) === json(identity));
    assert.equal(exits.length, 1); assert.equal(exits[0].exitCode, -15); assert.equal(exits[0].rawWaitStatus, 15);
  }
  assert.equal(terminal.configSha256, m.failedConfig.sha256);
  assert.deepEqual(JSON.parse(readFileSync(m.inventory.path, 'utf8')).before, terminal.before);
  const declared = JSON.parse(readFileSync(m.declaredAction.path, 'utf8'));
  assert.equal(declared.kind, 'explicit_fixture_recipe_v1'); assert.equal(declared.autonomousBattingInput, false);
  assert.equal(hash(declared.action), m.sourceHash); assert.equal(declared.actionHash, m.sourceHash);
  assert.equal(declared.action.sourceId, sourceId);
  const directory = mkdtempSync(join(tmpdir(), 'actual-geometry-recovery-'));
  const record = (value: object) => appendFileSync(join(directory, 'phases.jsonl'), `${json({ at: new Date().toISOString(), ...value })}\n`);
  const checkpoint = (phase: string, evidence: object) => {
    const path = join(directory, `${phase}.checkpoint.json`);
    writeFileSync(path, `${json({ schema: 'actual_geometry_recovery_phase_checkpoint_v1', phase, at: new Date().toISOString(),
      manifestSha256: geometryFileHash(manifest), independentlyQualified: false, inheritedCredit: 0, ...evidence })}\n`, { flag: 'wx' });
    const fd = openSync(path, 'r'); try { fsyncSync(fd); } finally { closeSync(fd); }
    const folder = openSync(directory, 'r'); try { fsyncSync(folder); } finally { closeSync(folder); }
    record({ phase: `${phase}-checkpoint-persisted`, sha256: geometryFileHash(path) });
  };
  const resources: { close(): void }[] = [], track = <T extends { close(): void }>(value: T): T => { resources.push(value); return value; };
  const drain = () => { while (resources.length) resources.pop()!.close(); };
  const staged = join(directory, 'staged.sqlite'), recovered = join(directory, 'recovered.sqlite'), baselinePath = join(directory, 'baseline.sqlite');
  let census: ReturnType<typeof prepareCensus> | null = null;
  try {
    record({ phase: 'copy-complete-main-wal-shm-tuple', inheritedCredit: 0 });
    for (const [key, suffix] of [['main', ''], ['wal', '-wal'], ['shm', '-shm']] as const) {
      copyFileSync(m.tuple[key].path, staged + suffix, constants.COPYFILE_EXCL);
      assert.equal(geometryFileHash(staged + suffix), m.tuple[key].sha256);
    }
    assert(!existsSync(recovered));
    const recovery = new DatabaseSync(staged);
    try {
      assert.equal(recovery.prepare('PRAGMA integrity_check').get()!.integrity_check, 'ok');
      await backup(recovery, recovered);
    } finally { recovery.close(); }
    geometryClosed(staged); geometryClosed(recovered); verifyPins();
    checkpoint('native-wal-recovery-and-backup', { recoveredSha256: geometryFileHash(recovered) });
    copyFileSync(m.baseline.path, baselinePath, constants.COPYFILE_EXCL);
    const baselineDb = new DatabaseSync(baselinePath);
    let before: ReturnType<typeof geometryRows>;
    try { before = withSqliteReadTransaction(baselineDb, () => geometryRows(baselineDb)); } finally { baselineDb.close(); }
    geometryClosed(baselinePath);
    let db = track(new DatabaseSync(recovered));
    const candidate = JSON.parse(String(db.prepare('SELECT snapshot_json FROM physical_pitch_progress_actions WHERE source_id=?').get(sourceId)!.snapshot_json)) as DurablePhysicalPitch;
    assert.equal(hash(candidate), m.snapshotHash); assert.equal(hash(candidate.source), m.sourceHash);
    assert.deepEqual(candidate.source, declared.action); assertSwingOnlyDelta(before, geometryRows(db), candidate);
    checkpoint('recovered-raw-delta', { rowsHash: hash(geometryRows(db)), candidateHash: hash(candidate), nativeCredit: 0 });
    census = prepareCensus(record); census.checkpoint('native-replay-start');
    const history = withSqliteReadTransaction(db, () => withBattedWorldPhysicalReadTraversal(db,
      () => readPhysicalPitchProgressFromSqlite(db, 'game-1', 8)));
    checkpoint('native-replay-returned', { valueHash: hash(history), rowsHash: hash(geometryRows(db)) });
    assert.equal(history.length, 2); const [prior, swing] = history;
    assert.equal(prior.source.sourceId, 'fixture-next-actual-pitch'); assert.equal(prior.progressRevision, 1);
    assert.equal(swing.source.sourceId, sourceId); assert.equal(swing.progressRevision, 2);
    assert.equal(hash(swing), m.snapshotHash); assert.equal(json(swing), json(candidate)); assert.deepEqual(swing.source, declared.action);
    assert.deepEqual(swing.frame, prior.frame); assert.deepEqual(swing.beforeTimeline, prior.result.pitch.resolution.timeline);
    assert.equal(swing.frame.batterActor!.binding.playerId, 'away-2');
    assert.equal(swing.result.pitch.resolution.timeline.status.kind, 'batted_ball_pending');
    const priorEvents = prior.result.pitch.resolution.timeline.events, events = swing.result.pitch.resolution.timeline.events;
    assert.deepEqual(events.slice(0, priorEvents.length), priorEvents);
    const contacts = events.slice(priorEvents.length).filter(event => event.kind === 'BatBallContact'); assert.equal(contacts.length, 1);
    assert.equal(contacts[0].sequence, 2); assert.equal(contacts[0].tick, 35_470_251);
    assertSwingOnlyDelta(before, geometryRows(db), swing); census.checkpoint('native-replay-returned');
    const actor = swing.frame.batterActor!, binding = actor.binding, game = actor.worldFixture.game;
    const links = track(openSqlitePlayerPersonLinkStore(recovered)), official = track(new SqliteOfficialStateStore(recovered));
    const participation = track(new SqliteOfficialParticipationStore(recovered, { readGame: id => id !== 'game-1' ? null : {
      careerId: binding.careerId, competitionEditionId: binding.competitionEditionId, gameDay: binding.gameDay,
      homeClubId: game.homeClubId, awayClubId: game.awayClubId, fixtureEventId: binding.fixtureEventId }, readRoster: () => null,
      readPersonLink: (playerId, sourceId) => { const link = links.readLink(sourceId); return link?.playerId === playerId ? { sourceId, personId: link.personId } : null; } }));
    const initialWorlds = track(openSqliteOfficialInitialWorldStore(recovered, { matches: official, participation }));
    const workload = track(openSqlitePlayerWorkloadRecoveryStore(recovered, links)), timing = track(openSqlitePlayerPitchTimingStore(recovered, links));
    const release = track(openSqlitePlayerReleaseGeometryStore(recovered, links)), policies = track(openSqlitePitchFatiguePolicyStore(recovered));
    const runtime = { workload, timing, release, policies, effortPolicies: { readAcceptedPolicy: (id: string) => id === swing.source.effortPolicy.sourceId ? swing.source.effortPolicy : null } };
    // No accepted-action authority is supplied. Only the archived original can be retried.
    const pitches = track(openSqlitePhysicalPitchProgressStore(recovered, { matches: official, participation, initialWorlds, runtime }));
    const retryBefore = geometryRows(db); census.checkpoint('authority-free-retry-start');
    const retried = pitches.accept(sourceId, 1);
    checkpoint('authority-free-retry-returned', { valueHash: hash(retried), rowsHash: hash(geometryRows(db)) });
    assert.deepEqual(retried, swing); assert.deepEqual(geometryRows(db), retryBefore);
    census.checkpoint('authority-free-retry-returned'); drain(); geometryClosed(recovered);
    record({ phase: 'all-retry-connections-closed', recoveredSha256: geometryFileHash(recovered) });
    db = track(new DatabaseSync(recovered)); census.checkpoint('fresh-connection-replay-start');
    const reopened = withSqliteReadTransaction(db, () => withBattedWorldPhysicalReadTraversal(db,
      () => readPhysicalPitchProgressFromSqlite(db, 'game-1', 8)));
    checkpoint('fresh-connection-replay-returned', { valueHash: hash(reopened), rowsHash: hash(geometryRows(db)) });
    assert.deepEqual(reopened, history); assertSwingOnlyDelta(before, geometryRows(db), swing);
    census.checkpoint('fresh-connection-replay-returned'); drain(); geometryClosed(recovered);
    census.close(); census = null; verifyPins();
    writeFileSync(join(directory, 'recovery-receipt.json'), `${json({ schema: 'actual_live_geometry_recovered_swing_v1',
      manifestSha256: geometryFileHash(manifest), failedTerminalSha256: m.failedTerminal.sha256, inheritedCredit: 0,
      destinationPath: recovered, destinationSha256: geometryFileHash(recovered), sourceHash: hash(swing.source), snapshotHash: hash(swing),
      contact: { sequence: contacts[0].sequence, tick: contacts[0].tick }, nativeReplay: true, authorityFreeRetry: true,
      allConnectionsClosedReopened: true, zeroWriteRetry: true, schemaRowidsAndOldRowsPreserved: true,
      exactAdditions: { physicalPitch: 1, physicalHeadUpdates: 1, admission: 0, flight: 0 }, originalConstructionProven: false,
      newSwingConstructionProven: false, geometryRedObserved: false, repeatedEpisodeBindingProven: false })}\n`, { flag: 'wx' });
    record({ phase: 'recovery-read-retry-only-complete', geometryRedObserved: false });
  } finally { drain(); if (census) census.close(); verifyPins(); }
});
