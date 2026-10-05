import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { basename, isAbsolute, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

const CONSTRUCTION = {
  originalConstructionDatabaseSha256: '60525735348ea48aeb1944e7c1b2dc2d3afd6fdac8961d83486d2f4a4c6df0f4',
  originalConstructionTerminalSha256: '215e7ad43ac770f0423405a658721467032f0a5151449fa2cb4d9af422850209',
  originalConstructionSourceCommit: '23e4ef0cd34fbd028b6d3b689188a741cde2bea1',
  originalConstructionSourceManifestSha256: '567ce51ccd34c5522e78b6eef99b7d85b4651d640a3e9277d89865b628cb0896',
};
const PROFILE = '158d140826d274fbfef202e495df0869ce250223c9959b26ab79e75c5d10b98c';
const LEGACY_INPUT = 'a54678e3aae1c6df0d25683b65c2811cedfed98539ca604aa233563f9eee7caa';
const LEGACY_NEGATIVE = new Set([
  'cf476b97f61fee1cf90035e5e59d0089172ef328f14477263afb774443327194',
  '7979b0c1e888b327a4b0f8cff641d72c4712b1f46f6ebc2f42c602c570387e76',
  '5bfbe251734f3af7f7cd9c40272f0a7335b849c3bf82be5fb13030791d8fbf71',
]);
const CONTROLS = ['audit-artifact.mjs', 'run-known-profile-acceptance.py', 'worker-memory-telemetry.cjs', 'worker-resource-probe-exact-node26.cjs'];
const TESTS = [
  'checks the fresh known-profile pre-end manifest and original npb-2026 lineage without replaying domain owners',
  'witnesses a fresh seal INSERT rollback, accepts the same known-profile original chain, and closes/reopens/retries before exporting',
].sort();
const WITNESS = 'seal-insert-rollback.json';
const REQUEST = ['sourceId', 'sourceVersion', 'runtimeSourceId', 'baseFieldSourceId', 'executionSourceId', 'ruleConsumptionSourceId', 'umpireCallSourceId', 'communicationSourceId'];
const TERMINAL_TABLES = ['actual_first_base_play_ends', 'actual_live_play_fences'];
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const commit = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const path = value => typeof value === 'string' && isAbsolute(value) && resolve(value) === value;
const nonempty = value => typeof value === 'string' && value.length > 0;
const wal = value => value === null || value === 0;
const digest = value => createHash('sha256').update(value).digest('hex');
const check = (condition, field) => { if (!condition) throw new Error(`known-profile producer: ${field}`); };
const same = (actual, expected, field) => check(isDeepStrictEqual(actual, expected), field);
const keys = (value, names) => record(value) && isDeepStrictEqual(Object.keys(value).sort(), [...names].sort());
const counts = value => record(value) && value.numTotalTests === 2 && value.numPassedTests === 2
  && value.numFailedTests === 0 && value.numPendingTests === 0
  && (value.numSkippedTests === undefined || value.numSkippedTests === 0)
  && (value.numTodoTests === undefined || value.numTodoTests === 0);

// Only these top-level identities mark a projection. Nested Vitest metadata and
// the separately typed input manifest/witness have their own supporting roles.
export const assertRawKnownProfileProducerJson = value => {
  check(record(value) && !['kind', 'schema', 'publicationProjection', 'originalRawReceiptSha256']
    .some(key => Object.hasOwn(value, key)), 'rawEvidence');
};
export const assertRawKnownProfileProducerTerminal = value => {
  check(record(value) && value.gatePassed === true, 'gatePassed');
  check(value.childExitCode === 0, 'childExitCode');
  check(value.stopReason === null, 'stopReason');
  assertRawKnownProfileProducerJson(value);
};
const controls = value => {
  check(record(value), 'launcherHashes');
  const entries = Object.entries(value);
  check(entries.length === CONTROLS.length && entries.every(([name, value]) => path(name) && hash(value)), 'launcherHashes');
  const names = entries.map(([name]) => basename(name));
  check(new Set(names).size === entries.length && isDeepStrictEqual(names.sort(), CONTROLS), 'launcherHashes');
  return Object.fromEntries(entries.map(([name, value]) => [basename(name), value]));
};
const tables = (values, field) => {
  check(Array.isArray(values) && values.length > 0, field);
  check(values.every(value => record(value) && nonempty(value.name)
    && Number.isSafeInteger(value.count) && value.count >= 0 && hash(value.logicalRowsHash)), field);
  check(new Set(values.map(value => value.name)).size === values.length, field);
  return new Map(values.map(value => [value.name, value]));
};

/** Pure JSON receipt admission, separate from the unchanged legacy v1 contract.
 * Files must be independently observed by the bounded adapter before this call.
 * This does not import domain owners or replace their same-connection proof. */
export const assertKnownProfileProducerEvidence = ({ config, terminal, admission, results, artifactAudit, inputManifest, negativeEvidence, observed }) => {
  check(record(config) && record(observed), 'contract');
  assert.equal(observed.physicalArtifactSha256, config.physicalArtifactSha256);
  assert.equal(observed.physicalEvidenceSha256, config.physicalEvidenceSha256);
  const expected = config.physicalProducer;
  check(record(expected) && expected.kind === 'first_base_known_profile_producer_v1'
    && commit(expected.sourceCommit) && hash(expected.sourceManifestSha256)
    && Number.isSafeInteger(expected.sourceFiles) && expected.sourceFiles > 0
    && path(config.physicalArtifactPath) && path(config.physicalEvidencePath)
    && hash(config.physicalArtifactSha256) && hash(config.physicalEvidenceSha256) && nonempty(config.physicalEndSourceId), 'contract');
  assertRawKnownProfileProducerTerminal(terminal);
  for (const value of [admission, results, artifactAudit]) assertRawKnownProfileProducerJson(value);
  for (const field of ['sourceUnchanged', 'runtimeUnchanged', 'launcherUnchanged', 'inputUnchanged', 'negativeEvidenceUnchanged',
    'inputManifestUnchanged', 'preEndTerminalUnchanged', 'configUnchanged', 'outputUnchangedAfterAudit']) check(terminal[field] === true, field);
  for (const field of ['sourceCommit', 'sourceManifestSha256', 'sourceFiles', 'inputPath', 'inputSha256', 'inputManifestPath',
    'inputManifestSha256', 'inputWalBytesBefore', 'runtimePath', 'runtimeSha256', 'negativeEvidencePath', 'runnerPid',
    'fixtureRuleProfileId', 'ruleProfileSha256', 'preEndSourceCommit', 'preEndSourceManifestSha256']) same(terminal[field], admission[field], 'admission');
  check(record(inputManifest), 'inputManifest');
  for (const [field, value] of Object.entries(CONSTRUCTION)) {
    for (const target of [expected, inputManifest, admission, terminal]) same(target[field], value, 'construction');
  }
  check(expected.fixtureRuleProfileId === 'npb-2026' && terminal.fixtureRuleProfileId === expected.fixtureRuleProfileId
    && inputManifest.ruleProfileId === expected.fixtureRuleProfileId
    && expected.ruleProfileSha256 === PROFILE && terminal.ruleProfileSha256 === PROFILE && inputManifest.ruleProfileSha256 === PROFILE, 'ruleProfile');
  check(commit(expected.preEndSourceCommit) && hash(expected.preEndSourceManifestSha256)
    && terminal.preEndSourceCommit === expected.preEndSourceCommit && terminal.preEndSourceManifestSha256 === expected.preEndSourceManifestSha256
    && inputManifest.sourceCommit === expected.preEndSourceCommit && inputManifest.sourceManifestSha256 === expected.preEndSourceManifestSha256, 'preEndSource');
  same(terminal.sourceCommit, expected.sourceCommit, 'sourceCommit');
  same(terminal.sourceManifestSha256, expected.sourceManifestSha256, 'sourceBeforeManifestSha256');
  same(observed.sourceBeforeManifestSha256, expected.sourceManifestSha256, 'sourceBeforeManifestSha256');
  same(observed.sourceAfterManifestSha256, expected.sourceManifestSha256, 'sourceAfterManifestSha256');
  check(terminal.sourceFiles === expected.sourceFiles && observed.sourceFiles === expected.sourceFiles, 'sourceFiles');
  check(path(terminal.runtimePath) && hash(expected.runtimeSha256) && terminal.runtimeSha256 === expected.runtimeSha256
    && observed.runtimeSha256 === expected.runtimeSha256, 'runtimeSha256');
  check(keys(expected.launcherHashes, CONTROLS) && Object.values(expected.launcherHashes).every(hash), 'launcherHashes');
  same(terminal.launcherHashes, admission.launcherHashes, 'launcherHashes');
  same(controls(terminal.launcherHashes), expected.launcherHashes, 'launcherHashes');
  same(observed.launcherHashes, expected.launcherHashes, 'launcherHashes');
  check(hash(expected.originalInputSha256) && ![LEGACY_INPUT, CONSTRUCTION.originalConstructionDatabaseSha256].includes(expected.originalInputSha256)
    && terminal.inputSha256 === expected.originalInputSha256 && observed.originalInputSha256 === expected.originalInputSha256
    && path(expected.originalInputPath) && terminal.inputPath === expected.originalInputPath, 'originalInputSha256');
  check(wal(terminal.inputWalBytesBefore) && wal(terminal.inputWalBytesAfter) && wal(observed.inputWalBytes), 'inputWalBytes');
  check(counts(terminal.counts), 'counts');
  check(results.success === true && counts(results) && Array.isArray(results.testResults) && results.testResults.length === 1, 'results');
  const suite = results.testResults[0];
  check(record(suite) && suite.status === 'passed' && path(suite.name)
    && suite.name.endsWith('/src/host/world/ActualKnownProfileArtifactAcceptance.test.ts')
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
  check(artifactAudit.artifact === config.physicalArtifactPath && artifactAudit.mainFilename === config.physicalArtifactPath
    && artifactAudit.journalMode === 'wal' && artifactAudit.fileSha256 === config.physicalArtifactSha256, 'artifactAudit');
  check(hash(expected.inputManifestSha256) && observed.inputManifestSha256 === expected.inputManifestSha256
    && terminal.inputManifestSha256 === expected.inputManifestSha256 && path(terminal.inputManifestPath)
    && inputManifest.schema === 'synthetic_first_base_known_profile_pre_end_fixture_v1' && inputManifest.databaseSha256 === expected.originalInputSha256
    && inputManifest.physicalEndRows === 0 && inputManifest.sealRows === 0 && inputManifest.uncheckpointedWalBytes === 0, 'inputManifest');
  check(keys(inputManifest.request, REQUEST) && Object.values(inputManifest.request).every(nonempty)
    && inputManifest.request.sourceId === config.physicalEndSourceId, 'inputManifest');
  const original = tables(inputManifest.tables, 'inputManifest'), output = tables(artifactAudit.tables, 'artifactAudit');
  for (const name of TERMINAL_TABLES) check(original.get(name)?.count === 0, 'inputManifest');
  const end = output.get(TERMINAL_TABLES[0]);
  check(end?.count === 1 && Array.isArray(end.originals) && end.originals.length === 1
    && record(end.originals[0]) && end.originals[0].sourceId === config.physicalEndSourceId
    && hash(end.originals[0].sourceHash) && hash(end.originals[0].snapshotHash) && hash(end.originals[0].rowHash), 'physicalEnd');
  check(output.get(TERMINAL_TABLES[1])?.count === 1, 'physicalFence');
  same([...output.keys()].sort(), [...original.keys()].sort(), 'originalTables');
  for (const [name, before] of original) {
    if (!TERMINAL_TABLES.includes(name)) check(output.get(name).count === before.count && output.get(name).logicalRowsHash === before.logicalRowsHash, 'originalTables');
  }
  check(keys(expected.negativeEvidenceHashes, [WITNESS]) && hash(expected.negativeEvidenceHashes[WITNESS])
    && !LEGACY_NEGATIVE.has(expected.negativeEvidenceHashes[WITNESS])
    && !Object.hasOwn(admission, 'negativeEvidenceHashes') && path(terminal.negativeEvidencePath)
    && basename(terminal.negativeEvidencePath) === WITNESS, 'negativeEvidenceHashes');
  same(terminal.negativeEvidenceHashes, expected.negativeEvidenceHashes, 'negativeEvidenceHashes');
  same(observed.negativeEvidenceHashes, expected.negativeEvidenceHashes, 'negativeEvidenceHashes');
  check(record(negativeEvidence) && negativeEvidence.schema === 'known_profile_seal_insert_rollback_v1'
    && !['kind', 'publicationProjection', 'originalRawReceiptSha256'].some(key => Object.hasOwn(negativeEvidence, key)), 'negativeEvidence');
  for (const field of ['sourceCommit', 'sourceManifestSha256', 'fixtureRuleProfileId', 'inputSha256', 'inputManifestSha256']) same(negativeEvidence[field], terminal[field], 'negativeEvidence');
  check(terminal.observedForks.some(value => value.pid === negativeEvidence.actualWorkerPid), 'negativeEvidence');
  same(negativeEvidence.request, inputManifest.request, 'negativeEvidence');
  same(negativeEvidence.witnessedSql, 'INSERT INTO actual_live_play_fences VALUES(?,?,?,?)', 'negativeEvidence');
  same(negativeEvidence.observedInsert, { endRows: 1, sealRows: 1, dependencySnapshotHash: 'changed-during-seal' }, 'negativeEvidence');
  check(negativeEvidence.endRowsAfterRollback === 0 && negativeEvidence.sealRowsAfterRollback === 0, 'negativeEvidence');
  const originals = inputManifest.tables.filter(row => !TERMINAL_TABLES.includes(row.name));
  for (const side of ['before', 'after']) {
    const list = negativeEvidence[`${side}OriginalTables`];
    same(list, originals, 'negativeEvidence');
    same(negativeEvidence[`${side}OriginalTablesSha256`], digest(JSON.stringify(list)), 'negativeEvidence');
  }
};
