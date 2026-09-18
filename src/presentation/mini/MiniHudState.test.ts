import { describe, expect, it } from 'vitest';
import {
  asRuleProfileId,
} from '../../core/model/RuleProfileRef';
import type {
  CanonicalMatchState,
} from '../../core/model/CanonicalMatchState';
import {
  buildMiniHudState,
} from './MiniHudState';

const match: CanonicalMatchState = {
  ruleProfileId: asRuleProfileId('npb-2026'),
  inning: 7,
  half: 'bottom',
  outs: 2,
  balls: 3,
  strikes: 2,
  bases: {
    first: 'r1',
    second: null,
    third: 'r3',
  },
  score: {
    away: 4,
    home: 5,
  },
  playId: 88,
};

describe('MiniHudState', () => {
  it('projects canonical inning, count, outs, score, and base occupancy without reinterpretation', () => {
    expect(buildMiniHudState(match)).toEqual({
      inning: 7,
      half: 'bottom',
      offense: 'home',
      defense: 'away',
      count: {
        balls: 3,
        strikes: 2,
        outs: 2,
      },
      bases: {
        first: {
          occupied: true,
          runnerId: 'r1',
        },
        second: {
          occupied: false,
          runnerId: null,
        },
        third: {
          occupied: true,
          runnerId: 'r3',
        },
      },
      score: {
        away: 4,
        home: 5,
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
      playId: 88,
    });
  });

  it('does not mutate CanonicalMatchState', () => {
    const before = structuredClone(match);

    buildMiniHudState(match);

    expect(match).toEqual(before);
  });

  it('keeps base-marker identity instead of reducing occupancy to anonymous booleans', () => {
    const hud = buildMiniHudState(match);

    expect(hud.bases.first.runnerId).toBe('r1');
    expect(hud.bases.third.runnerId).toBe('r3');
  });
});
