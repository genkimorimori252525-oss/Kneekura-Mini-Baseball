import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { constants, copyFileSync, lstatSync, mkdtempSync, readFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, normalize } from 'node:path';
import { retainedTerminalProducer } from './ActualFoulTerminalCutover.test-support';

type FilePin = { path: string; sha256: string };
export type RetainedAcknowledgementStage = 'applied' | 'acknowledged';
const manifestSha256 = '27cec4b2c280de59042997ac201b6178111501699358213ddaf8f32056f42fde';
const caseName = 'A01 genuine terminal official child acknowledges once while post-play and next-pitch remain blocked';
const caseFile = 'src/host/world/ActualFoulTerminalAcknowledgement.acceptance.ts';
const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const canonicalRegular = (path: string): void => {
  assert(isAbsolute(path) && normalize(path) === path, 'retained artifact path must be absolute and canonical');
  assert(lstatSync(path).isFile(), 'retained artifact must be a regular file');
  assert.equal(realpathSync(path), path, 'retained artifact must not traverse symlinks');
};
const pinnedBytes = (pin: FilePin): Buffer => {
  canonicalRegular(pin.path);
  const bytes = readFileSync(pin.path);
  assert.equal(sha256(bytes), pin.sha256, 'retained file hash mismatch: ' + pin.path);
  canonicalRegular(pin.path);
  return bytes;
};
const pinnedJson = (pin: FilePin) => JSON.parse(pinnedBytes(pin).toString('utf8'));
const noSidecars = (path: string): void => {
  canonicalRegular(path);
  // These exact retained files were observed without sidecars. lstat also
  // rejects dangling symlinks; existsSync would silently miss those.
  for (const suffix of ['-wal', '-shm', '-journal']) {
    try { lstatSync(path + suffix); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw error;
    }
    throw new Error('retained artifact unexpectedly has a sidecar: ' + path + suffix);
  }
};

/** Admit only the coordinator-pinned successful A01 files. This does no SQLite
 * work, reconstructs no durable result, and accepts no success receipt argument.
 * The original producer helper and the controller's single environment input
 * remain unchanged. The manifest digest is deliberately specific to this run;
 * changing any admitted file requires a separately reviewed source/control pin.
 *
 * Reaping is historical evidence from that pinned supervisor terminal, not a
 * new process probe or a claim excluding arbitrary unmanaged writers. Current
 * byte/sidecar checks and exclusive-copy equality supplement that evidence.
 */
