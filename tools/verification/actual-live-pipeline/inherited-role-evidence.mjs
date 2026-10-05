import { createHash } from 'node:crypto';
import { posix } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { assertInheritedOfficialEvidence, assertOriginalOfficialStageProvenance, assertInheritedSourceContinuity } from './inherited-official-evidence.mjs';
import { assertOfficialReadReplayEvidence } from './official-read-replay-evidence.mjs';

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const id = value => typeof value === 'string' && value.length > 0 && value === value.trim();
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const commit = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const day = value => Number.isSafeInteger(value) && value >= 0;
const nonnegative = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const unit = value => nonnegative(value) && value <= 1;
const absolute = value => id(value) && posix.isAbsolute(value) && posix.normalize(value) === value && value !== '/'
  && !value.includes('\\') && !value.includes('\0') && value.split('/').slice(1).every(part => part && part !== '.' && part !== '..');
const check = (condition, field) => { if (!condition) throw new Error(`inherited role: ${field}`); };
const same = (actual, expected, field) => check(isDeepStrictEqual(actual, expected), field);
const keys = (value, expected, field) => { check(record(value), field); same(Object.keys(value).sort(), [...expected].sort(), field); };
const raw = (value, field) => check(record(value) && !['publicationProjection', 'originalRawReceiptSha256']
  .some(key => Object.hasOwn(value, key)), `${field} raw evidence`);
