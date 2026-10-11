import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { captureLAN01RetainedSuffixInput, prepareLAN01RetainedCheckpoint } from './LAN01RetainedCheckpoint.test-support';

const input = () => ({ nativeReleased: true, checkpointGzip: '/private/checkpoint.sqlite.gz', destinationDirectory: '/private/new-suffix' });
describe('exact LAN01-R1 cp181 input boundary, without opening Native owners', () => {
  it('rejects unreleased execution before attempting filesystem access', () => {
    expect(() => prepareLAN01RetainedCheckpoint({ ...input(), nativeReleased: false })).toThrow('reviewed and released');
  });
  it('rejects an injected baseline or alternate result even with otherwise valid controls', () => {
    expect(() => captureLAN01RetainedSuffixInput({ ...input(), baseline: {} } as ReturnType<typeof input>)).toThrow('input fields differ');
    expect(() => captureLAN01RetainedSuffixInput({ ...input(), desiredCount: { balls: 4, strikes: 2 } } as ReturnType<typeof input>)).toThrow('input fields differ');
    expect(() => captureLAN01RetainedSuffixInput({ ...input(), stage: 'walk-prefix' } as ReturnType<typeof input>)).toThrow('input fields differ');
  });
  it('does not execute caller getters and keeps captured paths independent', () => {
    const source = input(); let invoked = 0;
    Object.defineProperty(source, 'nativeReleased', { enumerable: true, get() { invoked++; return true; } });
    expect(() => captureLAN01RetainedSuffixInput(source)).toThrow(); expect(invoked).toBe(0);
    const plain = input(), captured = captureLAN01RetainedSuffixInput(plain);
    expect(captured).toEqual(plain); expect(Object.keys(captured)).toHaveLength(3);
    plain.checkpointGzip = '/different/file';
    expect(captured.checkpointGzip).toBe('/private/checkpoint.sqlite.gz');
  });
  it('rejects a substituted gzip before creating the destination, without private witness files', () => {
    const directory = mkdtempSync(join(tmpdir(), 'lan01-input-rejection-'));
    const checkpointGzip = join(directory, 'checkpoint.sqlite.gz'), destinationDirectory = join(directory, 'suffix');
    writeFileSync(checkpointGzip, 'substituted checkpoint');
    try {
      expect(() => prepareLAN01RetainedCheckpoint({ ...input(), checkpointGzip, destinationDirectory })).toThrow('input hash differs');
      expect(existsSync(destinationDirectory)).toBe(false);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
});

it('keeps the original unperformed LAN callback statements and assertions byte-identical', () => {
  const original = readFileSync(new URL('./SamePlateAppearanceLiveAppealNativeIntegration.test.ts', import.meta.url), 'utf8');
  const retained = readFileSync(new URL('./LAN01OriginalLiveAppealAssertions.test-support.ts', import.meta.url), 'utf8');
  const start = '    expect(h.f.actor.match.bases)';
  const originalTail = original.slice(original.indexOf(start), original.indexOf('  }finally{previous.close();}'));
  const retainedTail = retained.slice(retained.indexOf(start), retained.lastIndexOf('};'));
  expect(originalTail.length).toBeGreaterThan(5000);
  expect(retainedTail).toBe(originalTail);
  expect(originalTail.match(/\bexpect\(/g)).toHaveLength(20);
});

it('loads the exact remaining entry without invoking Native owners', async () => {
  const entry = await import('./LAN01RetainedOriginalSuffix.test-support');
  expect(typeof entry.runLAN01RetainedOriginalSuffix).toBe('function');
}, 30_000);
