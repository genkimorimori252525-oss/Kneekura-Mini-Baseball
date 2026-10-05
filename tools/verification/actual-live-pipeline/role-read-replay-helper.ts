import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { closeSync, existsSync, lstatSync, openSync, readSync, readdirSync, readlinkSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, normalize } from 'node:path';
import { performance } from 'node:perf_hooks';
import { withSqliteReadTransaction } from '../../../src/host/world/SqliteReadTransaction.test-support';
import { actualRoleWorkloadEvidenceFromSqlite } from '../../../src/host/world/ActualRoleWorkloadEvidenceFromSqlite';
import { assertActualLiveClosureStage, type ActualLivePlayClosureProposal } from '../../../src/host/world/ActualLivePlayClosureEvidenceFromSqlite';
import { readActualRoleWorkloadState } from '../../../src/host/world/ActualRoleWorkloadState';
import { actorHash as hash, actorJson as json } from '../../../src/host/world/PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { OfficialReadReplayResult, OriginalOfficialReplayReceipt, ReplayArtifactFacts, ReplayPass } from './official-read-replay-helper';
export type OriginalRoleReplayReceipt = Readonly<{ settlement: ReturnType<ReturnType<typeof actualRoleWorkloadEvidenceFromSqlite>['readSettlement']>; output: ReplayArtifactFacts }>;
export type RoleReadReplayInput = Readonly<{ artifactPath: string; artifactSha256: string; expectedSettlementSha256: string;
  roleReceipt: OriginalRoleReplayReceipt; originalReceipt: OriginalOfficialReplayReceipt; progress?: (message: string) => void }>;
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const fileHash = (path: string) => {
  const hash=createHash('sha256'), fd=openSync(path,'r'), buffer=Buffer.allocUnsafe(1024*1024);
  try { for (;;) { const count=readSync(fd,buffer,0,buffer.length,null);if(!count)break;hash.update(buffer.subarray(0,count)); } }
  finally { closeSync(fd); }
  return hash.digest('hex');
};
const artifactHandles = (path: string) => readdirSync('/proc/self/fd').flatMap(fd => {
  try { const target=readlinkSync(`/proc/self/fd/${fd}`);return [path,`${path}-wal`,`${path}-shm`].includes(target)?[{fd,target}]:[]; }
  catch { return []; }
});
const closedArtifact = (path: string, expectedHash: string) => {
  assert(isAbsolute(path) && normalize(path)===path && realpathSync(path)===path && lstatSync(path).isFile(),'replay artifact path identity differs');
  const walBytes=existsSync(`${path}-wal`)?statSync(`${path}-wal`).size:null;
  assert(walBytes===null || walBytes===0,'replay artifact WAL is not empty');
  assert.deepEqual(artifactHandles(path),[],'replay artifact has an open handle');
  assert.equal(fileHash(path),expectedHash,'replay artifact hash differs');return walBytes;
};

/** Reauthenticate the closed role artifact twice through the normal settlement
 * owner. Provenance/Source admission remains the caller's responsibility. This
 * never reads readiness or accepts a new actor, pitch or workload activity. */