const pin = (value, field) => check(record(value) && absolute(value.path) && hash(value.sha256), field);
const boundPin = (value, expected, field) => { pin(value, field); same(value.path, expected.path, `${field} path`); same(value.sha256, expected.sha256, `${field} hash`); };
const canonical = value => JSON.stringify(value, (_key, item) => record(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
const digest = value => createHash('sha256').update(canonical(value)).digest('hex');
const sorted = values => [...values].sort();
const ten = (value, field) => check(Array.isArray(value) && value.length === 10, field);
const distinct = (values, field) => check(values.every(id) && new Set(values).size === values.length, field);
const FILES = ['handoff', 'outerTerminal', 'stageTerminal', 'supervisorTerminal', 'receipt', 'configuration', 'sourceManifest', 'artifact'];
const REGRESSIONS = ['recovery', 'stale'];
const COUNTS = { officialStarted: 0, officialCompleted: 0, roleStarted: 1, roleCompleted: 1, nextStarted: 0, nextCompleted: 0 };
const FIXTURE_POLICY = { policyId: 'explicit-role-workload-fixture', version: 'fixture-v1', availableAtDay: 0,
  workloadFatiguePerUnit: 0.01, travelFatiguePerKm: 0.001, recoveryPerHour: 0.1 };

const disk = (value, expected, original, activities, kinds, field) => {
  boundPin(value, expected, field);
  check(value.realDisk === true && value.mainFilename === value.path && value.journalMode === 'wal'
    && value.wrapperReadOnlyOpenClosedVerified === true && record(value.rowCounts), `${field} closed database`);
  check(Object.values(value.rowCounts).every(day), `${field} row counts`);
  for (const name of ['applications', 'physical_pitch_progress_actions', 'actual_first_base_play_ends', 'actual_live_play_fences'])
    same(value.rowCounts[name], original.rowCounts[name], `${field} original ${name}`);
  same(value.rowCounts.world_player_workload_activities, activities, `${field} workload activity count`);
  same(value.workloadActivityKinds, kinds, `${field} workload kinds`);
};

const settlementEvidence = (receipt, official) => {
  const settlement = receipt.settlement, inputs = receipt.acceptedInputManifest;
  check(record(settlement) && settlement.kind === 'complete' && settlement.capturedAt === 'settlement_freeze'
    && id(settlement.careerId) && id(settlement.gameId) && day(settlement.playId) && day(settlement.gameDay)
    && hash(settlement.closureProposalHash), 'complete frozen settlement');
  same(settlement.closureSourceId, official.closureSourceId, 'settlement closure');
  same(settlement.closureApplicationId, official.applicationId, 'settlement application');
  same(settlement.physicalEndReference, official.adjudicationEvidence.physicalEndReference, 'settlement physical reference');
  same(settlement.wholeHistoryReference, official.adjudicationEvidence.wholeHistoryReference, 'settlement whole-history reference');
  ten(settlement.participants, 'ten settlement participants');
  check(settlement.participants.every(record), 'participant records');
  const players = settlement.participants.map(value => value.playerId);
  distinct(players, 'distinct Player identities');
  same(players, sorted(players), 'sorted original Player identities');
  distinct(settlement.participants.map(value => value.personId), 'distinct Person identities');
  check(settlement.participants.every(value => id(value.clubId) && value.applied === true), 'Club identities and applied effects');
  check(record(inputs), 'accepted input manifest');
  ten(inputs.assessments, 'ten accepted assessments');
  ten(inputs.baselineEvidence, 'ten baseline sources');
  check(inputs.assessments.every(record) && inputs.baselineEvidence.every(record), 'accepted input records');
  distinct(inputs.assessments.map(value => value.sourceId), 'assessment Source identities');
  const baselineIds = [], baselineLinks = [];

  for (let index = 0; index < players.length; index++) {
    const playerId = players[index], participant = settlement.participants[index], assessment = inputs.assessments[index];
    keys(assessment, ['sourceId', 'sourceVersion', 'closureSourceId', 'physicalEndReference', 'wholeHistoryReference',
      'participantReference', 'effortUnits', 'provenance'], 'assessment fields');
    check(assessment.sourceId === `fixture-total-effort:${playerId}` && assessment.sourceVersion === 'fixture-v1'
      && assessment.effortUnits === index, 'explicit assessment fixture input');
    same(assessment.closureSourceId, settlement.closureSourceId, 'assessment closure');
    same(assessment.physicalEndReference, settlement.physicalEndReference, 'assessment physical reference');
    same(assessment.wholeHistoryReference, settlement.wholeHistoryReference, 'assessment whole-history reference');
    keys(assessment.participantReference, ['playerId', 'bindingHash', 'personHash'], 'assessment participant reference');
    check(assessment.participantReference.playerId === playerId && hash(assessment.participantReference.bindingHash)
      && hash(assessment.participantReference.personHash), 'assessment original participant');
    same(assessment.provenance, { assessmentSourceId: `explicit-fixture-assessment:${playerId}`, assessmentVersion: 'fixture-v1',
      calibrationSourceId: 'explicit-fixture-total-effort', calibrationVersion: 'fixture-v1' }, 'accepted assessment provenance');
    same(participant.assessmentSourceId, assessment.sourceId, 'participant assessment');
    same(participant.activity, { sourceEventId: `actual-total-play-workload:${digest([settlement.careerId, settlement.gameId, settlement.playId, playerId])}`,
      sourceVersion: 'actual-total-play-workload-v1', evidenceId: settlement.physicalEndReference.sourceId,
      careerId: settlement.careerId, playerId, atDay: settlement.gameDay, kind: 'MATCH', effortUnits: assessment.effortUnits }, 'canonical MATCH activity');

    const evidence = inputs.baselineEvidence[index], baseline = evidence.source;
    keys(baseline, ['sourceId', 'sourceVersion', 'personLinkSourceId', 'careerId', 'playerId', 'createdAtDay', 'fatigue', 'recoveryCapacity', 'policy'], 'baseline source fields');
    check(id(baseline.sourceId) && id(baseline.sourceVersion) && id(baseline.personLinkSourceId) && baseline.playerId === playerId
      && baseline.careerId === settlement.careerId && day(baseline.createdAtDay) && baseline.createdAtDay <= settlement.gameDay
      && unit(baseline.fatigue) && unit(baseline.recoveryCapacity), 'original baseline scope');
    check(hash(evidence.sourceHash) && evidence.sourceHash === digest(baseline), 'baseline Source hash');
    const policy = baseline.policy;
    keys(policy, ['policyId', 'version', 'availableAtDay', 'workloadFatiguePerUnit', 'travelFatiguePerKm', 'recoveryPerHour'], 'baseline policy fields');
    check(id(policy.policyId) && id(policy.version) && day(policy.availableAtDay) && policy.availableAtDay <= baseline.createdAtDay
      && [policy.workloadFatiguePerUnit, policy.travelFatiguePerKm, policy.recoveryPerHour].every(nonnegative), 'accepted baseline policy');
    baselineIds.push(baseline.sourceId); baselineLinks.push(baseline.personLinkSourceId);
    const { sourceId: _sourceId, sourceVersion: _sourceVersion, personLinkSourceId: _personLink, ...baselineState } = baseline;
    // This bounded original input has zero preceding workload activities. Its
    // settlement-time BEFORE is the accepted baseline, including retained rates.
    const before = { ...baselineState, modelVersion: 'player-workload-recovery-v1', effectiveDay: baseline.createdAtDay, revision: 0 };
    same(participant.before, before, 'frozen baseline BEFORE');
    const fatigue = before.fatigue + policy.workloadFatiguePerUnit * assessment.effortUnits;
    check(Number.isFinite(fatigue), 'MATCH fatigue arithmetic');
    same(participant.after, { ...before, effectiveDay: settlement.gameDay, revision: before.revision + 1,
      fatigue: Math.max(0, Math.min(1, fatigue)) }, 'frozen MATCH AFTER');
  }
  distinct(baselineIds, 'baseline Source identities');
  distinct(baselineLinks, 'baseline Person-link identities');

  check(Array.isArray(inputs.addedBaselines) && Array.isArray(inputs.retainedBaselinePlayerIds), 'added and retained baselines');
  check(inputs.addedBaselines.every(record), 'added baseline records');
  const addedPlayers = inputs.addedBaselines.map(value => value.playerId);
  distinct(addedPlayers, 'added baseline Players');
  distinct(inputs.retainedBaselinePlayerIds, 'retained baseline Players');
  same(addedPlayers, players.filter(player => addedPlayers.includes(player)), 'ordered added baseline membership');
  same(inputs.retainedBaselinePlayerIds, players.filter(player => !addedPlayers.includes(player)), 'exact retained baseline complement');
  for (const baseline of inputs.addedBaselines) {
    const original = inputs.baselineEvidence.find(value => value.source.playerId === baseline.playerId)?.source;
    same(baseline, original, 'added baseline accepted source');
    check(baseline.sourceId === `fixture-role-baseline:${baseline.playerId}` && baseline.sourceVersion === 'fixture-v1'
      && baseline.createdAtDay === settlement.gameDay && baseline.fatigue === 0.1 && baseline.recoveryCapacity === 0.5, 'added fixture baseline');
    same(baseline.policy, FIXTURE_POLICY, 'added fixture calibration');
  }

  // These digests identify full durable snapshots, including actor evidence.
  // Rehashing only the accepted assessment source would authenticate less data.
  ten(settlement.assessmentHashes, 'ten durable assessment references');
  check(settlement.assessmentHashes.every(value => record(value) && id(value.sourceId) && hash(value.hash)), 'durable assessment reference shape');
  const assessmentIds = settlement.assessmentHashes.map(value => value.sourceId);
  distinct(assessmentIds, 'distinct durable assessment Source IDs');
  same(assessmentIds, sorted(inputs.assessments.map(value => value.sourceId)), 'sorted accepted durable assessment census');
  check(new Set(settlement.assessmentHashes.map(value => value.hash)).size === 10, 'distinct durable assessment snapshots');
};

/** Pure JSON admission, with no domain imports or SQLite access. The previously
 * completed official proof is authenticated as inherited evidence, never rerun. */
const assertRoleEvidence = (bundle, assertOfficialEvidence) => {
  check(record(bundle), 'bundle');
  const { config, producerReference, officialEvidence, roleHandoff: handoff, roleReceipt: receipt, stageTerminal: stage,
    supervisorTerminal: supervisor, outerTerminal: outer, priorConfig, priorSourceManifest, observed } = bundle;
  check(record(config) && record(observed), 'next continuation configuration');
  const inherited = config.inheritedRole;
  check(record(inherited) && inherited.kind === 'checked_role_stage_v1' && absolute(inherited.sourceRoot)
    && commit(inherited.sourceCommit) && hash(inherited.sourceManifestSha256), 'inherited role binding');
  const files = inherited.files, regressions = inherited.regressionArtifacts;
  keys(files, FILES, 'file roles'); keys(observed.hashes, FILES, 'observed file roles');
  keys(regressions, REGRESSIONS, 'regression roles');
  keys(observed.regressionHashes, REGRESSIONS, 'observed regression hashes');
  keys(observed.regressionWalBytes, REGRESSIONS, 'observed regression WALs');
  for (const name of FILES) {
    pin(files[name], `${name} pin`);
    same(observed.hashes[name], files[name].sha256, `${name} observed hash`);
  }
  for (const name of REGRESSIONS) {
    pin(regressions[name], `${name} pin`);
    same(observed.regressionHashes[name], regressions[name].sha256, `${name} observed hash`);
    check(observed.regressionWalBytes[name] === null || observed.regressionWalBytes[name] === 0, `${name} WAL observation`);
  }
  const paths = [...Object.values(files), ...Object.values(regressions)].map(value => value.path);
  check(new Set(paths).size === paths.length, 'distinct pinned paths');
  check(observed.outputWalBytes === null || observed.outputWalBytes === 0, 'output WAL observation');
  check(observed.priorSourceFilesUnchanged === true, 'prior Source bytes');
  same(inherited.sourceManifestSha256, files.sourceManifest.sha256, 'Source manifest pin');

  for (const [name, value] of Object.entries({ handoff, receipt, stage, supervisor, outer, priorConfig })) raw(value, name);
  check(priorConfig.schema === 'actual_artifact_pipeline_run_v2' && priorConfig.executionScope === 'role'
    && priorConfig.faultChecks === true && priorConfig.executeNextPitch === true, 'original role configuration');
  assertOfficialEvidence(officialEvidence);
  same(officialEvidence.config, priorConfig, 'official admission role configuration');
  same(officialEvidence.currentSourceManifest, priorSourceManifest, 'official admission role Source manifest');
  same(officialEvidence.producerReference, producerReference, 'independently admitted producer');
  same(config.inheritedOfficial, priorConfig.inheritedOfficial, 'current inherited official binding');
  same(handoff.inheritedOfficial, priorConfig.inheritedOfficial, 'handoff inherited official binding');
  const official = officialEvidence.officialReceipt;
  const inheritedReceipts = [{ stage: '01-official', path: priorConfig.inheritedOfficial.files.receipt.path,
    sha256: priorConfig.inheritedOfficial.files.receipt.sha256 }];
  same(stage.inheritedStageReceipts, inheritedReceipts, 'stage inherited official receipt');
  same(handoff.inheritedStageReceipts, inheritedReceipts, 'handoff inherited official receipt');

  const identity = receipt.sourceIdentity;
  check(record(identity), 'role Source identity');
  for (const field of ['sourceRoot', 'sourceCommit', 'sourceManifestSha256']) {
    same(identity[field], inherited[field], `role Source ${field}`);
    same(priorConfig[field], inherited[field], `original role configuration ${field}`);
  }
  for (const field of ['sourceRoot', 'sourceCommit', 'sourceTree']) same(priorSourceManifest[field], identity[field], `role manifest ${field}`);
  same(priorConfig.sourceManifestPath, files.sourceManifest.path, 'role manifest path');
  same(handoff.sourceIdentity, identity, 'handoff Source identity');
  same(stage.sourceIdentity, identity, 'stage Source identity');
  same(receipt.physicalProducerReference, producerReference, 'receipt producer reference');
  same(handoff.physicalProducerReference, producerReference, 'handoff producer reference');
  for (const field of ['physicalArtifactPath', 'physicalArtifactSha256', 'physicalEvidencePath', 'physicalEvidenceSha256', 'physicalEndSourceId', 'physicalProducer'])
    same(config[field], priorConfig[field], `original physical ${field}`);
  same(receipt.originalPhysicalArtifactSha256, official.originalPhysicalArtifactSha256, 'role original physical hash');
  same(receipt.physicalEndSourceId, official.physicalEndSourceId, 'role original physical Source ID');

  check(receipt.schema === 'actual_artifact_stage_receipt_v1' && receipt.status === 'passed'
    && receipt.faultChecks === true && receipt.syntheticFixtureInputs === true && receipt.automaticEffortGeneration === false
    && receipt.playableArtifactRecoveryActivities === 0, 'role receipt status and fixture boundaries');
  same(receipt.counts, COUNTS, 'role helper counts');
  same(receipt.executed, { helperCalls: 1, participantSettlements: 10, newMatchWorkloadActivities: 10, newPhysicalPitchActions: 0 }, 'role executed effects');
  same(receipt.faultEvidence, { assessmentAfterInsert: true, freezeAfterInsert: true, workloadAfterInsert: true,
    staleCurrentHeadRejected: true, interruptedAfterFirstInsert: true }, 'real role fault and regression witnesses');
  same(receipt.input, official.output, 'role input is the closed official output');
  check(files.artifact.path !== official.output.path, 'fresh role output');
  disk(receipt.output, files.artifact, official.output, 10, [{ kind: 'MATCH', n: 10 }], 'role output');
  same(handoff.output, receipt.output, 'handoff output');
  settlementEvidence(receipt, official);

  const recovery = receipt.recoveryRegression, stale = receipt.staleCasRegression;
  check(record(recovery) && record(stale), 'isolated regression evidence');
  boundPin(recovery, regressions.recovery, 'recovery artifact');
  check(recovery.sourceSha256 === receipt.output.sha256 && recovery.sourceUnchanged === true
    && recovery.scope === 'isolated_day_level_recovery_regression' && recovery.elapsedWorldTimeProven === false
    && recovery.acceptedFixtureDurationHours === 1, 'isolated accepted recovery');
  disk(recovery.disk, regressions.recovery, official.output, 11, [{ kind: 'MATCH', n: 10 }, { kind: 'RECOVERY', n: 1 }], 'recovery output');
  disk(stale.disk, regressions.stale, official.output, 1, [{ kind: 'TRAVEL', n: 1 }], 'stale-CAS output');
  check(regressions.recovery.path !== official.output.path && regressions.stale.path !== official.output.path, 'regressions preserve official input');

  const sealed = { stage: '02-role-workload', path: files.receipt.path, sha256: files.receipt.sha256 };
  check(handoff.schema === 'actual_role_stage_handoff_v1' && handoff.status === 'stage_passed'
    && handoff.wholePipelinePassed === false, 'role handoff status');
  same(handoff.remainingStages, ['next'], 'handoff remaining stage');
  same(handoff.inheritedStages, ['official'], 'handoff inherited stages');
  same(handoff.roleReceipt, sealed, 'handoff role receipt');
  same(handoff.closureSourceId, official.closureSourceId, 'handoff closure');
  same(handoff.applicationId, official.applicationId, 'handoff application');
  boundPin(handoff.config, files.configuration, 'handoff configuration');
  boundPin(handoff.stageTerminal, files.stageTerminal, 'handoff stage terminal');
  boundPin(handoff.supervisorTerminal, files.supervisorTerminal, 'handoff supervisor terminal');

  check(stage.status === 'stage_passed' && stage.executionScope === 'role' && stage.wholePipelinePassed === false, 'role stage status');
  same(stage.remainingStages, ['next'], 'stage remaining stages');
  same(stage.inheritedStages, ['official'], 'stage inherited stages');
  same(stage.counts, COUNTS, 'stage helper counts');
  same(stage.phaseReceipts, [sealed], 'current role receipt set');
  same(stage.openSqliteHandles, [], 'stage SQLite handles');
  for (const field of ['physicalSourceUnchanged', 'sourceCutUnchanged', 'scoringStillUnsupported', 'recoveryOnlyOnIsolatedCopy'])
    check(stage[field] === true, `stage ${field}`);
  check(stage.automaticEffortGeneration === false && stage.elapsedWorldRecoveryTimeProven === false
    && stage.newPhysicalPitchActions === 0, 'stage fixture boundaries');
  same(stage.resumableRole, { receipt: sealed, output: receipt.output, closureSourceId: official.closureSourceId,
    applicationId: official.applicationId }, 'resumable role proof');

  check(supervisor.status === 'stage_passed' && supervisor.executionScope === 'role' && supervisor.wholePipelinePassed === false
    && supervisor.exitCode === 0 && supervisor.guard === null && supervisor.executingProcessReceiptValid === true
    && supervisor.pipelineTerminalStatus === 'stage_passed', 'role supervisor terminal');
  check(record(supervisor.sourceInputAndReceiptAudit) && supervisor.sourceInputAndReceiptAudit.passed === true, 'supervisor input audit');
  same(supervisor.sourceInputAndReceiptAudit.preservedPhaseReceipts, [sealed], 'supervisor role receipt audit');
  same(supervisor.sourceInputAndReceiptAudit.inheritedStageReceipts, inheritedReceipts, 'supervisor inherited official audit');
  same(supervisor.preservedPhaseReceipts, [files.receipt.path], 'supervisor preserved current receipt paths');
  same(supervisor.remainingOwnedProcesses, [], 'supervisor remaining processes');

  // The outer process observes the final handoff after the actual supervisor
  // exits; its child-exit process terminal cannot establish that write succeeded.
  check(outer.kind === 'role' && outer.passed === true && outer.wholePipelinePassed === false
    && outer.supervisorExitCode === 0 && outer.outerGuard === null && outer.error === null
    && outer.supervisorReaped === true, 'role outer terminal');
  same(outer.remainingSupervisorGroup, [], 'remaining supervisor group');
  same(outer.remainingExecutionGroup, [], 'remaining execution group');
  same(outer.sourceCommit, inherited.sourceCommit, 'outer Source commit');
  same(outer.sourceManifestSha256, inherited.sourceManifestSha256, 'outer Source manifest');
  same(outer.configSha256, files.configuration.sha256, 'outer configuration hash');
  check(record(outer.references), 'outer references');
  for (const [name, role] of [['role-handoff.json', 'handoff'], ['terminal.json', 'stageTerminal'], ['process-terminal.json', 'supervisorTerminal']])
    boundPin(outer.references[name], files[role], `outer ${name}`);
};

const nextConfiguration = bundle => {
  check(record(bundle), 'bundle');
  check(record(bundle.config) && bundle.config.executionScope === 'next' && bundle.config.executeNextPitch === true
    && bundle.config.faultChecks === true && record(bundle.observed), 'next continuation configuration');
};
export const assertInheritedRoleEvidence = bundle => {
  nextConfiguration(bundle); assertRoleEvidence(bundle, assertInheritedOfficialEvidence);
  assertInheritedSourceContinuity(bundle.priorSourceManifest, bundle.currentSourceManifest, bundle.config);
};

/** Original role/official/replay provenance only, not continuation admission.
 * Each caller must independently enforce its own current Source route. */
export const assertReplayedRoleStageProvenance = bundle => {
  check(record(bundle) && record(bundle.readReplayEvidence), 'replay evidence');
  const replay = bundle.readReplayEvidence;
  assertOfficialReadReplayEvidence(replay);
  same(replay.config, bundle.priorConfig, 'replay role configuration');
  same(replay.currentSourceManifest, bundle.priorSourceManifest, 'replay role Source manifest');
  same(replay.officialEvidence, bundle.officialEvidence, 'replay original official evidence');
  const expected = { binding: bundle.priorConfig.officialReadReplay, sourceTransition: bundle.priorConfig.sourceTransition,
    expectedObservationSha256: bundle.priorConfig.expectedObservationSha256 ?? null };
  same({ binding: bundle.config.officialReadReplay, sourceTransition: bundle.config.sourceTransition,
    expectedObservationSha256: bundle.config.expectedObservationSha256 ?? null }, expected, 'current replay binding');
  for (const [name, value] of Object.entries({ receipt: bundle.roleReceipt, stage: bundle.stageTerminal,
    handoff: bundle.roleHandoff, supervisor: bundle.supervisorTerminal?.sourceInputAndReceiptAudit }))
    same(value?.inheritedReadReplay, expected, `${name} replay binding`);
  assertRoleEvidence(bundle, assertOriginalOfficialStageProvenance);
  const settlement = bundle.roleReceipt.settlement, observation = replay.receipt.passes[0].observation;
  same(settlement.closureProposalHash, observation.closureProposalHash, 'replayed closure proposal');
  const originalActors = observation.participantReferences;
  for (const field of ['careerId', 'gameId', 'playId', 'gameDay'])
    check(originalActors.every(actor => actor[field] === settlement[field]), `replayed original ${field}`);
  same(settlement.participants.map(({ playerId, personId, clubId }) => ({ playerId, personId, clubId })),
    originalActors.map(({ playerId, personId, clubId }) => ({ playerId, personId, clubId })), 'replayed original actors');
  same(bundle.roleReceipt.acceptedInputManifest.assessments.map(value => value.participantReference),
    originalActors.map(({ playerId, bindingHash, personHash }) => ({ playerId, bindingHash, personHash })), 'replayed assessment actors');
};

/** Ordinary next admission always retains exact role-to-next production bytes. */
export const assertReplayedRoleEvidence = bundle => {
  nextConfiguration(bundle); assertReplayedRoleStageProvenance(bundle);
  assertInheritedSourceContinuity(bundle.priorSourceManifest, bundle.currentSourceManifest, bundle.config);
};
