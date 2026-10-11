import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';

/** Exact LAN01-R3 cp23 after both occupied TAKEs and complete cut0 calibration.
 * Earlier cp5/cp11 boundaries are provenance only, never alternate input stages. */
export const LAN01_RETAINED_CHECKPOINT = Object.freeze({
  sourceCommit: 'b1a8c797fe1b293663a94d3c259498760c20b190',
  publicSourceCommit: '5c5e4b1dbdb039ed70e673b80284c933fd878ee7',
  sourceTree: 'f1543cc585cc2181c40e39a17bb4731f49268f2d',
  runControlSha256: '4ea3e15efa5f07c648719b7019a989aed2c9b25e0daeaa1b902494c46a2324db',
  receiptSha256: '9ee4d4d324637d4e23a9905b7a18d1bd68a299319978dbd1c659d172c3c822ec',
  censusSha256: '70e6675322b16ef26dbecddb0b76b7036745011233ab24bbd16da94d9123abfe',
  priorRunTerminalSha256: '3e4e465d0c0ae8c45f2786d8a44518f3eaeeb2a09f201c0bc52c569c19adcdaa',
  priorVitestReportSha256: '6332a9004fcb072d31183fa3b876560249a12618e546234c8647e4ee89e9ffbf',
  gzipSha256: '20eb34335f9256a4237bfebfb1c0736bb9cf05b56d39947785243c2cd7a9f95d', gzipBytes: 674045,
  databaseSha256: 'd0505072f55baf7a073563814e5fd82c643f7b8a8ab39b8d36f096ada5fb79b7', databaseBytes: 10137600,
  tableCount: 111, checkpointSequence: 23, returnedOwnerCall: 24,
  runnerModelResultHash: '35997800a5657833158e32f402af8329e57b4f21e778ee745aa20f692b574f0c',
  viewSnapshotHash: 'd6d7cd1cc61228cc13e68cc50e2310f3dda0cc55dd02d6af7396a1717c33452b',
  firstPitchSnapshotHash: '68e29c4cd60a0c7d3410156046228c5b38572a6d5b47a8bcd5113e0e1bab6d08',
  secondPitchSnapshotHash: '25c0ed5ec3217eb9df99da312fe5a9ea78df76f4247a8d65e272fa0f63d55ec7',
  anchorViewSnapshotHash: '5c08bc1c38f9a668153bd3d0bbe9c7d679d57b50120f0250edb23aa54466c0f9',
  cut0ViewSnapshotHash: '568fa0da5a5de99433ebac948f632126943af5cc21ca825c92e0695a288217c1',
  secondPostureSnapshotHash: '11c1f85eef98f38a8a1af82dd840e94ff58a79a6e21c8f4a9d17e53dad3fc0dd',
  returnedCalibrationSetHash: '153d8d896485cf29ef3952735f0043e410615f22e99a3452eb2253f0326665cf',
  priorCp5: Object.freeze({
    sourceCommit: '4d452cea7ee37d41ca4f517612ffa96a7bb878d2', sourceTree: '3dcc76c69323fdd3461d4af7ec7f61bafe646e2a',
    gzipSha256: 'fac97a92b42c858860babd827d975a693e1754f6498686edbd15928a3d612e6f',
    databaseSha256: '9476906a4cfc2728c6b968baf90763fdf0a1bae58595d409a345016cc813f177',
    receiptSha256: '9b8d372485d6c60e95794e0b58f6a5bae03f7e003a030e2c4c56d877c7bf285d',
    originalRunOutcome: 'FAILED_QUERY_ONLY_FIXTURE_READ',
  }),
  failedCp11Continuation: Object.freeze({
    terminalSha256: '268f81c2c4109734473d56533fbf3e9e3a2b402ad5f80a200602914c7ab44ea9',
    reportSha256: 'dafebb63b30883923c875c5061378da2837909021841d73be360d94a88597ace',
    originalRunOutcome: 'FAILED_IMMUTABLE_HOLD_EXHAUSTED', reusableAsCorrectedPrefix: false,
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
  // The independently audited byte pins identify cp23 even after its original
  // private witness files are lost. Exact bytes bind the audited schema/rowid
  // census. No replacement witness is synthesized.
  const gzip = pinnedFile(input.checkpointGzip, pin.gzipSha256); assert.equal(gzip.length, pin.gzipBytes);
  const bytes = gunzipSync(gzip, { maxOutputLength: pin.databaseBytes });
  assert.equal(bytes.length, pin.databaseBytes); assert.equal(sha256(bytes), pin.databaseSha256);
  assert.equal(realpathSync(dirname(input.destinationDirectory)), dirname(input.destinationDirectory), 'LAN01 output parent must be canonical');
  mkdirSync(input.destinationDirectory, { mode: 0o700 });
  const path = join(input.destinationDirectory, 'lan01-cp23-cut0-suffix.sqlite');
  writeFileSync(path, bytes, { flag: 'wx', mode: 0o600 });
  assert.equal(sha256(readFileSync(path)), pin.databaseSha256);
  return { input, path, pin, witnessRecheck: { originalRunControl: false, checkpointReceipt: false, tableCensus: false, priorRunTerminal: false } as const };
};
