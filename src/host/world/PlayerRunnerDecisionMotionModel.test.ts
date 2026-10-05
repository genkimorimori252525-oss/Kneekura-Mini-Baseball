import { expect, it } from 'vitest';
import * as models from './SqlitePlayerDecisionModelStore';
import { requireRunnerDecisionMotionModel, runnerDecisionMotionModelFixture } from './PlayerRunnerDecisionMotionModelContracts.test-support';
import { decideRunnerMotionIntent, type RunnerDecisionInput } from '../../core/sim/running/RunnerDecision';
import { advanceRunnerMotion } from '../../core/sim/running/RunnerMotion';

it('freezes exact explicit runner parameters and original Person without creating or borrowing a defender model', () => {
  const x = runnerDecisionMotionModelFixture();
  try {
    const own = requireRunnerDecisionMotionModel(models, x.db), value = own.derive(x.source);
    expect(value).toEqual({ source: x.source, person: x.person });
    expect(Object.isFrozen(value.source.decision.timingParameters)).toBe(true); expect(Object.isFrozen(value.source.motion)).toBe(true);
    expect(x.db.prepare('SELECT count(*) AS n FROM world_player_fielding_models').get()!.n).toBe(0);
    expect(x.db.prepare("SELECT name FROM sqlite_master WHERE name='world_player_runner_decision_motion_models'").all()).toEqual([]);
    for (const key of ['receipt', 'knownContext', 'perceivedCues', 'decision', 'motionIntent', 'controller']) expect(value).not.toHaveProperty(key);
  } finally { x.close(); }
});

it.each(['advance', 'hold', 'retreat', 'slide'] as const)('retains Core-equivalent %s choice and motion with explicit synthetic knowledge only', action => {
  const x = runnerDecisionMotionModelFixture();
  try {
    const own = requireRunnerDecisionMotionModel(models, x.db), value = own.derive(x.source);
    // This is Core parameter interoperability, not a Native knowledge-consumption receipt.
    const information: Pick<RunnerDecisionInput, 'runnerId' | 'perceivedWorld' | 'perceivedCues'> = {
      runnerId: x.source.playerId, perceivedWorld: { observerId: x.source.playerId, observationTime: 1_000_000,
        attention: { target: { kind: 'base', base: 2 }, focusedSinceTick: 900_000 }, ball: null, players: [],
        knownContext: { currentBase: 1, nextBase: 2, forcedToAdvance: false, tagUp: { kind: 'none' } },
        communications: [{ event: { sourceId: 'synthetic-coach', kind: 'coach_signal', issuedAt: 900_000,
          targetScope: { kind: 'player', playerId: x.source.playerId }, content: { kind: 'runner_action', action } }, receivedAt: 980_000, confidence: 1 }] },
      perceivedCues: [],
    };
    const decision = decideRunnerMotionIntent({ ...information, ...value.source.decision });
    expect(decision).toEqual(decideRunnerMotionIntent({ ...information, ...x.source.decision }));
    expect(decision.motionIntent.kind).toBe(action); expect(decision.reason).toBe('coach_instruction');
    const start = { tick: 1_000_000, routeDistanceMeters: 5, speedMps: 2, driveDirection: 1 as const, bodyMode: 'upright' as const };
    expect(advanceRunnerMotion(start, decision.motionIntent, 500_000, value.source.motion))
      .toEqual(advanceRunnerMotion(start, decision.motionIntent, 500_000, x.source.motion));
  } finally { x.close(); }
});

const invalid = [
  ['minimumCueConfidence', -0.1], ['minimumCueConfidence', 1.1], ['coachTrust', NaN], ['coachTrust', Infinity],
  ['decisionAbility', -1], ['decisionAbility', 2], ['minimumAdvanceSafetyMarginTicks', -1], ['minimumAdvanceSafetyMarginTicks', 0.5],
  ['minimumDecisionDelayTicks', -1], ['maximumDecisionDelayTicks', 1], ['fixedRecognitionOffsetTicks', 0.5],
  ['ticksPerSecond', 0], ['ticksPerSecond', 1.5], ['reactionDelayTicks', -1], ['reactionDelayTicks', 0.25],
  ['accelerationMps2', 0], ['brakingMps2', -1], ['slideDecelerationMps2', NaN], ['topSpeedMps', Infinity],
] as const;
it.each(invalid)('rejects invalid %s=%s without defaulting a runner parameter', (key, value) => {
  const x = runnerDecisionMotionModelFixture();
  try {
    const own = requireRunnerDecisionMotionModel(models, x.db); expect(own.derive(x.source).source).toEqual(x.source);
    const source: any = structuredClone(x.source);
    if (key in source.decision.timingParameters) source.decision.timingParameters[key] = value;
    else if (key in source.decision) source.decision[key] = value;
    else source.motion[key] = value;
    expect(() => own.derive(source)).toThrow();
  } finally { x.close(); }
});

it.each(['decision_overflow', 'combined_motor_overflow', 'defender_timing', 'defender_capability', 'hidden_knowledge', 'hidden_command'] as const)
('rejects %s without creating live decision evidence', mutation => {
  const x = runnerDecisionMotionModelFixture();
  try {
    const own = requireRunnerDecisionMotionModel(models, x.db); expect(own.derive(x.source).source).toEqual(x.source);
    const source: any = structuredClone(x.source);
    if (mutation === 'decision_overflow') Object.assign(source.decision.timingParameters,
      { minimumDecisionDelayTicks: Number.MAX_SAFE_INTEGER, maximumDecisionDelayTicks: Number.MAX_SAFE_INTEGER });
    if (mutation === 'combined_motor_overflow') source.motion.reactionDelayTicks = Number.MAX_SAFE_INTEGER;
    if (mutation === 'defender_timing') { delete source.decision.timingParameters.fixedRecognitionOffsetTicks; source.decision.timingParameters.fixedProcessingOffsetTicks = 10_000; }
    if (mutation === 'defender_capability') source.capability = 'defender_locomotion_v1';
    if (mutation === 'hidden_knowledge') source.decision.knownContext = { forcedToAdvance: false, tagUp: { kind: 'none' } };
    if (mutation === 'hidden_command') source.motion.intent = { kind: 'hold', issuedTick: 0 };
    expect(() => own.derive(source)).toThrow();
  } finally { x.close(); }
});

it.each(['careerId', 'playerId', 'personLinkSourceId', 'acceptedAtDay'] as const)('rejects foreign or premature %s provenance', key => {
  const x = runnerDecisionMotionModelFixture();
  try {
    const own = requireRunnerDecisionMotionModel(models, x.db); expect(own.derive(x.source).person).toEqual(x.person);
    expect(() => own.derive({ ...x.source, [key]: key === 'acceptedAtDay' ? x.person.acceptedAtDay - 1 : 'foreign' })).toThrow();
  } finally { x.close(); }
});

it('rejects nested parameter accessors without calling them', () => {
  const x = runnerDecisionMotionModelFixture();
  try {
    const own = requireRunnerDecisionMotionModel(models, x.db); expect(own.derive(x.source).source).toEqual(x.source);
    const source = structuredClone(x.source); let calls = 0;
    Object.defineProperty(source.motion, 'topSpeedMps', { enumerable: true, get() { calls += 1; return 8; } });
    expect(() => own.derive(source)).toThrow(/accessor|inert/); expect(calls).toBe(0);
  } finally { x.close(); }
});
