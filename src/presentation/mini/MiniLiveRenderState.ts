import type {
  PlayerPhysicalProfile,
} from '../../core/model/PlayerPhysicalProfile';
import type {
  MiniPresentationFrame,
} from './model';
import {
  buildBatterPovRenderState,
  type BatterPovRenderState,
} from './BatterPovRenderState';
import {
  buildPitcherPovRenderState,
  type PitcherPovRenderState,
} from './PitcherPovRenderState';
import {
  buildFieldOverheadRenderState,
  type FieldOverheadCameraCalibration,
  type FieldOverheadRenderState,
} from './FieldOverheadRenderState';
import type {
  MiniPlayerDotSizeCalibration,
} from './PlayerDotProfile';
import type {
  MiniBallHeightCalibration,
} from './MiniBallHeightProfile';

export type MiniLiveRenderState =
  | Readonly<{
      cameraMode: 'BATTER_POV';
      render: BatterPovRenderState;
    }>
  | Readonly<{
      cameraMode: 'PITCHER_POV';
      render: PitcherPovRenderState;
    }>
  | Readonly<{
      cameraMode: 'FIELD_OVERHEAD';
      render: FieldOverheadRenderState;
    }>;

export type MiniLiveRenderStateInput = Readonly<{
  frame: MiniPresentationFrame;
  overheadCamera: FieldOverheadCameraCalibration;
  playerPhysicalProfiles?: Readonly<
    Partial<Record<string, PlayerPhysicalProfile>>
  >;
  dotCalibration?: MiniPlayerDotSizeCalibration;
  ballHeightCalibration?: MiniBallHeightCalibration;
  historySamples?: readonly MiniPresentationFrame['sample'][];
  maximumBallTrailPoints?: number;
}>;

export const buildMiniLiveRenderState = (
  input: MiniLiveRenderStateInput,
): MiniLiveRenderState => {
  if (input.frame.cameraMode === 'BATTER_POV') {
    return {
      cameraMode: 'BATTER_POV',
      render: buildBatterPovRenderState(
        input.frame.sample,
      ),
    };
  }

  if (input.frame.cameraMode === 'PITCHER_POV') {
    return {
      cameraMode: 'PITCHER_POV',
      render: buildPitcherPovRenderState(
        input.frame.sample,
      ),
    };
  }

  return {
    cameraMode: 'FIELD_OVERHEAD',
    render: buildFieldOverheadRenderState({
      sample: input.frame.sample,
      camera: input.overheadCamera,
      playerPhysicalProfiles:
        input.playerPhysicalProfiles,
      dotCalibration: input.dotCalibration,
      ballHeightCalibration:
        input.ballHeightCalibration,
      historySamples: input.historySamples,
      maximumBallTrailPoints:
        input.maximumBallTrailPoints,
    }),
  };
};
