import { describe, expect, it } from 'vitest';
import type { CanonicalMatchState } from '../../model/CanonicalMatchState';
import { asRuleProfileId } from '../../model/RuleProfileRef';
import { createPlayEndFact } from '../../rules/PhysicalRuleFacts';
import {
  resolveBatBallContact,
  type BatterSwingState,
  type PitchWorldState,
} from '../contact/BatBallContact';
import {
  createCanonicalPlateAppearanceTimeline,
  recordBatBallContact,
  recordCountedPitch,
  recordLiveBallPlayEnd,
  type CountedPitchAdjudication,
} from './CanonicalPlateAppearanceTimeline';

const match = (
  balls = 0,
  strikes = 0,
): CanonicalMatchState => ({
  ruleProfileId: asRuleProfileId('npb-2026'),
  inning: 1,
  half: 'top',
  outs: 0,
  balls,
  strikes,
  bases: {
    first: null,
    second: null,
    third: null,
  },
  score: {
    away: 0,
    home: 0,
  },
  playId: 7,
});

describe('CanonicalPlateAppearanceTimeline', () => {
  it('records one deterministic count chronology through a strikeout', () => {
    let timeline = createCanonicalPlateAppearanceTimeline(
      match(),
      1_000_000,
    );

    timeline = recordCountedPitch(
      timeline,
      1_100_000,
      { kind: 'ball' },
    );
    expect(timeline.status).toEqual({
      kind: 'active',
      count: { balls: 1, strikes: 0 },
    });

    timeline = recordCountedPitch(
      timeline,
      1_200_000,
      { kind: 'foul' },
    );
    timeline = recordCountedPitch(
      timeline,
      1_300_000,
      { kind: 'foul' },
    );
    timeline = recordCountedPitch(
      timeline,
      1_400_000,
      { kind: 'foul' },
    );
    expect(timeline.status).toEqual({
      kind: 'active',
      count: { balls: 1, strikes: 2 },
    });

    timeline = recordCountedPitch(
      timeline,
      1_500_000,
      { kind: 'swinging_strike' },
    );

    expect(timeline.status).toEqual({
      kind: 'strikeout',
      terminalCount: { balls: 1, strikes: 3 },
    });
    expect(timeline.events.map((event) => ({
      tick: event.tick,
      sequence: event.sequence,
      kind: event.kind,
    }))).toEqual([
      { tick: 1_100_000, sequence: 0, kind: 'PitchAdjudicated' },
      { tick: 1_200_000, sequence: 1, kind: 'PitchAdjudicated' },
      { tick: 1_300_000, sequence: 2, kind: 'PitchAdjudicated' },
      { tick: 1_400_000, sequence: 3, kind: 'PitchAdjudicated' },
      { tick: 1_500_000, sequence: 4, kind: 'PitchAdjudicated' },
    ]);

    expect(() => recordCountedPitch(
      timeline,
      1_600_000,
      { kind: 'ball' },
    )).toThrow(
      'plate appearance timeline is terminal and cannot accept another pitch',
    );
  });

  it('records a walk as a terminal plate-appearance count result', () => {
    let timeline = createCanonicalPlateAppearanceTimeline(
      match(3, 1),
      2_000_000,
    );
    timeline = recordCountedPitch(
      timeline,
      2_100_000,
      { kind: 'ball' },
    );

    expect(timeline.status).toEqual({
      kind: 'walk',
      terminalCount: { balls: 4, strikes: 1 },
    });
  });

  it('requires monotonic authoritative pitch ticks', () => {
    let timeline = createCanonicalPlateAppearanceTimeline(
      match(),
      3_000_000,
    );
    timeline = recordCountedPitch(
      timeline,
      3_100_000,
      { kind: 'ball' },
    );

    expect(() => recordCountedPitch(
      timeline,
      3_099_999,
      { kind: 'called_strike' },
    )).toThrow(
      'plate appearance event tick must not precede the previous event',
    );
  });

  it('enters live-ball state only from an actual BatBallContactResult', () => {
    const pitch: PitchWorldState = {
      tick: 4_000_000,
      position: { x: 0, y: 1, z: 0.06 },
      velocity: { x: 0, y: -1.5, z: -35 },
      spin: { x: 0, y: 0, z: 0 },
    };
    const swing: BatterSwingState = {
      pose: {
        grip: { x: -0.42, y: 1, z: 0 },
        tip: { x: 0.42, y: 1, z: 0 },
      },
      linearVelocity: { x: 0, y: 0, z: 22 },
      angularVelocity: { x: 0, y: 0, z: 0 },
    };
    const contact = resolveBatBallContact(pitch, swing);
    expect(contact).not.toBeNull();
    if (contact === null) {
      throw new Error('fixture must produce physical bat-ball contact');
    }

    const timeline = recordBatBallContact(
      createCanonicalPlateAppearanceTimeline(
        match(2, 1),
        3_900_000,
      ),
      contact,
    );

    expect(timeline.status).toEqual({
      kind: 'live_ball',
      count: { balls: 2, strikes: 1 },
      contactTick: 4_000_000,
    });
    expect(timeline.events).toHaveLength(1);
    expect(timeline.events[0]).toMatchObject({
      tick: 4_000_000,
      sequence: 0,
      kind: 'BatBallContact',
      payload: {
        countBefore: { balls: 2, strikes: 1 },
        contact,
      },
    });
  });

  it('records authoritative play end after physical contact and closes the live-ball timeline', () => {
    const pitch: PitchWorldState = {
      tick: 4_500_000,
      position: { x: 0, y: 1, z: 0.06 },
      velocity: { x: 0, y: -1.5, z: -35 },
      spin: { x: 0, y: 0, z: 0 },
    };
    const swing: BatterSwingState = {
      pose: {
        grip: { x: -0.42, y: 1, z: 0 },
        tip: { x: 0.42, y: 1, z: 0 },
      },
      linearVelocity: { x: 0, y: 0, z: 22 },
      angularVelocity: { x: 0, y: 0, z: 0 },
    };
    const contact = resolveBatBallContact(pitch, swing);
    if (contact === null) {
      throw new Error('fixture must produce physical contact');
    }

    const live = recordBatBallContact(
      createCanonicalPlateAppearanceTimeline(
        match(),
        4_400_000,
      ),
      contact,
    );
    const playEnd = createPlayEndFact(
      5_000_000,
      'live_action_complete',
    );
    const complete = recordLiveBallPlayEnd(
      live,
      playEnd,
    );

    expect(complete.status).toEqual({
      kind: 'live_ball_complete',
      count: { balls: 0, strikes: 0 },
      contactTick: 4_500_000,
      playEndTick: 5_000_000,
    });
    expect(complete.events[1]).toEqual({
      tick: 5_000_000,
      sequence: 1,
      kind: 'LiveBallPlayEnded',
      payload: { playEnd },
    });
    expect(() => recordLiveBallPlayEnd(
      complete,
      playEnd,
    )).toThrow(
      'live-ball play end requires an active live-ball timeline',
    );
  });

  it('rejects a play end before physical contact', () => {
    const pitch: PitchWorldState = {
      tick: 4_500_000,
      position: { x: 0, y: 1, z: 0.06 },
      velocity: { x: 0, y: -1.5, z: -35 },
      spin: { x: 0, y: 0, z: 0 },
    };
    const swing: BatterSwingState = {
      pose: {
        grip: { x: -0.42, y: 1, z: 0 },
        tip: { x: 0.42, y: 1, z: 0 },
      },
      linearVelocity: { x: 0, y: 0, z: 22 },
      angularVelocity: { x: 0, y: 0, z: 0 },
    };
    const contact = resolveBatBallContact(pitch, swing);
    if (contact === null) {
      throw new Error('fixture must produce physical contact');
    }
    const live = recordBatBallContact(
      createCanonicalPlateAppearanceTimeline(
        match(),
        4_400_000,
      ),
      contact,
    );

    expect(() => recordLiveBallPlayEnd(
      live,
      createPlayEndFact(
        4_499_999,
        'live_action_complete',
      ),
    )).toThrow(
      'live-ball play end must not precede bat-ball contact',
    );
  });

  it('does not permit ball_in_play to bypass the physical contact boundary', () => {
    const timeline = createCanonicalPlateAppearanceTimeline(
      match(),
      5_000_000,
    );

    expect(() => recordCountedPitch(
      timeline,
      5_100_000,
      { kind: 'ball_in_play' } as unknown as CountedPitchAdjudication,
    )).toThrow(
      'counted pitch adjudication must not be ball_in_play',
    );
  });

  it('is deterministic for identical authoritative inputs', () => {
    const run = () => {
      let timeline = createCanonicalPlateAppearanceTimeline(
        match(),
        6_000_000,
      );
      timeline = recordCountedPitch(
        timeline,
        6_100_000,
        { kind: 'called_strike' },
      );
      timeline = recordCountedPitch(
        timeline,
        6_200_000,
        { kind: 'ball' },
      );
      return timeline;
    };

    expect(run()).toEqual(run());
  });
});
