import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { spawn, type StdioOptions } from 'node:child_process';
import { appendFileSync, constants, copyFileSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { setImmediate as yieldForReporter } from 'node:timers/promises';
import { expect, it } from 'vitest';
import type { DatabaseSync as Database } from 'node:sqlite';
import { SqliteOfficialStateStore as FrozenV2Store } from '../SqliteOfficialStateV2.test-support';
import { SqliteOfficialStateStore } from '../SqliteOfficialStateStore';
import { openSqliteActualFoulTerminalApplicationStore } from './SqliteActualFoulTerminalApplicationStore';
import { genuineTerminalFixture } from './ActualFoulTerminalApplicationFixtures.test-support';
import type { DurableFoulTerminalApplicationQueue } from './ActualFoulTerminalApplication';
import { foulEndLogicalBytes } from './ActualFoulPlayEndFixtures.test-support';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';
import { witnessSqliteWrite } from './SqliteWriteWitness.test-support';
import { assertPriorPhysicalClosureCompleted } from './PhysicalPlayClosureEvidenceFromSqlite';
import { assertClosedTerminalSidecars, retainedTerminalProducer } from './ActualFoulTerminalCutover.test-support';

type Applied = Omit<DurableFoulTerminalApplicationQueue, 'status' | 'officialApplied' | 'result'> & {
  status: 'OFFICIAL_APPLIED_PENDING_POST_PLAY'; officialApplied: true;
  result: { sourceId: string; official: { receipt: { applicationId: string; closureId: string; previousPlayId: number;
    durableRevision: number; appliedMatchState: unknown }; pendingPostPlay: { origin: unknown } }; acknowledgement: null } };
type Runner = { read(sourceId: string): DurableFoulTerminalApplicationQueue | Applied | null;
  apply(sourceId: string): Applied; close(): void };
type OpenRunner = (path: string) => Runner;
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const fileHash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
const sourceId = 'terminal-application';
const testName = 'P11 genuine queued bunt applies once after owned v2 process exit and private v3 cutover';
const requireRunner = async (): Promise<OpenRunner> => {
  const moduleId = './SqliteActualFoulTerminalApplicationRunner';
  const module: { openSqliteActualFoulTerminalApplicationRunner?: OpenRunner } = existsSync(new URL(moduleId + '.ts', import.meta.url))
    ? await import(/* @vite-ignore */ moduleId) : {};
  expect(typeof module.openSqliteActualFoulTerminalApplicationRunner, 'GENUINE_QUEUED_TERMINAL_RUNNER_API_MISSING').toBe('function');
  return module.openSqliteActualFoulTerminalApplicationRunner!;
};
const inheritedStdio = (): StdioOptions => {
  const locks: { fd: number }[] = JSON.parse(process.env.BASEBALL_GATE_LOCKS ?? '[]');
  const result: StdioOptions = ['ignore', 'pipe', 'pipe'];
  for (const lock of locks) {
    if (!Number.isSafeInteger(lock.fd) || lock.fd < 3 || lock.fd > 64) throw new Error('invalid inherited runtime lock fd');
    while (result.length <= lock.fd) result.push('ignore');
    result[lock.fd] = lock.fd;
  }
  return result;
};
/** Actual child process, not a claimed quiescence Boolean. Promise resolution
 * requires both exit and close. Single-thread Vitest creates no worker process. */
const buildAndStopV2Producer = async (path: string, directory: string) => {
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  const child = spawn(process.execPath, [join(root, 'node_modules/vitest/vitest.mjs'), 'run',
    'src/host/world/ActualFoulTerminalPendingApplication.acceptance.ts', '--testNamePattern', '^' + testName + '$',
    '--config=' + join(root, 'vitest.terminal-pending.config.mjs'), '--pool=threads', '--poolOptions.threads.singleThread',
    '--maxWorkers=1', '--minWorkers=1', '--no-file-parallelism', '--no-cache', '--testTimeout=1200000', '--reporter=json',
    '--outputFile=' + join(directory, 'producer-tests.json')], { cwd: root,
    env: { ...process.env, TERMINAL_PENDING_V2_PRODUCER: path, BASEBALL_GATE_CACHE: join(directory, 'producer-cache') }, stdio: inheritedStdio() });
  writeFileSync(join(directory, 'producer-stdout.log'), '', { flag: 'wx' });
  writeFileSync(join(directory, 'producer-stderr.log'), '', { flag: 'wx' });
  const stat = readFileSync('/proc/' + child.pid + '/stat', 'utf8');
  const processIdentity = { pid: child.pid!, stat, startTicks: Number(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[19]),
    executable: process.execPath, node: process.version, executableSha256: fileHash(process.execPath) };
  let stdout = '', stderr = '', exited = false, exitCode: number | null = null;
  child.stdout!.on('data', (bytes: Buffer) => { appendFileSync(join(directory, 'producer-stdout.log'), bytes); stdout = (stdout + bytes.toString()).slice(-64_000); });
  child.stderr!.on('data', (bytes: Buffer) => { appendFileSync(join(directory, 'producer-stderr.log'), bytes); stderr = (stderr + bytes.toString()).slice(-64_000); });
  child.on('exit', code => { exited = true; exitCode = code; });
  let timedOut = false, hardStop: ReturnType<typeof setTimeout> | undefined;
  const wall = setTimeout(() => {
    timedOut = true;
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
    hardStop = setTimeout(() => { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); }, 2000);
  }, 1_200_000);
  try {
    await new Promise<void>((ok, fail) => { child.once('error', fail); child.once('close', code => {
      if (timedOut || !exited || code !== 0 || exitCode !== 0) fail(new Error('owned v2 producer failed or exceeded its 1200s wall: ' + stdout + '\n' + stderr)); else ok();
    }); });
  } finally { clearTimeout(wall); if (hardStop) clearTimeout(hardStop); }
  expect(child.pid).toBeTypeOf('number'); expect(child.exitCode).toBe(0); expect(exited).toBe(true);
  // ChildProcess exit+close is the owned handle's reaping evidence. A later
  // occupant of the numeric PID is irrelevant and must never be signalled.
  const report = JSON.parse(readFileSync(join(directory, 'producer-tests.json'), 'utf8'));
  expect(report.numPassedTests).toBe(1); expect(report.numFailedTests).toBe(0); expect(report.numPendingTests).toBe(0);
  expect(report.success).toBe(true); expect(report.numTotalTests).toBe(1);
  expect(report.testResults.flatMap((suite: { assertionResults: unknown[] }) => suite.assertionResults)).toMatchObject([{ fullName: testName, status: 'passed' }]);
  const receipt = { version: 'owned_terminal_v2_producer_v1', processIdentity, producerCaseName: testName,
    testPath: fileURLToPath(import.meta.url), testSourceSha256: fileHash(fileURLToPath(import.meta.url)), exitCode: 0, signalCode: child.signalCode,
    observedExitAndClose: true, sourcePath: path, sourceSha256: fileHash(path), reportPath: join(directory, 'producer-tests.json'),
    reportSha256: fileHash(join(directory, 'producer-tests.json')),
    stdoutPath: join(directory, 'producer-stdout.log'), stdoutSha256: fileHash(join(directory, 'producer-stdout.log')),
    stderrPath: join(directory, 'producer-stderr.log'), stderrSha256: fileHash(join(directory, 'producer-stderr.log')), frozenV2SourceSha256: fileHash(fileURLToPath(new URL('../SqliteOfficialStateV2.test-support.ts', import.meta.url))) };
  writeFileSync(join(directory, 'producer-receipt.json'), JSON.stringify(receipt, null, 2), { flag: 'wx' });
  return receipt;
};
const targetTables = ['matches', 'applications', 'actual_foul_terminal_applications'] as const;
const targetCensus = (db: Database) => Object.fromEntries(targetTables.map(table => [table,
  db.prepare('SELECT rowid AS __test_rowid,* FROM main.' + table + ' ORDER BY rowid').all()])) as
    Record<typeof targetTables[number], Record<string, import('node:sqlite').SQLOutputValue>[]>;
