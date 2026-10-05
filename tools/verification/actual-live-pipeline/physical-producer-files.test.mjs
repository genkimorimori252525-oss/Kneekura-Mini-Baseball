import assert from 'node:assert/strict';
import test from 'node:test';
import { readPhysicalProducerEvidence } from './physical-producer-files.mjs';
import { assertPhysicalProducerEvidence } from './physical-producer-evidence.mjs';
import { hash, fixture, reseal } from './physical-producer-fixture.test-support.mjs';

// Only the file boundary is supplied by this pure test adapter. No paths below
// exist, no filesystem file is read, and no SQLite artifact is fabricated.
const inputs = () => {
  const proof = fixture('/pure-loader-fixture'), bytes = new Map(), measuredHashes = new Map(), reads = [], wals = new Map();
  const root = '/pure-loader-fixture/evidence';
  const pinJson = (name, value) => {
    const path = `${root}/${name}`, valueBytes = Buffer.from(JSON.stringify(value)); bytes.set(path, valueBytes);
    const sha256 = hash(valueBytes); measuredHashes.set(path, sha256); return { path, sha256 };
  };
  const pinMeasured = (name, sha256) => { const path = `${root}/${name}`; measuredHashes.set(path, sha256); return { path, sha256 }; };
  const manifest = ['one.ts','two.ts','three.ts'].map(name => `${hash(name)}  ${name}\n`).join('');
  proof.config.physicalProducer.sourceManifestSha256 = proof.admission.sourceManifestSha256 = proof.terminal.sourceManifestSha256 = hash(manifest);
  const files = {
    admission: pinJson('admission.json', proof.admission), results: pinJson('results.json', proof.results), artifactAudit: pinJson('artifact.json', proof.artifactAudit),
    inputManifest: pinJson('input-manifest.json', proof.inputManifest),
    sourceBeforeManifest: pinMeasured('source-before.sha256', hash(manifest)), sourceAfterManifest: pinMeasured('source-after.sha256', hash(manifest)),
    runtime: pinMeasured('retained-runtime.bin', proof.config.physicalProducer.runtimeSha256),
    originalInput: pinMeasured('original-input.bin', proof.config.physicalProducer.originalInputSha256),
    controls: Object.fromEntries(Object.entries(proof.config.physicalProducer.launcherHashes).map(([name, value]) => [name, pinMeasured(`controls/${name}`, value)])),
    negativeEvidence: Object.fromEntries(Object.entries(proof.config.physicalProducer.negativeEvidenceHashes).map(([name, value]) => [name, pinMeasured(`published-negative/${name}`, value)])),
  };
  bytes.set(files.sourceBeforeManifest.path, Buffer.from(manifest)); bytes.set(files.sourceAfterManifest.path, Buffer.from(manifest));
  proof.config.physicalProducer.files = files; reseal(proof);
  bytes.set(proof.config.physicalEvidencePath, Buffer.from(JSON.stringify(proof.terminal)));
  measuredHashes.set(proof.config.physicalEvidencePath, proof.config.physicalEvidenceSha256);
  measuredHashes.set(proof.config.physicalArtifactPath, proof.config.physicalArtifactSha256);
  wals.set(proof.config.physicalArtifactPath, 0); wals.set(files.originalInput.path, 0);
  const io = {
    readBytes(path) { reads.push({ operation: 'readBytes', path }); assert(bytes.has(path), `unexpected byte read: ${path}`); return bytes.get(path); },
    fileHash(path) { reads.push({ operation: 'fileHash', path }); assert(measuredHashes.has(path), `unexpected hash read: ${path}`); return measuredHashes.get(path); },
    walBytes(path) { reads.push({ operation: 'walBytes', path }); assert(wals.has(path), `unexpected WAL read: ${path}`); return wals.get(path); },
  };
  return { proof, io, bytes, measuredHashes, reads, wals, files };
};

