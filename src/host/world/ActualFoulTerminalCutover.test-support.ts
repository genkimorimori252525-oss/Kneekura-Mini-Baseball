import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import { expect } from 'vitest';
const fileHash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
export type ProducerReceipt = { version: string; processIdentity: { pid: number; stat: string; startTicks: number; executable: string; node: string; executableSha256: string };
  producerCaseName: string; testPath: string; testSourceSha256: string; exitCode: number; signalCode: string | null; observedExitAndClose: boolean; sourcePath: string; sourceSha256: string;
  reportPath: string; reportSha256: string; stdoutPath: string; stdoutSha256: string; stderrPath: string; stderrSha256: string; frozenV2SourceSha256: string };
/** Only the controller may supply an explicitly pinned previous producer. A
 * matching receipt is evidence from that already-observed run, never a request
 * to accept an arbitrary caller's quiescence claim or live shared database. */
export const retainedTerminalProducer = (): ProducerReceipt | null => {
  const manifestPath = process.env.TERMINAL_PENDING_CUTOVER_INPUT;
  if (!manifestPath) return null;
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    version: string; producerReceiptPath: string; producerReceiptSha256: string;
    parentConfigPath: string; parentConfigSha256: string; parentTerminalPath: string; parentTerminalSha256: string };
  expect(manifest.version).toBe('terminal_pending_cutover_input_v1');
  expect(fileHash(manifest.producerReceiptPath)).toBe(manifest.producerReceiptSha256);
  const receipt = JSON.parse(readFileSync(manifest.producerReceiptPath, 'utf8')) as ProducerReceipt;
  expect(receipt.version).toBe('owned_terminal_v2_producer_v1');
  expect(receipt.observedExitAndClose).toBe(true); expect(receipt.exitCode).toBe(0); expect(receipt.signalCode).toBeNull();
  expect(receipt.processIdentity.node).toBe(process.version);
  expect(receipt.processIdentity.executableSha256).toBe(fileHash(process.execPath));
  expect(receipt.frozenV2SourceSha256).toBe('d59caddeeb2253deee69168588461ba9434d2e01ab8285d7e1ea6a9900be61f3');
  for (const [path, digest] of [[receipt.sourcePath, receipt.sourceSha256], [receipt.reportPath, receipt.reportSha256],
    [receipt.stdoutPath, receipt.stdoutSha256], [receipt.stderrPath, receipt.stderrSha256]]) expect(fileHash(path)).toBe(digest);
  const report = JSON.parse(readFileSync(receipt.reportPath, 'utf8'));
  expect(report.numPassedTests).toBe(1); expect(report.numFailedTests).toBe(0); expect(report.numPendingTests).toBe(0);
  expect(report.success).toBe(true); expect(report.numTotalTests).toBe(1);
  expect(receipt.producerCaseName).toBe('P11 genuine queued bunt applies once after owned v2 process exit and private v3 cutover');
  expect(report.testResults.flatMap((suite: { assertionResults: unknown[] }) => suite.assertionResults))
    .toMatchObject([{ fullName: receipt.producerCaseName, status: 'passed' }]);
  expect(fileHash(manifest.parentConfigPath)).toBe(manifest.parentConfigSha256);
  expect(fileHash(manifest.parentTerminalPath)).toBe(manifest.parentTerminalSha256);
  const config = JSON.parse(readFileSync(manifest.parentConfigPath, 'utf8'));
  const terminal = JSON.parse(readFileSync(manifest.parentTerminalPath, 'utf8'));
  expect(terminal.schema).toBe('baseball_fresh_terminal_v1'); expect(terminal.status).toBe('passed');
  expect(terminal.failures).toEqual([]); expect(terminal.cancelSignals).toEqual([]); expect(terminal.remainingOwnedProcesses).toEqual([]);
  expect(terminal.configSha256).toBe(manifest.parentConfigSha256); expect(terminal.stage).toBe(config.stage);
  expect(terminal.before.source.sha256).toBe(config.inputs.source.sha256);
  expect(terminal.after.source.sha256).toBe(config.inputs.source.sha256);
  expect(config.cases).toHaveLength(1); expect(config.cases[0].name).toBe(receipt.producerCaseName);
  expect(config.cases[0].file).toBe('src/host/world/ActualFoulTerminalPendingApplication.acceptance.ts');
  expect(terminal.before.source.entries).toContainEqual([receipt.testPath, 'file', receipt.testSourceSha256]);
  expect(terminal.ownedIdentities).toContainEqual([receipt.processIdentity.pid, receipt.processIdentity.startTicks]);
  expect(terminal.runtime.some((r: { pid: number; nodeSha256: string }) => r.pid === receipt.processIdentity.pid
    && r.nodeSha256 === receipt.processIdentity.executableSha256)).toBe(true);
  return receipt;
};

/** Closed WAL is mandatory; a retained regular SHM is not live-writer proof. */
export const assertClosedTerminalSidecars = (path: string): void => {
  for (const suffix of ['', '-wal', '-shm']) if (existsSync(path + suffix)) {
    expect(lstatSync(path + suffix).isFile()).toBe(true); expect(realpathSync(path + suffix)).toBe(path + suffix);
    if (suffix === '-wal') expect(lstatSync(path + suffix).size).toBe(0);
  }
};
