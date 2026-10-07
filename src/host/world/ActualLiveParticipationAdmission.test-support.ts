import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, lstatSync, readFileSync, readdirSync, readlinkSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyActualOfficialReadReplay, type OriginalOfficialReplayReceipt,
  type ReplayArtifactFacts } from '../../../tools/verification/actual-live-pipeline/official-read-replay-helper';
import type { verifyActualLiveOfficialArtifact } from './ActualLiveOfficialArtifact.test-support';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const producer = {
  sourceCommit: 'e58db66ff423fd58b90dfc183f4bc66021e9c2c8',
  terminalPath: '/workspace/shared/baseball-closed-continuation-controls-20261007/flow1/checkpoints/official-terminal.json',
  terminalSha256: '618195ca8e674d47304d1b35d3ddfddd9357666958180cb185585dbde27b1c93',
  receiptPath: '/workspace/shared/baseball-closed-continuation-controls-20261007/flow1/official-receipt.json',
  receiptSha256: '2a361e32f3f9728291db949b98e7d8f6276f9157ba484bcfe3a007800a9e1c46',
  artifactPath: '/workspace/shared/baseball-closed-continuation-controls-20261007/flow1/official.sqlite',
  artifactSha256: '7d23d7006075f57685bbd3998ca8f92b5a01e3802d0f2c911a3e882b0032a953',
  artifactBytes: 3_579_904,
} as const;
type AdmissionInput = Readonly<{
  candidateCommit: string; candidateSrc: string; initialOutputPath: string;
  initialManifestPath: string; admissionResultPath: string;
}>;
type ProducerReceipt = Readonly<{ schema: string; phase: string; sourceCommit: string; inputManifestSha256: string;
  input: { path: string; sha256: string; predecessorTerminalSha256: string };
  result: Awaited<ReturnType<typeof verifyActualLiveOfficialArtifact>> }>;
type ProducerTerminal = Readonly<{ phase: string; sourceCommit: string; inputManifestSha256: string;
  exitCode: number; stopReason: unknown; failure: unknown; reaped: boolean; phaseVerified: boolean;
  remainingOwnedProcesses: unknown[]; sourceDependenciesControlsInputUnchanged: boolean;
  predecessorTerminal: { phase: string; sha256: string }; proof: { path: string; sha256: string } }>;
