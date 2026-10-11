import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { captureIFN01RetainedSuffixInput, prepareIFN01RetainedCheckpoint, IFN01_RETAINED_CHECKPOINT } from './IFN01RetainedCheckpoint.test-support';

const input = () => ({ nativeReleased: true, checkpointGzip: '/private/checkpoint.sqlite.gz', destinationDirectory: '/private/new-suffix' });
describe('exact IFN01 retained input boundary, without opening Native owners', () => {
  it('admits only post-transition cp13 and retains earlier cp35/cp10/cp273 as historical attribution', () => {
    expect(IFN01_RETAINED_CHECKPOINT.databaseSha256).toBe('528bbf5edd658876cdddc19d9883e6d4582591f23084c733c8deae5a27f161f2');
    expect(IFN01_RETAINED_CHECKPOINT.tableCount).toBe(122);
    expect(IFN01_RETAINED_CHECKPOINT.originalCp273.databaseSha256).toBe('e0f15ab4cb9574131c48fb854c8a28c19162375329b24d6a69f7e38fd3b2beab');
    expect(Object.isFrozen(IFN01_RETAINED_CHECKPOINT.originalCp273)).toBe(true);
    expect(IFN01_RETAINED_CHECKPOINT.priorCp10.databaseSha256).toBe('5e73efba78d5ef5e31192cfc645d7090bc819015dd4d41b07236131ee3533455');
    expect(IFN01_RETAINED_CHECKPOINT.terminalSha256).toBe('3533e930d1431d65cdef39545993dde3eedefc5658c20219ea069c0059674839');
    expect(IFN01_RETAINED_CHECKPOINT.priorCp35.databaseSha256).toBe('c40827396eaba6cde88649f815fe139e106799cb785e64e56558d952eb02ef1f');
    expect(IFN01_RETAINED_CHECKPOINT.vitestSha256).toBeNull();
    expect(IFN01_RETAINED_CHECKPOINT.sourceTree).toBe('2fc762c3c19107b6a8c9476381bb3e2ca13abbd6');
  });
  it('rejects unreleased execution before attempting filesystem access', () => {
    expect(() => prepareIFN01RetainedCheckpoint({ ...input(), nativeReleased: false })).toThrow('reviewed and released');
  });
  it('rejects an injected baseline or alternate result even with otherwise valid controls', () => {
    expect(() => captureIFN01RetainedSuffixInput({ ...input(), baseline: {} } as ReturnType<typeof input>)).toThrow('input fields differ');
    expect(() => captureIFN01RetainedSuffixInput({ ...input(), boundary: 'another-stage' } as ReturnType<typeof input>)).toThrow('input fields differ');
  });
  it('does not execute caller getters and keeps captured paths independent', () => {
    const source = input(); let invoked = 0;
    Object.defineProperty(source, 'nativeReleased', { enumerable: true, get() { invoked++; return true; } });
    expect(() => captureIFN01RetainedSuffixInput(source)).toThrow(); expect(invoked).toBe(0);
    const plain = input(), captured = captureIFN01RetainedSuffixInput(plain);
    expect(captured).toEqual(plain); expect(Object.keys(captured)).toHaveLength(3);
    plain.checkpointGzip = '/different/file';
    expect(captured.checkpointGzip).toBe('/private/checkpoint.sqlite.gz');
  });
  it('rejects a substituted gzip before creating the destination, without private witness files', () => {
    const directory = mkdtempSync(join(tmpdir(), 'ifn01-input-rejection-'));
    const checkpointGzip = join(directory, 'checkpoint.sqlite.gz'), destinationDirectory = join(directory, 'suffix');
    writeFileSync(checkpointGzip, 'substituted checkpoint');
    try {
      expect(() => prepareIFN01RetainedCheckpoint({ ...input(), checkpointGzip, destinationDirectory })).toThrow('input hash differs');
      expect(existsSync(destinationDirectory)).toBe(false);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
});
