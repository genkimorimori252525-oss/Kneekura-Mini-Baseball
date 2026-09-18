import { describe, expect, it } from 'vitest';
import {
  createPlayEndFact,
  createRunnerBaseTouchFact,
} from './PhysicalRuleFacts';
import { finalizePendingRunsAtPlayEnd } from './PlayRunFinalization';

describe('PlayRunFinalization', () => {
  it('finalizes pending home touches when live action ends after them', () => {
    const first = createRunnerBaseTouchFact(
      'runner-a',
      4,
      1_100_000,
    );
    const second = createRunnerBaseTouchFact(
      'runner-b',
      4,
      1_150_000,
    );
    const playEnd = createPlayEndFact(
      1_300_000,
      'live_action_complete',
    );

    expect(finalizePendingRunsAtPlayEnd(
      [first, second],
      playEnd,
    )).toEqual({
      finalizedAt: 1_300_000,
      playEnd,
      scored: [first, second],
    });
  });

  it('accepts a home touch exactly on the authoritative play-end tick', () => {
    const touch = createRunnerBaseTouchFact(
      'runner',
      4,
      1_300_000,
    );
    const playEnd = createPlayEndFact(
      1_300_000,
      'live_action_complete',
    );

    expect(finalizePendingRunsAtPlayEnd(
      [touch],
      playEnd,
    ).scored).toEqual([touch]);
  });

  it('rejects a pending home touch after the play-end tick', () => {
    expect(() => finalizePendingRunsAtPlayEnd(
      [
        createRunnerBaseTouchFact(
          'runner',
          4,
          1_300_001,
        ),
      ],
      createPlayEndFact(
        1_300_000,
        'live_action_complete',
      ),
    )).toThrow(
      'pending home touch cannot occur after the authoritative play end',
    );
  });

  it('rejects non-home pending touch facts', () => {
    expect(() => finalizePendingRunsAtPlayEnd(
      [
        createRunnerBaseTouchFact(
          'runner',
          3,
          1_200_000,
        ),
      ],
      createPlayEndFact(
        1_300_000,
        'live_action_complete',
      ),
    )).toThrow('pending run finalization requires base-4 home touch facts');
  });

  it('supports an explicit dead-ball play-end boundary', () => {
    const playEnd = createPlayEndFact(2_000_000, 'dead_ball');

    expect(playEnd).toEqual({
      kind: 'play_end',
      tick: 2_000_000,
      reason: 'dead_ball',
    });
  });
});
