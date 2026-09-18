import { describe, expect, it } from 'vitest';
import {
  resolvePitchCountRule,
  type PitchCountState,
} from './PitchCountRule';

const count = (
  balls: number,
  strikes: number,
): PitchCountState => ({ balls, strikes });

describe('PitchCountRule', () => {
  it('adds ordinary foul strikes only until two strikes', () => {
    expect(resolvePitchCountRule(
      count(0, 0),
      { kind: 'foul' },
    )).toEqual({
      kind: 'continue',
      count: count(0, 1),
      cause: 'foul',
    });

    expect(resolvePitchCountRule(
      count(0, 1),
      { kind: 'foul' },
    )).toEqual({
      kind: 'continue',
      count: count(0, 2),
      cause: 'foul',
    });

    expect(resolvePitchCountRule(
      count(0, 2),
      { kind: 'foul' },
    )).toEqual({
      kind: 'continue',
      count: count(0, 2),
      cause: 'foul',
    });
  });

  it('treats a foul bunt with two strikes as strike three', () => {
    expect(resolvePitchCountRule(
      count(1, 2),
      { kind: 'foul_bunt' },
    )).toEqual({
      kind: 'strikeout',
      terminalCount: {
        balls: 1,
        strikes: 3,
      },
      cause: 'foul_bunt',
    });
  });

  it('resolves the fourth ball as a walk', () => {
    expect(resolvePitchCountRule(
      count(3, 1),
      { kind: 'ball' },
    )).toEqual({
      kind: 'walk',
      terminalCount: {
        balls: 4,
        strikes: 1,
      },
      cause: 'ball',
    });
  });

  it('resolves called and swinging third strikes as strikeouts', () => {
    for (const pitch of [
      { kind: 'called_strike' as const },
      { kind: 'swinging_strike' as const },
    ]) {
      expect(resolvePitchCountRule(
        count(2, 2),
        pitch,
      )).toEqual({
        kind: 'strikeout',
        terminalCount: {
          balls: 2,
          strikes: 3,
        },
        cause: pitch.kind,
      });
    }
  });

  it('ends count processing when the pitch becomes a live ball in play', () => {
    expect(resolvePitchCountRule(
      count(2, 1),
      { kind: 'ball_in_play' },
    )).toEqual({
      kind: 'ball_in_play',
      count: count(2, 1),
    });
  });

  it('rejects impossible pre-pitch count states', () => {
    expect(() => resolvePitchCountRule(
      count(4, 0),
      { kind: 'ball' },
    )).toThrow(
      'pre-pitch balls must be an integer from 0 through 3',
    );

    expect(() => resolvePitchCountRule(
      count(0, 3),
      { kind: 'called_strike' },
    )).toThrow(
      'pre-pitch strikes must be an integer from 0 through 2',
    );
  });
});
