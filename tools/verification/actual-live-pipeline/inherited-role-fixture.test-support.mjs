import { createHash } from 'node:crypto';
import { fixture as officialFixture, clone, ref } from './inherited-official-fixture.test-support.mjs';

// Entirely invented JSON. These file hashes and receipts represent no execution,
// real Source, closed database, supervisor lifecycle, or accepted domain evidence.
const sha = character => character.repeat(64);
const canonical = value => JSON.stringify(value, (_key, item) => item !== null && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
const hash = value => createHash('sha256').update(canonical(value)).digest('hex');
export const roleCounts = { officialStarted: 0, officialCompleted: 0, roleStarted: 1, roleCompleted: 1, nextStarted: 0, nextCompleted: 0 };
export const fixture = () => {
  const officialEvidence = officialFixture();
  const official = officialEvidence.officialReceipt;
  const files = {
    handoff: ref('/role/role-handoff.json', 'a'), outerTerminal: ref('/role/outer-terminal.json', 'b'),
    stageTerminal: ref('/role/terminal.json', 'c'), supervisorTerminal: ref('/role/runtime/process-terminal.json', 'd'),
    receipt: ref('/role/02-role-workload.receipt.json', 'e'), configuration: ref('/role/config.json', 'f'),
    sourceManifest: ref('/role/source-manifest.json', '1'), artifact: ref('/role/02-role-workload.sqlite', '2'),
  };
  const priorSourceManifest = clone(officialEvidence.currentSourceManifest);
  const sourceIdentity = { sourceRoot: priorSourceManifest.sourceRoot, sourceCommit: priorSourceManifest.sourceCommit,
    sourceTree: priorSourceManifest.sourceTree, sourceManifestSha256: files.sourceManifest.sha256 };
  const priorConfig = { ...clone(officialEvidence.config), schema: 'actual_artifact_pipeline_run_v2', executionScope: 'role',
    sourceManifestPath: files.sourceManifest.path, sourceManifestSha256: files.sourceManifest.sha256,
    faultChecks: true, executeNextPitch: true };
  officialEvidence.config = clone(priorConfig);
  const producerReference = clone(official.physicalProducerReference);
  const inheritedStageReceipts = [{ stage: '01-official', ...clone(priorConfig.inheritedOfficial.files.receipt) }];
  const physicalEndReference = clone(official.adjudicationEvidence.physicalEndReference);
  const wholeHistoryReference = clone(official.adjudicationEvidence.wholeHistoryReference);
  const scope = { closureSourceId: official.closureSourceId, closureApplicationId: official.applicationId,
    closureProposalHash: sha('6'), careerId: 'synthetic-career', gameId: 'synthetic-game', playId: 0, gameDay: 8,
    physicalEndReference, wholeHistoryReference };
  const fixturePolicy = { policyId: 'explicit-role-workload-fixture', version: 'fixture-v1', availableAtDay: 0,
    workloadFatiguePerUnit: 0.01, travelFatiguePerKm: 0.001, recoveryPerHour: 0.1 };
  const assessments = [], baselineEvidence = [], addedBaselines = [], participants = [];
  const players = ['away-1', ...Array.from({ length: 8 }, (_, index) => `home-${index + 1}`), 'p2'];
  for (const [index, playerId] of players.entries()) {
    const sourceId = `fixture-total-effort:${playerId}`;
    const assessment = { sourceId, sourceVersion: 'fixture-v1', closureSourceId: scope.closureSourceId,
      physicalEndReference: clone(physicalEndReference), wholeHistoryReference: clone(wholeHistoryReference),
      participantReference: { playerId, bindingHash: sha('7'), personHash: sha('8') }, effortUnits: index,
      provenance: { assessmentSourceId: `explicit-fixture-assessment:${playerId}`, assessmentVersion: 'fixture-v1',
        calibrationSourceId: 'explicit-fixture-total-effort', calibrationVersion: 'fixture-v1' } };
    assessments.push(assessment);
    // One accepted original baseline deliberately has different calibration.
    // Admission preserves it; only the nine added fixture baselines use defaults.
    const retained = playerId === 'p2';
    const baseline = { sourceId: retained ? 'synthetic-retained-baseline' : `fixture-role-baseline:${playerId}`, sourceVersion: 'fixture-v1',
      personLinkSourceId: `synthetic-person-link:${playerId}`, careerId: scope.careerId, playerId,
      createdAtDay: retained ? 0 : scope.gameDay, fatigue: retained ? 0.2 : 0.1, recoveryCapacity: retained ? 0.7 : 0.5,
      policy: retained ? { ...clone(fixturePolicy), policyId: 'synthetic-original-policy',
        workloadFatiguePerUnit: 0.025, travelFatiguePerKm: 0.002, recoveryPerHour: 0.15 } : clone(fixturePolicy) };
    baselineEvidence.push({ source: baseline, sourceHash: hash(baseline) });
    if (!retained) addedBaselines.push(clone(baseline));
    const { sourceId: _baselineId, sourceVersion: _baselineVersion, personLinkSourceId: _link, ...baselineState } = baseline;
    const before = { ...clone(baselineState), modelVersion: 'player-workload-recovery-v1', effectiveDay: baseline.createdAtDay, revision: 0 };
    const after = { ...clone(before), effectiveDay: scope.gameDay, revision: 1,
      fatigue: Math.max(0, Math.min(1, before.fatigue + before.policy.workloadFatiguePerUnit * index)) };
    const activity = { sourceEventId: `actual-total-play-workload:${hash([scope.careerId, scope.gameId, scope.playId, playerId])}`,
      sourceVersion: 'actual-total-play-workload-v1', evidenceId: physicalEndReference.sourceId,
      careerId: scope.careerId, playerId, atDay: scope.gameDay, kind: 'MATCH', effortUnits: index };
    participants.push({ playerId, personId: `synthetic-person:${playerId}`, clubId: playerId.startsWith('away') ? 'synthetic-away' : 'synthetic-home',
      assessmentSourceId: sourceId, activity, before, after, applied: true });
  }
  const settlement = { ...scope, kind: 'complete', capturedAt: 'settlement_freeze', participants,
    // Placeholder identities of full durable snapshots; accepted-source JSON alone cannot reconstruct those snapshots.
    assessmentHashes: assessments.map(source => ({ sourceId: source.sourceId, hash: hash(['invented durable assessment snapshot', source.sourceId]) })) };
  const output = { ...clone(official.output), ...files.artifact, mainFilename: files.artifact.path,
    rowCounts: { ...clone(official.output.rowCounts), world_player_workload_activities: 10 }, workloadActivityKinds: [{ kind: 'MATCH', n: 10 }] };
  const recoveryDisk = { ...clone(output), path: `${files.artifact.path}.recovery.sqlite`, sha256: sha('a'),
    mainFilename: `${files.artifact.path}.recovery.sqlite`, rowCounts: { ...clone(output.rowCounts), world_player_workload_activities: 11 },
    workloadActivityKinds: [{ kind: 'MATCH', n: 10 }, { kind: 'RECOVERY', n: 1 }] };
  const staleDisk = { ...clone(official.output), path: `${files.artifact.path}.stale.sqlite`, sha256: sha('b'),
    mainFilename: `${files.artifact.path}.stale.sqlite`, rowCounts: { ...clone(official.output.rowCounts), world_player_workload_activities: 1 },
    workloadActivityKinds: [{ kind: 'TRAVEL', n: 1 }] };
  // Existing role receipt shape, as emitted by pipeline.mjs. No added domain flags.
  const roleReceipt = { schema: 'actual_artifact_stage_receipt_v1', status: 'passed', sourceIdentity,
    originalPhysicalArtifactSha256: official.originalPhysicalArtifactSha256, physicalEndSourceId: official.physicalEndSourceId,
    physicalProducerReference: producerReference, counts: clone(roleCounts), input: clone(official.output), output, settlement,
    faultEvidence: { assessmentAfterInsert: true, freezeAfterInsert: true, workloadAfterInsert: true,
      staleCurrentHeadRejected: true, interruptedAfterFirstInsert: true },
    acceptedInputManifest: { assessments, baselineEvidence, addedBaselines, retainedBaselinePlayerIds: ['p2'] },
    executed: { helperCalls: 1, participantSettlements: 10, newMatchWorkloadActivities: 10, newPhysicalPitchActions: 0 },
    syntheticFixtureInputs: true, automaticEffortGeneration: false, playableArtifactRecoveryActivities: 0,
    recoveryRegression: { path: recoveryDisk.path, sourceSha256: output.sha256, sha256: recoveryDisk.sha256,
      sourceUnchanged: true, scope: 'isolated_day_level_recovery_regression', elapsedWorldTimeProven: false,
      acceptedFixtureDurationHours: 1, disk: recoveryDisk }, staleCasRegression: { disk: staleDisk }, faultChecks: true };
  const sealed = { stage: '02-role-workload', ...files.receipt };
  // Proposed role-only terminal/handoff formats, not currently emitted by runtime.
  const stageTerminal = { status: 'stage_passed', executionScope: 'role', wholePipelinePassed: false, remainingStages: ['next'],
    inheritedStages: ['official'], inheritedStageReceipts, sourceIdentity, counts: clone(roleCounts), phaseReceipts: [sealed],
    openSqliteHandles: [], physicalSourceUnchanged: true, sourceCutUnchanged: true,
    resumableRole: { receipt: sealed, output, closureSourceId: scope.closureSourceId, applicationId: scope.closureApplicationId },
    scoringStillUnsupported: true, automaticEffortGeneration: false, recoveryOnlyOnIsolatedCopy: true,
    elapsedWorldRecoveryTimeProven: false, newPhysicalPitchActions: 0 };
  const supervisorTerminal = { status: 'stage_passed', executionScope: 'role', wholePipelinePassed: false, exitCode: 0, guard: null,
    executingProcessReceiptValid: true, sourceInputAndReceiptAudit: { passed: true, preservedPhaseReceipts: [sealed], inheritedStageReceipts },
    remainingOwnedProcesses: [], pipelineTerminalStatus: 'stage_passed', preservedPhaseReceipts: [files.receipt.path] };
  const roleHandoff = { schema: 'actual_role_stage_handoff_v1', status: 'stage_passed', wholePipelinePassed: false,
    remainingStages: ['next'], inheritedStages: ['official'], inheritedOfficial: clone(priorConfig.inheritedOfficial), inheritedStageReceipts,
    sourceIdentity, physicalProducerReference: producerReference, config: files.configuration, roleReceipt: sealed,
    stageTerminal: files.stageTerminal, supervisorTerminal: files.supervisorTerminal, output,
    closureSourceId: scope.closureSourceId, applicationId: scope.closureApplicationId };
  const outerTerminal = { kind: 'role', sourceCommit: sourceIdentity.sourceCommit, sourceManifestSha256: sourceIdentity.sourceManifestSha256,
    configSha256: files.configuration.sha256, supervisorExitCode: 0, outerGuard: null, passed: true, wholePipelinePassed: false,
    references: { 'process-terminal.json': files.supervisorTerminal, 'terminal.json': files.stageTerminal, 'role-handoff.json': files.handoff },
    error: null, remainingSupervisorGroup: [], remainingExecutionGroup: [], supervisorReaped: true };
  const currentSourceManifest = { ...clone(priorSourceManifest), sourceRoot: '/frozen/next', sourceCommit: 'f'.repeat(40), sourceTree: '1'.repeat(40),
    files: [...clone(priorSourceManifest.files), { path: 'src/ActualLiveNextActorArtifact.test-support.ts', sha256: sha('c') }] };
  const config = { ...clone(priorConfig), executionScope: 'next', sourceRoot: currentSourceManifest.sourceRoot,
    sourceCommit: currentSourceManifest.sourceCommit, sourceManifestPath: '/next/source-manifest.json', sourceManifestSha256: sha('d'),
    inheritedRole: { kind: 'checked_role_stage_v1', sourceRoot: sourceIdentity.sourceRoot, sourceCommit: sourceIdentity.sourceCommit,
      sourceManifestSha256: sourceIdentity.sourceManifestSha256, files,
      regressionArtifacts: { recovery: { path: recoveryDisk.path, sha256: recoveryDisk.sha256 },
        stale: { path: staleDisk.path, sha256: staleDisk.sha256 } } } };
  const observed = { hashes: Object.fromEntries(Object.entries(files).map(([key, value]) => [key, value.sha256])),
    outputWalBytes: 0, priorSourceFilesUnchanged: true,
    regressionHashes: { recovery: recoveryDisk.sha256, stale: staleDisk.sha256 }, regressionWalBytes: { recovery: 0, stale: 0 } };
  // Model separate decoded files: mutations cannot leak across receipt identities.
  return JSON.parse(JSON.stringify({ config, producerReference, officialEvidence, roleHandoff, roleReceipt, stageTerminal,
    supervisorTerminal, outerTerminal, priorConfig, priorSourceManifest, currentSourceManifest, observed }));
};
