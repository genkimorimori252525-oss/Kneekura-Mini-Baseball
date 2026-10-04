import { expect, it } from 'vitest';
import { scheduledAcquisitionRaceFixture } from './ScheduledFieldAcquisitionRace.test-support';
import { battedWorldFieldPhysicalPrefix } from './BattedWorldFieldPhysicalPrefix';
import { deriveBallWorldFieldFirstBaseRace } from '../../core/rules/BallWorldFieldFirstBaseRace';
import { openSqliteBattedWorldFieldExecutionStore } from './SqliteBattedWorldFieldExecutionStore';

it('never publishes false SAFE inside the capture fence, then proves OUT at the original secure time', () => {
  const x = scheduledAcquisitionRaceFixture();
  try {
    const planned = x.accept('race-capture-plan', { kind: 'acquisition_plan' });
    if (planned.execution.kind !== 'acquisition_plan') throw new Error('scheduled race plan fixture');
    const plan = planned.execution.plan;
    expect(plan.secureElapsedSeconds).toBe(x.secureElapsedSeconds);
    expect(plan.fenceElapsedSeconds).toBeGreaterThan(x.observationElapsedSeconds);
    expect(x.firstField.field.motion.world.moment.elapsedSeconds).toBeLessThan(plan.contactMoment.elapsedSeconds);
    const pending = x.accept('race-capture-pending', { kind: 'acquisition_advance', planSourceId: planned.source.sourceId,
      throughElapsedSeconds: x.observationElapsedSeconds });
    expect(pending.execution).toMatchObject({ kind: 'acquisition_advance', progress: { kind: 'fence_pending', acquisition: null,
      cursor: null, transport: { remainingEnergyJ: 0 } } });
    const defender = x.accept('race-pending-defender-history', { kind: 'base_touch_history', playerId: plan.acquirerPlayerId, base: 'first' });
    expect(defender.execution).toMatchObject({ kind: 'base_touch_history', controlledContacts: [], physicalRuleFacts: [],
      history: { contactAtStart: true, contactAtHorizon: true }, custodyEvidence: { status: 'bounded_unconfirmed',
        throughElapsedSeconds: x.observationElapsedSeconds, pending: [{ playerId: plan.acquirerPlayerId,
          phase: 'fence_pending', earliestPotentialControlElapsedSeconds: plan.secureElapsedSeconds }] } });
    const runner = x.accept('race-pending-runner-history', { kind: 'base_touch_history', playerId: x.batterId, base: 'first' });
    if (runner.execution.kind !== 'base_touch_history') throw new Error('scheduled runner history fixture');
    expect(runner.execution.history.events[0].elapsedSeconds).toBeCloseTo(x.runnerTouchElapsedSeconds, 12);
    expect(runner.execution.history.events[0].elapsedSeconds).toBeGreaterThan(plan.secureElapsedSeconds);
    expect(runner.execution.custodyEvidence?.status).toBe('confirmed_contacts_only');
    const observed = x.accept('race-pending-observation', { kind: 'first_base_race' });
    expect(observed.execution).toMatchObject({ kind: 'first_base_race', ballEvidence: { kind: 'grounded', territory: 'fair' },
      groundRule: null, pendingContacts: [], possessionGuard: { blocked: true, earliestPotentialControlElapsedSeconds: plan.secureElapsedSeconds } });
    if (observed.execution.kind !== 'first_base_race') throw new Error('pending race fixture');
    const physical = battedWorldFieldPhysicalPrefix({ baseField: x.baseField, fields: x.fieldPrefix, executions: x.executionPrefix });
    expect(physical.field.evidence.contacts.some((frame) => frame.moment.elapsedSeconds === plan.secureElapsedSeconds)).toBe(false);
    expect(observed.execution.ballDecisionMoment!.elapsedSeconds).toBeLessThan(plan.secureElapsedSeconds);
    const ball = physical.field.evidence;
    // Demonstrate the regression's causal gap without changing the legacy resolver's valid contract.
    const unqualified = deriveBallWorldFieldFirstBaseRace({ field: physical.field, race: {
      outsAtStart: x.response.touch.worldContact.flight.physicalPitch.frame.match.outs,
      batterRunnerId: ball.batterRunnerId, defenderIds: ball.defenderIds, originTick: ball.originTick, ticksPerSecond: ball.ticksPerSecond,
      horizonElapsedSeconds: ball.horizon.elapsedSeconds, runnerHistory: observed.execution.batterFirstBase.history,
      defenders: observed.execution.defendersFirstBase.map(({ history, controlledContacts }) => ({ history, controlledContacts })),
    } });
    expect(unqualified.groundRule?.correctRuleResult.batterRunnerFirstBase.kind).toBe('safe');
    const observedBytes = JSON.stringify(observed), defenderBytes = JSON.stringify(defender), runnerBytes = JSON.stringify(runner);
    const confirmed = x.accept('race-capture-confirmed', { kind: 'acquisition_advance', planSourceId: planned.source.sourceId,
      throughElapsedSeconds: plan.fenceElapsedSeconds });
    expect(confirmed.execution).toMatchObject({ kind: 'acquisition_advance', progress: { kind: 'secured',
      world: { moment: { elapsedSeconds: plan.fenceElapsedSeconds } }, acquisition: { moment: { elapsedSeconds: plan.secureElapsedSeconds } } } });
    const out = x.accept('race-confirmed-observation', { kind: 'first_base_race' });
    if (out.execution.kind !== 'first_base_race') throw new Error('scheduled race result fixture');
    expect(out.execution.groundRule?.correctRuleResult.batterRunnerFirstBase.kind).toBe('out');
    expect(out.execution.groundRule?.actualChronology.firstDefenderControls[0].elapsedSeconds).toBe(plan.secureElapsedSeconds);
    expect(out.execution.possessionEvidence?.pending).toEqual([]);
    expect(out.execution.possessionGuard?.blocked).toBe(false);
    const controlled = x.accept('race-confirmed-defender-history', { kind: 'base_touch_history', playerId: plan.acquirerPlayerId, base: 'first' });
    expect(controlled.execution).toMatchObject({ kind: 'base_touch_history', custodyEvidence: { status: 'confirmed_contacts_only', pending: [] } });
    if (controlled.execution.kind !== 'base_touch_history') throw new Error('confirmed history fixture');
    expect(controlled.execution.controlledContacts[0].elapsedSeconds).toBe(plan.secureElapsedSeconds);
    expect(controlled.execution.physicalRuleFacts).toHaveLength(1);
    const reopened = x.f.track(openSqliteBattedWorldFieldExecutionStore(x.f.path, x.fields));
    expect(JSON.stringify(reopened.read(observed.source.sourceId))).toBe(observedBytes);
    expect(JSON.stringify(reopened.read(defender.source.sourceId))).toBe(defenderBytes);
    expect(JSON.stringify(reopened.read(runner.source.sourceId))).toBe(runnerBytes);
    expect(JSON.stringify(x.executions.accept(observed.source.sourceId))).toBe(observedBytes);
  } finally { x.f.close(); }
});


