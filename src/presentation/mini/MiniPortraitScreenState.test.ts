import { describe, expect, it } from 'vitest';
import type {
  MiniGameLiveFrame,
} from './MiniGameLiveFrame';
import {
  buildMiniPortraitScreenState,
} from './MiniPortraitScreenState';

const liveFrame = {
  tick: 2_000_000,
  hud: {
    inning: 5,
    half: 'top',
    offense: 'away',
    defense: 'home',
    count: {
      balls: 2,
      strikes: 1,
      outs: 1,
    },
    bases: {
      first: {
        occupied: true,
        runnerId: 'r1',
      },
      second: {
        occupied: false,
        runnerId: null,
      },
      third: {
        occupied: false,
        runnerId: null,
      },
    },
    score: {
      away: 2,
      home: 3,
    },
    playId: 40,
    lineScore: null,
  },
  matchup: {
    batter: {
      role: 'batter',
      handedness: 'R',
      label: '右打',
      accent: 'red',
    },
    pitcher: null,
  },
  commandBand: null,
  playerCards: {
    batter: null,
    pitcher: null,
  },
  live: {
    cameraMode: 'FIELD_OVERHEAD',
    render: {
      tick: 2_000_000,
      defenders: [],
      runners: [],
      ball: null,
      ballTrail: [],
    },
  },
} as const satisfies MiniGameLiveFrame;

describe('MiniPortraitScreenState', () => {
  it('orders the major mini regions vertically without changing their data', () => {
    const result = buildMiniPortraitScreenState(
      liveFrame,
    );

    expect(result.orientation).toBe('portrait');
    expect(result.regions.map(
      (region) => region.kind,
    )).toEqual([
      'scoreboard',
      'situation',
      'player_cards',
      'live_view',
      'command_band',
    ]);

    expect(
      result.regions.find(
        (region) => region.kind === 'live_view',
      )?.payload,
    ).toBe(liveFrame.live);
  });

  it('keeps hidden/empty optional regions explicit instead of inventing UI data', () => {
    const result = buildMiniPortraitScreenState(
      liveFrame,
    );

    const command = result.regions.find(
      (region) => region.kind === 'command_band',
    );
    expect(command?.visible).toBe(false);

    const cards = result.regions.find(
      (region) => region.kind === 'player_cards',
    );
    expect(cards?.visible).toBe(false);
  });

  it('preserves the source live frame exactly', () => {
    const before = structuredClone(liveFrame);

    buildMiniPortraitScreenState(liveFrame);

    expect(liveFrame).toEqual(before);
  });
});
