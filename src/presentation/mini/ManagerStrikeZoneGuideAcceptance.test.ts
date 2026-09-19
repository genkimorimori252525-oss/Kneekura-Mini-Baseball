import { describe, expect, it } from 'vitest';
import {
  asRuleProfileId,
} from '../../core/model/RuleProfileRef';
import {
  resolveRulebookStrikeZoneRegion,
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
  cameraMode: 'BATTER_POV' | 'PITCHER_POV',
): MiniPresentationFrame => ({
  tick: 1_000_000,
  cameraMode,
  sample: {
    world: {
      tick: 1_000_000,
      defenders: [],
      runners: [],
      ball: {
        position: { x: 0, y: 1.1, z: 8 },
        velocity: { x: 0, y: 0, z: -20 },
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

const compactZone = resolveRulebookStrikeZoneRegion({
  plateCenterX: 0,
  landmarks: {
    shoulderTopY: 1.48,
    uniformPantsTopY: 0.94,
    kneecapBottomY: 0.5,
  },
});

const tallZone = resolveRulebookStrikeZoneRegion({
  plateCenterX: 0,
  landmarks: {
    shoulderTopY: 1.82,
    uniformPantsTopY: 1.14,
    kneecapBottomY: 0.52,
  },
});

const guidePixelHeight = (
  guide: {
    upperLeft: { y: number };
    lowerLeft: { y: number };
  },
): number => Math.abs(
  guide.lowerLeft.y - guide.upperLeft.y,
);

const pitchTrajectory = (): PitchTrajectorySegment => ({
  start: {
    tick: 1_000_000,
    position: { x: 0, y: 1.2, z: 10 },
    velocity: { x: 0, y: 0, z: -20 },
    spin: { x: 0, y: 0, z: 0 },
  },
  acceleration: { x: 0, y: 0, z: 0 },
  endTick: 1_600_000,
  ticksPerSecond: 1_000_000,
});

describe('manager strike-zone guide acceptance', () => {
  it('requires a rule-derived guide for manager Batter/Pitcher POV frames', () => {
    for (const cameraMode of [
      'BATTER_POV',
      'PITCHER_POV',
    ] as const) {
      expect(() => buildMiniGameLiveFrame({
        match,
        frame: frame(cameraMode),
        overheadCamera,
      })).toThrow(
        'manager POV frame requires strikeZoneGuide',
      );
    }
  });

  it('projects the same per-batter rulebook zone into Batter POV and Pitcher POV', () => {
    const guide = {
      plateZ: 0,
      region: tallZone,
    } as const;

    const batter = buildMiniGameLiveFrame({
      match,
      frame: frame('BATTER_POV'),
      overheadCamera,
      strikeZoneGuide: guide,
    });
    const pitcher = buildMiniGameLiveFrame({
      match,
      frame: frame('PITCHER_POV'),
      overheadCamera,
      strikeZoneGuide: guide,
    });

    expect(batter.live.cameraMode).toBe('BATTER_POV');
    expect(pitcher.live.cameraMode).toBe('PITCHER_POV');

    if (
      batter.live.cameraMode !== 'BATTER_POV'
      || pitcher.live.cameraMode !== 'PITCHER_POV'
    ) {
      throw new Error('fixtures must remain POV');
    }

    expect(batter.live.render.strikeZoneGuide?.source)
      .toEqual(guide);
    expect(pitcher.live.render.strikeZoneGuide?.source)
      .toEqual(guide);
    expect(
      batter.live.render.strikeZoneGuide,
    ).not.toBeNull();
    expect(
      pitcher.live.render.strikeZoneGuide,
    ).not.toBeNull();
  });

  it('changes displayed zone height when the batter/stance rulebook landmarks change', () => {
    const compact = buildMiniGameLiveFrame({
      match,
      frame: frame('PITCHER_POV'),
      overheadCamera,
      strikeZoneGuide: {
        plateZ: 0,
        region: compactZone,
      },
    });
    const tall = buildMiniGameLiveFrame({
      match,
      frame: frame('PITCHER_POV'),
      overheadCamera,
      strikeZoneGuide: {
        plateZ: 0,
        region: tallZone,
      },
    });

    if (
      compact.live.cameraMode !== 'PITCHER_POV'
      || tall.live.cameraMode !== 'PITCHER_POV'
      || compact.live.render.strikeZoneGuide === null
      || tall.live.render.strikeZoneGuide === null
    ) {
      throw new Error('fixtures must expose guides');
    }

    expect(guidePixelHeight(
      tall.live.render.strikeZoneGuide,
    )).toBeGreaterThan(
      guidePixelHeight(
        compact.live.render.strikeZoneGuide,
      ),
    );
    expect(
      tall.live.render.strikeZoneGuide.source.region.halfWidth,
    ).toBe(
      compact.live.render.strikeZoneGuide.source.region.halfWidth,
    );
  });

  it('keeps pitch adjudication identical before and after manager guide projection', () => {
    const sourceGuide = {
      plateZ: 0,
      region: tallZone,
    } as const;
    const beforeGuide = structuredClone(sourceGuide);

    const before = resolveTakenPitchPhysicalResult({
      trajectory: pitchTrajectory(),
      plateZ: 0,
      strikeZone: tallZone,
      ballRadiusMeters: 0.0366,
    });

    buildMiniGameLiveFrame({
      match,
      frame: frame('BATTER_POV'),
      overheadCamera,
      strikeZoneGuide: sourceGuide,
    });
    buildMiniGameLiveFrame({
      match,
      frame: frame('PITCHER_POV'),
      overheadCamera,
      strikeZoneGuide: sourceGuide,
    });

    const after = resolveTakenPitchPhysicalResult({
      trajectory: pitchTrajectory(),
      plateZ: 0,
      strikeZone: tallZone,
      ballRadiusMeters: 0.0366,
    });

    expect(after).toEqual(before);
    expect(sourceGuide).toEqual(beforeGuide);
  });
});