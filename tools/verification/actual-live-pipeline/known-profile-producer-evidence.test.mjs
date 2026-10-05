import assert from 'node:assert/strict';
import test from 'node:test';
import { assertKnownProfileProducerEvidence } from './known-profile-producer-evidence.mjs';
import { CONSTRUCTION, CONTROL_NAMES, LEGACY_INPUT, LEGACY_NEGATIVE, WITNESS_NAME, fixture, hash, reseal } from './known-profile-producer-fixture.test-support.mjs';

// Every object is synthetic test data. These tests authenticate no SQLite end.
test('accepts the complete new-profile JSON contract without mutating its inputs', () => {
  const value = fixture(), before = JSON.stringify(value);
  assert.doesNotThrow(() => assertKnownProfileProducerEvidence(value));
  assert.equal(JSON.stringify(value), before);
});
test('accepts explicit relocated evidence with absent WAL files', () => {
  const x = fixture('/another/known-profile/location');
  x.admission.inputWalBytesBefore = x.terminal.inputWalBytesBefore = x.terminal.inputWalBytesAfter = x.terminal.outputWalBytes = null;
  x.observed.inputWalBytes = x.observed.outputWalBytes = null;
  assert.doesNotThrow(() => assertKnownProfileProducerEvidence(reseal(x)));
});
test('accepts distinct explicitly pinned pre-end and end Source cuts', () => {
  const x = fixture();
  assert.notEqual(x.inputManifest.sourceCommit, x.terminal.sourceCommit);
  assert.notEqual(x.inputManifest.sourceManifestSha256, x.terminal.sourceManifestSha256);
  assert.equal(Object.hasOwn(x.admission, 'negativeEvidenceHashes'), false);
  assert.doesNotThrow(() => assertKnownProfileProducerEvidence(x));
});
test('allows nested raw result metadata and the supporting manifest schema', () => {
  const x = fixture();
  x.results.testResults[0].assertionResults[0].meta = { schema: 'nested_metadata_v1', publicationProjection: 'nested literal' };
  x.inputManifest.publicationProjection = 'supporting manifest only';
  assert.doesNotThrow(() => assertKnownProfileProducerEvidence(x));
});
test('preserves mismatched measured physical-artifact rejection', () => {
  const x = fixture(); x.observed.physicalArtifactSha256 = hash('changed artifact');
  assert.throws(() => assertKnownProfileProducerEvidence(x));
});
test('preserves mismatched measured terminal-byte rejection', () => {
  const x = fixture(); x.observed.physicalEvidenceSha256 = hash('changed terminal');
  assert.throws(() => assertKnownProfileProducerEvidence(x));
});

