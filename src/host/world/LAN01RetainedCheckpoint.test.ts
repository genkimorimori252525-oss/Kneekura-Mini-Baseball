import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { captureLAN01RetainedSuffixInput, LAN01_RETAINED_CHECKPOINT, prepareLAN01RetainedCheckpoint } from './LAN01RetainedCheckpoint.test-support';

const input = () => ({ nativeReleased: true, checkpointGzip: '/private/checkpoint.sqlite.gz', destinationDirectory: '/private/new-suffix' });
describe('exact LAN01-R9 cp39 throw-plan boundary, without opening Native owners', () => {
  it('pins only the returned throw plan and preserves earlier failed lineage evidence', () => {
    const pin = LAN01_RETAINED_CHECKPOINT;
    expect([pin.checkpointSequence, pin.returnedOwnerCall, pin.gzipBytes, pin.databaseBytes, pin.tableCount, pin.rowCount]).toEqual([39, 39, 1146096, 18231296, 118, 1615]);
    expect(pin.gzipSha256).toBe('f308ac8c6633f2ad91c57d890f3a48761799dee56f9af92413e7db53b3183b2c');
    expect(pin.databaseSha256).toBe('39b508368773cc8cfa3bf962e8fed261f097519898210640badea9b7565363ce');
    expect(pin.receiptSha256).toBe('0f36afa9c07c59aa574d2c763532f8b121ed1480ec64a6a1f9bdb70987096db0');
    expect(pin.priorRunTerminalSha256).toBe('8dbface89e12ce4c3da0e1a4eb366da9cfd0dabeddb6394ad626dbccd7f4164b');
    expect(pin.priorRunOutcome).toBe('FAILED_WALL_AFTER_THROW_PLAN_BEFORE_CUT17_PREFIX_RETURN');
    expect(pin.priorRunObservationSha256).toBeNull();
    expect(pin.firstRemainingWriter).toEqual({ owner: 'SamePlateAppearanceLifecycle', method: 'acceptPrefix', sourceId: 'lan01:occupied:cut17:prefix',
      argumentsHash: '0f457df054a7328753c0637fe77a41b132541d9d0ea08a1f1498e42109218ac6' });
    expect(pin.throwBoundary.plannedReference.sourceId).toBe('lan01:appeal-throw:3');
    expect(pin.throwBoundary.plannedReference.snapshotHash).toBe('f5b70b23c04266c2357802456faae54dedd64c004b920eb308b52a1b7d8ac6c3');
    expect(pin.priorCp19.checkpointSequence).toBe(19);
    expect(pin.priorCp19.gzipSha256).toBe('1ff55c8e79eaee682eff205541416d6fe6d4434bfde056ac11085f7a0e59c96b');
    expect(pin.priorCp19.priorRunTerminalSha256).toBeNull();
    expect(pin.priorCp19.priorRunObservationSha256).toBe('fa60da67d0796f6594de6ea31cb5bdb870daaafa9e337092c5f0d57fee4e20d6');
    expect(pin.throwBoundary.inputReference).not.toEqual(pin.priorCp21.inputBoundary.inputReference);
    expect(pin.failedGroundContactLineage.reusableAsCorrectedSuffix).toBe(false);
    expect(pin.priorCp14.checkpointSequence).toBe(14);
  });
  it('preserves exact cp21 input bytes and its cp27 historical provenance', () => {
    const pin = LAN01_RETAINED_CHECKPOINT.priorCp21;
    expect({ gzipSha256: pin.gzipSha256, gzipBytes: pin.gzipBytes, databaseSha256: pin.databaseSha256, databaseBytes: pin.databaseBytes,
      receiptSha256: pin.receiptSha256, censusSha256: pin.censusSha256, tableCount: pin.tableCount, rowCount: pin.rowCount,
      checkpointSequence: pin.checkpointSequence, returnedOwnerCall: pin.returnedOwnerCall }).toEqual({
      gzipSha256: 'c11060ee2789fb3a3e4414975731d561beb0779d2e3822016c87a5e95dae7974', gzipBytes: 921724,
      databaseSha256: 'd6db63ca4b6302e7810db064de3b9fda451d67b25a453299b8a7334de946f85a', databaseBytes: 14417920,
      receiptSha256: '1a154dc1cc0c8e027495d819e3349eccb1d806eaadd7e46bd5953602a6a4e506',
      censusSha256: 'c7f1af266abe03727895125ecb3e3fbe11baaeb306f66b9072551612c2b0705e',
      tableCount: 117, rowCount: 1290, checkpointSequence: 21, returnedOwnerCall: 21,
    });
    expect(pin.priorCp27.gzipSha256).toBe('7e296210d3e8cb32dcb07160ecd6223e2b6fb7ed85449319286dda2564e9d29c');
    expect(pin.gzipSha256).not.toBe(pin.priorCp27.gzipSha256);
    expect(pin.priorCp27.checkpointSequence).toBe(27);
    expect(pin.deliveryBoundary).toBe(pin.priorCp27.deliveryBoundary);
    expect(pin.priorCp23).toBe(pin.priorCp27.priorCp23);
    expect(pin.priorRunTerminalSha256).toBeNull();
    expect(pin.priorRunObservationSha256).toBe('fa60da67d0796f6594de6ea31cb5bdb870daaafa9e337092c5f0d57fee4e20d6');
    expect(pin.priorRunOutcome).toBe('INTERRUPTED_AFTER_ENVIRONMENT_CHANGE_TERMINAL_UNKNOWN');
    expect(pin.priorVitestReportSha256).toBeNull(); expect(pin.priorSuffixResultPresent).toBe(false);
  });
  it('extends the unchanged delivery pins through accepted input and complete cut9 only', () => {
    const pin = LAN01_RETAINED_CHECKPOINT.priorCp21;
    for (const [key, value] of Object.entries(pin.deliveryBoundary)) {
      expect(pin.inputBoundary[key as keyof typeof pin.inputBoundary]).toBe(value);
    }
    const { predictionReference, scoreReference, emotionReference, decisionCutReference, decisionPrefixReference, inputReference, cut9ViewReference } = pin.inputBoundary;
    expect([predictionReference, scoreReference, emotionReference, decisionCutReference, decisionPrefixReference, inputReference, cut9ViewReference]
      .map(({ owner, sourceId, sourceHash, snapshotHash }) => [owner, sourceId, sourceHash, snapshotHash])).toEqual([
      ['batting_prediction_v1_predictions', 'lan01:swing:forecast', '9b8b53ddc17cc89b6d74e04911fa371d95a86a836261a34d393288515c078f07', '9c6210faa4c84e2bd6897e7f554d1d3776c954c4b561b1abc27686672eeaf93e'],
      ['batting_score_v1_assessments', 'lan01:swing:score', 'a8610d3eceda2cce6d1d13a918ac467cc1a8099537a2e295ebb2922c9fdbf91f', 'a35aa83fcd40f2e9be9b6910dee638625828a4fe629221efdf8265f7e3c9cea3'],
      ['batting_emotion_execution_v1_executions', 'lan01:swing:emotion', '09a5b9e01139682591c791b55facf60e88b7d0e06568772d37ed24cd5927236b', '5fe4af53843d48d480b4435890bab7e9637950414d312ebe9194a04ee048a521'],
      ['pa_physical_v1_cuts', 'lan01:swing:decision-cut', '9929d9c3b6500cc47ec0336a86eb8bf3414dfc21c629cc19bc1db9778b2176a6', '7a93f018c4233f3ac5d063f340026b2c8e289ff2a854a8a0192f19f7a1d385cc'],
      ['pa_lifecycle_v1_work_prefixes', 'lan01:occupied:cut9:prefix', '3ff1726d0067cd9afb251350f028b5bfcf70ec70434091780259a8ab4ec3c7ac', 'c9127809ec5dc94ee06950e7696421eb4852fe3e6cfb5a4243a29e168a1a8e87'],
      ['batting_execution_v1_inputs', 'lan01:swing:input', '45f087b14a3e9ff81a23b885df411f24698fc1210d08ef71b82e7e41dbb5428d', 'e9ee71e4525091ac0942ef60f7240fa092703e971294492e796a4885d31301ac'],
      ['pa_lifecycle_v1_execution_views', 'lan01:occupied:cut9:view', 'fc9cdadb774d5834cff2f166793c3b5271a5da822402884292ee1c24d30e4b6e', '9e83c718644d104c39bf8b35e553b5ad88975d2a21bf04f9e5cb73403607455e'],
    ]);
    expect(pin.firstRemainingWriter).toEqual({ owner: 'SamePlateAppearancePhysicalEpisode', method: 'acceptOperation', sourceId: 'lan01:swing:commitment',
      argumentsHash: '55ca606ba61b079c7f08142b1223ac14fc1944d70a50907dd7c51335ecf466c1' });
  });
  it('keeps canonical authentication before exclusive cp39 materialization and readback', () => {
    const source = readFileSync(new URL('./LAN01RetainedCheckpoint.test-support.ts', import.meta.url), 'utf8');
    const materializer = source.slice(source.indexOf('export const prepareLAN01RetainedCheckpoint'));
    expect(materializer).toContain("assert.equal(realpathSync(path), path, 'LAN01 input must be a canonical file path')");
    expect(materializer).toContain("assert(lstatSync(path).isFile(), 'LAN01 input must be a regular file')");
    const authenticated = materializer.indexOf('assert.equal(sha256(bytes), pin.databaseSha256)');
    const exclusiveDirectory = materializer.indexOf('mkdirSync(input.destinationDirectory, { mode: 0o700 })');
    const exclusiveFile = materializer.indexOf("writeFileSync(path, bytes, { flag: 'wx', mode: 0o600 })");
    expect(authenticated).toBeGreaterThan(-1); expect(exclusiveDirectory).toBeGreaterThan(authenticated);
    expect(exclusiveFile).toBeGreaterThan(exclusiveDirectory);
    expect(materializer.indexOf('assert.equal(sha256(readFileSync(path)), pin.databaseSha256)')).toBeGreaterThan(exclusiveFile);
    expect(materializer).toContain("join(input.destinationDirectory, 'lan01-cp39-throw-plan-suffix.sqlite')");
    expect(materializer).toContain('const input = captureLAN01RetainedSuffixInput(raw), pin = LAN01_RETAINED_CHECKPOINT');
    expect(materializer).not.toContain('recursive: true');
  });
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

it('keeps the original twenty LAN callback assertions and the final eleven byte-identical', () => {
  const original = readFileSync(new URL('./SamePlateAppearanceLiveAppealNativeIntegration.test.ts', import.meta.url), 'utf8');
  const retained = readFileSync(new URL('./LAN01OriginalLiveAppealAssertions.test-support.ts', import.meta.url), 'utf8');
  const start = '    expect(h.f.actor.match.bases)';
  const originalTail = original.slice(original.indexOf(start), original.indexOf('  }finally{previous.close();}'));
  const swingSplit = '    const preparation=preparations[0];';
  const swingCall = '    return continueLAN01OriginalLiveAppealAfterSwingAssertions(previous, h, preparations, swing, stage);';
  const throwSplit = "    if(!caught||!thrown.appealed||thrown.appealed.value.actionResult?.kind!=='appeal_contact_v1')";
  const throwCall = '    return continueLAN01OriginalLiveAppealAfterThrowAssertions(h, field, caught, thrown, stage);';
  const initial = retained.slice(retained.indexOf(start), retained.indexOf(swingCall));
  const beforeThrow = retained.slice(retained.indexOf(swingSplit), retained.indexOf(throwCall));
  const remaining = retained.slice(retained.indexOf(throwSplit), retained.lastIndexOf('};'));
  expect(initial + beforeThrow + remaining).toBe(originalTail);
  expect(originalTail.match(/\bexpect\(/g)).toHaveLength(20);
  expect(initial.match(/\bexpect\(/g)).toHaveLength(4);
  expect(beforeThrow.match(/\bexpect\(/g)).toHaveLength(5);
  expect(remaining.match(/\bexpect\(/g)).toHaveLength(11);
  expect(remaining).toBe(originalTail.slice(originalTail.indexOf(throwSplit)));
  const entry = readFileSync(new URL('./LAN01RetainedOriginalSuffix.test-support.ts', import.meta.url), 'utf8');
  expect(entry).toContain('historicalOriginalCallbackAssertionCount: 9');
  expect(entry).toContain('historicalR9CallbackAssertionCount: 5');
  expect(entry).toContain('remainingOriginalCallbackAssertionCount: 11');
  expect(entry).toContain('let remainingOriginalCallbackAssertionsExecuted = false, originalThrowRemainderExecuted = false');
  expect(entry.indexOf('originalThrowRemainderExecuted = true')).toBeGreaterThan(entry.indexOf('const thrown = resumeNativePhysicalThrowReceptionAfterPlan('));
  expect(entry.indexOf('remainingOriginalCallbackAssertionsExecuted = true')).toBeGreaterThan(entry.indexOf('    continueLAN01OriginalLiveAppealAfterThrowAssertions('));
});

it('loads the exact remaining entry without invoking Native owners', async () => {
  const entry = await import('./LAN01RetainedOriginalSuffix.test-support');
  expect(typeof entry.runLAN01RetainedOriginalSuffix).toBe('function');
}, 30_000);

it('retains the exact original post-right body for fresh and retained occupied callers', () => {
  const source = readFileSync(new URL('./SamePlateAppearanceOccupiedContinuation.test-support.ts', import.meta.url), 'utf8');
  const start = "  const pitchCalibration = calibrations.calibrations.find(c=>c.source.route==='pitch_delivery')!;";
  const tail = source.slice(source.indexOf(start), source.indexOf('\n};\n\n/** Fresh PL01'));
  // Current shared body at 32d744b9, after readback extraction; includes first-TAKE,
  // held-window, unchanged-Match, retry and the original readback helper in order.
  expect(createHash('sha256').update(tail).digest('hex')).toBe('c690551b62745929558c15efa9a3c904b3c9bee5e5ad70d046fb7b8a6dac2049');
  expect(tail.match(/\bexpect\(/g)).toHaveLength(13);
  const readback = readFileSync(new URL('./SamePlateAppearanceOccupiedReadback.test-support.ts', import.meta.url), 'utf8');
  expect(readback.match(/\bexpect\(/g)).toHaveLength(2);
  expect(tail).toContain('finishSamePaOccupiedPitchReadback(reopened,pitch,bytes,saved)');
});
