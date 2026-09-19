import { describe, expect, it } from 'vitest';
import {
  createPlayerPhysicalProfile,
} from '../../core/model/PlayerPhysicalProfile';
import {
  asRuleProfileId,
} from '../../core/model/RuleProfileRef';
import {
  HEIGHT_RATIO_V1_BOTTOM_FRACTION,
  HEIGHT_RATIO_V1_TOP_FRACTION,
} from '../../core/sim/pitching/RulebookStrikeZone';
import {
  resolveTakenPitchPhysicalResult,
} from '../../core/sim/pitching/TakenPitchPhysicalResult';
import type {
  PitchTrajectorySegment,
} from '../../core/sim/pitching/PitchTrajectory';
import {
  buildMiniGameLiveFrame,
} from './MiniGameLiveFrame';
import type {
  MiniPresentationFrame,
} from './model';

const match = {
  ruleProfileId: asRuleProfileId('npb-2026'),
  inning: 1,
  half: 'top' as const,
  outs: 0,
  balls: 0,
  strikes: 0,
  bases: {
    first: null,
    second: null,
    third: null,
  },
  score: {
    away: 0,
    home: 0,
  },
  playId: 1,
};

const frame = (
  cameraMode:
    'BATTER_POV' | 'PITCHER_POV',
): MiniPresentationFrame => ({
  tick: 1_000_000,
  cameraMode,
  sample: {
    world: {
      tick: 1_000_000,
      defenders: [],
      runners: [],
      ball: {
        position: {
          x: 0,
          y: 1.1,
          z: 8,
        },
        velocity: {
          x: 0,
          y: 0,
          z: -20,
        },
        spin: { x: 0, y: 0, z: 0 },
      },
    },
    batter: {
      handedness: 'R',
      action: 'idle',
      bat: null,
    },
    pitcherHandedness: 'R',
  },
  events: [],
});

const overheadCamera = {
  worldOrigin: { x: 0, z: 0 },
  viewportCenter: { x: 75, y: 96 },
  logicalPixelsPerMeter: 2,
} as const;

const batterMeta = {
  batter: {
    playerId: 'batter-1',
  },
} as const;

const guidePixelHeight = (
  guide: {
    upperLeft: { y: number };
    lowerLeft: { y: number };
  },
): number => Math.abs(
  guide.lowerLeft.y - guide.upperLeft.y,
);

const pitchTrajectory = (
  y: number,
): PitchTrajectorySegment => ({
  start: {
    tick: 1_000_000,
    position: { x: 0, y, z: 10 },
    velocity: { x: 0, y: 0, z: -20 },
    spin: { x: 0, y: 0, z: 0 },
  },
  acceleration: { x: 0, y: 0, z: 0 },
  endTick: 1_600_000,
  ticksPerSecond: 1_000_000,
});

