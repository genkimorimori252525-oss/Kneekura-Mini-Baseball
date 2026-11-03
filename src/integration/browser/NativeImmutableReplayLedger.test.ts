import { describe, expect, it } from 'vitest';
import type { OfficialStateApplicationReceipt } from '../../core/adjudication/NextPlayActivation';
import type { CanonicalMatchState } from '../../core/model/CanonicalMatchState';
import type { CanonicalWorldSnapshot } from '../../core/model/CanonicalWorldSnapshot';
import { asRuleProfileId } from '../../core/model/RuleProfileRef';
import { REFERENCE_BASEBALL_AERODYNAMICS } from '../../core/sim/ball/BaseballAerodynamics';
import { REALISTIC_BASEBALL_RIGID_BODY, type RigidBatPhysicalProperties } from '../../core/sim/contact/RigidBatBallContact';
import { createSwingKinematicsTrajectoryV1 } from '../../core/sim/contact/SwingKinematicsV1';
import { createRigidBatSwingWindowFromKinematicsV1 } from '../../core/sim/pitching/AerodynamicRigidBatSwingingPitchPhysicalResult';
import type { AerodynamicRigidPitchAgainstBatterInput } from '../../core/sim/pitching/AerodynamicRigidPitchAgainstBatter';
import type { AerodynamicPitchTrajectory } from '../../core/sim/pitching/AerodynamicPitchTrajectory';
import { createNativeAerodynamicSession, type NativeAerodynamicIssuedPitch } from './NativeAerodynamicSession';
import { createReferenceAerodynamicPhysicalSource } from './NativeAerodynamicReferenceFixture';
import {
  appendNativeExternalOfficialReceipt,
  appendNativeImmutableReplayPitch,
  createNativeImmutableReplayLedger,
  digestNativeReplayData,
  NATIVE_IMMUTABLE_REPLAY_DIGEST_ALGORITHM,
  NATIVE_IMMUTABLE_REPLAY_LEDGER_VERSION,
  verifyNativeImmutableReplayLedger,
  type NativeImmutableReplayLedgerDTO,
  type NativeReplayPitchEntry,
} from './NativeImmutableReplayLedger';

