import type {
  MiniGameLiveFrame,
} from './MiniGameLiveFrame';
import {
  buildMiniBaseDiamondState,
} from './MiniBaseDiamondState';

export type MiniPortraitRegionKind =
  | 'scoreboard'
  | 'situation'
  | 'player_cards'
  | 'live_view'
  | 'command_band';

export type MiniPortraitRegion = Readonly<{
  kind: MiniPortraitRegionKind;
  visible: boolean;
  payload: unknown;
}>;

export type MiniPortraitScreenState = Readonly<{
  orientation: 'portrait';
  regions: readonly MiniPortraitRegion[];
}>;

export const buildMiniPortraitScreenState = (
  frame: MiniGameLiveFrame,
): MiniPortraitScreenState => ({
  orientation: 'portrait',
  regions: [
    {
      kind: 'scoreboard',
      visible: true,
      payload: {
        lineScore: frame.hud.lineScore,
        score: frame.hud.score,
      },
    },
    {
      kind: 'situation',
      visible: true,
      payload: {
        inning: frame.hud.inning,
        half: frame.hud.half,
        count: frame.hud.count,
        bases: frame.hud.bases,
        baseDiamond:
          buildMiniBaseDiamondState(
            frame.hud.bases,
          ),
      },
    },
    {
      kind: 'player_cards',
      visible: (
        frame.playerCards.batter !== null
        || frame.playerCards.pitcher !== null
      ),
      payload: frame.playerCards,
    },
    {
      kind: 'live_view',
      visible: true,
      payload: frame.live,
    },
    {
      kind: 'command_band',
      visible: frame.commandBand !== null,
      payload: frame.commandBand,
    },
  ],
});
