import assert from 'node:assert/strict';
import { test } from 'vitest';
import { resolveBattingExecution } from './BattingResolution';
import { battingForecastQueueStatus, adoptBattingForecastAtTick } from './BattingEventAdoption';
import { physical } from './BattingPhysicalFixtures.test-support';
import { fixture, change, value } from './BattingFixtures.test-support';

const forecast = (r = physical()) => value(resolveBattingExecution(r));

test('contact forecast remains pending until the exact physical contact tick', () => {
  const f = forecast();
  assert.equal(f.resolution.kind, 'recorded_swing');
  if (f.resolution.kind !== 'recorded_swing' || f.resolution.physical.kind !== 'contact') return;
  const due = f.resolution.physical.contact.tick;
  const before = battingForecastQueueStatus(f, f.request.timeline, due - 1);
  assert.equal(before.nextPendingTick, due);
  assert.equal(before.settledThroughTick, due - 1);
  const waiting = adoptBattingForecastAtTick(f, f.request.timeline, due - 1);
  assert.equal(waiting.status, 'WAITING');
  assert.equal(waiting.timeline, f.request.timeline);
});

test('contact is adopted only at its exact tick using the existing canonical recorder', () => {
  const f = forecast();
  assert.equal(f.resolution.kind, 'recorded_swing');
  if (f.resolution.kind !== 'recorded_swing' || f.resolution.physical.kind !== 'contact') return;
  const due = f.resolution.physical.contact.tick;
  const result = adoptBattingForecastAtTick(f, f.request.timeline, due);
  assert.equal(result.status, 'ADOPTED');
  assert.deepEqual(result.timeline, f.resolution.timeline);
  assert.deepEqual(result.adoptedEvents.map((event) => event.kind), ['BatBallContact']);
  assert.equal(battingForecastQueueStatus(f, result.timeline, due).settledThroughTick, due);
});

test('take adopts physical crossing and pitch adjudication atomically on the same authoritative tick', () => {
  const f = forecast(physical(change(fixture(), (d) => { d.source.directive = 'TAKE'; })));
  assert.equal(f.resolution.kind, 'recorded_take');
  if (f.resolution.kind !== 'recorded_take') return;
  const due = f.resolution.physical.crossing.tick;
  const result = adoptBattingForecastAtTick(f, f.request.timeline, due);
  assert.equal(result.status, 'ADOPTED');
  assert.deepEqual(result.adoptedEvents.map((event) => event.kind), ['TakenPitchPlateCrossed', 'PitchAdjudicated']);
  assert.ok(result.adoptedEvents.every((event) => event.tick === due));
  assert.deepEqual(result.timeline, f.resolution.timeline);
});

test('swinging miss adopts miss evidence and strike adjudication atomically', () => {
  const f = forecast(change(physical(), (d) => { d.actualTrajectory.start.position.x = 3; }));
  assert.equal(f.resolution.kind, 'recorded_swing');
  if (f.resolution.kind !== 'recorded_swing' || f.resolution.physical.kind !== 'swinging_miss') return;
  const due = f.resolution.physical.adjudicationTick;
  const result = adoptBattingForecastAtTick(f, f.request.timeline, due);
  assert.equal(result.status, 'ADOPTED');
  assert.deepEqual(result.adoptedEvents.map((event) => event.kind), ['SwingCompletedWithoutContact', 'PitchAdjudicated']);
  assert.deepEqual(result.timeline, f.resolution.timeline);
});

test('scheduler miss does not backdate a canonical batting event', () => {
  const f = forecast();
  assert.equal(f.resolution.kind, 'recorded_swing');
  if (f.resolution.kind !== 'recorded_swing' || f.resolution.physical.kind !== 'contact') return;
  const due = f.resolution.physical.contact.tick;
  const result = adoptBattingForecastAtTick(f, f.request.timeline, due + 1);
  assert.equal(result.status, 'MISSED_EVENT');
  assert.equal(result.timeline, f.request.timeline);
});

test('stale canonical cursor rejects adoption rather than overwriting history', () => {
  const f = forecast();
  assert.equal(f.resolution.kind, 'recorded_swing');
  if (f.resolution.kind !== 'recorded_swing' || f.resolution.physical.kind !== 'contact') return;
  const due = f.resolution.physical.contact.tick;
  const stale = { ...f.request.timeline, nextSequence: f.request.timeline.nextSequence + 1 };
  assert.throws(() => battingForecastQueueStatus(f, stale, due));
});

test('already adopted forecast reports no remaining event and is idempotent only as observation', () => {
  const f = forecast();
  assert.equal(f.resolution.kind, 'recorded_swing');
  if (f.resolution.kind !== 'recorded_swing' || f.resolution.physical.kind !== 'contact') return;
  const due = f.resolution.physical.contact.tick;
  const first = adoptBattingForecastAtTick(f, f.request.timeline, due);
  assert.equal(first.status, 'ADOPTED');
  const status = battingForecastQueueStatus(f, first.timeline, due);
  assert.equal(status.nextPendingTick, null);
  const second = adoptBattingForecastAtTick(f, first.timeline, due);
  assert.equal(second.status, 'ALREADY_ADOPTED');
  assert.equal(second.timeline, first.timeline);
});

test('unresolved pitch creates no canonical event adoption claim', () => {
  const f = forecast(change(physical(change(fixture(), (d) => { d.source.directive = 'TAKE'; })), (d) => {
    d.actualTrajectory.start.velocity.z = 40;
  }));
  assert.equal(f.resolution.kind, 'unresolved');
  const status = battingForecastQueueStatus(f, f.request.timeline, f.request.currentFrame.time.tick);
  assert.equal(status.nextPendingTick, null);
  assert.equal(status.kind, 'UNRESOLVED_FORECAST');
});
