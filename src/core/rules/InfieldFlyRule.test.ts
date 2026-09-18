import { describe, expect, it } from 'vitest';
import {
  resolveInfieldFlyRule,
} from './InfieldFlyRule';

const base = {
  outsAtStart: 1,
  occupiedBases: [1, 2] as const,
  battedBallKind: 'fly' as const,
  fair: true,
  ordinaryEffortCatchableByInfielder: true,
  declarationTick: 2_500_000,
};

describe('InfieldFlyRule', () => {
  it('declares the batter out with no batter-created force when the rule applies', () => {
    expect(resolveInfieldFlyRule({
      ...base,
      catchState: 'caught',
    })).toEqual({
      kind: 'infield_fly',
      batterRunnerOut: true,
      batterRunnerOutTick: 2_500_000,
      batterCreatedForceActive: false,
      ballRemainsLive: true,
      runnerState: 'tag_up_required_if_advancing',
    });
  });

  it('keeps the ball live and removes force pressure when the fly is dropped', () => {
    expect(resolveInfieldFlyRule({
      ...base,
      catchState: 'not_caught',
    })).toEqual({
      kind: 'infield_fly',
      batterRunnerOut: true,
      batterRunnerOutTick: 2_500_000,
      batterCreatedForceActive: false,
      ballRemainsLive: true,
      runnerState: 'advance_at_risk_without_force',
    });
  });

  it('can declare with first and second occupied or with bases loaded', () => {
    expect(resolveInfieldFlyRule({
      ...base,
      occupiedBases: [1, 2, 3],
      catchState: 'not_caught',
    }).kind).toBe('infield_fly');

    expect(resolveInfieldFlyRule({
      ...base,
      outsAtStart: 0,
      catchState: 'caught',
    }).kind).toBe('infield_fly');
  });

  it('does not apply with two outs or without runners on both first and second', () => {
    expect(resolveInfieldFlyRule({
      ...base,
      outsAtStart: 2,
      catchState: 'not_caught',
    })).toEqual({
      kind: 'not_infield_fly',
      reason: 'two_outs',
    });

    expect(resolveInfieldFlyRule({
      ...base,
      occupiedBases: [1],
      catchState: 'not_caught',
    })).toEqual({
      kind: 'not_infield_fly',
      reason: 'force_configuration_missing',
    });
  });

  it('does not apply to foul balls, line drives, bunts, or non-ordinary-effort flies', () => {
    expect(resolveInfieldFlyRule({
      ...base,
      fair: false,
      catchState: 'not_caught',
    })).toEqual({
      kind: 'not_infield_fly',
      reason: 'not_fair',
    });

    expect(resolveInfieldFlyRule({
      ...base,
      battedBallKind: 'line_drive',
      catchState: 'not_caught',
    })).toEqual({
      kind: 'not_infield_fly',
      reason: 'excluded_batted_ball_kind',
    });

    expect(resolveInfieldFlyRule({
      ...base,
      battedBallKind: 'bunt',
      catchState: 'not_caught',
    })).toEqual({
      kind: 'not_infield_fly',
      reason: 'excluded_batted_ball_kind',
    });

    expect(resolveInfieldFlyRule({
      ...base,
      ordinaryEffortCatchableByInfielder: false,
      catchState: 'not_caught',
    })).toEqual({
      kind: 'not_infield_fly',
      reason: 'not_ordinary_effort_infield_catch',
    });
  });

  it('preserves the declared batter out while catch resolution is still pending', () => {
    expect(resolveInfieldFlyRule({
      ...base,
      catchState: 'unresolved',
    })).toEqual({
      kind: 'infield_fly',
      batterRunnerOut: true,
      batterRunnerOutTick: 2_500_000,
      batterCreatedForceActive: false,
      ballRemainsLive: true,
      runnerState: 'pending_catch_resolution',
    });
  });
});
