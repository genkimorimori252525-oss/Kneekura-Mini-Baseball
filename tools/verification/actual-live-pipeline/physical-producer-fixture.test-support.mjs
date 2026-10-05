import { createHash } from 'node:crypto';

// Pure JSON fixtures only. No SQLite file, producer run or physical end is made.
export const hash = value => createHash('sha256').update(value).digest('hex');
export const INPUT = 'a54678e3aae1c6df0d25683b65c2811cedfed98539ca604aa233563f9eee7caa';
export const NEGATIVE = {
  'negative-phase-evidence.json': 'cf476b97f61fee1cf90035e5e59d0089172ef328f14477263afb774443327194',
  'interruption-terminal.json': '7979b0c1e888b327a4b0f8cff641d72c4712b1f46f6ebc2f42c602c570387e76',
  'negative-phase-completed.jsonl': '5bfbe251734f3af7f7cd9c40272f0a7335b849c3bf82be5fb13030791d8fbf71',
};
export const CONTROLS = {
  'run-minimal-clean-acceptance.py': '3438017f4f57b70b81b8bf10bc3bb3c46dfbd4c307b715226ca7bd9bc3e7da36',
  'worker-resource-probe-exact-node26.cjs': '9a476055c53c58a75ef47450a9c1304099191e017017c30b94f60c01d416279c',
  'worker-memory-telemetry.cjs': '1de9c0220524bb31900d9ed7b2bf3c15024a21b71828c535f46e7ffa3fcb1c49',
  'audit-artifact.mjs': '90081bb4132622c1aae0fd7ba11b180bb004a0d1323b326e401f841c0d743d90',
};
const TESTS = [
  'checks pinned raw artifact request IDs and complete row manifest without replaying domain owners',
  'accepts the manifest-pinned original call chain through the real end owner, proves seal rollback, and closes/reopens/retries before exporting',
];
export const reseal = value => {
  value.config.physicalEvidenceSha256 = hash(JSON.stringify(value.terminal));
  value.observed.physicalEvidenceSha256 = value.config.physicalEvidenceSha256;
  return value;
};
export const fixture = (root = '/pure-fixture/producer') => {
  const output = `${root}/evidence/ended-chain.sqlite`, original = `${root}/input/original.sqlite`;
  const counts = { numTotalTests: 2, numPassedTests: 2, numFailedTests: 0, numPendingTests: 0 };
  const paths = Object.fromEntries(Object.entries(CONTROLS).map(([name, sha256]) => [`${root}/controls/${name}`, sha256]));
  const admission = {
    sourceCommit: '9e27dc8ba4c3ac29f18069a9761a05177ecbac62', sourceManifestSha256: hash('pure source manifest'), sourceFiles: 3,
    inputPath: original, inputSha256: INPUT, inputWalBytesBefore: 0,
    runtimePath: `${root}/runtime/node`, runtimeSha256: hash('pure Node binary identity'),
    launcherHashes: paths, negativeEvidencePath: `${root}/published-negative`, negativeEvidenceHashes: { ...NEGATIVE },
    runnerPid: 201,
  };
  const terminal = { ...structuredClone(admission), gatePassed: true, childExitCode: 0, stopReason: null,
    sourceUnchanged: true, runtimeUnchanged: true, launcherUnchanged: true, inputUnchanged: true, negativeEvidenceUnchanged: true,
    inputWalBytesAfter: 0, counts, observedForks: [{ pid: 211, worker: true, workerId: '1', nodeVersion: '26.10.0', heapLimitMiB: 1120, requestedOldSpaceMiB: 1024 }],
    stragglersAfterReap: [], artifactAuditExitCode: 0, outputPath: output, outputSha256: hash('pure output identity'), outputWalBytes: 0 };
  const empty = hash('[]'), originalTable = { name: 'original_physical_rows', count: 1, logicalRowsHash: hash('original logical rows') };
  const inputManifest = { schema: 'synthetic_first_base_pre_end_fixture_v1', databaseSha256: INPUT, physicalEndRows: 0, sealRows: 0, uncheckpointedWalBytes: 0,
    tables: [originalTable, { name: 'actual_first_base_play_ends', count: 0, logicalRowsHash: empty }, { name: 'actual_live_play_fences', count: 0, logicalRowsHash: empty }] };
  const artifactAudit = { artifact: output, mainFilename: output, journalMode: 'wal', fileSha256: terminal.outputSha256,
    tables: [{ ...originalTable, originals: [] },
      { name: 'actual_first_base_play_ends', count: 1, logicalRowsHash: hash('pure end row'), originals: [{ sourceId: 'physical-end', sourceHash: hash('end source'), snapshotHash: hash('end snapshot'), rowHash: hash('end row') }] },
      { name: 'actual_live_play_fences', count: 1, logicalRowsHash: hash('pure fence row'), originals: [] }] };
  const producer = { kind: 'first_base_clean_producer_v1', sourceCommit: admission.sourceCommit,
    sourceManifestSha256: admission.sourceManifestSha256, sourceFiles: admission.sourceFiles, originalInputSha256: INPUT,
    originalInputPath: original, runtimeSha256: admission.runtimeSha256, launcherHashes: { ...CONTROLS }, negativeEvidenceHashes: { ...NEGATIVE },
    inputManifestSha256: hash(JSON.stringify(inputManifest)) };
  return reseal({ config: { physicalArtifactPath: output, physicalArtifactSha256: terminal.outputSha256,
      physicalEvidencePath: `${root}/evidence/terminal.json`, physicalEvidenceSha256: '', physicalEndSourceId: 'physical-end', physicalProducer: producer },
    terminal, admission, inputManifest, artifactAudit,
    results: { success: true, ...counts, testResults: [{ name: `${root}/source/src/host/world/ActualFirstBaseArtifactAcceptance.test.ts`, status: 'passed',
      assertionResults: TESTS.map(title => ({ title, fullName: title, status: 'passed' })) }] },
    observed: { physicalArtifactSha256: terminal.outputSha256, physicalEvidenceSha256: '',
      sourceBeforeManifestSha256: admission.sourceManifestSha256, sourceAfterManifestSha256: admission.sourceManifestSha256, sourceFiles: admission.sourceFiles,
      originalInputSha256: INPUT, inputWalBytes: 0, outputWalBytes: 0, runtimeSha256: admission.runtimeSha256,
      launcherHashes: { ...CONTROLS }, negativeEvidenceHashes: { ...NEGATIVE }, inputManifestSha256: producer.inputManifestSha256 } });
};

