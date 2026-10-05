import assert from 'node:assert/strict';
import { basename, isAbsolute } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

const INPUT = 'a54678e3aae1c6df0d25683b65c2811cedfed98539ca604aa233563f9eee7caa';
const NEGATIVE = {
  'negative-phase-evidence.json': 'cf476b97f61fee1cf90035e5e59d0089172ef328f14477263afb774443327194',
  'interruption-terminal.json': '7979b0c1e888b327a4b0f8cff641d72c4712b1f46f6ebc2f42c602c570387e76',
  'negative-phase-completed.jsonl': '5bfbe251734f3af7f7cd9c40272f0a7335b849c3bf82be5fb13030791d8fbf71',
};
const CONTROLS = ['audit-artifact.mjs', 'run-minimal-clean-acceptance.py', 'worker-memory-telemetry.cjs', 'worker-resource-probe-exact-node26.cjs'];
const TESTS = [
  'checks pinned raw artifact request IDs and complete row manifest without replaying domain owners',
  'accepts the manifest-pinned original call chain through the real end owner, proves seal rollback, and closes/reopens/retries before exporting',
].sort();
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const path = value => typeof value === 'string' && isAbsolute(value);
const wal = value => value === null || value === 0;
const check = (condition, field) => { if (!condition) throw new Error(`physical producer: ${field}`); };
const same = (actual, expected, field) => check(isDeepStrictEqual(actual, expected), field);
// These are top-level publication/watcher identities, not nested test metadata.
// The pinned raw launcher, Vitest and SQLite audit formats contain none of them.
export const assertRawPhysicalProducerJson = value => {
  check(record(value) && !['kind', 'schema', 'publicationProjection', 'originalRawReceiptSha256']
    .some(key => Object.hasOwn(value, key)), 'rawEvidence');
};
export const assertRawPhysicalProducerTerminal = terminal => {
  check(record(terminal) && terminal.gatePassed === true, 'gatePassed');
  check(terminal.childExitCode === 0, 'childExitCode');
  check(terminal.stopReason === null, 'stopReason');
  assertRawPhysicalProducerJson(terminal);
};
const counts = value => record(value) && value.numTotalTests === 2 && value.numPassedTests === 2
  && value.numFailedTests === 0 && value.numPendingTests === 0
  && (value.numSkippedTests === undefined || value.numSkippedTests === 0)
  && (value.numTodoTests === undefined || value.numTodoTests === 0);
const controls = value => {
  check(record(value), 'launcherHashes');
  const entries = Object.entries(value);
  check(entries.length === CONTROLS.length && entries.every(([key, value]) => path(key) && hash(value)), 'launcherHashes');
  check(new Set(entries.map(([key]) => basename(key))).size === entries.length, 'launcherHashes');
  return Object.fromEntries(entries.map(([key, value]) => [basename(key), value]));
};
const tables = (values, field) => {
  check(Array.isArray(values) && values.length > 0, field);
  check(values.every(value => record(value) && typeof value.name === 'string' && value.name.length > 0
    && Number.isSafeInteger(value.count) && value.count >= 0 && hash(value.logicalRowsHash)), field);
  check(new Set(values.map(value => value.name)).size === values.length, field);
  return new Map(values.map(value => [value.name, value]));
};

/** Pure receipt admission. The caller supplies independently hashed file evidence;
 * this never replaces the downstream same-connection physical-end owner proof. */
