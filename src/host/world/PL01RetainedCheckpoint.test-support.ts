import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';

/** Exact cp8 after the accepted occupied runner model. The prior cp173 entry
 * remains published at d6dfd095; no arbitrary checkpoint selection is exposed. */
export const PL01_RETAINED_CHECKPOINT = Object.freeze({
  // Historical audited provenance. Recovery does not require these private witnesses.
  sourceCommit: 'd6dfd095dd6c59fd195484394d1be21e0705dfdc',
  sourceTree: '023b3d8bb7027b08257036ccd2375ced6cfff9b2',
  runControlSha256: 'f7ad413d82b5525e64c03a41786e6f28140e646dbe414e792c0577c0d28d69fc',
  receiptSha256: 'c6f82f648d2cb5c3b75e8550da1daf9962861593608e981385026a7da7dc9bda',
  priorRunTerminalSha256: '302b1ef635ee78dff0c9f73515df36252dedf3d89db7f646a75e0e64cb913211',
  priorCp173DatabaseSha256: '0c1028926bd351d850accec089ccc319399441f7986f6c0ede7a73cae9482708',
  gzipSha256: '9a99a67d954223248507bce6c85caff85f0548a9cb8659bfce834ba898e5a5f4', gzipBytes: 533242,
  databaseSha256: '59bbb5fa8eb7fa92bd448e4e3cca476a195f952f272ad0d2dd0f216d8915f035', databaseBytes: 8171520,
  runnerModelResultHash: '975b47d896ad2bf6bc76f83990e248d5a4963ddc2595b0263cdf2b43cde42246',
});
export type PL01RetainedSuffixInput = Readonly<{
  nativeReleased: boolean; checkpointGzip: string; destinationDirectory: string;
}>;
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
export const capturePL01RetainedSuffixInput = (raw: PL01RetainedSuffixInput): PL01RetainedSuffixInput => {
  const input = cloneInert(raw);
  assert(input && Object.keys(input).sort().join('|') === ['nativeReleased', 'checkpointGzip', 'destinationDirectory'].sort().join('|'), 'PL01 retained input fields differ');
  assert.equal(input.nativeReleased, true, 'PL01 retained Native suffix must be reviewed and released');
  for (const value of [input.checkpointGzip, input.destinationDirectory]) {
    assert(typeof value === 'string' && isAbsolute(value), 'PL01 retained paths must be absolute');
  }
  return input;
};

/** Authenticate before creating anything. No source database is opened, and a
 * destination is exclusive: a failed suffix always leaves inspectable evidence. */
export const preparePL01RetainedCheckpoint = (raw: PL01RetainedSuffixInput) => {
  const input = capturePL01RetainedSuffixInput(raw), pin = PL01_RETAINED_CHECKPOINT;
  const pinnedFile = (path: string, expected: string) => {
    assert.equal(realpathSync(path), path, 'PL01 input must be a canonical file path');
    assert(lstatSync(path).isFile(), 'PL01 input must be a regular file');
    const bytes = readFileSync(path); assert.equal(sha256(bytes), expected, 'PL01 retained input hash differs'); return bytes;
  };
  // The independently audited byte pins identify cp8 even after its original
  // private witness files are lost. No replacement witness is synthesized.
  const gzip = pinnedFile(input.checkpointGzip, pin.gzipSha256); assert.equal(gzip.length, pin.gzipBytes);
  const bytes = gunzipSync(gzip, { maxOutputLength: pin.databaseBytes });
  assert.equal(bytes.length, pin.databaseBytes); assert.equal(sha256(bytes), pin.databaseSha256);
  assert.equal(realpathSync(dirname(input.destinationDirectory)), dirname(input.destinationDirectory), 'PL01 output parent must be canonical');
  mkdirSync(input.destinationDirectory, { mode: 0o700 });
  const path = join(input.destinationDirectory, 'pl01-cp8-occupied-suffix.sqlite');
  writeFileSync(path, bytes, { flag: 'wx', mode: 0o600 });
  assert.equal(sha256(readFileSync(path)), pin.databaseSha256);
  return { input, path, pin, witnessRecheck: { originalRunControl: false, checkpointReceipt: false, priorRunTerminal: false } as const };
};
