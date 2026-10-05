import assert from 'node:assert/strict';
import test from 'node:test';
import { readInheritedRoleEvidence } from './inherited-role-files.mjs';
import { assertInheritedRoleEvidence } from './inherited-role-evidence.mjs';
import { FILES, clone, roleInputs } from './inherited-files-fixture.test-support.mjs';
import { fileLoaderContracts } from './inherited-files-contract.test-support.mjs';

fileLoaderContracts({ kind: 'role', inputs: roleInputs, read: readInheritedRoleEvidence, assertSemantic: assertInheritedRoleEvidence });
const run = x => readInheritedRoleEvidence(x.proof.config, x.proof.producerReference, x.proof.currentSourceManifest, x.io);
const reject = (name, change, reason, beforeRead = false) => test(`role files reject ${name}`, () => {
  const x = roleInputs(); change(x);
  assert.throws(() => run(x), { message: `inherited role files: ${reason}` });
  if (beforeRead) assert.deepEqual(x.reads, []);
});
for (const name of ['recovery', 'stale']) {
  reject(`missing explicit ${name} regression`, x => { delete x.regressions[name]; }, 'file bindings', true);
  reject(`invalid ${name} regression SHA`, x => { x.regressions[name].sha256 = 'A'.repeat(64); }, 'file bindings', true);
  reject(`relative ${name} regression path`, x => {
    const ref = x.regressions[name]; x.bytes.set('regression.sqlite', x.bytes.get(ref.path)); ref.path = 'regression.sqlite';
  }, 'file bindings', true);
  for (const primary of FILES) reject(`${name} aliased to primary ${primary}`, x => {
    x.regressions[name] = clone(x.files[primary]);
  }, 'file bindings', true);
  reject(`changed ${name} regression bytes`, x => {
    const path = x.regressions[name].path; x.bytes.set(path, Buffer.concat([x.bytes.get(path), Buffer.from('changed')]));
  }, 'file hash');
  for (const [index, wal] of [undefined, 1, -1, true, false, '0', NaN, Infinity].entries()) reject(`invalid ${name} regression WAL ${index}`, x => {
    x.wals.set(x.regressions[name].path, wal);
  }, 'regression WAL');
}
reject('extra guessed regression pin', x => { x.regressions.extra = clone(x.regressions.recovery); }, 'file bindings', true);
reject('one regression file under both names', x => { x.regressions.stale = clone(x.regressions.recovery); }, 'file bindings', true);
for (const name of FILES) test(`role recursively rejects changed official ${name} bytes`, () => {
  const x = roleInputs(), path = x.proof.priorConfig.inheritedOfficial.files[name].path;
  x.bytes.set(path, Buffer.concat([x.bytes.get(path), Buffer.from(' ')]));
  assert.throws(() => run(x), { message: 'inherited official files: file hash' });
});
test('role recursively rejects changed original official Source bytes', () => {
  const x = roleInputs(), manifest = x.proof.officialEvidence.priorSourceManifest;
  x.bytes.set(`${manifest.sourceRoot}/${manifest.files[0].path}`, Buffer.from('changed original owner\n'));
  assert.throws(() => run(x), { message: 'inherited official files: prior Source' });
});
test('role recursively rejects an unobserved official WAL', () => {
  const x = roleInputs(); x.wals.delete(x.proof.priorConfig.inheritedOfficial.files.artifact.path);
  x.io.walBytes = path => x.wals.get(path);
  assert.throws(() => run(x), { message: 'inherited official files: output WAL' });
});
