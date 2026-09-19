import type { Vec2 } from '../../core/model/geometry';
import { projectBatPoseToBatterPov, projectWorldToBatterPov, type ProjectedBatPose, type ProjectedPoint } from './BatterPovCamera';
import type { BatActionType, BatterHandedness, CanonicalPresentationSample } from './model';
import {
  projectStrikeZoneGuide,
  type ProjectedStrikeZoneGuide,
  type StrikeZoneGuideGeometry,
} from './StrikeZoneGuide';

export type ProjectedDefender = Readonly<{
  playerId: string;
  registeredPosition: CanonicalPresentationSample['world']['defenders'][number]['registeredPosition'];
  worldPosition: Vec2;
  projected: ProjectedPoint | null;
  dotSize: 1 | 2 | 3;
}>;

export type ProjectedRunner = Readonly<{
  playerId: string;
  worldPosition: Vec2;
  projected: ProjectedPoint | null;
}>;

export type BatterPovRenderState = Readonly<{
  tick: number;
  handedness: BatterHandedness;
  batAction: BatActionType;
  ball: ProjectedPoint | null;
  ballPixelSize: 1 | 2 | 3 | 4;
  bat: ProjectedBatPose | null;
  strikeZoneGuide: ProjectedStrikeZoneGuide | null;
  defenders: readonly ProjectedDefender[];
  runners: readonly ProjectedRunner[];
}>;

function projectGroundPoint(position: Vec2, handedness: BatterHandedness): ProjectedPoint | null {
  return projectWorldToBatterPov({ x: position.x, y: 0, z: position.z }, handedness);
}

function defenderDotSize(projected: ProjectedPoint | null): 1 | 2 | 3 {
  if (!projected) return 1;
  if (projected.depth < 28) return 3;
  if (projected.depth < 50) return 2;
  return 1;
}

function ballPixelSize(projected: ProjectedPoint | null): 1 | 2 | 3 | 4 {
  if (!projected) return 1;
  const apparentDiameter = 0.0732 * projected.apparentScale;
  if (apparentDiameter < 0.95) return 1;
  if (apparentDiameter < 1.5) return 2;
  if (apparentDiameter < 2.4) return 3;
  return 4;
}

export function buildBatterPovRenderState(
  sample: CanonicalPresentationSample,
  strikeZoneGuide?: StrikeZoneGuideGeometry,
): BatterPovRenderState {
  const handedness = sample.batter.handedness;
  const ball = sample.world.ball
    ? projectWorldToBatterPov(sample.world.ball.position, handedness)
    : null;

  return {
    tick: sample.world.tick,
    handedness,
    batAction: sample.batter.action,
    ball,
    ballPixelSize: ballPixelSize(ball),
    bat: sample.batter.bat ? projectBatPoseToBatterPov(sample.batter.bat, handedness) : null,
    strikeZoneGuide: strikeZoneGuide === undefined
      ? null
      : projectStrikeZoneGuide(
          strikeZoneGuide,
          (point) => projectWorldToBatterPov(
            point,
            handedness,
          ),
        ),
    defenders: sample.world.defenders.map((defender) => {
      const projected = projectGroundPoint(defender.position, handedness);
      return {
        playerId: defender.playerId,
        registeredPosition: defender.registeredPosition,
        worldPosition: defender.position,
        projected,
        dotSize: defenderDotSize(projected),
      };
    }),
    runners: sample.world.runners.map((runner) => ({
      playerId: runner.playerId,
      worldPosition: runner.position,
      projected: projectGroundPoint(runner.position, handedness),
    })),
  };
}