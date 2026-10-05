import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

// Receipt-shaped JSON only. These invented pre-end/output hashes never stand
// for a constructed database or a successful physical-owner execution.
export const hash = value => createHash('sha256').update(value).digest('hex');
export const CONSTRUCTION = Object.freeze({
  originalConstructionDatabaseSha256: '60525735348ea48aeb1944e7c1b2dc2d3afd6fdac8961d83486d2f4a4c6df0f4',
  originalConstructionTerminalSha256: '215e7ad43ac770f0423405a658721467032f0a5151449fa2cb4d9af422850209',
  originalConstructionSourceCommit: '23e4ef0cd34fbd028b6d3b689188a741cde2bea1',
  originalConstructionSourceManifestSha256: '567ce51ccd34c5522e78b6eef99b7d85b4651d640a3e9277d89865b628cb0896',
});
export const PROFILE = '158d140826d274fbfef202e495df0869ce250223c9959b26ab79e75c5d10b98c';
export const LEGACY_INPUT = 'a54678e3aae1c6df0d25683b65c2811cedfed98539ca604aa233563f9eee7caa';
export const LEGACY_NEGATIVE = Object.freeze({
  'negative-phase-evidence.json': 'cf476b97f61fee1cf90035e5e59d0089172ef328f14477263afb774443327194',
  'interruption-terminal.json': '7979b0c1e888b327a4b0f8cff641d72c4712b1f46f6ebc2f42c602c570387e76',
  'negative-phase-completed.jsonl': '5bfbe251734f3af7f7cd9c40272f0a7335b849c3bf82be5fb13030791d8fbf71',
});
export const CONTROL_NAMES = Object.freeze(['audit-artifact.mjs', 'run-known-profile-acceptance.py',
  'worker-memory-telemetry.cjs', 'worker-resource-probe-exact-node26.cjs']);
