import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect, it } from 'vitest';

const source = readFileSync('tools/browser-bridge/field-workbench-v98.js', 'utf8');
// Exercise the exact pure helper embedded in the offline UI, without a DOM.
const display = runInNewContext('(' + source.slice(source.indexOf('function throwEffortDisplayV103('), source.indexOf(' function throwEffortAtSourceFrameV103(')).trim() + ')');
const observe = runInNewContext('(' + source.slice(source.indexOf('function throwEffortAtSourceFrameV103('), source.indexOf(' function metrics(')).trim() + ')', { throwEffortDisplayV103: display });
const command = { playerId: 'one', from: 4, chargeFrom: 4, readyAt: 5, effort: .5, commandSpeedMps: 30,
  capacitySpeedMps: 60, fullChargeSeconds: 2, requiredChargeSeconds: 1, plannedFlightSeconds: .75,
  plannedArrivalAtSeconds: 5.75, plannedControlAtSeconds: 5.85, runnerDeadlineAtSeconds: 6, receiverReadyAtSeconds: 5.3,
  target: { x: 2, y: 1, z: 3 }, reason: 'LEAST_EFFORT_MEETS_DEADLINE' };
const input = { commands: [command], facts: [{ kind: 'catch_secured', playerId: 'one', elapsedSeconds: 3.5 }],
  elapsedSeconds: 4.25, playerId: 'one', possessedBy: 'one' };

it('displays only issued commands in the current custody and never inspects a future payload', () => {
  const future = { from: 10, get playerId(): never { throw Error('future player read'); },
    get target(): never { throw Error('future target read'); } };
  expect(display({ ...input, commands: [future, command] })).toMatchObject({ progress: .25, remainingSeconds: .75, effortLabel: '50.0%', marginSeconds: expect.closeTo(.15) });
  expect(display({ ...input, elapsedSeconds: 3.9 })).toBeNull();
  expect(display({ ...input, possessedBy: 'other' })).toBeNull();
  expect(display({ ...input, facts: [...input.facts, { kind: 'catch_secured', playerId: 'one', elapsedSeconds: 4.1 }] })).toBeNull();
});

it('uses the retained charge start across replans, zero duration, cancellation and seek', () => {
  const revised = { ...command, from: 4.2, chargeFrom: 4 };
  expect(display({ ...input, commands: [command, revised] })).toMatchObject({ commandFrom: 4.2, progress: .25 });
  expect(display({ ...input, commands: [{ ...command, requiredChargeSeconds: 0, readyAt: 4 }] })).toMatchObject({ progress: 1, remainingSeconds: 0 });
  const cancellations = [{ playerId: 'one', from: 4.2, commandFrom: 4, reason: 'changed' }];
  expect(display({ ...input, cancellations })).toBeNull();
  expect(display({ ...input, cancellations, elapsedSeconds: 4.1 })).toMatchObject({ commandFrom: 4, progress: expect.closeTo(.1) });
  expect(display({ ...input, commands: [command, revised], cancellations })).toMatchObject({ commandFrom: 4.2 });
});

it('shows tiny nonzero effort truthfully without reading a huge capacity or inventing arrival', () => {
  const huge = { ...command, effort: 1e-9, get capacitySpeedMps(): never { throw Error('capacity is not actual output'); } };
  expect(display({ ...input, commands: [huge] })).toMatchObject({ effortLabel: '<0.1%', commandSpeedMps: 30 });
  expect(display({ ...input, commands: [{ ...command, effort: 0 }] })).toMatchObject({ effortLabel: '0.0%' });
  expect(display({ ...input, commands: [{ ...command, plannedArrivalAtSeconds: undefined, plannedControlAtSeconds: undefined }] })).toMatchObject({ arrivalSeconds: null, controlSeconds: null, marginSeconds: null });
});

it('uses the floored displayed Source frame for continuous seeks, including command and cancellation fences', () => {
  const result = { field: { diagnostics: { throwEffortCommandsV103: [{ ...command, from: 4.025 }] }, facts: input.facts } },
    view = { ms: 4040, fieldFrame: { elapsedSeconds: 4, ball: { possessedBy: 'one' } } };
  // A seek to 4.040s still draws the 4.000s sample; the 4.025s command is not observed.
  expect(observe(view, result, 'one')).toBeNull();
  const next = { ms: 4060, fieldFrame: { elapsedSeconds: 4.055, ball: { possessedBy: 'one' } } };
  expect(observe(next, result, 'one')).toMatchObject({ commandFrom: 4.025, progress: expect.closeTo(.055) });
  const cancelled = { field: { ...result.field, diagnostics: { throwEffortCommandsV103: [command],
    throwEffortCancellationsV103: [{ playerId: 'one', from: 4.025, commandFrom: 4, reason: 'changed' }] } } };
  expect(observe(view, cancelled, 'one')).toMatchObject({ commandFrom: 4, progress: 0 });
  expect(observe(next, cancelled, 'one')).toBeNull();
  expect(observe({ ms: 4040, frame: { possessedBy: 'one' } }, result, 'one')).toBeNull();
  expect(observe({ ...next, fieldFrame: { elapsedSeconds: 4.055, ball: { possessedBy: null } } }, result, 'one')).toBeNull();
});
