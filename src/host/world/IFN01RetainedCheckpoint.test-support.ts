import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';

/** One specific returned-owner boundary, not an arbitrary recovery format. */
export const IFN01_RETAINED_CHECKPOINT = Object.freeze({
  // Historical audited provenance; these private witnesses are not runtime inputs.
  sourceCommit: '35c050668106d5d564e7419892db953040b37af2',
  sourceTree: '7e90c1ace30d36e8a0e0c87261e0c258ece6d910',
  receiptSha256: '0d2365656d531bfef5525b6fcf10f6559ef90c5b308c2035a2a4126da410eb14',
  censusSha256: '374aee318223585584e8237039465fbda0062f7c00b112ef7e98a5e33c38f17d',
  terminalSha256: 'b8cdc7f1717a1f9ee0e630e19c4f4adc8e7aa512a0887565de633adab7126ff5',
  gzipSha256: '0966986cf9398d606347d72c3e30ab818098de91ce9ec23982916a398d1f8e4d', gzipBytes: 1065804,
  databaseSha256: 'e0f15ab4cb9574131c48fb854c8a28c19162375329b24d6a69f7e38fd3b2beab', databaseBytes: 17838080,
});
export type IFN01RetainedSuffixInput = Readonly<{
  nativeReleased: boolean; checkpointGzip: string; destinationDirectory: string;
}>;
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
export const captureIFN01RetainedSuffixInput = (raw: IFN01RetainedSuffixInput): IFN01RetainedSuffixInput => {
  const input = cloneInert(raw);
  assert(input && Object.keys(input).sort().join('|') === ['nativeReleased', 'checkpointGzip', 'destinationDirectory'].sort().join('|'), 'IFN01 retained input fields differ');
  assert.equal(input.nativeReleased, true, 'IFN01 retained Native suffix must be reviewed and released');
  for (const value of [input.checkpointGzip, input.destinationDirectory]) {
    assert(typeof value === 'string' && isAbsolute(value), 'IFN01 retained paths must be absolute');
  }
  return input;
};

/** Authenticate before creating anything. No source database is opened, and a
 * destination is exclusive: a failed suffix always leaves inspectable evidence. */
export const prepareIFN01RetainedCheckpoint = (raw: IFN01RetainedSuffixInput) => {
  const input = captureIFN01RetainedSuffixInput(raw), pin = IFN01_RETAINED_CHECKPOINT;
  const pinnedFile = (path: string, expected: string) => {
    assert.equal(realpathSync(path), path, 'IFN01 input must be a canonical file path');
    assert(lstatSync(path).isFile(), 'IFN01 input must be a regular file');
    const bytes = readFileSync(path); assert.equal(sha256(bytes), expected, 'IFN01 retained input hash differs'); return bytes;
  };
  // The independently audited byte pins identify cp273 even after its original
  // private witness files are lost. No replacement witness is synthesized.
  const gzip = pinnedFile(input.checkpointGzip, pin.gzipSha256); assert.equal(gzip.length, pin.gzipBytes);
  const bytes = gunzipSync(gzip, { maxOutputLength: pin.databaseBytes });
  assert.equal(bytes.length, pin.databaseBytes); assert.equal(sha256(bytes), pin.databaseSha256);
  assert.equal(realpathSync(dirname(input.destinationDirectory)), dirname(input.destinationDirectory), 'IFN01 output parent must be canonical');
  mkdirSync(input.destinationDirectory, { mode: 0o700 });
  const path = join(input.destinationDirectory, 'ifn01-suffix.sqlite');
  writeFileSync(path, bytes, { flag: 'wx', mode: 0o600 });
  assert.equal(sha256(readFileSync(path)), pin.databaseSha256);
  return { input, path, pin, witnessRecheck: { checkpointReceipt: false, tableCensus: false, failedTerminal: false } as const };
};
