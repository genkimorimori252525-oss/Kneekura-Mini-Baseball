import { digest } from './pipeline-common.mjs';
import { fixture as originalFixture, clone, ref } from './inherited-official-fixture.test-support.mjs';
// Entirely invented JSON controls. No real artifact, process, read, or write is represented.
export const OWNER = 'src/host/world/SqliteActualRoleWorkloadStore.ts';
export const BEFORE = 'd0d8ea506c4ee1c1ae41832a402655e06fbf0c5d45fcb82080d55846a21f1e1f';
export const AFTER = '3b011f654ab52ac201fccdedd9a02fdfbdcba58b580dca0eb653b0e006050385';
export const FILES = ['receipt', 'stageTerminal', 'supervisorTerminal', 'outerTerminal', 'configuration', 'sourceManifest'];
export const PLAYERS = ['away-1', 'home-1', 'home-2', 'home-3', 'home-4', 'home-5', 'home-6', 'home-7', 'home-8', 'p2'];
export const ZERO_HELPERS = { officialStarted: 0, officialCompleted: 0, roleStarted: 0, roleCompleted: 0, nextStarted: 0, nextCompleted: 0 };
export const EXECUTED = { readOnlyConnections: 2, readTransactions: 2, roleContextReads: 2, strictCurrentStageChecks: 2, preparedPlanReads: 2,
  officialHelperCalls: 0, officialWrites: 0, newOfficialApplications: 0, newWorkloadActivities: 0, newPhysicalPitchActions: 0 };
