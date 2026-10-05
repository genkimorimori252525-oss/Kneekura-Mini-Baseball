import { createHash } from 'node:crypto';
import { posix } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { assertInheritedSourceContinuity, inheritedProductionSourceFiles } from './inherited-official-evidence.mjs';
import { assertReplayedRoleStageProvenance } from './inherited-role-evidence.mjs';

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const id = value => typeof value === 'string' && value.length > 0 && value === value.trim();
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const integer = value => Number.isSafeInteger(value) && value >= 0;
const nonnegative = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const positive = value => nonnegative(value) && value > 0;
const absolute = value => id(value) && posix.isAbsolute(value) && posix.normalize(value) === value && value !== '/'
  && !value.includes('\\') && !value.includes('\0') && value.split('/').slice(1).every(part => part && part !== '.' && part !== '..');
const check = (condition, field) => { if (!condition) throw new Error(`role read replay: ${field}`); };
const same = (actual, expected, field) => check(isDeepStrictEqual(actual, expected), field);
const keys = (value, expected, field) => { check(record(value), field); same(Object.keys(value).sort(), [...expected].sort(), field); };
const raw = (value, field) => check(record(value) && !['publicationProjection', 'originalRawReceiptSha256']
  .some(key => Object.hasOwn(value, key)), `${field} raw evidence`);
