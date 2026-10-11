import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PL01_RETAINED_CHECKPOINT, capturePL01RetainedSuffixInput, preparePL01RetainedCheckpoint } from './PL01RetainedCheckpoint.test-support';

const input = () => ({ nativeReleased: true, checkpointGzip: '/private/checkpoint.sqlite.gz', destinationDirectory: '/private/new-suffix' });
describe('exact PL01-R3 cp1 input boundary, without opening Native owners', () => {
  it('keeps the cp1 source and historical cp173/cp8 contracts separately attributed', () => {
    expect(PL01_RETAINED_CHECKPOINT.sourceCommit).toBe('e6de9bb39dda0df4412824f450189d65f8148a5d');
    expect(PL01_RETAINED_CHECKPOINT.priorCp173ContractCommit).toBe('d6dfd095dd6c59fd195484394d1be21e0705dfdc');
    expect(PL01_RETAINED_CHECKPOINT.priorCp8ContractCommit).toBe('fd0846a5aaa359708ba3e97722564ec9d2488ae9');
    expect(PL01_RETAINED_CHECKPOINT.databaseSha256).toBe('49685af2fe6f3277b4f6488af35140a54ceb79a8dc9774cff74fda9973049bcc');
  });
  it('rejects unreleased execution before attempting filesystem access', () => {
    expect(() => preparePL01RetainedCheckpoint({ ...input(), nativeReleased: false })).toThrow('reviewed and released');
  });
  it('rejects an injected baseline or alternate result even with otherwise valid controls', () => {
    expect(() => capturePL01RetainedSuffixInput({ ...input(), baseline: {} } as ReturnType<typeof input>)).toThrow('input fields differ');
    expect(() => capturePL01RetainedSuffixInput({ ...input(), desiredCount: { balls: 4, strikes: 2 } } as ReturnType<typeof input>)).toThrow('input fields differ');
    expect(() => capturePL01RetainedSuffixInput({ ...input(), stage: 'cp173' } as ReturnType<typeof input>)).toThrow('input fields differ');
    expect(() => capturePL01RetainedSuffixInput({ ...input(), stage: 'cp8' } as ReturnType<typeof input>)).toThrow('input fields differ');
  });
  it('does not execute caller getters and keeps captured paths independent', () => {
    const source = input(); let invoked = 0;
    Object.defineProperty(source, 'nativeReleased', { enumerable: true, get() { invoked++; return true; } });
    expect(() => capturePL01RetainedSuffixInput(source)).toThrow(); expect(invoked).toBe(0);
    const plain = input(), captured = capturePL01RetainedSuffixInput(plain);
    expect(captured).toEqual(plain); expect(Object.keys(captured)).toHaveLength(3);
    plain.checkpointGzip = '/different/file';
    expect(captured.checkpointGzip).toBe('/private/checkpoint.sqlite.gz');
  });
  it('rejects a substituted gzip before creating the destination, without private witness files', () => {
    const directory = mkdtempSync(join(tmpdir(), 'pl01-input-rejection-'));
    const checkpointGzip = join(directory, 'checkpoint.sqlite.gz'), destinationDirectory = join(directory, 'suffix');
    writeFileSync(checkpointGzip, 'substituted checkpoint');
    try {
      expect(() => preparePL01RetainedCheckpoint({ ...input(), checkpointGzip, destinationDirectory })).toThrow('input hash differs');
      expect(existsSync(destinationDirectory)).toBe(false);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
});
