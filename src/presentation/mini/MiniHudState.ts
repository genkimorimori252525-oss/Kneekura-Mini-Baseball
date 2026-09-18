import type {
  CanonicalMatchState,
} from '../../core/model/CanonicalMatchState';
import type {
  CanonicalLineScoreSnapshot,
} from '../../core/model/CanonicalLineScoreSnapshot';
import {
  buildMiniLineScoreState,
  type MiniLineScoreState,
} from './MiniLineScoreState';

export type MiniHudBaseMarker = Readonly<{
  occupied: boolean;
  runnerId: string | null;
}>;

export type MiniHudState = Readonly<{
  inning: number;
  half: 'top' | 'bottom';
  offense: 'away' | 'home';
  defense: 'away' | 'home';
  count: Readonly<{
    balls: number;
    strikes: number;
    outs: number;
  }>;
  bases: Readonly<{
    first: MiniHudBaseMarker;
    second: MiniHudBaseMarker;
    third: MiniHudBaseMarker;
  }>;
  score: Readonly<{
    away: number;
    home: number;
  }>;
  playId: number;
  lineScore: MiniLineScoreState | null;
}>;

const marker = (
  runnerId: string | null,
): MiniHudBaseMarker => ({
  occupied: runnerId !== null,
  runnerId,
});

export const buildMiniHudState = (
  match: CanonicalMatchState,
  lineScore?: CanonicalLineScoreSnapshot,
): MiniHudState => {
  if (
    lineScore !== undefined
    && (
      lineScore.totals.away.runs
        !== match.score.away
      || lineScore.totals.home.runs
        !== match.score.home
    )
  ) {
    throw new Error(
      'line-score run totals must match CanonicalMatchState.score',
    );
  }

  return {
    inning: match.inning,
    half: match.half,
    offense: match.half === 'top'
      ? 'away'
      : 'home',
    defense: match.half === 'top'
      ? 'home'
      : 'away',
    count: {
      balls: match.balls,
      strikes: match.strikes,
      outs: match.outs,
    },
    bases: {
      first: marker(match.bases.first),
      second: marker(match.bases.second),
      third: marker(match.bases.third),
    },
    score: {
      away: match.score.away,
      home: match.score.home,
    },
    playId: match.playId,
    lineScore: lineScore === undefined
      ? null
      : buildMiniLineScoreState(
          lineScore,
          {
            currentInning: match.inning,
            minimumInningColumns: 9,
          },
        ),
  };
};
