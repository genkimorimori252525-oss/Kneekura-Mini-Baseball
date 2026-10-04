import { expect, it } from 'vitest';
import { actualBattedWorldObservationMoment } from './ActualFieldObservation';
import { deriveCanonicalWholePlayHistory } from '../../core/sim/plateAppearance/CanonicalWholePlayHistory';
import { scheduledFixture } from '../../core/sim/plateAppearance/CanonicalWholePlayScheduledAcquisition.test-support';

it('selects executed capture or fence-pending state without granting an ordinary cursor or sampling the plan', () => {
  const x = scheduledFixture();
  expect(actualBattedWorldObservationMoment(deriveCanonicalWholePlayHistory(x.input))).toBeNull();
  const first = x.advance(null, 0.03, 2);
  const pending = deriveCanonicalWholePlayHistory({ ...x.input, steps: [...x.input.steps, first] });
  expect(pending.cursor).toBeNull();
  expect(actualBattedWorldObservationMoment(pending)).toEqual(first.progress.world.moment);
  const second = x.advance(first.progress, x.plan.secureElapsedSeconds, 3);
  const fence = deriveCanonicalWholePlayHistory({ ...x.input, steps: [...x.input.steps, first, second] });
  expect(fence.cursor).toBeNull();
  expect(actualBattedWorldObservationMoment(fence)).toEqual(second.progress.world.moment);
  const final = x.advance(second.progress, x.plan.fenceElapsedSeconds, 4);
  const confirmed = deriveCanonicalWholePlayHistory({ ...x.input, steps: [...x.input.steps, first, second, final] });
  expect(actualBattedWorldObservationMoment(confirmed)?.elapsedSeconds).toBe(x.plan.fenceElapsedSeconds);
});

it('does not sample incoming interrupted capture or use the historical dissipation moment as a response', () => {
  const x = scheduledFixture(0.0625004), pending = x.advance(null, 0.0625003, 2);
  expect(pending.progress.kind).toBe('fence_pending');
  const stopped = x.advance(pending.progress, x.plan.fenceElapsedSeconds, 3);
  expect(stopped.progress).toMatchObject({ kind: 'interrupted', cursor: null, acquisition: { reason: 'same_tick_competition' } });
  const history = deriveCanonicalWholePlayHistory({ ...x.input, steps: [...x.input.steps, pending, stopped] });
  expect(actualBattedWorldObservationMoment(history)).toBeNull();
  expect(history.horizon.elapsedSeconds).toBeGreaterThan(x.plan.secureElapsedSeconds);
  expect(history.frames.at(-1)?.occurrences.map((o) => o.phase)).toEqual(['acquisition_interrupted']);
  expect(history.frames.flatMap((frame) => frame.occurrences).some((o) => o.phase === 'acquisition_confirmed')).toBe(false);
  expect(history.carrierPlayerId).toBeNull();
});