const cases = [];
const reject = (name, reason, mutate) => cases.push([name, reason, mutate]);
const bindInput = (x, value) => {
  x.config.physicalProducer.originalInputSha256 = x.terminal.inputSha256 = x.admission.inputSha256
    = x.observed.originalInputSha256 = x.inputManifest.databaseSha256 = x.negativeEvidence.inputSha256 = value;
};
reject('absent producer contract', 'contract', x => { delete x.config.physicalProducer; });
reject('old v1 kind carrying the new receipt shape', 'contract', x => { x.config.physicalProducer.kind = 'first_base_clean_producer_v1'; });
reject('failed gate', 'gatePassed', x => { x.terminal.gatePassed = false; });
reject('truthy gate string', 'gatePassed', x => { x.terminal.gatePassed = 'true'; });
reject('nonzero child exit', 'childExitCode', x => { x.terminal.childExitCode = 1; });
reject('missing stop status', 'stopReason', x => { delete x.terminal.stopReason; });
reject('interrupted success-like receipt', 'stopReason', x => { x.terminal.stopReason = 'interrupted'; });
for (const role of ['terminal', 'admission', 'results', 'artifactAudit']) {
  for (const marker of ['kind', 'schema', 'publicationProjection', 'originalRawReceiptSha256']) {
    reject(`${role} publication marker ${marker}`, 'rawEvidence', x => { x[role][marker] = hash('publication projection'); });
  }
}
for (const field of ['sourceUnchanged', 'runtimeUnchanged', 'launcherUnchanged', 'inputUnchanged', 'negativeEvidenceUnchanged']) {
  reject(`false ${field}`, field, x => { x.terminal[field] = false; });
}
for (const field of ['sourceCommit', 'sourceManifestSha256', 'sourceFiles', 'inputPath', 'inputSha256', 'inputManifestPath',
  'inputManifestSha256', 'inputWalBytesBefore', 'runtimePath', 'runtimeSha256', 'negativeEvidencePath', 'runnerPid',
  'fixtureRuleProfileId', 'ruleProfileSha256', 'preEndSourceCommit', 'preEndSourceManifestSha256']) {
  reject(`admission disagrees on ${field}`, 'admission', x => { x.admission[field] = 'different'; });
}
for (const field of Object.keys(CONSTRUCTION)) {
  reject(`missing configured ${field}`, 'construction', x => { delete x.config.physicalProducer[field]; });
  reject(`substituted ${field} in every receipt`, 'construction', x => {
    const replacement = field.endsWith('Commit') ? 'd'.repeat(40) : hash('unproven construction');
    for (const target of [x.config.physicalProducer, x.inputManifest, x.admission, x.terminal]) target[field] = replacement;
  });
  reject(`manifest disagrees on ${field}`, 'construction', x => { x.inputManifest[field] = hash('other construction'); });
  reject(`admission disagrees on ${field}`, 'construction', x => { x.admission[field] = hash('other construction'); });
}
reject('legacy a546 bytes even when every declared fresh pin agrees', 'originalInputSha256', x => { bindInput(x, LEGACY_INPUT); });
reject('constructor database substituted for the completed pre-end', 'originalInputSha256', x => { bindInput(x, CONSTRUCTION.originalConstructionDatabaseSha256); });
reject('missing explicit fresh pre-end hash', 'originalInputSha256', x => { delete x.config.physicalProducer.originalInputSha256; });
reject('changed independently observed pre-end bytes', 'originalInputSha256', x => { x.observed.originalInputSha256 = hash('changed input'); });
reject('raw input hash disagrees with its explicit pin', 'originalInputSha256', x => { x.admission.inputSha256 = x.terminal.inputSha256 = hash('other input'); });
reject('legacy supporting manifest schema', 'inputManifest', x => { x.inputManifest.schema = 'synthetic_first_base_pre_end_fixture_v1'; });
reject('input manifest database hash disagrees', 'inputManifest', x => { x.inputManifest.databaseSha256 = hash('other input'); });
reject('input manifest bytes differ from their configured pin', 'inputManifest', x => { x.observed.inputManifestSha256 = hash('changed manifest'); });
reject('input manifest pin omitted', 'inputManifest', x => { delete x.config.physicalProducer.inputManifestSha256; });
for (const field of ['physicalEndRows', 'sealRows', 'uncheckpointedWalBytes']) {
  reject(`nonzero pre-end manifest ${field}`, 'inputManifest', x => { x.inputManifest[field] = 1; });
}
reject('unknown profile even when config and all receipts agree', 'ruleProfile', x => {
  for (const target of [x.config.physicalProducer, x.admission, x.terminal, x.negativeEvidence]) target.fixtureRuleProfileId = 'test-rules';
  x.inputManifest.ruleProfileId = 'test-rules';
});
reject('invented npb-2026 profile hash even when all receipts agree', 'ruleProfile', x => {
  for (const target of [x.config.physicalProducer, x.inputManifest, x.admission, x.terminal]) target.ruleProfileSha256 = hash('replaced profile');
});
reject('missing declared profile hash', 'ruleProfile', x => { delete x.config.physicalProducer.ruleProfileSha256; });
reject('manifest profile id differs', 'ruleProfile', x => { x.inputManifest.ruleProfileId = 'test-rules'; });
reject('manifest profile hash differs', 'ruleProfile', x => { x.inputManifest.ruleProfileSha256 = hash('other profile'); });
reject('missing configured pre-end Source commit', 'preEndSource', x => { delete x.config.physicalProducer.preEndSourceCommit; });
reject('missing configured pre-end Source manifest', 'preEndSource', x => { delete x.config.physicalProducer.preEndSourceManifestSha256; });
reject('pre-end manifest Source commit differs', 'preEndSource', x => { x.inputManifest.sourceCommit = 'a'.repeat(40); });
reject('pre-end manifest Source hash differs', 'preEndSource', x => { x.inputManifest.sourceManifestSha256 = hash('other cut'); });
reject('raw pre-end Source differs from configured pin', 'preEndSource', x => { x.admission.preEndSourceCommit = x.terminal.preEndSourceCommit = 'b'.repeat(40); });
reject('end Source differs from configured pin', 'sourceCommit', x => { x.admission.sourceCommit = x.terminal.sourceCommit = 'b'.repeat(40); });
for (const field of ['sourceBeforeManifestSha256', 'sourceAfterManifestSha256']) {
  reject(`changed independently observed ${field}`, field, x => { x.observed[field] = hash('changed Source'); });
}
reject('changed independently observed Source count', 'sourceFiles', x => { x.observed.sourceFiles++; });
reject('changed independently observed runtime bytes', 'runtimeSha256', x => { x.observed.runtimeSha256 = hash('changed runtime'); });
reject('missing independently observed runtime identity', 'runtimeSha256', x => { delete x.observed.runtimeSha256; });
for (const name of CONTROL_NAMES) {
  reject(`changed independently observed ${name}`, 'launcherHashes', x => { x.observed.launcherHashes[name] = hash('changed control'); });
}
reject('legacy launcher substituted for known-profile launcher', 'launcherHashes', x => {
  const from = 'run-known-profile-acceptance.py', to = 'run-minimal-clean-acceptance.py';
  for (const map of [x.config.physicalProducer.launcherHashes, x.observed.launcherHashes]) { map[to] = map[from]; delete map[from]; }
  for (const target of [x.terminal, x.admission]) {
    const path = Object.keys(target.launcherHashes).find(key => key.endsWith(`/${from}`));
    target.launcherHashes[path.replace(from, to)] = target.launcherHashes[path]; delete target.launcherHashes[path];
  }
});
reject('extra aliased control with the same basename', 'launcherHashes', x => { x.terminal.launcherHashes['/elsewhere/audit-artifact.mjs'] = hash('aliased audit'); });
for (const [role, field] of [['terminal', 'inputWalBytesBefore'], ['terminal', 'inputWalBytesAfter'], ['observed', 'inputWalBytes']]) {
  reject(`nonempty ${role}.${field}`, 'inputWalBytes', x => { x[role][field] = 4096; if (field === 'inputWalBytesBefore') x.admission[field] = 4096; });
}
reject('unknown input WAL state', 'inputWalBytes', x => { delete x.observed.inputWalBytes; });
for (const [field, value] of [['numTotalTests', 3], ['numPassedTests', 1], ['numFailedTests', 1], ['numPendingTests', 1], ['numSkippedTests', 1], ['numTodoTests', 1]]) {
  reject(`terminal count ${field}=${value}`, 'counts', x => { x.terminal.counts[field] = value; });
}
reject('raw results success false', 'results', x => { x.results.success = false; });
reject('raw results contain a skipped test', 'results', x => { x.results.numSkippedTests = 1; });
reject('raw results duplicate a suite', 'results', x => { x.results.testResults.push(structuredClone(x.results.testResults[0])); });
reject('old acceptance suite substituted', 'results', x => { x.results.testResults[0].name = '/source/src/host/world/ActualFirstBaseArtifactAcceptance.test.ts'; });
reject('failed raw suite', 'results', x => { x.results.testResults[0].status = 'failed'; });
reject('one skipped assertion hidden by aggregate counts', 'results', x => { x.results.testResults[0].assertionResults[1].status = 'pending'; });
reject('an unrelated passing assertion replaces native acceptance', 'results', x => { x.results.testResults[0].assertionResults[1].title = x.results.testResults[0].assertionResults[1].fullName = 'only checks a DTO'; });
reject('duplicate passing assertion names', 'results', x => { x.results.testResults[0].assertionResults[1] = structuredClone(x.results.testResults[0].assertionResults[0]); });
reject('assertion title differs from exact full name', 'results', x => { x.results.testResults[0].assertionResults[0].title = 'different'; });
reject('no actual worker fork', 'observedForks', x => { x.terminal.observedForks = []; });
for (const [field, value] of [['worker', false], ['nodeVersion', '26.9.0'], ['heapLimitMiB', 2144], ['requestedOldSpaceMiB', 2048], ['pid', 0]]) {
  reject(`invalid actual worker ${field}`, 'observedForks', x => { x.terminal.observedForks[0][field] = value; });
}
reject('runner PID substituted for actual worker', 'observedForks', x => { x.terminal.observedForks[0].pid = x.terminal.runnerPid; });
reject('duplicate worker PIDs', 'observedForks', x => { x.terminal.observedForks.push(structuredClone(x.terminal.observedForks[0])); });
reject('live owned process remains', 'stragglersAfterReap', x => { x.terminal.stragglersAfterReap = [211]; });
reject('failed output audit', 'artifactAuditExitCode', x => { x.terminal.artifactAuditExitCode = 1; });
reject('pending backup output path', 'outputPath', x => { x.terminal.outputPath = '/evidence/pending-backup.sqlite'; });
reject('output hash disagrees with configuration', 'outputSha256', x => { x.terminal.outputSha256 = hash('different output'); });
for (const role of ['terminal', 'observed']) {
  reject(`nonempty ${role} output WAL`, 'outputWalBytes', x => { x[role].outputWalBytes = 4096; });
}
reject('unknown output WAL state', 'outputWalBytes', x => { delete x.observed.outputWalBytes; });
for (const [field, value] of [['artifact', '/other.sqlite'], ['mainFilename', '/other.sqlite'], ['journalMode', 'delete'], ['fileSha256', hash('different output')]]) {
  reject(`artifact audit disagrees on ${field}`, 'artifactAudit', x => { x.artifactAudit[field] = value; });
}
reject('missing persisted end row', 'physicalEnd', x => { x.artifactAudit.tables[0].count = 0; x.artifactAudit.tables[0].originals = []; });
reject('different persisted end Source', 'physicalEnd', x => { x.artifactAudit.tables[0].originals[0].sourceId = 'other-end'; });
reject('malformed persisted end Source hash', 'physicalEnd', x => { x.artifactAudit.tables[0].originals[0].sourceHash = ''; });
reject('missing seal row', 'physicalFence', x => { x.artifactAudit.tables[1].count = 0; });
reject('changed original table hash after end', 'originalTables', x => { x.artifactAudit.tables[2].logicalRowsHash = hash('changed originals'); });
reject('changed original table count after end', 'originalTables', x => { x.artifactAudit.tables[2].count++; });
reject('extra output table', 'originalTables', x => { x.artifactAudit.tables.push({ name: 'extra', count: 0, logicalRowsHash: hash('[]') }); });
reject('missing output table', 'originalTables', x => { x.artifactAudit.tables.pop(); });
reject('duplicate input table names', 'inputManifest', x => { x.inputManifest.tables.push(structuredClone(x.inputManifest.tables[0])); });
reject('malformed original logical-row hash', 'inputManifest', x => { x.inputManifest.tables[2].logicalRowsHash = 'invalid'; });
reject('pre-populated input end table', 'inputManifest', x => { x.inputManifest.tables[0].count = 1; });
reject('omitted original input seal table', 'inputManifest', x => { x.inputManifest.tables.splice(1, 1); });
reject('missing same-attempt witness object', 'negativeEvidence', x => { delete x.negativeEvidence; });
reject('old 31c29 proofs substituted in every hash map', 'negativeEvidenceHashes', x => {
  for (const target of [x.config.physicalProducer, x.terminal, x.observed]) target.negativeEvidenceHashes = { ...LEGACY_NEGATIVE };
});
reject('legacy negative hash under the new witness basename', 'negativeEvidenceHashes', x => {
  for (const target of [x.config.physicalProducer, x.terminal, x.observed]) target.negativeEvidenceHashes[WITNESS_NAME] = LEGACY_NEGATIVE['negative-phase-evidence.json'];
});
reject('missing independently observed native witness hash', 'negativeEvidenceHashes', x => { delete x.observed.negativeEvidenceHashes; });
reject('native witness changed after the terminal was written', 'negativeEvidenceHashes', x => { x.observed.negativeEvidenceHashes[WITNESS_NAME] = hash('changed witness'); });
reject('pre-admitted witness hash before the native assertion occurred', 'negativeEvidenceHashes', x => { x.admission.negativeEvidenceHashes = { ...x.terminal.negativeEvidenceHashes }; });
reject('wrong witness schema', 'negativeEvidence', x => { x.negativeEvidence.schema = 'published_negative_phase_v1'; });
for (const field of ['kind', 'publicationProjection', 'originalRawReceiptSha256']) {
  reject(`native witness publication marker ${field}`, 'negativeEvidence', x => { x.negativeEvidence[field] = 'publication'; });
}
for (const [field, value] of [['sourceCommit', 'a'.repeat(40)], ['sourceManifestSha256', hash('other Source')],
  ['fixtureRuleProfileId', 'test-rules'], ['inputSha256', hash('other input')], ['inputManifestSha256', hash('other manifest')]]) {
  reject(`native witness disagrees on ${field}`, 'negativeEvidence', x => { x.negativeEvidence[field] = value; });
}
reject('witness PID was never observed as an actual worker', 'negativeEvidence', x => { x.negativeEvidence.actualWorkerPid = 999; });
reject('witness PID belongs to the launcher', 'negativeEvidence', x => { x.negativeEvidence.actualWorkerPid = x.terminal.runnerPid; });
reject('witnessed statement is not the native seal INSERT', 'negativeEvidence', x => { x.negativeEvidence.witnessedSql = 'SELECT 1'; });
for (const [field, value] of [['endRows', 0], ['sealRows', 0], ['dependencySnapshotHash', hash('unchanged dependency')]]) {
  reject(`same-attempt insertion lacks ${field}`, 'negativeEvidence', x => { x.negativeEvidence.observedInsert[field] = value; });
}
for (const field of ['endRowsAfterRollback', 'sealRowsAfterRollback']) {
  reject(`unrolled-back ${field}`, 'negativeEvidence', x => { x.negativeEvidence[field] = 1; });
}
reject('witness request differs from manifest', 'negativeEvidence', x => { x.negativeEvidence.request.executionSourceId = 'other-tail'; });
reject('manifest and witness request omit the actual execution', 'inputManifest', x => { delete x.inputManifest.request.executionSourceId; delete x.negativeEvidence.request.executionSourceId; });
reject('manifest and witness request refer to another physical-end Source', 'inputManifest', x => { x.inputManifest.request.sourceId = x.negativeEvidence.request.sourceId = 'other-end'; });
reject('witness before-table digest does not hash its table list', 'negativeEvidence', x => { x.negativeEvidence.beforeOriginalTablesSha256 = hash('unrelated table digest'); });
reject('witness after-table digest does not hash its table list', 'negativeEvidence', x => { x.negativeEvidence.afterOriginalTablesSha256 = hash('unrelated table digest'); });
reject('original rows changed during failed seal acceptance even when rehashed', 'negativeEvidence', x => {
  x.negativeEvidence.afterOriginalTables[0].logicalRowsHash = hash('changed original');
  x.negativeEvidence.afterOriginalTablesSha256 = hash(JSON.stringify(x.negativeEvidence.afterOriginalTables));
});
reject('both witnessed table lists drift from the admitted input even when rehashed', 'negativeEvidence', x => {
  for (const side of ['before', 'after']) {
    x.negativeEvidence[`${side}OriginalTables`][0].logicalRowsHash = hash('other attempt original');
    x.negativeEvidence[`${side}OriginalTablesSha256`] = hash(JSON.stringify(x.negativeEvidence[`${side}OriginalTables`]));
  }
});
reject('witness omits an original table on both sides even when rehashed', 'negativeEvidence', x => {
  for (const side of ['before', 'after']) {
    x.negativeEvidence[`${side}OriginalTables`].pop();
    x.negativeEvidence[`${side}OriginalTablesSha256`] = hash(JSON.stringify(x.negativeEvidence[`${side}OriginalTables`]));
  }
});

for (const [name, reason, mutate] of cases) {
  test(`rejects ${name}`, () => {
    const x = fixture(); mutate(x); reseal(x);
    assert.throws(() => assertKnownProfileProducerEvidence(x), { message: `known-profile producer: ${reason}` });
  });
}
