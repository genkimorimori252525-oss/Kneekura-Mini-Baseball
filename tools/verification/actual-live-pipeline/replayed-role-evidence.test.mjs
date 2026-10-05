import assert from 'node:assert/strict';
import test from 'node:test';
import { assertInheritedRoleEvidence, assertReplayedRoleEvidence } from './inherited-role-evidence.mjs';
import { assertOfficialReadReplayEvidence } from './official-read-replay-evidence.mjs';
import { readReplayedRoleEvidence } from './inherited-role-files.mjs';
import { replayedRoleInputs } from './replayed-role-fixture.test-support.mjs';
import { clone, hash } from './inherited-files-fixture.test-support.mjs';

const load = x => readReplayedRoleEvidence(x.proof.config, x.proof.producerReference, x.proof.currentSourceManifest, x.io);
const semanticReject = (name, mutate, reason) => test(`replayed role semantics reject ${name}`, () => {
  const p = replayedRoleInputs().proof, before = clone(p); mutate(p);
  assert.notDeepStrictEqual(p, before, 'rejection mutation must change the fixture');
  assert.throws(() => assertReplayedRoleEvidence(p), reason);
});
const noBytes = x => assert(!x.reads.some(row => ['readBytes', 'fileHash', 'walBytes'].includes(row.operation)),
  'resolve all 24 authorized pins before reading bytes');
const fileReject = (name, mutate, inspect = () => {}) => test(`replayed role files reject ${name}`, () => {
  const x = replayedRoleInputs(); mutate(x); assert.throws(() => load(x)); inspect(x);
});

test('invented role and replay fixtures have coherent byte pins and a valid independent replay', () => {
  const x = replayedRoleInputs(), p = x.proof;
  assert.doesNotThrow(() => assertOfficialReadReplayEvidence(p.readReplayEvidence));
  assert.doesNotThrow(() => assertReplayedRoleEvidence(p));
  const refs = [...Object.values(p.config.inheritedOfficial.files), ...Object.values(x.replayFiles),
    ...Object.values(x.files), ...Object.values(x.regressions)];
  assert.equal(refs.length, 24); assert.equal(new Set(refs.map(ref => ref.path)).size, 24);
  for (const ref of refs) assert.equal(hash(x.bytes.get(ref.path)), ref.sha256);
});
test('ordinary role admission retains strict original production equality', () => {
  assert.throws(() => assertInheritedRoleEvidence(replayedRoleInputs().proof), /production Source continuity/);
});
test('loads and semantically admits exactly 24 detached immutable ancestor pins', () => {
  const x = replayedRoleInputs(), result = load(x);
  assert.doesNotThrow(() => assertReplayedRoleEvidence(result));
  assert(result.readReplayEvidence, 'loader must return the replay admission bundle');
  const measured = clone(result.readReplayEvidence);
  delete measured.referencedFiles; delete measured.officialEvidence.referencedFiles;
  assert.deepEqual(measured, x.proof.readReplayEvidence);
  assert.equal(result.referencedFiles.length, 24); assert.equal(new Set(result.referencedFiles.map(ref => ref.path)).size, 24);
  assert(Object.isFrozen(result.referencedFiles)); assert(result.referencedFiles.every(Object.isFrozen));
  const saved = clone(result.referencedFiles); x.replayFiles.receipt.sha256 = '0'.repeat(64);
  assert.deepEqual(result.referencedFiles, saved);
});

const carryLocations = { receipt: p => p.roleReceipt, stage: p => p.stageTerminal, handoff: p => p.roleHandoff,
  supervisor: p => p.supervisorTerminal.sourceInputAndReceiptAudit };
for (const [name, get] of Object.entries(carryLocations)) {
  semanticReject(`missing ${name} replay carry`, p => { delete get(p).inheritedReadReplay; });
  semanticReject(`foreign ${name} replay carry`, p => { get(p).inheritedReadReplay.binding.files.receipt.sha256 = '0'.repeat(64); });
}
for (const field of ['officialReadReplay', 'sourceTransition', 'expectedObservationSha256'])
  semanticReject(`changed current ${field}`, p => { p.config[field] = field === 'expectedObservationSha256' ? '0'.repeat(64) : {}; });