export const assertPhysicalProducerEvidence = ({ config, terminal, admission, results, artifactAudit, inputManifest, observed }) => {
  check(record(config) && record(observed), 'contract');
  assert.equal(observed.physicalArtifactSha256, config.physicalArtifactSha256);
  assert.equal(observed.physicalEvidenceSha256, config.physicalEvidenceSha256);
  const expected = config.physicalProducer;
  check(record(expected) && expected.kind === 'first_base_clean_producer_v1'
    && typeof expected.sourceCommit === 'string' && /^[a-f0-9]{40}$/.test(expected.sourceCommit)
    && hash(expected.sourceManifestSha256) && Number.isSafeInteger(expected.sourceFiles) && expected.sourceFiles > 0
    && hash(expected.runtimeSha256) && hash(expected.inputManifestSha256)
    && path(expected.originalInputPath) && path(config.physicalArtifactPath) && path(config.physicalEvidencePath)
    && hash(config.physicalArtifactSha256) && hash(config.physicalEvidenceSha256)
    && typeof config.physicalEndSourceId === 'string' && config.physicalEndSourceId.length > 0, 'contract');
  assertRawPhysicalProducerTerminal(terminal);
  for (const value of [admission, results, artifactAudit]) assertRawPhysicalProducerJson(value);
  for (const field of ['sourceUnchanged', 'runtimeUnchanged', 'launcherUnchanged', 'inputUnchanged', 'negativeEvidenceUnchanged']) check(terminal[field] === true, field);
  same(terminal.sourceCommit, expected.sourceCommit, 'sourceCommit');
  check(record(admission) && admission.sourceCommit === expected.sourceCommit, 'admission');
  for (const field of ['sourceCommit', 'sourceManifestSha256', 'sourceFiles', 'inputPath', 'inputSha256', 'inputWalBytesBefore',
    'runtimePath', 'runtimeSha256', 'launcherHashes', 'negativeEvidencePath', 'negativeEvidenceHashes', 'runnerPid']) {
    const reason = field === 'launcherHashes' || field === 'negativeEvidenceHashes' ? field : 'admission';
    same(terminal[field], admission[field], reason);
  }
  same(terminal.sourceManifestSha256, expected.sourceManifestSha256, 'sourceBeforeManifestSha256');
  same(observed.sourceBeforeManifestSha256, expected.sourceManifestSha256, 'sourceBeforeManifestSha256');
  same(observed.sourceAfterManifestSha256, expected.sourceManifestSha256, 'sourceAfterManifestSha256');
  check(terminal.sourceFiles === expected.sourceFiles && observed.sourceFiles === expected.sourceFiles, 'sourceFiles');
  check(path(terminal.runtimePath) && terminal.runtimeSha256 === expected.runtimeSha256 && observed.runtimeSha256 === expected.runtimeSha256, 'runtimeSha256');
  check(record(expected.launcherHashes) && Object.keys(expected.launcherHashes).sort().join('\n') === CONTROLS.join('\n')
    && Object.values(expected.launcherHashes).every(hash), 'launcherHashes');
  same(controls(terminal.launcherHashes), expected.launcherHashes, 'launcherHashes');
  same(observed.launcherHashes, expected.launcherHashes, 'launcherHashes');
  same(expected.negativeEvidenceHashes, NEGATIVE, 'negativeEvidenceHashes');
  same(terminal.negativeEvidenceHashes, NEGATIVE, 'negativeEvidenceHashes');
  same(observed.negativeEvidenceHashes, NEGATIVE, 'negativeEvidenceHashes');
  check(path(terminal.negativeEvidencePath), 'negativeEvidenceHashes');
  check(expected.originalInputSha256 === INPUT && terminal.inputSha256 === INPUT && observed.originalInputSha256 === INPUT, 'originalInputSha256');
  same(terminal.inputPath, expected.originalInputPath, 'originalInputSha256');
  check(wal(terminal.inputWalBytesBefore) && wal(terminal.inputWalBytesAfter) && wal(observed.inputWalBytes), 'inputWalBytes');
  check(counts(terminal.counts), 'counts');
  check(record(results) && results.success === true && counts(results) && Array.isArray(results.testResults)
    && results.testResults.length === 1, 'results');
  const suite = results.testResults[0];
  check(record(suite) && suite.status === 'passed' && path(suite.name)
    && suite.name.endsWith('/src/host/world/ActualFirstBaseArtifactAcceptance.test.ts')
    && Array.isArray(suite.assertionResults) && suite.assertionResults.length === 2
    && suite.assertionResults.every(value => record(value) && value.status === 'passed' && value.title === value.fullName), 'results');
  same(suite.assertionResults.map(value => value.fullName).sort(), TESTS, 'results');
  check(Number.isSafeInteger(terminal.runnerPid) && terminal.runnerPid > 0 && Array.isArray(terminal.observedForks)
    && terminal.observedForks.length > 0 && terminal.observedForks.every(value => record(value)
      && value.worker === true && value.nodeVersion === '26.10.0' && value.heapLimitMiB === 1120 && value.requestedOldSpaceMiB === 1024
      && Number.isSafeInteger(value.pid) && value.pid > 0 && value.pid !== terminal.runnerPid)
    && new Set(terminal.observedForks.map(value => value.pid)).size === terminal.observedForks.length, 'observedForks');
  same(terminal.stragglersAfterReap, [], 'stragglersAfterReap');
  check(terminal.artifactAuditExitCode === 0, 'artifactAuditExitCode');
  check(terminal.outputPath === config.physicalArtifactPath && basename(terminal.outputPath) === 'ended-chain.sqlite', 'outputPath');
  same(terminal.outputSha256, config.physicalArtifactSha256, 'outputSha256');
  check(wal(terminal.outputWalBytes) && wal(observed.outputWalBytes), 'outputWalBytes');
  check(record(artifactAudit) && artifactAudit.artifact === config.physicalArtifactPath && artifactAudit.mainFilename === config.physicalArtifactPath
    && artifactAudit.journalMode === 'wal' && artifactAudit.fileSha256 === config.physicalArtifactSha256, 'artifactAudit');
  check(observed.inputManifestSha256 === expected.inputManifestSha256 && record(inputManifest)
    && inputManifest.schema === 'synthetic_first_base_pre_end_fixture_v1' && inputManifest.databaseSha256 === INPUT
    && inputManifest.physicalEndRows === 0 && inputManifest.sealRows === 0 && inputManifest.uncheckpointedWalBytes === 0, 'inputManifest');
  const original = tables(inputManifest.tables, 'inputManifest'), output = tables(artifactAudit.tables, 'artifactAudit');
  const end = output.get('actual_first_base_play_ends'), fence = output.get('actual_live_play_fences');
  check(end?.count === 1 && Array.isArray(end.originals) && end.originals.length === 1
    && end.originals[0].sourceId === config.physicalEndSourceId
    && hash(end.originals[0].sourceHash) && hash(end.originals[0].snapshotHash) && hash(end.originals[0].rowHash), 'physicalEnd');
  check(fence?.count === 1, 'physicalFence');
  same([...output.keys()].sort(), [...original.keys()].sort(), 'originalTables');
  for (const [name, before] of original) {
    if (name === 'actual_first_base_play_ends' || name === 'actual_live_play_fences') check(before.count === 0, 'inputManifest');
    else check(output.get(name).count === before.count && output.get(name).logicalRowsHash === before.logicalRowsHash, 'originalTables');
  }
};
