import { describe, expect, it } from 'vitest';
import {
  asRuleProfileId,
} from '../model/RuleProfileRef';
import type {
  CanonicalMatchState,
} from '../model/CanonicalMatchState';
import type {
  CanonicalWorldSnapshot,
} from '../model/CanonicalWorldSnapshot';
import type {
  TimedMatchEvent,
} from '../model/TimedMatchEvent';
import {
  createNaturalReadOnlySnapshot,
} from './NaturalReadOnlySnapshot';
import {
  createCanonicalEvidenceFingerprint,
} from './CanonicalEvidenceFingerprint';

const match: CanonicalMatchState = {
  ruleProfileId: asRuleProfileId('npb-2026'),
  inning: 5,
  half: 'bottom',
  outs: 1,
  balls: 2,
  strikes: 1,
  bases: {
    first: 'r1',
    second: null,
    third: 'r3',
  },
  score: {
    away: 2,
    home: 3,
  },
  playId: 44,
};

const world: CanonicalWorldSnapshot = {
  tick: 4_000_000,
  defenders: [
    {
      playerId: 'p',
      registeredPosition: 'P',
      position: { x: 0, z: 18 },
      velocity: { x: 0, z: 0 },
      assignment: { kind: 'hold' },
    },
    {
      playerId: 'c',
      registeredPosition: 'C',
      position: { x: 0, z: -2 },
      velocity: { x: 0, z: 0 },
      assignment: { kind: 'hold' },
    },
    {
      playerId: '1b',
      registeredPosition: '1B',
      position: { x: 22, z: 20 },
      velocity: { x: 0, z: 0 },
      assignment: { kind: 'ball_handler' },
    },
    {
      playerId: '2b',
      registeredPosition: '2B',
      position: { x: 8, z: 24 },
      velocity: { x: 0, z: 0 },
      assignment: { kind: 'base_cover', base: 2 },
    },
    {
      playerId: '3b',
      registeredPosition: '3B',
      position: { x: -20, z: 20 },
      velocity: { x: 0, z: 0 },
      assignment: { kind: 'base_cover', base: 3 },
    },
    {
      playerId: 'ss',
      registeredPosition: 'SS',
      position: { x: -8, z: 24 },
      velocity: { x: 0, z: 0 },
      assignment: {
        kind: 'relay',
        target: { x: 10, z: 30 },
      },
    },
    {
      playerId: 'lf',
      registeredPosition: 'LF',
      position: { x: -30, z: 55 },
      velocity: { x: 0, z: 0 },
      assignment: {
        kind: 'deep_coverage',
        target: { x: -28, z: 60 },
      },
    },
    {
      playerId: 'cf',
      registeredPosition: 'CF',
      position: { x: -2, z: 23 },
      velocity: { x: 1, z: -0.2 },
      assignment: {
        kind: 'backup',
        target: { x: 0, z: 40 },
      },
    },
    {
      playerId: 'rf',
      registeredPosition: 'RF',
      position: { x: 30, z: 55 },
      velocity: { x: 0, z: 0 },
      assignment: { kind: 'hold' },
    },
  ],
  runners: [
    {
      playerId: 'r1',
      position: { x: 12, z: 12 },
      velocity: { x: 3, z: 3 },
    },
    {
      playerId: 'r3',
      position: { x: 2, z: 25 },
      velocity: { x: 0, z: 1 },
    },
  ],
  ball: {
    position: { x: 18, y: 2.5, z: 24 },
    velocity: { x: -4, y: 1, z: 6 },
    spin: { x: 0, y: 20, z: 0 },
  },
};

const events: readonly TimedMatchEvent[] = [{
  tick: 3_900_000,
  sequence: 0,
  kind: 'FixtureEvent',
  payload: {
    source: 'canonical',
  },
}];

describe('NaturalReadOnlySnapshot', () => {
  it('copies and freezes canonical match/world/event evidence for Natural rendering', () => {
    const sourceFingerprint =
      createCanonicalEvidenceFingerprint({
        match,
        world,
        events,
      });

    const snapshot = createNaturalReadOnlySnapshot({
      match,
      world,
      events,
      publicMetadata: {
        homeName: 'Home',
        awayName: 'Away',
      },
    });

    expect(snapshot.match).toEqual(match);
    expect(snapshot.world).toEqual(world);
    expect(snapshot.events).toEqual(events);
    expect(snapshot.sourceFingerprint)
      .toBe(sourceFingerprint);

    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.match)).toBe(true);
    expect(Object.isFrozen(snapshot.world)).toBe(true);
    expect(Object.isFrozen(snapshot.world.defenders)).toBe(true);
    expect(Object.isFrozen(snapshot.world.defenders[0].position))
      .toBe(true);
    expect(Object.isFrozen(snapshot.events)).toBe(true);
  });

  it('does not alias source canonical objects', () => {
    const snapshot = createNaturalReadOnlySnapshot({
      match,
      world,
      events,
    });

    expect(snapshot.match).not.toBe(match);
    expect(snapshot.world).not.toBe(world);
    expect(snapshot.events).not.toBe(events);
    expect(snapshot.world.defenders)
      .not.toBe(world.defenders);
  });

  it('rejects non-canonical public metadata rather than leaking renderer objects into the contract', () => {
    expect(() => createNaturalReadOnlySnapshot({
      match,
      world,
      events,
      publicMetadata: {
        invalid: Number.POSITIVE_INFINITY,
      },
    })).toThrow(
      'canonical evidence numbers must be finite',
    );
  });

  it('keeps the source fingerprint unchanged after Natural snapshot creation', () => {
    const before = createCanonicalEvidenceFingerprint({
      match,
      world,
      events,
    });

    createNaturalReadOnlySnapshot({
      match,
      world,
      events,
      publicMetadata: {
        playerCardMode: 'compact',
      },
    });

    const after = createCanonicalEvidenceFingerprint({
      match,
      world,
      events,
    });

    expect(after).toBe(before);
  });
});