semanticReject('missing replay evidence', p => { delete p.readReplayEvidence; });
semanticReject('failed replay receipt', p => { p.readReplayEvidence.receipt.status = 'failed'; });
semanticReject('foreign original replay binding', p => { p.readReplayEvidence.officialEvidence.config.inheritedOfficial.files.receipt.path = '/foreign/receipt.json'; });
semanticReject('foreign role configuration in replay evidence', p => { p.readReplayEvidence.config.sourceCommit = '0'.repeat(40); });
semanticReject('foreign role Source manifest in replay evidence', p => { p.readReplayEvidence.currentSourceManifest.sourceTree = '0'.repeat(40); });
semanticReject('production drift after the role stage', p => { p.currentSourceManifest.files.find(row => row.path === 'src/owner.ts').sha256 = '0'.repeat(64); });
semanticReject('extra production path after the role stage', p => { p.currentSourceManifest.files.push({ path: 'src/extra-owner.ts', sha256: '0'.repeat(64) }); });
semanticReject('foreign closure proposal', p => { p.roleReceipt.settlement.closureProposalHash = '0'.repeat(64); });
semanticReject('foreign original Person', p => { p.roleReceipt.settlement.participants[0].personId = 'foreign-person'; });
semanticReject('foreign original Club', p => { p.roleReceipt.settlement.participants[0].clubId = 'foreign-club'; });
semanticReject('foreign original binding hash', p => { p.roleReceipt.acceptedInputManifest.assessments[0].participantReference.bindingHash = '0'.repeat(64); });
semanticReject('foreign original Person hash', p => { p.roleReceipt.acceptedInputManifest.assessments[0].participantReference.personHash = '0'.repeat(64); });
semanticReject('missing real workload INSERT witness', p => { p.roleReceipt.faultEvidence.workloadAfterInsert = false; });
semanticReject('an inherited official helper counted as newly executed', p => { p.roleReceipt.counts.officialCompleted = 1; });
semanticReject('failed actual role supervisor exit', p => { p.outerTerminal.supervisorExitCode = 1; });

for (const name of ['receipt', 'stageTerminal', 'supervisorTerminal', 'outerTerminal', 'configuration', 'sourceManifest'])
  fileReject(`changed replay ${name} bytes`, x => { const path = x.replayFiles[name].path; x.bytes.set(path, Buffer.concat([x.bytes.get(path), Buffer.from(' ')])); });
fileReject('missing explicit replay file', x => { delete x.replayFiles.receipt; }, noBytes);
fileReject('replay pin with an invalid digest', x => { x.replayFiles.receipt.sha256 = 'A'.repeat(64); }, noBytes);
fileReject('replay path colliding with a role artifact', x => { x.replayFiles.receipt = clone(x.files.artifact); }, noBytes);
fileReject('resolved replay alias before any artifact read', x => { x.realPaths.set(x.replayFiles.configuration.path, '/foreign/config.json'); }, noBytes);
fileReject('resolved regression alias before any replay read', x => { x.realPaths.set(x.regressions.recovery.path, '/foreign/recovery.sqlite'); }, noBytes);
fileReject('repinned raw replay receipt projection', x => {
  const value = { ...x.proof.readReplayEvidence.receipt, publicationProjection: true };
  x.pinJson(x.replayFiles.receipt, value);
  x.proof.priorConfig.officialReadReplay.files.receipt = clone(x.replayFiles.receipt); x.reseal();
});
fileReject('foreign replay binding in the pinned role configuration', x => {
  x.proof.priorConfig.officialReadReplay.files.receipt.path = '/foreign/replay.json'; x.reseal();
});
fileReject('changed current Source bytes', x => {
  const manifest = x.proof.currentSourceManifest;
  x.bytes.set(`${manifest.sourceRoot}/${manifest.files[0].path}`, Buffer.from('changed current owner\n'));
});
test('audits all four Source cuts and hashes every artifact without reading its bytes as JSON', () => {
  const x = replayedRoleInputs(), p = x.proof;
  load(x);
  for (const manifest of [p.officialEvidence.priorSourceManifest, p.readReplayEvidence.replaySourceManifest,
    p.priorSourceManifest, p.currentSourceManifest])
    assert(x.reads.some(row => row.operation === 'sourceHead' && row.path === manifest.sourceRoot));
  for (const ref of [p.config.inheritedOfficial.files.artifact, x.files.artifact, ...Object.values(x.regressions)]) {
    assert(x.reads.some(row => row.operation === 'fileHash' && row.path === ref.path));
    assert(!x.reads.some(row => row.operation === 'readBytes' && row.path === ref.path));
  }
});
