import assert from 'node:assert/strict';
import test from 'node:test';
import { assertPhysicalProducerEvidence } from './physical-producer-evidence.mjs';
import { hash, INPUT, CONTROLS, fixture, reseal } from './physical-producer-fixture.test-support.mjs';

test('accepts a complete pure receipt fixture without changing its contents', () => {
  const value = fixture(), before = JSON.stringify(value);
  assert.doesNotThrow(() => assertPhysicalProducerEvidence(value));
  assert.equal(JSON.stringify(value), before);
});
test('accepts relocated evidence and absent WAL files without requiring current workspace paths', () => {
  const value = fixture('/another/portable/location');
  value.admission.inputWalBytesBefore = value.terminal.inputWalBytesBefore = value.terminal.inputWalBytesAfter = value.terminal.outputWalBytes = null;
  value.observed.inputWalBytes = value.observed.outputWalBytes = null;
  assert.doesNotThrow(() => assertPhysicalProducerEvidence(reseal(value)));
});
test('preserves the existing mismatched artifact hash rejection', () => {
  const value = fixture(); value.observed.physicalArtifactSha256 = hash('changed bytes');
  assert.throws(() => assertPhysicalProducerEvidence(value));
});
test('preserves the existing mismatched receipt hash rejection', () => {
  const value = fixture(); value.observed.physicalEvidenceSha256 = hash('changed bytes');
  assert.throws(() => assertPhysicalProducerEvidence(value));
});
test('accepts normal raw Vitest fields and nested test metadata', () => {
  const value = fixture();
  Object.assign(value.results, { numTotalTestSuites: 1, numPassedTestSuites: 1, numFailedTestSuites: 0, numPendingTestSuites: 0,
    numTodoTests: 0, startTime: 1, snapshot: { added: 0, failure: false, uncheckedKeysByFile: [] } });
  Object.assign(value.results.testResults[0], { startTime: 1, endTime: 2, message: '' });
  Object.assign(value.results.testResults[0].assertionResults[0], { ancestorTitles: [], duration: 1, failureMessages: [],
    meta: { schema: 'test_metadata_v1', publicationProjection: 'literal nested test metadata' } });
  assert.doesNotThrow(() => assertPhysicalProducerEvidence(value));
});
test('keeps the explicitly published input manifest outside the raw receipt boundary', () => {
  const value = fixture();
  value.inputManifest.publicationProjection = 'published fixture index';
  value.inputManifest.originalRawReceiptSha256 = hash('original fixture index');
  value.config.physicalProducer.inputManifestSha256 = value.observed.inputManifestSha256 = hash(JSON.stringify(value.inputManifest));
  assert.doesNotThrow(() => assertPhysicalProducerEvidence(value));
});
for (const field of ['admission', 'results', 'artifactAudit']) {
  for (const [marker, markerValue] of Object.entries({ publicationProjection: 'private paths removed',
    originalRawReceiptSha256: hash('unprojected original'), schema: 'synthetic_producer_publication_receipt_v1' })) {
    test(`rejects ${field} carrying top-level ${marker} despite valid required fields`, () => {
      const value = fixture(); value[field][marker] = markerValue;
      assert.throws(() => assertPhysicalProducerEvidence(value), { message: 'physical producer: rawEvidence' });
    });
  }
}

