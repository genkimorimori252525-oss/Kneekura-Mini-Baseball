import { expect, it } from 'vitest';
import { battedWorldFieldExecutionFixture } from './BattedWorldFieldExecutionFixtures.test-support';
import { openSqliteBattedWorldFieldExecutionStore, type AcceptedBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';

it('owns the original field foot history without inventing custody or advancing the physical horizon', () => {
  const x = battedWorldFieldExecutionFixture();
  try {
    const batter = x.response.touch.worldContact.flight.physicalPitch.frame.batterActor!.binding;
    const source: AcceptedBattedWorldFieldExecution = { ...x.source, sourceId: 'field-batter-base-history',
      action: { kind: 'base_touch_history', playerId: batter.playerId, base: 'first' } };
    x.sources.set(source.sourceId, source);
    const value = x.executions.accept(source.sourceId);
    if (value.execution.kind !== 'base_touch_history') throw new Error('field history observation');
    expect(value.execution.history.playerId).toBe(batter.playerId);
    expect(value.execution.history.startElapsedSeconds).toBe(0);
    expect(value.execution.history.endElapsedSeconds).toBe(x.baseField.field.motion.world.moment.elapsedSeconds);
    expect(value.execution.controlledContacts).toEqual([]);
    expect(value.execution.field).toEqual(x.baseField.field);
    expect(value.execution).not.toHaveProperty('playEnd');
    const reopened = x.f.track(openSqliteBattedWorldFieldExecutionStore(x.f.path, x.fields));
    expect(reopened.read(source.sourceId)).toEqual(value);
    expect(reopened.accept(source.sourceId)).toEqual(value);
  } finally { x.f.close(); }
});

it('preserves actual acquisition and custody across first-base observations and later carried motion', () => {
  const x = battedWorldFieldExecutionFixture(undefined, 'candidate');
  try {
    const before: AcceptedBattedWorldFieldExecution = { ...x.source, sourceId: 'field-race-before', action: { kind: 'first_base_race' } };
    x.sources.set(before.sourceId, before); const pending = x.executions.accept(before.sourceId);
    const acquire: AcceptedBattedWorldFieldExecution = { ...x.source, previousExecutionSourceId: before.sourceId };
    x.sources.set(acquire.sourceId, acquire); const acquired = x.executions.accept(acquire.sourceId);
    if (acquired.execution.kind !== 'acquisition' || acquired.execution.acquisition.kind !== 'secured') throw new Error('field actual acquisition');
    const after: AcceptedBattedWorldFieldExecution = { ...before, sourceId: 'field-race-after', previousExecutionSourceId: acquired.source.sourceId };
    x.sources.set(after.sourceId, after); const observed = x.executions.accept(after.sourceId);
    if (observed.execution.kind !== 'first_base_race') throw new Error('field actual race');
    expect(observed.execution.ballEvidence.kind).toBe('fly_catch');
    expect(observed.execution.groundRule).toBeNull();
    const capture = acquired.execution.acquisition;
    const move: AcceptedBattedWorldFieldExecution = { ...x.source, sourceId: 'field-carry-after-observations', previousExecutionSourceId: observed.source.sourceId,
      action: { kind: 'motion', availableAtTick: capture.secureTick, throughTick: capture.secureTick + 1000, commands: x.fieldSource.commands } };
    x.sources.set(move.sourceId, move); const moved = x.executions.accept(move.sourceId);
    expect(moved.execution.field.motion.carrierPlayerId).toBe(capture.acquirerPlayerId);
    expect(moved.execution.field.motion.response.kind).toBe('carried');
    expect(x.executions.read(before.sourceId)).toEqual(pending);
    expect(x.executions.read(after.sourceId)).toEqual(observed);
    expect(observed.execution).not.toHaveProperty('officialClosure');
  } finally { x.f.close(); }
});

it.each([[0.04, 0.08, 'out'], [0.08, 0.04, 'safe']] as const)('derives actual field ground race %s/%s early %s without a future arrival', async (defenderSeconds, batterSeconds, expected) => {
  const { battedWorldFieldRaceFixture } = await import('./BattedWorldFieldRaceFixtures.test-support');
  const x = battedWorldFieldRaceFixture(undefined, defenderSeconds, batterSeconds);
  try {
    const value = x.executions.accept(x.source.sourceId);
    if (value.execution.kind !== 'first_base_race') throw new Error('field actual race');
    expect(value.execution.fieldTerritory).toMatchObject({ kind: 'resolved', territory: 'fair' });
    expect(value.execution.ballEvidence.kind).toBe('grounded');
    const rule = value.execution.groundRule;
    expect(rule?.correctRuleResult).toMatchObject({ kind: 'resolved', batterRunnerFirstBase: { kind: expected } });
    expect(rule?.physicalFacts[expected === 'out' ? 'batterRunnerTouch' : 'defenderControl']).toBeNull();
    expect(value.execution.batterFirstBase.history.startElapsedSeconds).toBe(0);
    expect(value.execution.batterFirstBase.history.endElapsedSeconds).toBe(x.moved.execution.field.motion.world.moment.elapsedSeconds);
    expect(value.execution.defendersFirstBase).toHaveLength(x.batter.defenderBindings.length);
    expect(x.executions.read(value.source.sourceId)).toEqual(value);
    const reopened = x.f.track(openSqliteBattedWorldFieldExecutionStore(x.f.path, x.fields));
    expect(reopened.read(value.source.sourceId)).toEqual(value);
    expect(value.execution).not.toHaveProperty('officialClosure');
    expect(value.execution).not.toHaveProperty('playEnd');
  } finally { x.f.close(); }
});

it('keeps bag-established fair territory separate from the missing actual ground required for a race', () => {
  const x = battedWorldFieldExecutionFixture();
  try {
    const source: AcceptedBattedWorldFieldExecution = { ...x.source, sourceId: 'field-bag-only-rule', action: { kind: 'first_base_race' } };
    x.sources.set(source.sourceId, source); const value = x.executions.accept(source.sourceId);
    if (value.execution.kind !== 'first_base_race') throw new Error('actual bag rule');
    expect(value.execution.fieldTerritory).toMatchObject({ kind: 'resolved', territory: 'fair', basis: 'base_contact' });
    expect(value.execution.firstGroundMoment).toBeNull();
    expect(value.execution.ballEvidence).toMatchObject({ kind: 'unresolved', reason: 'ground_contact_pending' });
    expect(value.execution.groundRule).toBeNull();
  } finally { x.f.close(); }
});

it('does not turn future foot motor targets into actual first-base arrivals', async () => {
  const { battedWorldFieldRaceFixture } = await import('./BattedWorldFieldRaceFixtures.test-support');
  const x = battedWorldFieldRaceFixture(undefined, 0.08, 0.08, 0.01);
  try {
    const value = x.executions.accept(x.source.sourceId);
    if (value.execution.kind !== 'first_base_race') throw new Error('actual early rule');
    expect(value.execution.groundRule?.correctRuleResult).toMatchObject({ kind: 'unresolved', batterRunnerFirstBase: { reason: 'no_first_base_event' } });
    expect(value.execution.groundRule?.actualChronology.decisionMoment).toBeNull();
    expect(value.execution.batterFirstBase.history.events).toEqual([]);
    expect(value.execution.defendersFirstBase.flatMap((d) => d.controlledContacts)).toEqual([]);
  } finally { x.f.close(); }
});
