import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { constants, copyFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { actorHash as hash, actorJson as json, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import type { SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { playerPersonLinkEvidenceFromSqlite, type DurablePlayerPersonLink } from './SqlitePlayerPersonLinkStore';
import type { OfficialParticipantBinding } from './SqliteOfficialParticipationStore';
import { openSqlitePlayerFieldingModelStore, type AcceptedPlayerFieldingModel } from './SqlitePlayerFieldingModelStore';
import { openSqlitePlayerObservationModelStore, type AcceptedPlayerObservationModel } from './SqlitePlayerObservationModelStore';
import { openSqlitePlayerDecisionModelStore, type AcceptedPlayerDecisionModel } from './SqlitePlayerDecisionModelStore';
import { openSqlitePlayerLocomotionModelStore, type AcceptedPlayerLocomotionModel } from './SqlitePlayerLocomotionModelStore';
import { openSqlitePlayerBodyCapabilityMaterializationStore } from './SqlitePlayerBodyCapabilityMaterializationStore';
import type { AcceptedBodySource, AcceptedPoseSource, AcceptedReachSource, BodyMaterializationRequest } from './PlayerBodyCapabilityMaterialization';
import { openSqlitePlayerBattingModelStore } from './SqlitePlayerBattingModelStore';
import type { AcceptedPlayerBattingModelV1, BattingModelParameters } from './PlayerBattingModel';
import { rawCensus, schemaCensus, fileHash } from './ActualFoulTerminalAcknowledgementCutover.test-support';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';
import { assertBodyCompositionNativeConnection } from './BodyMaterializationSqliteOwnership';
import { witnessSqliteWrite } from './SqliteWriteWitness.test-support';
import { observeTerminalWorkloadConnectionChanges } from './ActualFoulTerminalRoleWorkloadFixture.test-support';
import { writeExecutionViewArtifact } from './SamePlateAppearanceExecutionViewGate.test-support';
type FileRef = Readonly<{ path: string; sha256: string }>;
type Owner = 'world_player_fielding_models' | 'world_player_observation_models' | 'world_player_decision_models' | 'world_player_locomotion_models';
type ModelSource = AcceptedPlayerFieldingModel | AcceptedPlayerObservationModel | AcceptedPlayerDecisionModel | AcceptedPlayerLocomotionModel;
type ModelEntry = Readonly<{ owner: Owner; origin: string; source: ModelSource; observedReference?: SamePaReference }>;
type BodySources = Readonly<{ body: AcceptedBodySource; pose: AcceptedPoseSource; reachCalibration: AcceptedReachSource; bodyMaterialization: BodyMaterializationRequest;
  model: AcceptedPlayerBattingModelV1 }> & BattingModelParameters;
type Scope = Readonly<{ binding: OfficialParticipantBinding; person: DurablePlayerPersonLink; member: { bindingHash: string; personHash: string } }>;
type Candidate = Readonly<{ fielding: { model: { source: ModelSource } | null }; models: readonly {
  status: string; source?: ModelSource; modelReference?: SamePaReference; fieldingReference?: SamePaReference }[] }>;
type Proposal = Readonly<{ version: string; fixtureOnly: true; targetArtifact: FileRef; qualifiedPrerequisiteInventory: FileRef; batterSources: BodySources;
  defenderSources: readonly ModelEntry[]; targetScope: readonly Scope[]; exactExpectedRows: Record<string, number>; clockDeclaration: { physicalTicksPerSecond: number } }>;
type Input = Readonly<{ version: 'same_pa_normal_model_accepted_input_v1'; privateFixtureAccepted: true; proposal: FileRef; qualifiedPrerequisites: FileRef }>;
const Native = (createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync;
const same = (a: unknown, b: unknown) => assert.equal(json(a), json(b));
const pinned = <T>(ref: FileRef): T => { assert.equal(fileHash(ref.path), ref.sha256); return freeze(JSON.parse(readFileSync(ref.path, 'utf8'))) as T; };
const closed = (path: string) => { for (const suffix of ['-wal', '-shm', '-journal']) assert(!existsSync(path + suffix), 'normal model artifact has a sidecar'); };
const changes = (db: DatabaseSync) => Number(db.prepare('SELECT total_changes() n').get()!.n);

/** Existing normal owners commit their own rows independently. A partial failure
 * is retained for inspection, never repaired or reported as an atomic38-row set. */
export const verifySamePaNormalModelAcceptance = (request: { inputPath: string; inputSha256: string; outputDirectory: string }) => {
  assert(process.env.BASEBALL_GATE_RUNTIME && process.env.BASEBALL_GATE_LOCKS, 'bounded private controller required');
  const input = pinned<Input>({ path: request.inputPath, sha256: request.inputSha256 }); assert.equal(input.version, 'same_pa_normal_model_accepted_input_v1'); assert.equal(input.privateFixtureAccepted, true);
  const p = pinned<Proposal>(input.proposal); assert.equal(p.version, 'same_pa_normal_model_sources_proposal_v1'); assert.equal(p.fixtureOnly, true); assert.equal(p.clockDeclaration.physicalTicksPerSecond, 1_000_000);
  same(p.qualifiedPrerequisiteInventory, input.qualifiedPrerequisites);
  const qualified = pinned<{ qualified: true; targetArtifact: FileRef; target: readonly (Scope & { role: string })[]; candidateModels: readonly Candidate[]; qualification: Record<string, FileRef> }>(input.qualifiedPrerequisites);
  assert.equal(qualified.qualified, true); same(qualified.targetArtifact, p.targetArtifact); same(qualified.target.map(t => ({ member: t.member, binding: t.binding, person: t.person })), p.targetScope);
  for (const f of Object.values(qualified.qualification)) assert.equal(fileHash(f.path), f.sha256);
  const terminal = pinned<{ status: string; originalChildExit: number; failures: unknown[]; remainingOwnedProcesses: unknown[]; tests: { passedCases: number } }>(qualified.qualification.terminal);
  assert.equal(terminal.status, 'passed'); assert.equal(terminal.originalChildExit, 0); same(terminal.failures, []); same(terminal.remainingOwnedProcesses, []); assert.equal(terminal.tests.passedCases, 1);
  const prior = pinned<{ normalOwnerInventoryQualified: boolean; target: readonly Scope[]; candidateModels: unknown[]; targetArtifact: FileRef; totalChanges: number; closedHandles: boolean; closedSidecars: boolean }>(qualified.qualification.receipt);
  assert(prior.normalOwnerInventoryQualified && prior.closedHandles && prior.closedSidecars); assert.equal(prior.totalChanges, 0); same(prior.target, qualified.target); same(prior.candidateModels, qualified.candidateModels); same(prior.targetArtifact, p.targetArtifact);
  const tables = Object.keys(p.exactExpectedRows).sort(); same(tables, ['world_batted_body_materializations','world_player_batting_models','world_player_body_materializations','world_player_decision_models','world_player_fielding_models','world_player_locomotion_models','world_player_observation_models']);
  same(p.exactExpectedRows, { world_player_fielding_models: 9, world_player_observation_models: 9, world_player_decision_models: 9, world_player_locomotion_models: 9,
    world_player_body_materializations: 1, world_batted_body_materializations: 0, world_player_batting_models: 1 });
  assert.equal(p.defenderSources.length, 36); assert.equal(new Set(p.defenderSources.map(x => x.owner + ':' + x.source.sourceId)).size, 36);
  assert.equal(p.defenderSources.filter(x => x.origin === 'authenticated_existing_source_candidate').length, 8);
  const b = p.batterSources; const target = qualified.target.find(t => t.role === 'batter'); assert(target); assert.equal(target.binding.playerId, b.model.playerId);
  const defenders = qualified.target.filter(t => t.role !== 'batter').map(t => t.binding.playerId).sort(); assert.equal(defenders.length, 9);
  for (const owner of ['world_player_fielding_models','world_player_observation_models','world_player_decision_models','world_player_locomotion_models']) {
    same(p.defenderSources.filter(e => e.owner === owner).map(e => e.source.playerId).sort(), defenders);
  }
  for (const e of p.defenderSources) {
    assert(['authenticated_existing_source_candidate','new_explicit_fixture_declaration'].includes(e.origin));
    if (e.owner !== 'world_player_fielding_models') assert.equal((e.source as AcceptedPlayerObservationModel).fieldingModelSourceId,
      p.defenderSources.find(f => f.owner === 'world_player_fielding_models' && f.source.playerId === e.source.playerId)!.source.sourceId);
  }
  const originalCandidates = qualified.candidateModels.filter(c => c.fielding.model).flatMap(c => {
    assert(c.models.every(m => m.status === 'owned_candidate' && m.source && m.modelReference && m.fieldingReference));
    return [{ owner: 'world_player_fielding_models', source: c.fielding.model!.source, observedReference: c.models[0].fieldingReference },
      ...c.models.map(m => ({ owner: m.modelReference!.owner, source: m.source!, observedReference: m.modelReference! }))];
  });
  same(p.defenderSources.filter(e => e.origin === 'authenticated_existing_source_candidate').map(({ owner, source, observedReference }) => ({ owner, source, observedReference })), originalCandidates);
  const identity = (source: { careerId: string; playerId: string; personLinkSourceId: string; acceptedAtDay?: number; atDay?: number; personId?: string }) => {
    const t = p.targetScope.find(x => x.binding.playerId === source.playerId); assert(t);
    assert.equal(source.careerId, t.binding.careerId); assert.equal(source.personLinkSourceId, t.binding.personLinkSourceId);
    assert((source.acceptedAtDay ?? source.atDay)! <= t.binding.gameDay); if ('personId' in source) assert.equal(source.personId, t.person.personId);
  };
  p.defenderSources.forEach(e => identity(e.source)); identity(b.model); identity(b.body); identity(b.pose); identity(b.bodyMaterialization);
  for (const key of ['capability','repertoire','decisionModel','equipment','observationCalibration','predictionCalibration'] as const) identity(b[key]);
  for (const e of p.defenderSources) if (e.owner === 'world_player_observation_models') assert.equal((e.source as AcceptedPlayerObservationModel).calibration.memoryDecayParameters.ticksPerSecond, 1_000_000);
  assert.equal(b.observationCalibration.values.calibration.memoryDecayParameters.ticksPerSecond, 1_000_000); assert.equal(b.predictionCalibration.values.parameters.ticksPerSecond, 1_000_000);
  const source = p.targetArtifact.path; closed(source); assert.equal(fileHash(source), p.targetArtifact.sha256);
  const path = join(request.outputDirectory, 'normal-models.sqlite'); assert(!existsSync(path)); copyFileSync(source, path, constants.COPYFILE_EXCL);
  let phase = 0; const progress = (name: string, evidence: unknown) => writeExecutionViewArtifact(join(request.outputDirectory, `checkpoint-${String(++phase).padStart(2,'0')}-${name}.json`),
    { version: 'same_pa_normal_model_progress_v1', phase: name, at: new Date().toISOString(), aggregateQualified: false, evidence });
  const db = new Native(path), stores: { close(): void }[] = [], track = <T extends { close(): void }>(s: T): T => { stores.push(s); return s; };
  let accounting: ReturnType<typeof observeTerminalWorkloadConnectionChanges> | undefined, witness: ReturnType<typeof witnessSqliteWrite> | undefined;
  const nativeWriters = new Set<DatabaseSync>(); let writes = 0, accepting = false; const accepted: { owner: string; value: { source: { sourceId: string } }; reference: SamePaReference }[] = [];
  const callbacks: { owner: string; sourceId: string }[] = [];
  const lookup = <T>(owner: Owner, id: string): T | null => { callbacks.push({ owner, sourceId: id }); return p.defenderSources.find(e => e.owner === owner && e.source.sourceId === id)?.source as T ?? null; };
  const bodyLookup = <T extends { sourceId: string }>(owner: string, value: T, id: string) => { callbacks.push({ owner, sourceId: id }); return id === value.sourceId ? value : null; };
  try {
    const before = withSqliteReadTransaction(db, () => { assertBodyCompositionNativeConnection(db); const people = playerPersonLinkEvidenceFromSqlite(db);
      for (const t of p.targetScope) { assert.equal(hash(t.binding), t.member.bindingHash); assert.equal(hash(t.person), t.member.personHash); same(people.readLink(t.binding.personLinkSourceId), t.person); }
      for (const table of tables) assert.equal(db.prepare('SELECT count(*) n FROM main.sqlite_master WHERE lower(name)=lower(?) OR lower(tbl_name)=lower(?)').get(table,table)!.n, 0);
      return { rows: rawCensus(db), schema: schemaCensus(db) };
    });
    progress('prerequisites-authenticated', { input, originalRowsHash: hash(before.rows), originalSchemaHash: hash(before.schema), independentlyCommittedRowsExpected: 38 });
    accounting = observeTerminalWorkloadConnectionChanges();
    witness = witnessSqliteWrite(/^\s*(?:INSERT|UPDATE|DELETE|REPLACE)\b/i, connection => {
      assert(accepting, 'unexpected normal owner effect outside first acceptance'); assert(connection.isTransaction);
      assert.equal(connection.prepare('PRAGMA database_list').all().find(v => v.name === 'main')?.file, path);
      nativeWriters.add(connection); writes++; return true;
    });
    const fielding = track(openSqlitePlayerFieldingModelStore(path, { readAcceptedModel: id => lookup('world_player_fielding_models', id) }));
    const observation = track(openSqlitePlayerObservationModelStore(path, { readAcceptedModel: id => lookup('world_player_observation_models', id) }));
    const decision = track(openSqlitePlayerDecisionModelStore(path, { readAcceptedModel: id => lookup('world_player_decision_models', id) }));
    const locomotion = track(openSqlitePlayerLocomotionModelStore(path, { readAcceptedModel: id => lookup('world_player_locomotion_models', id) }));
    const body = track(openSqlitePlayerBodyCapabilityMaterializationStore(path, {
      readAcceptedMaterialization: id => bodyLookup('bodyMaterialization', b.bodyMaterialization, id), readAcceptedBody: id => bodyLookup('body', b.body, id),
      readAcceptedPose: id => bodyLookup('pose', b.pose, id), readAcceptedReachCalibration: id => bodyLookup('reachCalibration', b.reachCalibration, id),
    }));
    const batting = track(openSqlitePlayerBattingModelStore(path, {
      readAcceptedModel: id => bodyLookup('battingModel', b.model, id), readAcceptedCapability: id => bodyLookup('capability', b.capability, id),
      readAcceptedRepertoire: id => bodyLookup('repertoire', b.repertoire, id), readAcceptedDecisionModel: id => bodyLookup('decisionModel', b.decisionModel, id),
      readAcceptedEquipment: id => bodyLookup('equipment', b.equipment, id), readAcceptedObservationCalibration: id => bodyLookup('observationCalibration', b.observationCalibration, id),
      readAcceptedPredictionCalibration: id => bodyLookup('predictionCalibration', b.predictionCalibration, id),
    }));
    accounting.assertChanges(0); same(rawCensus(db, tables), before.rows);
    const expectedRows = new Map<string, ReturnType<typeof rawCensus>[number]['rows']>(tables.map(t => [t, []]));
    const verifyRows = () => { same(rawCensus(db, tables), before.rows); for (const table of tables) {
      const rows = db.prepare(`SELECT rowid AS __ack_rowid,* FROM main.${table} ORDER BY rowid`).all(); same(rows, expectedRows.get(table)); }
      accounting!.assertChanges(writes); assert.equal(changes(db), 0); assert([...nativeWriters].every(c => !c.isTransaction));
    };
    const accept = (owner: string, sourceId: string, action: () => { source: { sourceId: string } }, observed?: SamePaReference) => {
      const previous = writes; accepting = true; let value: { source: { sourceId: string } };
      try { value = action(); } finally { accepting = false; }
      assert.equal(writes, previous + 1); assert.equal(value.source.sourceId, sourceId);
      const row = db.prepare(`SELECT rowid AS __ack_rowid,* FROM main.${owner} WHERE source_id=?`).get(sourceId); assert(row);
      assert.equal(row.__ack_rowid, expectedRows.get(owner)!.length + 1); expectedRows.get(owner)!.push(row);
      const ref = reference(owner, value); if (observed) same(ref, observed); accepted.push({ owner, value, reference: ref }); verifyRows();
      progress('normal-owner-returned', { ordinal: accepted.length, owner, reference: ref, committedByNormalOwner: true, actualStatementCount: writes });
    };
    const normal = { world_player_fielding_models: fielding, world_player_observation_models: observation, world_player_decision_models: decision, world_player_locomotion_models: locomotion };
    for (const owner of Object.keys(normal) as Owner[]) for (const e of p.defenderSources.filter(e => e.owner === owner)) accept(owner, e.source.sourceId, () => normal[owner].accept(e.source.sourceId), e.observedReference);
    accept('world_player_body_materializations', b.bodyMaterialization.sourceId, () => { const result = body.accept(b.bodyMaterialization.sourceId); assert.equal(result.kind, 'materialized'); if (result.kind !== 'materialized') throw new Error('accepted body inputs remain pending'); return result.value; });
    accept('world_player_batting_models', b.model.sourceId, () => batting.accept(b.model.sourceId));
    assert.equal(writes, 38); assert.equal(nativeWriters.size, 6); assert.equal(accepted.length, 38);
    for (const table of tables) assert.equal(expectedRows.get(table)!.length, p.exactExpectedRows[table]);
    const afterSchema = schemaCensus(db), added = afterSchema.main.filter(row => tables.includes(String(row.tbl_name)));
    same(afterSchema.main.filter(row => !tables.includes(String(row.tbl_name))), before.schema.main); same(afterSchema.temp, before.schema.temp);
    assert.equal(afterSchema.mainVersion, Number(before.schema.mainVersion) + 7); assert.equal(afterSchema.tempVersion, before.schema.tempVersion); assert.equal(afterSchema.userVersion, before.schema.userVersion);
    assert.equal(added.filter(r => r.type === 'table').length, 7); assert.equal(added.filter(r => r.type === 'index' && r.sql === null && String(r.name).startsWith('sqlite_autoindex_')).length, 12); assert.equal(added.length, 19);
    for (const row of accepted) { const value = row.owner === 'world_player_body_materializations' ? body.accept(row.value.source.sourceId) : row.owner === 'world_player_batting_models' ? batting.accept(row.value.source.sourceId) : normal[row.owner as Owner].accept(row.value.source.sourceId);
      same(row.owner === 'world_player_body_materializations' && 'kind' in value && value.kind === 'materialized' ? value.value : value, row.value); }
    verifyRows(); same(schemaCensus(db), afterSchema); progress('exact-retries-closed', { writes, references: accepted.map(v => v.reference), authorityCalls: callbacks.length });
    witness.close(); witness = undefined; accounting.close(); accounting = undefined;
    while (stores.length) stores.pop()!.close(); assert([...nativeWriters].every(c => !c.isOpen)); db.close(); closed(path); const committedHash = fileHash(path);
    const reopened = new Native(path); accounting = observeTerminalWorkloadConnectionChanges();
    try {
      const normalReads = { world_player_fielding_models: track(openSqlitePlayerFieldingModelStore(path)), world_player_observation_models: track(openSqlitePlayerObservationModelStore(path)),
        world_player_decision_models: track(openSqlitePlayerDecisionModelStore(path)), world_player_locomotion_models: track(openSqlitePlayerLocomotionModelStore(path)) };
      const bodyRead = track(openSqlitePlayerBodyCapabilityMaterializationStore(path)), battingRead = track(openSqlitePlayerBattingModelStore(path));
      for (const row of accepted) { const value = row.owner === 'world_player_body_materializations' ? bodyRead.read(row.value.source.sourceId) : row.owner === 'world_player_batting_models' ? battingRead.read(row.value.source.sourceId) : normalReads[row.owner as Owner].read(row.value.source.sourceId); same(value, row.value); }
      accounting.assertUnchanged(); same(schemaCensus(reopened), afterSchema); same(rawCensus(reopened, tables), before.rows);
      for (const table of tables) same(reopened.prepare(`SELECT rowid AS __ack_rowid,* FROM main.${table} ORDER BY rowid`).all(), expectedRows.get(table));
      accounting.close(); accounting = undefined;
    } finally { if (accounting) { accounting.close(); accounting = undefined; } while (stores.length) stores.pop()!.close(); reopened.close(); }
    closed(path); assert.equal(fileHash(path), committedHash); closed(source); assert.equal(fileHash(source), p.targetArtifact.sha256);
    for (const f of [input.proposal, input.qualifiedPrerequisites, ...Object.values(qualified.qualification)]) assert.equal(fileHash(f.path), f.sha256); assert.equal(fileHash(request.inputPath), request.inputSha256);
    progress('closed', { destinationSha256: committedHash, closedHandles: true, closedSidecars: true, originalInputUnchanged: true, writes: 38 });
    return { version: 'same_pa_normal_model_acceptance_receipt_v1', input, targetArtifact: p.targetArtifact, destinationPath: path, destinationSha256: committedHash,
      normalModelReferences: accepted.map(v => v.reference), acceptedSourceCount: 47, newNormalOwnerRows: 38, newTables: 7, newAutoindexes: 12, actualStatements: writes,
      normalOwnersCommittedIndependently: true, crossOwnerAtomicityClaim: false, exactRetry: true, authorityFreeNormalReopen: true, previousRowsAndRowidsPreserved: true,
      closedHandles: true, closedSidecars: true, inputBytesUnchanged: true, nominalModelsQualified: true, effectiveCalibrationAccepted: false, gameplayRowsTransferred: false,
      policyReference: null, physicalExecutionQualified: false, admissionOrRightWritten: false, fixtureOnly: true, productionCalibrationClaim: false };
  } finally {
    witness?.close(); accounting?.close(); while (stores.length) stores.pop()!.close(); if (db.isOpen) db.close();
  }
};