const pin = (value, field) => check(record(value) && absolute(value.path) && hash(value.sha256), field);
const boundPin = (value, expected, field) => { pin(value, field); same(value.path, expected.path, `${field} path`); same(value.sha256, expected.sha256, `${field} hash`); };
const wal = (value, field) => check(value === null || value === 0, field);
const FILES = ['receipt', 'stageTerminal', 'supervisorTerminal', 'outerTerminal', 'configuration', 'sourceManifest'];
const CONTROLS = ['launcher', 'runtimeProbe', 'replayRunner'];
const CHANGES = [
  { path: 'src/host/world/ActualLivePlayReadinessFromSqlite.ts', beforeSha256: 'a54f18c08f321376043a2b2fb45c6d8f0d67beecf0824ed2410f80fe5bc67bfc', afterSha256: '085ab8c521b7afe74c9377e519f94f2ec3f2746218c2cbbcab4653b66af54d1b' },
  { path: 'src/host/world/ActualRoleWorkloadEvidenceFromSqlite.ts', beforeSha256: '0a269f20a0c289519fbe15b6f3eb41a3f10c7097d73fab41608308819a6653ec', afterSha256: 'd806fedb011bfaef67c0bbfaf284fadd41131147994b2a79e02c2d7c6fd3c6bf' },
  { path: 'src/host/world/SqlitePhysicalPitchProgressStore.ts', beforeSha256: '1fea6baab1a6b7fcc6ea8e82470c478acb5895fb78f2005b8c2579b0ab65dd90', afterSha256: '8654e8a81f3f13ff6af5660d1e80e5528b00b253e4a69b157593a0d67e422bff' },
  { path: 'src/host/world/SqlitePhysicalPlateAppearanceActorStore.ts', beforeSha256: 'e9db177f1d2042d2aa8bf900ca37651bc93c39093d34e9be9bb074a3d0cfaa55', afterSha256: 'f3d7364d5dbe915236e9b3244cf57a6121afbf79b430523ab0560d6a196a42b5' },
];
const digest = value => createHash('sha256').update(JSON.stringify(value, (_key, item) => record(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item)).digest('hex');
const EXECUTED = { readOnlyConnections: 2, readTransactions: 2, settlementReads: 2, currentHeadReads: 20,
  officialHelperCalls: 0, roleHelperCalls: 0, nextHelperCalls: 0, newOfficialApplications: 0, newWorkloadActivities: 0, newPhysicalPitchActions: 0 };
const CHECKS = { sourceUnchanged: true, configUnchanged: true, controlsUnchanged: true, originalEvidenceUnchanged: true,
  artifactUnchanged: true, closeReopenEqual: true, readOnlyEnforced: true };
const COUNTS = { officialStarted: 0, officialCompleted: 0, roleStarted: 0, roleCompleted: 0, nextStarted: 0, nextCompleted: 0 };
const sourceIdentity = (manifest, config) => {
  inheritedProductionSourceFiles(manifest, 'Source manifest');
  check(record(config) && absolute(config.sourceManifestPath) && hash(config.sourceManifestSha256), 'Source configuration');
  for (const field of ['sourceRoot', 'sourceCommit']) same(manifest[field], config[field], `Source ${field}`);
  return { sourceRoot: manifest.sourceRoot, sourceCommit: manifest.sourceCommit, sourceTree: manifest.sourceTree,
    sourceManifestSha256: config.sourceManifestSha256 };
};

const originalRole = (bundle, config, manifest) => {
  check(record(bundle.roleEvidence) && record(bundle.observed), 'original role and observations');
  same(bundle.roleEvidence.config, config, 'original-role consumer configuration');
  same(bundle.roleEvidence.currentSourceManifest, manifest, 'original-role consumer Source');
  check(bundle.observed.currentSourceFilesUnchanged === true, 'current Source bytes');
  assertReplayedRoleStageProvenance(bundle.roleEvidence);
  check(hash(config.expectedSettlementSha256), 'sealed settlement digest');
  same(config.expectedSettlementSha256, digest(bundle.roleEvidence.roleReceipt.settlement), 'sealed settlement parity baseline');
};
const transition = (value, role, config, manifest) => {
  keys(value, ['kind', 'purpose', 'fromSourceIdentity', 'toSourceIdentity', 'changedProductionFiles'], 'Source transition fields');
  check(value.kind === 'role_read_replay_transition_v1' && value.purpose === 'settled_role_reader_compatibility_v1', 'reviewed transition kind and purpose');
  same(value.fromSourceIdentity, role.roleReceipt.sourceIdentity, 'original role Source');
  const identity = sourceIdentity(manifest, config);
  same(value.toSourceIdentity, identity, 'replay Source');
  same(value.changedProductionFiles, CHANGES, 'four reviewed production pairs');
  const prior = inheritedProductionSourceFiles(role.priorSourceManifest, 'original role Source manifest');
  const current = inheritedProductionSourceFiles(manifest, 'role reader Source manifest');
  same(current.map(([path]) => path), prior.map(([path]) => path), 'complete production path set');
  const changed = prior.flatMap(([path, beforeSha256], index) => {
    const afterSha256 = current[index][1]; return beforeSha256 === afterSha256 ? [] : [{ path, beforeSha256, afterSha256 }];
  });
  same(changed, CHANGES, 'independently compared production transition');
  return identity;
};
const replayConfiguration = (config, controls) => {
  raw(config, 'replay configuration');
  check(config.schema === 'actual_role_read_replay_run_v1' && config.executionScope === 'role_read_replay', 'replay scope');
  check(!Object.hasOwn(config, 'roleReadReplay'), 'replay cannot inherit itself');
  check(config.executeNextPitch === true && config.faultChecks === true, 'retained original obligations');
  keys(config.controlHashes, CONTROLS, 'replay control roles');
  check(Object.values(config.controlHashes).every(hash), 'replay control hashes');
  same(controls, config.controlHashes, 'observed replay controls');
  const runtime = config.runtime;
  check(record(runtime) && hash(runtime.nodeSha256) && integer(runtime.expectedHeapLimitMiB) && runtime.expectedHeapLimitMiB > 0
    && positive(runtime.maximumWallSeconds) && positive(runtime.maximumRssMiB), 'finite replay runtime');
};

/** Original 24-pin provenance plus the exact four reviewed production pairs.
 * This grants only a read replay; ordinary next admission keeps strict equality. */
export const assertRoleReadReplayInput = bundle => {
  check(record(bundle) && record(bundle.config), 'input bundle');
  const { config, currentSourceManifest, observed } = bundle;
  originalRole(bundle, config, currentSourceManifest);
  replayConfiguration(config, observed.controlHashes);
  transition(config.roleSourceTransition, bundle.roleEvidence, config, currentSourceManifest);
};

/** Receipt admission requires both fresh normal-owner observations to match
 * the original sealed DTO. It confers no readiness or next-pitch write proof. */
export const assertRoleReadReplayEvidence = bundle => {
  check(record(bundle) && record(bundle.config), 'evidence bundle');
  const { config, roleEvidence: role, currentSourceManifest, replaySourceManifest, replayConfig,
    receipt, stageTerminal: stage, supervisorTerminal: supervisor, outerTerminal: outer, observed } = bundle;
  raw(config, 'continuation configuration');
  check(config.schema === 'actual_artifact_pipeline_run_v2' && config.executionScope === 'next'
    && config.executeNextPitch === true && config.faultChecks === true, 'next scope');
  originalRole(bundle, config, currentSourceManifest); sourceIdentity(currentSourceManifest, config);
  replayConfiguration(replayConfig, observed.controlHashes);
  check(observed.replaySourceFilesUnchanged === true, 'replay Source bytes');
  for (const field of ['physicalProducer', 'physicalArtifactPath', 'physicalArtifactSha256', 'physicalEvidencePath',
    'physicalEvidenceSha256', 'physicalEndSourceId', 'inheritedOfficial', 'inheritedRole', 'officialReadReplay',
    'sourceTransition', 'expectedObservationSha256', 'roleSourceTransition', 'expectedSettlementSha256'])
    same(replayConfig[field], config[field], `replay ${field}`);
  const identity = transition(config.roleSourceTransition, role, replayConfig, replaySourceManifest);
  assertInheritedSourceContinuity(replaySourceManifest, currentSourceManifest, config);
  const binding = config.roleReadReplay;
  check(record(binding) && binding.kind === 'checked_role_read_replay_v1', 'checked role replay binding');
  const files = binding.files;
  keys(files, FILES, 'replay file roles'); keys(observed.hashes, FILES, 'observed replay file roles');
  for (const name of FILES) { pin(files[name], `${name} pin`); same(observed.hashes[name], files[name].sha256, `${name} observed hash`); }
  const priorPaths = [config.inheritedOfficial.files, config.inheritedRole.files, config.officialReadReplay.files]
    .flatMap(values => Object.values(values).map(value => value.path));
  for (const name of ['recoveryRegression', 'staleCasRegression']) priorPaths.push(role.roleReceipt[name].disk.path);
  const paths = [...priorPaths, ...FILES.map(name => files[name].path)];
  check(new Set(paths).size === paths.length, 'distinct original and replay paths');
  same(replayConfig.sourceManifestPath, files.sourceManifest.path, 'replay manifest path');
  same(identity.sourceManifestSha256, files.sourceManifest.sha256, 'replay manifest hash');
  for (const [name, value] of Object.entries({ receipt, stage, supervisor, outer, replaySourceManifest })) raw(value, name);
  check(receipt.schema === 'actual_role_read_replay_receipt_v1' && receipt.status === 'passed', 'receipt status');
  same(receipt.sourceIdentity, identity, 'receipt Source');
  same(receipt.inheritedSourceIdentity, role.roleReceipt.sourceIdentity, 'original role Source attribution');
  same(receipt.roleSourceTransition, config.roleSourceTransition, 'receipt transition');
  same(receipt.originalRoleBinding, config.inheritedRole, 'original role binding');
  same(receipt.originalOfficialBinding, config.inheritedOfficial, 'original official binding');
  same(receipt.originalOfficialReadReplay, role.roleReceipt.inheritedReadReplay, 'original official replay attribution');
  boundPin(receipt.originalRoleReceipt, config.inheritedRole.files.receipt, 'original role receipt');
  const inherited = [{ stage: '01-official', ...config.inheritedOfficial.files.receipt }, { stage: '02-role-workload', ...config.inheritedRole.files.receipt }];
  same(receipt.inheritedFaultReceipts, inherited, 'original fault attribution');
  same(receipt.physicalProducerReference, role.producerReference, 'original producer reference');
  same(receipt.originalPhysicalArtifactSha256, config.physicalArtifactSha256, 'original physical artifact');
  same(receipt.expectedSettlementSha256, config.expectedSettlementSha256, 'receipt sealed DTO digest');
  same(receipt.checks, CHECKS, 'strict preservation checks'); same(receipt.executed, EXECUTED, 'read operations only');
  same(receipt.openSqliteHandles, [], 'closed artifact handles'); same(receipt.newlyExecutedDomainFaults, [], 'no relabeled faults');
  same(observed.artifactSha256, role.roleReceipt.output.sha256, 'observed original artifact hash'); wal(observed.artifactWalBytes, 'observed WAL');
  check(Array.isArray(receipt.passes) && receipt.passes.length === 2, 'two read passes');
  for (const [index, pass] of receipt.passes.entries()) {
    raw(pass, `pass ${index}`);
    check(pass.index === index && integer(pass.connectionId) && pass.connectionId > 0, 'pass identity');
    for (const field of ['readOnly', 'queryOnly', 'transactionOwned', 'transactionClosed', 'connectionClosed']) check(pass[field] === true, `pass ${field}`);
    check(pass.totalChanges === 0, 'pass writes'); wal(pass.walBytesBefore, 'initial WAL'); wal(pass.walBytesAfter, 'final WAL');
    for (const field of ['artifactSha256Before', 'artifactSha256After']) same(pass[field], role.roleReceipt.output.sha256, `pass ${field}`);
    check(nonnegative(pass.seconds), 'pass elapsed time'); raw(pass.observation, 'pass observation');
    same(pass.observation.settlement, role.roleReceipt.settlement, 'exact original settlement DTO');
    same(digest(pass.observation.settlement), config.expectedSettlementSha256, 'sealed DTO digest parity');
    same(pass.observation.currentHeads, role.roleReceipt.settlement.participants.map(p => p.after), 'current AFTER heads');
    same(pass.observation.artifact, role.roleReceipt.output, 'complete original census and bytes');
    same(pass.observationSha256, digest(pass.observation), 'observation digest');
  }
  const [first, second] = receipt.passes;
  check(first.connectionId !== second.connectionId, 'fresh reopened connection');
  same(first.observation, second.observation, 'reopened observation'); same(first.observationSha256, second.observationSha256, 'reopened digest');
  const sealed = { stage: 'role-read-replay', ...files.receipt };
  check(stage.status === 'read_replay_passed' && stage.executionScope === 'role_read_replay' && stage.wholePipelinePassed === false, 'partial replay terminal');
  same(stage.sourceIdentity, identity, 'stage Source'); same(stage.counts, COUNTS, 'zero new helpers');
  same(stage.executed, EXECUTED, 'stage read operations'); same(stage.checks, CHECKS, 'stage preservation');
  same(stage.phaseReceipts, [sealed], 'stage replay receipt'); same(stage.inheritedStageReceipts, inherited, 'stage inherited receipts');
  same(stage.openSqliteHandles, [], 'stage closed handles');
  check(supervisor.status === 'read_replay_passed' && supervisor.executionScope === 'role_read_replay' && supervisor.wholePipelinePassed === false
    && supervisor.exitCode === 0 && supervisor.guard === null && supervisor.executingProcessReceiptValid === true
    && supervisor.pipelineTerminalStatus === 'read_replay_passed', 'supervisor terminal');
  same(supervisor.remainingOwnedProcesses, [], 'reaped execution'); same(supervisor.controlHashes, replayConfig.controlHashes, 'supervised controls');
  const audit = supervisor.sourceInputAndReceiptAudit;
  check(record(audit) && audit.passed === true, 'supervisor audit'); same(audit.preservedPhaseReceipts, [sealed], 'audited replay receipt');
  same(audit.inheritedStageReceipts, inherited, 'audited inherited receipts'); same(audit.originalRoleBinding, config.inheritedRole, 'audited role binding');
  same(audit.roleSourceTransition, config.roleSourceTransition, 'audited transition');
  const runtime = supervisor.runtime, limits = replayConfig.runtime;
  check(record(runtime) && runtime.nodeSha256 === limits.nodeSha256 && runtime.heapLimitMiB === limits.expectedHeapLimitMiB
    && nonnegative(runtime.elapsedSeconds) && runtime.elapsedSeconds <= limits.maximumWallSeconds && integer(runtime.peakRssKiB)
    && runtime.peakRssKiB > 0 && runtime.peakRssKiB <= limits.maximumRssMiB * 1024, 'bounded actual runtime');
  check(first.seconds + second.seconds <= runtime.elapsedSeconds, 'pass time bound');
  check(outer.kind === 'role_read_replay' && outer.passed === true && outer.wholePipelinePassed === false && outer.supervisorExitCode === 0
    && outer.outerGuard === null && outer.error === null && outer.supervisorReaped === true, 'outer exit and reap');
  same(outer.remainingSupervisorGroup, [], 'reaped supervisor'); same(outer.remainingExecutionGroup, [], 'reaped execution group');
  same(outer.sourceCommit, identity.sourceCommit, 'outer Source'); same(outer.sourceManifestSha256, identity.sourceManifestSha256, 'outer manifest');
  same(outer.configSha256, files.configuration.sha256, 'outer configuration');
  keys(outer.references, ['receipt', 'stageTerminal', 'supervisorTerminal'], 'outer references');
  for (const name of ['receipt', 'stageTerminal', 'supervisorTerminal']) boundPin(outer.references[name], files[name], `outer ${name}`);
};
