import { describe, expect, it } from 'vitest';
import {
  createControlledBaseContactFact,
  createControlledRunnerTagFact,
  createFlyBallFirstFielderTouchFact,
  createRunnerBaseDepartureFact,
  createRunnerBaseTouchFact,
} from './PhysicalRuleFacts';
import {
  createInitialForceObligationState,
  deriveCurrentForceObligations,
} from './ForceObligation';
import {
  applyForceOutRuleResultToState,
} from './ForceObligationTransition';
import {
  resolveForceOutAtTarget,
} from './ForceOutRule';
import {
  resolveForceOutScoringRule,
  resolveGroundBallFirstBaseRule,
} from './RuleEngine';
import {
  resolvePitchCountRule,
} from './PitchCountRule';
import {
  resolveFlyCatch,
} from './FlyCatchRule';
import {
  resolveFoulBallRule,
} from './FoulBallRule';
import {
  resolveInfieldFlyRule,
} from './InfieldFlyRule';
import {
  evaluateTagUpCompliance,
} from './TagUpCompliance';
import {
  resolveTagArrival,
} from './TagArrivalRule';
import {
  resolveHalfInningTransition,
} from './HalfInningTransitionRule';

describe('P1 NPB rule acceptance matrix', () => {
  it('R-01/R-02: resolves four balls, three strikes, ordinary two-strike foul, and foul-bunt strike three', () => {
    expect(resolvePitchCountRule(
      { balls: 3, strikes: 1 },
      { kind: 'ball' },
    ).kind).toBe('walk');

    expect(resolvePitchCountRule(
      { balls: 1, strikes: 2 },
      { kind: 'called_strike' },
    ).kind).toBe('strikeout');

    expect(resolvePitchCountRule(
      { balls: 0, strikes: 2 },
      { kind: 'foul' },
    )).toEqual({
      kind: 'continue',
      count: { balls: 0, strikes: 2 },
      cause: 'foul',
    });

    expect(resolvePitchCountRule(
      { balls: 0, strikes: 2 },
      { kind: 'foul_bunt' },
    ).kind).toBe('strikeout');

    expect(resolveHalfInningTransition({
      inning: 4,
      half: 'bottom',
      outsAfterPlay: 3,
    })).toMatchObject({
      kind: 'half_inning_ended',
      nextInning: 5,
      nextHalf: 'top',
      reset: {
        outs: 0,
        balls: 0,
        strikes: 0,
      },
    });
  });

  it('R-03: a secured foul fly is an out, while an uncaught foul returns to count semantics', () => {
    const firstTouch = createFlyBallFirstFielderTouchFact(
      'third-baseman',
      1_000_000,
    );
    const caught = resolveFlyCatch({
      batterRunnerId: 'batter',
      firstTouch,
      secureCatchTick: 1_050_000,
      firstGroundContactTick: null,
    });

    expect(resolveFoulBallRule({
      territory: 'foul',
      buntAttempt: false,
      count: { balls: 1, strikes: 1 },
      flyCatch: caught,
    })).toMatchObject({
      kind: 'caught_foul_fly',
      batterRunnerId: 'batter',
      outTick: 1_050_000,
      ballRemainsLive: true,
    });

    const dropped = resolveFlyCatch({
      batterRunnerId: 'batter',
      firstTouch,
      secureCatchTick: 1_100_000,
      firstGroundContactTick: 1_020_000,
    });
    expect(resolveFoulBallRule({
      territory: 'foul',
      buntAttempt: false,
      count: { balls: 1, strikes: 2 },
      flyCatch: dropped,
    })).toMatchObject({
      kind: 'uncaught_foul',
      ballDead: true,
      countResult: {
        kind: 'continue',
        count: { balls: 1, strikes: 2 },
      },
    });
  });

  it('R-04/R-06: one-out bases-loaded force double play suppresses the apparent run on the batter-runner third out', () => {
    const forceState = createInitialForceObligationState(
      { first: 'r1', second: 'r2', third: 'r3' },
      'batter',
    );
    const r1Force = deriveCurrentForceObligations(forceState)
      .find((item) => item.runnerId === 'r1');
    if (r1Force === undefined) {
      throw new Error('fixture must create runner-from-first force');
    }

    const secondOut = resolveForceOutAtTarget({
      obligation: r1Force,
      defenderControl: createControlledBaseContactFact(
        'shortstop',
        2,
        1_100_000,
      ),
      runnerTouch: createRunnerBaseTouchFact(
        'r1',
        2,
        1_120_000,
      ),
    });
    if (secondOut.kind !== 'out') {
      throw new Error('fixture must create force out');
    }

    const afterSecondOut = applyForceOutRuleResultToState(
      forceState,
      secondOut,
    );
    expect(
      deriveCurrentForceObligations(afterSecondOut)
        .map((item) => item.runnerId),
    ).toEqual(['batter']);

    expect(resolveForceOutScoringRule({
      outsAtStart: 1,
      forceOut: secondOut,
      homeTouches: [],
    }).outsAfter).toBe(2);

    const homeTouch = createRunnerBaseTouchFact(
      'r3',
      4,
      1_150_000,
    );
    const thirdOut = resolveGroundBallFirstBaseRule({
      outsAtStart: 2,
      batterRunnerId: 'batter',
      defenderControl: createControlledBaseContactFact(
        'first-baseman',
        1,
        1_200_000,
      ),
      batterRunnerTouch: createRunnerBaseTouchFact(
        'batter',
        1,
        1_230_000,
      ),
      homeTouches: [homeTouch],
    });

    expect(thirdOut.correctRuleResult).toMatchObject({
      kind: 'resolved',
      outsAfter: 3,
      thirdOut: true,
      runsScored: [],
      runsSuppressed: [homeTouch],
    });
  });

  it('R-05: after a force dissolves, touching the destination base is not enough and a physical runner tag is required', () => {
    const initial = createInitialForceObligationState(
      { first: 'r1', second: 'r2', third: null },
      'batter',
    );
    const r1Force = deriveCurrentForceObligations(initial)
      .find((item) => item.runnerId === 'r1');
    if (r1Force === undefined) {
      throw new Error('fixture must create r1 force');
    }

    const r1Out = resolveForceOutAtTarget({
      obligation: r1Force,
      defenderControl: createControlledBaseContactFact(
        'second-baseman',
        2,
        1_100_000,
      ),
      runnerTouch: createRunnerBaseTouchFact(
        'r1',
        2,
        1_120_000,
      ),
    });
    if (r1Out.kind !== 'out') {
      throw new Error('fixture must retire r1');
    }

    const after = applyForceOutRuleResultToState(
      initial,
      r1Out,
    );
    expect(
      deriveCurrentForceObligations(after)
        .some((item) => item.runnerId === 'r2'),
    ).toBe(false);

    expect(resolveTagArrival({
      runnerId: 'r2',
      targetBase: 3,
      controlledTag: createControlledRunnerTagFact(
        'third-baseman',
        'r2',
        1_205_000,
      ),
      runnerTouch: createRunnerBaseTouchFact(
        'r2',
        3,
        1_220_000,
      ),
    })).toMatchObject({
      kind: 'out',
      classification: 'time_play',
      tagTick: 1_205_000,
      runnerTouchTick: 1_220_000,
    });
  });

  it('R-07: an early departure remains appealable until a legal retouch after first fielder touch', () => {
    const firstTouch = createFlyBallFirstFielderTouchFact(
      'left-fielder',
      2_000_000,
    );
    const departure = createRunnerBaseDepartureFact(
      'runner-on-second',
      2,
      1_990_000,
    );

    expect(evaluateTagUpCompliance({
      runnerId: 'runner-on-second',
      originBase: 2,
      firstTouch,
      departure,
      retouch: null,
    }).kind).toBe('appealable_early_departure');

    expect(evaluateTagUpCompliance({
      runnerId: 'runner-on-second',
      originBase: 2,
      firstTouch,
      departure,
      retouch: createRunnerBaseTouchFact(
        'runner-on-second',
        2,
        2_010_000,
      ),
    })).toMatchObject({
      kind: 'compliant',
      basis: 'retouched_after_first_touch',
    });
  });

  it('R-08: infield fly declares the batter out and removes the batter-created force even if the ball drops', () => {
    expect(resolveInfieldFlyRule({
      outsAtStart: 1,
      occupiedBases: [1, 2, 3],
      battedBallKind: 'fly',
      fair: true,
      ordinaryEffortCatchableByInfielder: true,
      declarationTick: 3_000_000,
      catchState: 'not_caught',
    })).toEqual({
      kind: 'infield_fly',
      batterRunnerOut: true,
      batterRunnerOutTick: 3_000_000,
      batterCreatedForceActive: false,
      ballRemainsLive: true,
      runnerState: 'advance_at_risk_without_force',
    });
  });
});
