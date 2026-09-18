import type {
  CanonicalMatchState,
} from '../../core/model/CanonicalMatchState';
import type {
  CanonicalLineScoreSnapshot,
} from '../../core/model/CanonicalLineScoreSnapshot';
import type {
  PlateAppearanceCommand,
} from '../../core/sim/plateAppearance/PlateAppearanceCommand';
import type {
  PlayerPhysicalProfile,
} from '../../core/model/PlayerPhysicalProfile';
import type {
  TimedMatchEvent,
} from '../../core/model/TimedMatchEvent';
import type {
  MiniPresentationFrame,
} from './model';
import {
  buildMiniHudState,
  type MiniHudState,
} from './MiniHudState';
import {
  buildMiniLiveRenderState,
  type MiniLiveRenderState,
} from './MiniLiveRenderState';
import type {
  FieldOverheadCameraCalibration,
} from './FieldOverheadRenderState';
import type {
  MiniPlayerDotSizeCalibration,
} from './PlayerDotProfile';
import type {
  MiniBallHeightCalibration,
} from './MiniBallHeightProfile';
import {
  buildMiniHandednessBadge,
  type MiniHandednessBadge,
} from './MiniHandednessBadge';
import {
  buildMiniCommandBandState,
  type MiniCommandBandState,
} from './MiniCommandBandState';

export type MiniGameLiveFrame = Readonly<{
  tick: number;
  hud: MiniHudState;
  matchup: Readonly<{
    batter: MiniHandednessBadge;
    pitcher: MiniHandednessBadge | null;
  }>;
  commandBand: MiniCommandBandState | null;
  live: MiniLiveRenderState;
}>;

export type MiniGameLiveFrameInput = Readonly<{
  match: CanonicalMatchState;
  lineScore?: CanonicalLineScoreSnapshot;
  currentCommand?: PlateAppearanceCommand;
  frame: MiniPresentationFrame;
  overheadCamera: FieldOverheadCameraCalibration;
  playerPhysicalProfiles?: Readonly<
    Partial<Record<string, PlayerPhysicalProfile>>
  >;
  dotCalibration?: MiniPlayerDotSizeCalibration;
  ballHeightCalibration?: MiniBallHeightCalibration;
  historySamples?: readonly MiniPresentationFrame['sample'][];
  maximumBallTrailPoints?: number;
  eventPlayIdResolver?: (
    event: TimedMatchEvent,
  ) => number | null;
}>;

const validateFrame = (
  frame: MiniPresentationFrame,
): void => {
  if (frame.tick !== frame.sample.world.tick) {
    throw new Error(
      'presentation frame tick must match canonical world sample tick',
    );
  }
};

const validateEventPlayIds = (
  match: CanonicalMatchState,
  frame: MiniPresentationFrame,
  resolver:
    MiniGameLiveFrameInput['eventPlayIdResolver'],
): void => {
  if (resolver === undefined) {
    return;
  }

  for (const event of frame.events) {
    const playId = resolver(event);
    if (
      playId !== null
      && playId !== match.playId
    ) {
      throw new Error(
        'presentation frame event playId must match CanonicalMatchState.playId',
      );
    }
  }
};

export const buildMiniGameLiveFrame = (
  input: MiniGameLiveFrameInput,
): MiniGameLiveFrame => {
  validateFrame(input.frame);
  validateEventPlayIds(
    input.match,
    input.frame,
    input.eventPlayIdResolver,
  );

  return {
    tick: input.frame.tick,
    hud: buildMiniHudState(
      input.match,
      input.lineScore,
    ),
    matchup: {
      batter: buildMiniHandednessBadge(
        'batter',
        input.frame.sample.batter.handedness,
      ),
      pitcher:
        input.frame.sample.pitcherHandedness === undefined
          ? null
          : buildMiniHandednessBadge(
              'pitcher',
              input.frame.sample.pitcherHandedness,
            ),
    },
    commandBand:
      input.currentCommand === undefined
        ? null
        : buildMiniCommandBandState(
            input.currentCommand,
          ),
    live: buildMiniLiveRenderState({
      frame: input.frame,
      overheadCamera: input.overheadCamera,
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
