import type {
  CanonicalMatchState,
} from '../../core/model/CanonicalMatchState';

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
  teamPanels: Readonly<{
    left: Readonly<{
      team: 'away';
      accent: 'blue';
    }>;
    right: Readonly<{
      team: 'home';
      accent: 'red';
    }>;
  }>;
  playId: number;
}>;

const marker = (
  runnerId: string | null,
): MiniHudBaseMarker => ({
  occupied: runnerId !== null,
  runnerId,
});

export const buildMiniHudState = (
  match: CanonicalMatchState,
): MiniHudState => ({
  inning: match.inning,
  half: match.half,
  offense: match.half === 'top' ? 'away' : 'home',
  defense: match.half === 'top' ? 'home' : 'away',
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
  teamPanels: {
    left: {
      team: 'away',
      accent: 'blue',
    },
    right: {
      team: 'home',
      accent: 'red',
    },
  },
  playId: match.playId,
});