export const verifyActualRoleReadReplay = (input: RoleReadReplayInput): OfficialReadReplayResult => {
  const path = input.artifactPath, role = input.roleReceipt, original = input.originalReceipt, progress = input.progress ?? (() => {});
  assert.match(input.artifactSha256, /^[a-f0-9]{64}$/); assert.equal(role.output.path, path, 'role artifact path differs');
  assert.equal(role.output.sha256, input.artifactSha256, 'role artifact hash differs');
  assert.equal(role.settlement.kind, 'complete');
  if (role.settlement.kind !== 'complete') throw new Error('role replay requires complete settlement');
  assert.equal(hash(role.settlement), input.expectedSettlementSha256, 'sealed settlement digest differs');
  assert.equal(role.settlement.participants.length, 10); assert(role.settlement.participants.every(p => p.applied));
  assert.equal(role.settlement.closureSourceId, original.closureSourceId); assert.equal(role.settlement.closureApplicationId, original.applicationId);
  assert.deepEqual(role.settlement.physicalEndReference, original.adjudicationEvidence.physicalEndReference);
  assert.deepEqual(role.settlement.wholeHistoryReference, original.adjudicationEvidence.wholeHistoryReference);
  const passes: ReplayPass[] = [], executed = { readOnlyConnections: 0, readTransactions: 0, settlementReads: 0, currentHeadReads: 0,
    officialHelperCalls: 0, roleHelperCalls: 0, nextHelperCalls: 0, newOfficialApplications: 0, newWorkloadActivities: 0, newPhysicalPitchActions: 0 };
  for (let index = 0; index < 2; index++) {
    const walBytesBefore = closedArtifact(path, input.artifactSha256), started = performance.now(), db = new DatabaseSync(path, { readOnly: true });
    executed.readOnlyConnections++; let observation: Readonly<Record<string, unknown>>;
    try {
      progress(`read pass ${index + 1}: opened a fresh read-only connection`); executed.readTransactions++;
      observation = withSqliteReadTransaction(db, () => {
        assert.equal(db.isTransaction, true); assert.equal(db.prepare('PRAGMA query_only').get()!.query_only, 1);
        assert.equal(db.prepare('PRAGMA database_list').all().find(row => row.name === 'main')!.file, path);
        assert.equal(db.prepare('PRAGMA journal_mode').get()!.journal_mode, 'wal');
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(row => String(row.name));
        const rowCounts = Object.fromEntries(tables.map(name => [name, Number(db.prepare(`SELECT count(*) AS n FROM "${name.replaceAll('"', '""')}"`).get()!.n)]));
        assert.deepEqual(rowCounts, role.output.rowCounts, 'role replay census differs');
        for (const name of ['actual_role_workload_assessments', 'world_player_workload_activities']) assert.equal(rowCounts[name], 10, 'role replay effect census differs');
        for (const name of ['actual_role_workload_settlements', 'applications', 'physical_pitch_progress_actions', 'physical_plate_appearance_actors', 'actual_first_base_play_ends', 'actual_live_play_fences'])
          assert.equal(rowCounts[name], 1, 'role replay bounded census differs');
        const workloadActivityKinds = db.prepare("SELECT json_extract(source_json,'$.kind') AS kind,count(*) AS n FROM world_player_workload_activities GROUP BY kind ORDER BY kind").all()
          .map(row => ({ kind: String(row.kind), n: Number(row.n) }));
        assert.deepEqual(workloadActivityKinds, [{ kind: 'MATCH', n: 10 }]); assert.deepEqual(workloadActivityKinds, role.output.workloadActivityKinds);
        progress(`read pass ${index + 1}: authenticating the sealed role settlement`); executed.settlementReads++;
        const settlement = actualRoleWorkloadEvidenceFromSqlite(db).readSettlement(original.closureSourceId);
        assert.deepEqual(settlement, role.settlement, 'normal owner settlement differs from sealed DTO');
        assert.equal(hash(settlement), input.expectedSettlementSha256, 'normal settlement digest differs');
        if (settlement.kind !== 'complete') throw new Error('role replay settlement is incomplete');
        // The owner just authenticated this exact proposal. Re-read its bound
        // archive on the same snapshot to require the current official head,
        // without performing a second expensive physical closure reconstruction.
        const row = db.prepare('SELECT proposal_json,proposal_hash FROM actual_live_play_closures WHERE source_id=?').get(original.closureSourceId); assert(row);
        const proposal = JSON.parse(String(row.proposal_json)) as ActualLivePlayClosureProposal;
        assert.equal(row.proposal_json, json(proposal)); assert.equal(row.proposal_hash, hash(proposal));
        assert.equal(row.proposal_hash, settlement.closureProposalHash, 'authenticated closure proposal differs');
        assert.equal(proposal.source.sourceId, original.closureSourceId); assert.equal(proposal.application.applicationId, original.applicationId);
        assert.deepEqual(proposal.expectedOfficial.receipt, original.officialReceipt);
        assertActualLiveClosureStage(db, proposal, true, true);
        const currentHeads = settlement.participants.map(participant => {
          const actor = proposal.actors.find(value => value.binding.playerId === participant.playerId); assert(actor);
          assert.equal(actor.person.personId, participant.personId); assert.equal(actor.binding.clubId, participant.clubId);
          executed.currentHeadReads++;
          const head = readActualRoleWorkloadState(db, settlement.careerId, participant.playerId, undefined, actor.binding.personLinkSourceId);
          assert.deepEqual(head, participant.after, 'current workload head differs from sealed AFTER'); return head;
        });
        assert.equal(db.prepare('SELECT total_changes() AS n').get()!.n, 0, 'role replay wrote changes');
        return { settlement, currentHeads, artifact: { path, sha256: input.artifactSha256, realDisk: true, mainFilename: path,
          journalMode: 'wal', rowCounts, workloadActivityKinds, wrapperReadOnlyOpenClosedVerified: true } };
      });
      assert.equal(db.isTransaction, false, 'role replay transaction remains open');
    } finally { if (db.isOpen) db.close(); }
    assert.equal(db.isOpen, false); const walBytesAfter = closedArtifact(path, input.artifactSha256);
    if (index === 1) assert.deepEqual(observation, passes[0].observation, 'reopened role replay observation differs');
    passes.push({ index, connectionId: index + 1, readOnly: true, queryOnly: true, transactionOwned: true, transactionClosed: true,
      connectionClosed: true, totalChanges: 0, walBytesBefore, walBytesAfter, artifactSha256Before: input.artifactSha256,
      artifactSha256After: input.artifactSha256, seconds: (performance.now() - started) / 1000, observation, observationSha256: hash(observation) });
    progress(`read pass ${index + 1}: transaction and connection closed; original bytes preserved`);
  }
  return { passes, executed, checks: { artifactUnchanged: true, closeReopenEqual: true, readOnlyEnforced: true }, openSqliteHandles: artifactHandles(path) };
};
