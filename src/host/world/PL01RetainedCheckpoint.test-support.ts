import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';

/** Exact PL01-R3 cp11 after the occupied pitch was accepted. The returned
 * same-source retry is separate historical evidence; no selector is exposed. */
export const PL01_RETAINED_CHECKPOINT = Object.freeze({
  // Historical audited provenance. Recovery needs only the exact private gzip.
  sourceCommit: '4d452cea7ee37d41ca4f517612ffa96a7bb878d2',
  sourceTree: '3dcc76c69323fdd3461d4af7ec7f61bafe646e2a',
  runControlSha256: '7383aa16c68b1f6a7cec332b367957e72fa30a39dc5a3dfc2fc8496ff72686ad',
  receiptSha256: '551939891b33be280c746521261c8d10dad957e41bf054282544e8737d877a61',
  priorRunTerminalSha256: '82b56374c163a65f079dedef79ef625913be9aa9bc9a684962dd2cfadf4d054e',
  priorRunJournalSha256: 'd62ca21c5c9cda5d087291bc4d4cf9018b74fd3a286eba192daf5180194e8efd',
  priorCp173ContractCommit: 'd6dfd095dd6c59fd195484394d1be21e0705dfdc',
  priorCp173DatabaseSha256: '0c1028926bd351d850accec089ccc319399441f7986f6c0ede7a73cae9482708',
  priorCp8ContractCommit: 'fd0846a5aaa359708ba3e97722564ec9d2488ae9',
  priorCp8DatabaseSha256: '59bbb5fa8eb7fa92bd448e4e3cca476a195f952f272ad0d2dd0f216d8915f035',
  priorCp1SourceCommit: 'e6de9bb39dda0df4412824f450189d65f8148a5d',
  priorCp1DatabaseSha256: '49685af2fe6f3277b4f6488af35140a54ceb79a8dc9774cff74fda9973049bcc',
  gzipSha256: 'b2381759b16c5e8f4b23dbf394679f722d0d730e42d1e815bf2049e9fb0b4860', gzipBytes: 584079,
  databaseSha256: '829ef942e2b19a51d9cfc80e8b738c9e8129474f949a19a3f4b5ec6bb58c9fa7', databaseBytes: 8867840,
  pitchSourceId: 'physical-fixture:occupied-next:pitch',
  pitchSourceSha256: '50eda46f6af80c683d62cba06b7a4818c8ebf64901bc35d7a76c8df2bc480994',
  pitchSnapshotSha256: '8da24f6a2866aa98be16a29eb78943cb1ebab2bb37cfc277d3ba01f6f0515cf9',
  acceptedPitchResultHash: 'ad7de0f5253aaa268ddf0274368b672df804421b6beaf30f1b4658567456deb0',
  reopenedRetryResultHash: 'baf4d3b3e2435402d249e0f2169faf2179cce8991c2d6cd53c30b6ddd5a7d3e7',
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
  // The independently audited byte pins identify cp11 even after its original
  // private witness files are lost. No replacement witness is synthesized.
  const gzip = pinnedFile(input.checkpointGzip, pin.gzipSha256); assert.equal(gzip.length, pin.gzipBytes);
  const bytes = gunzipSync(gzip, { maxOutputLength: pin.databaseBytes });
  assert.equal(bytes.length, pin.databaseBytes); assert.equal(sha256(bytes), pin.databaseSha256);
  assert.equal(realpathSync(dirname(input.destinationDirectory)), dirname(input.destinationDirectory), 'PL01 output parent must be canonical');
  mkdirSync(input.destinationDirectory, { mode: 0o700 });
  const path = join(input.destinationDirectory, 'pl01-cp11-readback-suffix.sqlite');
  writeFileSync(path, bytes, { flag: 'wx', mode: 0o600 });
  assert.equal(sha256(readFileSync(path)), pin.databaseSha256);
  return { input, path, pin, witnessRecheck: { originalRunControl: false, checkpointReceipt: false, priorRunTerminal: false, priorRunJournal: false } as const };
};
