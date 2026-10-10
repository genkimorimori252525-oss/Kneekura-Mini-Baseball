import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { actualLiveRuntimeEvidenceFromSqlite } from './SqliteActualLivePlayRuntimeStore';
import { actualFirstBaseUmpireEvidenceFromSqlite } from './SqliteActualFirstBaseUmpireStore';
import { withBattedWorldPhysicalReadTraversal } from './SqliteBattedWorldFieldExecutionStore';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { receivedArtifactSha as sha, receivedStageInput, receivedFreshOutput, readReceivedStageFile,
  receivedStageCensus, assertReceivedStageDelta, type ReceivedStageFile } from './ActualReceivedUmpireDefenderReplanGenuine.test-support';

const { DatabaseSync, backup } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const selected = process.env.BASEBALL_RECEIVED_CALL_STAGE_INPUT && process.env.BASEBALL_RECEIVED_CALL_STAGE_OUTPUT;

it.runIf(!!selected)('authenticates a closed scheduled-call checkpoint from the reaped partial extension without crediting its failed run', async () => {
  const previous = receivedStageInput('origin'), output = receivedFreshOutput();
  const manifest = JSON.parse(readFileSync(process.env.BASEBALL_RECEIVED_CALL_STAGE_INPUT!, 'utf8')) as { candidate: ReceivedStageFile };
  const candidate = JSON.parse(readReceivedStageFile(manifest.candidate).toString('utf8')) as {
    schema: string; passCredit: number; files: Record<'database' | 'wal' | 'terminal' | 'config', ReceivedStageFile> };
  expect(candidate.schema).toBe('received_call_failed_stage_candidate_v1'); expect(candidate.passCredit).toBe(0);
  for (const file of Object.values(candidate.files)) readReceivedStageFile(file);
  expect(candidate.files.wal.path).toBe(candidate.files.database.path+'-wal');
  const terminal = JSON.parse(readReceivedStageFile(candidate.files.terminal).toString('utf8'));
  expect(terminal).toMatchObject({ stage: 'received-call-prospective-extension', status: 'failed',
    originalChildExit: -15, remainingOwnedProcesses: [], cancelSignals: [],
    configSha256: candidate.files.config.sha256 });
  expect(terminal.failures).toEqual([
    { phase: 'execute', error: "ValueError('wall budget exceeded')" },
    { phase: 'result', error: "ValueError('original child exit differs')" },
  ]);
  expect(terminal.before).toEqual(terminal.after);
  expect(terminal.before.source.sha256).toBe('8822708b091e4795b7d5e06e60e190cf2dbc6ac02668c93504480cc8aacd1291');
  mkdirSync(output, { mode: 0o700 });
  const path = join(output, 'scheduled.sqlite'), reference = join(output, 'original-reference.sqlite');
  writeFileSync(reference, previous.bytes, { flag: 'wx', mode: 0o600 });
  const source = new DatabaseSync(candidate.files.database.path, { readOnly: true });
  try {
    source.exec('BEGIN'); const dataVersion = source.prepare('PRAGMA data_version').get();
    expect(source.prepare('PRAGMA integrity_check').get()!.integrity_check).toBe('ok');
    await backup(source, path);
    expect(source.prepare('PRAGMA data_version').get()).toEqual(dataVersion); source.exec('COMMIT');
  } finally { if (source.isTransaction) source.exec('ROLLBACK'); source.close(); }
  const db = new DatabaseSync(path, { readOnly: true }), original = new DatabaseSync(reference, { readOnly: true });
  let censusHash: string;
  try {
    const before = receivedStageCensus(original), after = receivedStageCensus(db);
    assertReceivedStageDelta(before, after, { actual_first_base_umpire_setups: 1, actual_first_base_umpire_observations: 1,
      actual_first_base_umpire_calls: 1, actual_live_play_admissions: 3 }, [],
    ['actual_first_base_umpire_setups', 'actual_first_base_umpire_observations', 'actual_first_base_umpire_calls']);
    db.exec('BEGIN');
    withBattedWorldPhysicalReadTraversal(db, () => {
      const owner = actualFirstBaseUmpireEvidenceFromSqlite(db);
      const setup = owner.readSetup('received-input-umpire-setup');
      const observation = owner.readObservation('received-input-umpire-observation');
      const call = owner.readCall('received-input-call-scheduled');
      expect(setup?.source.sourceVersion).toBe('public-origin-v1');
      expect(observation?.source).toEqual({ sourceId: 'received-input-umpire-observation', sourceVersion: 'public-origin-v1',
        setupSourceId: 'received-input-umpire-setup', ruleExecutionSourceId: previous.receipt.identities.execution });
      expect(call?.source).toEqual({ sourceId: 'received-input-call-scheduled', sourceVersion: 'public-origin-v1',
        observationSourceId: 'received-input-umpire-observation', currentExecutionSourceId: previous.receipt.identities.execution });
      expect(call?.schedule.kind).toBe('scheduled');
      expect(hash(setup!.source)).toBe('b0bb6bfd745d865235653284ff85e7e016eeecf1e4c3cfb74d97c4bde2b33d6c');
      const runtimeOwner = actualLiveRuntimeEvidenceFromSqlite(db), runtime = runtimeOwner.read('live-play-runtime');
      if (!runtime) throw new Error('original runtime is missing');
      expect(hash(runtime)).toBe(previous.receipt.hashes.runtime);
      const admissions = runtimeOwner.admissions(runtime); expect(admissions).toHaveLength(17);
      expect(admissions.slice(-3).map(a => [a.owner, a.sourceId])).toEqual([
        ['actual_first_base_umpire_setups', setup!.source.sourceId],
        ['actual_first_base_umpire_observations', observation!.source.sourceId],
        ['actual_first_base_umpire_calls', call!.source.sourceId],
      ]);
    });
    expect(receivedStageCensus(db)).toEqual(after); censusHash = hash(after); db.exec('COMMIT');
  } finally { if (db.isTransaction) db.exec('ROLLBACK'); db.close(); original.close(); }
  // SQLite backup folds the committed WAL into a closed new database. The
  // failed writer's original main/WAL bytes remain pinned and unchanged.
  for (const file of Object.values(candidate.files)) readReceivedStageFile(file);
  writeFileSync(join(output, 'recovery.json'), JSON.stringify({ schema: 'received_call_scheduled_checkpoint_v1',
    outputDatabaseSha256: sha(readFileSync(path)), finalCensusHash: censusHash,
    originalDatabaseSha256: previous.input.database.sha256, originalAuthenticationReceiptSha256: previous.input.receipt.sha256,
    recoveredFromDatabaseSha256: candidate.files.database.sha256, recoveredFromWalSha256: candidate.files.wal.sha256,
    failedTerminalSha256: candidate.files.terminal.sha256, failedRunPassCredit: 0,
    completedStep: 'scheduled-call', bridgeCredit: 0, recoveredPR350Credit: 0 }, null, 2)+'\n', { flag: 'wx', mode: 0o600 });
}, 300_000);
