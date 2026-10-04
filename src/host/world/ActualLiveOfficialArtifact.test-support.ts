import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { actualFirstBaseClosedEvidenceFromSqlite } from './SqliteActualFirstBasePlayEndStore';
import { battedWorldFieldEvidenceFromSqlite } from './SqliteBattedWorldFieldStore';
import { actualLiveAdjudicationEvidenceFromSqlite } from './ActualLiveAdjudicationFromSqlite';
import { openSqliteActualLiveAdjudicationStore } from './SqliteActualLiveAdjudicationStore';
import { openSqliteActualLivePlayClosureStore } from './SqliteActualLivePlayClosureStore';
import { assertPriorPhysicalClosureCompleted } from './PhysicalPlayClosureEvidenceFromSqlite';
import type { AcceptedActualLiveAdjudication } from './ActualLiveAdjudicationSource';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
const { DatabaseSync, backup } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const fileHash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
/** Scheduled original-chain integration only. Source must already contain its
 * independently authenticated closed physical end; this harness cannot mint one. */
export const verifyActualLiveOfficialArtifact = async (input: Readonly<{
  sourcePath: string; destinationPath: string; physicalEndSourceId: string; faultChecks: boolean; progress?: (message: string) => void;
}>) => {
  assert.notEqual(input.sourcePath, input.destinationPath); assert.equal(existsSync(input.destinationPath), false);
  mkdirSync(dirname(input.destinationPath), { recursive: true });
  const originalHash = fileHash(input.sourcePath), sourceDb = new DatabaseSync(input.sourcePath, { readOnly: true });
  try { await backup(sourceDb, input.destinationPath); } finally { sourceDb.close(); }
  let db = new DatabaseSync(input.destinationPath); const report = input.progress ?? (() => {});
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()
    .map(r => String(r.name)).filter(name => !['matches', 'applications'].includes(name));
  const rows = () => tables.map(name => ({ table: name, hash: hash(db.prepare(`SELECT * FROM ${quote(name)} ORDER BY rowid`).all()) }));
  const before = rows(), beforeApplications = Number(db.prepare('SELECT count(*) AS n FROM applications').get()!.n);
  let adjudications: ReturnType<typeof openSqliteActualLiveAdjudicationStore> | null = null;
  let closures: ReturnType<typeof openSqliteActualLivePlayClosureStore> | null = null;
  let result: ReturnType<ReturnType<typeof openSqliteActualLivePlayClosureStore>['resume']> | null = null;
  const closureSourceId = 'fixture-actual-live-closure', applicationId = 'fixture-actual-live-application';
  try {
    report('authenticating the original persisted physical end on the copied connection');
    const end = actualFirstBaseClosedEvidenceFromSqlite(db).read(input.physicalEndSourceId); assert(end);
    const field = battedWorldFieldEvidenceFromSqlite(db).read(end.source.baseFieldSourceId)!;
    const frame = field.response.touch.worldContact.flight.physicalPitch.frame;
    const source: AcceptedActualLiveAdjudication = { sourceId: 'fixture-actual-live-adjudication', sourceVersion: 'fixture-v1', physicalEndSourceId: end.source.sourceId,
      policy: { sourceId: 'explicit-fixture-official-policy', sourceVersion: 'fixture-v1', ruleProfileId: frame.match.ruleProfileId,
        officialWindows: { appeal: { available: true }, review: { available: false }, challenge: { available: false } } } };
    // Absence is not false. Check production policy without persisting an immutable pending checkpoint.
    assert.equal(actualLiveAdjudicationEvidenceFromSqlite(db).derive({ ...source, policy: null }).kind, 'official_pending');
    adjudications = openSqliteActualLiveAdjudicationStore(input.destinationPath, { readAcceptedAdjudication: id => id === source.sourceId ? source : null });
    if (input.faultChecks) {
      db.exec("CREATE TRIGGER corrupt_actual_adjudication_dependency AFTER INSERT ON actual_live_adjudications BEGIN UPDATE actual_first_base_play_ends SET snapshot_hash='corrupt'; END;");
      assert.throws(() => adjudications!.accept(source.sourceId));
      assert.equal(Number(db.prepare('SELECT count(*) AS n FROM actual_live_adjudications').get()!.n), 0);
      db.exec('DROP TRIGGER corrupt_actual_adjudication_dependency'); assert.deepEqual(rows(), before);
    }
    report('importing original call/rule provenance with explicit fixture profile');
    const adjudication = adjudications.accept(source.sourceId); assert.equal(adjudication.kind, 'official_ready');
    assert.equal(adjudication.timeline.kind, 'projected');
    if (adjudication.timeline.kind !== 'projected') throw new Error('expected projected original timeline');
    assert.deepEqual(adjudication.timeline.timeline.events.slice(0, end.wholeHistory.originalTimeline.events.length), end.wholeHistory.originalTimeline.events);
    const imported = adjudication.ledger.events.find(e => e.kind === 'OwnedLiveCallImported'); assert(imported?.kind === 'OwnedLiveCallImported');
    assert(imported.provenance.calledAtElapsedSeconds < imported.provenance.importedAtElapsedSeconds);
    assert.deepEqual(imported.provenance.ruleEvidence, end.firstBaseEvidenceApplicability.rule);
    const closureSource = { sourceId: closureSourceId, sourceVersion: 'fixture-v1', adjudicationSourceId: source.sourceId, applicationId,
      closureTick: end.playEnd.tick + 1, nextStartedAtTick: end.playEnd.tick + 2, controllerReset: 'rule_system_retire_original_play' as const,
      worldSetup: { baseCenters: Object.fromEntries((['first', 'second', 'third'] as const).map(base => [base, field.geometry.geometry.baseGeometry.bases[base].region.center])) as
          { first: { x: number; z: number }; second: { x: number; z: number }; third: { x: number; z: number } },
        defenders: frame.world.defenders.map(d => ({ playerId: d.playerId, registeredPosition: d.registeredPosition, position: d.position })),
        activePreviousPlayControllerIds: [] } };
    closures = openSqliteActualLivePlayClosureStore(input.destinationPath, { readAcceptedClosure: id => id === closureSourceId ? closureSource : null });
    const queued = closures.enqueue(closureSourceId); assert.equal(queued.status, 'QUEUED'); assert.equal(queued.officialApplied, false);
    assert.equal(Number(db.prepare('SELECT count(*) AS n FROM applications').get()!.n), beforeApplications);
    adjudications.close(); adjudications = null; closures.close(); closures = null; db.close();
    report('all pre-application connections closed; reopening the same queued disk');
    db = new DatabaseSync(input.destinationPath); closures = openSqliteActualLivePlayClosureStore(input.destinationPath);
    assert.equal(db.prepare('PRAGMA journal_mode').get()!.journal_mode, 'wal');
    assert.equal(db.prepare('PRAGMA database_list').all().find(r => r.name === 'main')!.file, input.destinationPath);
    if (input.faultChecks) {
      db.exec("CREATE TRIGGER corrupt_actual_application AFTER INSERT ON applications BEGIN UPDATE matches SET durable_revision=NEW.rowid+100,state_json='{}',activation_json='{}'; END;");
      assert.throws(() => closures!.resume(closureSourceId));
      assert.equal(Number(db.prepare('SELECT count(*) AS n FROM applications').get()!.n), beforeApplications);
      db.exec('DROP TRIGGER corrupt_actual_application');
    }
    report('applying the actual original live-ball closure exactly once');
    result = closures.resume(closureSourceId); assert.deepEqual(closures.resume(closureSourceId), result);
    assert.equal(Number(db.prepare('SELECT count(*) AS n FROM applications').get()!.n), beforeApplications + 1);
    assert.equal(result.scoring.kind, 'unsupported'); assert.equal(result.workload.kind, 'pending');
    assert.equal(result.controllerReset.retired.length, 10);
    assert.throws(() => assertPriorPhysicalClosureCompleted(db, applicationId), /pending/);
    assert.deepEqual(rows(), before);
    closures.close(); closures = null; db.close(); db = new DatabaseSync(input.destinationPath);
    closures = openSqliteActualLivePlayClosureStore(input.destinationPath);
    assert.deepEqual(closures.resume(closureSourceId), result);
    assert.deepEqual(rows(), before);
  } finally { adjudications?.close(); closures?.close(); db.close(); }
  assert.equal(fileHash(input.sourcePath), originalHash);
  return { sourceSha256: originalHash, destinationSha256: fileHash(input.destinationPath), sourceUnchanged: true,
    destinationPath: input.destinationPath, closureSourceId, applicationId, realDisk: true, wal: true, allConnectionsClosedReopened: true,
    originalPhysicalTablesUnchanged: true, originalTableHashes: before, exactlyOnceOfficialApplication: true,
    actualRoleWorkloadStillPending: true, syntheticFixturePolicy: true, faultChecks: input.faultChecks, result };
};
