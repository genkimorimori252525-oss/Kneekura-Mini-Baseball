import assert from 'node:assert/strict';
import { test } from 'vitest';
import { sampleSwingKinematicsV1 } from '../../../sim/contact/SwingKinematicsV1';
import { resolveEventQueueWatermark } from '../../../sim/liveAction/EventQueueWatermark';
import { prepareBattingExecution } from './BattingCommitment';
import { resolveBattingExecution } from './BattingResolution';
import { adoptBattingForecastAtTick, battingForecastQueueStatus } from './BattingEventAdoption';
import { fixture, change, value } from './BattingFixtures.test-support';
import { physical } from './BattingPhysicalFixtures.test-support';

// Existing Core contract only. Synthetic fixture inputs are neither a Native
// observer producer nor calibrated capabilities for generated Players.
const proposal = (input = fixture()) => value(prepareBattingExecution(input));
const forecast = (input = physical()) => value(resolveBattingExecution(input));

test('a supported repertoire speed change reaches sampled motor kinematics', () => {
  const original = fixture();
  const changed = change(original, d => {
    d.source.revision++;
    d.source.profiles[0].profile.baseContactSweetSpotSpeedMps += 1;
  });
  const first = proposal(original).commitment!;
  const second = proposal(changed).commitment!;
  assert.equal(first.decisionTick, second.decisionTick);
  assert.equal(first.predictionId, second.predictionId);
  assert.notDeepEqual(first.trajectory, second.trajectory);
  const a = sampleSwingKinematicsV1(first.trajectory!, first.trajectory!.contactTick);
  const b = sampleSwingKinematicsV1(second.trajectory!, second.trajectory!.contactTick);
  assert.notDeepEqual(a.sweetSpotVelocity, b.sweetSpotVelocity);
  assert.deepEqual(a.sweetSpotPosition, b.sweetSpotPosition);
});

test('a larger feasible speed ceiling is a constraint, not an extra speed buff', () => {
  const original = fixture();
  const changed = change(original, d => { d.source.maximumSweetSpotSpeedMps *= 2; });
  assert.deepEqual(proposal(original).commitment!.trajectory, proposal(changed).commitment!.trajectory);
});

test('profile identifiers change provenance without changing rigid physics', () => {
  const original = fixture();
  const renamed = change(original, d => {
    d.source.repertoireId = 'same-physical-repertoire-new-label';
    d.source.repertoireVersion = 'same-numbers';
    d.source.profiles[0].profile.profileId = 'same-physical-swing-new-label';
    d.source.profiles[0].profile.version = 'same-numbers';
  });
  assert.notEqual(proposal(original).commitment!.profileId, proposal(renamed).commitment!.profileId);
  assert.deepEqual(proposal(original).commitment!.trajectory, proposal(renamed).commitment!.trajectory);
  assert.deepEqual(forecast(physical(original)).resolution, forecast(physical(renamed)).resolution);
});

test('a display rating is not an accepted physics input', () => {
  const original = fixture();
  const result = prepareBattingExecution({ ...original, source: { ...original.source, displayRating: 99 } });
  assert.equal(result.ok, false);
});

test('a refinement delivered after commitment cannot affect the committed motor', () => {
  const delayed = change(fixture(), d => {
    d.source.predictions[1].availableTick = d.currentFrame.time.tick + 1;
  });
  const changedFuture = change(delayed, d => {
    d.source.predictions[1].trajectory.start.position.x = 3;
    d.source.predictions[1].swingScore = 0;
  });
  assert.equal(proposal(delayed).commitment!.predictionId, 'coarse');
  assert.deepEqual(proposal(delayed).commitment, proposal(changedFuture).commitment);
});

test('positive actor motor latency can delay physical onset without moving decision time', () => {
  const request = change(fixture(), d => { d.source.motorLatencyTicks = 250_000; });
  const committed = proposal(request).commitment!;
  assert.equal(committed.decisionTick, request.currentFrame.time.tick);
  assert.equal(committed.motorStartTick, committed.decisionTick + request.source.motorLatencyTicks);
  assert.ok(committed.motorDelayTicks > 0);
  assert.equal(committed.trajectory!.startTick, committed.motorStartTick);
});

test('a technical timing source changes physical phase timing independently of emotion', () => {
  const original = fixture();
  const changed = change(original, d => {
    d.source.revision++;
    d.source.technicalTimingOffsetTicks += 10_000;
  });
  const a = proposal(original).commitment!;
  const b = proposal(changed).commitment!;
  assert.equal(a.decisionTick, b.decisionTick);
  assert.equal(a.predictionId, b.predictionId);
  assert.equal(b.trajectory!.contactTick - a.trajectory!.contactTick, 10_000);
  assert.deepEqual(a.trajectory!.contact, b.trajectory!.contact);
});

test('changing actual flight changes physical resolution without replanning the accepted swing', () => {
  const input = physical();
  const otherActual = change(input, d => { d.actualTrajectory.start.position.x = 3; });
  const a = forecast(input);
  const b = forecast(otherActual);
  assert.deepEqual(a.commitment, b.commitment);
  assert.deepEqual(a.request.accepted, b.request.accepted);
  assert.notDeepEqual(a.resolution, b.resolution);
});

test('serialized forecast remains pending and limits the watermark until exact due adoption', () => {
  const saved = forecast();
  const restored = JSON.parse(JSON.stringify(saved)) as typeof saved;
  const due = restored.resolution.timeline.events.at(-1)!.tick;
  const base = restored.request.timeline;
  const beforeBytes = JSON.stringify(base);
  assert.equal(adoptBattingForecastAtTick(restored, base, due - 1).status, 'WAITING');
  const queue = battingForecastQueueStatus(restored, base, due);
  assert.equal(resolveEventQueueWatermark(due, [{ sourceId: 'forecast',
    settledThroughTick: queue.settledThroughTick, nextPendingTick: queue.nextPendingTick }]).settledThroughTick, due - 1);
  assert.equal(JSON.stringify(base), beforeBytes);
  const adopted = adoptBattingForecastAtTick(restored, base, due);
  assert.equal(adopted.status, 'ADOPTED');
  assert.ok(adopted.adoptedEvents.length > 0);
  assert.ok(adopted.adoptedEvents.every(event => event.tick === due));
  assert.deepEqual(adopted.timeline, saved.resolution.timeline);
  assert.equal(adoptBattingForecastAtTick(restored, adopted.timeline, due).status, 'ALREADY_ADOPTED');
  assert.equal(adoptBattingForecastAtTick(restored, base, due + 1).status, 'MISSED_EVENT');
});

test('due adoption recomputes a restored forecast instead of trusting serialized contact payloads', () => {
  const original = forecast();
  const tampered = change(original, d => {
    d.resolution.timeline.events[0].payload.countBefore.balls = 1;
  });
  const due = original.resolution.timeline.events[0].tick;
  const beforeBytes = JSON.stringify(original.request.timeline);
  assert.throws(() => adoptBattingForecastAtTick(tampered, original.request.timeline, due), /recomputed/);
  assert.equal(JSON.stringify(original.request.timeline), beforeBytes);
});
