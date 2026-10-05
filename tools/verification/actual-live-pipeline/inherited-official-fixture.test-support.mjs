// JSON-only invented receipts. No native result or artifact is represented.
const sha = character => character.repeat(64);
export const ref = (path, character) => ({ path, sha256: sha(character) });
export const clone = value => structuredClone(value);
export const counts = { officialStarted: 1, officialCompleted: 1, roleStarted: 0, roleCompleted: 0, nextStarted: 0, nextCompleted: 0 };
export const fixture = () => {
  const files = {
    handoff: ref('/prior/official-handoff.json', 'a'), outerTerminal: ref('/prior/outer-terminal.json', 'b'),
    stageTerminal: ref('/prior/terminal.json', 'c'), supervisorTerminal: ref('/prior/runtime/process-terminal.json', 'd'),
    receipt: ref('/prior/01-official.receipt.json', 'e'), configuration: ref('/prior/config.json', 'f'),
    sourceManifest: ref('/prior/source-manifest.json', '1'), artifact: ref('/prior/01-official.sqlite', '2'),
  };
  const sourceIdentity = { sourceRoot: '/frozen/official', sourceCommit: 'a'.repeat(40), sourceTree: 'b'.repeat(40), sourceManifestSha256: files.sourceManifest.sha256 };
  const producerReference = { kind: 'first_base_clean_producer_v1', sourceCommit: 'c'.repeat(40), sourceManifestSha256: sha('3'), originalInputSha256: sha('4'), terminalSha256: sha('5'), outputSha256: sha('6'), negativeEvidenceHashes: {}, referencedFiles: [] };
  const producer = { kind: 'first_base_clean_producer_v1', sourceCommit: producerReference.sourceCommit };
  const physical = { path: '/producer/ended-chain.sqlite', sha256: producerReference.outputSha256, realDisk: true, mainFilename: '/producer/ended-chain.sqlite', journalMode: 'wal', rowCounts: { applications: 0, physical_pitch_progress_actions: 1, world_player_workload_activities: 0, actual_first_base_play_ends: 1, actual_live_play_fences: 1 }, workloadActivityKinds: [], wrapperReadOnlyOpenClosedVerified: true };
  const output = { ...physical, ...files.artifact, mainFilename: files.artifact.path, rowCounts: { ...physical.rowCounts, applications: 1 } };
  const officialReceipt = { schema: 'actual_artifact_stage_receipt_v1', status: 'passed', sourceIdentity,
    originalPhysicalArtifactSha256: producerReference.outputSha256, physicalEndSourceId: 'physical-end', physicalProducerReference: producerReference,
    counts: clone(counts), input: physical, output, closureSourceId: 'fixture-actual-live-closure', applicationId: 'fixture-actual-live-application',
    adjudicationEvidence: { physicalEndReference: { owner: 'actual_first_base_play_ends', sourceId: 'physical-end', sourceVersion: 'fixture-v1', sourceHash: sha('7'), snapshotHash: sha('8') }, wholeHistoryReference: { hash: sha('9'), convention: 'owned_scheduled_whole_history_manifest_v1' } },
    faultChecks: true, faultEvidence: { adjudicationDependencyAfterInsert: true, officialApplicationAfterInsert: true },
    executed: { helperCalls: 1, newOfficialApplications: 1, newPhysicalPitchActions: 0 }, syntheticFixturePolicy: true };
  const sealed = { stage: '01-official', ...files.receipt };
  const stageTerminal = { status: 'stage_passed', executionScope: 'official', wholePipelinePassed: false, remainingStages: ['role', 'next'],
    sourceIdentity, counts: clone(counts), phaseReceipts: [sealed], openSqliteHandles: [], physicalSourceUnchanged: true, sourceCutUnchanged: true,
    resumableOfficial: { receipt: sealed, output, closureSourceId: officialReceipt.closureSourceId, applicationId: officialReceipt.applicationId },
    scoringStillUnsupported: true, actualRoleWorkloadStillPending: true, newPhysicalPitchActions: 0 };
  const supervisorTerminal = { status: 'stage_passed', executionScope: 'official', wholePipelinePassed: false, exitCode: 0, guard: null,
    executingProcessReceiptValid: true, sourceInputAndReceiptAudit: { passed: true, preservedPhaseReceipts: [sealed] }, remainingOwnedProcesses: [],
    pipelineTerminalStatus: 'stage_passed', preservedPhaseReceipts: [files.receipt.path] };
  const officialHandoff = { schema: 'actual_official_stage_handoff_v1', status: 'stage_passed', wholePipelinePassed: false, remainingStages: ['role', 'next'],
    sourceIdentity, physicalProducerReference: producerReference, config: files.configuration, officialReceipt: sealed,
    stageTerminal: files.stageTerminal, supervisorTerminal: files.supervisorTerminal, output, closureSourceId: officialReceipt.closureSourceId, applicationId: officialReceipt.applicationId };
  const outerTerminal = { kind: 'official', sourceCommit: sourceIdentity.sourceCommit, sourceManifestSha256: sourceIdentity.sourceManifestSha256,
    configSha256: files.configuration.sha256, supervisorExitCode: 0, outerGuard: null, passed: true, wholePipelinePassed: false,
    references: { 'process-terminal.json': files.supervisorTerminal, 'terminal.json': files.stageTerminal, 'official-handoff.json': files.handoff },
    error: null, remainingSupervisorGroup: [], remainingExecutionGroup: [], supervisorReaped: true };
  const originalPhysical = { physicalArtifactPath: physical.path, physicalArtifactSha256: physical.sha256, physicalEvidencePath: '/producer/terminal.json', physicalEvidenceSha256: producerReference.terminalSha256, physicalEndSourceId: 'physical-end', physicalProducer: producer };
  const priorConfig = { schema: 'actual_artifact_pipeline_run_v2', executionScope: 'official', sourceRoot: sourceIdentity.sourceRoot,
    sourceCommit: sourceIdentity.sourceCommit, sourceManifestPath: files.sourceManifest.path, sourceManifestSha256: files.sourceManifest.sha256,
    ...originalPhysical, faultChecks: true, executeNextPitch: true };
  const priorSourceManifest = { schema: 'actual_artifact_pipeline_source_v1', sourceRoot: sourceIdentity.sourceRoot,
    sourceCommit: sourceIdentity.sourceCommit, sourceTree: sourceIdentity.sourceTree,
    files: [{ path: 'src/owner.ts', sha256: sha('7') }, { path: 'src/ActualLiveOfficialArtifact.test-support.ts', sha256: sha('8') }] };
  const currentSourceManifest = { ...priorSourceManifest, sourceRoot: '/frozen/role', sourceCommit: 'd'.repeat(40), sourceTree: 'e'.repeat(40),
    files: [...clone(priorSourceManifest.files), { path: 'src/ActualRoleWorkloadArtifact.test-support.ts', sha256: sha('9') }] };
  const config = { ...originalPhysical, executionScope: 'role', inheritedOfficial: { kind: 'checked_official_stage_v1', sourceCommit: sourceIdentity.sourceCommit,
    sourceRoot: sourceIdentity.sourceRoot, sourceManifestSha256: files.sourceManifest.sha256, files }, sourceRoot: currentSourceManifest.sourceRoot, sourceCommit: currentSourceManifest.sourceCommit };
  const observed = { hashes: Object.fromEntries(Object.entries(files).map(([key, value]) => [key, value.sha256])), outputWalBytes: 0, priorSourceFilesUnchanged: true };
  // Independent JSON files do not share object identities across their decoded values.
  return JSON.parse(JSON.stringify({ config, producerReference, officialHandoff, officialReceipt, stageTerminal, supervisorTerminal, outerTerminal, priorConfig, priorSourceManifest, currentSourceManifest, observed }));
};
