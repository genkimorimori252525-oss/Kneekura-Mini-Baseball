import { posix } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const commit = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const text = value => typeof value === 'string' && value.length > 0;
const canonicalPath = (value, absolute) => text(value) && !value.includes('\\') && !value.includes('\0')
  && posix.isAbsolute(value) === absolute && posix.normalize(value) === value
  && value !== '/' && value.split('/').every((part, index) => (absolute && index === 0) || (part !== '' && part !== '.' && part !== '..'));
const check = (condition, field) => { if (!condition) throw new Error(`inherited official: ${field}`); };
const same = (actual, expected, field) => check(isDeepStrictEqual(actual, expected), field);
const keys = (value, expected, field) => { check(record(value), field); same(Object.keys(value).sort(), [...expected].sort(), field); };
const raw = (value, field) => check(record(value) && !['publicationProjection', 'originalRawReceiptSha256']
  .some(key => Object.hasOwn(value, key)), `${field} raw evidence`);
const pin = (value, field) => check(record(value) && canonicalPath(value.path, true) && hash(value.sha256), field);
const boundPin = (value, expected, field) => { pin(value, field); same(value.path, expected.path, `${field} path`); same(value.sha256, expected.sha256, `${field} hash`); };
const FILES = ['handoff', 'outerTerminal', 'stageTerminal', 'supervisorTerminal', 'receipt', 'configuration', 'sourceManifest', 'artifact'];
const COUNTS = { officialStarted: 1, officialCompleted: 1, roleStarted: 0, roleCompleted: 0, nextStarted: 0, nextCompleted: 0 };
const HELPERS = new Set(['ActualLiveOfficialArtifact', 'ActualRoleWorkloadArtifact', 'ActualLiveNextActorArtifact']
  .flatMap(name => [`src/${name}.test-support.ts`, `src/host/world/${name}.test-support.ts`]));
// The reviewed continuation cut may change verification code, docs, tests and
// these specific helper brackets. Other support files remain Source authority.
const reviewOnlyPath = path => path.startsWith('docs/') || path.startsWith('tools/verification/actual-live-pipeline/')
  || /\.(?:test|spec)\.(?:[cm]?js|tsx?)$/.test(path) || HELPERS.has(path);

const manifestFiles = (manifest, field) => {
  raw(manifest, field);
  check(manifest.schema === 'actual_artifact_pipeline_source_v1' && canonicalPath(manifest.sourceRoot, true)
    && commit(manifest.sourceCommit) && commit(manifest.sourceTree)
    && Array.isArray(manifest.files) && manifest.files.length > 0, field);
  const files = new Map();
  for (const entry of manifest.files) {
    check(record(entry) && canonicalPath(entry.path, false) && hash(entry.sha256) && !files.has(entry.path), `${field} files`);
    files.set(entry.path, entry.sha256);
  }
  return files;
};

// Shared Source classification; this does not itself admit any transition.
export const inheritedProductionSourceFiles = (manifest, field) => [...manifestFiles(manifest, field)]
  .filter(([path]) => !reviewOnlyPath(path)).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);

/** JSON-only continuity check; actual Source bytes must be separately verified.
 * No new production path, removed owner or changed production byte is admitted. */
export const assertInheritedSourceContinuity = (priorManifest, currentManifest, currentConfig) => {
  const prior = inheritedProductionSourceFiles(priorManifest, 'prior Source manifest');
  const current = inheritedProductionSourceFiles(currentManifest, 'current Source manifest');
  check(record(currentConfig), 'current Source configuration');
  for (const field of ['sourceRoot', 'sourceCommit']) same(currentManifest[field], currentConfig[field], `current ${field}`);
  same(current, prior, 'production Source continuity');
};

