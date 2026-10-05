import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fixture as officialFixture } from './inherited-official-fixture.test-support.mjs';
import { fixture as roleFixture } from './inherited-role-fixture.test-support.mjs';

// Invented in-memory bytes only. Artifact payloads are labeled text, never SQLite
// databases or evidence of a real Source cut, supervisor run or domain result.
// Unlike the semantic-only fixtures, every inherited file pin hashes actual
// bytes. The physical producer remains a separately admitted invented reference.
export const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export const FILES = ['handoff', 'outerTerminal', 'stageTerminal', 'supervisorTerminal', 'receipt', 'configuration', 'sourceManifest', 'artifact'];
export const JSON_FILES = FILES.filter(name => name !== 'artifact');
export const clone = value => structuredClone(value);
const fields = { handoff: 'officialHandoff', outerTerminal: 'outerTerminal', stageTerminal: 'stageTerminal',
  supervisorTerminal: 'supervisorTerminal', receipt: 'officialReceipt', configuration: 'priorConfig', sourceManifest: 'priorSourceManifest' };

export const storage = () => {
  const bytes = new Map(), wals = new Map(), sources = new Map(), realPaths = new Map(), reads = [];
  const required = (map, path, operation) => {
    reads.push({ operation, path }); assert(map.has(path), `unexpected ${operation}: ${path}`); return map.get(path);
  };
  const io = {
    readBytes: path => required(bytes, path, 'readBytes'),
    fileHash: path => hash(required(bytes, path, 'fileHash')),
    walBytes: path => required(wals, path, 'walBytes'),
    realPath(path) { reads.push({ operation: 'realPath', path }); return realPaths.get(path) ?? path; },
    sourceHead: root => required(sources, root, 'sourceHead').head,
    sourceTree: root => required(sources, root, 'sourceTree').tree,
    sourceChangedPaths: root => required(sources, root, 'sourceChangedPaths').changed,
    sourceFilePaths: root => required(sources, root, 'sourceFilePaths').paths,
  };
  const pinBytes = (ref, content) => { bytes.set(ref.path, content); ref.sha256 = hash(content); return ref; };
  const pinJson = (ref, value) => pinBytes(ref, Buffer.from(`${JSON.stringify(value)}\n`));
  const source = manifest => {
    sources.set(manifest.sourceRoot, { head: manifest.sourceCommit, tree: manifest.sourceTree,
      changed: [], paths: manifest.files.map(entry => entry.path).sort() });
    for (const entry of manifest.files) {
      const content = Buffer.from(`invented source fixture: ${entry.path}\n`);
      bytes.set(`${manifest.sourceRoot}/${entry.path}`, content); entry.sha256 = hash(content);
    }
  };
  return { bytes, wals, sources, realPaths, reads, io, pinBytes, pinJson, source };
};

export const sealOfficial = (proof, x) => {
  const inherited = proof.config.inheritedOfficial, files = inherited.files;
  x.pinJson(files.sourceManifest, proof.priorSourceManifest);
  inherited.sourceManifestSha256 = files.sourceManifest.sha256;
  proof.priorConfig.sourceManifestSha256 = files.sourceManifest.sha256;
  x.pinJson(files.configuration, proof.priorConfig);
  for (const doc of [proof.officialReceipt, proof.stageTerminal, proof.officialHandoff])
    doc.sourceIdentity.sourceManifestSha256 = files.sourceManifest.sha256;
  for (const disk of [proof.officialReceipt.output, proof.stageTerminal.resumableOfficial.output, proof.officialHandoff.output])
    Object.assign(disk, clone(files.artifact));
  x.pinJson(files.receipt, proof.officialReceipt);
  const sealed = { stage: '01-official', ...clone(files.receipt) };
  proof.stageTerminal.phaseReceipts = [clone(sealed)];
  proof.stageTerminal.resumableOfficial.receipt = clone(sealed);
  x.pinJson(files.stageTerminal, proof.stageTerminal);
  proof.supervisorTerminal.sourceInputAndReceiptAudit.preservedPhaseReceipts = [clone(sealed)];
  x.pinJson(files.supervisorTerminal, proof.supervisorTerminal);
  Object.assign(proof.officialHandoff, { config: clone(files.configuration), officialReceipt: clone(sealed),
    stageTerminal: clone(files.stageTerminal), supervisorTerminal: clone(files.supervisorTerminal) });
  x.pinJson(files.handoff, proof.officialHandoff);
  Object.assign(proof.outerTerminal, { sourceManifestSha256: files.sourceManifest.sha256, configSha256: files.configuration.sha256,
    references: { 'process-terminal.json': clone(files.supervisorTerminal), 'terminal.json': clone(files.stageTerminal),
      'official-handoff.json': clone(files.handoff) } });
  x.pinJson(files.outerTerminal, proof.outerTerminal);
  proof.observed.hashes = Object.fromEntries(FILES.map(name => [name, files[name].sha256]));
};

