import { createHash } from 'node:crypto';
import { posix } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { assertOriginalOfficialStageProvenance, assertInheritedSourceContinuity,
  inheritedProductionSourceFiles } from './inherited-official-evidence.mjs';

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const id = value => typeof value === 'string' && value.length > 0 && value === value.trim();
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const integer = value => Number.isSafeInteger(value) && value >= 0;
const nonnegative = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const positive = value => nonnegative(value) && value > 0;
const absolute = value => id(value) && posix.isAbsolute(value) && posix.normalize(value) === value && value !== '/'
  && !value.includes('\\') && !value.includes('\0') && value.split('/').slice(1).every(part => part && part !== '.' && part !== '..');
const check = (condition, field) => { if (!condition) throw new Error(`official read replay: ${field}`); };
const same = (actual, expected, field) => check(isDeepStrictEqual(actual, expected), field);
const keys = (value, expected, field) => { check(record(value), field); same(Object.keys(value).sort(), [...expected].sort(), field); };
const raw = (value, field) => check(record(value) && !['publicationProjection', 'originalRawReceiptSha256']
  .some(key => Object.hasOwn(value, key)), `${field} raw evidence`);
const pin = (value, field) => check(record(value) && absolute(value.path) && hash(value.sha256), field);
const boundPin = (value, expected, field) => { pin(value, field); same(value.path, expected.path, `${field} path`); same(value.sha256, expected.sha256, `${field} hash`); };
const wal = (value, field) => check(value === null || value === 0, field);
const distinctIds = (values, field) => check(values.every(id) && new Set(values).size === values.length, field);
const FILES = ['receipt', 'stageTerminal', 'supervisorTerminal', 'outerTerminal', 'configuration', 'sourceManifest'];
const CONTROLS = ['launcher', 'runtimeProbe', 'replayRunner'];
const CHANGE = { path: 'src/host/world/SqliteActualRoleWorkloadStore.ts',
  beforeSha256: 'd0d8ea506c4ee1c1ae41832a402655e06fbf0c5d45fcb82080d55846a21f1e1f',
  afterSha256: '3b011f654ab52ac201fccdedd9a02fdfbdcba58b580dca0eb653b0e006050385' };
const PAIRED_PURPOSE = 'role_callback_and_closure_paired_read';
const PAIRED_CHANGES = [
  { path: 'src/host/world/ActualLiveAdjudicationFromSqlite.ts',
    beforeSha256: 'b6014827512d4ac75d67e95a5db42f56489f4d98bc1d01c1cad88fddf8b2d262',
    afterSha256: 'c1aefae9c8e3f9ef29977dc24a8dcba56e8e5c913b91941fe2de476ae47c30f2' },
  { path: 'src/host/world/ActualLivePlayClosureEvidenceFromSqlite.ts',
    beforeSha256: 'cd169bfcec7325bb598500635b9998473366625433e4484f0d9908ddf2e98c03',
    afterSha256: 'dbe67afbfcad315fe35c212bb640d199f60f80e152eec2b6a0de2540abd05c14' },
  CHANGE,
];
const CHECKS = { sourceUnchanged: true, configUnchanged: true, controlsUnchanged: true, originalEvidenceUnchanged: true,
  artifactUnchanged: true, closeReopenEqual: true, readOnlyEnforced: true };
const COUNTS = { officialStarted: 0, officialCompleted: 0, roleStarted: 0, roleCompleted: 0, nextStarted: 0, nextCompleted: 0 };
const EXECUTED = { readOnlyConnections: 2, readTransactions: 2, roleContextReads: 2, strictCurrentStageChecks: 2, preparedPlanReads: 2,
  officialHelperCalls: 0, officialWrites: 0, newOfficialApplications: 0, newWorkloadActivities: 0, newPhysicalPitchActions: 0 };

const sourceIdentity = (manifest, config) => {
  inheritedProductionSourceFiles(manifest, 'Source manifest');
  check(record(config) && absolute(config.sourceManifestPath) && hash(config.sourceManifestSha256), 'Source configuration');
  for (const field of ['sourceRoot', 'sourceCommit']) same(manifest[field], config[field], `Source ${field}`);
  return { sourceRoot: manifest.sourceRoot, sourceCommit: manifest.sourceCommit, sourceTree: manifest.sourceTree,
    sourceManifestSha256: config.sourceManifestSha256 };
};