const disk = (value, expected, field) => {
  boundPin(value, expected, field);
  check(value.realDisk === true && value.mainFilename === value.path && value.journalMode === 'wal'
    && value.wrapperReadOnlyOpenClosedVerified === true && record(value.rowCounts), `${field} closed database`);
  check(Object.values(value.rowCounts).every(n => Number.isSafeInteger(n) && n >= 0), `${field} row counts`);
  for (const name of ['applications', 'physical_pitch_progress_actions', 'world_player_workload_activities',
    'actual_first_base_play_ends', 'actual_live_play_fences']) check(Number.isSafeInteger(value.rowCounts[name]), `${field} ${name}`);
  same(value.workloadActivityKinds, [], `${field} workload activities`);
};

/** Admit independently loaded, hash-checked JSON evidence only. The caller must
 * first admit producerReference through its own physical-producer contract and
 * later authenticate the actual closed database with the same-connection owner. */
export const assertInheritedOfficialEvidence = bundle => {
  check(record(bundle) && record(bundle.config) && ['role', 'next'].includes(bundle.config.executionScope), 'continuation configuration');
  assertOriginalOfficialStageProvenance(bundle);
  assertInheritedSourceContinuity(bundle.priorSourceManifest, bundle.currentSourceManifest, bundle.config);
};

/** Shared original-stage predicate, not continuation admission. Callers must
 * separately enforce their own strict Source route. No original identity or
 * evidence is relabeled, and the ordinary entry point always checks equality. */