export const TEST_NAMES = Object.freeze([
  'checks the fresh known-profile pre-end manifest and original npb-2026 lineage without replaying domain owners',
  'witnesses a fresh seal INSERT rollback, accepts the same known-profile original chain, and closes/reopens/retries before exporting',
]);
export const WITNESS_NAME = 'seal-insert-rollback.json';
export const SOURCE_TEXT = ['one.ts', 'two.ts', 'three.ts'].map(name => `${hash(name)}  ${name}\n`).join('');
export const reseal = proof => {
  proof.config.physicalEvidenceSha256 = hash(JSON.stringify(proof.terminal));
  proof.observed.physicalEvidenceSha256 = proof.config.physicalEvidenceSha256;
  return proof;
};
export const fixture = (root = '/pure-known-profile') => {
  const original = `${root}/input/pre-end.sqlite`, output = `${root}/evidence/ended-chain.sqlite`;
  const inputHash = hash('invented fresh pre-end identity; no SQLite bytes'), empty = hash('[]');
  const tables = [
    { name: 'actual_first_base_play_ends', count: 0, logicalRowsHash: empty },
    { name: 'actual_live_play_fences', count: 0, logicalRowsHash: empty },
    { name: 'batted_world_field_executions', count: 3, logicalRowsHash: hash('original physical rows') },
    { name: 'matches', count: 1, logicalRowsHash: hash('original npb-2026 Match') },
  ];
  const request = { sourceId: 'physical-end', sourceVersion: 'fixture-v1', runtimeSourceId: 'play-runtime',
    baseFieldSourceId: 'base-field', executionSourceId: 'actual-post-call-quantizer-tail',
    ruleConsumptionSourceId: 'rule-consumption', umpireCallSourceId: 'operative-call', communicationSourceId: 'call-information' };
  const inputManifest = { schema: 'synthetic_first_base_known_profile_pre_end_fixture_v1',
    sourceCommit: '56d96a7728d21dc3b250e4e0bb5d8722fbc023c7',
    sourceManifestSha256: '020e8e1dd20e7e85fd524fdb0d3ce7eb37d04231e5718c9c128478f15d55fcc4',
    ruleProfileId: 'npb-2026', ruleProfileSha256: PROFILE, ...CONSTRUCTION, databaseSha256: inputHash,
    physicalEndRows: 0, sealRows: 0, uncheckpointedWalBytes: 0, request, futureDecisionSourceId: 'scheduled-decision-home-2', tables };
  const launcherHashes = Object.fromEntries(CONTROL_NAMES.map(name => [`${root}/controls/${name}`, hash(`pure ${name}`)]));
  const admission = { sourceCommit: 'e'.repeat(40), sourceManifestSha256: hash(SOURCE_TEXT), sourceFiles: 3,
    fixtureRuleProfileId: 'npb-2026', ruleProfileSha256: PROFILE, ...CONSTRUCTION,
    preEndSourceCommit: inputManifest.sourceCommit, preEndSourceManifestSha256: inputManifest.sourceManifestSha256,
    inputPath: original, inputSha256: inputHash, inputManifestPath: `${root}/evidence/input-manifest.json`,
    inputManifestSha256: hash(JSON.stringify(inputManifest)), inputWalBytesBefore: 0,
    runtimePath: `${root}/runtime/node`, runtimeSha256: hash('pure Node executable'), launcherHashes,
    negativeEvidencePath: `${root}/evidence/${WITNESS_NAME}`, runnerPid: 201 };
  const originalTables = tables.filter(row => !['actual_first_base_play_ends', 'actual_live_play_fences'].includes(row.name));
  const negativeEvidence = { schema: 'known_profile_seal_insert_rollback_v1', sourceCommit: admission.sourceCommit,
    sourceManifestSha256: admission.sourceManifestSha256, fixtureRuleProfileId: 'npb-2026', inputSha256: inputHash,
    inputManifestSha256: admission.inputManifestSha256, request: structuredClone(request), actualWorkerPid: 211,
    witnessedSql: 'INSERT INTO actual_live_play_fences VALUES(?,?,?,?)',
    observedInsert: { endRows: 1, sealRows: 1, dependencySnapshotHash: 'changed-during-seal' },
    endRowsAfterRollback: 0, sealRowsAfterRollback: 0, beforeOriginalTables: structuredClone(originalTables),
    afterOriginalTables: structuredClone(originalTables), beforeOriginalTablesSha256: hash(JSON.stringify(originalTables)),
    afterOriginalTablesSha256: hash(JSON.stringify(originalTables)) };
  const negativeEvidenceHashes = { [WITNESS_NAME]: hash(JSON.stringify(negativeEvidence)) };
  const counts = { numTotalTests: 2, numPassedTests: 2, numFailedTests: 0, numPendingTests: 0, numSkippedTests: 0, numTodoTests: 0 };
  const terminal = { ...structuredClone(admission), gatePassed: true, childExitCode: 0, stopReason: null,
    sourceUnchanged: true, runtimeUnchanged: true, launcherUnchanged: true, inputUnchanged: true, negativeEvidenceUnchanged: true,
    inputManifestUnchanged: true, preEndTerminalUnchanged: true, configUnchanged: true, outputUnchangedAfterAudit: true,
    negativeEvidenceHashes: { ...negativeEvidenceHashes }, inputWalBytesAfter: 0, counts,
    observedForks: [{ pid: 211, worker: true, workerId: '1', nodeVersion: '26.10.0', heapLimitMiB: 1120, requestedOldSpaceMiB: 1024 }],
    stragglersAfterReap: [], artifactAuditExitCode: 0, outputPath: output, outputSha256: hash('invented ended identity; no SQLite bytes'), outputWalBytes: 0 };
  const artifactAudit = { artifact: output, mainFilename: output, journalMode: 'wal', fileSha256: terminal.outputSha256,
    tables: tables.map(row => row.name === 'actual_first_base_play_ends'
      ? { ...row, count: 1, logicalRowsHash: hash('pure end rows'), originals: [{ sourceId: request.sourceId,
        sourceHash: hash('end Source'), snapshotHash: hash('end snapshot'), rowHash: hash('end row') }] }
      : row.name === 'actual_live_play_fences' ? { ...row, count: 1, logicalRowsHash: hash('pure seal rows'), originals: [] }
        : { ...row, originals: [] }) };
  const controls = Object.fromEntries(CONTROL_NAMES.map(name => [name, launcherHashes[`${root}/controls/${name}`]]));
  const physicalProducer = { kind: 'first_base_known_profile_producer_v1', fixtureRuleProfileId: 'npb-2026', ruleProfileSha256: PROFILE,
    ...CONSTRUCTION, sourceCommit: admission.sourceCommit, sourceManifestSha256: admission.sourceManifestSha256, sourceFiles: 3,
    preEndSourceCommit: admission.preEndSourceCommit, preEndSourceManifestSha256: admission.preEndSourceManifestSha256,
    originalInputPath: original, originalInputSha256: inputHash, inputManifestSha256: admission.inputManifestSha256,
    runtimeSha256: admission.runtimeSha256, launcherHashes: controls, negativeEvidenceHashes: { ...negativeEvidenceHashes } };
  return reseal({ config: { physicalEvidencePath: `${root}/evidence/terminal.json`, physicalEvidenceSha256: '',
      physicalArtifactPath: output, physicalArtifactSha256: terminal.outputSha256, physicalEndSourceId: 'physical-end', physicalProducer },
    terminal, admission, inputManifest, artifactAudit, negativeEvidence,
    results: { success: true, ...counts, testResults: [{ name: `${root}/source/src/host/world/ActualKnownProfileArtifactAcceptance.test.ts`,
      status: 'passed', assertionResults: TEST_NAMES.map(title => ({ title, fullName: title, status: 'passed' })) }] },
    observed: { physicalEvidenceSha256: '', physicalArtifactSha256: terminal.outputSha256,
      sourceBeforeManifestSha256: admission.sourceManifestSha256, sourceAfterManifestSha256: admission.sourceManifestSha256, sourceFiles: 3,
      runtimeSha256: admission.runtimeSha256, originalInputSha256: inputHash, inputManifestSha256: admission.inputManifestSha256,
      launcherHashes: { ...controls }, negativeEvidenceHashes: { ...negativeEvidenceHashes }, inputWalBytes: 0, outputWalBytes: 0 } });
};

