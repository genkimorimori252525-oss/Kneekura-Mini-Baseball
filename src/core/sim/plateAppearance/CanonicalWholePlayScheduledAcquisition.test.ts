import { expect, it } from 'vitest';
import { deriveCanonicalWholePlayHistory, type CanonicalWholePlayHistoryInput } from './CanonicalWholePlayHistory';
import { acquiredHistory, fixture, historySource } from './CanonicalWholePlayHistory.test-support';
import { scheduledFixture } from './CanonicalWholePlayScheduledAcquisition.test-support';

it('admits original capture metadata without a physical step, frame, cursor, custody, or time advance', () => {
  const f = fixture(100, 0.0625 / 0.0625001), original = acquiredHistory(f);
  const acquired = original.steps[1];
  if (acquired.kind !== 'acquisition' || acquired.acquisition.kind !== 'secured') throw new Error('secured fixture');
  const { field, acquisition } = acquired, contact = field.motion.world;
  if (contact.kind !== 'boundary' || contact.contacts[0].kind !== 'actor') throw new Error('contact fixture');
  const plan = { input: { response: f.response, geometry: f.geometry, field }, policy: 'original_energy_recorded_tick_fence_v1',
    acquirerPlayerId: acquisition.acquirerPlayerId, contactMoment: acquisition.contactMoment, retention: acquisition.retention,
    initialConstraintMoment: { ...acquisition.contactMoment, ball: { ...acquisition.contactMoment.ball,
      velocity: contact.contacts[0].velocity, spin: { x: 0, y: 0, z: 0 } } }, contactOffset: acquisition.transport.contactOffset,
    initialEnergyJ: acquisition.transport.initialEnergyJ, captureDissipationPowerW: 0.0625 / 0.0625001,
    secureElapsedSeconds: acquisition.moment.elapsedSeconds, candidateSecureTick: acquisition.candidateSecureTick,
    archivedCandidateSecureTick: acquisition.archivedCandidateSecureTick,
    fenceElapsedSeconds: (acquisition.candidateSecureTick - 100) / f.response.world.parameters.ticksPerSecond,
    coverageThroughTick: Math.min(...field.motion.actors.map((actor) => actor.primitive.endTick)) };
  const basis = original.steps[0].source, steps = [original.steps[0]];
  const before = deriveCanonicalWholePlayHistory({ ...original, steps });
  const scheduled = { source: historySource(1), previousSourceId: null, kind: 'acquisition_plan', basis,
    horizon: before.horizon, plan };
  let admitted: ReturnType<typeof deriveCanonicalWholePlayHistory> | undefined;
  expect(() => { admitted = deriveCanonicalWholePlayHistory({ ...original, steps: [...steps, scheduled] } as CanonicalWholePlayHistoryInput); }).not.toThrow();
  expect(admitted).toMatchObject({ physicalSteps: before.physicalSteps, frames: before.frames,
    horizon: before.horizon, cursor: null, carrierPlayerId: null, end: { kind: 'unestablished' } });
  expect(admitted).toHaveProperty('scheduledAcquisitionPlans', [scheduled]);
  expect(before).not.toHaveProperty('scheduledAcquisitionPlans');
});