export const assertOriginalOfficialStageProvenance = bundle => {
  check(record(bundle), 'bundle');
  const { config, producerReference, officialHandoff: handoff, officialReceipt: receipt, stageTerminal: stage,
    supervisorTerminal: supervisor, outerTerminal: outer, priorConfig, priorSourceManifest, observed } = bundle;
  check(record(config) && record(observed), 'original-stage configuration');
  const inherited = config.inheritedOfficial;
  check(record(inherited) && inherited.kind === 'checked_official_stage_v1' && canonicalPath(inherited.sourceRoot, true)
    && commit(inherited.sourceCommit) && hash(inherited.sourceManifestSha256), 'inherited binding');
  const files = inherited.files;
  keys(files, FILES, 'file roles');
  keys(observed.hashes, FILES, 'observed file roles');
  for (const name of FILES) {
    pin(files[name], `${name} pin`);
    same(observed.hashes[name], files[name].sha256, `${name} independently observed hash`);
  }
  check(new Set(FILES.map(name => files[name].path)).size === FILES.length, 'distinct file paths');
  check(observed.outputWalBytes === null || observed.outputWalBytes === 0, 'output WAL observation');
  check(observed.priorSourceFilesUnchanged === true, 'prior Source bytes');
  same(inherited.sourceManifestSha256, files.sourceManifest.sha256, 'Source manifest pin');

  for (const [name, value] of Object.entries({ handoff, receipt, stage, supervisor, outer, priorConfig })) raw(value, name);
  check(handoff.schema === 'actual_official_stage_handoff_v1' && handoff.status === 'stage_passed'
    && handoff.wholePipelinePassed === false, 'handoff status');
  same(handoff.remainingStages, ['role', 'next'], 'handoff remaining stages');
  check(receipt.schema === 'actual_artifact_stage_receipt_v1' && receipt.status === 'passed', 'official receipt status');
  check(stage.status === 'stage_passed' && stage.executionScope === 'official' && stage.wholePipelinePassed === false, 'stage status');
  same(stage.remainingStages, ['role', 'next'], 'stage remaining stages');
  same(stage.counts, COUNTS, 'stage helper counts');
  same(receipt.counts, COUNTS, 'official helper counts');
  for (const field of ['physicalSourceUnchanged', 'sourceCutUnchanged', 'scoringStillUnsupported', 'actualRoleWorkloadStillPending'])
    check(stage[field] === true, `stage ${field}`);
  same(stage.openSqliteHandles, [], 'stage SQLite handles');
  check(stage.newPhysicalPitchActions === 0, 'stage new physical pitch actions');

  manifestFiles(priorSourceManifest, 'prior Source manifest');
  const identity = receipt.sourceIdentity;
  check(record(identity), 'Source identity');
  for (const field of ['sourceRoot', 'sourceCommit', 'sourceManifestSha256']) same(identity[field], inherited[field], `Source identity ${field}`);
  for (const field of ['sourceRoot', 'sourceCommit', 'sourceTree']) same(priorSourceManifest[field], identity[field], `prior manifest ${field}`);
  same(handoff.sourceIdentity, identity, 'handoff Source identity');
  same(stage.sourceIdentity, identity, 'stage Source identity');
  check(priorConfig.schema === 'actual_artifact_pipeline_run_v2' && priorConfig.executionScope === 'official'
    && priorConfig.faultChecks === true && priorConfig.executeNextPitch === true, 'prior configuration');
  for (const field of ['sourceRoot', 'sourceCommit', 'sourceManifestSha256']) same(priorConfig[field], inherited[field], `prior configuration ${field}`);
  same(priorConfig.sourceManifestPath, files.sourceManifest.path, 'prior configuration Source manifest path');

  check(record(producerReference) && ['first_base_clean_producer_v1', 'first_base_known_profile_producer_v1'].includes(producerReference.kind)
    && commit(producerReference.sourceCommit) && record(producerReference.negativeEvidenceHashes)
    && Array.isArray(producerReference.referencedFiles), 'admitted producer reference');
  for (const field of ['sourceManifestSha256', 'originalInputSha256', 'terminalSha256', 'outputSha256'])
    check(hash(producerReference[field]), `admitted producer ${field}`);
  same(handoff.physicalProducerReference, producerReference, 'handoff producer reference');
  same(receipt.physicalProducerReference, producerReference, 'official producer reference');
  check(record(config.physicalProducer) && config.physicalProducer.kind === producerReference.kind
    && config.physicalProducer.sourceCommit === producerReference.sourceCommit, 'current producer binding');
  same(priorConfig.physicalProducer, config.physicalProducer, 'prior producer binding');
  for (const field of ['sourceManifestSha256', 'originalInputSha256', 'negativeEvidenceHashes']) {
    if (Object.hasOwn(config.physicalProducer, field)) same(config.physicalProducer[field], producerReference[field], `producer binding ${field}`);
  }
  for (const field of ['physicalArtifactPath', 'physicalEvidencePath']) check(canonicalPath(config[field], true), `current ${field}`);
  check(text(config.physicalEndSourceId), 'physical end Source ID');
  for (const field of ['physicalArtifactPath', 'physicalArtifactSha256', 'physicalEvidencePath', 'physicalEvidenceSha256', 'physicalEndSourceId'])
    same(priorConfig[field], config[field], `original physical ${field}`);
  same(config.physicalArtifactSha256, producerReference.outputSha256, 'physical producer output hash');
  same(config.physicalEvidenceSha256, producerReference.terminalSha256, 'physical producer terminal hash');
  same(receipt.originalPhysicalArtifactSha256, producerReference.outputSha256, 'original physical artifact hash');
  same(receipt.physicalEndSourceId, config.physicalEndSourceId, 'official physical end Source ID');

  check(receipt.faultChecks === true && receipt.syntheticFixturePolicy === true, 'official fixture and fault checks');
  same(receipt.faultEvidence, { adjudicationDependencyAfterInsert: true, officialApplicationAfterInsert: true }, 'official INSERT fault witnesses');
  same(receipt.executed, { helperCalls: 1, newOfficialApplications: 1, newPhysicalPitchActions: 0 }, 'official executed effects');
  check(text(receipt.closureSourceId) && text(receipt.applicationId), 'official closure and application IDs');
  check(record(receipt.adjudicationEvidence), 'adjudication evidence');
  const end = receipt.adjudicationEvidence.physicalEndReference;
  check(record(end) && end.owner === 'actual_first_base_play_ends' && end.sourceId === config.physicalEndSourceId
    && text(end.sourceVersion) && hash(end.sourceHash) && hash(end.snapshotHash), 'authenticated physical end reference');
  const history = receipt.adjudicationEvidence.wholeHistoryReference;
  check(record(history) && hash(history.hash) && history.convention === 'owned_scheduled_whole_history_manifest_v1', 'whole-history reference');
  disk(receipt.input, { path: config.physicalArtifactPath, sha256: config.physicalArtifactSha256 }, 'official input');
  disk(receipt.output, files.artifact, 'official output');
  for (const value of [receipt.input, receipt.output]) {
    check(value.rowCounts.actual_first_base_play_ends === 1 && value.rowCounts.actual_live_play_fences === 1
      && value.rowCounts.physical_pitch_progress_actions === 1 && value.rowCounts.world_player_workload_activities === 0, 'original bounded row census');
  }
  check(receipt.input.rowCounts.applications === 0 && receipt.output.rowCounts.applications === 1, 'exactly one official application');
  same(handoff.output, receipt.output, 'handoff closed output');
  const sealed = { stage: '01-official', path: files.receipt.path, sha256: files.receipt.sha256 };
  same(stage.phaseReceipts, [sealed], 'stage sealed receipt set');
  same(handoff.officialReceipt, sealed, 'handoff official receipt');
  same(stage.resumableOfficial, { receipt: sealed, output: receipt.output, closureSourceId: receipt.closureSourceId,
    applicationId: receipt.applicationId }, 'resumable official proof');
  same(handoff.closureSourceId, receipt.closureSourceId, 'handoff closure');
  same(handoff.applicationId, receipt.applicationId, 'handoff application');
  boundPin(handoff.config, files.configuration, 'handoff configuration');
  boundPin(handoff.stageTerminal, files.stageTerminal, 'handoff stage terminal');
  boundPin(handoff.supervisorTerminal, files.supervisorTerminal, 'handoff supervisor terminal');

  check(supervisor.status === 'stage_passed' && supervisor.executionScope === 'official' && supervisor.wholePipelinePassed === false
    && supervisor.exitCode === 0 && supervisor.guard === null && supervisor.executingProcessReceiptValid === true
    && supervisor.pipelineTerminalStatus === 'stage_passed', 'supervisor terminal');
  check(record(supervisor.sourceInputAndReceiptAudit) && supervisor.sourceInputAndReceiptAudit.passed === true, 'supervisor input audit');
  same(supervisor.sourceInputAndReceiptAudit.preservedPhaseReceipts, [sealed], 'supervisor audited receipt set');
  same(supervisor.preservedPhaseReceipts, [files.receipt.path], 'supervisor preserved receipt paths');
  same(supervisor.remainingOwnedProcesses, [], 'supervisor remaining processes');

  // This is the supervisor's actual outer exit/reap and post-terminal handoff
  // observation, not the execution child's earlier process-terminal exitCode.
  check(outer.kind === 'official' && outer.passed === true && outer.wholePipelinePassed === false
    && outer.supervisorExitCode === 0 && outer.outerGuard === null && outer.error === null
    && outer.supervisorReaped === true, 'outer terminal');
  same(outer.remainingSupervisorGroup, [], 'remaining supervisor group');
  same(outer.remainingExecutionGroup, [], 'remaining execution group');
  same(outer.sourceCommit, inherited.sourceCommit, 'outer Source commit');
  same(outer.sourceManifestSha256, inherited.sourceManifestSha256, 'outer Source manifest');
  same(outer.configSha256, files.configuration.sha256, 'outer configuration hash');
  check(record(outer.references), 'outer references');
  for (const [name, role] of [['official-handoff.json', 'handoff'], ['terminal.json', 'stageTerminal'], ['process-terminal.json', 'supervisorTerminal']])
    boundPin(outer.references[name], files[role], `outer ${name}`);
};
