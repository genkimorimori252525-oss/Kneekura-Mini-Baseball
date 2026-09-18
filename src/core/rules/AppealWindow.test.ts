import { describe, expect, it } from 'vitest';
import {
  closeAppealWindow,
  createAppealWindow,
  evaluateAppealTiming,
} from './AppealWindow';

describe('AppealWindow', () => {
  it('treats an appeal in an open window as timely', () => {
    const window = createAppealWindow(1_000_000);

    expect(evaluateAppealTiming(
      window,
      1_300_000,
    )).toBe('timely');
  });

  it('distinguishes before, after, and same-tick window closing', () => {
    const closed = closeAppealWindow(
      createAppealWindow(1_000_000),
      1_500_000,
      'next_pitch_or_play',
    );

    expect(evaluateAppealTiming(
      closed,
      1_300_000,
    )).toBe('timely');

    expect(evaluateAppealTiming(
      closed,
      1_600_000,
    )).toBe('expired');

    expect(evaluateAppealTiming(
      closed,
      1_500_000,
    )).toBe('simultaneous_unresolved');
  });

  it('supports the defense leaving the field as an explicit close reason', () => {
    expect(closeAppealWindow(
      createAppealWindow(2_000_000),
      2_500_000,
      'defense_left_field',
    )).toEqual({
      openedAtTick: 2_000_000,
      closedAtTick: 2_500_000,
      closeReason: 'defense_left_field',
    });
  });

  it('rejects appeals before the window opens and invalid close chronology', () => {
    expect(() => evaluateAppealTiming(
      createAppealWindow(1_000_000),
      999_999,
    )).toThrow('appealTick cannot precede appeal-window opening');

    expect(() => closeAppealWindow(
      createAppealWindow(1_000_000),
      999_999,
      'next_pitch_or_play',
    )).toThrow('appeal window cannot close before it opens');
  });

  it('rejects closing an already closed appeal window', () => {
    const closed = closeAppealWindow(
      createAppealWindow(1_000_000),
      1_500_000,
      'next_pitch_or_play',
    );

    expect(() => closeAppealWindow(
      closed,
      1_600_000,
      'defense_left_field',
    )).toThrow('appeal window is already closed');
  });
});