const BEGIN = 1_000_000;
const match = (balls = 0, strikes = 0, bases = false): CanonicalMatchState => ({
  ruleProfileId: asRuleProfileId('npb-2026'), inning: 1, half: 'top', outs: 0, balls, strikes,
  bases: bases ? { first: 'first', second: 'second', third: 'third' }
    : { first: null, second: null, third: null },
  score: { away: 0, home: 0 }, playId: 71,
});
const actors: Pick<CanonicalWorldSnapshot, 'defenders' | 'runners'> = {
  defenders: [{
    playerId: 'pitcher', registeredPosition: 'P', position: { x: 0, z: 0.2 },
    velocity: { x: 0, z: 0 }, assignment: { kind: 'hold' },
  }],
  runners: [{
    playerId: 'first', position: { x: 3, z: 4 }, velocity: { x: 0, z: 0 },
  }],
};
const command = (side: 'inside' | 'outside' = 'inside') => ({
  pitcher: { attackZone: side, aggression: 'balanced' as const, verticalPlan: 'middle' as const },
  batter: { approach: 'balanced' as const, swingBias: 'neutral' as const },
  runners: { posture: 'balanced' as const },
});
const trajectory = (start: number, x = 0, duration = 6_000): AerodynamicPitchTrajectory => ({
  start: {
    tick: start, position: { x, y: 1, z: 0.2 },
    velocity: { x: 0, y: 0, z: -60 }, spin: { x: 15, y: 60, z: 10 },
  },
  endTick: start + duration,
  parameters: {
    ticksPerSecond: 1_000_000, integrationStepTicks: 100,
    gravityY: -9.81, aerodynamics: REFERENCE_BASEBALL_AERODYNAMICS,
  },
});
const take = (start: number, x = 0, duration = 6_000): AerodynamicRigidPitchAgainstBatterInput => ({
  action: { kind: 'take' }, trajectory: trajectory(start, x, duration),
  plateZ: 0, strikeZone: { centerX: 0, halfWidth: 0.25, lowerY: 0.5, upperY: 1.5 },
  ballRadiusMeters: REALISTIC_BASEBALL_RIGID_BODY.radiusM,
});
const bat: RigidBatPhysicalProperties = {
  massKg: 0.9, centerOfMassT: 0.6, transverseMomentOfInertiaKgM2: 0.06,
  axialMomentOfInertiaKgM2: 0.00055,
  radiusProfile: { knots: [{ t: 0, radiusM: 0.033 }, { t: 1, radiusM: 0.033 }] },
};
const contactPitch = (start: number): AerodynamicRigidPitchAgainstBatterInput => ({
  action: { kind: 'swing', swing: {
    startTick: start, endTick: start + 6_000, ticksPerSecond: 1_000_000, physical: bat,
    stateAtStart: {
      pose: { grip: { x: -0.42, y: 1, z: 0 }, tip: { x: 0.42, y: 1, z: 0 } },
      linearVelocity: { x: 0, y: 0, z: 0 }, angularVelocity: { x: 0, y: 0, z: 0 },
    },
  } },
  trajectory: trajectory(start), ball: REALISTIC_BASEBALL_RIGID_BODY,
  parameterResolver: () => ({ normalRestitution: 0.5, tangentialRestitution: 0.3, frictionCoefficient: 0.2 }),
});
const missPitch = (start: number): AerodynamicRigidPitchAgainstBatterInput => {
  const still = { x: 0, y: 0, z: 0 };
  const far = { x: 5, y: 1, z: 0 };
  const axis = { x: 1, y: 0, z: 0 };
  const swing = createSwingKinematicsTrajectoryV1({
    startTick: start, contactTick: start + 3_000, endTick: start + 6_000,
    ticksPerSecond: 1_000_000, batLengthM: 0.84, sweetSpotT: 0.5,
    start: { sweetSpotPosition: far, sweetSpotVelocity: still, batAxis: axis },
    contact: { sweetSpotPosition: far, sweetSpotVelocity: still, batAxis: axis },
    finish: { sweetSpotPosition: far, sweetSpotVelocity: still, batAxis: axis },
  });
  return {
    action: { kind: 'swing', swing: createRigidBatSwingWindowFromKinematicsV1(swing, bat) },
    trajectory: trajectory(start, 0, 7_000), ball: REALISTIC_BASEBALL_RIGID_BODY,
    parameterResolver: () => { throw new Error('rigid physical miss never enters collision resolver'); },
  };
};
const newSession = (initial = match()) => createNativeAerodynamicSession({
  match: initial, startedAtTick: 900_000, matchSeed: 1234, batterRunnerId: 'batter-native',
  batterHandedness: 'L', pitcherHandedness: 'R',
});
function nativeIssue(
  session: ReturnType<typeof newSession>,
  pitch: AerodynamicRigidPitchAgainstBatterInput,
  side: 'inside' | 'outside' = 'inside',
): NativeAerodynamicIssuedPitch {
  session.acceptNextCommand(command(side));
  return session.issue(() => ({ pitch, actorsAtTick: () => actors }));
}
const fresh = (initial = match()): NativeImmutableReplayLedgerDTO =>
  createNativeImmutableReplayLedger({ initialMatch: initial, startedAtTick: 900_000 });
const append = (
  ledger: NativeImmutableReplayLedgerDTO,
  issued: NativeAerodynamicIssuedPitch,
  actualPitch: AerodynamicRigidPitchAgainstBatterInput,
  id: string,
) => appendNativeImmutableReplayPitch(ledger, { issued, actualPitch, sourceId: id });
const json = (value: NativeImmutableReplayLedgerDTO) => JSON.parse(JSON.stringify(value)) as Record<string, any>;
const recomputeFirstEntryDigest = (changed: Record<string, any>): void => {
  const { digest: _oldDigest, ...unsigned } = changed.entries[0];
  changed.entries[0].digest = digestNativeReplayData({
    domain: 'native-aerodynamic-accepted-replay/entry/v1', entry: unsigned,
  });
  changed.headDigest = changed.entries[0].digest;
};

