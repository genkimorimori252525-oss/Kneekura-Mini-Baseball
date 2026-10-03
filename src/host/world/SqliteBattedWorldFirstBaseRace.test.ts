import { expect, it } from 'vitest';
import { battedWorldFirstBaseRaceFixture } from './BattedWorldFirstBaseRaceFixtures.test-support';
import { battedWorldRunnerContactFixture } from './BattedWorldRunnerContactFixtures.test-support';
import { openSqliteBattedWorldExecutionStore, type AcceptedBattedWorldExecution } from './SqliteBattedWorldExecutionStore';

it.each([[0.04, 0.08, 'out'], [0.08, 0.04, 'safe']] as const)('resolves the %s/%s actual early %s before the other participant ever arrives', (defenderAt, batterAt, expected) => {
  const g = battedWorldFirstBaseRaceFixture(undefined, defenderAt, batterAt);
  try {
    const value = g.executions.accept(g.source.sourceId);
    if (value.execution.kind !== 'first_base_race') throw new Error('actual first-base race fixture');
    const race = value.execution.groundRule;
    expect(value.execution.ballEvidence).toMatchObject({ kind: 'grounded', territory: 'fair' });
    expect(race?.correctRuleResult).toMatchObject({ kind: 'resolved', batterRunnerFirstBase: { kind: expected } });
    expect(race?.physicalFacts[expected === 'out' ? 'batterRunnerTouch' : 'defenderControl']).toBe(null);
    expect(race?.correctRuleResult.batterRunnerFirstBase).toMatchObject(expected === 'out' ? { runnerTouchTick: null } : { defenderControlTick: null });
    expect(value.execution.motion).toEqual(g.moved.execution.motion);
    expect(value.execution).not.toHaveProperty('officialClosure');
    const old: AcceptedBattedWorldExecution = { ...g.source, sourceId: 'legacy-rule-after-early-race', previousExecutionSourceId: g.source.sourceId,
      action: { kind: 'first_base_rule', geometrySourceId: g.geometrySource.sourceId } };
    g.sources.set(old.sourceId, old); const legacy = g.executions.accept(old.sourceId);
    if (legacy.execution.kind !== 'first_base_rule') throw new Error('legacy first-base rule fixture');
    expect(legacy.execution.groundRule?.correctRuleResult.kind).toBe('unresolved');
    expect(legacy.execution).not.toHaveProperty('ballDecisionMoment');
    expect(legacy.execution).not.toHaveProperty('actualChronology');
    expect(g.executions.read(value.source.sourceId)).toEqual(value);
    const reopened = g.f.track(openSqliteBattedWorldExecutionStore(g.f.path, g.motions));
    expect(reopened.read(value.source.sourceId)).toEqual(value);
    expect(reopened.read(old.sourceId)).toEqual(legacy);
  } finally { g.f.close(); }
});
it('does not create a first-base result from an empty actual contact history', () => {
  const g = battedWorldFirstBaseRaceFixture(undefined, 0.08, 0.08, 0.01);
  try {
    const value = g.executions.accept(g.source.sourceId);
    if (value.execution.kind !== 'first_base_race') throw new Error('actual first-base race fixture');
    expect(value.execution.groundRule?.correctRuleResult).toMatchObject({ kind: 'unresolved', batterRunnerFirstBase: { reason: 'no_first_base_event' } });
    expect(value.execution.groundRule?.actualChronology.decisionMoment).toBe(null);
    expect(value.execution).not.toHaveProperty('playEnd');
  } finally { g.f.close(); }
});
it('orders actual foot/control moments even when their recorded ticks coincide', () => {
  const g = battedWorldFirstBaseRaceFixture(undefined, 0.04, 0.0400001);
  try {
    const value = g.executions.accept(g.source.sourceId);
    if (value.execution.kind !== 'first_base_race') throw new Error('actual first-base race fixture');
    const race = value.execution.groundRule;
    expect(race?.physicalFacts.defenderControl?.tick).toBe(race?.physicalFacts.batterRunnerTouch?.tick);
    expect(race!.actualChronology.firstDefenderControls[0].elapsedSeconds).toBeLessThan(race!.actualChronology.runnerTouch!.elapsedSeconds);
    expect(race?.correctRuleResult.batterRunnerFirstBase.kind).toBe('out');
    expect(g.executions.read(g.source.sourceId)).toEqual(value);
  } finally { g.f.close(); }
});
it('preserves actual capture and custody when race observations surround security', () => {
  const g = battedWorldRunnerContactFixture(undefined, 'ground_candidate');
  try {
    const before: AcceptedBattedWorldExecution = { ...g.source, sourceId: 'race-before-security', action: { kind: 'first_base_race', geometrySourceId: g.geometrySource.sourceId } };
    g.sources.set(before.sourceId, before); const pending = g.executions.accept(before.sourceId);
    const acquire: AcceptedBattedWorldExecution = { ...g.source, sourceId: 'race-observation-actual-pickup', previousExecutionSourceId: before.sourceId, action: { kind: 'acquisition' } };
    g.sources.set(acquire.sourceId, acquire); const acquired = g.executions.accept(acquire.sourceId);
    if (acquired.execution.kind !== 'acquisition' || acquired.execution.acquisition.kind !== 'secured') throw new Error('actual secured pickup fixture');
    const after = { ...before, sourceId: 'race-after-security', previousExecutionSourceId: acquire.sourceId };
    g.sources.set(after.sourceId, after); g.executions.accept(after.sourceId);
    const secure = acquired.execution.acquisition.moment;
    const move: AcceptedBattedWorldExecution = { ...g.source, sourceId: 'motion-after-race-security', previousExecutionSourceId: after.sourceId,
      action: { kind: 'motion', availableAtTick: secure.ball.tick, throughTick: secure.ball.tick + 10_000, commands: g.motionSource.commands } };
    g.sources.set(move.sourceId, move); const actual = g.executions.accept(move.sourceId);
    expect(actual.execution.motion.carrierPlayerId).toBe(acquired.execution.acquisition.acquirerPlayerId);
    expect(g.executions.read(before.sourceId)).toEqual(pending);
  } finally { g.f.close(); }
});
it('keeps new race observations separate from actual airborne catch priority and subsequent custody', () => {
  const g = battedWorldRunnerContactFixture(undefined, 'carried');
  try {
    const source: AcceptedBattedWorldExecution = { ...g.source, sourceId: 'catch-priority-race', action: { kind: 'first_base_race', geometrySourceId: g.geometrySource.sourceId } };
    g.sources.set(source.sourceId, source); const value = g.executions.accept(source.sourceId);
    if (value.execution.kind !== 'first_base_race') throw new Error('actual first-base race fixture');
    expect(value.execution.ballEvidence.kind).toBe('fly_catch');
    expect(value.execution.groundRule).toBe(null);
    const sourceMotion = { ...g.source, sourceId: 'actual-motion-after-race', previousExecutionSourceId: source.sourceId,
      action: { kind: 'motion' as const, availableAtTick: g.motion.motion.world.moment.ball.tick, throughTick: g.motion.motion.world.moment.ball.tick + 10_000, commands: g.motionSource.commands } };
    g.sources.set(sourceMotion.sourceId, sourceMotion); const actual = g.executions.accept(sourceMotion.sourceId);
    expect(actual.execution.motion.carrierPlayerId).toBe(g.motion.motion.carrierPlayerId);
    expect(g.executions.read(source.sourceId)).toEqual(value);
  } finally { g.f.close(); }
});
it.each(['desired_out', 'desired_fair', 'runner_touch', 'defender_control', 'geometry'])('rejects caller %s outside owned race Source', (kind) => {
  const g = battedWorldRunnerContactFixture();
  try {
    const source: AcceptedBattedWorldExecution = { ...g.source, sourceId: 'invalid-first-base-race', action: { kind: 'first_base_race', geometrySourceId: g.geometrySource.sourceId } };
    const action = kind === 'geometry' ? { ...source.action, geometrySourceId: 'missing' } : { ...source.action, [kind]: true };
    g.sources.set(source.sourceId, { ...source, action });
    expect(() => g.executions.accept(source.sourceId)).toThrow();
    expect(g.executions.read(source.sourceId)).toBe(null);
  } finally { g.f.close(); }
});