it('keeps dissipation distinct from confirmation and retains bounded executed constraint state', () => {
  const x = scheduledFixture(), first = x.advance(null, 0.03, 2), second = x.advance(first.progress, x.plan.secureElapsedSeconds, 3);
  const partialInput = { ...x.input, steps: [...x.input.steps, first] }, partial = deriveCanonicalWholePlayHistory(partialInput);
  expect(partial.cursor).toBeNull();
  expect(partial.carrierPlayerId).toBeNull();
  expect(partial.horizon).toEqual(first.progress.world.moment);
  const phases = (input: ReturnType<typeof deriveCanonicalWholePlayHistory>) => input.frames.flatMap((frame) => frame.occurrences.map((o) => o.phase));
  expect(phases(partial).slice(-2)).toEqual(['acquisition_constraint_started', 'acquisition_progress']);
  const pendingInput = { ...x.input, steps: [...x.input.steps, first, second] }, pending = deriveCanonicalWholePlayHistory(pendingInput);
  expect(second.progress.kind).toBe('fence_pending');
  expect(pending.cursor).toBeNull();
  expect(phases(pending).filter((phase) => phase === 'acquisition_dissipation_complete')).toHaveLength(1);
  const final = x.advance(second.progress, x.plan.fenceElapsedSeconds, 4);
  const history = deriveCanonicalWholePlayHistory({ ...x.input, steps: [...pendingInput.steps, final] });
  expect(history.horizon.elapsedSeconds).toBe(x.plan.fenceElapsedSeconds);
  expect(history.cursor?.moment).toEqual(final.progress.world.moment);
  expect(history.carrierPlayerId).toBe(x.plan.acquirerPlayerId);
  expect(phases(history).filter((phase) => phase === 'acquisition_constraint_started')).toHaveLength(1);
  expect(phases(history).filter((phase) => phase === 'acquisition_dissipation_complete')).toHaveLength(1);
  expect(phases(history).at(-1)).toBe('acquisition_confirmed');
  expect(history.end).toEqual({ kind: 'unestablished' });
  expect(pending.cursor).toBeNull();
});
it('emits an exact reached dissipation frame before confirmation in one execution without rewinding its horizon', () => {
  const x = scheduledFixture(), final = x.advance(null, x.plan.fenceElapsedSeconds, 2);
  const history = deriveCanonicalWholePlayHistory({ ...x.input, steps: [...x.input.steps, final] });
  const frames = history.frames.filter((frame) => frame.occurrences.some((o) => o.phase.startsWith('acquisition_')));
  expect(frames.map((frame) => [frame.elapsedSeconds, frame.occurrences.filter((o) => o.phase.startsWith('acquisition_')).map((o) => o.phase)]))
    .toEqual([[0, ['acquisition_constraint_started']], [x.plan.secureElapsedSeconds, ['acquisition_dissipation_complete']],
      [x.plan.fenceElapsedSeconds, ['acquisition_confirmed']]]);
});
it.each(['wrong_plan', 'wrong_start', 'wrong_candidate', 'fake_cursor', 'repeated_checkpoint', 'extra_progress'] as const)(
  'rejects %s scheduled capture lineage instead of adopting incomplete physical history', (kind) => {
    const x = scheduledFixture(), first = x.advance(null, 0.03, 2), second = x.advance(first.progress, x.plan.secureElapsedSeconds, 3);
    const changed = kind === 'wrong_plan' ? { ...second, planSourceId: 'other' }
      : kind === 'wrong_start' ? { ...second, progress: { ...second.progress, startMoment: x.plan.contactMoment } }
        : kind === 'wrong_candidate' ? { ...second, field: { ...second.field, baseContacts: ['fake'] } }
          : kind === 'fake_cursor' ? { ...second, progress: { ...second.progress, cursor: { moment: second.progress.world.moment, previousContacts: [] } } }
            : kind === 'repeated_checkpoint' ? { ...second, progress: { ...second.progress, checkpointElapsedSeconds: [x.plan.secureElapsedSeconds] } }
              : { ...second, progress: { ...second.progress, controlled: true } };
    expect(() => deriveCanonicalWholePlayHistory({ ...x.input, steps: [...x.input.steps, first, changed] } as CanonicalWholePlayHistoryInput)).toThrow();
  });

it('keeps observation metadata outside executed phases and rejects restarting an interrupted candidate', () => {
  const x = scheduledFixture(0.0625004), partial = x.advance(null, 0.0625003, 2);
  const before = deriveCanonicalWholePlayHistory({ ...x.input, steps: [...x.input.steps, partial] });
  const observed = { source: historySource(3), previousSourceId: partial.source.sourceId, kind: 'observation' as const,
    observationKind: 'whole_play_history' as const, basis: partial.source, horizon: before.horizon };
  const pending = deriveCanonicalWholePlayHistory({ ...x.input, steps: [...x.input.steps, partial, observed] });
  expect(pending.frames).toEqual(before.frames);
  expect(pending.physicalSteps).toEqual(before.physicalSteps);
  const stopped = { ...x.advance(partial.progress, x.plan.fenceElapsedSeconds, 4), previousSourceId: observed.source.sourceId };
  const interruptedInput = { ...x.input, steps: [...x.input.steps, partial, observed, stopped] };
  const interrupted = deriveCanonicalWholePlayHistory(interruptedInput);
  expect(interrupted.cursor).toBeNull();
  expect(interrupted.horizon).toEqual(stopped.progress.world.moment);
  const admission = x.input.steps[1];
  if (admission.kind !== 'acquisition_plan') throw new Error('plan fixture');
  const restart = { ...admission, source: historySource(5), previousSourceId: stopped.source.sourceId, basis: stopped.source,
    horizon: interrupted.horizon };
  expect(() => deriveCanonicalWholePlayHistory({ ...interruptedInput, steps: [...interruptedInput.steps, restart] })).toThrow();
});
