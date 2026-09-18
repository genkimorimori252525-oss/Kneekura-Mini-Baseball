import { describe, expect, it } from 'vitest';
import type {
  CanonicalPresentationSample,
} from './model';
import {
  projectWorldToPitcherPov,
} from './PitcherPovCamera';
import {
  buildPitcherPovRenderState,
} from './PitcherPovRenderState';

const sample = (): CanonicalPresentationSample => ({
  world: {
    tick: 2_000_000,
    defenders: [
      {
        playerId: 'p',
        registeredPosition: 'P',
        position: { x: 0, z: 18 },
        velocity: { x: 0, z: 0 },
        assignment: { kind: 'hold' },
      },
      {
        playerId: 'cf',
        registeredPosition: 'CF',
        position: { x: -2, z: 55 },
        velocity: { x: 0, z: 0 },
        assignment: { kind: 'hold' },
      },
    ],
    runners: [{
      playerId: 'r1',
      position: { x: 18, z: 18 },
      velocity: { x: 0, z: 0 },
    }],
    ball: {
      position: { x: 0.1, y: 1.2, z: 8 },
      velocity: { x: 0, y: -1, z: -30 },
      spin: { x: 0, y: 10, z: 0 },
    },
  },
  batter: {
    handedness: 'R',
    action: 'normal_swing',
    bat: {
      grip: { x: -0.5, y: 1, z: 0.2 },
      tip: { x: 0.4, y: 1, z: 0.4 },
    },
  },
  pitcherHandedness: 'L',
});

describe('PitcherPovRenderState', () => {
  it('projects the canonical pitch and field from the catcher-eye pitcher view', () => {
    const source = sample();
    const result = buildPitcherPovRenderState(
      source,
    );

    expect(result.tick).toBe(2_000_000);
    expect(result.pitcherHandedness).toBe('L');
    expect(result.batterHandedness).toBe('R');
    expect(result.ball).toEqual(
      projectWorldToPitcherPov(
        source.world.ball!.position,
      ),
    );
    expect(result.defenders[0].worldPosition)
      .toBe(source.world.defenders[0].position);
    expect(result.defenders[0].projected).toEqual(
      projectWorldToPitcherPov({
        x: 0,
        y: 0,
        z: 18,
      }),
    );
  });

  it('projects the existing canonical bat without adding a batter body model', () => {
    const result = buildPitcherPovRenderState(
      sample(),
    );

    expect(result.batAction).toBe('normal_swing');
    expect(result.bat?.grip).not.toBeNull();
    expect(result.bat?.tip).not.toBeNull();
  });

  it('preserves the source sample exactly', () => {
    const source = sample();
    const before = structuredClone(source);

    buildPitcherPovRenderState(source);

    expect(source).toEqual(before);
  });
});
