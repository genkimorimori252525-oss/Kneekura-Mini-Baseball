import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { setImmediate as yieldForReporter } from 'node:timers/promises';
import type { DatabaseSync } from 'node:sqlite';
import { expect, it } from 'vitest';
import { getOfficialPlayClosure } from '../../core/adjudication/PlayAdjudicationLedger';
import type { AcceptedFoulTerminalApplication, FoulTerminalApplicationEvaluation,
  FoulTerminalApplicationPending, FoulTerminalApplicationProposal } from './ActualFoulTerminalApplication';
import { genuineTerminalFixture, terminalFixtureCompatibility, terminalFixtureManifest,
  type GenuineTerminalFixture } from './ActualFoulTerminalApplicationFixtures.test-support';

// These test-local contract types allow the genuine preconditions to run before
// the first missing-API assertion. They grant no implementation or authority.
type Queue = Readonly<{ source: AcceptedFoulTerminalApplication; proposal: FoulTerminalApplicationProposal;
  status: 'QUEUED'; officialApplied: false; result: null }>;
type QueueStore = Readonly<{
  evaluate(sourceId: string): FoulTerminalApplicationEvaluation;
  enqueue(sourceId: string): FoulTerminalApplicationPending | Queue;
  read(sourceId: string): Queue | null;
  close(): void;
}>;
type OpenQueue = (path: string, authority?: Readonly<{ readAcceptedApplication(sourceId: string): unknown }>) => QueueStore;

const requireQueue = async (): Promise<OpenQueue> => {
  const file = new URL('./SqliteActualFoulTerminalApplicationStore.ts', import.meta.url);
  const moduleId = './SqliteActualFoulTerminalApplicationStore';
  const module: { openSqliteActualFoulTerminalApplicationStore?: OpenQueue } = existsSync(file)
    ? await import(/* @vite-ignore */ moduleId) : {};
  expect(typeof module.openSqliteActualFoulTerminalApplicationStore,
    'TERMINAL_QUEUE_API_MISSING_AFTER_GENUINE_TASK1_PROPOSAL').toBe('function');
  return module.openSqliteActualFoulTerminalApplicationStore!;
};
const schemaState = (db: DatabaseSync) => ({
  userVersion: db.prepare('PRAGMA main.user_version').get()!.user_version,
  mainVersion: db.prepare('PRAGMA main.schema_version').get()!.schema_version,
  tempVersion: db.prepare('PRAGMA temp.schema_version').get()!.schema_version,
  main: db.prepare('SELECT type,name,tbl_name,rootpage,sql FROM main.sqlite_master ORDER BY type,name').all(),
  temp: db.prepare('SELECT type,name,tbl_name,rootpage,sql FROM temp.sqlite_master ORDER BY type,name').all(),
  queryOnly: db.prepare('PRAGMA query_only').get()!.query_only,
  transaction: db.isTransaction,
});

