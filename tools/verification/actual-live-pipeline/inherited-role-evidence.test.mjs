import assert from 'node:assert/strict';
import test from 'node:test';
import { assertInheritedRoleEvidence } from './inherited-role-evidence.mjs';
import { fixture } from './inherited-role-fixture.test-support.mjs';
import { clone } from './inherited-official-fixture.test-support.mjs';
const sha = character => character.repeat(64);
const negatives = [
  ['missing original official evidence', x => delete x.officialEvidence],
  ['unpassed original official evidence', x => x.officialEvidence.outerTerminal.passed = false],
  ['original official supervisor failed after its stage pass', x => x.officialEvidence.outerTerminal.supervisorExitCode = 1],
  ['changed original official handoff bytes', x => x.officialEvidence.observed.hashes.handoff = sha('0')],
  ['inherited official reference from another stage', x => x.stageTerminal.inheritedStageReceipts[0].stage = '02-role-workload'],
  ['missing inherited official reference', x => x.stageTerminal.inheritedStageReceipts = []],
  ['duplicate inherited official reference', x => x.stageTerminal.inheritedStageReceipts.push(clone(x.stageTerminal.inheritedStageReceipts[0]))],
  ['different original official binding in handoff', x => x.roleHandoff.inheritedOfficial.files.receipt.sha256 = sha('0')],
  ['different original official binding in current config', x => x.config.inheritedOfficial.files.receipt.sha256 = sha('0')],
  ['different original official binding in role config', x => x.priorConfig.inheritedOfficial.files.receipt.sha256 = sha('0')],
  ['official admission used a different role config', x => x.officialEvidence.config.sourceCommit = '0'.repeat(40)],
  ['official admission used a different role Source manifest', x => x.officialEvidence.currentSourceManifest.sourceTree = '0'.repeat(40)],
  ['outer attempt not passed', x => x.outerTerminal.passed = false],
  ['truthy outer pass', x => x.outerTerminal.passed = 1],
  ['actual supervisor exit nonzero despite passed inner terminal', x => x.outerTerminal.supervisorExitCode = 1],
  ['boolean actual supervisor exit', x => x.outerTerminal.supervisorExitCode = false],
  ['outer guard termination', x => x.outerTerminal.outerGuard = 'wall'],
  ['handoff-write failure after terminal', x => x.outerTerminal.error = 'role-handoff.json write failed'],
  ['supervisor not reaped', x => x.outerTerminal.supervisorReaped = false],
  ['remaining supervisor process', x => x.outerTerminal.remainingSupervisorGroup = [13]],
  ['remaining execution process', x => x.outerTerminal.remainingExecutionGroup = [14]],
  ['wrong outer execution scope', x => x.outerTerminal.kind = 'official'],
  ['whole-pipeline claim in outer receipt', x => x.outerTerminal.wholePipelinePassed = true],
  ['outer config hash mismatch', x => x.outerTerminal.configSha256 = sha('0')],
  ['outer Source commit mismatch', x => x.outerTerminal.sourceCommit = '0'.repeat(40)],
  ['outer Source manifest mismatch', x => x.outerTerminal.sourceManifestSha256 = sha('0')],
  ['missing post-terminal role handoff reference', x => delete x.outerTerminal.references['role-handoff.json']],
  ['post-terminal handoff hash differs', x => x.outerTerminal.references['role-handoff.json'].sha256 = sha('0')],
  ['post-terminal handoff path differs', x => x.outerTerminal.references['role-handoff.json'].path = '/wrong/role-handoff.json'],
  ['outer stage terminal differs', x => x.outerTerminal.references['terminal.json'].sha256 = sha('0')],
  ['outer supervisor terminal differs', x => x.outerTerminal.references['process-terminal.json'].sha256 = sha('0')],
  ['failed supervisor status', x => x.supervisorTerminal.status = 'failed'],
  ['supervisor scope differs', x => x.supervisorTerminal.executionScope = 'next'],
  ['whole-pipeline claim in supervisor', x => x.supervisorTerminal.wholePipelinePassed = true],
  ['supervisor child nonzero exit', x => x.supervisorTerminal.exitCode = 1],
  ['supervisor guard fired', x => x.supervisorTerminal.guard = { reason: 'rss' }],
  ['missing actual execution-process receipt', x => x.supervisorTerminal.executingProcessReceiptValid = false],
  ['supervisor source/input audit failed', x => x.supervisorTerminal.sourceInputAndReceiptAudit.passed = false],
  ['supervisor audited a different role receipt', x => x.supervisorTerminal.sourceInputAndReceiptAudit.preservedPhaseReceipts[0].sha256 = sha('0')],
  ['supervisor did not audit inherited official proof', x => x.supervisorTerminal.sourceInputAndReceiptAudit.inheritedStageReceipts = []],
  ['supervisor preserved extra current-run stage', x => x.supervisorTerminal.preservedPhaseReceipts.push('/role/03-next-actor-pitch.receipt.json')],
  ['supervisor saw a failed pipeline terminal', x => x.supervisorTerminal.pipelineTerminalStatus = 'failed'],
  ['supervisor has a surviving worker', x => x.supervisorTerminal.remainingOwnedProcesses = [15]],
  ['unexpected role handoff schema', x => x.roleHandoff.schema = 'publication_projection'],
  ['unpassed role handoff', x => x.roleHandoff.status = 'pending'],
  ['whole-pipeline claim in role handoff', x => x.roleHandoff.wholePipelinePassed = true],
  ['next stage already claimed complete', x => x.roleHandoff.remainingStages = []],
  ['role listed as inherited before its own execution', x => x.roleHandoff.inheritedStages = ['official', 'role']],
  ['handoff omitted inherited reference', x => x.roleHandoff.inheritedStageReceipts = []],
  ['handoff role receipt differs', x => x.roleHandoff.roleReceipt.sha256 = sha('0')],
  ['handoff configuration differs', x => x.roleHandoff.config.sha256 = sha('0')],
  ['handoff stage terminal differs', x => x.roleHandoff.stageTerminal.sha256 = sha('0')],
  ['handoff supervisor terminal differs', x => x.roleHandoff.supervisorTerminal.sha256 = sha('0')],
  ['handoff closure differs', x => x.roleHandoff.closureSourceId = 'other-closure'],
  ['handoff application differs', x => x.roleHandoff.applicationId = 'other-application'],
  ['handoff producer differs', x => x.roleHandoff.physicalProducerReference.outputSha256 = sha('0')],
  ['receipt producer differs', x => x.roleReceipt.physicalProducerReference.terminalSha256 = sha('0')],
  ['receipt original physical hash differs', x => x.roleReceipt.originalPhysicalArtifactSha256 = sha('0')],
  ['receipt original physical Source ID differs', x => x.roleReceipt.physicalEndSourceId = 'other-physical-end'],
  ['current config original physical hash differs', x => x.config.physicalArtifactSha256 = sha('0')],
  ['role config original physical hash differs', x => x.priorConfig.physicalArtifactSha256 = sha('0')],
  ['unpassed role receipt', x => x.roleReceipt.status = 'pending'],
  ['unexpected role receipt schema', x => x.roleReceipt.schema = 'published_receipt'],
  ['role helper never ran', x => x.roleReceipt.executed.helperCalls = 0],
  ['role helper repeated', x => x.roleReceipt.executed.helperCalls = 2],
  ['role settled fewer than ten', x => x.roleReceipt.executed.participantSettlements = 9],
  ['role recorded fewer than ten new MATCH activities', x => x.roleReceipt.executed.newMatchWorkloadActivities = 9],
  ['new pitch hidden in role execution', x => x.roleReceipt.executed.newPhysicalPitchActions = 1],
  ['fault checks omitted', x => delete x.roleReceipt.faultChecks],
  ['truthy fault-check flag', x => x.roleReceipt.faultChecks = 1],
  ['incomplete settlement', x => x.roleReceipt.settlement.kind = 'applying'],
  ['play-start relabeling of settlement BEFORE', x => x.roleReceipt.settlement.capturedAt = 'play_start'],
  ['different settlement closure', x => x.roleReceipt.settlement.closureSourceId = 'other-closure'],
  ['different settlement application', x => x.roleReceipt.settlement.closureApplicationId = 'other-application'],
  ['different settlement physical reference', x => x.roleReceipt.settlement.physicalEndReference.snapshotHash = sha('0')],
  ['different settlement whole-history reference', x => x.roleReceipt.settlement.wholeHistoryReference.hash = sha('0')],
  ['missing tenth participant', x => x.roleReceipt.settlement.participants.pop()],
  ['duplicated participant identity', x => x.roleReceipt.settlement.participants[1].playerId = x.roleReceipt.settlement.participants[0].playerId],
  ['duplicated Person identity', x => x.roleReceipt.settlement.participants[1].personId = x.roleReceipt.settlement.participants[0].personId],
  ['missing Club identity', x => delete x.roleReceipt.settlement.participants[0].clubId],
  ['unapplied participant', x => x.roleReceipt.settlement.participants[9].applied = false],
  ['truthy applied flag', x => x.roleReceipt.settlement.participants[9].applied = 1],
  ['participant AFTER revision did not advance', x => x.roleReceipt.settlement.participants[0].after.revision = 0],
  ['participant AFTER revision advanced twice', x => x.roleReceipt.settlement.participants[0].after.revision = 2],
  ['participant AFTER belongs to another player', x => x.roleReceipt.settlement.participants[0].after.playerId = 'other-player'],
  ['accepted zero effort is missing', x => delete x.roleReceipt.acceptedInputManifest.assessments[0].effortUnits],
  ['wrong explicit effort vector', x => x.roleReceipt.acceptedInputManifest.assessments[9].effortUnits = 10],
  ['missing assessment', x => x.roleReceipt.acceptedInputManifest.assessments.pop()],
  ['duplicate assessment Source', x => x.roleReceipt.acceptedInputManifest.assessments[1].sourceId = x.roleReceipt.acceptedInputManifest.assessments[0].sourceId],
  ['assessment participant differs', x => x.roleReceipt.acceptedInputManifest.assessments[1].participantReference.playerId = 'other-player'],
  ['assessment whole-history differs', x => x.roleReceipt.acceptedInputManifest.assessments[0].wholeHistoryReference.hash = sha('0')],
  ['assessment physical reference differs', x => x.roleReceipt.acceptedInputManifest.assessments[0].physicalEndReference.sourceHash = sha('0')],
  ['assessment version omitted', x => delete x.roleReceipt.acceptedInputManifest.assessments[0].sourceVersion],
  ['assessment provenance omitted', x => delete x.roleReceipt.acceptedInputManifest.assessments[0].provenance],
  ['participant refers to another assessment', x => x.roleReceipt.settlement.participants[0].assessmentSourceId = 'other-assessment'],
  ['non-MATCH participant activity', x => x.roleReceipt.settlement.participants[0].activity.kind = 'RECOVERY'],
  ['activity effort differs from assessment', x => x.roleReceipt.settlement.participants[1].activity.effortUnits = 5],
  ['activity refers to another player', x => x.roleReceipt.settlement.participants[0].activity.playerId = 'other-player'],
  ['missing baseline evidence', x => x.roleReceipt.acceptedInputManifest.baselineEvidence.pop()],
  ['duplicate baseline participant', x => x.roleReceipt.acceptedInputManifest.baselineEvidence[1].source.playerId = x.roleReceipt.acceptedInputManifest.baselineEvidence[0].source.playerId],
  ['baseline source hash differs', x => x.roleReceipt.acceptedInputManifest.baselineEvidence[0].sourceHash = sha('0')],
  ['retained baseline policy replaced in frozen BEFORE', x => x.roleReceipt.settlement.participants[9].before.policy.workloadFatiguePerUnit = 0.01],
  ['baseline policy changed in frozen AFTER', x => x.roleReceipt.settlement.participants[9].after.policy.recoveryPerHour = 0.1],
  ['accepted zero changes fatigue', x => x.roleReceipt.settlement.participants[0].after.fatigue += 0.1],
  ['missing retained baseline identity', x => x.roleReceipt.acceptedInputManifest.retainedBaselinePlayerIds = []],
  ['added baseline also counted as retained', x => x.roleReceipt.acceptedInputManifest.retainedBaselinePlayerIds.push('home-1')],
  ['added fixture baseline policy differs', x => x.roleReceipt.acceptedInputManifest.addedBaselines[0].policy.workloadFatiguePerUnit = 0.02],
  ['automatic effort generation claimed', x => x.roleReceipt.automaticEffortGeneration = true],
  ['synthetic fixture nature omitted', x => delete x.roleReceipt.syntheticFixtureInputs],
  ['role input not the closed official output', x => x.roleReceipt.input.sha256 = sha('0')],
  ['role input path not the closed official output', x => x.roleReceipt.input.path = '/wrong/01-official.sqlite'],
  ['role output does not match pinned next input', x => x.roleReceipt.output.sha256 = sha('0')],
  ['handoff output path differs from next input', x => x.roleHandoff.output.path = '/wrong/02-role-workload.sqlite'],
  ['role output main filename differs', x => x.roleReceipt.output.mainFilename = '/wrong/02-role-workload.sqlite'],
  ['role output is not real disk', x => x.roleReceipt.output.realDisk = false],
  ['role output journal mode differs', x => x.roleReceipt.output.journalMode = 'delete'],
  ['role output not checked after closing wrapper reader', x => x.roleReceipt.output.wrapperReadOnlyOpenClosedVerified = false],
  ['role output contains nine workload activities', x => x.roleReceipt.output.rowCounts.world_player_workload_activities = 9],
  ['role output contains another official application', x => x.roleReceipt.output.rowCounts.applications += 1],
  ['role output contains another physical pitch', x => x.roleReceipt.output.rowCounts.physical_pitch_progress_actions += 1],
  ['role output activity kinds include recovery', x => x.roleReceipt.output.workloadActivityKinds = [{ kind: 'MATCH', n: 9 }, { kind: 'RECOVERY', n: 1 }]],
  ['playable output charged recovery', x => x.roleReceipt.playableArtifactRecoveryActivities = 1],
  ['recovery overwrote the playable artifact', x => x.roleReceipt.recoveryRegression.path = x.roleReceipt.output.path],
  ['stale-CAS probe overwrote the playable artifact', x => x.roleReceipt.staleCasRegression.disk.path = x.roleReceipt.output.path],
  ['recovery source changed', x => x.roleReceipt.recoveryRegression.sourceUnchanged = false],
  ['recovery source hash differs', x => x.roleReceipt.recoveryRegression.sourceSha256 = sha('0')],
  ['recovery duration unaccepted', x => delete x.roleReceipt.recoveryRegression.acceptedFixtureDurationHours],
  ['recovery claims elapsed World time', x => x.roleReceipt.recoveryRegression.elapsedWorldTimeProven = true],
  ['recovery probe hash changed', x => x.observed.regressionHashes.recovery = sha('0')],
  ['stale-CAS probe hash changed', x => x.observed.regressionHashes.stale = sha('0')],
  ['stage terminal claims complete pipeline', x => x.stageTerminal.wholePipelinePassed = true],
  ['stage terminal full-pass status', x => x.stageTerminal.status = 'passed'],
  ['stage terminal reports another scope', x => x.stageTerminal.executionScope = 'all'],
  ['stage terminal omits inherited stage', x => x.stageTerminal.inheritedStages = []],
  ['stage terminal claims no remaining next', x => x.stageTerminal.remainingStages = []],
  ['stage terminal has no new role receipt', x => x.stageTerminal.phaseReceipts = []],
  ['stage terminal relabels inherited official as new receipt', x => x.stageTerminal.phaseReceipts.unshift(clone(x.stageTerminal.inheritedStageReceipts[0]))],
  ['stage terminal receipt differs', x => x.stageTerminal.phaseReceipts[0].sha256 = sha('0')],
  ['stage terminal resumes another output', x => x.stageTerminal.resumableRole.output.sha256 = sha('0')],
  ['stage terminal has open artifact handles', x => x.stageTerminal.openSqliteHandles = [{ fd: 8 }]],
  ['physical bytes changed during role', x => x.stageTerminal.physicalSourceUnchanged = false],
  ['Source bytes changed during role', x => x.stageTerminal.sourceCutUnchanged = false],
  ['stage terminal claims a new pitch', x => x.stageTerminal.newPhysicalPitchActions = 1],
  ['unknown inherited-role binding kind', x => x.config.inheritedRole.kind = 'watcher_role_summary'],
  ['current scope is not next', x => x.config.executionScope = 'role'],
  ['original role config has wrong scope', x => x.priorConfig.executionScope = 'all'],
  ['original role config disabled faults', x => x.priorConfig.faultChecks = false],
  ['current config disabled actual next pitch', x => x.config.executeNextPitch = false],
  ['original role Source files changed', x => x.observed.priorSourceFilesUnchanged = false],
  ['role manifest Source identity differs', x => x.priorSourceManifest.sourceCommit = '0'.repeat(40)],
  ['current manifest Source identity differs', x => x.currentSourceManifest.sourceCommit = '0'.repeat(40)],
  ['role manifest duplicate path', x => x.priorSourceManifest.files.push(clone(x.priorSourceManifest.files[0]))],
  ['current manifest duplicate path', x => x.currentSourceManifest.files.push(clone(x.currentSourceManifest.files[0]))],
  ['production owner changed between role and next', x => x.currentSourceManifest.files[0].sha256 = sha('0')],
  ['production owner removed before next', x => x.currentSourceManifest.files.shift()],
  ['production owner added before next', x => x.currentSourceManifest.files.push({ path: 'src/new-owner.ts', sha256: sha('0') })],
  ['colliding pinned file paths', x => x.config.inheritedRole.files.outerTerminal.path = x.config.inheritedRole.files.handoff.path],
  ['noncanonical pinned file path', x => x.config.inheritedRole.files.receipt.path = '/role/../role/02-role-workload.receipt.json'],
  ['relative pinned file path', x => x.config.inheritedRole.files.receipt.path = '02-role-workload.receipt.json'],
  ['missing explicit regression artifact bindings', x => delete x.config.inheritedRole.regressionArtifacts],
  ['colliding regression artifact paths', x => x.config.inheritedRole.regressionArtifacts.stale.path = x.config.inheritedRole.regressionArtifacts.recovery.path],
  ['unexpected extra regression binding', x => x.config.inheritedRole.regressionArtifacts.other = clone(x.config.inheritedRole.regressionArtifacts.recovery)],
];