it('retains the original uncertainty cutoff after same-tick competition later than the runner touch', () => {
  const calibration = scheduledAcquisitionRaceFixture();
  let capture;
  try {
    const planned = calibration.accept('competition-calibration-plan', { kind: 'acquisition_plan' });
    if (planned.execution.kind !== 'acquisition_plan') throw new Error('competition calibration fixture');
    capture = planned.execution.plan;
  } finally { calibration.f.close(); }
  const collisionElapsedSeconds = capture.secureElapsedSeconds + 0.0000003;
  const x = scheduledAcquisitionRaceFixture({ capture, elapsedSeconds: collisionElapsedSeconds });
  try {
    const planned = x.accept('competition-plan', { kind: 'acquisition_plan' });
    if (planned.execution.kind !== 'acquisition_plan') throw new Error('competition plan fixture');
    const plan = planned.execution.plan;
    const interrupted = x.accept('competition-interruption', { kind: 'acquisition_advance', planSourceId: planned.source.sourceId,
      throughElapsedSeconds: plan.fenceElapsedSeconds });
    expect(interrupted.execution).toMatchObject({ kind: 'acquisition_advance', progress: { kind: 'interrupted', cursor: null,
      transport: { remainingEnergyJ: 0 }, acquisition: { kind: 'interrupted', reason: 'same_tick_competition' } } });
    if (interrupted.execution.kind !== 'acquisition_advance') throw new Error('competition progress fixture');
    const contact = interrupted.execution.progress.world.moment.elapsedSeconds;
    expect(contact).toBeCloseTo(collisionElapsedSeconds, 12);
    expect(contact).toBeGreaterThan(x.runnerTouchElapsedSeconds);
    const defender = x.accept('competition-defender-history', { kind: 'base_touch_history', playerId: plan.acquirerPlayerId, base: 'first' });
    expect(defender.execution).toMatchObject({ kind: 'base_touch_history', controlledContacts: [], physicalRuleFacts: [],
      custodyEvidence: { status: 'bounded_unconfirmed', pending: [{ phase: 'contact_policy_pending',
        earliestPotentialControlElapsedSeconds: plan.secureElapsedSeconds }] } });
    const race = x.accept('competition-race', { kind: 'first_base_race' });
    expect(race.execution).toMatchObject({ kind: 'first_base_race', groundRule: null,
      ballEvidence: { kind: 'grounded', territory: 'fair' }, possessionGuard: { blocked: true,
        earliestPotentialControlElapsedSeconds: plan.secureElapsedSeconds },
      possessionEvidence: { pending: [{ phase: 'contact_policy_pending', earliestPotentialControlElapsedSeconds: plan.secureElapsedSeconds }] } });
    if (race.execution.kind !== 'first_base_race') throw new Error('competition race fixture');
    expect(race.execution.pendingContacts.every((c) => c.elapsedSeconds > x.runnerTouchElapsedSeconds)).toBe(true);
    expect(race.execution.batterFirstBase.history.events[0].elapsedSeconds).toBeLessThan(contact);
  } finally { x.f.close(); }
});