export const officialInputs = () => {
  const x = storage(), proof = officialFixture(), files = proof.config.inheritedOfficial.files;
  x.source(proof.priorSourceManifest); x.source(proof.currentSourceManifest);
  x.pinBytes(files.artifact, Buffer.from('invented official artifact bytes; not a database\n'));
  x.wals.set(files.artifact.path, 0);
  const reseal = () => sealOfficial(proof, x); reseal();
  return { ...x, proof, files, regressions: {}, fields, reseal, priorManifests: [proof.priorSourceManifest] };
};

export const roleInputs = () => {
  const x = storage(), proof = roleFixture(), files = proof.config.inheritedRole.files;
  const regressions = proof.config.inheritedRole.regressionArtifacts, official = proof.officialEvidence;
  x.source(official.priorSourceManifest); x.source(proof.priorSourceManifest); x.source(proof.currentSourceManifest);
  official.currentSourceManifest = clone(proof.priorSourceManifest);
  for (const [name, ref] of [['official', official.config.inheritedOfficial.files.artifact], ['role', files.artifact], ...Object.entries(regressions)]) {
    x.pinBytes(ref, Buffer.from(`invented ${name} artifact bytes; not a database\n`)); x.wals.set(ref.path, 0);
  }
  const reseal = () => {
    sealOfficial(official, x);
    x.pinJson(files.sourceManifest, proof.priorSourceManifest);
    proof.config.inheritedRole.sourceManifestSha256 = files.sourceManifest.sha256;
    Object.assign(proof.priorConfig, { inheritedOfficial: clone(official.config.inheritedOfficial), sourceManifestSha256: files.sourceManifest.sha256 });
    official.config = clone(proof.priorConfig);
    official.currentSourceManifest = clone(proof.priorSourceManifest);
    proof.config.inheritedOfficial = clone(proof.priorConfig.inheritedOfficial);
    proof.roleHandoff.inheritedOfficial = clone(proof.priorConfig.inheritedOfficial);
    x.pinJson(files.configuration, proof.priorConfig);
    proof.roleReceipt.input = clone(official.officialReceipt.output);
    for (const doc of [proof.roleReceipt, proof.stageTerminal, proof.roleHandoff])
      doc.sourceIdentity.sourceManifestSha256 = files.sourceManifest.sha256;
    for (const disk of [proof.roleReceipt.output, proof.stageTerminal.resumableRole.output, proof.roleHandoff.output])
      Object.assign(disk, clone(files.artifact));
    Object.assign(proof.roleReceipt.recoveryRegression, clone(regressions.recovery), { sourceSha256: files.artifact.sha256 });
    Object.assign(proof.roleReceipt.recoveryRegression.disk, clone(regressions.recovery));
    Object.assign(proof.roleReceipt.staleCasRegression.disk, clone(regressions.stale));
    x.pinJson(files.receipt, proof.roleReceipt);
    const sealed = { stage: '02-role-workload', ...clone(files.receipt) };
    const inherited = [{ stage: '01-official', ...clone(proof.priorConfig.inheritedOfficial.files.receipt) }];
    proof.stageTerminal.phaseReceipts = [clone(sealed)];
    proof.stageTerminal.resumableRole.receipt = clone(sealed);
    proof.stageTerminal.inheritedStageReceipts = clone(inherited);
    x.pinJson(files.stageTerminal, proof.stageTerminal);
    Object.assign(proof.supervisorTerminal.sourceInputAndReceiptAudit, { preservedPhaseReceipts: [clone(sealed)], inheritedStageReceipts: clone(inherited) });
    x.pinJson(files.supervisorTerminal, proof.supervisorTerminal);
    Object.assign(proof.roleHandoff, { config: clone(files.configuration), roleReceipt: clone(sealed), inheritedStageReceipts: clone(inherited),
      stageTerminal: clone(files.stageTerminal), supervisorTerminal: clone(files.supervisorTerminal) });
    x.pinJson(files.handoff, proof.roleHandoff);
    Object.assign(proof.outerTerminal, { sourceManifestSha256: files.sourceManifest.sha256, configSha256: files.configuration.sha256,
      references: { 'process-terminal.json': clone(files.supervisorTerminal), 'terminal.json': clone(files.stageTerminal),
        'role-handoff.json': clone(files.handoff) } });
    x.pinJson(files.outerTerminal, proof.outerTerminal);
    proof.observed.hashes = Object.fromEntries(FILES.map(name => [name, files[name].sha256]));
    proof.observed.regressionHashes = Object.fromEntries(Object.entries(regressions).map(([name, ref]) => [name, ref.sha256]));
  };
  reseal();
  return { ...x, proof, files, regressions, fields: { ...fields, handoff: 'roleHandoff', receipt: 'roleReceipt' }, reseal,
    priorManifests: [proof.priorSourceManifest, official.priorSourceManifest] };
};