const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const fileHash = (path: string) => digest(readFileSync(path));
const pinnedJson = <T>(path: string, sha256: string): T => {
  const bytes = readFileSync(path); assert.equal(digest(bytes), sha256, `producer pin differs: ${path}`);
  return JSON.parse(bytes.toString('utf8')) as T;
};
const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;
const ownHandles = (path: string) => readdirSync('/proc/self/fd').flatMap(fd => {
  try {
    const target = readlinkSync(`/proc/self/fd/${fd}`);
    return [path, `${path}-wal`, `${path}-shm`].includes(target) ? [{ fd, target }] : [];
  } catch { return []; }
});
const closedArtifact = () => {
  const path = producer.artifactPath;
  assert.equal(realpathSync(path), path); assert(lstatSync(path).isFile());
  assert.equal(lstatSync(path).size, producer.artifactBytes);
  for (const sidecar of [`${path}-wal`, `${path}-shm`]) {
    if (existsSync(sidecar)) assert(lstatSync(sidecar).isFile() && realpathSync(sidecar) === sidecar);
  }
  assert(!existsSync(`${path}-wal`) || lstatSync(`${path}-wal`).size === 0, 'uncheckpointed original WAL');
  assert.deepEqual(ownHandles(path), [], 'original artifact still has a test-process handle');
  assert.equal(fileHash(path), producer.artifactSha256, 'original artifact bytes differ');
};
const sourceIdentity = () => {
  const root = realpathSync(fileURLToPath(new URL('../../../', import.meta.url)));
  const git = (...args: string[]) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
  assert.equal(git('status', '--porcelain', '--untracked-files=no'), '', 'candidate tracked source changed');
  const files = ['src/host/world/ActualLiveParticipationAdmission.test-support.ts',
    'src/host/world/ActualLiveParticipationAdmission.acceptance.ts',
    'src/host/world/ActualLiveParticipationInitialArtifact.test-support.ts',
    'src/host/world/ActualLiveParticipationInitialArtifact.acceptance.ts',
    'tools/verification/actual-live-pipeline/official-read-replay-helper.ts',
    'vitest.participation-admission.config.ts', 'vitest.participation-initial-artifact.config.ts',
    'tsconfig.participation-admission.json'];
  const gateFiles = Object.fromEntries(files.map(path => {
    git('ls-files', '--error-unmatch', '--', path);
    const committed = execFileSync('git', ['-C', root, 'show', `HEAD:${path}`]);
    const actual = readFileSync(`${root}/${path}`);
    assert.equal(digest(actual), digest(committed), `executed gate file differs from HEAD: ${path}`);
    return [path, digest(actual)];
  }));
  return { root, commit: git('rev-parse', 'HEAD'), src: git('rev-parse', 'HEAD:src'), gateFiles };
};
const freshPath = (path: string) => {
  assert(typeof path === 'string' && isAbsolute(path) && normalize(path) === path
    && realpathSync(dirname(path)) === dirname(path), 'admission output path must have a canonical existing parent');
  assert(!existsSync(path), 'admission output already exists');
};
export const readParticipationAdmissionInput = (path: string | undefined): AdmissionInput => {
  assert(path, 'ACTUAL_LIVE_PARTICIPATION_ADMISSION_INPUT is required; no producer fallback');
  const input = JSON.parse(readFileSync(path, 'utf8')) as AdmissionInput;
  assert(input && typeof input === 'object' && !Array.isArray(input));
  assert.deepEqual(Object.keys(input).sort(), ['admissionResultPath', 'candidateCommit', 'candidateSrc', 'initialManifestPath', 'initialOutputPath']);
  assert.match(input.candidateCommit, /^[a-f0-9]{40}$/); assert.match(input.candidateSrc, /^[a-f0-9]{40}$/);
  const outputs = [input.initialOutputPath, input.initialManifestPath, input.admissionResultPath];
  assert.equal(new Set([...outputs, `${input.initialOutputPath}-wal`, `${input.initialOutputPath}-shm`]).size, 5,
    'admission output paths collide with each other or private DB sidecars');
  const protectedPaths: readonly string[] = [producer.artifactPath, `${producer.artifactPath}-wal`,
    `${producer.artifactPath}-shm`, producer.terminalPath, producer.receiptPath];
  assert(outputs.every(output => !protectedPaths.includes(output)), 'admission output overlaps a producer input');
  outputs.forEach(freshPath);
  assert(!existsSync(`${input.initialOutputPath}-wal`) && !existsSync(`${input.initialOutputPath}-shm`));
  return input;
};

/** Raw real-file facts only; no physical authentication or adopted acceptance rows here. */
const observeOutputFacts = (): ReplayArtifactFacts => {
  closedArtifact();
  const db = new DatabaseSync(producer.artifactPath, { readOnly: true });
  let facts: Omit<ReplayArtifactFacts, 'wrapperReadOnlyOpenClosedVerified'>;
  try {
    facts = withSqliteReadTransaction(db, () => {
      const mainFilename = String(db.prepare('PRAGMA database_list').all().find(row => row.name === 'main')!.file);
      assert.equal(mainFilename, producer.artifactPath);
      assert.equal(db.prepare('PRAGMA journal_mode').get()!.journal_mode, 'wal');
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()
        .map(row => String(row.name));
      const rowCounts = Object.fromEntries(tables.map(table => [table,
        Number(db.prepare(`SELECT count(*) AS n FROM ${quote(table)}`).get()!.n)]));
      const workloadActivityKinds = tables.includes('world_player_workload_activities')
        ? db.prepare("SELECT json_extract(source_json,'$.kind') AS kind,count(*) AS n FROM world_player_workload_activities GROUP BY kind ORDER BY kind").all()
          .map(row => ({ kind: String(row.kind), n: Number(row.n) })) : [];
      assert.equal(db.prepare('SELECT total_changes() AS n').get()!.n, 0, 'facts observer changed the original');
      return { path: producer.artifactPath, sha256: producer.artifactSha256, realDisk: true, mainFilename,
        journalMode: 'wal', rowCounts, workloadActivityKinds };
    });
    assert.equal(db.isTransaction, false);
  } finally { db.close(); }
  assert.equal(db.isOpen, false); closedArtifact();
  return { ...facts, wrapperReadOnlyOpenClosedVerified: true };
};