it('bounds pre-secure interruption uncertainty by its actual contact instead of the later planned deadline', () => {
  const calibration = scheduledAcquisitionRaceFixture();
  let capture;
  try {
    const planned = calibration.accept('pre-secure-calibration-plan', { kind: 'acquisition_plan' });
    if (planned.execution.kind !== 'acquisition_plan') throw new Error('pre-secure calibration fixture');
    capture = planned.execution.plan;
  } finally { calibration.f.close(); }
  const collisionElapsedSeconds = (capture.contactMoment.elapsedSeconds + capture.secureElapsedSeconds) / 2;
  const x = scheduledAcquisitionRaceFixture({ capture, elapsedSeconds: collisionElapsedSeconds });
  try {
    const planned = x.accept('pre-secure-plan', { kind: 'acquisition_plan' });
    if (planned.execution.kind !== 'acquisition_plan') throw new Error('pre-secure plan fixture');
    const plan = planned.execution.plan;
    const interrupted = x.accept('pre-secure-interruption', { kind: 'acquisition_advance', planSourceId: planned.source.sourceId,
      throughElapsedSeconds: plan.fenceElapsedSeconds });
    expect(interrupted.execution).toMatchObject({ kind: 'acquisition_advance', progress: { kind: 'interrupted', cursor: null,
      dissipationMoment: null, acquisition: { kind: 'interrupted', reason: 'contact' } } });
    if (interrupted.execution.kind !== 'acquisition_advance') throw new Error('pre-secure progress fixture');
    const contact = interrupted.execution.progress.world.moment.elapsedSeconds;
    expect(contact).toBeCloseTo(collisionElapsedSeconds, 12);
    expect(contact).toBeLessThan(plan.secureElapsedSeconds);
    expect(interrupted.execution.progress.transport.remainingEnergyJ).toBeGreaterThan(0);
    const history = x.accept('pre-secure-defender-history', { kind: 'base_touch_history', playerId: plan.acquirerPlayerId, base: 'first' });
    expect(history.execution).toMatchObject({ kind: 'base_touch_history', controlledContacts: [], physicalRuleFacts: [],
      custodyEvidence: { status: 'bounded_unconfirmed', throughElapsedSeconds: contact, pending: [{ phase: 'contact_policy_pending',
        earliestPotentialControlElapsedSeconds: contact }] } });
    const race = x.accept('pre-secure-race', { kind: 'first_base_race' });
    expect(race.execution).toMatchObject({ kind: 'first_base_race', groundRule: null,
      possessionEvidence: { throughElapsedSeconds: contact, pending: [{ phase: 'contact_policy_pending',
        earliestPotentialControlElapsedSeconds: contact }] } });
    expect(race.execution).not.toHaveProperty('playEnd');
  } finally { x.f.close(); }
});
