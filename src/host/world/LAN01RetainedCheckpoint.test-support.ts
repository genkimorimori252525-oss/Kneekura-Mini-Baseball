import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';

/** Exact original LAN01 cp181 after the accepted occupied runner model.
 * No alternative stage, donor image, model or geometry is accepted. */
export const LAN01_RETAINED_CHECKPOINT = Object.freeze({
  sourceCommit: 'd47512d8517f3ac5c502b8e6af9b543cc58a84c6',
  sourceTree: 'e5f3ed76710da25007774d59ba7ce661614f39b1',
  runControlSha256: 'a976aeefecb9895f71770aba0e56749a7c48c43ccbe3b4cd5a647db0dc83a2cd',
  receiptSha256: 'a25a112525d767c3c057ebf0cdc2535d9db599fdb1b2ef8dfb3bc4b3d6777920',
  censusSha256: '9b3f26a8085dafafb06e3ee82b29b48ad8616bbe746ec5a053d1baf6b5508fec',
  priorRunTerminalSha256: 'ff7cbe25e65b15471c176768963969969f52e663d717440879afb948427752ec',
  gzipSha256: 'b3a93f38a67a6d11e3eb1da59d6b583747f53350fc98083e9ecf8beb75230af1', gzipBytes: 533665,
  databaseSha256: '574eb72030180025095b246fab3be33e4ceae0cf52820286400576b81ae31502', databaseBytes: 8171520,
  tableCount: 108,
  runnerModelResultHash: '35997800a5657833158e32f402af8329e57b4f21e778ee745aa20f692b574f0c',
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
  // The independently audited byte pins identify cp181 even after its original
  // private witness files are lost. Exact bytes bind the audited schema/rowid
  // census. No replacement witness is synthesized.
  const gzip = pinnedFile(input.checkpointGzip, pin.gzipSha256); assert.equal(gzip.length, pin.gzipBytes);
  const bytes = gunzipSync(gzip, { maxOutputLength: pin.databaseBytes });
  assert.equal(bytes.length, pin.databaseBytes); assert.equal(sha256(bytes), pin.databaseSha256);
  assert.equal(realpathSync(dirname(input.destinationDirectory)), dirname(input.destinationDirectory), 'LAN01 output parent must be canonical');
  mkdirSync(input.destinationDirectory, { mode: 0o700 });
  const path = join(input.destinationDirectory, 'lan01-cp181-occupied-suffix.sqlite');
  writeFileSync(path, bytes, { flag: 'wx', mode: 0o600 });
  assert.equal(sha256(readFileSync(path)), pin.databaseSha256);
  return { input, path, pin, witnessRecheck: { originalRunControl: false, checkpointReceipt: false, tableCensus: false, priorRunTerminal: false } as const };
};
