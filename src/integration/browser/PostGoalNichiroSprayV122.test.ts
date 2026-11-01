import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { createReferenceBatKinematicsV1 } from '../../core/sim/contact/ReferenceBatKinematicsV1';
import { registerMeasuredBatToFieldV1 } from './MeasuredBatFieldRegistrationV1';
import { simulateLivePitchV1, type LiveMeasuredClipV1, type LivePitchInputV1 } from './LivePitchV1';

const outputOption = process.env.BASEBALL_MAKER_SPRAY_ABLATION_V122_OUTPUT;
const sha = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
// The frozen evidence is JSON, not an in-memory identity/IEEE-754 byte witness.
// Normalize both sides by precisely that boundary, with no numeric tolerance.
const jsonValue = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
type Pitch = ReturnType<typeof simulateLivePitchV1>;
type FrozenCase = Readonly<{ level: number; contact: Pitch['contact']; diagnostics: Pitch['diagnostics'];
  motorAtContact: { publicPose: ReturnType<Pitch['sampleBatAtTick']> } | null }>;
type FrozenPacket = Readonly<{ input: LivePitchInputV1; cases: readonly FrozenCase[]; pitchSourceDescriptorSha256: readonly string[] }>;
type PackedClip = Readonly<{ id: string; side: 'R' | 'L'; source: LiveMeasuredClipV1['source'];
  contactTimeSeconds: number; normalization: LiveMeasuredClipV1['normalization']; defaultSelection?: boolean; rows: readonly (readonly number[])[] }>;
const clockFields = (d: Pitch['diagnostics']) => ({ playbackRate: d.playbackRate, referenceStartTick: d.referenceStartTick,
  referenceThroughTick: d.referenceThroughTick, referenceContactTick: d.referenceContactTick,
  timingErrorSeconds: d.timingErrorSeconds, aimErrorMeters: d.aimErrorMeters, sweetSpotT: d.sweetSpotT,
  motorDelaySeconds: d.motorDelaySeconds });

function contactMotor(input: LivePitchInputV1, pitch: Pitch) {
  const tick = pitch.contact?.tick, descriptor = pitch.diagnostics.batPlaybackV88;
  if (tick === undefined || !descriptor) return null;
  const clip = input.measuredClips.find(c => c.id === descriptor.reference.provenance.clipId);
  if (!clip) throw Error('diagnostic motor original clip missing');
  const frames = registerMeasuredBatToFieldV1(clip.frames)
    .filter(f => f.tick >= descriptor.sourceFirstTick && f.tick <= descriptor.sourceLastTick)
    .map(f => ({ ...f, grip: { x: f.grip.x * descriptor.heightScale, y: f.grip.y * descriptor.heightScale, z: f.grip.z * descriptor.heightScale } }));
  const reference = createReferenceBatKinematicsV1({ ...descriptor.reference, frames });
  const sampleTick = descriptor.originTick + (tick - descriptor.originTick) / descriptor.reference.ticksPerSecond * descriptor.reference.ticksPerSecond;
  return { kind: 'PRESCRIBED_REFERENCE_MOTOR_NOT_POST_IMPACT_RECOIL', state: reference.sampleContinuous(sampleTick),
    publicPose: pitch.sampleBatAtTick(tick) };
}