test('loads a complete measured bundle that satisfies pure semantic admission', () => {
  const x = inputs(), result = readPhysicalProducerEvidence(x.proof.config, x.io);
  assert.deepEqual(result.terminal, x.proof.terminal);
  assert.deepEqual(result.results, x.proof.results);
  assert.deepEqual(result.admission, x.proof.admission);
  assert.deepEqual(result.artifactAudit, x.proof.artifactAudit);
  assert.doesNotThrow(() => assertPhysicalProducerEvidence(result));
  assert.equal(result.observed.sourceFiles, 3);
  assert.equal(result.referencedFiles.length, 17);
  assert.equal(new Set(result.referencedFiles.map(value => value.path)).size, 17);
});
test('rejects pending watcher bytes before any artifact access even when the hash matches', () => {
  const x = inputs(), pending = { gatePassed: false, kind: 'committed end backup; final assertions/reopen/retry still pending' };
  const bytes = Buffer.from(JSON.stringify(pending)); x.bytes.set(x.proof.config.physicalEvidencePath, bytes);
  x.proof.config.physicalEvidenceSha256 = hash(bytes); x.measuredHashes.set(x.proof.config.physicalEvidencePath, hash(bytes));
  assert.throws(() => readPhysicalProducerEvidence(x.proof.config, x.io), { message: 'physical producer: gatePassed' });
  assert.deepEqual(x.reads.map(value => value.path), [x.proof.config.physicalEvidencePath]);
});
test('rejects a pending watcher decorated with success flags before artifact access', () => {
  const x = inputs(); x.proof.terminal.kind = 'committed end backup; final assertions/reopen/retry still pending'; reseal(x.proof);
  x.bytes.set(x.proof.config.physicalEvidencePath, Buffer.from(JSON.stringify(x.proof.terminal)));
  x.measuredHashes.set(x.proof.config.physicalEvidencePath, x.proof.config.physicalEvidenceSha256);
  assert.throws(() => readPhysicalProducerEvidence(x.proof.config, x.io), { message: 'physical producer: rawEvidence' });
  assert.deepEqual(x.reads.map(value => value.path), [x.proof.config.physicalEvidencePath]);
});
test('rejects missing sidecar bindings rather than guessing paths beside terminal.json', () => {
  const x = inputs(); delete x.proof.config.physicalProducer.files.results;
  assert.throws(() => readPhysicalProducerEvidence(x.proof.config, x.io), { message: 'physical producer: fileBindings' });
});
test('rejects altered pinned JSON bytes before treating their content as a result', () => {
  const x = inputs(); x.bytes.set(x.files.results.path, Buffer.from('{"success":true}'));
  assert.throws(() => readPhysicalProducerEvidence(x.proof.config, x.io), { message: 'physical producer: fileHash' });
});
test('rejects an aliased sidecar identity even when its declared hash is valid', () => {
  const x = inputs(); x.files.results = { ...x.files.admission };
  assert.throws(() => readPhysicalProducerEvidence(x.proof.config, x.io), { message: 'physical producer: fileBindings' });
});
test('rejects duplicate source-manifest paths rather than accepting a matching line count', () => {
  const x = inputs(), text = `${hash('a')}  same.ts\n${hash('b')}  same.ts\n${hash('c')}  other.ts\n`;
  for (const key of ['sourceBeforeManifest','sourceAfterManifest']) {
    x.files[key].sha256 = hash(text); x.bytes.set(x.files[key].path, Buffer.from(text)); x.measuredHashes.set(x.files[key].path, hash(text));
  }
  x.proof.config.physicalProducer.sourceManifestSha256 = hash(text);
  assert.throws(() => readPhysicalProducerEvidence(x.proof.config, x.io), { message: 'physical producer: sourceManifest' });
});
test('rejects a missing expected control filename rather than using a partial set', () => {
  const x = inputs(); delete x.files.controls['audit-artifact.mjs'];
  assert.throws(() => readPhysicalProducerEvidence(x.proof.config, x.io), { message: 'physical producer: fileBindings' });
});
for (const field of ['admission', 'results', 'artifactAudit']) {
  for (const [marker, markerValue] of Object.entries({ publicationProjection: 'private paths removed',
    originalRawReceiptSha256: hash('unprojected original'), schema: 'synthetic_producer_publication_receipt_v1' })) {
    test(`rejects re-pinned ${field} with ${marker} before reading the physical artifact`, () => {
      const x = inputs(); x.proof[field][marker] = markerValue;
      const bytes = Buffer.from(JSON.stringify(x.proof[field])), ref = x.files[field];
      ref.sha256 = hash(bytes); x.bytes.set(ref.path, bytes); x.measuredHashes.set(ref.path, ref.sha256);
      assert.throws(() => readPhysicalProducerEvidence(x.proof.config, x.io), { message: 'physical producer: rawEvidence' });
      assert.equal(x.reads.some(read => read.path === x.proof.config.physicalArtifactPath), false);
    });
  }
}
