import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { constants, copyFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import type { SamePaExecutionView } from './SamePlateAppearanceExecutionView';
import type { SamePaDispatchRoleBinding } from './SamePlateAppearanceDispatchRoles';
import type { SamePaReference } from './SamePlateAppearanceWorkPrefix';
import type { OfficialParticipantBinding } from './SqliteOfficialParticipationStore';
import { playerPersonLinkEvidenceFromSqlite } from './SqlitePlayerPersonLinkStore';
import { playerFieldingModelEvidenceFromSqlite } from './SqlitePlayerFieldingModelStore';
import { playerObservationModelEvidenceFromSqlite } from './SqlitePlayerObservationModelStore';
import { playerDecisionModelEvidenceFromSqlite } from './SqlitePlayerDecisionModelStore';
import { playerLocomotionModelEvidenceFromSqlite } from './SqlitePlayerLocomotionModelStore';
import { classifyFieldingNamespace } from './SamePlateAppearanceFieldingNamespace.test-support';
import { classifyFieldModelNamespace } from './SamePlateAppearanceModelNamespace.test-support';
import { assertBodyCompositionNativeConnection } from './BodyMaterializationSqliteOwnership';
import { nominalClaim } from './DispatchNominalSqliteOwnership';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';
import { rawCensus, schemaCensus, fileHash } from './ActualFoulTerminalAcknowledgementCutover.test-support';
import { writeExecutionViewArtifact } from './SamePlateAppearanceExecutionViewGate.test-support';
type FileRef = Readonly<{ path: string; sha256: string }>;
type Input = Readonly<{ version: 'same_pa_normal_prerequisite_inventory_input_v1'; targetInventory: FileRef; targetView: FileRef; candidateGeometryQualification: FileRef }>;
type Inventory = Readonly<{ qualified: true; artifact: FileRef; qualification: Record<string, FileRef>;
  inventory: { viewReference: SamePaReference; actorReference: SamePaReference; roles: readonly SamePaDispatchRoleBinding[] } }>;
const Native = (createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync;
const same = (a: unknown, b: unknown) => assert.equal(json(a), json(b));
const pinned = <T>(ref: FileRef): T => { assert.equal(fileHash(ref.path), ref.sha256); return JSON.parse(readFileSync(ref.path, 'utf8')) as T; };
const closed = (path: string) => { for (const suffix of ['-wal', '-shm', '-journal']) assert(!existsSync(path + suffix), 'prerequisite input sidecar exists'); };
const terminal = (ref: FileRef) => {
  const t = pinned<{ status: string; originalChildExit: number; failures: unknown[]; remainingOwnedProcesses: unknown[]; tests: { passedCases: number } }>(ref);
  assert.equal(t.status, 'passed'); assert.equal(t.originalChildExit, 0); same(t.failures, []); same(t.remainingOwnedProcesses, []); assert.equal(t.tests.passedCases, 1);
};
const fielding = (db: import('node:sqlite').DatabaseSync, binding: OfficialParticipantBinding, state: 'present' | 'pristine') => {
  if (state === 'pristine') return { status: 'pristine_namespace' as const, model: null };
  try { return { status: 'owned' as const, model: playerFieldingModelEvidenceFromSqlite(db).selectAtDay(binding.careerId, binding.playerId, binding.gameDay) }; }
  catch (error) { if (!(error instanceof Error) || error.message !== 'accepted Player fielding baseline is missing') throw error;
    return { status: 'missing_normal_baseline' as const, normalOwnerAbsence: error.message, model: null }; }
};

/** Two independent, read-only normal-owner inventories. The earlier view's exact
 * closed bytes and observed member hashes define requested scope; no cached actor
 * proof or peer snapshot is supplied to any owner. This confers no write/admission. */
export const verifySamePaNormalPrerequisites = (request: { inputPath: string; inputSha256: string; outputDirectory: string }) => {
  assert(process.env.BASEBALL_GATE_RUNTIME && process.env.BASEBALL_GATE_LOCKS, 'bounded private controller required');
  const input = pinned<Input>({ path: request.inputPath, sha256: request.inputSha256 }); assert.equal(input.version, 'same_pa_normal_prerequisite_inventory_input_v1');
  const inventory = pinned<Inventory>(input.targetInventory); assert.equal(inventory.qualified, true);
  for (const f of Object.values(inventory.qualification)) assert.equal(fileHash(f.path), f.sha256);
  terminal(inventory.qualification.nativeTerminal);
  const prior = pinned<{ modelInventoryQualified: boolean; inventory: Inventory['inventory']; destinationSha256: string; closedHandles: boolean; closedSidecars: boolean; totalChanges: number }>(inventory.qualification.receipt);
  assert(prior.modelInventoryQualified && prior.closedHandles && prior.closedSidecars); assert.equal(prior.totalChanges, 0); same(prior.inventory, inventory.inventory); assert.equal(prior.destinationSha256, inventory.artifact.sha256);
  const view = pinned<{ qualified: true; artifact: FileRef; viewReference: SamePaReference; view: SamePaExecutionView }>(input.targetView);
  assert.equal(view.qualified, true); same(view.viewReference, inventory.inventory.viewReference); assert.equal(view.artifact.sha256, inventory.artifact.sha256);
  const candidate = pinned<{ status: string; closedOutput: FileRef; receipt: FileRef; terminal: FileRef }>(input.candidateGeometryQualification);
  assert.equal(candidate.status, 'passed'); terminal(candidate.terminal);
  const candidateReceipt = pinned<{ destinationPath: string; destinationSha256: string; allConnectionsClosedReopened: boolean; verified: boolean }>(candidate.receipt);
  assert(candidateReceipt.allConnectionsClosedReopened && candidateReceipt.verified); same(candidate.closedOutput, { path: candidateReceipt.destinationPath, sha256: candidateReceipt.destinationSha256 });
  const roles = inventory.inventory.roles; assert.equal(roles.length, 10); assert.equal(new Set(roles.map(r => r.member.playerId)).size, 10);
  let checkpoint = 0;
  const progress = (phase: string, evidence: unknown) => writeExecutionViewArtifact(join(request.outputDirectory, `checkpoint-${++checkpoint}-${phase}.json`),
    { version: 'same_pa_normal_prerequisite_inventory_progress_v1', phase, at: new Date().toISOString(), aggregateQualified: false, evidence });
  const inspectCopy = <T>(original: FileRef, name: string, body: (db: import('node:sqlite').DatabaseSync) => T): T => {
    closed(original.path); assert.equal(fileHash(original.path), original.sha256); const path = join(request.outputDirectory, name + '.sqlite'); assert(!existsSync(path));
    copyFileSync(original.path, path, constants.COPYFILE_EXCL); const db = new Native(path);
    let result: T;
    try { result = withSqliteReadTransaction(db, () => { assertBodyCompositionNativeConnection(db); const rows = rawCensus(db), schema = schemaCensus(db);
      assert.equal(db.prepare('SELECT total_changes() n').get()!.n, 0); const value = body(db);
      same(rawCensus(db), rows); same(schemaCensus(db), schema); assert.equal(db.prepare('SELECT total_changes() n').get()!.n, 0); return value;
    }); assert.equal(db.isTransaction, false); } finally { db.close(); }
    assert(!db.isOpen); closed(path); assert.equal(fileHash(path), original.sha256); closed(original.path); assert.equal(fileHash(original.path), original.sha256); return result;
  };
  progress('started', { target: inventory.artifact, candidate: candidate.closedOutput, requestedMembers: roles.map(r => r.member) });
  const target = inspectCopy(inventory.artifact, 'target', db => {
    const people = playerPersonLinkEvidenceFromSqlite(db), fieldingState = classifyFieldingNamespace(db);
    return roles.map(role => {
      const rows = db.prepare(`SELECT * FROM main.official_participant_bindings WHERE (game_id=$game AND player_id=$player)
        OR (${nominalClaim('binding_json', ['gameId'], '$game')} AND ${nominalClaim('binding_json', ['playerId'], '$player')})`)
        .all({ game: view.view.lineage.gameId, player: role.member.playerId }); assert.equal(rows.length, 1);
      const binding = JSON.parse(String(rows[0].binding_json)) as OfficialParticipantBinding;
      assert.equal(binding.gameId, view.view.lineage.gameId); assert.equal(binding.careerId, view.view.lineage.careerId); assert.equal(binding.playerId, role.member.playerId);
      assert.equal(rows[0].game_id, binding.gameId); assert.equal(rows[0].player_id, binding.playerId); assert.equal(hash(binding), role.member.bindingHash);
      const person = people.readLink(binding.personLinkSourceId); assert(person); assert.equal(hash(person), role.member.personHash);
      assert.equal(person.careerId, binding.careerId); assert.equal(person.playerId, binding.playerId); assert.equal(person.personId, binding.personId); assert(person.acceptedAtDay <= binding.gameDay);
      const model = role.role === 'batter' ? null : fielding(db, binding, fieldingState); if (model?.model) same(model.model.person, person);
      return { role: role.role, member: role.member, binding, person, fielding: model };
    });
  });
  progress('target-identities-returned', { target, newOwnerRows: 0 });
  const candidateModels = inspectCopy(candidate.closedOutput, 'candidate', db => {
    const state = classifyFieldingNamespace(db), states = { observation: classifyFieldModelNamespace(db, 'observation'), decision: classifyFieldModelNamespace(db, 'decision'), locomotion: classifyFieldModelNamespace(db, 'locomotion') };
    return target.filter(t => t.role !== 'batter').map(t => {
      const base = fielding(db, t.binding, state); if (base.model) same(base.model.person, t.person);
      const routes = [
        { kind: 'observation', owner: 'world_player_observation_models', reader: () => playerObservationModelEvidenceFromSqlite(db) },
        { kind: 'decision', owner: 'world_player_decision_models', reader: () => playerDecisionModelEvidenceFromSqlite(db) },
        { kind: 'locomotion', owner: 'world_player_locomotion_models', reader: () => playerLocomotionModelEvidenceFromSqlite(db) },
      ] as const;
      const models = routes.map(route => {
        if (states[route.kind] === 'pristine') return { route: route.kind, status: 'pristine_namespace' as const };
        try { const model = route.reader().selectAtDay(t.binding.careerId, t.binding.playerId, t.binding.gameDay); same(model.fieldingModel, base.model); same(model.fieldingModel.person, t.person);
          return { route: route.kind, status: 'owned_candidate' as const, source: model.source, modelReference: reference(route.owner, model),
            fieldingReference: reference('world_player_fielding_models', model.fieldingModel), sameTargetFieldingSource: t.fielding?.model ? json(t.fielding.model) === json(model.fieldingModel) : null };
        } catch (error) { if (!(error instanceof Error) || error.message !== `accepted Player ${route.kind} baseline is missing`) throw error;
          return { route: route.kind, status: 'missing_normal_baseline' as const, normalOwnerAbsence: error.message }; }
      });
      return { playerId: t.binding.playerId, personHash: hash(t.person), fielding: base, models };
    });
  });
  progress('candidate-originals-returned', { candidateModels, newOwnerRows: 0, sourceReuseAccepted: false });
  for (const f of [input.targetInventory, input.targetView, input.candidateGeometryQualification, ...Object.values(inventory.qualification), candidate.receipt, candidate.terminal]) assert.equal(fileHash(f.path), f.sha256);
  assert.equal(fileHash(request.inputPath), request.inputSha256);
  progress('closed', { allConnectionsClosed: true, sidecarsAbsent: true, exactInputAndCopyBytesPreserved: true, totalChanges: 0 });
  return { version: 'same_pa_normal_prerequisite_inventory_receipt_v1', input, targetArtifact: inventory.artifact, candidateArtifact: candidate.closedOutput,
    target, candidateModels, totalChanges: 0, newTables: 0, priorRowsAndRowidsPreserved: true, closedHandles: true, closedSidecars: true, inputBytesUnchanged: true,
    normalOwnerInventoryQualified: true, sourceReuseAccepted: false, modelAcceptancePerformed: false, policyReference: null, policyInputStatus: 'pending_owned_pitch_lineage_policy_reference',
    gameplayRowsTransplanted: false, actorOrViewRequalificationClaim: false, physicalExecutionQualified: false };
};