// Explicit opt-in: private frozen packet/output are not general test fixtures.
// A normal suite import performs no diagnosis, file reads or pitch executions.
it.skipIf(!outputOption)('post-goal diagnosis: exact frozen level2 baseline gates six single-variable same-pitch trials', () => {
  const repo = fileURLToPath(new URL('../../../', import.meta.url));
  const queue = resolve(repo, 'docs/verification/post-goal-maker-spray-v122');
  const output = resolve(repo, outputOption!);
  if (!output.startsWith(queue + sep)) throw Error('diagnostic output must be a new child of the dedicated post-goal queue');
  mkdirSync(output); // Never overwrite an earlier success, failure or private packet.
  const save = (name: string, value: unknown) => writeFileSync(resolve(output, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
  let stage = 'load-frozen-evidence', executions = 0, baselinePassed = false;
  try {
    const frozenBytes = readFileSync(resolve(queue, 'run-user-roster-01/inside.json'));
    expect(sha(frozenBytes)).toBe('bd433884a111125b938e3a3b5cad2702454e9f051b05ff3d7560c7ce2e1c9507');
    const frozen = JSON.parse(frozenBytes.toString('utf8')) as FrozenPacket;
    const index = frozen.cases.findIndex(c => c.level === 2), expected = frozen.cases[index];
    expect(index).toBeGreaterThanOrEqual(0); expect(expected.contact).not.toBeNull();
    const baseline = jsonValue(frozen.input), originalInput = jsonValue(baseline);
    expect(baseline.location).toBe('inside'); expect(baseline.seed).toBe(20261019);
    expect(baseline.batter.bats).toBe('L'); expect(baseline.batter.clipId).toBe('obp-23_5');
    expect(baseline.batter.impactTrajectory?.level).toBe(2);
    expect(baseline.batter.pullAngleDegrees).toBe(-3);
    expect(baseline.batter.technicalTimingOffsetSeconds).toBe(0);
    const expectedSourceHash = frozen.pitchSourceDescriptorSha256[index];
    expect(expectedSourceHash).toMatch(/^[a-f0-9]{64}$/);
    save('metadata.json', { kind: 'POST_GOAL_TEST_ONLY_SEVEN_SINGLE_PITCH_ABLATION', nativeAdmission: false, officialResult: null,
      frozenEvidenceSha256: sha(frozenBytes), expectedSourceDescriptorSha256: expectedSourceHash,
      testSha256: sha(readFileSync(fileURLToPath(import.meta.url))),
      currentLivePitchSourceSha256: sha(readFileSync(resolve(repo, 'src/integration/browser/LivePitchV1.ts'))),
      baselineContract: 'JSON_ROUND_TRIP_EXACT_VALUES_NO_TOLERANCE', preservesIeeeSignedZeroOrUndefined: false,
      userPacketTopPathsAdopted: ['livePhysicalRoster'], userComparisonSeedKnown: false, seedAssumption: 20261019,
      maximumPitchExecutions: 7, automaticRetry: false, seedSearch: false, currentCoreCounterfactualsAreNotFullV122EquivalenceProof: true });

    const execute = (id: string, input: LivePitchInputV1, intervention: unknown) => {
      stage = id;
      if (executions >= 7) throw Error('diagnostic single-pitch execution budget exhausted');
      const before = jsonValue(input); executions++;
      const pitch = simulateLivePitchV1(input), motor = contactMotor(input, pitch), c = pitch.contact;
      const angle = c && Math.hypot(c.exitVelocity.x, c.exitVelocity.z) > 0 ? Math.atan2(c.exitVelocity.x, c.exitVelocity.z) * 180 / Math.PI : null;
      const record = jsonValue({ id, intervention, input, call: pitch.call, contact: c, contactMoment: pitch.contactMoment,
        sourceDescriptor: pitch.diagnostics.sourceDescriptor, sourceDescriptorSha256: sha(JSON.stringify(pitch.diagnostics.sourceDescriptor)),
        diagnostics: pitch.diagnostics, motorAtContact: motor,
        exitFieldAngleDegrees: angle, exitBatterRelativePullAngleDegrees: angle === null ? null : -angle * (input.batter.bats === 'R' ? 1 : -1),
        actualContactMinusReferenceSeconds: c ? (c.tick - pitch.diagnostics.referenceContactTick) / pitch.diagnostics.sourceClockTicksPerSecond : null });
      save(id + '.json', record); // Preserve the actual observation before any mismatch assertion.
      expect(jsonValue(input)).toStrictEqual(before);
      expect(record.sourceDescriptorSha256).toBe(expectedSourceHash);
      expect(jsonValue(pitch.diagnostics.sourceDescriptor)).toStrictEqual(jsonValue(expected.diagnostics.sourceDescriptor));
      return { pitch, motor, record };
    };

    const actual = execute('00-baseline', baseline, { kind: 'NONE' });
    stage = 'baseline-exact-json-gate';
    expect(jsonValue(actual.pitch.contact)).toStrictEqual(jsonValue(expected.contact));
    expect(actual.motor).not.toBeNull(); expect(expected.motorAtContact).not.toBeNull();
    expect(jsonValue(actual.motor!.publicPose)).toStrictEqual(jsonValue(expected.motorAtContact!.publicPose));
    expect(jsonValue(clockFields(actual.pitch.diagnostics))).toStrictEqual(jsonValue(clockFields(expected.diagnostics)));
    expect(jsonValue(baseline)).toStrictEqual(originalInput);
    baselinePassed = true;
    save('baseline-gate.json', { status: 'EXACT_JSON_BASELINE_PASSED', executions, expectedSourceHash,
      contact: 'EXACT', publicBatPose: 'EXACT', clockAndErrorFields: 'EXACT', numericToleranceApplied: false });

    // Decode only the one replacement clip, without touching the source file.
    const manifest = JSON.parse(readFileSync(resolve(repo, '../../outputs/_candidate_v122_20261026_02/build-sources-v122.json'), 'utf8'));
    const libraryBytes = readFileSync(resolve(repo, 'docs/demos/measured-bat-library-v1.json'));
    expect(sha(libraryBytes)).toBe(manifest.inputs['docs/demos/measured-bat-library-v1.json']);
    const library = JSON.parse(libraryBytes.toString('utf8')) as { columns: string[]; clips: PackedClip[] };
    expect(library.columns.slice(0, 11)).toStrictEqual(['tick', 'gripX', 'gripY', 'gripZ', 'tipX', 'tipY', 'tipZ', 'qw', 'qx', 'qy', 'qz']);
    const packed = library.clips.find(c => c.id === 'obp-51_3');
    if (!packed || packed.side !== baseline.batter.bats) throw Error('pinned ablation clip or batting side differs');
    const replacement: LiveMeasuredClipV1 = { id: packed.id, side: packed.side,
      source: { sha256: packed.source.sha256, repository: packed.source.repository }, contactTimeSeconds: packed.contactTimeSeconds,
      normalization: jsonValue(packed.normalization), defaultSelection: packed.defaultSelection,
      frames: packed.rows.map(row => ({ tick: row[0], grip: { x: row[1], y: row[2], z: row[3] },
        orientation: { w: row[7], x: row[8], y: row[9], z: row[10] } })) };
    const withBatter = (patch: Partial<LivePitchInputV1['batter']>): LivePitchInputV1 => ({ ...jsonValue(baseline), batter: { ...jsonValue(baseline.batter), ...patch } });
    const variants: { id: string; input: LivePitchInputV1; change: unknown }[] = [
      { id: '01-clip-51-only', input: { ...withBatter({ clipId: replacement.id }), measuredClips: [replacement] }, change: { kind: 'CLIP', clipId: replacement.id } },
      ...[0, 20, -20].map((angle, i) => ({ id: '0' + (i + 2) + '-pull-' + angle, input: withBatter({ pullAngleDegrees: angle }), change: { kind: 'PULL_ANGLE', degrees: angle } })),
      ...[.01, -.01].map((offset, i) => ({ id: '0' + (i + 5) + '-timing-' + offset, input: withBatter({ technicalTimingOffsetSeconds: offset }), change: { kind: 'TECHNICAL_TIMING_OFFSET', seconds: offset } })),
    ];
    const rows = [actual.record];
    for (const variant of variants) {
      const row = execute(variant.id, variant.input, variant.change);
      expect(jsonValue(row.pitch.diagnostics.aimErrorMeters)).toStrictEqual(jsonValue(actual.pitch.diagnostics.aimErrorMeters));
      expect(row.pitch.diagnostics.timingErrorSeconds).toBe(actual.pitch.diagnostics.timingErrorSeconds);
      expect(row.pitch.diagnostics.sweetSpotT).toBe(actual.pitch.diagnostics.sweetSpotT);
      // A miss or an unresolved physical case is an observation, not a reason
      // to search another seed or replace the trial with a manufactured hit.
      rows.push(row.record);
    }
    expect(executions).toBe(7);
    save('summary.json', { status: 'BOUNDED_ABLATION_COMPLETED', baselinePassed, executions, nativeAdmission: false, officialResult: null,
      numericToleranceApplied: false, seedSearch: false, causalConclusion: 'LOCAL_COUNTERFACTUAL_OBSERVATIONS_REQUIRE_INTERPRETATION',
      observations: rows.map(r => ({ id: r.id, intervention: r.intervention, sourceDescriptorSha256: r.sourceDescriptorSha256,
        contact: r.contact !== null, call: r.call, normal: r.contact?.normal ?? null, exitVelocity: r.contact?.exitVelocity ?? null,
        exitBatterRelativePullAngleDegrees: r.exitBatterRelativePullAngleDegrees, actualContactMinusReferenceSeconds: r.actualContactMinusReferenceSeconds })) });
  } catch (error) {
    save('failure.json', { status: 'ABLATION_FAILED_OR_BASELINE_MISMATCH', stage, executions, baselinePassed,
      variantsStarted: executions > 1, name: (error as Error).name, message: (error as Error).message,
      numericToleranceApplied: false, automaticRetry: false });
    throw error;
  }
}, 60_000);
