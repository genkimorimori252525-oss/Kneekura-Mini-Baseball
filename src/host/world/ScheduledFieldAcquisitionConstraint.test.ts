import { expect, it } from 'vitest';
import { scheduledConstraintGroundFixture } from './ScheduledFieldAcquisitionConstraint.test-support';
import { battedWorldFieldPhysicalPrefix } from './BattedWorldFieldPhysicalPrefix';
import { wholePlayPhysicalHistoryFromPrefix } from './WholePlayPhysicalHistoryFromPrefix';
import { actualBattedWorldObservationMoment } from './ActualFieldObservation';
import { installSyntheticObservation } from './ActualFieldObservationFixtures.test-support';

it('retains a real same-time first-constraint ground interruption without rewriting incoming contact or inventing control', () => {
  const x = scheduledConstraintGroundFixture();
  try {
    const input = () => ({ baseField: x.baseField, fields: x.ownFields, executions: x.prefix });
    const before = battedWorldFieldPhysicalPrefix(input()), incoming = before.field.evidence.horizon;
    expect(incoming.ball.velocity.y).toBe(0);
    expect(before.field.evidence.contacts[0].contacts).toEqual([{ kind: 'ground' }]);
    expect(before.field.evidence.contacts[0].moment.elapsedSeconds).toBeLessThan(incoming.elapsedSeconds);
    const planned = x.accept('constraint-ground-plan', { kind: 'acquisition_plan' });
    if (planned.execution.kind !== 'acquisition_plan') throw new Error('constraint plan fixture');
    const plan = planned.execution.plan;
    expect(plan.initialConstraintMoment.ball.velocity.y).toBe(-1);
    const stopped = x.accept('constraint-ground-advance', { kind: 'acquisition_advance', planSourceId: planned.source.sourceId,
      throughElapsedSeconds: plan.fenceElapsedSeconds });
    if (stopped.execution.kind !== 'acquisition_advance' || stopped.execution.progress.kind !== 'interrupted') throw new Error('constraint interruption fixture');
    const progress = stopped.execution.progress;
    expect(progress.acquisition.reason).toBe('contact');
    expect(progress.world.moment.elapsedSeconds).toBe(incoming.elapsedSeconds);
    expect(progress.world.moment.ball.velocity.y).toBe(-1);
    expect(progress.acquisition.world.contacts.some((contact) => contact.kind === 'ground')).toBe(true);
    expect(progress.acquisition.world.contacts.some((contact) => contact.kind === 'actor' && contact.role === 'glove' && contact.continuing)).toBe(true);
    let physical: ReturnType<typeof battedWorldFieldPhysicalPrefix> | undefined;
    expect(() => { physical = battedWorldFieldPhysicalPrefix(input()); }).not.toThrow();
    expect(physical?.field.evidence.contacts.at(-1)?.moment).toEqual(incoming);
    expect(physical?.field.evidence.contacts.at(-1)?.contacts).toEqual(expect.arrayContaining([{ kind: 'ground' }, { kind: 'actor', playerId: plan.acquirerPlayerId, role: 'glove' }]));
    expect(physical?.field.evidence.acquisitions).toEqual([progress.acquisition]);
    expect(physical?.controlWindows).toEqual([]);
    expect(physical?.possessionEvidence?.pending).toMatchObject([{ phase: 'contact_policy_pending', earliestPotentialControlElapsedSeconds: incoming.elapsedSeconds }]);
    for (const badProgress of [
      { ...progress, world: { ...progress.world, moment: incoming } },
      { ...progress, acquisition: { ...progress.acquisition, contactMoment: plan.initialConstraintMoment } },
      { ...progress, baseContacts: [{ kind: 'base', baseId: 'first', moment: progress.world.moment,
        point: progress.world.moment.ball.position, normal: { x: 0, y: 1, z: 0 } }] },
      { ...progress, world: { ...progress.world, contacts: progress.acquisition.world.contacts.filter((contact) => contact.kind !== 'ground') } },
    ]) {
      const forged = { ...stopped, execution: { ...stopped.execution, progress: badProgress } } as typeof stopped;
      expect(() => battedWorldFieldPhysicalPrefix({ ...input(), executions: [planned, forged] })).toThrow();
    }
    const badPlan = { ...planned, execution: { ...planned.execution, plan: { ...plan, initialConstraintMoment: incoming } } };
    expect(() => battedWorldFieldPhysicalPrefix({ ...input(), executions: [badPlan, stopped] })).toThrow();
    const observer = installSyntheticObservation(x, plan.acquirerPlayerId, stopped.source.sourceId);
    const perceived = observer.observations.accept(observer.observationSource.sourceId), receiptBytes = JSON.stringify(perceived);
    expect(perceived.receipt.results.find((result) => result.target.kind === 'ball')?.status).toBe('physical_state_unavailable');
    expect(perceived.receipt.samples.ball).toBeNull();
    const view = x.accept('constraint-ground-history', { kind: 'whole_play_history' });
    if (view.execution.kind !== 'whole_play_history') throw new Error('constraint history fixture');
    const history = wholePlayPhysicalHistoryFromPrefix(input());
    expect(actualBattedWorldObservationMoment(history)).toBeNull();
    expect(view.execution.physicalHistory.physicalSteps.at(-1)).toMatchObject({ kind: 'acquisition_advance', progress });
    expect(history.end.kind).toBe('unestablished');
    const race = x.accept('constraint-ground-race', { kind: 'first_base_race' });
    expect(race.execution).toMatchObject({ kind: 'first_base_race', groundRule: null,
      possessionEvidence: { pending: [{ phase: 'contact_policy_pending', earliestPotentialControlElapsedSeconds: incoming.elapsedSeconds }] } });
    expect(JSON.stringify(x.executions.read(stopped.source.sourceId))).toBe(JSON.stringify(stopped));
    expect(JSON.stringify(observer.observations.read(observer.observationSource.sourceId))).toBe(receiptBytes);
  } finally { x.f.close(); }
});