it('Q01 queues the genuine terminal bunt proposal once without applying the official child', async () => {
  terminalFixtureCompatibility();
  const directory = mkdtempSync(join(tmpdir(), 'terminal-queue-q01-'));
  const path = join(directory, 'original.sqlite');
  let f: GenuineTerminalFixture | undefined;
  try {
    f = await genuineTerminalFixture(path, 'bunt');
    const { actualFoulTerminalApplicationInput } = await import('./ActualFoulTerminalApplication');
    const { deriveFoulTerminalApplicationProposal } = await import('./ActualFoulTerminalApplicationEvidenceFromSqlite');
    const { actualFoulClosedEvidenceFromSqlite } = await import('./SqliteActualFoulPlayEndStore');
    const { actualFoulRuleConsumptionEvidenceFromSqlite } = await import('./SqliteActualFoulRuleConsumptionStore');
    const { readOriginalPhysicalPitchPrefixFromSqlite } = await import('./PhysicalPitchEvidenceFromSqlite');
    const { foulEndLogicalBytes } = await import('./ActualFoulPlayEndFixtures.test-support');
    const { witnessSqliteWrite } = await import('./SqliteWriteWitness.test-support');
    const db = f.x.f.db, source = actualFoulTerminalApplicationInput(f.terminalSource(), f.terminalSource().sourceId);
    const original = f.bytes(), originalSchema = schemaState(db);
    // No queue opener is resolved until the real C/E/P, selected call/fence and
    // unchanged Task1 projection have all authenticated on the genuine database.
    expect(actualFoulRuleConsumptionEvidenceFromSqlite(db).read(f.x.count.source.sourceId)).toEqual(f.x.count);
    expect(actualFoulClosedEvidenceFromSqlite(db).read(f.end.source.sourceId)).toEqual(f.end);
    expect(readOriginalPhysicalPitchPrefixFromSqlite(db, f.end.physicalPitchSourceId).map(p => p.source.sourceId))
      .toEqual(terminalFixtureManifest.pitchIds);
    await yieldForReporter();
    const proposal = deriveFoulTerminalApplicationProposal(db, source, 'current');
    expect(proposal.kind).toBe('terminal_non_live_projected');
    if (proposal.kind !== 'terminal_non_live_projected') throw new Error('Q01 genuine Task1 proposal prerequisite stayed pending');
    expect(proposal.source).toEqual(source); expect(proposal.officialApplied).toBe(false);
    expect(proposal.officialReference).toEqual(source.officialReference);
    expect(proposal.physicalEndReference).toEqual(f.endReference);
    expect(proposal.officialObligation).toEqual(f.end.dispositionObligations.official);
    expect(proposal.applicationBody).toMatchObject({ applicationId: source.applicationId, matchId: 'game-1',
      expectedDurableRevision: 0, match: terminalFixtureManifest.match });
    expect(proposal.applicationBody).not.toHaveProperty('origin');
    const closure = getOfficialPlayClosure(proposal.applicationBody.adjudication)!;
    expect(closure.closureId).toBe(source.sourceId); expect(closure.closureId).not.toBe(source.applicationId);
    expect(closure.finalRuling.basisCallId).toBe(f.called.source.sourceId);
    expect(closure.finalRuling.basisCallId).not.toBe(f.called.source.sourceId + ':call');
    expect(proposal.nextMatch).toEqual({ ...terminalFixtureManifest.match, playId: 8, outs: 1 });
    expect(f.end.dispositionObligations.official).toMatchObject({ status: 'pending', consumer: null });
    expect(f.fenced.value.handoff).toBeNull();
    expect(f.hash(source)).toMatch(/^[a-f0-9]{64}$/); expect(f.hash(proposal)).toMatch(/^[a-f0-9]{64}$/);
    expect(f.bytes()).toBe(original); expect(schemaState(db)).toEqual(originalSchema);
    expect(JSON.stringify(f.x.f.official.getMatch('game-1'))).toBe(f.x.originalMatchBytes);
    await yieldForReporter();

    const open = await requireQueue();
    const store = f.x.f.track(open(path, { readAcceptedApplication: id => id === source.sourceId ? source : null }));
    expect(Object.keys(store).sort()).toEqual(['close', 'enqueue', 'evaluate', 'read']);
    expect(store).not.toHaveProperty('resume'); expect(store).not.toHaveProperty('submit');
    const queueRows = () => db.prepare('SELECT * FROM main.actual_foul_terminal_applications ORDER BY source_id').all();
    const installed = f.bytes(), installedSchema = schemaState(db);
    const outsideQueue = foulEndLogicalBytes(db, ['actual_foul_terminal_applications']);
    expect(outsideQueue).toBe(original); expect(queueRows()).toEqual([]);
    expect(installedSchema.userVersion).toBe(originalSchema.userVersion);
    expect(installedSchema.main.filter(row => row.name === 'physical_closure_game_policies'))
      .toEqual(originalSchema.main.filter(row => row.name === 'physical_closure_game_policies'));
    expect(store.evaluate(source.sourceId)).toEqual(proposal);
    expect(f.bytes()).toBe(installed); expect(schemaState(db)).toEqual(installedSchema);
    await yieldForReporter();

    let writer: DatabaseSync | undefined;
    const witness = witnessSqliteWrite(/INSERT INTO main\.actual_foul_terminal_applications\b/, connection => {
      writer = connection;
      return connection.prepare('SELECT count(*) AS n FROM main.actual_foul_terminal_applications').get()!.n === 1;
    });
    let queued: Queue | FoulTerminalApplicationPending;
    try {
      queued = store.enqueue(source.sourceId);
      expect(witness.wasReached()).toBe(true);
      expect(writer!.isTransaction).toBe(false);
      expect(writer!.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
      expect(writer!.prepare('SELECT total_changes() AS n').get()!.n).toBe(1);
    } finally { witness.close(); }
    expect(queued).toEqual({ source, proposal, status: 'QUEUED', officialApplied: false, result: null });
    expect(queueRows()).toEqual([{
      source_id: source.sourceId, game_id: proposal.gameId, play_id: proposal.playId, application_id: source.applicationId,
      physical_pitch_source_id: proposal.physicalPitchSourceId, physical_end_source_id: source.physicalEndReference.sourceId,
      official_obligation_key: proposal.officialObligation.obligationKey, status: 'QUEUED',
      source_json: f.json(source), source_hash: f.hash(source), proposal_json: f.json(proposal), proposal_hash: f.hash(proposal), result_json: null,
    }]);
    expect(foulEndLogicalBytes(db, ['actual_foul_terminal_applications'])).toBe(outsideQueue);
    expect(schemaState(db)).toEqual(installedSchema);
    expect(JSON.stringify(f.x.f.official.getMatch('game-1'))).toBe(f.x.originalMatchBytes);
    expect(actualFoulClosedEvidenceFromSqlite(db).read(f.end.source.sourceId)).toEqual(f.end);
    expect(f.official.readAt(f.session.sourceId, f.fenced.value.revision)).toEqual(f.fenced.value);
    await yieldForReporter();
  } finally {
    try { f?.x.f.close(); }
    finally { rmSync(directory, { recursive: true, force: true }); }
  }
}, 1_200_000);
