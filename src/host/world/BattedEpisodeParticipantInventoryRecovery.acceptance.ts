import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { closeSync, constants, copyFileSync, existsSync, fsyncSync, mkdtempSync, openSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { it } from 'vitest';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { geometryClosed, geometryFileHash, geometryRows } from './ActualLiveBaseGeometryContinuation.test-support';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
type Pin = Readonly<{ path: string; sha256: string; bytes?: number }>;
type Input = Readonly<{ schema: 'episode_participant_inventory_recovery_input_v1'; audit: Pin;
  failedSource: Pin; checkpointHelper: Pin; outputLog: Pin; progress: Pin; originalInput: Pin;
  expectedSourceIdentity: Readonly<{ head: string; src: string }>; expectedFailedSourceGroup: string }>;
const failedName = 'EPB-P00 authenticates retained flight and accepted current participant inputs';
const censusHash = '6a8298d8ebe41b0039d11c6848b94eb64c8dcde9c27bed21c97f40baf37ef0f7';
const mainHash = '9e587287a3595afb13cab68e1f1b34e4230b186c1f029514f9fd1b88fa32b4e1';
const load = (pin: Pin) => JSON.parse(readFileSync(pin.path, 'utf8'));
const durable = (path: string, value: unknown) => {
  writeFileSync(path, `${json(value)}\n`, { flag: 'wx' });
  const fd = openSync(path, 'r'); try { fsyncSync(fd); } finally { closeSync(fd); }
  const folder = openSync(dirname(path), 'r'); try { fsyncSync(folder); } finally { closeSync(folder); }
};

/** Qualify only checkpoint-covered completed observations and the missing current
 * census/close/reopen assertions. This case never calls a physical owner reader. */
it('EPB-RC01 qualifies completed inventory observations and current Native close readback', () => {
  const manifest = process.env.EPISODE_PARTICIPANT_INPUT; assert(manifest);
  const input = JSON.parse(readFileSync(manifest, 'utf8')) as Input;
  assert.equal(input.schema, 'episode_participant_inventory_recovery_input_v1');
  const audit = load(input.audit), pins = audit.pins as Record<string, Pin>;
  const allPins = [input.audit, input.failedSource, input.checkpointHelper, input.outputLog, input.progress, input.originalInput, ...Object.values(pins)];
  const checkPins = () => {
    for (const pin of allPins) {
      assert.equal(geometryFileHash(pin.path), pin.sha256);
      if (pin.bytes !== undefined) assert.equal(statSync(pin.path).size, pin.bytes);
    }
    assert.equal(statSync(pins.wal.path).size, 0); assert.equal(statSync(pins.shm.path).size, 32768);
    assert(!existsSync(`${pins.main.path}-journal`)); assert(!existsSync(join(dirname(pins.main.path), 'stage-receipt.json')));
  };
  checkPins(); assert.equal(audit.status, 'failed_zero_aggregate_credit');
  assert.equal(pins.main.sha256, mainHash); assert.equal(pins.wal.sha256, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  const terminal = load(pins.terminal), report = load(pins.report), errors = load(pins.errors);
  const sourceConfig = load(pins.releasedConfig), sourceInput = load(pins.stageInput);
  const started = load(pins.started), returned = load(pins.returned);
  assert.deepEqual(audit.source.head, input.expectedSourceIdentity.head); assert.deepEqual(audit.source.src, input.expectedSourceIdentity.src);
  assert.deepEqual(sourceConfig.sourceIdentity, input.expectedSourceIdentity); assert.deepEqual(sourceInput.sourceIdentity, input.expectedSourceIdentity);
  assert.equal(terminal.status, 'failed'); assert.equal(terminal.configSha256, pins.releasedConfig.sha256);
  assert.deepEqual(terminal.failures, [{ phase: 'result', error: "ValueError('original child exit differs')" }]);
  assert.equal(terminal.originalChildExit, 1); assert.deepEqual(terminal.remainingOwnedProcesses, []);
  assert.deepEqual(terminal.before, terminal.after); assert.equal(terminal.before.source.sha256, input.expectedFailedSourceGroup);
  assert.equal(sourceConfig.inputs.source.sha256, input.expectedFailedSourceGroup);
  assert.deepEqual(Object.keys(terminal.before).sort(), ['controls', 'dependencies', 'runtime', 'source']);
  for (const group of Object.keys(terminal.before)) assert.equal(terminal.before[group].sha256, sourceConfig.inputs[group].sha256);
  for (const pin of [input.failedSource, input.checkpointHelper]) {
    assert(terminal.before.source.entries.some((row: unknown[]) => row[0] === pin.path && row[1] === 'file' && row[2] === pin.sha256));
  }
  assert.equal(terminal.ownedIdentities.length, 2); assert.equal(terminal.groupChildExits.length, 2);
  for (const identity of terminal.ownedIdentities) {
    const exits = terminal.groupChildExits.filter((value: { identity: unknown }) => json(value.identity) === json(identity));
    assert.equal(exits.length, 1);
    const expected = json(identity) === json(terminal.originalChildIdentity) ? 1 : 0;
    assert.equal(exits[0].exitCode, expected); assert.equal(exits[0].rawWaitStatus, expected * 256);
  }
  assert.deepEqual(errors, { unhandled: [], suiteErrors: [] });
  assert.equal(report.numTotalTests, 5); assert.equal(report.numFailedTests, 1); assert.equal(report.numPassedTests, 0); assert.equal(report.numPendingTests, 4);
  assert.equal(report.testResults.length, 1);
  const assertions = report.testResults[0].assertionResults;
  assert.equal(assertions.length, 5); const failure = assertions.find((value: { fullName: string }) => value.fullName === failedName); assert(failure);
  assert.equal(failure.status, 'failed'); assert.equal(failure.failureMessages.length, 1);
  assert(failure.failureMessages[0].startsWith('AssertionError [ERR_ASSERTION]: database sidecar remains: -wal\n'));
  assert(failure.failureMessages[0].includes(`${input.failedSource.path}:248:26`));
  assert(assertions.filter((value: { fullName: string; status: string; failureMessages: unknown[] }) => value.fullName !== failedName)
    .every((value: { status: string; failureMessages: unknown[] }) => value.status === 'skipped' && value.failureMessages.length === 0));
  for (const checkpoint of [started, returned]) {
    assert.equal(checkpoint.schema, 'episode_participant_stage_checkpoint_v1'); assert.equal(checkpoint.stage, 'inventory');
    assert.equal(checkpoint.manifestSha256, pins.stageInput.sha256); assert.deepEqual(checkpoint.sourceIdentity, input.expectedSourceIdentity);
    assert.equal(checkpoint.independentlyQualified, false); assert.equal(checkpoint.rowsHash, censusHash);
  }
  assert.equal(started.phase, 'authentication-start'); assert.equal(returned.phase, 'authentication-returned');
  assert.equal(returned.bindingTablePresent, false); assert.equal(returned.hashes.flight, '150237c1905783e6cccecb50a6ac09130ce264c4977e4b8f42d28028c6a56b6d');
  assert.equal(sourceInput.input.sha256, mainHash); assert.equal(sourceInput.acceptedSources.sha256, '96a7aa39d2fa08be681d778711be1acb60974977e3fc3af9527f7c0d72323486');
  assert.equal(sourceInput.input.path, input.originalInput.path); assert.equal(input.originalInput.sha256, mainHash);

  // The failed donor tuple stays untouched. Empty WAL and unchanged main bytes
  // establish that a main-only exclusive copy cannot omit committed frames.
  const directory = mkdtempSync(join(tmpdir(), 'episode-participant-readback-')), path = join(directory, 'readback.sqlite');
  copyFileSync(pins.main.path, path, constants.COPYFILE_EXCL); assert.equal(geometryFileHash(path), mainHash);
  const readback = () => {
    const db = new DatabaseSync(path); // Ordinary Native close can clean its own WAL/SHM.
    try {
      db.exec('PRAGMA query_only=ON'); assert.equal(db.prepare('PRAGMA query_only').get()!.query_only, 1);
      assert.equal(db.isTransaction, false); assert.equal(db.prepare('SELECT total_changes() AS n').get()!.n, 0);
      db.exec('BEGIN');
      try {
        assert.equal(hash(geometryRows(db)), censusHash);
        const claims = [
          ['batted_ball_flights', 'fixture-next-actual-setup-flight', 'snapshot', 'flight'],
          ['physical_plate_appearance_actors', 'fixture-next-actual-batter', 'snapshot', 'physicalActor'],
          ['batted_world_field_geometries', 'field-bags', 'snapshot', 'calibration'],
          ['batted_world_models', 'world-model', 'source', 'worldModel'],
          ['batted_contact_response_models', 'response-model', 'source', 'responseModel'],
        ] as const;
        for (const [table, sourceId, document, key] of claims) {
          const rows = db.prepare(`SELECT ${document}_json AS document,${document}_hash AS hash FROM main.${table} WHERE source_id=?`).all(sourceId);
          assert.equal(rows.length, 1); const value = JSON.parse(String(rows[0].document));
          assert.equal(json(value), rows[0].document); assert.equal(hash(value), rows[0].hash); assert.equal(rows[0].hash, returned.hashes[key]);
        }
        assert.equal(db.prepare("SELECT count(*) AS n FROM main.sqlite_master WHERE name='batted_episode_field_bindings'").get()!.n, 0);
        assert.equal(db.prepare('SELECT total_changes() AS n').get()!.n, 0);
        db.exec('COMMIT');
      } finally { if (db.isTransaction) db.exec('ROLLBACK'); }
      assert.equal(db.isTransaction, false); assert.equal(db.prepare('PRAGMA query_only').get()!.query_only, 1);
      assert.equal(db.prepare('SELECT total_changes() AS n').get()!.n, 0);
    } finally { db.close(); }
    geometryClosed(path); assert.equal(geometryFileHash(path), mainHash); checkPins();
  };
  readback(); durable(join(directory, 'first-readback-closed.json'), { rowsHash: censusHash, mainHash, zeroWrites: true, sidecarsAbsent: true });
  readback(); checkPins();
  durable(join(directory, 'inventory-recovery-receipt.json'), {
    schema: 'episode_participant_inventory_recovery_v1', manifestSha256: geometryFileHash(manifest),
    destinationPath: path, destinationSha256: geometryFileHash(path),
    priorAttempt: { status: 'failed', aggregateCredit: 0, originalCloseSuccess: 'unknown',
      sourceIdentity: input.expectedSourceIdentity, configSha256: pins.releasedConfig.sha256, terminalSha256: pins.terminal.sha256,
      reportSha256: pins.report.sha256, progressSha256: input.progress.sha256, returnedCheckpointSha256: pins.returned.sha256 },
    completedObservations: { rowsHash: censusHash, hashes: returned.hashes, bindingTablePresent: false,
      authentication: 'source-specific observations completed before the pinned synchronous checkpoint', originalAuthenticationRepeated: false },
    currentReadback: { ordinaryNativeConnection: true, queryOnly: true, zeroChanges: true, censusAndArchiveHashesMatch: true,
      mainBytesUnchanged: true, allConnectionsClosedReopened: true, sidecarsAbsent: true, inputTupleUnchanged: true },
    newOwnerRows: 0, successorAcceptanceReleased: false,
  });
});
