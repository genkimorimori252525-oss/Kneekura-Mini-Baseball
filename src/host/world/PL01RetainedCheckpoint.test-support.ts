import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';

/** One specific returned-owner boundary, not an arbitrary recovery format. */
export const PL01_RETAINED_CHECKPOINT = Object.freeze({
  // Historical audited provenance. Recovery does not require these private witnesses.
  sourceCommit: 'd4a17d490cba76cac4e8427503ee9ec726e7b758',
  sourceTree: '728b6e36cee03cc0667904b6ada2ea7661d5b427',
  runControlSha256: '9fce53f33c4d9e81e771a9e37c3337e7c30692cda4ed11e49fdac350ef8a432b',
  receiptSha256: '4452cd7dd46ecce57bb1037088609d410bda1b159d7ea3b79615a7582bbef902',
  gzipSha256: '89494e51c839230c1a4ba1601af6f20cd1281b97004cbbd9cda76b36326ab623', gzipBytes: 494079,
  databaseSha256: '0c1028926bd351d850accec089ccc319399441f7986f6c0ede7a73cae9482708', databaseBytes: 7999488,
  freezeResultHash: 'ce9c5e49fea8a27b22628fa3f39a386c886391e1456c4ce7c7c98640ef924839',
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
  // The independently audited byte pins identify cp173 even after its original
  // private witness files are lost. No replacement witness is synthesized.
  const gzip = pinnedFile(input.checkpointGzip, pin.gzipSha256); assert.equal(gzip.length, pin.gzipBytes);
  const bytes = gunzipSync(gzip, { maxOutputLength: pin.databaseBytes });
  assert.equal(bytes.length, pin.databaseBytes); assert.equal(sha256(bytes), pin.databaseSha256);
  assert.equal(realpathSync(dirname(input.destinationDirectory)), dirname(input.destinationDirectory), 'PL01 output parent must be canonical');
  mkdirSync(input.destinationDirectory, { mode: 0o700 });
  const path = join(input.destinationDirectory, 'pl01-suffix.sqlite');
  writeFileSync(path, bytes, { flag: 'wx', mode: 0o600 });
  assert.equal(sha256(readFileSync(path)), pin.databaseSha256);
  return { input, path, pin, witnessRecheck: { originalRunControl: false, checkpointReceipt: false } as const };
};