test('accepts a pinned role output while retaining one independently admitted official proof', () => {
  assert.doesNotThrow(() => assertInheritedRoleEvidence(fixture()));
});
for (const target of ['output', 'recovery', 'stale']) {
  test(`accepts explicit absent ${target} WAL`, () => {
    const value = fixture();
    if (target === 'output') value.observed.outputWalBytes = null;
    else value.observed.regressionWalBytes[target] = null;
    assert.doesNotThrow(() => assertInheritedRoleEvidence(value));
  });
}
for (const [name, mutate] of negatives) test(`rejects ${name}`, () => {
  const value = fixture(); mutate(value); assert.throws(() => assertInheritedRoleEvidence(value));
});
for (const key of ['handoff', 'outerTerminal', 'stageTerminal', 'supervisorTerminal', 'receipt', 'configuration', 'sourceManifest', 'artifact']) {
  test(`rejects missing ${key} pin`, () => {
    const value = fixture(); delete value.config.inheritedRole.files[key]; assert.throws(() => assertInheritedRoleEvidence(value));
  });
  test(`rejects unread or changed ${key} bytes`, () => {
    const value = fixture(); delete value.observed.hashes[key]; assert.throws(() => assertInheritedRoleEvidence(value));
  });
}
for (const key of ['assessmentAfterInsert', 'freezeAfterInsert', 'workloadAfterInsert', 'staleCurrentHeadRejected', 'interruptedAfterFirstInsert']) {
  for (const invalid of [false, 1, null]) test(`rejects ${key} evidence ${JSON.stringify(invalid)}`, () => {
    const value = fixture(); value.roleReceipt.faultEvidence[key] = invalid; assert.throws(() => assertInheritedRoleEvidence(value));
  });
}
for (const key of ['recovery', 'stale']) {
  for (const mutation of ['missing', 'hash', 'relative', 'noncanonical', 'primary-collision']) test(`rejects ${key} regression binding ${mutation}`, () => {
    const value = fixture(), pins = value.config.inheritedRole.regressionArtifacts;
    if (mutation === 'missing') delete pins[key];
    if (mutation === 'hash') pins[key].sha256 = sha('0');
    if (mutation === 'relative') pins[key].path = `${key}.sqlite`;
    if (mutation === 'noncanonical') pins[key].path = `/role/../${key}.sqlite`;
    if (mutation === 'primary-collision') pins[key].path = value.config.inheritedRole.files.artifact.path;
    assert.throws(() => assertInheritedRoleEvidence(value));
  });
}
for (const record of ['roleReceipt', 'stageTerminal']) {
  for (const key of ['officialStarted', 'officialCompleted', 'roleStarted', 'roleCompleted', 'nextStarted', 'nextCompleted']) {
    test(`rejects ${record} inherited/new count mismatch in ${key}`, () => {
      const value = fixture(); value[record].counts[key] += 1; assert.throws(() => assertInheritedRoleEvidence(value));
    });
  }
  for (const mutation of ['extra', 'missing', 'boolean', 'string']) test(`rejects ${record} ${mutation} count`, () => {
    const value = fixture(), counts = value[record].counts;
    if (mutation === 'extra') counts.unexecuted = 0;
    if (mutation === 'missing') delete counts.officialStarted;
    if (mutation === 'boolean') counts.officialStarted = false;
    if (mutation === 'string') counts.roleStarted = '1';
    assert.throws(() => assertInheritedRoleEvidence(value));
  });
}
for (const target of ['output', 'recovery', 'stale']) {
  for (const invalid of [undefined, false, '0', -1, 1]) test(`rejects ${target} WAL metadata ${String(invalid)}`, () => {
    const value = fixture();
    if (target === 'output') value.observed.outputWalBytes = invalid;
    else value.observed.regressionWalBytes[target] = invalid;
    assert.throws(() => assertInheritedRoleEvidence(value));
  });
}
for (const record of ['outerTerminal', 'supervisorTerminal', 'stageTerminal', 'roleReceipt', 'roleHandoff']) {
  test(`rejects publication projection substituted for ${record}`, () => {
    const value = fixture(); value[record].publicationProjection = true; assert.throws(() => assertInheritedRoleEvidence(value));
  });
}