const rejectionCases = [
  ['missing producer contract', 'contract', x => { delete x.config.physicalProducer; }],
  ['unsuccessful producer with correctly pinned bytes', 'gatePassed', x => { x.terminal.gatePassed = false; }],
  ['truthy success flag instead of true', 'gatePassed', x => { x.terminal.gatePassed = 'true'; }],
  ['nonzero child exit', 'childExitCode', x => { x.terminal.childExitCode = 130; }],
  ['missing stop status', 'stopReason', x => { delete x.terminal.stopReason; }],
  ['interrupted run', 'stopReason', x => { x.terminal.stopReason = 'coordinator_requested_interruption'; }],
  ['sanitized publication projection presented as raw producer evidence', 'rawEvidence', x => { x.terminal.publicationProjection = 'Private paths removed'; }],
  ['pending watcher backup decorated with arbitrary successful gate fields', 'rawEvidence', x => { x.terminal.kind = 'committed end backup; final assertions/reopen/retry still pending'; }],
  ...['sourceUnchanged', 'runtimeUnchanged', 'launcherUnchanged', 'inputUnchanged', 'negativeEvidenceUnchanged'].map(field =>
    [`false ${field}`, field, x => { x.terminal[field] = false; }]),
  ['wrong producer Source commit', 'sourceCommit', x => { x.terminal.sourceCommit = 'f'.repeat(40); }],
  ['admission from another Source', 'admission', x => { x.admission.sourceCommit = 'e'.repeat(40); }],
  ['changed initial source manifest', 'sourceBeforeManifestSha256', x => { x.observed.sourceBeforeManifestSha256 = hash('changed source'); }],
  ['changed final source manifest', 'sourceAfterManifestSha256', x => { x.observed.sourceAfterManifestSha256 = hash('changed source'); }],
  ['mismatched source-file count', 'sourceFiles', x => { x.observed.sourceFiles++; }],
  ['changed runtime bytes', 'runtimeSha256', x => { x.observed.runtimeSha256 = hash('other Node'); }],
  ['changed copied launcher control', 'launcherHashes', x => { x.observed.launcherHashes['audit-artifact.mjs'] = hash('other audit'); }],
  ['extra aliased launcher control', 'launcherHashes', x => { x.terminal.launcherHashes['/elsewhere/audit-artifact.mjs'] = CONTROLS['audit-artifact.mjs']; }],
  ['missing published negative proof', 'negativeEvidenceHashes', x => { delete x.observed.negativeEvidenceHashes['interruption-terminal.json']; }],
  ['substituted negative proof even when config and report agree', 'negativeEvidenceHashes', x => {
    for (const map of [x.config.physicalProducer.negativeEvidenceHashes, x.terminal.negativeEvidenceHashes, x.admission.negativeEvidenceHashes, x.observed.negativeEvidenceHashes]) map['negative-phase-evidence.json'] = hash('invented proof');
  }],
  ['different original lineage even when config and report agree', 'originalInputSha256', x => {
    x.config.physicalProducer.originalInputSha256 = x.terminal.inputSha256 = x.admission.inputSha256 = x.observed.originalInputSha256 = hash('other input');
  }],
  ['changed original input bytes', 'originalInputSha256', x => { x.observed.originalInputSha256 = hash('changed input'); }],
  ['input WAL still contains data', 'inputWalBytes', x => { x.observed.inputWalBytes = 4096; }],
  ['one test passed out of two', 'counts', x => { x.terminal.counts.numPassedTests = 1; }],
  ['pending test reported', 'counts', x => { x.terminal.counts.numPendingTests = 1; }],
  ['failed test reported', 'counts', x => { x.terminal.counts.numFailedTests = 1; }],
  ['extra test in the selected gate', 'counts', x => { x.terminal.counts.numTotalTests = 3; }],
  ['a skipped assertion hidden by aggregate counts', 'results', x => { x.results.testResults[0].assertionResults[1].status = 'pending'; }],
  ['an unrelated passing test replaces real acceptance', 'results', x => { x.results.testResults[0].assertionResults[1].title = x.results.testResults[0].assertionResults[1].fullName = 'only checks a DTO'; }],
  ['no actual worker observed', 'observedForks', x => { x.terminal.observedForks = []; }],
  ['launcher receipt presented as a worker', 'observedForks', x => { x.terminal.observedForks[0].worker = false; }],
  ['uncapped actual worker', 'observedForks', x => { x.terminal.observedForks[0].heapLimitMiB = 2144; }],
  ['different actual Node version', 'observedForks', x => { x.terminal.observedForks[0].nodeVersion = '26.9.0'; }],
  ['live straggler remains', 'stragglersAfterReap', x => { x.terminal.stragglersAfterReap = [211]; }],
  ['artifact audit failed', 'artifactAuditExitCode', x => { x.terminal.artifactAuditExitCode = 1; }],
  ['output path is a pending watcher backup', 'outputPath', x => { x.terminal.outputPath = '/pure-fixture/committed-end-pending-final-proof.sqlite'; }],
  ['pending watcher receipt substituted for terminal success', 'gatePassed', x => {
    x.terminal = { kind: 'committed end backup; final assertions/reopen/retry still pending', path: x.config.physicalArtifactPath, sha256: x.config.physicalArtifactSha256, originalInputSha256: INPUT, endRows: [['physical-end']], sealRows: [['physical-end']] };
  }],
  ['changed output hash in the producer report', 'outputSha256', x => { x.terminal.outputSha256 = hash('other output'); }],
  ['reported output WAL is nonempty', 'outputWalBytes', x => { x.terminal.outputWalBytes = 4096; }],
  ['observed output WAL is nonempty', 'outputWalBytes', x => { x.observed.outputWalBytes = 4096; }],
  ['artifact audit refers to another output', 'artifactAudit', x => { x.artifactAudit.fileSha256 = hash('other audited output'); }],
  ['audit used a non-WAL database', 'artifactAudit', x => { x.artifactAudit.journalMode = 'delete'; }],
  ['artifact audit has no persisted end', 'physicalEnd', x => { x.artifactAudit.tables[1].count = 0; x.artifactAudit.tables[1].originals = []; }],
  ['artifact audit has a different end Source', 'physicalEnd', x => { x.artifactAudit.tables[1].originals[0].sourceId = 'other-end'; }],
  ['artifact audit has no seal', 'physicalFence', x => { x.artifactAudit.tables[2].count = 0; }],
  ['original table changed after physical completion', 'originalTables', x => { x.artifactAudit.tables[0].logicalRowsHash = hash('changed original rows'); }],
  ['published input manifest bytes changed', 'inputManifest', x => { x.observed.inputManifestSha256 = hash('changed manifest'); }],
];
for (const [name, reason, mutate] of rejectionCases) {
  test(`rejects ${name}`, () => {
    const value = fixture(); mutate(value); reseal(value);
    assert.throws(() => assertPhysicalProducerEvidence(value), { message: `physical producer: ${reason}` });
  });
}
