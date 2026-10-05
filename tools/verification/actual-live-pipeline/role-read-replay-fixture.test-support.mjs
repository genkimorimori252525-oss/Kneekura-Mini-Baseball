import { createHash } from 'node:crypto';
import { replayedRoleInputs } from './replayed-role-fixture.test-support.mjs';

// Invented semantic JSON only: observations and pins represent no actual
// Source bytes, database, role replay, or process lifecycle.
export const clone = value => structuredClone(value);
export const digest = value => createHash('sha256').update(JSON.stringify(value, (_key, item) =>
  item !== null && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item)).digest('hex');
export const CHANGES = [
  { path: 'src/host/world/ActualLivePlayReadinessFromSqlite.ts', beforeSha256: 'a54f18c08f321376043a2b2fb45c6d8f0d67beecf0824ed2410f80fe5bc67bfc', afterSha256: '085ab8c521b7afe74c9377e519f94f2ec3f2746218c2cbbcab4653b66af54d1b' },
  { path: 'src/host/world/ActualRoleWorkloadEvidenceFromSqlite.ts', beforeSha256: '0a269f20a0c289519fbe15b6f3eb41a3f10c7097d73fab41608308819a6653ec', afterSha256: 'd806fedb011bfaef67c0bbfaf284fadd41131147994b2a79e02c2d7c6fd3c6bf' },
  { path: 'src/host/world/SqlitePhysicalPitchProgressStore.ts', beforeSha256: '1fea6baab1a6b7fcc6ea8e82470c478acb5895fb78f2005b8c2579b0ab65dd90', afterSha256: '8654e8a81f3f13ff6af5660d1e80e5528b00b253e4a69b157593a0d67e422bff' },
  { path: 'src/host/world/SqlitePhysicalPlateAppearanceActorStore.ts', beforeSha256: 'e9db177f1d2042d2aa8bf900ca37651bc93c39093d34e9be9bb074a3d0cfaa55', afterSha256: 'f3d7364d5dbe915236e9b3244cf57a6121afbf79b430523ab0560d6a196a42b5' },
];
export const EXECUTED = { readOnlyConnections: 2, readTransactions: 2, settlementReads: 2, currentHeadReads: 20,
  officialHelperCalls: 0, roleHelperCalls: 0, nextHelperCalls: 0, newOfficialApplications: 0, newWorkloadActivities: 0, newPhysicalPitchActions: 0 };
export const CHECKS = { sourceUnchanged: true, configUnchanged: true, controlsUnchanged: true, originalEvidenceUnchanged: true,
  artifactUnchanged: true, closeReopenEqual: true, readOnlyEnforced: true };
