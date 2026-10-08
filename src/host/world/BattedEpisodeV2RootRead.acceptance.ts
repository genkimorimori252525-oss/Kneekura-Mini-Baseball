import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { closeSync, constants, copyFileSync, fsyncSync, mkdtempSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { it } from 'vitest';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { geometryClosed, geometryFileHash, geometryRows } from './ActualLiveBaseGeometryContinuation.test-support';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';
import { withBattedWorldPhysicalReadTraversal } from './SqliteBattedWorldFieldExecutionStore';
import { battedEpisodeFieldBindingEvidenceFromSqlite } from './SqliteBattedEpisodeFieldBindingStore';
import { battedWorldFieldGeometry, battedWorldFieldRootIdentity, battedWorldFieldSourceRootIdentity, type BattedWorldFieldRoot } from './BattedWorldFieldRoot';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
type Pin = Readonly<{ path: string; sha256: string }>;
type Input = Readonly<{ schema: 'episode_binding_v2_root_read_input_v1'; input: Pin; receipt: Pin; terminal: Pin; config: Pin;
  bindingInput: Pin; acceptedSources: Pin; sourceIdentity: Readonly<{ head: string; src: string }>;
  bindingSourceIdentity: Readonly<{ head: string; src: string }>; bindingSourceGroup: string;
  readReference: Readonly<{ version: 'batted_episode_field_binding_v2'; sourceId: string }> }>;
const sourceHash = '96a7aa39d2fa08be681d778711be1acb60974977e3fc3af9527f7c0d72323486';
const durable = (path: string, value: unknown) => {
  writeFileSync(path, `${json(value)}\n`, { flag: 'wx' });
  const fd = openSync(path, 'r'); try { fsyncSync(fd); } finally { closeSync(fd); }
  const folder = openSync(dirname(path), 'r'); try { fsyncSync(folder); } finally { closeSync(folder); }
};

it('EPB-Q01 reads the actual v2 binding and selects its root geometry without field work', () => {
  const manifest = process.env.EPISODE_PARTICIPANT_INPUT; assert(manifest);
  const input = JSON.parse(readFileSync(manifest, 'utf8')) as Input; assert.equal(input.schema, 'episode_binding_v2_root_read_input_v1');
  const pins = [input.input, input.receipt, input.terminal, input.config, input.bindingInput, input.acceptedSources];
  const checkPins = () => { for (const pin of pins) assert.equal(geometryFileHash(pin.path), pin.sha256); geometryClosed(input.input.path); };
  checkPins(); assert.equal(input.acceptedSources.sha256, sourceHash);
  const receipt = JSON.parse(readFileSync(input.receipt.path, 'utf8')), terminal = JSON.parse(readFileSync(input.terminal.path, 'utf8'));
  const config = JSON.parse(readFileSync(input.config.path, 'utf8')), bindingInput = JSON.parse(readFileSync(input.bindingInput.path, 'utf8'));
  const proposal = JSON.parse(readFileSync(input.acceptedSources.path, 'utf8')), source = proposal.sources.binding;
  assert.equal(proposal.schema, 'episode_participant_binding_v2_input_proposal_v1'); assert.equal(proposal.nativeExecutionReleased, false);
  assert.equal(source.version, 'batted_episode_field_binding_v2');
  assert.deepEqual(input.readReference, { version: source.version, sourceId: source.sourceId });
  assert.equal(receipt.schema, 'episode_participant_stage_receipt_v1'); assert.equal(receipt.stage, 'binding'); assert.equal(receipt.verified, true);
  assert.equal(receipt.destinationPath, input.input.path); assert.equal(receipt.destinationSha256, input.input.sha256);
  assert.equal(receipt.manifestSha256, input.bindingInput.sha256); assert.equal(receipt.acceptedSourcesSha256, sourceHash);
  assert.deepEqual(receipt.sourceIdentity, input.bindingSourceIdentity); assert.deepEqual(config.sourceIdentity, input.bindingSourceIdentity);
  assert.deepEqual(bindingInput.sourceIdentity, input.bindingSourceIdentity); assert.equal(bindingInput.stage, 'binding');
  assert.equal(terminal.status, 'passed'); assert.deepEqual(terminal.failures, []); assert.deepEqual(terminal.before, terminal.after);
  assert.equal(terminal.configSha256, input.config.sha256); assert.equal(terminal.before.source.sha256, input.bindingSourceGroup);
  assert.equal(config.inputs.source.sha256, input.bindingSourceGroup); assert.equal(terminal.originalChildExit, 0);
  assert.deepEqual(terminal.remainingOwnedProcesses, []); assert.equal(terminal.groupChildExits.length, terminal.ownedIdentities.length);
  for (const identity of terminal.ownedIdentities) {
    const exits = terminal.groupChildExits.filter((v: { identity: unknown }) => json(v.identity) === json(identity));
    assert.equal(exits.length, 1); assert.equal(exits[0].exitCode, 0); assert.equal(exits[0].rawWaitStatus, 0);
  }
  assert.equal(terminal.tests.passedCases, 1); assert.equal(terminal.tests.expectedFailedCases, 0); assert.equal(terminal.tests.skipped.length, 4);
  assert(terminal.tests.skipped.every((v: { status: string; credit: number }) => v.status === 'skipped' && v.credit === 0));
  assert.deepEqual(receipt.exactAdditions, { binding: 1 }); assert.equal(receipt.freshWriter.delta, 1);
  assert.deepEqual(receipt.freshWriter.witnessed, [true]);
  assert.deepEqual(receipt.freshWriter.writes, [{ index: 0, totalChanges: receipt.freshWriter.before + 1 }]);
  assert.equal(receipt.retryWriter.delta, 0); assert.deepEqual(receipt.retryWriter.writes, []); assert.deepEqual(receipt.retryWriter.witnessed, [false]);
  assert.equal(receipt.allConnectionsClosedReopened, true); assert.equal(receipt.authorityFreeRetry, true); assert.equal(receipt.zeroWriteRetry, true);
  assert.equal(receipt.v1ConsumerRejected, true); assert.equal(receipt.v1ParticipantGuardPreserved, true);
  const provenance = receipt.inputProvenance; assert.equal(provenance.kind, 'qualified_empty_binding_bootstrap_v1');
  assert.equal(provenance.bootstrapReceiptSha256, bindingInput.lineage.receipt.sha256);
  assert.equal(provenance.standaloneInventoryAuthenticationRepeated, false);
  const touch = provenance.response.inputProvenance; assert.equal(touch.kind, 'qualified_touch_owner_v1');
  assert.equal(touch.inherited.kind, 'qualified_contact_owner_v1');
  assert.equal(touch.inherited.inherited.kind, 'audited_inventory_and_native_readback_v1');
  assert.equal(touch.inherited.inherited.priorAttempt.status, 'failed'); assert.equal(touch.inherited.inherited.priorAttempt.aggregateCredit, 0);
  assert.equal(touch.inherited.inherited.priorAttempt.originalCloseSuccess, 'unknown');
  const directory = mkdtempSync(join(tmpdir(), 'episode-v2-root-read-')), path = join(directory, 'readback.sqlite');
  copyFileSync(input.input.path, path, constants.COPYFILE_EXCL); assert.equal(geometryFileHash(path), input.input.sha256);
  const readRoot = (phase: string) => {
    const db = new DatabaseSync(path);
    try {
      db.exec('PRAGMA query_only=ON'); const before = geometryRows(db); assert.equal(hash(before), receipt.afterRowsHash);
      const root = withSqliteReadTransaction(db, () => withBattedWorldPhysicalReadTraversal(db, () => {
        const binding = battedEpisodeFieldBindingEvidenceFromSqlite(db).read(input.readReference.sourceId); assert(binding);
        assert.equal(hash(binding), receipt.valueHash); assert.equal(json(binding.source), json(source));
        const value: BattedWorldFieldRoot = { rootKind: 'episode_field_binding_v2', episodeFieldBinding: binding,
          response: binding.response, geometry: binding.calibration };
        assert.equal(battedWorldFieldRootIdentity(value), json(['episode_field_binding_v2', source.sourceId]));
        assert.strictEqual(battedWorldFieldGeometry(value), binding.geometry);
        assert.equal(hash(binding.calibration), receipt.hashes.calibration);
        const flight = binding.response.touch.worldContact.flight, actor = flight.physicalPitch.frame.batterActor; assert(actor);
        assert.equal(actor.source.sourceId, source.physicalActorSourceId); assert.equal(actor.binding.playerId, 'away-2');
        assert.equal(binding.physicalPitchSourceId, flight.physicalPitch.source.sourceId);
        assert.equal(binding.playId, flight.physicalPitch.frame.match.playId); assert.equal(binding.contactTick, flight.flight.initialBall.tick);
        assert.notEqual(binding.calibration.baseGeometry.flight.source.sourceId, flight.source.sourceId);
        assert.equal(binding.response.touch.worldContact.actors.length, 50);
        assert.throws(() => battedWorldFieldRootIdentity({ ...value, rootKind: 'episode_field_binding_v1' }), /invalid actual field episode root kind or binding receipt/);
        assert.equal(battedWorldFieldSourceRootIdentity({ responseSourceId: source.responseSourceId,
          geometrySourceId: source.fieldCalibrationSourceId, episodeFieldBinding: input.readReference }), battedWorldFieldRootIdentity(value));
        assert.throws(() => battedWorldFieldGeometry({ ...value, source: { responseSourceId: source.responseSourceId,
          geometrySourceId: source.fieldCalibrationSourceId, episodeFieldBinding: { version: 'batted_episode_field_binding_v1', sourceId: source.sourceId } } }),
        /actual field Source and root binding mode differ/);
        return value;
      }));
      assert.equal(db.isTransaction, false); assert.equal(db.prepare('PRAGMA query_only').get()!.query_only, 1);
      assert.equal(db.prepare('SELECT total_changes() AS n').get()!.n, 0); assert.deepEqual(geometryRows(db), before);
      durable(join(directory, `${phase}.checkpoint.json`), { schema: 'episode_binding_v2_root_read_checkpoint_v1', phase,
        sourceIdentity: input.sourceIdentity, manifestSha256: geometryFileHash(manifest), independentlyQualified: false,
        bindingReceiptSha256: input.receipt.sha256, bindingHash: receipt.valueHash, rootHash: hash(root), rowsHash: hash(before),
        fieldContinuationExecuted: false, zeroChanges: true, connectionCloseCompleted: false });
      return root;
    } finally { db.close(); }
  };
  try {
    const root = readRoot('root-read-returned'); geometryClosed(path);
    const reopened = readRoot('root-reopen-returned'); assert.equal(json(reopened), json(root)); geometryClosed(path); checkPins();
    assert.equal(geometryFileHash(path), input.input.sha256);
    durable(join(directory, 'root-read-receipt.json'), { schema: 'episode_binding_v2_root_read_receipt_v1', verified: true,
      sourceIdentity: input.sourceIdentity, manifestSha256: geometryFileHash(manifest), acceptedSourcesSha256: sourceHash,
      inputSha256: input.input.sha256, destinationPath: path, destinationSha256: geometryFileHash(path),
      bindingReceiptSha256: input.receipt.sha256, bindingTerminalSha256: input.terminal.sha256, bindingSourceIdentity: input.bindingSourceIdentity,
      bindingHash: receipt.valueHash, rootKind: 'episode_field_binding_v2', rootIdentity: battedWorldFieldRootIdentity(root), rootHash: hash(root),
      geometryHash: hash(battedWorldFieldGeometry(root)), calibrationHash: hash(root.geometry), rowsHash: receipt.afterRowsHash,
      readReference: input.readReference, allConnectionsClosedReopened: true, queryOnly: true, zeroChanges: true,
      mainBytesUnchanged: true, sidecarsAbsent: true, fieldSourceVersionMatched: true, mismatchedFieldSourceRejected: true, v1RootRejected: true,
      originalBindingProvenance: provenance, fieldContinuationExecuted: false });
  } finally { geometryClosed(path); checkPins(); }
});
