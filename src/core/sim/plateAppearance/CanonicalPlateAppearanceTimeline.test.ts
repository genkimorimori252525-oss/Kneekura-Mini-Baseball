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
  recordBattedBallFirstGroundContact,
  recordBattedBallBaseGatePassage,
  recordBattedBallSettlingEvidence,
  recordBattedBallFirstFielderTouch,
  recordCountedPitch,
  recordFairBattedBall,
  recordFoulBattedBall,
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

const physicalContact = (
  tick: number,
) => {
  const pitch: PitchWorldState = {
    tick,
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
    throw new Error('fixture must produce physical bat-ball contact');
  }
  return contact;
};

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
    timeline = recordCountedPitch(
      timeline,
      1_200_000,
      { kind: 'called_strike' },
    );
    timeline = recordCountedPitch(
      timeline,
      1_300_000,
      { kind: 'swinging_strike' },
    );
    expect(timeline.status).toEqual({
      kind: 'active',
      count: { balls: 1, strikes: 2 },
    });

    timeline = recordCountedPitch(
      timeline,
      1_400_000,
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
    ]);

    expect(() => recordCountedPitch(
      timeline,
      1_500_000,
      { kind: 'ball' },
    )).toThrow(
      'plate appearance timeline is terminal and cannot accept another pitch',
    );
  });

  it('returns a physical uncaught foul to the count and keeps two strikes capped', () => {
    let timeline = createCanonicalPlateAppearanceTimeline(
      match(0, 2),
      1_600_000,
    );
    const contact = physicalContact(1_700_000);
    timeline = recordBatBallContact(timeline, contact);
    expect(timeline.status).toEqual({
      kind: 'batted_ball_pending',
      count: { balls: 0, strikes: 2 },
      contactTick: 1_700_000,
    });

    timeline = recordFoulBattedBall(
      timeline,
      1_710_000,
      false,
      {
        kind: 'not_caught',
        batterRunnerId: 'batter',
        firstFielderTouchTick: 1_705_000,
        firstGroundContactTick: 1_710_000,
        secureCatchTick: 1_720_000,
      },
    );

    expect(timeline.status).toEqual({
      kind: 'active',
      count: { balls: 0, strikes: 2 },
    });
  });

  it('turns a physical two-strike foul bunt into strike three', () => {
    let timeline = createCanonicalPlateAppearanceTimeline(
      match(0, 2),
      1_800_000,
    );
    timeline = recordBatBallContact(
      timeline,
      physicalContact(1_900_000),
    );
    timeline = recordFoulBattedBall(
      timeline,
      1_910_000,
      true,
      {
        kind: 'not_caught',
        batterRunnerId: 'batter',
        firstFielderTouchTick: 1_905_000,
        firstGroundContactTick: 1_910_000,
        secureCatchTick: 1_920_000,
      },
    );

    expect(timeline.status).toEqual({
      kind: 'strikeout',
      terminalCount: { balls: 0, strikes: 3 },
    });
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

  it('records settled-ball evidence without adjudicating by itself', () => {
    const contact = physicalContact(3_000_000);
    let timeline = recordBatBallContact(
      createCanonicalPlateAppearanceTimeline(
        match(0, 1),
        2_900_000,
      ),
      contact,
    );

    timeline = recordBattedBallSettlingEvidence(
      timeline,
      {
        tick: 3_500_000,
        state: {
          tick: 3_500_000,
          position: { x: 0, y: 0.0366, z: 8 },
          velocity: { x: 0, y: 0, z: 0 },
          spin: { x: 0, y: 0, z: 0 },
        },
        territory: {
          kind: 'inside_fair_wedge',
          firstBaseLineSignedSide: 1,
          thirdBaseLineSignedSide: 1,
        },
      },
    );

    expect(timeline.status.kind).toBe('batted_ball_pending');
    expect(timeline.events.at(-1)).toMatchObject({
      tick: 3_500_000,
      kind: 'BattedBallSettled',
    });
  });

  it('records post-bounce base-gate passage evidence without adjudicating by itself', () => {
    const contact = physicalContact(3_200_000);
    let timeline = recordBatBallContact(
      createCanonicalPlateAppearanceTimeline(
        match(1, 1),
        3_100_000,
      ),
      contact,
    );
    timeline = recordBattedBallFirstGroundContact(
      timeline,
      {
        tick: 3_250_000,
        position: { x: 0.2, z: 3 },
        classification: {
          kind: 'inside_fair_wedge',
          firstBaseLineSignedSide: 1,
          thirdBaseLineSignedSide: 1,
        },
      },
    );
    timeline = recordBattedBallBaseGatePassage(
      timeline,
      {
        tick: 3_400_000,
        state: {
          tick: 3_400_000,
          position: { x: 20, y: 0.0366, z: 40 },
          velocity: { x: 10, y: 0, z: 10 },
          spin: { x: 0, y: 0, z: 0 },
        },
        beyond: {
          firstBase: true,
          thirdBase: false,
        },
        territory: {
          kind: 'inside_fair_wedge',
          firstBaseLineSignedSide: 1,
          thirdBaseLineSignedSide: 1,
        },
      },
    );

    expect(timeline.status.kind).toBe('batted_ball_pending');
    expect(timeline.events.at(-1)).toMatchObject({
      tick: 3_400_000,
      kind: 'BattedBallBaseGatePassed',
    });
  });

  it('records first-ground territory evidence without prematurely deciding fair or foul', () => {
    const contact = physicalContact(3_500_000);
    const contacted = recordBatBallContact(
      createCanonicalPlateAppearanceTimeline(
        match(1, 1),
        3_400_000,
      ),
      contact,
    );

    const withGround = recordBattedBallFirstGroundContact(
      contacted,
      {
        tick: 3_550_000,
        position: { x: 0.2, z: 3 },
        classification: {
          kind: 'inside_fair_wedge',
          firstBaseLineSignedSide: 1,
          thirdBaseLineSignedSide: 1,
        },
      },
    );

    expect(withGround.status).toEqual({
      kind: 'batted_ball_pending',
      count: { balls: 1, strikes: 1 },
      contactTick: 3_500_000,
    });
    expect(withGround.events.at(-1)).toEqual({
      tick: 3_550_000,
      sequence: 1,
      kind: 'BattedBallFirstGroundContact',
      payload: {
        evidence: {
          tick: 3_550_000,
          position: { x: 0.2, z: 3 },
          classification: {
            kind: 'inside_fair_wedge',
            firstBaseLineSignedSide: 1,
            thirdBaseLineSignedSide: 1,
          },
        },
      },
    });
  });

  it('records first-fielder-touch territory evidence without collapsing catch/drop semantics', () => {
    const contact = physicalContact(3_700_000);
    const contacted = recordBatBallContact(
      createCanonicalPlateAppearanceTimeline(
        match(1, 1),
        3_600_000,
      ),
      contact,
    );

    const withTouch = recordBattedBallFirstFielderTouch(
      contacted,
      {
        fielderId: 'right-fielder',
        tick: 3_750_000,
        ballCenter: { x: 0, y: 1.2, z: 40 },
        ballRadiusMeters: 0.0366,
        classification: {
          kind: 'inside_fair_wedge',
          firstBaseLineSignedSide: 10,
          thirdBaseLineSignedSide: 10,
        },
      },
    );

    expect(withTouch.status).toEqual({
      kind: 'batted_ball_pending',
      count: { balls: 1, strikes: 1 },
      contactTick: 3_700_000,
    });
    expect(withTouch.events.at(-1)).toEqual({
      tick: 3_750_000,
      sequence: 1,
      kind: 'BattedBallFirstFielderTouch',
      payload: {
        evidence: {
          fielderId: 'right-fielder',
          tick: 3_750_000,
          ballCenter: { x: 0, y: 1.2, z: 40 },
          ballRadiusMeters: 0.0366,
          classification: {
            kind: 'inside_fair_wedge',
            firstBaseLineSignedSide: 10,
            thirdBaseLineSignedSide: 10,
          },
        },
      },
    });
  });

  it('keeps physical contact pending until a fair-ball disposition makes it live', () => {
    const contact = physicalContact(4_000_000);
    const contacted = recordBatBallContact(
      createCanonicalPlateAppearanceTimeline(
        match(2, 1),
        3_900_000,
      ),
      contact,
    );

    expect(contacted.status).toEqual({
      kind: 'batted_ball_pending',
      count: { balls: 2, strikes: 1 },
      contactTick: 4_000_000,
    });

    const timeline = recordFairBattedBall(
      contacted,
      4_010_000,
    );
    expect(timeline.status).toEqual({
      kind: 'live_ball',
      count: { balls: 2, strikes: 1 },
      contactTick: 4_000_000,
      fairDeterminationTick: 4_010_000,
    });
    expect(timeline.events[0]).toMatchObject({
      tick: 4_000_000,
      sequence: 0,
      kind: 'BatBallContact',
      payload: {
        countBefore: { balls: 2, strikes: 1 },
        contact,
      },
    });
    expect(timeline.events[1]).toEqual({
      tick: 4_010_000,
      sequence: 1,
      kind: 'BattedBallDeclaredFair',
      payload: {
        contactTick: 4_000_000,
      },
    });
  });

  it('records authoritative play end after physical contact and closes the live-ball timeline', () => {
    const contact = physicalContact(4_500_000);
    const contacted = recordBatBallContact(
      createCanonicalPlateAppearanceTimeline(
        match(),
        4_400_000,
      ),
      contact,
    );
    const live = recordFairBattedBall(
      contacted,
      4_500_000,
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
      disposition: {
        kind: 'fair',
        fairDeterminationTick: 4_500_000,
      },
    });
    expect(complete.events[2]).toEqual({
      tick: 5_000_000,
      sequence: 2,
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

  it('keeps a caught foul fly live for runner action until play end', () => {
    let timeline = createCanonicalPlateAppearanceTimeline(
      match(0, 1),
      4_600_000,
    );
    timeline = recordBatBallContact(
      timeline,
      physicalContact(4_700_000),
    );
    timeline = recordFoulBattedBall(
      timeline,
      4_750_000,
      false,
      {
        kind: 'caught',
        batterRunnerId: 'batter',
        firstFielderTouchTick: 4_720_000,
        outTick: 4_750_000,
        secureCatchTick: 4_750_000,
      },
    );

    expect(timeline.status).toEqual({
      kind: 'caught_foul_live',
      count: { balls: 0, strikes: 1 },
      contactTick: 4_700_000,
      outTick: 4_750_000,
    });

    const playEnd = createPlayEndFact(
      4_900_000,
      'live_action_complete',
    );
    const complete = recordLiveBallPlayEnd(
      timeline,
      playEnd,
    );
    expect(complete.status).toEqual({
      kind: 'live_ball_complete',
      count: { balls: 0, strikes: 1 },
      contactTick: 4_700_000,
      playEndTick: 4_900_000,
      disposition: {
        kind: 'caught_foul',
        outTick: 4_750_000,
      },
    });
  });

  it('rejects a play end before the latest live-ball disposition event', () => {
    const contact = physicalContact(4_500_000);
    const live = recordFairBattedBall(
      recordBatBallContact(
        createCanonicalPlateAppearanceTimeline(
          match(),
          4_400_000,
        ),
        contact,
      ),
      4_510_000,
    );

    expect(() => recordLiveBallPlayEnd(
      live,
      createPlayEndFact(
        4_505_000,
        'live_action_complete',
      ),
    )).toThrow(
      'plate appearance event tick must not precede the previous event',
    );
  });

  it('does not permit ball_in_play to bypass the physical contact boundary', () => {
    const timeline = createCanonicalPlateAppearanceTimeline(
      match(),
      5_000_000,
    );

    for (const kind of ['ball_in_play', 'foul', 'foul_bunt'] as const) {
      expect(() => recordCountedPitch(
        timeline,
        5_100_000,
        { kind } as unknown as CountedPitchAdjudication,
      )).toThrow(
        'counted pitch adjudication must be a non-contact pitch result',
      );
    }
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