export const prepareRetainedTerminalAcknowledgementCopy = (stage: RetainedAcknowledgementStage) => {
  assert(stage === 'applied' || stage === 'acknowledged', 'unsupported retained stage');
  assert(process.env.BASEBALL_GATE_RUNTIME && process.env.BASEBALL_GATE_LOCKS,
    'retained acknowledgement requires a separately admitted private runtime envelope');
  const manifestPath = process.env.TERMINAL_PENDING_CUTOVER_INPUT;
  assert(manifestPath, 'retained acknowledgement requires the explicit pinned manifest');
  const manifestPin = { path: manifestPath, sha256: manifestSha256 };
  const manifest = pinnedJson(manifestPin);
  assert.equal(manifest.version, 'terminal_pending_cutover_input_v1');
  const { acknowledgementArtifacts: qualified, ...originalFields } = manifest;
  assert.equal(qualified.version, 'retained_terminal_acknowledgement_artifacts_v1');
  const originalManifest = pinnedJson(qualified.originalProducerManifest);
  assert.deepEqual(originalFields, originalManifest, 'original retained v2 lineage changed');
  for (const [path, digest] of [
    [manifest.producerReceiptPath, manifest.producerReceiptSha256],
    [manifest.parentConfigPath, manifest.parentConfigSha256],
    [manifest.parentTerminalPath, manifest.parentTerminalSha256],
  ]) pinnedBytes({ path, sha256: digest });
  const producer = retainedTerminalProducer();
  assert(producer, 'original retained v2 producer must authenticate');
  for (const [path, digest] of [
    [producer.sourcePath, producer.sourceSha256], [producer.reportPath, producer.reportSha256],
    [producer.stdoutPath, producer.stdoutSha256], [producer.stderrPath, producer.stderrSha256],
  ]) pinnedBytes({ path, sha256: digest });
  noSidecars(producer.sourcePath);

  const a01 = qualified.successfulA01;
  const config = pinnedJson(a01.config), terminal = pinnedJson(a01.terminal), report = pinnedJson(a01.report);
  assert.equal(config.schema, 'baseball_fresh_stage_v1');
  assert.equal(config.released, true); assert.equal(config.expectedExitCode, 0);
  assert.equal(config.sourceIdentity.head, a01.sourceIdentity.head);
  assert.equal(config.sourceIdentity.src, a01.sourceIdentity.src);
  assert.equal(config.inputs.source.sha256, a01.sourceSnapshotSha256);
  assert.equal(config.artifactEnvironment.TERMINAL_PENDING_CUTOVER_INPUT, qualified.originalProducerManifest.path);
  assert.deepEqual(config.cases, [{ file: caseFile, name: caseName, status: 'passed' }]);
  assert.equal(a01.report.path, join(config.runDirectory, 'vitest.json'));
  assert.equal(a01.terminal.path, join(config.runDirectory, 'terminal.json'));
  assert.equal(terminal.schema, 'baseball_fresh_terminal_v1'); assert.equal(terminal.status, 'passed');
  assert.equal(terminal.stage, config.stage); assert.equal(terminal.configSha256, a01.config.sha256);
  assert.deepEqual(terminal.failures, []); assert.deepEqual(terminal.cancelSignals, []);
  assert.deepEqual(terminal.remainingOwnedProcesses, []); assert.equal(terminal.originalChildExit, 0);
  assert.deepEqual(Object.keys(terminal.before).sort(), ['controls', 'dependencies', 'runtime', 'source']);
  assert.deepEqual(terminal.after, terminal.before, 'A01 inputs changed during its run');
  for (const group of ['source', 'dependencies', 'controls', 'runtime'])
    assert.equal(terminal.before[group].sha256, config.inputs[group].sha256);
  for (const [path, digest] of [
    [qualified.originalProducerManifest.path, qualified.originalProducerManifest.sha256],
    [manifest.producerReceiptPath, manifest.producerReceiptSha256],
    [manifest.parentConfigPath, manifest.parentConfigSha256],
    [manifest.parentTerminalPath, manifest.parentTerminalSha256],
    [producer.sourcePath, producer.sourceSha256], [producer.reportPath, producer.reportSha256],
    [producer.stdoutPath, producer.stdoutSha256], [producer.stderrPath, producer.stderrSha256],
  ]) assert(terminal.before.controls.entries.some((entry: unknown) => JSON.stringify(entry) === JSON.stringify([path, 'file', digest])),
    'original producer lineage was not pinned in the successful A01 inputs');
  for (const entry of a01.sourceFiles)
    assert(terminal.before.source.entries.some((candidate: unknown) => JSON.stringify(candidate) === JSON.stringify(entry)));
  assert(terminal.ownedIdentities.length > 0, 'A01 must record owned process identities');
  assert(terminal.ownedIdentities.some((identity: unknown) => JSON.stringify(identity) === JSON.stringify(terminal.originalChildIdentity)));
  for (const identity of terminal.ownedIdentities) {
    const exits = terminal.groupChildExits.filter((exit: { identity: unknown }) => JSON.stringify(exit.identity) === JSON.stringify(identity));
    assert.equal(exits.length, 1, 'each A01 owned identity must have one observed reap');
    assert.equal(exits[0].exitCode, 0); assert.equal(exits[0].rawWaitStatus, 0);
  }
  assert(terminal.runtime.length > 0);
  for (const runtime of terminal.runtime) {
    assert.equal(runtime.node, producer.processIdentity.node);
    assert.equal(runtime.nodeSha256, producer.processIdentity.executableSha256);
    assert(terminal.ownedIdentities.some((identity: number[]) => identity[0] === runtime.pid));
  }
  assert.deepEqual(terminal.tests, { passedCases: 1, expectedFailedCases: 0, skipped: [], credit: 1,
    reportSha256: a01.report.sha256, witnessSha256: null });
  assert.equal(report.success, true);
  for (const key of ['numTotalTestSuites', 'numPassedTestSuites', 'numTotalTests', 'numPassedTests']) assert.equal(report[key], 1);
  for (const key of ['numFailedTestSuites', 'numPendingTestSuites', 'numFailedTests', 'numPendingTests', 'numTodoTests']) assert.equal(report[key], 0);
  assert.equal(report.testResults.length, 1);
  const suite = report.testResults[0];
  assert.equal(suite.name, join(config.inputs.source.root, caseFile)); assert.equal(suite.status, 'passed');
  assert.equal(suite.assertionResults.length, 1);
  assert.equal(suite.assertionResults[0].fullName, caseName); assert.equal(suite.assertionResults[0].status, 'passed');
  assert.deepEqual(suite.assertionResults[0].failureMessages, []);

  assert.equal(realpathSync(qualified.outputDirectory), qualified.outputDirectory);
  assert(lstatSync(qualified.outputDirectory).isDirectory());
  const applied = qualified.artifacts.applied, acknowledged = qualified.artifacts.acknowledged;
  assert.equal(applied.path, join(qualified.outputDirectory, 'pending-legacy-check.sqlite'));
  assert.equal(acknowledged.path, join(qualified.outputDirectory, 'acknowledgement-check.sqlite'));
  assert.equal(qualified.appliedControl.path, join(qualified.outputDirectory, 'applied-cutover-control.json'));
  assert.equal(qualified.checkCutoverReceipt.path, join(qualified.outputDirectory, 'acknowledgement-cutover-receipt.json'));
  const control = pinnedJson(qualified.appliedControl), cutover = pinnedJson(qualified.checkCutoverReceipt);
  assert.equal(control.version, 'owned_terminal_applied_acknowledgement_cutover_v1');
  assert.equal(control.originalProducerPath, producer.sourcePath); assert.equal(control.originalProducerSha256, producer.sourceSha256);
  assert.equal(control.producerControlPath, qualified.originalProducerManifest.path);
  assert.equal(control.producerControlSha256, qualified.originalProducerManifest.sha256);
  assert.equal(control.sourcePath, applied.path); assert.equal(control.sourceSha256, applied.sha256);
  assert.equal(control.writerConnectionObservedClosed, true); assert.equal(control.observerConnectionObservedClosed, true);
  assert.equal(applied.sourceId, 'terminal-application'); assert.equal(acknowledged.sourceId, applied.sourceId);
  assert.equal(control.sourceId, applied.sourceId);
  assert.equal(applied.status, 'OFFICIAL_APPLIED_PENDING_POST_PLAY');
  assert.equal(acknowledged.status, 'OFFICIAL_ACKNOWLEDGED_PENDING_POST_PLAY');
  assert.equal(control.mirrors.terminal.source_id, applied.sourceId);
  assert.equal(control.mirrors.terminal.status, applied.status);
  assert.equal(cutover.version, 'owned_terminal_acknowledgement_check_cutover_v1');
  assert.equal(cutover.controlPath, qualified.appliedControl.path); assert.equal(cutover.controlSha256, qualified.appliedControl.sha256);
  assert.equal(cutover.destinationPath, acknowledged.path);
  assert.equal(cutover.rawRowsSha256, control.rawRowsSha256); assert.deepEqual(cutover.beforeSchema, control.schema);
  assert.equal(cutover.beforeSchema.userVersion, 3); assert.equal(cutover.afterSchema.userVersion, 3);
  assert.equal(cutover.afterSchema.mainVersion, cutover.beforeSchema.mainVersion + 2);
  assert.deepEqual(cutover.afterTerminal.columns, cutover.beforeTerminal.columns);
  assert.deepEqual(cutover.afterTerminal.indexes, cutover.beforeTerminal.indexes);
  const assertRetainedFiles = () => {
    for (const artifact of [applied, acknowledged]) {
      assert.deepEqual(artifact.sidecars, { '-wal': 'absent', '-shm': 'absent', '-journal': 'absent' });
      noSidecars(artifact.path); assert.equal(pinnedBytes(artifact).length, artifact.bytes); noSidecars(artifact.path);
    }
    noSidecars(producer.sourcePath); pinnedBytes({ path: producer.sourcePath, sha256: producer.sourceSha256 });
  };
  assertRetainedFiles();
  const retained = qualified.artifacts[stage];
  const retainedBytes = pinnedBytes(retained);
  const directory = mkdtempSync(join(realpathSync(tmpdir()), 'terminal-official-acknowledgement-retained-'));
  const path = join(directory, stage + '.sqlite');
  copyFileSync(retained.path, path, constants.COPYFILE_EXCL);
  noSidecars(path);
  assert(pinnedBytes({ path, sha256: retained.sha256 }).equals(retainedBytes), 'exclusive copy bytes differ');
  assert(pinnedBytes(retained).equals(retainedBytes), 'retained bytes changed while copying');
  assertRetainedFiles(); pinnedBytes(manifestPin);
  console.info('TERMINAL_ACKNOWLEDGEMENT_RETAINED_PRIVATE_ARTIFACT=' + directory);
  // These are locations and pinned provenance only. The consuming test must
  // call the current real owner on this fresh copy, check the returned stage,
  // and authenticate its original history/mirrors before exercising behavior.
  // Applied-copy CHECK extension belongs in that test's owned cutover flow.
  return { directory, path, sourceId: String(retained.sourceId), stage,
    retainedPath: String(retained.path), retainedSha256: String(retained.sha256) } as const;
};