const schemaState = (db: Database) => ({
  main: db.prepare('SELECT rowid,* FROM main.sqlite_master ORDER BY type,name').all(),
  temp: db.prepare('SELECT rowid,* FROM temp.sqlite_master ORDER BY type,name').all(),
  mainVersion: db.prepare('PRAGMA main.schema_version').get()!.schema_version,
  tempVersion: db.prepare('PRAGMA temp.schema_version').get()!.schema_version,
  userVersion: db.prepare('PRAGMA main.user_version').get()!.user_version,
  indexes: targetTables.map(table => ({ table, indexes: db.prepare('PRAGMA main.index_list(' + table + ')').all().map(index => ({
    ...index, columns: db.prepare('PRAGMA main.index_xinfo("' + String(index.name).replaceAll('"', '""') + '")').all() })) })),
});
const mirrors = (db: Database) => ({
  queue: db.prepare('SELECT * FROM main.actual_foul_terminal_applications WHERE source_id=?').get(sourceId)!,
  application: db.prepare('SELECT * FROM main.applications WHERE application_id=?').get('terminal-match-application'),
  match: db.prepare('SELECT * FROM main.matches WHERE match_id=?').get('game-1')!,
});

it(testName, async () => {
  if (!process.env.BASEBALL_GATE_RUNTIME || !process.env.BASEBALL_GATE_LOCKS) throw new Error('P11 requires its private controller runtime envelope');
  const producerPath = process.env.TERMINAL_PENDING_V2_PRODUCER;
  if (producerPath) {
    expect(resolve(producerPath)).toBe(producerPath); expect(existsSync(producerPath)).toBe(false);
    const f = await genuineTerminalFixture(producerPath, 'bunt');
    try {
      const queue = f.x.f.track(openSqliteActualFoulTerminalApplicationStore(producerPath, {
        readAcceptedApplication: id => id === sourceId ? f.terminalSource() : null }));
      const saved = queue.enqueue(sourceId);
      expect(saved).toMatchObject({ status: 'QUEUED', officialApplied: false, result: null });
      expect(f.x.f.db.prepare('PRAGMA user_version').get()!.user_version).toBe(2);
      const old = new FrozenV2Store(producerPath); try { expect(old.getMatch('game-1')!.durableRevision).toBe(0); } finally { old.close(); }
    } finally { f.x.f.close(); }
    return;
  }
  const directory = mkdtempSync(join(tmpdir(), 'terminal-private-cutover-'));
  console.info('TERMINAL_PENDING_PRIVATE_ARTIFACT=' + directory);
  const retained = retainedTerminalProducer(), oldPath = retained?.sourcePath ?? join(directory, 'owned-v2.sqlite'), path = join(directory, 'owned-v3.sqlite');
  let db: Database | undefined, runner: Runner | undefined;
  try {
    const stopped = retained ?? await buildAndStopV2Producer(oldPath, directory);
    expect(stopped.observedExitAndClose).toBe(true); expect(stopped.exitCode).toBe(0);
    assertClosedTerminalSidecars(oldPath);
    const originalHash = fileHash(oldPath); expect(existsSync(path)).toBe(false);
    copyFileSync(oldPath, path, constants.COPYFILE_EXCL); expect(fileHash(path)).toBe(originalHash);
    db = new DatabaseSync(path); expect(db.prepare('PRAGMA user_version').get()!.user_version).toBe(2);
    const originalRows = foulEndLogicalBytes(db, ['matches', 'applications', 'actual_foul_terminal_applications']);
    db.exec('BEGIN IMMEDIATE; PRAGMA user_version=3; COMMIT'); db.close(); db = undefined;
    expect(() => new FrozenV2Store(path)).toThrow('unsupported official state store schema version');
    expect(fileHash(oldPath)).toBe(originalHash);
    const open = await requireRunner();
    // This assertion is reached only after the genuine queue, owned-process
    // exit, private copy, v3 migration and actual frozen-v2 reopen rejection.
    db = new DatabaseSync(path);
    const beforeSchema = schemaState(db), beforeTargets = targetCensus(db);
    runner = open(path); expect(schemaState(db)).toEqual(beforeSchema); expect(targetCensus(db)).toEqual(beforeTargets);
    const queued = runner.read(sourceId); expect(queued?.status).toBe('QUEUED');
    if (!queued || queued.status !== 'QUEUED') throw new Error('genuine queue prerequisite differs');
    const beforeBytes = foulEndLogicalBytes(db);
    expect(() => runner!.apply('missing-terminal-source')).toThrow(/queue|missing/);
    expect(foulEndLogicalBytes(db)).toBe(beforeBytes);
    await yieldForReporter();
    let writerConnection: Database | undefined;
    const witness = witnessSqliteWrite(/UPDATE main\.actual_foul_terminal_applications\b/, connection => {
      writerConnection = connection; return connection.isTransaction
        && connection.prepare('SELECT status FROM main.actual_foul_terminal_applications WHERE source_id=?').get(sourceId)!.status === 'OFFICIAL_APPLIED_PENDING_POST_PLAY';
    });
    let applied: Applied;
    try { applied = runner.apply(sourceId); expect(witness.wasReached()).toBe(true); }
    finally { witness.close(); }
    expect(writerConnection!.isTransaction).toBe(false);
    expect(applied).toMatchObject({ source: queued.source, proposal: queued.proposal,
      status: 'OFFICIAL_APPLIED_PENDING_POST_PLAY', officialApplied: true, result: { sourceId, acknowledgement: null } });
    const result = applied.result.official, raw = mirrors(db);
    const origin = { owner: 'actual_foul_terminal_applications', sourceId, sourceVersion: queued.source.sourceVersion,
      sourceHash: hash(queued.source), snapshotHash: hash(queued.proposal) };
    const receipt = { applicationId: queued.source.applicationId, closureId: sourceId, previousPlayId: queued.proposal.playId,
      durableRevision: queued.proposal.originalOfficialRevision + 1, appliedMatchState: queued.proposal.nextMatch };
    const requestHash = hash({ ...queued.proposal.applicationBody, origin });
    const expectedOfficial = { receipt, pendingPostPlay: { version: 'official_pending_post_play_v1', matchId: queued.proposal.gameId,
      applicationId: receipt.applicationId, closureId: receipt.closureId, previousPlayId: receipt.previousPlayId,
      durableRevision: receipt.durableRevision, requestHash, origin, gameProgression: queued.proposal.projectedGameProgression } };
    const expectedResult = { sourceId, official: expectedOfficial, acknowledgement: null };
    expect(result).toEqual(expectedOfficial); expect(applied.result).toEqual(expectedResult);
    const expectedTargets = {
      matches: beforeTargets.matches.map(row => row.match_id !== queued.proposal.gameId ? row : { ...row,
        durable_revision: receipt.durableRevision, state_json: json(receipt.appliedMatchState), activation_json: json({ pendingPostPlay: expectedOfficial.pendingPostPlay }) }),
      applications: [...beforeTargets.applications, { __test_rowid: Math.max(0, ...beforeTargets.applications.map(row => Number(row.__test_rowid))) + 1,
        application_id: receipt.applicationId, match_id: queued.proposal.gameId, closure_id: sourceId, request_hash: requestHash, result_json: json(expectedOfficial) }],
      actual_foul_terminal_applications: beforeTargets.actual_foul_terminal_applications.map(row => row.source_id !== sourceId ? row : { ...row,
        status: 'OFFICIAL_APPLIED_PENDING_POST_PLAY', result_json: json(expectedResult) }),
    };
    expect(targetCensus(db)).toEqual(expectedTargets); expect(schemaState(db)).toEqual(beforeSchema);
    expect(JSON.parse(String(raw.application!.result_json))).toEqual(result);
    expect(JSON.parse(String(raw.match.activation_json))).toEqual({ pendingPostPlay: result.pendingPostPlay });
    expect(JSON.parse(String(raw.queue.result_json))).toEqual(applied.result);
    expect(JSON.parse(String(raw.match.state_json))).toEqual(queued.proposal.nextMatch);
    expect(raw.match.durable_revision).toBe(queued.proposal.originalOfficialRevision + 1);
    expect(result.receipt.closureId).toBe(sourceId); expect(result.receipt.applicationId).toBe(queued.source.applicationId);
    expect(result.pendingPostPlay.origin).toEqual({ owner: 'actual_foul_terminal_applications', sourceId,
      sourceVersion: queued.source.sourceVersion, sourceHash: hash(queued.source), snapshotHash: hash(queued.proposal) });
    const closure = queued.proposal.applicationBody.adjudication.events.at(-1)!;
    expect(closure.kind).toBe('OfficialPlayClosed');
    expect(json(queued.proposal.originalPhysicalTimeline)).toContain('batted_ball_pending');
    expect(foulEndLogicalBytes(db, ['matches', 'applications', 'actual_foul_terminal_applications'])).toBe(originalRows);
    const afterBytes = foulEndLogicalBytes(db);
    expect(runner.apply(sourceId)).toEqual(applied); expect(foulEndLogicalBytes(db)).toBe(afterBytes);
    expect(targetCensus(db)).toEqual(expectedTargets); expect(schemaState(db)).toEqual(beforeSchema);
    expect(() => withSqliteReadTransaction(db!, () => assertPriorPhysicalClosureCompleted(db!, queued.source.applicationId))).toThrow(/terminal|pending/);
    const official = new SqliteOfficialStateStore(path);
    try { expect(official.getMatch('game-1')).toEqual({ durableRevision: receipt.durableRevision, matchState: queued.proposal.nextMatch,
      activation: null, nextWorld: null, finalResult: null, pendingPostPlay: result.pendingPostPlay }); }
    finally { official.close(); }
    await yieldForReporter();
    runner.close(); runner = undefined; db.close(); db = undefined;
    runner = open(path); expect(runner.read(sourceId)).toEqual(applied);
    runner.close(); runner = undefined; db = new DatabaseSync(path);
    expect(foulEndLogicalBytes(db)).toBe(afterBytes); expect(fileHash(oldPath)).toBe(originalHash);
    expect(targetCensus(db)).toEqual(expectedTargets); expect(schemaState(db)).toEqual(beforeSchema);
    expect(db.prepare('PRAGMA user_version').get()!.user_version).toBe(3);
  } finally { runner?.close(); db?.close(); }
  // Preserve the successfully closed producer and receipts for separately
  // controlled rollback qualification. Never silently reconstruct lineage.
}, process.env.TERMINAL_PENDING_V2_PRODUCER ? 1_200_000 : 2_400_000);
