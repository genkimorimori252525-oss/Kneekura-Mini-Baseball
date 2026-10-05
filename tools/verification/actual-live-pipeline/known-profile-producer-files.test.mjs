import assert from 'node:assert/strict';
import test from 'node:test';
import { readKnownProfileProducerEvidence } from './known-profile-producer-files.mjs';
import { assertKnownProfileProducerEvidence } from './known-profile-producer-evidence.mjs';
import { CONTROL_NAMES, WITNESS_NAME, fileFixture, hash } from './known-profile-producer-fixture.test-support.mjs';

test('loads exactly fifteen distinct explicitly pinned files and decodes the native witness', () => {
  const x = fileFixture(), before = JSON.stringify(x.proof), result = readKnownProfileProducerEvidence(x.proof.config, x.io);
  for (const role of ['terminal', 'admission', 'results', 'artifactAudit', 'inputManifest', 'negativeEvidence']) assert.deepEqual(result[role], x.proof[role]);
  assert.doesNotThrow(() => assertKnownProfileProducerEvidence(result));
  assert.equal(result.referencedFiles.length, 15);
  assert.equal(new Set(result.referencedFiles.map(ref => ref.path)).size, 15);
  assert.equal(Object.isFrozen(result.referencedFiles), true);
  assert.equal(result.referencedFiles.every(Object.isFrozen), true);
  assert.equal(JSON.stringify(x.proof), before);
});
test('observes runtime, input, output and every control independently without reading database bytes into memory', () => {
  const x = fileFixture(), result = readKnownProfileProducerEvidence(x.proof.config, x.io);
  const paths = [x.files.runtime.path, x.files.originalInput.path, x.proof.config.physicalArtifactPath,
    ...CONTROL_NAMES.map(name => x.files.controls[name].path)];
  for (const path of paths) {
    assert.equal(x.reads.filter(read => read.path === path && read.operation === 'fileHash').length, 1);
    assert.equal(x.reads.some(read => read.path === path && read.operation === 'readBytes'), false);
  }
  assert.equal(result.observed.sourceFiles, 3);
  assert.deepEqual(result.observed.negativeEvidenceHashes, x.proof.terminal.negativeEvidenceHashes);
});
test('preserves JSON byte-hash rejection before decoding results', () => {
  const x = fileFixture(); x.bytes.set(x.files.results.path, Buffer.from('{"success":true}'));
  assert.throws(() => readKnownProfileProducerEvidence(x.proof.config, x.io), { message: 'known-profile producer: fileHash' });
});
test('preserves native witness byte-hash rejection before trusting its content', () => {
  const x = fileFixture(); x.bytes.set(x.files.negativeEvidence[WITNESS_NAME].path, Buffer.from('{"observedInsert":true}'));
  assert.throws(() => readKnownProfileProducerEvidence(x.proof.config, x.io), { message: 'known-profile producer: fileHash' });
});

