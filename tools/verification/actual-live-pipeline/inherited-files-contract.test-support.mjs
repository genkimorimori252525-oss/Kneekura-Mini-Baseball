import assert from 'node:assert/strict';
import test from 'node:test';
import { FILES, JSON_FILES, clone, hash } from './inherited-files-fixture.test-support.mjs';

// Each rejection isolates a file-admission responsibility. Removing its matching
// guard admits changed/missing bytes, an unsafe path, or unverified prior Source.
export const fileLoaderContracts = ({ kind, inputs, read, assertSemantic }) => {
  const run = x => read(x.proof.config, x.proof.producerReference, x.proof.currentSourceManifest, x.io);
  const error = reason => ({ message: `inherited ${kind} files: ${reason}` });
  const reject = (name, change, reason, beforeRead = false, checkReads = () => {}) => test(`${kind} files reject ${name}`, () => {
    const x = inputs(); change(x);
    assert.throws(() => run(x), error(reason));
    if (beforeRead) assert.deepEqual(x.reads, [], 'invalid bindings must not authorize any read');
    checkReads(x);
  });

  test(`${kind} file fixtures have coherent byte pins and satisfy semantic admission`, () => {
    const x = inputs(), result = run(x);
    for (const [name, field] of Object.entries(x.fields)) assert.deepEqual(result[field], x.proof[field], name);
    assert.deepEqual(result.observed, x.proof.observed);
    assert.doesNotThrow(() => assertSemantic(result));
    const refs = [...Object.values(x.files), ...Object.values(x.regressions),
      ...(kind === 'role' ? Object.values(x.proof.priorConfig.inheritedOfficial.files) : [])];
    assert.deepEqual(result.referencedFiles, refs);
    for (const ref of result.referencedFiles) assert.equal(hash(x.bytes.get(ref.path)), ref.sha256, ref.path);
    if (kind === 'role') {
      assert.deepEqual(result.officialEvidence.config, x.proof.priorConfig);
      assert.deepEqual(result.officialEvidence.currentSourceManifest, x.proof.priorSourceManifest);
      assert.equal(result.officialEvidence.referencedFiles.length, 8);
    }
  });
  test(`${kind} references are detached immutable measured pins`, () => {
    const x = inputs(), result = run(x), saved = clone(result.referencedFiles);
    assert(Object.isFrozen(result.referencedFiles));
    assert(result.referencedFiles.every(Object.isFrozen));
    x.files.receipt.sha256 = '0'.repeat(64);
    assert.deepEqual(result.referencedFiles, saved);
  });
  for (const wal of [null, 0]) test(`${kind} accepts explicitly measured WAL ${String(wal)}`, () => {
    const x = inputs(); for (const path of x.wals.keys()) x.wals.set(path, wal);
    const result = run(x); assert.equal(result.observed.outputWalBytes, wal);
    if (kind === 'role') assert.deepEqual(result.observed.regressionWalBytes, { recovery: wal, stale: wal });
    assert.doesNotThrow(() => assertSemantic(result));
  });
  test(`${kind} measures binary artifacts through streaming hashes only`, () => {
    const x = inputs(), readBytes = x.io.readBytes;
    const artifacts = [x.files.artifact.path, ...Object.values(x.regressions).map(ref => ref.path),
      ...(kind === 'role' ? [x.proof.priorConfig.inheritedOfficial.files.artifact.path] : [])];
    x.io.readBytes = path => { assert(!artifacts.includes(path), 'artifact must not be buffered or decoded'); return readBytes(path); };
    run(x);
    for (const path of artifacts) assert(x.reads.some(item => item.operation === 'fileHash' && item.path === path));
  });
  test(`${kind} JSON hashes and decoded documents use the same single byte read`, () => {
    const x = inputs(), originalRead = x.io.readBytes, originalHash = x.io.fileHash;
    const jsonPaths = new Set(JSON_FILES.map(name => x.files[name].path));
    x.io.fileHash = path => { assert(!jsonPaths.has(path), 'JSON must not be separately hashed'); return originalHash(path); };
    const seen = new Set();
    x.io.readBytes = path => {
      if (jsonPaths.has(path)) { assert(!seen.has(path), 'JSON must not be reread after hashing'); seen.add(path); }
      const value = originalRead(path);
      if (jsonPaths.has(path)) x.bytes.set(path, Buffer.from('{"changedAfterRead":true}'));
      return value;
    };
    const result = run(x);
    assert.equal(seen.size, 7);
    for (const [name, field] of Object.entries(x.fields)) {
      assert.deepEqual(result[field], x.proof[field], name);
      assert.equal(result.observed.hashes[name], x.files[name].sha256);
    }
  });
  test(`${kind} validates every prior Source byte and head without reading current Source`, () => {
    const x = inputs(); run(x);
    for (const manifest of x.priorManifests) {
      for (const operation of ['realPath', 'sourceHead', 'sourceTree', 'sourceChangedPaths', 'sourceFilePaths'])
        assert(x.reads.some(item => item.operation === operation && item.path === manifest.sourceRoot), operation);
      for (const entry of manifest.files) assert(x.reads.some(item => item.operation === 'readBytes'
        && item.path === `${manifest.sourceRoot}/${entry.path}`), entry.path);
    }
    const currentRoot = x.proof.currentSourceManifest.sourceRoot;
    assert(!x.reads.some(item => item.path === currentRoot || item.path.startsWith(`${currentRoot}/`)));
  });
  for (const name of FILES) reject(`missing explicit ${name} pin`, x => { delete x.files[name]; }, 'file bindings', true);
  reject('an extra primary file role', x => { x.files.guessedNeighbor = clone(x.files.receipt); }, 'file bindings', true);
  for (const value of [null, [], 'guessed']) reject(`invalid binding ${JSON.stringify(value)}`, x => {
    x.proof.config[kind === 'official' ? 'inheritedOfficial' : 'inheritedRole'] = value;
  }, 'file bindings', true);
  for (const name of FILES) {
    for (const value of ['A'.repeat(64), 123]) reject(`${name} invalid SHA ${String(value).slice(0, 8)}`, x => {
      x.files[name].sha256 = value;
    }, 'file bindings', true);
  }
  for (const name of FILES.slice(1)) reject(`${name} aliased to handoff`, x => {
    x.files[name] = clone(x.files.handoff);
  }, 'file bindings', true);
  const badPaths = ['relative.json', '/a/../receipt.json', '/a/./receipt.json', '/a//receipt.json', '/a/receipt.json/', '/', '', '/a\\receipt.json', '/a\0receipt.json'];
  for (const path of badPaths) reject(`noncanonical file path ${JSON.stringify(path)}`, x => {
    const ref = x.files.receipt; x.bytes.set(path, x.bytes.get(ref.path)); ref.path = path;
  }, 'file bindings', true);
  for (const name of FILES) reject(`changed ${name} bytes behind the pinned hash`, x => {
    const path = x.files[name].path; x.bytes.set(path, Buffer.concat([x.bytes.get(path), Buffer.from(' ')]));
  }, 'file hash');
  for (const name of JSON_FILES) reject(`non-Buffer ${name} bytes`, x => {
    const path = x.files[name].path; x.bytes.set(path, x.bytes.get(path).toString('utf8'));
  }, 'file bytes');
  const badWals = [undefined, 1, -1, true, false, '0', NaN, Infinity];
  for (const [index, wal] of badWals.entries()) reject(`unknown or nonempty output WAL ${index}`, x => {
    x.wals.set(x.files.artifact.path, wal);
  }, 'output WAL');
  const manifestChange = (name, change) => reject(name, x => { change(x.proof.priorSourceManifest, x); x.reseal(); }, 'prior Source', false, x => {
    const root = x.proof.priorSourceManifest.sourceRoot;
    assert(!x.reads.some(item => item.operation === 'readBytes' && item.path.startsWith(`${root}/`)),
      'invalid prior manifest must be rejected before joining and reading its Source paths');
  });
  manifestChange('unknown prior manifest schema', manifest => { manifest.schema = 'publication_manifest'; });
  manifestChange('prior manifest root identity mismatch', manifest => { manifest.sourceRoot = '/different/source'; });
  manifestChange('prior manifest commit identity mismatch', manifest => { manifest.sourceCommit = '9'.repeat(40); });
  manifestChange('prior manifest tree identity mismatch', manifest => { manifest.sourceTree = '9'.repeat(40); });
  for (const value of [null, [], {}]) manifestChange(`invalid prior file census ${JSON.stringify(value)}`, manifest => { manifest.files = value; });
  for (const path of ['../escape.ts', '/absolute.ts', 'src//owner.ts', 'src/./owner.ts', 'src/../owner.ts', 'src\\owner.ts', 'src/owner.ts/', '', 'src/\0owner.ts'])
    manifestChange(`noncanonical prior Source path ${JSON.stringify(path)}`, manifest => { manifest.files[0].path = path; });
  manifestChange('duplicate prior Source path', manifest => { manifest.files.push(clone(manifest.files[0])); });
  manifestChange('invalid prior Source SHA', manifest => { manifest.files[0].sha256 = 'A'.repeat(64); });
  manifestChange('missing prior Source SHA', manifest => { delete manifest.files[0].sha256; });
  reject('prior Source HEAD changed', x => { x.sources.get(x.proof.priorSourceManifest.sourceRoot).head = '9'.repeat(40); }, 'prior Source');
  reject('prior Source tree changed', x => { x.sources.get(x.proof.priorSourceManifest.sourceRoot).tree = '9'.repeat(40); }, 'prior Source');
  reject('dirty prior tracked Source', x => { x.sources.get(x.proof.priorSourceManifest.sourceRoot).changed = ['src/owner.ts']; }, 'prior Source');
  reject('prior Source root resolves elsewhere', x => { x.realPaths.set(x.proof.priorSourceManifest.sourceRoot, '/elsewhere'); }, 'prior Source');
  reject('prior Source file resolves elsewhere', x => {
    const manifest = x.proof.priorSourceManifest; x.realPaths.set(`${manifest.sourceRoot}/${manifest.files[0].path}`, '/elsewhere/owner.ts');
  }, 'prior Source');
  reject('added prior Source path', x => { x.sources.get(x.proof.priorSourceManifest.sourceRoot).paths.push('src/unmanifested.ts'); }, 'prior Source');
  reject('removed prior Source path', x => { x.sources.get(x.proof.priorSourceManifest.sourceRoot).paths.pop(); }, 'prior Source');
  reject('duplicate observed prior Source path', x => {
    const paths = x.sources.get(x.proof.priorSourceManifest.sourceRoot).paths; paths.push(paths[0]);
  }, 'prior Source');
  reject('changed prior Source bytes', x => {
    const manifest = x.proof.priorSourceManifest; x.bytes.set(`${manifest.sourceRoot}/${manifest.files[0].path}`, Buffer.from('changed owner\n'));
  }, 'prior Source');
};
