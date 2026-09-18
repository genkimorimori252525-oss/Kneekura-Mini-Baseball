import type {
  CanonicalLineScoreSnapshot,
} from '../../core/model/CanonicalLineScoreSnapshot';
import type {
  CanonicalMatchState,
} from '../../core/model/CanonicalMatchState';
import type {
  PlayerPhysicalProfile,
} from '../../core/model/PlayerPhysicalProfile';
import type {
  PlateAppearanceCommand,
} from '../../core/sim/plateAppearance/PlateAppearanceCommand';
import type {
  TimedMatchEvent,
} from '../../core/model/TimedMatchEvent';
import type {
  MiniPresentationFrame,
} from './model';
import {
  buildMiniGameLiveFrame,
  type MiniGameLiveFrame,
  type MiniGameLiveFrameInput,
} from './MiniGameLiveFrame';
import type {
  FieldOverheadCameraCalibration,
} from './FieldOverheadRenderState';
import type {
  MiniPlayerDotSizeCalibration,
} from './PlayerDotProfile';
import type {
  MiniBallHeightCalibration,
} from './MiniBallHeightProfile';

export type MiniReplaySource = Readonly<{
  match: CanonicalMatchState;
  lineScore?: CanonicalLineScoreSnapshot;
  currentCommand?: PlateAppearanceCommand;
  matchupPlayers?: MiniGameLiveFrameInput[
    'matchupPlayers'
  ];
  frame: MiniPresentationFrame;
}>;

export type MiniReplaySequenceInput = Readonly<{
  sources: readonly MiniReplaySource[];
  overheadCamera: FieldOverheadCameraCalibration;
  playerPhysicalProfiles?: Readonly<
    Partial<Record<string, PlayerPhysicalProfile>>
  >;
  dotCalibration?: MiniPlayerDotSizeCalibration;
  ballHeightCalibration?: MiniBallHeightCalibration;
  maximumBallTrailPoints?: number;
  eventPlayIdResolver?: (
    event: TimedMatchEvent,
  ) => number | null;
}>;

const validateSourceOrder = (
  sources: readonly MiniReplaySource[],
): void => {
  for (
    let index = 1;
    index < sources.length;
    index += 1
  ) {
    if (
      sources[index].frame.tick
      < sources[index - 1].frame.tick
    ) {
      throw new Error(
        'mini replay source ticks must be non-decreasing',
      );
    }
  }
};

export const buildMiniReplaySequence = (
  input: MiniReplaySequenceInput,
): readonly MiniGameLiveFrame[] => {
  validateSourceOrder(input.sources);

  return input.sources.map(
    (source, index) => (
      buildMiniGameLiveFrame({
        match: source.match,
        lineScore: source.lineScore,
        currentCommand: source.currentCommand,
        matchupPlayers:
          source.matchupPlayers,
        frame: source.frame,
        overheadCamera:
          input.overheadCamera,
        playerPhysicalProfiles:
          input.playerPhysicalProfiles,
        dotCalibration:
          input.dotCalibration,
        ballHeightCalibration:
          input.ballHeightCalibration,
        historySamples: input.sources
          .slice(0, index)
          .map(
            (previous) => previous.frame.sample,
          ),
        maximumBallTrailPoints:
          input.maximumBallTrailPoints,
        eventPlayIdResolver:
          input.eventPlayIdResolver,
      })
    ),
  );
};