const originalStage = (bundle, config, manifest) => {
  check(record(bundle.officialEvidence) && record(bundle.observed), 'original evidence and observations');
  same(bundle.officialEvidence.config, config, 'original-stage consumer configuration');
  same(bundle.officialEvidence.currentSourceManifest, manifest, 'original-stage consumer Source manifest');
  check(bundle.observed.currentSourceFilesUnchanged === true, 'current Source bytes');
  assertOriginalOfficialStageProvenance(bundle.officialEvidence);
  const official = bundle.officialEvidence.officialReceipt, result = official.officialReceipt;
  check(record(result) && result.applicationId === official.applicationId && integer(result.previousPlayId)
    && integer(result.durableRevision) && record(result.appliedMatchState), 'original official result');
  check(record(official.scoring) && official.scoring.kind === 'unsupported'
    && record(official.workload) && official.workload.kind === 'pending'
    && official.retiredControllerCount === 10, 'original scoring, workload and retired controllers');
  for (const table of ['actual_role_workload_assessments', 'actual_role_workload_settlements'])
    check(!Object.hasOwn(official.output.rowCounts, table) || official.output.rowCounts[table] === 0, `zero or absent ${table}`);
};

const transition = (value, official, config, manifest) => {
  keys(value, ['kind', 'purpose', 'fromSourceIdentity', 'toSourceIdentity', 'changedProductionFiles'], 'Source transition fields');
  const changes = value.purpose === 'role_accepted_activity_read_transaction' ? [CHANGE]
    : value.purpose === PAIRED_PURPOSE ? PAIRED_CHANGES : null;
  check(value.kind === 'official_read_replay_transition_v1' && changes !== null, 'reviewed transition kind and purpose');
  same(value.fromSourceIdentity, official.officialReceipt.sourceIdentity, 'original Source identity');
  const identity = sourceIdentity(manifest, config);
  same(value.toSourceIdentity, identity, 'replay Source identity');
  same(value.changedProductionFiles, changes, 'exact reviewed production hash pair');
  const prior = inheritedProductionSourceFiles(official.priorSourceManifest, 'original Source manifest');
  const current = inheritedProductionSourceFiles(manifest, 'replay Source manifest');
  same(current.map(([path]) => path), prior.map(([path]) => path), 'complete production path set');
  const changed = [];
  for (let index = 0; index < prior.length; index++) {
    const [path, beforeSha256] = prior[index], [, afterSha256] = current[index];
    if (beforeSha256 !== afterSha256) changed.push({ path, beforeSha256, afterSha256 });
  }
  same(changed, changes, 'independently compared production transition');
  return identity;
};

const replayConfiguration = (config, observedControls) => {
  raw(config, 'replay configuration');
  check(config.schema === 'actual_official_read_replay_run_v1' && config.executionScope === 'official_read_replay', 'replay configuration scope');
  check(!Object.hasOwn(config, 'officialReadReplay'), 'replay cannot inherit its own proof');
  if (config.sourceTransition?.purpose === PAIRED_PURPOSE)
    check(hash(config.expectedObservationSha256), 'paired replay comparison digest');
  keys(config.controlHashes, CONTROLS, 'replay control hashes');
  check(Object.values(config.controlHashes).every(hash), 'replay control hash values');
  same(observedControls, config.controlHashes, 'independently observed replay controls');
  const runtime = config.runtime;
  check(record(runtime) && hash(runtime.nodeSha256) && integer(runtime.expectedHeapLimitMiB) && runtime.expectedHeapLimitMiB > 0
    && positive(runtime.maximumWallSeconds) && positive(runtime.maximumRssMiB), 'finite replay runtime configuration');
};

/** Pure pre-execution admission. The loader must independently verify all old
 * pins and both Sources, including admitting the physical-producer reference.
 * This route authorizes only the read replay, never any completed role stage. */
export const assertOfficialReadReplayInput = bundle => {
  check(record(bundle) && record(bundle.config), 'input bundle');
  const { config, currentSourceManifest, observed } = bundle;
  originalStage(bundle, config, currentSourceManifest);
  replayConfiguration(config, observed.controlHashes);
  transition(config.sourceTransition, bundle.officialEvidence, config, currentSourceManifest);
};

