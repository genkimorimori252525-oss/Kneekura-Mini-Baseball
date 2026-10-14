import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';

/** One specific returned-owner boundary, not an arbitrary recovery format. */
export const IFN01_RETAINED_CHECKPOINT = Object.freeze({
  // Historical audited provenance; these private witnesses are not runtime inputs.
  sourceCommit: '22a5239be4755015f842a4e8105f72130c7ade6c',
  sourceTree: '2fc762c3c19107b6a8c9476381bb3e2ca13abbd6',
  publicCommit: '2c616b51621cc5add636acda4ec2cec895c36665',
  receiptSha256: 'ad3880ee830488d9e0222116d8f17f8a186cdbcec4b4b04e26063dcacb7f6303',
  censusSha256: 'fb712b233231c4fb9860927bbbfb512382f70c4f4c84489eee5c44104d7ea543',
  terminalSha256: '3533e930d1431d65cdef39545993dde3eedefc5658c20219ea069c0059674839',
  vitestSha256: null,
  gzipSha256: '7e5cb8841d54842570598cfc931151558645b16f7a73aac034e80bf57dfdaf31', gzipBytes: 1444580,
  databaseSha256: '528bbf5edd658876cdddc19d9883e6d4582591f23084c733c8deae5a27f161f2', databaseBytes: 23662592,
  tableCount: 122,
  outcomeSnapshotHash: '4e61617bb1a35130b57f71d0ec790ad89cd2e72d7dfc772eb5d67911ac9eaf95',
  endpointSnapshotHash: 'b11884b23a5a77b2411e7909b532e579c0abf7ead70f24d006ac8a19ac2e1c40',
  settlementSnapshotHash: 'bfdb3fc611aea9b579b603cb9b3584eb9c50c1671ac42883874e3fe379fff789',
  transitionSnapshotHash: '71d88572c58391b10164b0f046639c735578dd748cdf7b6df2a8a883c5ad1999',
  sealSnapshotHash: '1f152f6aabf2479d018bd0ba0e7fbac791b419cda3e9af98ace053ce243daf84',
  workSnapshotHash: 'ec1a2c95c9d229ba8ea5575f61bc227e8c1b30eaccd8858fe732be059598abde',
  reviewHeadHash: 'fc9a158f493298e962df6082e9e8416ed821208dad701fcfb49bd0e1d0ff9e84',
  transitionResultHash: 'bedbdb1a8a4d78f5bc8978a25c603c92c4c5de8dd63522c955787cbbe446cf94',
  priorCp35: Object.freeze({
    sourceCommit: '527ec838a703d9a121f4b96858db310817edccc0',
    sourceTree: '25eda7eba860f766be6c6c3cdd99fa2d57ecc921',
    publicCommit: 'c7928d3c5773604c21bd7b3c35eabb210344d26d',
    receiptSha256: '20609acce1f13eb34fb258d58936fbe700db195731acecab2c2e7476d592d8bd',
    censusSha256: '14f9fa85191b5b61478408699407827fb503d6241b1d4ca00a3742bd0e880254',
    terminalSha256: '2c8626e71833ae2233396b1cc62603b014df355c366282ef72c2932d6905780d',
    vitestSha256: 'a9404e8b48177a90cd0640f9b5bc7b02329c6f5bf4dc6f65738f1b96591997bc',
    gzipSha256: 'fcada1916f22cb6bc0de4b925b51eece3189606ca102ba72c500281e4f0459c1', gzipBytes: 1325286,
    databaseSha256: 'c40827396eaba6cde88649f815fe139e106799cb785e64e56558d952eb02ef1f', databaseBytes: 22171648,
    tableCount: 115,
    viewSnapshotHash: '2aabc1220373f44693396fc7656aa2e03eb489c61dd3c259cd86028fa951f345',
    sealSnapshotHash: '1f152f6aabf2479d018bd0ba0e7fbac791b419cda3e9af98ace053ce243daf84',
  }),
  priorCp10: Object.freeze({
    sourceCommit: 'e6de9bb39dda0df4412824f450189d65f8148a5d', sourceTree: '9945219b1e94a0fda85cb2923194f5b77657c45e',
    databaseSha256: '5e73efba78d5ef5e31192cfc645d7090bc819015dd4d41b07236131ee3533455',
    receiptSha256: 'e476d48b6c4019a46d49d72c08db94bd402b606e5975550e2c7d6cc5393901f1',
    terminalSha256: '87c18a6b42499b0e7376918d7cbed880d469259cc8b0866596dff0f1ce788a2f',
  }),
  originalCp273: Object.freeze({
    sourceCommit: '35c050668106d5d564e7419892db953040b37af2', sourceTree: '7e90c1ace30d36e8a0e0c87261e0c258ece6d910',
    databaseSha256: 'e0f15ab4cb9574131c48fb854c8a28c19162375329b24d6a69f7e38fd3b2beab',
    receiptSha256: '0d2365656d531bfef5525b6fcf10f6559ef90c5b308c2035a2a4126da410eb14',
    terminalSha256: 'b8cdc7f1717a1f9ee0e630e19c4f4adc8e7aa512a0887565de633adab7126ff5',
  }),
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
  // The independently audited byte pins identify post-transition cp13 even after its original
  // private witness files are lost. No replacement witness is synthesized.
  const gzip = pinnedFile(input.checkpointGzip, pin.gzipSha256); assert.equal(gzip.length, pin.gzipBytes);
  const bytes = gunzipSync(gzip, { maxOutputLength: pin.databaseBytes });
  assert.equal(bytes.length, pin.databaseBytes); assert.equal(sha256(bytes), pin.databaseSha256);
  assert.equal(realpathSync(dirname(input.destinationDirectory)), dirname(input.destinationDirectory), 'IFN01 output parent must be canonical');
  mkdirSync(input.destinationDirectory, { mode: 0o700 });
  const path = join(input.destinationDirectory, 'ifn01-cp13-release-suffix.sqlite');
  writeFileSync(path, bytes, { flag: 'wx', mode: 0o600 });
  assert.equal(sha256(readFileSync(path)), pin.databaseSha256);
  return { input, path, pin, witnessRecheck: { checkpointReceipt: false, tableCensus: false, failedTerminal: false } as const };
};