// Injected I/O: no path here exists and neither a database nor a runtime is read.
export const fileFixture = () => {
  const proof = fixture('/pure-known-profile-loader'), bytes = new Map(), measuredHashes = new Map(), reads = [], wals = new Map();
  const root = '/pure-known-profile-loader/evidence';
  const pinMeasured = (path, sha256) => { measuredHashes.set(path, sha256); return { path, sha256 }; };
  const pinBytes = (path, value) => { const data = Buffer.from(value); bytes.set(path, data); return pinMeasured(path, hash(data)); };
  const pinJson = (path, value) => pinBytes(path, JSON.stringify(value));
  const files = {
    admission: pinJson(`${root}/admission.json`, proof.admission), results: pinJson(`${root}/results.json`, proof.results),
    artifactAudit: pinJson(`${root}/artifact-audit.json`, proof.artifactAudit), inputManifest: pinJson(`${root}/input-manifest.json`, proof.inputManifest),
    sourceBeforeManifest: pinBytes(`${root}/source-before.sha256`, SOURCE_TEXT), sourceAfterManifest: pinBytes(`${root}/source-after.sha256`, SOURCE_TEXT),
    runtime: pinMeasured(proof.terminal.runtimePath, proof.config.physicalProducer.runtimeSha256),
    originalInput: pinMeasured(proof.config.physicalProducer.originalInputPath, proof.config.physicalProducer.originalInputSha256),
    controls: Object.fromEntries(CONTROL_NAMES.map(name => [name, pinMeasured(`/pure-known-profile-loader/controls/${name}`, proof.config.physicalProducer.launcherHashes[name])])),
    negativeEvidence: { [WITNESS_NAME]: pinJson(proof.terminal.negativeEvidencePath, proof.negativeEvidence) },
  };
  proof.config.physicalProducer.files = files;
  pinJson(proof.config.physicalEvidencePath, proof.terminal); pinMeasured(proof.config.physicalArtifactPath, proof.config.physicalArtifactSha256);
  wals.set(files.originalInput.path, 0); wals.set(proof.config.physicalArtifactPath, 0);
  const io = {
    readBytes(path) { reads.push({ operation: 'readBytes', path }); assert(bytes.has(path), `unexpected byte read: ${path}`); return bytes.get(path); },
    fileHash(path) { reads.push({ operation: 'fileHash', path }); assert(measuredHashes.has(path), `unexpected hash read: ${path}`); return measuredHashes.get(path); },
    walBytes(path) { reads.push({ operation: 'walBytes', path }); assert(wals.has(path), `unexpected WAL read: ${path}`); return wals.get(path); },
  };
  const repinJson = (role, value) => {
    const ref = role === 'terminal' ? { path: proof.config.physicalEvidencePath } : role === 'negativeEvidence' ? files.negativeEvidence[WITNESS_NAME] : files[role];
    const pin = pinJson(ref.path, value); Object.assign(ref, pin);
    if (role === 'terminal') proof.config.physicalEvidenceSha256 = pin.sha256;
    return pin;
  };
  return { proof, files, io, bytes, measuredHashes, reads, wals, repinJson, pinBytes };
};