const observation = (value, official) => {
  raw(value, 'authenticated observation');
  same(value.closureSourceId, official.closureSourceId, 'authenticated closure Source');
  same(value.applicationId, official.applicationId, 'authenticated application');
  check(value.closureStatus === 'OFFICIAL_APPLIED' && value.officialApplied === true
    && value.currentMatchExact === true && value.currentHeadsAuthenticated === true, 'current authenticated official stage');
  check(hash(value.closureProposalHash), 'authenticated closure proposal hash');
  check(record(value.adjudicationReference) && id(value.adjudicationReference.sourceId)
    && hash(value.adjudicationReference.snapshotHash), 'newly authenticated adjudication reference');
  const result = official.officialReceipt;
  same(value.officialReceipt, result, 'original official result projection');
  for (const field of ['scoring', 'workload', 'retiredControllerCount']) same(value[field], official[field], `original ${field}`);
  for (const field of ['physicalEndReference', 'wholeHistoryReference'])
    same(value[field], official.adjudicationEvidence[field], `original ${field}`);

  const participants = value.participantReferences;
  check(Array.isArray(participants) && participants.length === 10 && participants.every(record), 'ten original participant references');
  const players = participants.map(participant => participant.playerId);
  distinctIds(players, 'distinct original Players');
  same(players, [...players].sort(), 'raw lexical original Player order');
  distinctIds(participants.map(participant => participant.personId), 'distinct original Persons');
  const first = participants[0];
  for (const participant of participants) {
    check(id(participant.clubId) && id(participant.careerId) && id(participant.gameId)
      && integer(participant.playId) && integer(participant.gameDay)
      && hash(participant.bindingHash) && hash(participant.personHash), 'authenticated participant scope and hashes');
    for (const field of ['careerId', 'gameId', 'playId', 'gameDay']) same(participant[field], first[field], `shared participant ${field}`);
    same(participant.playId, result.previousPlayId, 'original participant play');
  }
  const plan = value.preparedPlan;
  check(record(plan) && plan.kind === 'pending', 'pending prepared plan');
  same(plan.missingAssessments, players, 'all original missing assessments');
  check(Array.isArray(plan.missingBaselines), 'observed missing baselines');
  distinctIds(plan.missingBaselines, 'distinct missing baselines');
  same(plan.missingBaselines, players.filter(player => plan.missingBaselines.includes(player)), 'ordered original missing-baseline subset');
  // The authenticating runner may retain the owner's reference fields. When
  // present they must describe this exact observation, not another plan scope.
  const planReferences = { closureSourceId: value.closureSourceId, closureApplicationId: value.applicationId,
    closureProposalHash: value.closureProposalHash, careerId: first.careerId, gameId: first.gameId, playId: first.playId,
    gameDay: first.gameDay, physicalEndReference: value.physicalEndReference, wholeHistoryReference: value.wholeHistoryReference };
  for (const [field, expected] of Object.entries(planReferences))
    if (Object.hasOwn(plan, field)) same(plan[field], expected, `prepared plan ${field}`);

  same(value.artifact, official.output, 'complete original closed artifact facts and census');
  // The shared original-stage predicate already requires exactly one physical
  // action, end, fence and application, no activities, and an empty kind census.
};

/** Pure post-execution admission. No helper, SQLite connection or application
 * executes here. Raw independently pinned execution and outer reap evidence is
 * mandatory; all original official faults keep their original Source/receipt. */