const assessmentReferenceCases = [
  ['missing durable assessment reference array', x => delete x.roleReceipt.settlement.assessmentHashes],
  ['missing tenth durable assessment reference', x => x.roleReceipt.settlement.assessmentHashes.pop()],
  ['duplicate durable assessment Source ID', x => x.roleReceipt.settlement.assessmentHashes[1].sourceId = x.roleReceipt.settlement.assessmentHashes[0].sourceId],
  ['unknown durable assessment Source ID', x => x.roleReceipt.settlement.assessmentHashes[0].sourceId = 'unaccepted-assessment'],
  ['malformed durable assessment digest', x => x.roleReceipt.settlement.assessmentHashes[0].hash = 'bad'],
  ['missing durable assessment digest', x => delete x.roleReceipt.settlement.assessmentHashes[0].hash],
  ['unordered durable assessment references', x => x.roleReceipt.settlement.assessmentHashes.reverse()],
  ['nonstring durable assessment digest', x => x.roleReceipt.settlement.assessmentHashes[0].hash = true],
  ['duplicate durable assessment snapshot identity', x => x.roleReceipt.settlement.assessmentHashes[1].hash = x.roleReceipt.settlement.assessmentHashes[0].hash],
];
for (const [name, mutate] of assessmentReferenceCases) test(`rejects ${name}`, () => {
  const value = fixture(); mutate(value); assert.throws(() => assertInheritedRoleEvidence(value));
});
