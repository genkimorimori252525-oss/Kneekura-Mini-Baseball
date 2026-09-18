import type {
  Vec2,
} from '../../core/model/geometry';
import type {
  ProjectedBatPose,
  ProjectedPoint,
} from './BatterPovCamera';
import {
  projectBatPoseToPitcherPov,
  projectWorldToPitcherPov,
} from './PitcherPovCamera';
import type {
  BatActionType,
  BatterHandedness,
  CanonicalPresentationSample,
} from './model';

export type PitcherPovProjectedDefender =
  Readonly<{
    playerId: string;
    registeredPosition:
      CanonicalPresentationSample['world']['defenders'][number]['registeredPosition'];
    worldPosition: Vec2;
    projected: ProjectedPoint | null;
    dotSize: 1 | 2 | 3;
  }>;

export type PitcherPovProjectedRunner =
  Readonly<{
    playerId: string;
    worldPosition: Vec2;
    projected: ProjectedPoint | null;
  }>;

export type PitcherPovRenderState = Readonly<{
  tick: number;
  pitcherHandedness: BatterHandedness | null;
  batterHandedness: BatterHandedness;
  batAction: BatActionType;
  ball: ProjectedPoint | null;
  ballPixelSize: 1 | 2 | 3 | 4;
  bat: ProjectedBatPose | null;
  defenders:
    readonly PitcherPovProjectedDefender[];
  runners:
    readonly PitcherPovProjectedRunner[];
}>;

const projectGroundPoint = (
  position: Vec2,
): ProjectedPoint | null => (
  projectWorldToPitcherPov({
    x: position.x,
    y: 0,
    z: position.z,
  })
);

const defenderDotSize = (
  projected: ProjectedPoint | null,
): 1 | 2 | 3 => {
  if (projected === null) {
    return 1;
  }
  if (projected.depth < 28) {
    return 3;
  }
  if (projected.depth < 50) {
    return 2;
  }
  return 1;
};

const ballPixelSize = (
  projected: ProjectedPoint | null,
): 1 | 2 | 3 | 4 => {
  if (projected === null) {
    return 1;
  }

  const apparentDiameter = (
    0.0732 * projected.apparentScale
  );

  if (apparentDiameter < 0.95) {
    return 1;
  }
  if (apparentDiameter < 1.5) {
    return 2;
  }
  if (apparentDiameter < 2.4) {
    return 3;
  }
  return 4;
};

export const buildPitcherPovRenderState = (
  sample: CanonicalPresentationSample,
): PitcherPovRenderState => {
  const ball = sample.world.ball === null
    ? null
    : projectWorldToPitcherPov(
        sample.world.ball.position,
      );

  return {
    tick: sample.world.tick,
    pitcherHandedness:
      sample.pitcherHandedness ?? null,
    batterHandedness:
      sample.batter.handedness,
    batAction: sample.batter.action,
    ball,
    ballPixelSize: ballPixelSize(ball),
    bat: sample.batter.bat === null
      ? null
      : projectBatPoseToPitcherPov(
          sample.batter.bat,
        ),
    defenders: sample.world.defenders.map(
      (defender) => {
        const projected = projectGroundPoint(
          defender.position,
        );
        return {
          playerId: defender.playerId,
          registeredPosition:
            defender.registeredPosition,
          worldPosition: defender.position,
          projected,
          dotSize:
            defenderDotSize(projected),
        };
      },
    ),
    runners: sample.world.runners.map(
      (runner) => ({
        playerId: runner.playerId,
        worldPosition: runner.position,
        projected: projectGroundPoint(
          runner.position,
        ),
      }),
    ),
  };
};