export const assertOfficialReadReplayEvidence = bundle => {
  check(record(bundle) && record(bundle.config), 'evidence bundle');
  const { config, officialEvidence: official, currentSourceManifest, replaySourceManifest, replayConfig,
    receipt, stageTerminal: stage, supervisorTerminal: supervisor, outerTerminal: outer, observed } = bundle;
  raw(config, 'continuation configuration');
  check(config.schema === 'actual_artifact_pipeline_run_v2' && ['role', 'next'].includes(config.executionScope), 'continuation scope');
  originalStage(bundle, config, currentSourceManifest);
  sourceIdentity(currentSourceManifest, config);
  replayConfiguration(replayConfig, observed.controlHashes);
  if (config.sourceTransition?.purpose === PAIRED_PURPOSE) {
    check(hash(config.expectedObservationSha256), 'consumer comparison digest');
    same(replayConfig.expectedObservationSha256, config.expectedObservationSha256, 'bound replay comparison digest');
  }
  check(observed.replaySourceFilesUnchanged === true, 'replay Source bytes');
  same(replayConfig.inheritedOfficial, config.inheritedOfficial, 'replay original eight-file binding');
  for (const field of ['physicalProducer', 'physicalArtifactPath', 'physicalArtifactSha256', 'physicalEvidencePath',
    'physicalEvidenceSha256', 'physicalEndSourceId', 'sourceTransition']) same(replayConfig[field], config[field], `replay ${field}`);
  const identity = transition(config.sourceTransition, official, replayConfig, replaySourceManifest);
  // A later consumer may have reviewed verification/doc changes, but it cannot
  // introduce another production transition beyond the replay's reviewed cut.
  assertInheritedSourceContinuity(replaySourceManifest, currentSourceManifest, config);

  const binding = config.officialReadReplay;
  check(record(binding) && binding.kind === 'checked_official_read_replay_v1', 'checked replay binding');
  const files = binding.files;
  keys(files, FILES, 'replay file roles');
  keys(observed.hashes, FILES, 'observed replay file roles');
  for (const name of FILES) {
    pin(files[name], `${name} pin`);
    same(observed.hashes[name], files[name].sha256, `${name} independently observed hash`);
  }
  const originalPaths = Object.values(config.inheritedOfficial.files).map(value => value.path);
  const paths = [...originalPaths, ...FILES.map(name => files[name].path)];
  check(new Set(paths).size === paths.length, 'distinct original and replay evidence paths');
  same(replayConfig.sourceManifestPath, files.sourceManifest.path, 'replay manifest path');
  same(identity.sourceManifestSha256, files.sourceManifest.sha256, 'replay manifest hash');
  for (const [name, value] of Object.entries({ receipt, stage, supervisor, outer, replaySourceManifest })) raw(value, name);
  check(receipt.schema === 'actual_official_read_replay_receipt_v1' && receipt.status === 'passed', 'replay receipt status');
  same(receipt.sourceIdentity, identity, 'receipt replay Source identity');
  same(receipt.inheritedSourceIdentity, official.officialReceipt.sourceIdentity, 'receipt original Source identity');
  same(receipt.sourceTransition, config.sourceTransition, 'receipt Source transition');
  same(receipt.originalOfficialBinding, config.inheritedOfficial, 'receipt original eight-file binding');
  boundPin(receipt.originalOfficialReceipt, config.inheritedOfficial.files.receipt, 'original official receipt');
  boundPin(receipt.inheritedFaultReceipt, config.inheritedOfficial.files.receipt, 'original fault attribution');
  same(receipt.physicalProducerReference, official.producerReference, 'original admitted physical producer');
  same(receipt.originalPhysicalArtifactSha256, config.physicalArtifactSha256, 'original physical artifact');
  same(receipt.checks, CHECKS, 'strict replay checks');
  same(receipt.executed, EXECUTED, 'actual replay operations');
  same(receipt.openSqliteHandles, [], 'replay closed artifact handles');
  same(receipt.newlyExecutedOfficialFaults, [], 'no relabeled original faults');
  same(observed.artifactSha256, official.officialReceipt.output.sha256, 'observed immutable original artifact');
  wal(observed.artifactWalBytes, 'observed closed artifact WAL');

  check(Array.isArray(receipt.passes) && receipt.passes.length === 2, 'exactly two fresh read passes');
  for (const [index, pass] of receipt.passes.entries()) {
    raw(pass, `pass ${index}`);
    check(pass.index === index && integer(pass.connectionId) && pass.connectionId > 0, `pass ${index} identity`);
    for (const field of ['readOnly', 'queryOnly', 'transactionOwned', 'transactionClosed', 'connectionClosed'])
      check(pass[field] === true, `pass ${index} ${field}`);
    check(pass.totalChanges === 0, `pass ${index} no writes`);
    wal(pass.walBytesBefore, `pass ${index} initial WAL`);
    wal(pass.walBytesAfter, `pass ${index} final WAL`);
    for (const field of ['artifactSha256Before', 'artifactSha256After'])
      same(pass[field], official.officialReceipt.output.sha256, `pass ${index} ${field}`);
    check(nonnegative(pass.seconds), `pass ${index} elapsed time`);
    observation(pass.observation, official.officialReceipt);
    same(pass.observationSha256, createHash('sha256').update(JSON.stringify(pass.observation)).digest('hex'), `pass ${index} observation digest`);
    if (config.sourceTransition.purpose === PAIRED_PURPOSE)
      same(pass.observationSha256, config.expectedObservationSha256, `pass ${index} original observation parity`);
  }
  const [first, second] = receipt.passes;
  check(first.connectionId !== second.connectionId, 'fresh reopened connection identity');
  same(second.observation, first.observation, 'equal authenticated close/reopen observations');
  same(second.observationSha256, first.observationSha256, 'equal close/reopen observation digests');

  const sealed = { stage: 'official-read-replay', path: files.receipt.path, sha256: files.receipt.sha256 };
  const inherited = [{ stage: '01-official', ...config.inheritedOfficial.files.receipt }];
  check(stage.status === 'read_replay_passed' && stage.executionScope === 'official_read_replay'
    && stage.wholePipelinePassed === false, 'partial replay stage terminal');
  same(stage.sourceIdentity, identity, 'stage replay Source identity');
  same(stage.counts, COUNTS, 'zero current domain helpers');
  same(stage.executed, EXECUTED, 'stage actual replay operations');
  same(stage.checks, CHECKS, 'stage strict replay checks');
  same(stage.phaseReceipts, [sealed], 'separate sealed replay receipt');
  same(stage.inheritedStageReceipts, inherited, 'original inherited official receipt');
  same(stage.openSqliteHandles, [], 'stage closed artifact handles');

  check(supervisor.status === 'read_replay_passed' && supervisor.executionScope === 'official_read_replay'
    && supervisor.wholePipelinePassed === false && supervisor.exitCode === 0 && supervisor.guard === null
    && supervisor.executingProcessReceiptValid === true && supervisor.pipelineTerminalStatus === 'read_replay_passed', 'replay supervisor terminal');
  same(supervisor.remainingOwnedProcesses, [], 'no remaining replay processes');
  same(supervisor.controlHashes, replayConfig.controlHashes, 'supervised replay controls');
  const audit = supervisor.sourceInputAndReceiptAudit;
  check(record(audit) && audit.passed === true, 'supervised Source/input/receipt audit');
  same(audit.preservedPhaseReceipts, [sealed], 'supervised replay receipt');
  same(audit.originalOfficialBinding, config.inheritedOfficial, 'supervised original eight-file binding');
  same(audit.sourceTransition, config.sourceTransition, 'supervised reviewed transition');
  const runtime = supervisor.runtime, limits = replayConfig.runtime;
  check(record(runtime) && runtime.nodeSha256 === limits.nodeSha256 && runtime.heapLimitMiB === limits.expectedHeapLimitMiB
    && nonnegative(runtime.elapsedSeconds) && runtime.elapsedSeconds <= limits.maximumWallSeconds
    && integer(runtime.peakRssKiB) && runtime.peakRssKiB > 0 && runtime.peakRssKiB <= limits.maximumRssMiB * 1024, 'actual bounded replay runtime');
  check(first.seconds + second.seconds <= runtime.elapsedSeconds, 'pass time within supervised elapsed time');

  // The outer record observes the supervisor's actual exit and reaps both
  // groups; a successful execution-child terminal cannot replace this proof.
  check(outer.kind === 'official_read_replay' && outer.passed === true && outer.wholePipelinePassed === false
    && outer.supervisorExitCode === 0 && outer.outerGuard === null && outer.error === null
    && outer.supervisorReaped === true, 'replay outer exit and reap');
  same(outer.remainingSupervisorGroup, [], 'no remaining replay supervisor group');
  same(outer.remainingExecutionGroup, [], 'no remaining replay execution group');
  same(outer.sourceCommit, identity.sourceCommit, 'outer replay Source commit');
  same(outer.sourceManifestSha256, identity.sourceManifestSha256, 'outer replay Source manifest');
  same(outer.configSha256, files.configuration.sha256, 'outer replay configuration hash');
  keys(outer.references, ['receipt', 'stageTerminal', 'supervisorTerminal'], 'outer replay references');
  for (const name of ['receipt', 'stageTerminal', 'supervisorTerminal']) boundPin(outer.references[name], files[name], `outer ${name}`);
};
