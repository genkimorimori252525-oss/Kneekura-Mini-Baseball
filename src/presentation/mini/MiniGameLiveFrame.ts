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
import {
  buildMiniPlayerCardState,
  type MiniPlayerCardState,
} from './MiniPlayerCardState';

export type MiniGameLiveFrame = Readonly<{
  tick: number;
  hud: MiniHudState;
  matchup: Readonly<{
    batter: MiniHandednessBadge;
    pitcher: MiniHandednessBadge | null;
  }>;
  commandBand: MiniCommandBandState | null;
  playerCards: Readonly<{
    batter: MiniPlayerCardState | null;
    pitcher: MiniPlayerCardState | null;
  }>;
  live: MiniLiveRenderState;
}>;

export type MiniGameLiveFrameInput = Readonly<{
  match: CanonicalMatchState;
  lineScore?: CanonicalLineScoreSnapshot;
  currentCommand?: PlateAppearanceCommand;
  matchupPlayers?: Readonly<{
    batter?: Readonly<{
      playerId: string;
      displayName?: string;
      jerseyNumber?: string | number;
      publicMetrics?: readonly Readonly<{
        label: string;
        value: string | number;
      }>[];
    }>;
    pitcher?: Readonly<{
      playerId: string;
      displayName?: string;
      jerseyNumber?: string | number;
      publicMetrics?: readonly Readonly<{
        label: string;
        value: string | number;
      }>[];
    }>;
  }>;
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

const buildPlayerCards = (
  input: MiniGameLiveFrameInput,
): MiniGameLiveFrame['playerCards'] => {
  const batterMeta = input.matchupPlayers?.batter;
  const pitcherMeta = input.matchupPlayers?.pitcher;

  const batter = batterMeta === undefined
    ? null
    : buildMiniPlayerCardState({
        role: 'batter',
        playerId: batterMeta.playerId,
        displayName: batterMeta.displayName,
        jerseyNumber: batterMeta.jerseyNumber,
        publicMetrics: batterMeta.publicMetrics,
        handedness:
          input.frame.sample.batter.handedness,
      });

  if (
    pitcherMeta !== undefined
    && input.frame.sample.pitcherHandedness === undefined
  ) {
    throw new Error(
      'pitcher player card requires pitcherHandedness in the presentation sample',
    );
  }

  const pitcher = (
    pitcherMeta === undefined
    || input.frame.sample.pitcherHandedness === undefined
  )
    ? null
    : buildMiniPlayerCardState({
        role: 'pitcher',
        playerId: pitcherMeta.playerId,
        displayName: pitcherMeta.displayName,
        jerseyNumber: pitcherMeta.jerseyNumber,
        publicMetrics: pitcherMeta.publicMetrics,
        handedness:
          input.frame.sample.pitcherHandedness,
      });

  return {
    batter,
    pitcher,
  };
};

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
    playerCards: buildPlayerCards(input),
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