/** Bounded adaptation of this pinned genuine producer, followed by two existing authenticated fresh reads. */
export const admitParticipationOfficialArtifact = (input: AdmissionInput) => {
  const candidate = sourceIdentity();
  assert.equal(candidate.commit, input.candidateCommit); assert.equal(candidate.src, input.candidateSrc);
  assert([input.initialOutputPath, input.initialManifestPath, input.admissionResultPath]
    .every(path => !path.startsWith(`${candidate.root}/`)), 'private outputs must be outside candidate source');
  const terminal = pinnedJson<ProducerTerminal>(producer.terminalPath, producer.terminalSha256);
  const receipt = pinnedJson<ProducerReceipt>(producer.receiptPath, producer.receiptSha256);
  assert.equal(terminal.phase, 'official'); assert.equal(terminal.sourceCommit, producer.sourceCommit);
  assert.equal(terminal.exitCode, 0); assert.equal(terminal.stopReason, null); assert.equal(terminal.failure, null);
  assert.equal(terminal.reaped, true); assert.deepEqual(terminal.remainingOwnedProcesses, []);
  assert.equal(terminal.phaseVerified, true); assert.equal(terminal.sourceDependenciesControlsInputUnchanged, true);
  assert.deepEqual(terminal.proof, { path: producer.receiptPath, sha256: producer.receiptSha256 });
  assert.equal(receipt.schema, 'fresh_closed_input_phase_receipt_v1'); assert.equal(receipt.phase, 'official');
  assert.equal(receipt.sourceCommit, producer.sourceCommit); assert.equal(receipt.inputManifestSha256, terminal.inputManifestSha256);
  assert.equal(receipt.input.predecessorTerminalSha256, terminal.predecessorTerminal.sha256);
  const raw = receipt.result;
  assert.equal(raw.destinationPath, producer.artifactPath); assert.equal(raw.destinationSha256, producer.artifactSha256);
  assert.equal(raw.sourceSha256, receipt.input.sha256);
  assert.equal(raw.sourceUnchanged, true); assert.equal(raw.realDisk, true); assert.equal(raw.wal, true);
  assert.equal(raw.allConnectionsClosedReopened, true); assert.equal(raw.originalPhysicalTablesUnchanged, true);
  assert.equal(raw.exactlyOnceOfficialApplication, true); assert.equal(raw.actualRoleWorkloadStillPending, true);
  assert(raw.result, 'producer original official result is missing');
  const output = observeOutputFacts();
  const originalReceipt: OriginalOfficialReplayReceipt = {
    closureSourceId: raw.closureSourceId, applicationId: raw.applicationId,
    officialReceipt: raw.result.official.receipt, scoring: raw.result.scoring, workload: raw.result.workload,
    retiredControllerCount: raw.result.controllerReset.retired.length,
    adjudicationEvidence: { physicalEndReference: raw.adjudicationEvidence.physicalEndReference,
      wholeHistoryReference: raw.adjudicationEvidence.wholeHistoryReference }, output,
  };
  const replay = verifyActualOfficialReadReplay({ artifactPath: producer.artifactPath,
    artifactSha256: producer.artifactSha256, originalReceipt,
    progress: message => process.stdout.write(`[participation admission] ${message}\n`) });
  assert.equal(replay.passes.length, 2); assert.equal(replay.executed.roleContextReads, 2);
  assert.equal(replay.executed.readOnlyConnections, 2); assert.equal(replay.executed.officialWrites, 0);
  assert.equal(replay.checks.artifactUnchanged, true); assert.equal(replay.checks.closeReopenEqual, true);
  assert.equal(replay.checks.readOnlyEnforced, true); assert.deepEqual(replay.openSqliteHandles, []);
  closedArtifact(); assert.deepEqual(sourceIdentity(), candidate);
  // Re-pin the exact producer records after the reads, before emitting an admission.
  assert.equal(fileHash(producer.terminalPath), producer.terminalSha256);
  assert.equal(fileHash(producer.receiptPath), producer.receiptSha256);
  const manifest = { artifactPath: producer.artifactPath, artifactSha256: producer.artifactSha256,
    outputPath: input.initialOutputPath, originalReceipt };
  const manifestBytes = `${JSON.stringify(manifest, null, 2)}\n`;
  const result = { kind: 'PARTICIPATION_CANDIDATE_OFFICIAL_READ_ADMISSION', producer, candidate,
    rawFactsReadConnections: 1, fullOriginalReadAuthentications: 2, originalReceipt, replay,
    manifest: { path: input.initialManifestPath, sha256: digest(Buffer.from(manifestBytes)) },
    initialWriteGateExecuted: false };
  // Emit the manifest last: a failed admission/report write cannot leave a usable gate input.
  writeFileSync(input.admissionResultPath, `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
  writeFileSync(input.initialManifestPath, manifestBytes, { flag: 'wx' });
  return result;
};