for (const role of ['terminal', 'admission', 'results', 'artifactAudit']) {
  for (const marker of ['kind', 'schema', 'publicationProjection', 'originalRawReceiptSha256']) {
    test(`rejects re-pinned raw ${role} publication marker ${marker} before physical-artifact access`, () => {
      const x = fileFixture(); x.proof[role][marker] = hash('publication identity'); x.repinJson(role, x.proof[role]);
      assert.throws(() => readKnownProfileProducerEvidence(x.proof.config, x.io), { message: 'known-profile producer: rawEvidence' });
      assert.equal(x.reads.some(read => read.path === x.proof.config.physicalArtifactPath), false);
      if (role === 'terminal') assert.deepEqual(x.reads.map(read => read.path), [x.proof.config.physicalEvidencePath]);
    });
  }
}
test('rejects an unsuccessful terminal before touching any other file', () => {
  const x = fileFixture(); x.proof.terminal.gatePassed = false; x.repinJson('terminal', x.proof.terminal);
  assert.throws(() => readKnownProfileProducerEvidence(x.proof.config, x.io), { message: 'known-profile producer: gatePassed' });
  assert.deepEqual(x.reads.map(read => read.path), [x.proof.config.physicalEvidencePath]);
});
const cases = [];
const reject = (name, reason, mutate) => cases.push([name, reason, mutate]);
for (const role of ['admission', 'results', 'artifactAudit', 'inputManifest', 'sourceBeforeManifest', 'sourceAfterManifest', 'runtime', 'originalInput']) {
  reject(`missing explicit ${role} pin`, 'fileBindings', x => { delete x.files[role]; });
}
for (const name of CONTROL_NAMES) {
  reject(`missing explicit ${name} control pin`, 'fileBindings', x => { delete x.files.controls[name]; });
}
reject('missing native witness pin', 'fileBindings', x => { delete x.files.negativeEvidence[WITNESS_NAME]; });
reject('missing terminal pin', 'fileBindings', x => { delete x.proof.config.physicalEvidencePath; });
reject('missing output pin', 'fileBindings', x => { delete x.proof.config.physicalArtifactSha256; });
reject('extra guessed sidecar pin', 'fileBindings', x => { x.files.guessed = { ...x.files.results, path: '/extra.json' }; });
reject('extra negative proof pin', 'fileBindings', x => { x.files.negativeEvidence['interruption-terminal.json'] = { ...x.files.negativeEvidence[WITNESS_NAME], path: '/old-negative.json' }; });
reject('legacy control filename', 'fileBindings', x => { x.files.controls['run-minimal-clean-acceptance.py'] = x.files.controls['run-known-profile-acceptance.py']; delete x.files.controls['run-known-profile-acceptance.py']; });
reject('unknown producer kind', 'fileBindings', x => { x.proof.config.physicalProducer.kind = 'first_base_clean_producer_v1'; });
reject('relative input reference', 'fileBindings', x => { x.files.originalInput.path = 'relative/input.sqlite'; });
reject('unnormalized sidecar reference', 'fileBindings', x => { x.files.results.path = '/same/../results.json'; });
reject('missing sidecar hash', 'fileBindings', x => { delete x.files.results.sha256; });
reject('uppercase SHA256 reference', 'fileBindings', x => { x.files.results.sha256 = x.files.results.sha256.toUpperCase(); });
reject('output aliased to original input', 'fileBindings', x => { x.proof.config.physicalArtifactPath = x.files.originalInput.path; });
reject('result aliased to admission', 'fileBindings', x => { x.files.results = { ...x.files.admission }; });
reject('Source-before and Source-after aliased', 'fileBindings', x => { x.files.sourceAfterManifest = { ...x.files.sourceBeforeManifest }; });
reject('native witness aliased to the terminal', 'fileBindings', x => { x.files.negativeEvidence[WITNESS_NAME] = { path: x.proof.config.physicalEvidencePath, sha256: x.proof.config.physicalEvidenceSha256 }; });
for (const [role, field] of [['sourceBeforeManifest', 'sourceManifestSha256'], ['sourceAfterManifest', 'sourceManifestSha256'],
  ['runtime', 'runtimeSha256'], ['originalInput', 'originalInputSha256'], ['inputManifest', 'inputManifestSha256']]) {
  reject(`${role} reference hash disagrees with configured ${field}`, 'fileBindings', x => { x.proof.config.physicalProducer[field] = hash('different declaration'); });
}
reject('control reference hash disagrees with configured hash', 'fileBindings', x => { x.proof.config.physicalProducer.launcherHashes['audit-artifact.mjs'] = hash('different control'); });
reject('witness reference hash disagrees with configured hash', 'fileBindings', x => { x.proof.config.physicalProducer.negativeEvidenceHashes[WITNESS_NAME] = hash('different witness'); });
reject('control reference has a different basename', 'fileBindings', x => { x.files.controls['audit-artifact.mjs'].path = '/controls/renamed.mjs'; });
reject('witness reference has a different basename', 'fileBindings', x => { x.files.negativeEvidence[WITNESS_NAME].path = '/evidence/renamed.json'; });
for (const [role, rawField] of [['runtime', 'runtimePath'], ['originalInput', 'inputPath'], ['inputManifest', 'inputManifestPath']]) {
  reject(`${role} file path differs from raw admitted path`, 'fileBindings', x => {
    for (const target of ['admission', 'terminal']) { x.proof[target][rawField] = '/another/existing-path'; x.repinJson(target, x.proof[target]); }
  });
}
reject('original input reference differs from explicit configuration path', 'fileBindings', x => { x.proof.config.physicalProducer.originalInputPath = '/different/input.sqlite'; });
reject('raw witness path differs from explicit witness file', 'fileBindings', x => {
  for (const role of ['admission', 'terminal']) { x.proof[role].negativeEvidencePath = '/another/seal-insert-rollback.json'; x.repinJson(role, x.proof[role]); }
});
reject('raw control path differs from explicitly pinned control file', 'fileBindings', x => {
  for (const role of ['admission', 'terminal']) {
    const original = x.files.controls['audit-artifact.mjs'].path;
    x.proof[role].launcherHashes['/other/audit-artifact.mjs'] = x.proof[role].launcherHashes[original]; delete x.proof[role].launcherHashes[original];
    x.repinJson(role, x.proof[role]);
  }
});
for (const role of ['runtime', 'originalInput']) {
  reject(`changed independently measured ${role}`, 'fileHash', x => { x.measuredHashes.set(x.files[role].path, hash('changed file')); });
}
reject('changed independently measured output', 'fileHash', x => { x.measuredHashes.set(x.proof.config.physicalArtifactPath, hash('changed output')); });
for (const name of CONTROL_NAMES) {
  reject(`changed independently measured ${name}`, 'fileHash', x => { x.measuredHashes.set(x.files.controls[name].path, hash('changed control')); });
}
const manifests = [
  ['duplicate names', `${hash('a')}  same.ts\n${hash('b')}  same.ts\n`],
  ['absolute name', `${hash('a')}  /outside.ts\n`],
  ['traversing name', `${hash('a')}  ../outside.ts\n`],
  ['dot name component', `${hash('a')}  src/./file.ts\n`],
  ['empty name component', `${hash('a')}  src//file.ts\n`],
  ['missing final newline', `${hash('a')}  source.ts`],
  ['single-space delimiter', `${hash('a')} source.ts\n`],
  ['empty manifest', ''],
  ['malformed source digest', 'not-a-sha256  source.ts\n'],
];
for (const [name, text] of manifests) {
  reject(`Source manifest ${name}`, 'sourceManifest', x => {
    for (const role of ['sourceBeforeManifest', 'sourceAfterManifest']) Object.assign(x.files[role], x.pinBytes(x.files[role].path, text));
    x.proof.config.physicalProducer.sourceManifestSha256 = hash(text);
  });
}
reject('Source bytes disagree with a copied after-manifest pin', 'fileHash', x => {
  Object.assign(x.files.sourceAfterManifest, x.pinBytes(x.files.sourceAfterManifest.path, `${hash('a')}  one.ts\n`));
  // Declared hashes alone cannot substitute for the separately read bytes.
  x.files.sourceBeforeManifest.sha256 = x.files.sourceAfterManifest.sha256;
  x.proof.config.physicalProducer.sourceManifestSha256 = x.files.sourceAfterManifest.sha256;
});
for (const [name, reason, mutate] of cases) {
  test(`rejects ${name}`, () => {
    const x = fileFixture(); mutate(x);
    assert.throws(() => readKnownProfileProducerEvidence(x.proof.config, x.io), { message: `known-profile producer: ${reason}` });
  });
}

// Review RED: native writer requires every preservation flag for gatePassed.
// Re-pin only the terminal bytes; the other fourteen references are unchanged.
for (const field of ['inputManifestUnchanged', 'preEndTerminalUnchanged', 'configUnchanged', 'outputUnchangedAfterAudit']) {
  for (const mutation of ['false', 'missing', 'truthy-string']) {
    test(`rejects writer success flag ${field} mutated to ${mutation} after a valid terminal re-pin`, () => {
      const x = fileFixture();
      if (mutation === 'missing') delete x.proof.terminal[field];
      else x.proof.terminal[field] = mutation === 'false' ? false : 'true';
      x.repinJson('terminal', x.proof.terminal);
      assert.throws(() => assertKnownProfileProducerEvidence(readKnownProfileProducerEvidence(x.proof.config, x.io)),
        { message: `known-profile producer: ${field}` });
    });
  }
}