describe('Native immutable aerodynamic accepted-event replay ledger', () => {
  it('uses portable standard SHA-256 of sorted inert UTF-8 JSON and a versioned genesis', () => {
    expect(NATIVE_IMMUTABLE_REPLAY_LEDGER_VERSION).toBe(1);
    expect(NATIVE_IMMUTABLE_REPLAY_DIGEST_ALGORITHM).toBe('sha256');
    expect(digestNativeReplayData('abc')).toBe('6cc43f858fbb763301637b5af970e2a46b46f461f27e5a0f41e009c59b827b25');
    expect(digestNativeReplayData({ b: 2, a: 1 })).toBe('43258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777');
    expect(digestNativeReplayData({ a: 1, b: 2 })).toBe(digestNativeReplayData({ b: 2, a: 1 }));
    const start = fresh();
    expect(start.version).toBe(1);
    expect(start.entries).toEqual([]);
    expect(start.headDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(Object.isFrozen(start)).toBe(true);
    expect(verifyNativeImmutableReplayLedger(JSON.parse(JSON.stringify(start)), start.headDigest)).toEqual(start);
  });

  it('copies real source trajectory, exact Core physical samples, accepted events and canonical clock', () => {
    const pa = newSession();
    const physical = take(BEGIN);
    const issued = nativeIssue(pa, physical);
    const start = fresh();
    const ledger = append(start, issued, physical, 'physics://pitch/001');
    expect(start.entries).toEqual([]);
    expect(ledger.entries).toHaveLength(1);
    const entry = ledger.entries[0] as NativeReplayPitchEntry;
    expect(entry).toMatchObject({
      kind: 'accepted_pitch', version: 1, ordinal: 0, sourceId: 'physics://pitch/001',
      phase: 'active', camera: 'BATTER_POV',
      handedness: { batter: 'L', pitcher: 'R' },
      clock: {
        acceptedAtTick: 900_000, sourceStartTick: BEGIN, sourceEndTick: BEGIN + 6_000,
        ticksPerSecond: 1_000_000, integrationStepTicks: 100,
        canonicalBeforeTick: 900_000, observationStopTick: BEGIN + 6_000,
      },
    });
    expect(entry.events).toEqual(issued.result.events);
    expect(entry.samples).toEqual(issued.result.samples);
    expect(entry.statusAfter).toEqual(issued.result.result.timeline.status);
    expect(entry.events.map(event => [event.kind, event.tick, event.sequence])).toEqual(
      issued.result.events.map(event => [event.kind, event.tick, event.sequence]),
    );
    expect(entry.events.map(event => event.kind)).toEqual(['TakenPitchPlateCrossed', 'PitchAdjudicated']);
    expect(entry.rigidContact).toBeNull();
    expect(ledger.headDigest).toBe(entry.digest);
    expect(entry.previousDigest).toBe(start.headDigest);
    expect(Object.isFrozen(entry.samples[0].world.ball)).toBe(true);
    const hydrated = verifyNativeImmutableReplayLedger(JSON.parse(JSON.stringify(ledger)), ledger.headDigest);
    expect(hydrated).toEqual(ledger);
    expect(JSON.stringify(hydrated)).toBe(JSON.stringify(ledger));
    expect(hydrated.entries.some(item => item.kind === 'external_official_receipt')).toBe(false);
  });

  it('links canonical sequence and source-clock boundaries across two genuine pitches without replaying future state', () => {
    const pa = newSession();
    const firstInput = take(BEGIN);
    const first = nativeIssue(pa, firstInput);
    const one = append(fresh(), first, firstInput, 'real-1');
    const secondInput = take(BEGIN + 10_000, 1);
    const second = nativeIssue(pa, secondInput, 'outside');
    const two = append(one, second, secondInput, 'real-2');
    expect(one.entries).toHaveLength(1);
    expect(two.entries).toHaveLength(2);
    const entry1 = two.entries[0] as NativeReplayPitchEntry;
    const entry2 = two.entries[1] as NativeReplayPitchEntry;
    expect(entry2.previousDigest).toBe(entry1.digest);
    expect(entry2.events.map(e => e.sequence)).toEqual([2, 3]);
    expect(entry2.events[0].tick).toBeGreaterThan(entry1.clock.sourceEndTick);
    expect(entry2.clock.acceptedAtTick).toBe(entry1.clock.canonicalAfterTick);
    expect(entry2.statusAfter).toEqual(second.result.result.timeline.status);
    expect(entry2.commandSession.command.pitcher.attackZone).toBe('outside');
    expect(verifyNativeImmutableReplayLedger(json(two), two.headDigest)).toEqual(two);
    expect(one.headDigest).not.toBe(two.headDigest);
  });

  it('is deterministic across separate Native sessions with the same source and stores a full reference 18m flight', () => {
    const run = (): NativeImmutableReplayLedgerDTO => {
      const pa = newSession();
      const physics = createReferenceAerodynamicPhysicalSource({
        actorsAtTick: () => actors, pitchSpeedMps: 40, batterAction: 'take',
      });
      pa.acceptNextCommand(command());
      let source: AerodynamicRigidPitchAgainstBatterInput | null = null;
      const issued = pa.issue(request => {
        const materialized = physics(request);
        source = materialized.pitch;
        return materialized;
      });
      if (source === null) throw new Error('production fixture did not supply a source');
      return append(fresh(), issued, source, 'explicit-reference-18m');
    };
    const first = run();
    const second = run();
    expect(first).toEqual(second);
    expect(first.headDigest).toBe(second.headDigest);
    const entry = first.entries[0] as NativeReplayPitchEntry;
    expect(entry.trajectory.start.position.z).toBe(18);
    expect(entry.trajectory.endTick - entry.trajectory.start.tick).toBe(700_000);
    expect(entry.samples.length).toBeGreaterThan(10);
    expect(verifyNativeImmutableReplayLedger(json(first))).toEqual(first);
  });

  it('replays actual rigid-body contact using the materialized physical response, then fails closed', () => {
    const pa = newSession();
    const physical = contactPitch(BEGIN);
    const issued = nativeIssue(pa, physical);
    expect(issued.phase).toBe('batted_ball_pending');
    const ledger = append(fresh(), issued, physical, 'physical-contact');
    const entry = ledger.entries[0] as NativeReplayPitchEntry;
    expect(entry.phase).toBe('batted_ball_pending');
    expect(entry.events.map(e => e.kind)).toEqual(['BatBallContact']);
    expect(entry.rigidContact?.normalImpulseNs).toBeGreaterThan(0);
    expect(entry.action).toMatchObject({
      kind: 'swing', impactParameters: {
        normalRestitution: 0.5, tangentialRestitution: 0.3, frictionCoefficient: 0.2,
      },
    });
    expect(entry.clock.observationStopTick).toBe(entry.rigidContact?.tick);
    expect(entry.samples.at(-1)?.world.tick).toBe(entry.rigidContact?.tick);
    expect(entry.samples.at(-1)?.world.ball?.velocity).toEqual(entry.rigidContact?.exitVelocity);
    expect(verifyNativeImmutableReplayLedger(json(ledger))).toEqual(ledger);
    expect(() => append(ledger, issued, physical, 'late-source')).toThrow('terminal or unresolved');
  });

  it('replays a real Swing Kinematics v1 miss and exact Game strike count', () => {
    const pa = newSession();
    const physical = missPitch(BEGIN);
    const issued = nativeIssue(pa, physical);
    expect(issued.phase).toBe('active');
    const ledger = append(fresh(), issued, physical, 'swing-miss');
    const entry = ledger.entries[0] as NativeReplayPitchEntry;
    expect(entry.events.map(e => e.kind)).toEqual(['SwingCompletedWithoutContact', 'PitchAdjudicated']);
    expect(entry.statusAfter).toEqual({ kind: 'active', count: { balls: 0, strikes: 1 } });
    expect(entry.action).toMatchObject({ kind: 'swing', impactParameters: null });
    expect(entry.rigidContact).toBeNull();
    expect(verifyNativeImmutableReplayLedger(json(ledger))).toEqual(ledger);
  });

  it('preserves unresolved take with zero accepted events and forbids invented subsequent calls', () => {
    const pa = newSession();
    const physical = take(BEGIN, 0, 1_000);
    const issued = nativeIssue(pa, physical);
    expect(issued.phase).toBe('unresolved');
    const ledger = append(fresh(), issued, physical, 'source-no-crossing');
    const entry = ledger.entries[0] as NativeReplayPitchEntry;
    expect(entry.events).toEqual([]);
    expect(entry.clock.canonicalAfterTick).toBe(900_000);
    expect(entry.statusAfter).toEqual({ kind: 'active', count: { balls: 0, strikes: 0 } });
    expect(verifyNativeImmutableReplayLedger(json(ledger))).toEqual(ledger);
    expect(() => append(ledger, issued, physical, 'unresolved-next')).toThrow('terminal or unresolved');
  });

  it('stores official application only if externally supplied, never derives an out/hit or a receipt from physics', () => {
    const pa = newSession(match(3, 0, true));
    const physical = take(BEGIN, 1);
    const issued = nativeIssue(pa, physical);
    expect(issued.phase).toBe('walk');
    const ledger = append(fresh(match(3, 0, true)), issued, physical, 'actual-walk');
    expect(ledger.entries).toHaveLength(1);
    const official: OfficialStateApplicationReceipt = {
      applicationId: 'native-official-persisted-application',
      closureId: 'native-externally-closed-play',
      previousPlayId: 71,
      durableRevision: 1,
      appliedMatchState: issued.nextMatchState!,
    };
    const stamped = appendNativeExternalOfficialReceipt(ledger, {
      pitchOrdinal: 0, receivedAtTick: BEGIN + 6_500, receipt: official,
    });
    expect(stamped.entries).toHaveLength(2);
    expect(stamped.entries[1]).toMatchObject({
      kind: 'external_official_receipt',
      pitchOrdinal: 0, receivedAtTick: BEGIN + 6_500,
      receipt: official, previousDigest: ledger.headDigest,
    });
    expect(stamped.headDigest).not.toBe(ledger.headDigest);
    expect(ledger.entries).toHaveLength(1);
    expect(verifyNativeImmutableReplayLedger(json(stamped), stamped.headDigest)).toEqual(stamped);
    expect(() => appendNativeExternalOfficialReceipt(stamped, {
      pitchOrdinal: 0, receivedAtTick: BEGIN + 7_000, receipt: official,
    })).toThrow('duplicate official');
    expect(() => appendNativeExternalOfficialReceipt(ledger, {
      pitchOrdinal: 7, receivedAtTick: BEGIN + 6_500, receipt: official,
    })).toThrow('bind exactly one terminal');
    expect(() => appendNativeExternalOfficialReceipt(ledger, {
      pitchOrdinal: 0, receivedAtTick: BEGIN + 5_000, receipt: official,
    })).toThrow('receipt clock');
    expect(() => appendNativeExternalOfficialReceipt(ledger, {
      pitchOrdinal: 0, receivedAtTick: BEGIN + 6_500,
      receipt: { ...official, appliedMatchState: { ...official.appliedMatchState, outs: 2 } },
    })).toThrow('contradicts non-live canonical');
    expect(() => appendNativeExternalOfficialReceipt(ledger, {
      pitchOrdinal: 0, receivedAtTick: BEGIN + 6_500,
      receipt: { ...official, previousPlayId: 99 },
    })).toThrow('identity does not bind');
  });

  it('retains externally supplied contact receipt as opaque evidence, without claiming it proves a catch/out', () => {
    const pa = newSession();
    const physical = contactPitch(BEGIN);
    const issued = nativeIssue(pa, physical);
    const ledger = append(fresh(), issued, physical, 'physical-contact-with-official-followup');
    const receipt: OfficialStateApplicationReceipt = {
      applicationId: 'external-only-application', closureId: 'external-only-closure',
      previousPlayId: 71, durableRevision: 10,
      appliedMatchState: { ...match(), playId: 72, outs: 1 },
    };
    const withReceipt = appendNativeExternalOfficialReceipt(ledger, {
      receipt, pitchOrdinal: 0, receivedAtTick: BEGIN + 6_000,
    });
    expect((withReceipt.entries[1] as { receipt: OfficialStateApplicationReceipt }).receipt).toEqual(receipt);
    expect((withReceipt.entries[0] as NativeReplayPitchEntry).phase).toBe('batted_ball_pending');
    expect((withReceipt.entries[0] as NativeReplayPitchEntry).events.map(e => e.kind)).toEqual(['BatBallContact']);
    expect(verifyNativeImmutableReplayLedger(json(withReceipt))).toEqual(withReceipt);
    expect(() => appendNativeExternalOfficialReceipt(fresh(), {
      receipt, pitchOrdinal: 0, receivedAtTick: BEGIN + 6_000,
    })).toThrow('terminal physical pitch');
  });

  it('rejects canonical payload tampering, physical ball/swing drift, clock drift, event duplication and reordered records', () => {
    const pa = newSession();
    const firstInput = take(BEGIN);
    const first = nativeIssue(pa, firstInput);
    const one = append(fresh(), first, firstInput, 'first');
    const secondInput = take(BEGIN + 10_000, 1);
    const second = nativeIssue(pa, secondInput, 'outside');
    const original = append(one, second, secondInput, 'second');
    const distortions: Array<(value: Record<string, any>) => void> = [
      d => { d.entries[0].events[1].payload.adjudication.kind = 'ball'; },
      d => { d.entries[0].samples[0].world.ball.position.z = 9; },
      d => { d.entries[0].samples[0].batter.handedness = 'R'; },
      d => { d.entries[0].clock.sourceEndTick += 1; },
      d => { d.entries[0].clock.canonicalAfterTick += 10; },
      d => { d.entries[0].events[1].sequence = 99; },
      d => { d.entries[0].events.push(d.entries[0].events[1]); },
      d => { d.entries.reverse(); },
      d => { d.entries[1].sourceId = 'first'; },
      d => { d.entries[1].previousDigest = d.entries[0].previousDigest; },
      d => { d.headDigest = d.entries[0].digest; },
      d => { d.version = 2; },
      d => { d.entries[0].surprise = 'forged'; },
    ];
    for (const distort of distortions) {
      const changed = json(original);
      distort(changed);
      expect(() => verifyNativeImmutableReplayLedger(changed)).toThrow();
    }
  });

  it('rejects physically false samples/events even when an attacker recalculates an unanchored digest', () => {
    const pa = newSession();
    const physical = take(BEGIN);
    const ledger = append(fresh(), nativeIssue(pa, physical), physical, 'truth');
    const changed = json(ledger);
    changed.entries[0].samples[0].world.ball.position.y += 3;
    recomputeFirstEntryDigest(changed);
    expect(() => verifyNativeImmutableReplayLedger(changed)).toThrow('stored canonical ball sample');
    expect(() => verifyNativeImmutableReplayLedger(changed, ledger.headDigest))
      .toThrow('external trusted head');
  });

  it('rejects forged rule counts and injected official outs even after recomputing the digest', () => {
    const pa = newSession();
    const physical = take(BEGIN);
    const ledger = append(fresh(), nativeIssue(pa, physical), physical, 'canonical-only');
    const changed = json(ledger);
    changed.entries[0].events[1].payload.adjudication.kind = 'ball';
    recomputeFirstEntryDigest(changed);
    expect(() => verifyNativeImmutableReplayLedger(changed))
      .toThrow('accepted events, physical contact, count');
    const withFakeOut = json(ledger);
    withFakeOut.entries[0].events[0].kind = 'LiveBallPlayEnded';
    recomputeFirstEntryDigest(withFakeOut);
    expect(() => verifyNativeImmutableReplayLedger(withFakeOut))
      .toThrow('accepted events, physical contact, count');
  });

  it('does not admit duplicate physical sources or mismatched actual pitch data', () => {
    const pa = newSession();
    const physical = take(BEGIN);
    const issued = nativeIssue(pa, physical);
    expect(() => append(fresh(), issued, take(BEGIN, 1), 'wrong-source'))
      .toThrow('accepted events, physical contact');
    const one = append(fresh(), issued, physical, 'same-source');
    const second = nativeIssue(pa, take(BEGIN + 10_000), 'outside');
    expect(() => append(one, second, take(BEGIN + 10_000), 'same-source')).toThrow('already persisted');
    expect(() => append(fresh(), issued, physical, 'bad id ')).toThrow('physical source ID');
    expect(() => append(fresh(), issued, physical, '')).toThrow('physical source ID');
    expect(() => append(one, issued, physical, 'repeat-issued')).toThrow('duplicated or skipped');
  });

  it('rejects non-data imports, getters, prototypes, non-finite numbers, sparse arrays and unsupported versions', () => {
    const ledger = fresh();
    expect(() => fresh({ ...match(), score: { home: -1, away: 0 } }))
      .toThrow('invalid initial Native Match');
    expect(() => verifyNativeImmutableReplayLedger({ ...ledger, entries: () => [] })).toThrow('pure data');
    expect(() => verifyNativeImmutableReplayLedger({ ...ledger, extra: undefined })).toThrow('pure data');
    expect(() => verifyNativeImmutableReplayLedger({ ...ledger, startedAtTick: Infinity })).toThrow('non-finite');
    expect(() => verifyNativeImmutableReplayLedger(new Date() as unknown)).toThrow('plain objects');
    const getter = { ...ledger, get headDigest() { throw new Error('must not execute getter'); } };
    expect(() => verifyNativeImmutableReplayLedger(getter)).toThrow('getters');
    const sparse = { ...ledger, entries: Array(2) };
    expect(() => verifyNativeImmutableReplayLedger(sparse)).toThrow('dense arrays');
    const cycle: Record<string, unknown> = { ...ledger };
    cycle.entries = [cycle];
    expect(() => verifyNativeImmutableReplayLedger(cycle)).toThrow('cycles');
    // JSON.stringify escapes lone surrogates before UTF-8 encoding.
    expect(digestNativeReplayData(String.fromCharCode(0xd800))).toMatch(/^[0-9a-f]{64}$/);
    const bad = json(ledger);
    bad.schema = 'different-version';
    expect(() => verifyNativeImmutableReplayLedger(bad)).toThrow('unsupported');
  });
});