const hash = value => value.repeat(64);
export const observationDigest = value => digest(JSON.stringify(value));
export const fixture = () => {
  const official = originalFixture();
  official.priorSourceManifest.files.push({ path: OWNER, sha256: BEFORE });
  const output = { ...official.officialReceipt.output, rowCounts: { ...official.officialReceipt.output.rowCounts,
    actual_role_workload_assessments: 0, actual_role_workload_settlements: 0, world_player_workload_heads: 2, world_player_workload_baselines: 2 } };
  official.officialReceipt.output = clone(output); official.officialHandoff.output = clone(output); official.stageTerminal.resumableOfficial.output = clone(output);
  official.officialReceipt.officialReceipt = { applicationId: official.officialReceipt.applicationId, previousPlayId: 7, durableRevision: 1, appliedMatchState: { playId: 8 } };
  official.officialReceipt.retiredControllerCount = 10;
  official.officialReceipt.scoring = { kind: 'unsupported' };
  official.officialReceipt.workload = { kind: 'pending', reason: 'actual_role_effort_policy_and_application_unconnected' };
  const replayFiles = Object.fromEntries(FILES.map((name, index) => [name, ref(`/replay/${name}.json`, String(index + 3))]));
  const sourceIdentity = { sourceRoot: '/fixed/role', sourceCommit: '1'.repeat(40), sourceTree: '2'.repeat(40), sourceManifestSha256: replayFiles.sourceManifest.sha256 };
  const currentSourceManifest = { schema: 'actual_artifact_pipeline_source_v1', sourceRoot: sourceIdentity.sourceRoot,
    sourceCommit: sourceIdentity.sourceCommit, sourceTree: sourceIdentity.sourceTree,
    files: official.priorSourceManifest.files.map(row => row.path === OWNER ? { ...row, sha256: AFTER } : clone(row)) };
  const transition = { kind: 'official_read_replay_transition_v1', purpose: 'role_accepted_activity_read_transaction',
    fromSourceIdentity: clone(official.officialReceipt.sourceIdentity), toSourceIdentity: clone(sourceIdentity),
    changedProductionFiles: [{ path: OWNER, beforeSha256: BEFORE, afterSha256: AFTER }] };
  const config = { ...clone(official.config), schema: 'actual_artifact_pipeline_run_v2', sourceRoot: sourceIdentity.sourceRoot,
    sourceCommit: sourceIdentity.sourceCommit, sourceManifestPath: replayFiles.sourceManifest.path, sourceManifestSha256: sourceIdentity.sourceManifestSha256,
    officialReadReplay: { kind: 'checked_official_read_replay_v1', files: clone(replayFiles) }, sourceTransition: clone(transition) };
  official.config = clone(config); official.currentSourceManifest = clone(currentSourceManifest);
  const replayConfig = { ...clone(config), schema: 'actual_official_read_replay_run_v1', executionScope: 'official_read_replay',
    controlHashes: { launcher: hash('9'), runtimeProbe: hash('a'), replayRunner: hash('b') },
    runtime: { nodeSha256: hash('c'), expectedHeapLimitMiB: 1120, maximumWallSeconds: 1800, maximumRssMiB: 1536 } };
  delete replayConfig.officialReadReplay;
  const participantReferences = PLAYERS.map((playerId, index) => ({ playerId, personId: `person-${index}`, clubId: playerId === 'away-1' ? 'club-b' : 'club-a',
    careerId: 'career-a', gameId: 'game-1', playId: 7, gameDay: 10, bindingHash: digest(`binding-${index}`), personHash: digest(`person-${index}`) }));
  const observation = { closureSourceId: official.officialReceipt.closureSourceId, applicationId: official.officialReceipt.applicationId,
    closureStatus: 'OFFICIAL_APPLIED', officialApplied: true, currentMatchExact: true, currentHeadsAuthenticated: true,
    closureProposalHash: hash('d'), adjudicationReference: { sourceId: 'fixture-actual-live-adjudication', snapshotHash: hash('e') },
    officialReceipt: clone(official.officialReceipt.officialReceipt), scoring: clone(official.officialReceipt.scoring), workload: clone(official.officialReceipt.workload),
    retiredControllerCount: 10, physicalEndReference: clone(official.officialReceipt.adjudicationEvidence.physicalEndReference),
    wholeHistoryReference: clone(official.officialReceipt.adjudicationEvidence.wholeHistoryReference), participantReferences,
    preparedPlan: { kind: 'pending', missingAssessments: [...PLAYERS], missingBaselines: PLAYERS.filter(player => player !== 'p2') },
    artifact: clone(output) };
  const checks = { sourceUnchanged: true, configUnchanged: true, controlsUnchanged: true, originalEvidenceUnchanged: true,
    artifactUnchanged: true, closeReopenEqual: true, readOnlyEnforced: true };
  const passes = [0, 1].map(index => ({ index, connectionId: index + 1, readOnly: true, queryOnly: true, transactionOwned: true,
    transactionClosed: true, connectionClosed: true, totalChanges: 0, walBytesBefore: 0, walBytesAfter: 0,
    artifactSha256Before: output.sha256, artifactSha256After: output.sha256, seconds: index + 1,
    observation: clone(observation), observationSha256: observationDigest(observation) }));
  const receipt = { schema: 'actual_official_read_replay_receipt_v1', status: 'passed', sourceIdentity: clone(sourceIdentity),
    inheritedSourceIdentity: clone(official.officialReceipt.sourceIdentity), sourceTransition: clone(transition),
    originalOfficialBinding: clone(config.inheritedOfficial), originalOfficialReceipt: clone(config.inheritedOfficial.files.receipt),
    physicalProducerReference: clone(official.producerReference), originalPhysicalArtifactSha256: config.physicalArtifactSha256,
    inheritedFaultReceipt: clone(config.inheritedOfficial.files.receipt), checks: clone(checks), executed: clone(EXECUTED),
    passes, openSqliteHandles: [], newlyExecutedOfficialFaults: [] };
  const sealed = { stage: 'official-read-replay', ...replayFiles.receipt };
  const stageTerminal = { status: 'read_replay_passed', executionScope: 'official_read_replay', wholePipelinePassed: false,
    sourceIdentity: clone(sourceIdentity), counts: clone(ZERO_HELPERS), executed: clone(EXECUTED), checks: clone(checks),
    phaseReceipts: [clone(sealed)], inheritedStageReceipts: [{ stage: '01-official', ...config.inheritedOfficial.files.receipt }], openSqliteHandles: [] };
  const supervisorTerminal = { status: 'read_replay_passed', executionScope: 'official_read_replay', wholePipelinePassed: false,
    exitCode: 0, guard: null, executingProcessReceiptValid: true, pipelineTerminalStatus: 'read_replay_passed', remainingOwnedProcesses: [],
    controlHashes: clone(replayConfig.controlHashes), sourceInputAndReceiptAudit: { passed: true, preservedPhaseReceipts: [clone(sealed)],
      originalOfficialBinding: clone(config.inheritedOfficial), sourceTransition: clone(transition) },
    runtime: { nodeSha256: replayConfig.runtime.nodeSha256, heapLimitMiB: 1120, elapsedSeconds: 3, peakRssKiB: 1024 } };
  const outerTerminal = { kind: 'official_read_replay', passed: true, wholePipelinePassed: false, supervisorExitCode: 0, outerGuard: null,
    error: null, supervisorReaped: true, remainingSupervisorGroup: [], remainingExecutionGroup: [],
    sourceCommit: sourceIdentity.sourceCommit, sourceManifestSha256: sourceIdentity.sourceManifestSha256, configSha256: replayFiles.configuration.sha256,
    references: { receipt: clone(replayFiles.receipt), stageTerminal: clone(replayFiles.stageTerminal), supervisorTerminal: clone(replayFiles.supervisorTerminal) } };
  return clone({ config, officialEvidence: official, currentSourceManifest, replaySourceManifest: clone(currentSourceManifest), replayConfig,
    receipt, stageTerminal, supervisorTerminal, outerTerminal, observed: { hashes: Object.fromEntries(FILES.map(name => [name, replayFiles[name].sha256])),
      replaySourceFilesUnchanged: true, currentSourceFilesUnchanged: true, controlHashes: clone(replayConfig.controlHashes), artifactSha256: output.sha256, artifactWalBytes: 0 } });
};
export const inputFixture = () => {
  const value = fixture(); value.config = clone(value.replayConfig); value.officialEvidence.config = clone(value.config);
  return { config: value.config, officialEvidence: value.officialEvidence, currentSourceManifest: value.currentSourceManifest,
    observed: { currentSourceFilesUnchanged: true, controlHashes: clone(value.config.controlHashes) } };
};
export const repinPasses = value => {
  for (const pass of value.receipt.passes) pass.observationSha256 = observationDigest(pass.observation);
};
