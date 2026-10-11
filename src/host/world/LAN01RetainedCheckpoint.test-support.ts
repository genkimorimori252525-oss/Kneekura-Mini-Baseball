import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';

/** Exact LAN01-R1 cp5 after the zero-TOTAL view, before the occupied hold.
 * The earlier cp181 provenance is historical, never an alternate input stage. */
export const LAN01_RETAINED_CHECKPOINT = Object.freeze({
  sourceCommit: '4d452cea7ee37d41ca4f517612ffa96a7bb878d2',
  sourceTree: '3dcc76c69323fdd3461d4af7ec7f61bafe646e2a',
  runControlSha256: '9e542ea279b8b46be37beb65edf6ab280160ef3a4685c64e00b383d0d2c08ce1',
  receiptSha256: '9b8d372485d6c60e95794e0b58f6a5bae03f7e003a030e2c4c56d877c7bf285d',
  censusSha256: '7f63e56005dac76e6596ae4e5586159a4e5b7ca67784936396301f482853c95d',
  priorRunTerminalSha256: '879536e357502ebcb4c2b089be35482aa3d6ba946e8d57febdc515bb9653e7c5',
  priorVitestReportSha256: '411141cb4d124d5ba91444771e3f06589b608871e9568252350f2c7888d851c6',
  gzipSha256: 'fac97a92b42c858860babd827d975a693e1754f6498686edbd15928a3d612e6f', gzipBytes: 545780,
  databaseSha256: '9476906a4cfc2728c6b968baf90763fdf0a1bae58595d409a345016cc813f177', databaseBytes: 8327168,
  tableCount: 108,
  runnerModelResultHash: '35997800a5657833158e32f402af8329e57b4f21e778ee745aa20f692b574f0c',
  viewSnapshotHash: 'd6d7cd1cc61228cc13e68cc50e2310f3dda0cc55dd02d6af7396a1717c33452b',
  viewResultHash: '9a9d103cf75c54a7580bd4bd8140614afa4cfeb5baed006a7566aef1b77bf10e',
  failedCp11Continuation: Object.freeze({
    terminalSha256: '268f81c2c4109734473d56533fbf3e9e3a2b402ad5f80a200602914c7ab44ea9',
    reportSha256: 'dafebb63b30883923c875c5061378da2837909021841d73be360d94a88597ace',
    lastDatabaseSha256: 'be7a59ea31c5c387fc744ea67d9ded79d7de803812eba59e099319638a0d3364',
    originalRunOutcome: 'FAILED_IMMUTABLE_HOLD_EXHAUSTED',
    previouslyCompleted: 'initial Play, occupied first TAKE and retry, emotion genesis, anchor prefix/11 TOTALs/view/calibrations',
    reusableAsCorrectedPrefix: false,
  }),
  priorCp181: Object.freeze({
    sourceCommit: 'd47512d8517f3ac5c502b8e6af9b543cc58a84c6', sourceTree: 'e5f3ed76710da25007774d59ba7ce661614f39b1',
    databaseSha256: '574eb72030180025095b246fab3be33e4ceae0cf52820286400576b81ae31502',
    receiptSha256: 'a25a112525d767c3c057ebf0cdc2535d9db599fdb1b2ef8dfb3bc4b3d6777920',
    terminalSha256: 'ff7cbe25e65b15471c176768963969969f52e663d717440879afb948427752ec',
    originalRunOutcome: 'FAILED_FUNCTIONAL_DISPATCH_CLAIM',
  }),
});
export type LAN01RetainedSuffixInput = Readonly<{
  nativeReleased: boolean; checkpointGzip: string; destinationDirectory: string;
}>;
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
export const captureLAN01RetainedSuffixInput = (raw: LAN01RetainedSuffixInput): LAN01RetainedSuffixInput => {
  const input = cloneInert(raw);
  assert(input && Object.keys(input).sort().join('|') === ['nativeReleased', 'checkpointGzip', 'destinationDirectory'].sort().join('|'), 'LAN01 retained input fields differ');
  assert.equal(input.nativeReleased, true, 'LAN01 retained Native suffix must be reviewed and released');
  for (const value of [input.checkpointGzip, input.destinationDirectory]) {
    assert(typeof value === 'string' && isAbsolute(value), 'LAN01 retained paths must be absolute');
  }
  return input;
};

/** Authenticate before creating anything. No source database is opened, and a
 * destination is exclusive: a failed suffix always leaves inspectable evidence. */
export const prepareLAN01RetainedCheckpoint = (raw: LAN01RetainedSuffixInput) => {
  const input = captureLAN01RetainedSuffixInput(raw), pin = LAN01_RETAINED_CHECKPOINT;
  const pinnedFile = (path: string, expected: string) => {
    assert.equal(realpathSync(path), path, 'LAN01 input must be a canonical file path');
    assert(lstatSync(path).isFile(), 'LAN01 input must be a regular file');
    const bytes = readFileSync(path); assert.equal(sha256(bytes), expected, 'LAN01 retained input hash differs'); return bytes;
  };
  // The independently audited byte pins identify cp5 even after its original
  // private witness files are lost. Exact bytes bind the audited schema/rowid
  // census. No replacement witness is synthesized.
  const gzip = pinnedFile(input.checkpointGzip, pin.gzipSha256); assert.equal(gzip.length, pin.gzipBytes);
  const bytes = gunzipSync(gzip, { maxOutputLength: pin.databaseBytes });
  assert.equal(bytes.length, pin.databaseBytes); assert.equal(sha256(bytes), pin.databaseSha256);
  assert.equal(realpathSync(dirname(input.destinationDirectory)), dirname(input.destinationDirectory), 'LAN01 output parent must be canonical');
  mkdirSync(input.destinationDirectory, { mode: 0o700 });
  const path = join(input.destinationDirectory, 'lan01-cp5-pre-hold-suffix.sqlite');
  writeFileSync(path, bytes, { flag: 'wx', mode: 0o600 });
  assert.equal(sha256(readFileSync(path)), pin.databaseSha256);
  return { input, path, pin, witnessRecheck: { originalRunControl: false, checkpointReceipt: false, tableCensus: false, priorRunTerminal: false } as const };
};
