import { describe, expect, it } from 'vitest';
import type {
  MiniPresentationFrame,
} from './model';
import {
  buildMiniLiveRenderState,
} from './MiniLiveRenderState';

const frame = (
  cameraMode:
    | 'BATTER_POV'
    | 'PITCHER_POV'
    | 'FIELD_OVERHEAD',
): MiniPresentationFrame => ({
  tick: 2_000_000,
  cameraMode,
  sample: {
    world: {
      tick: 2_000_000,
      defenders: [{
        playerId: 'cf',
        registeredPosition: 'CF',
        position: { x: -2, z: 23 },
        velocity: { x: 1, z: 0 },
        assignment: {
          kind: 'backup',
          target: { x: 0, z: 40 },
        },
      }],
      runners: [],
      ball: {
        position: { x: 3, y: 1.5, z: 20 },
        velocity: { x: 1, y: 2, z: 8 },
        spin: { x: 0, y: 10, z: 0 },
      },
    },
    batter: {
      handedness: 'R',
      action: 'normal_swing',
      bat: null,
    },
  },
  events: [],
});

describe('MiniLiveRenderState', () => {
  it('uses batter POV before the canonical camera cut', () => {
    const result = buildMiniLiveRenderState({
      frame: frame('BATTER_POV'),
      overheadCamera: {
        worldOrigin: { x: 0, z: 0 },
        viewportCenter: { x: 75, y: 96 },
        logicalPixelsPerMeter: 2,
      },
    });

    expect(result.cameraMode).toBe('BATTER_POV');
    if (result.cameraMode !== 'BATTER_POV') {
      throw new Error('fixture must use batter POV');
    }
    expect(result.render.tick).toBe(2_000_000);
    expect(result.render.defenders[0].playerId)
      .toBe('cf');
  });

  it('uses catcher-eye pitcher POV when the canonical pre-contact camera mode requests it', () => {
    const source = frame('PITCHER_POV');
    const baseline = structuredClone(source);

    const result = buildMiniLiveRenderState({
      frame: source,
      overheadCamera: {
        worldOrigin: { x: 0, z: 0 },
        viewportCenter: { x: 75, y: 96 },
        logicalPixelsPerMeter: 2,
      },
    });

    expect(result.cameraMode).toBe('PITCHER_POV');
    if (result.cameraMode !== 'PITCHER_POV') {
      throw new Error('fixture must use pitcher POV');
    }

    expect(result.render.tick).toBe(2_000_000);
    expect(result.render.ball).not.toBeNull();
    expect(result.render.defenders[0].playerId)
      .toBe('cf');
    expect(source).toEqual(baseline);
  });

  it('uses canonical field-overhead projection after the cut', () => {
    const source = frame('FIELD_OVERHEAD');
    const baseline = structuredClone(source);

    const result = buildMiniLiveRenderState({
      frame: source,
      overheadCamera: {
        worldOrigin: { x: 0, z: 0 },
        viewportCenter: { x: 75, y: 96 },
        logicalPixelsPerMeter: 2,
      },
    });

    expect(result.cameraMode).toBe('FIELD_OVERHEAD');
    if (result.cameraMode !== 'FIELD_OVERHEAD') {
      throw new Error('fixture must use overhead');
    }

    expect(result.render.defenders[0]).toMatchObject({
      playerId: 'cf',
      registeredPosition: 'CF',
      worldPosition: { x: -2, z: 23 },
      screenPosition: { x: 71, y: 50 },
      assignment: {
        kind: 'backup',
        target: { x: 0, z: 40 },
      },
    });

    expect(source).toEqual(baseline);
  });
});
