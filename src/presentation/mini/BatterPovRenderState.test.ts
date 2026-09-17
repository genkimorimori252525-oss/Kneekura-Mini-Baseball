import { describe, expect, it } from 'vitest';
import { projectWorldToBatterPov } from './BatterPovCamera';
import { buildBatterPovRenderState } from './BatterPovRenderState';
import type { CanonicalPresentationSample } from './model';

function sample(): CanonicalPresentationSample {
  return {
    world: {
      tick: 2_000_000,
      defenders: [
        {
          playerId: 'ss',
          registeredPosition: 'SS',
          position: { x: 8.75, z: 21.5 },
          velocity: { x: 0, z: 0 },
          assignment: { kind: 'hold' },
        },
        {
          playerId: 'cf',
          registeredPosition: 'CF',
          position: { x: -2.25, z: 57 },
          velocity: { x: 0, z: 0 },
          assignment: { kind: 'hold' },
        },
      ],
      runners: [
        {
          playerId: 'r1',
          position: { x: 19.4, z: 19.4 },
          velocity: { x: 0, z: 0 },
        },
      ],
      ball: {
        position: { x: 0.12, y: 1.1, z: 2.2 },
        velocity: { x: 0, y: -1, z: -30 },
        spin: { x: 0, y: 0, z: 0 },
      },
    },
    batter: {
      handedness: 'L',
      action: 'bunt_hold',
      bat: {
        grip: { x: -0.45, y: 1.0, z: 0.0 },
        tip: { x: 0.5, y: 1.05, z: 0.2 },
      },
    },
  };
}

describe('buildBatterPovRenderState', () => {
  it('projects canonical defenders without replacing their positions', () => {
    const source = sample();
    const render = buildBatterPovRenderState(source);

    expect(render.defenders).toHaveLength(2);
    expect(render.defenders[0].worldPosition).toBe(source.world.defenders[0].position);
    expect(render.defenders[0].projected).toEqual(
      projectWorldToBatterPov({ x: 8.75, y: 0, z: 21.5 }, 'L'),
    );
    expect(render.defenders[1].dotSize).toBeLessThan(render.defenders[0].dotSize);
  });

  it('projects the actual canonical ball and the same bat renderer accepts a bunt pose', () => {
    const source = sample();
    const render = buildBatterPovRenderState(source);

    expect(render.ball).toEqual(projectWorldToBatterPov(source.world.ball!.position, 'L'));
    expect(render.batAction).toBe('bunt_hold');
    expect(render.bat?.grip).not.toBeNull();
    expect(render.bat?.tip).not.toBeNull();
  });

  it('projects runners from canonical positions for non-contact batter POV frames', () => {
    const source = sample();
    const render = buildBatterPovRenderState(source);

    expect(render.runners[0].worldPosition).toBe(source.world.runners[0].position);
    expect(render.runners[0].projected).toEqual(
      projectWorldToBatterPov({ x: 19.4, y: 0, z: 19.4 }, 'L'),
    );
  });
});
