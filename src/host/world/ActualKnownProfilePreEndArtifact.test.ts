import { ownedScheduledMotionTiming as phase } from './OwnedScheduledMotionTiming.test-support';
import { installOwnedScheduledDecision } from './OwnedScheduledMotionDecisionFixtures.test-support';
import { actualDefensiveDecisionLiveWorkFromSqlite } from './SqliteActualDefensiveDecisionLiveWork';
import { actualPlayersKinematicsFromPrefix } from './ActualPlayerKinematicsFromPrefix';
import { ownedMotionKnownWorkFromSqlite } from './OwnedMotionKnownWorkFromSqlite';
import { battedWorldFieldExecutionEvidenceFromSqlite, type AcceptedBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';
import { createRequire } from 'node:module';
import { existsSync, mkdtempSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { NPB_2026_RULE_PROFILE } from '../../core/rules/RuleProfile';
import { actualCommunicationEvidenceFromSqlite } from './SqliteActualCommunicationStore';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { resumeActualFirstBasePlayEndFixture } from './ActualFirstBasePlayEndResume.test-support';
import { openSqliteActualFirstBasePlayEndStore } from './SqliteActualFirstBasePlayEndStore';
import { openSqliteActualLiveRuleConsumptionStore } from './SqliteActualLiveRuleConsumptionStore';
import { openSqliteActualFirstBaseUmpireStore, actualFirstBaseUmpireEvidenceFromSqlite } from './SqliteActualFirstBaseUmpireStore';
import { actualFirstBaseUmpirePhysicalPrefixIdentity } from './ActualFirstBaseUmpirePhysicalIdentity';
import { openSqliteActualCommunicationStore } from './SqliteActualCommunicationStore';
import { openSqliteBattedWorldFieldExecutionStore } from './SqliteBattedWorldFieldExecutionStore';
import { battedWorldFieldEvidenceFromSqlite } from './SqliteBattedWorldFieldStore';
import { battedWorldFieldPhysicalPrefix } from './BattedWorldFieldPhysicalPrefix';
import { ownedScheduledMotionArchiveHash } from './OwnedScheduledMotionArchive';
import { playerObservationCalibrationFixture } from '../../core/sim/perception/PlayerObservationCalibrationFixtures.test-support';
import type { AcceptedActualFirstBaseUmpireSetup } from './ActualFirstBaseUmpire';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

const fileSha = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
const walBytes = (path: string) => existsSync(`${path}-wal`) ? statSync(`${path}-wal`).size : 0;
const fingerprints = (db: DatabaseSync) => db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(row => {
  const name = String(row.name), hashes: string[] = [];
  for (const value of db.prepare(`SELECT * FROM "${name.replaceAll('"', '""')}"`).iterate()) hashes.push(createHash('sha256').update(JSON.stringify(value)).digest('hex'));
  return { name, count: hashes.length, logicalRowsHash: createHash('sha256').update(JSON.stringify(hashes.sort())).digest('hex') };
});

it.runIf(!!process.env.BASEBALL_KNOWN_PROFILE_CONSTRUCTION_DB)('extends the fresh npb-2026 original construction through real call and retained tail, then closes/reopens without accepting an end', async () => {
  const input = resolve(process.env.BASEBALL_KNOWN_PROFILE_CONSTRUCTION_DB!);
  const inputHash = process.env.BASEBALL_KNOWN_PROFILE_CONSTRUCTION_SHA256;
  const constructionReceiptPath = process.env.BASEBALL_KNOWN_PROFILE_CONSTRUCTION_RECEIPT;
  const constructionReceiptHash = process.env.BASEBALL_KNOWN_PROFILE_CONSTRUCTION_RECEIPT_SHA256;
  const constructionSourceCommit = process.env.BASEBALL_KNOWN_PROFILE_CONSTRUCTION_SOURCE_COMMIT;
  const constructionSourceManifestSha256 = process.env.BASEBALL_KNOWN_PROFILE_CONSTRUCTION_SOURCE_MANIFEST_SHA256;
  const output = process.env.BASEBALL_KNOWN_PROFILE_PRE_END_OUTPUT_DB;
  const manifestPath = process.env.BASEBALL_KNOWN_PROFILE_PRE_END_MANIFEST;
  const sourceCommit = process.env.BASEBALL_KNOWN_PROFILE_SOURCE_COMMIT;
  const sourceManifestSha256 = process.env.BASEBALL_KNOWN_PROFILE_SOURCE_MANIFEST_SHA256;
  if (!inputHash?.match(/^[a-f0-9]{64}$/) || !sourceCommit?.match(/^[a-f0-9]{40}$/) || !sourceManifestSha256?.match(/^[a-f0-9]{64}$/)
    || !constructionReceiptPath || !constructionReceiptHash?.match(/^[a-f0-9]{64}$/)
    || !constructionSourceCommit?.match(/^[a-f0-9]{40}$/) || !constructionSourceManifestSha256?.match(/^[a-f0-9]{64}$/)
    || !output || !manifestPath || existsSync(output) || existsSync(manifestPath)) throw new Error('fresh explicitly pinned known-profile construction/output/manifest required');
  const constructionBytes = readFileSync(constructionReceiptPath);
  expect(createHash('sha256').update(constructionBytes).digest('hex')).toBe(constructionReceiptHash);
  const construction = JSON.parse(constructionBytes.toString('utf8'));
  expect(construction.sourceCommit).toBe(constructionSourceCommit); expect(construction.sourceManifestSha256).toBe(constructionSourceManifestSha256);
  expect(construction.constructionPassed).toBe(true); expect(construction.fixtureRuleProfileId).toBe('npb-2026');
  expect(construction.physicalEndAcceptancePassed).toBe(false); expect(construction.officialStagePassed).toBe(false);
  expect(construction.outputPath).toBe(input); expect(construction.outputSha256).toBe(inputHash); expect(construction.outputWalBytes === null || construction.outputWalBytes === 0).toBe(true);
  expect(construction.testCounts).toEqual({ numTotalTests: 1, numPassedTests: 1, numFailedTests: 0, numPendingTests: 0 });
  for (const key of ['sourceUnchanged', 'controlsUnchanged', 'runtimeUnchanged', 'configUnchanged']) expect(construction[key]).toBe(true);
  expect(construction.error).toBeNull(); expect(construction.remainingOwnedProcesses).toEqual([]);
  expect(construction.steps.map((step: { label: string }) => step.label)).toEqual(['construction', 'artifact-audit']);
  for (const step of construction.steps) { expect(step.exitCode).toBe(0); expect(step.guard).toBeNull(); expect(step.runtimeVerified).toBe(true); expect(step.reaped).toBe(true); expect(step.remainingOwnedProcesses).toEqual([]); }
  expect(fileSha(input)).toBe(inputHash); expect(walBytes(input)).toBe(0);
  const path = join(mkdtempSync(join(tmpdir(), 'known-profile-pre-end-')), 'state.sqlite');
  const { DatabaseSync, backup } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const original = new DatabaseSync(input, { readOnly: true });
  try {
    const match = JSON.parse(String(original.prepare('SELECT state_json FROM matches WHERE match_id=?').get('game-1')!.state_json));
    expect(match.ruleProfileId).toBe(NPB_2026_RULE_PROFILE.id);
    await backup(original, path);
  } finally { original.close(); }
  const x = resumeActualFirstBasePlayEndFixture(path); let closed = false;
  try {
    expect(x.baseField.response.touch.worldContact.flight.physicalPitch.frame.match.ruleProfileId).toBe(NPB_2026_RULE_PROFILE.id);
    expect(x.f.db.prepare('PRAGMA journal_mode').get()!.journal_mode).toBe('wal');
    expect(x.f.db.prepare('PRAGMA database_list').all().find(r => r.name === 'main')!.file).toBe(path);
    const physicalRows = () => x.f.db.prepare('SELECT * FROM batted_world_field_executions ORDER BY revision').all();
    const before = physicalRows(), p = playerObservationCalibrationFixture(), tps = x.baseField.response.touch.worldContact.flight.source.execution.ballFlightParameters.ticksPerSecond, center = x.baseField.geometry.geometry.baseGeometry.bases.first.region.center;
    // A second real defender already owns a future decision when the runner is
    // retired. Its explicit fixture calibration is accepted by the normal
    // model/observation/plan/decision owners before either later physical cut.
    const originalDeciders = x.f.db.prepare('SELECT player_id FROM actual_defensive_decisions').all().map(r => r.player_id);
    const futurePlayer = x.runtime.membership.participants.find(p => p.role === 'defender' && !originalDeciders.includes(p.playerId))!;
    const secondDefender = installOwnedScheduledDecision(x, futurePlayer.playerId, x.race.source.sourceId, 100);
    expect(secondDefender.decision.receipt.lifecycle.status).toBe('pending_decision');
    phase('known-profile-pre-end:future-second-defender', 'point');
    const originalFutureDecision = withSqliteReadTransaction(x.f.db, () => actualDefensiveDecisionLiveWorkFromSqlite(x.f.db).read(secondDefender.decision.source.sourceId))!;
    const acknowledgement = { sourceId: 'rule-consumption', sourceVersion: 'fixture-v1', capability: 'actual_first_base_rule_consumption_v1' as const,
      captureExecutionSourceId: 'field-race-capture-confirmed', ruleExecutionSourceId: x.race.source.sourceId };
    x.f.track(openSqliteActualLiveRuleConsumptionStore(path, { readAcceptedConsumption: id => id === acknowledgement.sourceId ? acknowledgement : null })).accept(acknowledgement.sourceId);
    const setup: AcceptedActualFirstBaseUmpireSetup = { sourceId: 'play-end-umpire-setup', sourceVersion: 'fixture-v1', gameId: x.runtime.gameId,
      physicalPitchSourceId: x.pitchId, umpireId: 'umpire-1', pose: { version: 'static_first_base_view_v1', position: { ...center, y: 20 },
        forward: { x: 0, y: -1, z: 0 }, validFromElapsedSeconds: 0, validThroughElapsedSeconds: 10 }, attention: { control: 1, touch: 1 },
      calibration: { version: 'first_base_timing_triangular_v1', perceptionAbility: 0.8, callDelaySeconds: 2 / tps,
        geometryParameters: { ...p.geometryParameters, fullQualityHalfAngleRadians: Math.PI - .01, maxVisibleHalfAngleRadians: Math.PI,
          fullQualityDistanceMeters: 100, maxObservableDistanceMeters: 1000, fullQualityRelativeSpeedMps: 100000, maxRelativeSpeedMps: 1000000 },
        qualityParameters: p.qualityParameters,
        timingErrorParameters: { minimumDetectionQuality: .1, minimumTimeErrorSeconds: 0, maximumTimeErrorSeconds: 0 } } };
    const observation = { sourceId: 'play-end-umpire-observation', sourceVersion: 'fixture-v1', setupSourceId: setup.sourceId, ruleExecutionSourceId: x.race.source.sourceId };
    const sources = new Map<string, AcceptedBattedWorldFieldExecution>();
    const physicalWriter = x.f.track(openSqliteBattedWorldFieldExecutionStore(path, { read: battedWorldFieldEvidenceFromSqlite(x.f.db).read },
      { readAcceptedExecution: id => sources.get(id) ?? null }));
    const extendBucket = (sourceId: string, previous: string, throughTick: number) => {
      const prefix = { baseField: x.baseField, fields: battedWorldFieldEvidenceFromSqlite(x.f.db).scope(x.baseField, x.baseField.source.sourceId),
        executions: battedWorldFieldExecutionEvidenceFromSqlite(x.f.db).scope(x.baseField, previous) };
      const ids = x.runtime.membership.participants.map(player => player.playerId);
      const source: AcceptedBattedWorldFieldExecution = { sourceId, sourceVersion: 'fixture-v1', baseFieldSourceId: x.baseField.source.sourceId,
        previousExecutionSourceId: previous, action: { kind: 'owned_motion_v2', checkpoint: { kind: 'retained_quantizer_bucket_v1', throughTick },
          knownWork: ownedMotionKnownWorkFromSqlite(x.f.db, x.pitchId, ids),
          contributions: actualPlayersKinematicsFromPrefix(ids, prefix).map(self => ({ kind: 'retained', playerId: self.playerId, command: self.activeCommand })) } };
      sources.set(sourceId, source); return physicalWriter.accept(sourceId);
    };
    const waitingSource = { sourceId: 'scheduled-operative-call', sourceVersion: 'fixture-v1', observationSourceId: observation.sourceId, currentExecutionSourceId: x.race.source.sourceId };
    const calls = new Map([[waitingSource.sourceId, waitingSource]]);
    const umpires = x.f.track(openSqliteActualFirstBaseUmpireStore(path, { readAcceptedSetup: () => setup,
      readAcceptedObservation: () => observation, readAcceptedCall: id => calls.get(id) ?? null }));
    umpires.acceptSetup(setup.sourceId); const observed = umpires.observe(observation.sourceId), waiting = umpires.advanceCall(waitingSource.sourceId);
    expect(waiting.schedule.kind).toBe('scheduled');
    const due = extendBucket('actual-call-due-cut', x.race.source.sourceId, x.race.execution.field.motion.world.moment.ball.tick + 3);
    const callSource = { ...waitingSource, sourceId: 'operative-call', currentExecutionSourceId: due.source.sourceId };
    calls.set(callSource.sourceId, callSource); const call = umpires.advanceCall(callSource.sourceId);
    const final = extendBucket('actual-post-call-quantizer-tail', due.source.sourceId, due.execution.field.motion.world.moment.ball.tick + 1);
    expect(call.schedule).toMatchObject({ kind: 'called', call: 'out' });
    phase('known-profile-pre-end:actual-delayed-call-and-tail', 'point');
    const physicalHash = ownedScheduledMotionArchiveHash(x.race), actualPrefix = x.prefix();
    const identity = actualFirstBaseUmpirePhysicalPrefixIdentity(actualPrefix, battedWorldFieldPhysicalPrefix({ ...actualPrefix, custodyPolicy: 'release_exclusive_v1' }));
    expect(observed.ruleEvidenceHash).toBe(physicalHash);
    expect(call.currentExecutionHash).toBe(ownedScheduledMotionArchiveHash(due));
    if (call.schedule.kind !== 'called') throw new Error('delayed operative call');
    expect(call.schedule.calledAtElapsedSeconds).toBe(observed.availability.elapsedSeconds + setup.calibration!.callDelaySeconds);
    expect(call.advancedThrough.elapsedSeconds).toBeGreaterThanOrEqual(call.schedule.calledAtElapsedSeconds);
    expect(x.f.db.prepare('SELECT snapshot_hash FROM batted_world_field_executions WHERE source_id=?').get(x.race.source.sourceId)!.snapshot_hash).toBe(physicalHash);
    expect(observed.physicalPrefixHash).toBe(identity.physicalPrefixHash);
    expect(observed.physicalPrefixHashConvention).toBe(identity.physicalPrefixHashConvention);
    const references = actualFirstBaseUmpireEvidenceFromSqlite(x.f.db).importReferences(call.source.sourceId)!;
    expect(references.ruleEvidence.snapshotHash).toBe(physicalHash); expect(references.ruleEvidence.sourceHash).toBe(hash(x.race.source));
    const model = { sourceId: 'call-reception-model', sourceVersion: 'fixture-v1', gameId: x.runtime.gameId, physicalPitchSourceId: x.pitchId,
      parameters: { version: 'fixed_receiver_conditions_v1' as const, timing: 'exact_sent_plus_core_delay_ticks_v1' as const,
        receivers: x.runtime.membership.participants.map(player => ({ playerId: player.playerId, conditions: { propagationDelayTicks: 100,
          recognitionBaseDelayTicks: 0, maxAdditionalRecognitionDelayTicks: 0, audibility: 1, recognition: 1, attention: 1, minimumRecognizableQuality: .5 } })) } };
    const communicationSource = { sourceId: 'call-information', sourceVersion: 'fixture-v1', callSourceId: call.source.sourceId,
      modelSourceId: model.sourceId, currentExecutionSourceId: final.source.sourceId, previousCommunicationSourceId: null };
    const communications = x.f.track(openSqliteActualCommunicationStore(path, { readAcceptedModel: () => model, readAcceptedCommunication: () => communicationSource }));
    communications.acceptModel(model.sourceId); const communication = communications.accept(communicationSource.sourceId);
    expect(communication.recipients).toHaveLength(10); expect(communication.recipients.every(r => r.kind === 'scheduled')).toBe(true);
    const request = { sourceId: 'physical-end', sourceVersion: 'fixture-v1', runtimeSourceId: x.runtime.source.sourceId,
      baseFieldSourceId: x.baseField.source.sourceId, executionSourceId: final.source.sourceId, ruleConsumptionSourceId: acknowledgement.sourceId,
      umpireCallSourceId: call.source.sourceId, communicationSourceId: communication.source.sourceId };
    x.f.track(openSqliteActualFirstBasePlayEndStore(path, { readAcceptedEnd: id => id === request.sourceId ? request : null }));
    const completedPhysicalRows = physicalRows();
    expect(completedPhysicalRows.slice(0, before.length)).toEqual(before);
    phase('known-profile-pre-end:future-communication-admitted', 'point');
    expect(x.f.db.prepare('SELECT count(*) AS n FROM actual_first_base_play_ends').get()!.n).toBe(0);
    expect(x.f.db.prepare('SELECT count(*) AS n FROM actual_live_play_fences').get()!.n).toBe(0);
    expect(x.f.db.prepare('SELECT count(*) AS n FROM applications').get()!.n).toBe(0);
    expect(x.f.db.prepare('SELECT count(*) AS n FROM world_player_workload_activities').get()!.n).toBe(0);
    const completedRows = fingerprints(x.f.db), callHash = hash(call), communicationHash = hash(communication), futureHash = hash(originalFutureDecision);
    x.f.close(); closed = true;
    phase('known-profile-pre-end:all-original-connections-closed', 'point');
    const reopened = resumeActualFirstBasePlayEndFixture(path);
    try {
      withSqliteReadTransaction(reopened.f.db, () => {
        expect(ownedScheduledMotionArchiveHash(reopened.race)).toBe(physicalHash);
        expect(hash(actualFirstBaseUmpireEvidenceFromSqlite(reopened.f.db).readCall(call.source.sourceId))).toBe(callHash);
        expect(hash(actualCommunicationEvidenceFromSqlite(reopened.f.db).read(communication.source.sourceId))).toBe(communicationHash);
        expect(hash(actualDefensiveDecisionLiveWorkFromSqlite(reopened.f.db).read(secondDefender.decision.source.sourceId))).toBe(futureHash);
        expect(fingerprints(reopened.f.db)).toEqual(completedRows);
      });
    } finally { reopened.f.close(); }
    const pending = `${output}.partial-${process.pid}`; if (existsSync(pending)) throw new Error('fresh pre-end export path required');
    const finished = new DatabaseSync(path, { readOnly: true });
    try { await backup(finished, pending); } finally { finished.close(); }
    const exported = new DatabaseSync(pending, { readOnly: true });
    try {
      expect(exported.prepare('PRAGMA integrity_check').all()).toEqual([{ integrity_check: 'ok' }]);
      expect(exported.prepare('PRAGMA journal_mode').get()!.journal_mode).toBe('wal');
      expect(exported.prepare('PRAGMA database_list').all().find(row => row.name === 'main')!.file).toBe(resolve(pending));
      expect(fingerprints(exported)).toEqual(completedRows);
    } finally { exported.close(); }
    expect(walBytes(pending)).toBe(0); expect(fileSha(input)).toBe(inputHash); expect(walBytes(input)).toBe(0);
    expect(fileSha(constructionReceiptPath)).toBe(constructionReceiptHash);
    renameSync(pending, output);
    writeFileSync(manifestPath, `${JSON.stringify({ schema: 'synthetic_first_base_known_profile_pre_end_fixture_v1',
      scope: 'fresh known-profile original chain; real call/tail/future work; no physical-end or seal acceptance',
      sourceCommit, sourceManifestSha256, ruleProfileId: NPB_2026_RULE_PROFILE.id, ruleProfileSha256: hash(NPB_2026_RULE_PROFILE),
      originalConstructionDatabaseSha256: inputHash, originalConstructionTerminalSha256: constructionReceiptHash, originalConstructionSourceCommit: construction.sourceCommit, originalConstructionSourceManifestSha256: construction.sourceManifestSha256, databaseSha256: fileSha(output), uncheckpointedWalBytes: 0,
      physicalEndRows: 0, sealRows: 0, request, operativeCallReferences: references, futureDecisionSourceId: secondDefender.decision.source.sourceId,
      tables: completedRows }, null, 2)}\n`, { flag: 'wx' });
    phase('known-profile-pre-end:verified-closed-backup-and-manifest', 'point');
  } finally { if (!closed) x.f.close(); }
}, 7_200_000);