describe('manager strike-zone guide acceptance', () => {
  it('derives Height-Ratio V1 automatically for both manager POVs', () => {
    const profile =
      createPlayerPhysicalProfile(1.8);

    for (const cameraMode of [
      'BATTER_POV',
      'PITCHER_POV',
    ] as const) {
      const result =
        buildMiniGameLiveFrame({
          match,
          frame: frame(cameraMode),
          overheadCamera,
          matchupPlayers: batterMeta,
          playerPhysicalProfiles: {
            'batter-1': profile,
          },
        });

      if (
        result.live.cameraMode
          !== cameraMode
        || result.live.cameraMode
          === 'FIELD_OVERHEAD'
        || result.live.render
          .strikeZoneGuide === null
      ) {
        throw new Error(
          'fixture must expose manager POV strike zone',
        );
      }

      expect(
        result.live.render
          .strikeZoneGuide.source.region.lowerY,
      ).toBeCloseTo(
        profile.heightMeters
        * HEIGHT_RATIO_V1_BOTTOM_FRACTION,
        12,
      );
      expect(
        result.live.render
          .strikeZoneGuide.source.region.upperY,
      ).toBeCloseTo(
        profile.heightMeters
        * HEIGHT_RATIO_V1_TOP_FRACTION,
        12,
      );
    }
  });

  it('changes displayed zone size and vertical position with player height', () => {
    const shorter =
      buildMiniGameLiveFrame({
        match,
        frame: frame('PITCHER_POV'),
        overheadCamera,
        matchupPlayers: batterMeta,
        playerPhysicalProfiles: {
          'batter-1':
            createPlayerPhysicalProfile(1.7),
        },
      });
    const taller =
      buildMiniGameLiveFrame({
        match,
        frame: frame('PITCHER_POV'),
        overheadCamera,
        matchupPlayers: batterMeta,
        playerPhysicalProfiles: {
          'batter-1':
            createPlayerPhysicalProfile(1.9),
        },
      });

    if (
      shorter.live.cameraMode
        !== 'PITCHER_POV'
      || taller.live.cameraMode
        !== 'PITCHER_POV'
      || shorter.live.render
        .strikeZoneGuide === null
      || taller.live.render
        .strikeZoneGuide === null
    ) {
      throw new Error(
        'fixtures must expose guides',
      );
    }

    expect(
      taller.live.render
        .strikeZoneGuide.source.region.lowerY,
    ).toBeGreaterThan(
      shorter.live.render
        .strikeZoneGuide.source.region.lowerY,
    );
    expect(
      taller.live.render
        .strikeZoneGuide.source.region.upperY,
    ).toBeGreaterThan(
      shorter.live.render
        .strikeZoneGuide.source.region.upperY,
    );
    expect(
      guidePixelHeight(
        taller.live.render.strikeZoneGuide,
      ),
    ).toBeGreaterThan(
      guidePixelHeight(
        shorter.live.render.strikeZoneGuide,
      ),
    );
  });

  it('requires enough batter metadata to derive the current policy when no explicit guide is supplied', () => {
    expect(() => buildMiniGameLiveFrame({
      match,
      frame: frame('BATTER_POV'),
      overheadCamera,
    })).toThrow(
      'manager POV frame requires batter identity or explicit strikeZoneGuide',
    );

    expect(() => buildMiniGameLiveFrame({
      match,
      frame: frame('BATTER_POV'),
      overheadCamera,
      matchupPlayers: batterMeta,
    })).toThrow(
      'manager POV frame requires batter physical profile or explicit strikeZoneGuide',
    );
  });

  it('keeps physical pitch adjudication unchanged by manager guide projection', () => {
    const profile =
      createPlayerPhysicalProfile(1.9);
    const result =
      buildMiniGameLiveFrame({
        match,
        frame: frame('BATTER_POV'),
        overheadCamera,
        matchupPlayers: batterMeta,
        playerPhysicalProfiles: {
          'batter-1': profile,
        },
      });

    if (
      result.live.cameraMode
        !== 'BATTER_POV'
      || result.live.render
        .strikeZoneGuide === null
    ) {
      throw new Error(
        'fixture must expose batter guide',
      );
    }

    const region =
      result.live.render
        .strikeZoneGuide.source.region;
    const before =
      resolveTakenPitchPhysicalResult({
        trajectory: pitchTrajectory(1.0),
        plateZ: 0,
        strikeZone: region,
        ballRadiusMeters: 0.0366,
      });

    buildMiniGameLiveFrame({
      match,
      frame: frame('PITCHER_POV'),
      overheadCamera,
      matchupPlayers: batterMeta,
      playerPhysicalProfiles: {
        'batter-1': profile,
      },
    });

    const after =
      resolveTakenPitchPhysicalResult({
        trajectory: pitchTrajectory(1.0),
        plateZ: 0,
        strikeZone: region,
        ballRadiusMeters: 0.0366,
      });

    expect(after).toEqual(before);
  });
});