export const FILES = ['receipt', 'stageTerminal', 'supervisorTerminal', 'outerTerminal', 'configuration', 'sourceManifest'];
export const fixture = () => {
  const role = replayedRoleInputs().proof;
  const manifests = [role.priorSourceManifest, role.officialEvidence.currentSourceManifest, role.officialEvidence.priorSourceManifest,
    role.readReplayEvidence.currentSourceManifest, role.readReplayEvidence.replaySourceManifest,
    role.readReplayEvidence.officialEvidence.priorSourceManifest, role.readReplayEvidence.officialEvidence.currentSourceManifest];
  for (const manifest of manifests) for (const change of CHANGES) manifest.files.push({ path: change.path, sha256: change.beforeSha256 });
  const files = Object.fromEntries(FILES.map((name, index) => [name, { path: `/role-reader/${name}.json`, sha256: String(index + 3).repeat(64) }]));
  const replaySourceManifest = { ...clone(role.priorSourceManifest), sourceRoot: '/fixed/role-reader', sourceCommit: '7'.repeat(40), sourceTree: '8'.repeat(40) };
  for (const change of CHANGES) replaySourceManifest.files.find(row => row.path === change.path).sha256 = change.afterSha256;
  const sourceIdentity = { sourceRoot: replaySourceManifest.sourceRoot, sourceCommit: replaySourceManifest.sourceCommit,
    sourceTree: replaySourceManifest.sourceTree, sourceManifestSha256: files.sourceManifest.sha256 };
  const transition = { kind: 'role_read_replay_transition_v1', purpose: 'settled_role_reader_compatibility_v1',
    fromSourceIdentity: clone(role.roleReceipt.sourceIdentity), toSourceIdentity: clone(sourceIdentity), changedProductionFiles: clone(CHANGES) };
  const expectedSettlementSha256 = digest(role.roleReceipt.settlement);
  const replayConfig = { ...clone(role.config), schema: 'actual_role_read_replay_run_v1', executionScope: 'role_read_replay',
    sourceRoot: sourceIdentity.sourceRoot, sourceCommit: sourceIdentity.sourceCommit,
    sourceManifestPath: files.sourceManifest.path, sourceManifestSha256: files.sourceManifest.sha256,
    roleSourceTransition: transition, expectedSettlementSha256,
    controlHashes: { launcher: '9'.repeat(64), runtimeProbe: 'a'.repeat(64), replayRunner: 'b'.repeat(64) },
    runtime: { nodeSha256: 'c'.repeat(64), expectedHeapLimitMiB: 1120, maximumWallSeconds: 1800, maximumRssMiB: 1536 } };
  const currentSourceManifest = { ...clone(replaySourceManifest), sourceRoot: '/fixed/next-consumer', sourceCommit: '9'.repeat(40), sourceTree: 'a'.repeat(40) };
  const config = { ...clone(replayConfig), schema: 'actual_artifact_pipeline_run_v2', executionScope: 'next',
    sourceRoot: currentSourceManifest.sourceRoot, sourceCommit: currentSourceManifest.sourceCommit,
    sourceManifestPath: '/next-consumer/source.json', sourceManifestSha256: 'b'.repeat(64),
    roleReadReplay: { kind: 'checked_role_read_replay_v1', files } };
  role.config = clone(config); role.currentSourceManifest = clone(currentSourceManifest);
  const inherited = [{ stage: '01-official', ...config.inheritedOfficial.files.receipt }, { stage: '02-role-workload', ...config.inheritedRole.files.receipt }];
  const observation = { settlement: clone(role.roleReceipt.settlement), currentHeads: role.roleReceipt.settlement.participants.map(p => clone(p.after)), artifact: clone(role.roleReceipt.output) };
  const passes = [0, 1].map(index => ({ index, connectionId: index + 1, readOnly: true, queryOnly: true, transactionOwned: true,
    transactionClosed: true, connectionClosed: true, totalChanges: 0, walBytesBefore: 0, walBytesAfter: 0,
    artifactSha256Before: observation.artifact.sha256, artifactSha256After: observation.artifact.sha256, seconds: index + 1,
    observation: clone(observation), observationSha256: digest(observation) }));
  const receipt = { schema: 'actual_role_read_replay_receipt_v1', status: 'passed', sourceIdentity,
    inheritedSourceIdentity: clone(role.roleReceipt.sourceIdentity), roleSourceTransition: clone(transition),
    originalRoleBinding: clone(config.inheritedRole), originalOfficialBinding: clone(config.inheritedOfficial),
    originalOfficialReadReplay: clone(role.roleReceipt.inheritedReadReplay), originalRoleReceipt: clone(config.inheritedRole.files.receipt),
    physicalProducerReference: clone(role.producerReference), originalPhysicalArtifactSha256: config.physicalArtifactSha256,
    inheritedFaultReceipts: clone(inherited), expectedSettlementSha256, checks: clone(CHECKS), executed: clone(EXECUTED),
    passes, openSqliteHandles: [], newlyExecutedDomainFaults: [] };
  const sealed = { stage: 'role-read-replay', ...files.receipt };
  const stageTerminal = { status: 'read_replay_passed', executionScope: 'role_read_replay', wholePipelinePassed: false,
    sourceIdentity: clone(sourceIdentity), counts: { officialStarted: 0, officialCompleted: 0, roleStarted: 0, roleCompleted: 0, nextStarted: 0, nextCompleted: 0 },
    executed: clone(EXECUTED), checks: clone(CHECKS), phaseReceipts: [sealed], inheritedStageReceipts: clone(inherited), openSqliteHandles: [] };
  const supervisorTerminal = { status: 'read_replay_passed', executionScope: 'role_read_replay', wholePipelinePassed: false,
    exitCode: 0, guard: null, executingProcessReceiptValid: true, pipelineTerminalStatus: 'read_replay_passed', remainingOwnedProcesses: [],
    controlHashes: clone(replayConfig.controlHashes), sourceInputAndReceiptAudit: { passed: true, preservedPhaseReceipts: [clone(sealed)],
      inheritedStageReceipts: clone(inherited), originalRoleBinding: clone(config.inheritedRole), roleSourceTransition: clone(transition) },
    runtime: { nodeSha256: replayConfig.runtime.nodeSha256, heapLimitMiB: 1120, elapsedSeconds: 3, peakRssKiB: 1024 } };
  const outerTerminal = { kind: 'role_read_replay', passed: true, wholePipelinePassed: false, supervisorExitCode: 0, outerGuard: null,
    error: null, supervisorReaped: true, remainingSupervisorGroup: [], remainingExecutionGroup: [], sourceCommit: sourceIdentity.sourceCommit,
    sourceManifestSha256: sourceIdentity.sourceManifestSha256, configSha256: files.configuration.sha256,
    references: { receipt: clone(files.receipt), stageTerminal: clone(files.stageTerminal), supervisorTerminal: clone(files.supervisorTerminal) } };
  return { config, roleEvidence: role, currentSourceManifest, replaySourceManifest, replayConfig, receipt, stageTerminal, supervisorTerminal, outerTerminal,
    observed: { hashes: Object.fromEntries(FILES.map(name => [name, files[name].sha256])), replaySourceFilesUnchanged: true, currentSourceFilesUnchanged: true,
      controlHashes: clone(replayConfig.controlHashes), artifactSha256: observation.artifact.sha256, artifactWalBytes: 0 } };
};
export const inputFixture = () => {
  const x = fixture(); x.config = clone(x.replayConfig); x.currentSourceManifest = clone(x.replaySourceManifest);
  x.roleEvidence.config = clone(x.config); x.roleEvidence.currentSourceManifest = clone(x.currentSourceManifest);
  return { config: x.config, roleEvidence: x.roleEvidence, currentSourceManifest: x.currentSourceManifest,
    observed: { currentSourceFilesUnchanged: true, controlHashes: clone(x.config.controlHashes) } };
};
