import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';

/** Exact corrected PL01-R2 cp1 after the accepted new-batter baseline. Prior
 * cp173/cp8 contracts remain historical; no checkpoint selection is exposed. */
export const PL01_RETAINED_CHECKPOINT = Object.freeze({
  // Historical audited provenance. Recovery does not require these private witnesses.
  sourceCommit: 'e6de9bb39dda0df4412824f450189d65f8148a5d',
  sourceTree: '9945219b1e94a0fda85cb2923194f5b77657c45e',
  runControlSha256: 'f157604afda68c2912554206dac6d3d83b2a7a68f5d8f90822596889f08cef4b',
  receiptSha256: '27c4a93807851408d068f3842c62bfb117b3103efc7b5c327472b19cb10bc05b',
  priorRunTerminalSha256: 'c4a5ebbb69970ee54cc72843724501c8cfd8ffbfd8b2d19d530687e68efeb1e0',
  priorCp173ContractCommit: 'd6dfd095dd6c59fd195484394d1be21e0705dfdc',
  priorCp173DatabaseSha256: '0c1028926bd351d850accec089ccc319399441f7986f6c0ede7a73cae9482708',
  priorCp8ContractCommit: 'fd0846a5aaa359708ba3e97722564ec9d2488ae9',
  priorCp8DatabaseSha256: '59bbb5fa8eb7fa92bd448e4e3cca476a195f952f272ad0d2dd0f216d8915f035',
  gzipSha256: 'f4fce41798801429767a0b9cd07ed86001644f18740f521bc7b6f1148c979cd8', gzipBytes: 533350,
  databaseSha256: '49685af2fe6f3277b4f6488af35140a54ceb79a8dc9774cff74fda9973049bcc', databaseBytes: 8171520,
  newBatterBaselineResultHash: 'd6bc633fc32ab888e6b2fe3faf1c2275fdf4ffcc872b09d358a0f73e8b1a78ac',
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
  // The independently audited byte pins identify cp1 even after its original
  // private witness files are lost. No replacement witness is synthesized.
  const gzip = pinnedFile(input.checkpointGzip, pin.gzipSha256); assert.equal(gzip.length, pin.gzipBytes);
  const bytes = gunzipSync(gzip, { maxOutputLength: pin.databaseBytes });
  assert.equal(bytes.length, pin.databaseBytes); assert.equal(sha256(bytes), pin.databaseSha256);
  assert.equal(realpathSync(dirname(input.destinationDirectory)), dirname(input.destinationDirectory), 'PL01 output parent must be canonical');
  mkdirSync(input.destinationDirectory, { mode: 0o700 });
  const path = join(input.destinationDirectory, 'pl01-cp1-enrollment-suffix.sqlite');
  writeFileSync(path, bytes, { flag: 'wx', mode: 0o600 });
  assert.equal(sha256(readFileSync(path)), pin.databaseSha256);
  return { input, path, pin, witnessRecheck: { originalRunControl: false, checkpointReceipt: false, priorRunTerminal: false } as const };
};
