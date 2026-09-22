import { describe, expect, it } from 'vitest';
import { buildRunnerMotionTrajectory, sampleRunnerMotionTrajectory } from '../running/RunnerMotion';
import type { RunnerRoute } from '../running/RunnerRoute';
import type { BaseTouchRegion } from '../running/BaseTouch';
import type { DefenderPhysicalPrimitiveSegment } from '../fielding/DefenderPhysicalPrimitive';
import { resolveEventQueueWatermark } from './EventQueueWatermark';
import { createLiveActionFrontier, resolvePlayEndFromFrontier } from './ActionFrontier';
import {
  adoptControlledTagAtTick,
  adoptRunnerBaseTouchAtTick,
  adoptSecurePossessionAtTick,
  adoptThrowReceptionContactAtTick,
  forecastControlledTag,
  forecastRunnerBaseTouch,
  forecastThrowReception,
  projectPhysicalEventForecast,
} from './PhysicalEventAdoption';

const route: RunnerRoute = {
  segments: [{ kind: 'line', start: { x: 0, z: 0 }, end: { x: 20, z: 0 } }],
};
const base: BaseTouchRegion = {
  center: { x: 5, z: 0 },
  halfSize: { x: 0.2, z: 0.2 },
  rotationRadians: 0,
};
const runnerTrajectory = buildRunnerMotionTrajectory(
  { tick: 0, routeDistanceMeters: 0, speedMps: 0, driveDirection: 0, bodyMode: 'upright' },
  { kind: 'advance', issuedTick: 0 },
  2_000_000,
  {
    ticksPerSecond: 1_000_000,
    reactionDelayTicks: 0,
    accelerationMps2: 4,
    brakingMps2: 4,
    slideDecelerationMps2: 5,
    topSpeedMps: 10,
  },
);

const glove = (): DefenderPhysicalPrimitiveSegment => ({
  role: 'glove',
  radius: 0.0334,
  startTick: 2_000_000,
  endTick: 2_005_000,
  ticksPerSecond: 1_000_000,
  startCenter: { x: 0, y: 1.2, z: 0 },
  startVelocity: { x: 0, y: 0, z: 0 },
  acceleration: { x: 0, y: 0, z: 0 },
});

const retention = (capacity = 400) => ({
  ticksPerSecond: 1_000_000,
  ballMassKg: 0.145,
  ballRadiusMeters: 0.0366,
  pocketRadiusMeters: 0.1,
  centerRetentionCapacityJ: capacity,
  captureDissipationPowerW: 100_000,
  failedContactRestitution: 0.25,
  failedTangentialDamping: 0.4,
  failedSpinDamping: 0.2,
});

describe('runner base-touch forecast and adoption', () => {
  it('derives the existing exact base-touch tick and exposes it to ActionFrontier', () => {
    const forecast = forecastRunnerBaseTouch({
      forecastId: 'runner-touch-1',
      actionKey: 'runner-action',
      runnerId: 'runner',
      base: 1,
      trajectory: runnerTrajectory,
      route,
      baseRegion: base,
      bodyParameters: { uprightLeadMeters: 0, slideLeadMeters: 0 },
    });
    expect(forecast).not.toBeNull();
    expect(forecast?.dueTick).toBe(1_549_194);
    const projected = projectPhysicalEventForecast(forecast!, 1_549_193);
    expect(projected.queue.nextPendingTick).toBe(1_549_194);
    const watermark = resolveEventQueueWatermark(1_549_193, [projected.queue]);
    const frontier = createLiveActionFrontier({
      tick: 1_549_193,
      physical: [...projected.physical],
      intents: [],
      information: [],
      decisions: [],
      ruleWindows: [],
      actors: [{ actorId: 'runner', kind: 'settled_for_play', settledAt: 1_549_193, basisEventId: 'old-settle' }],
      eventQueueSettledThroughTick: watermark.settledThroughTick,
    });
    expect(resolvePlayEndFromFrontier(frontier).kind).toBe('continues');
  });

  it('adopts the base touch only at the exact tick and rejects a rebased runner', () => {
    const forecast = forecastRunnerBaseTouch({
      forecastId: 'runner-touch-1',
      actionKey: 'runner-action',
      runnerId: 'runner',
      base: 1,
      trajectory: runnerTrajectory,
      route,
      baseRegion: base,
      bodyParameters: { uprightLeadMeters: 0, slideLeadMeters: 0 },
    })!;
    expect(adoptRunnerBaseTouchAtTick({
      forecast,
      currentTick: forecast.dueTick - 1,
      currentBody: sampleRunnerMotionTrajectory(runnerTrajectory, forecast.dueTick - 1),
    }).status).toBe('WAITING');
    const expected = sampleRunnerMotionTrajectory(runnerTrajectory, forecast.dueTick);
    const adopted = adoptRunnerBaseTouchAtTick({ forecast, currentTick: forecast.dueTick, currentBody: expected });
    expect(adopted.status).toBe('ADOPTED');
    if (adopted.status === 'ADOPTED') {
      expect(adopted.events).toEqual([{ kind: 'runner_base_touch', runnerId: 'runner', base: 1, tick: 1_549_194 }]);
      expect(adopted.queueAfter.nextPendingTick).toBeNull();
    }
    expect(adoptRunnerBaseTouchAtTick({
      forecast,
      currentTick: forecast.dueTick,
      currentBody: { ...expected, routeDistanceMeters: expected.routeDistanceMeters + 1 },
    })).toMatchObject({ status: 'INVALIDATED', reason: 'PHYSICAL_STATE_CHANGED' });
    expect(adoptRunnerBaseTouchAtTick({
      forecast,
      currentTick: forecast.dueTick + 1,
      currentBody: { ...expected, tick: forecast.dueTick + 1 },
    }).status).toBe('MISSED_EVENT');
  });
});

describe('throw reception and secure possession', () => {
  const makeForecast = (capacity = 400) => forecastThrowReception({
    forecastId: 'reception-1',
    actionKey: 'throw-action',
    ballId: 'ball',
    receiverId: 'receiver',
    ball: {
      tick: 2_000_000,
      position: { x: 0, y: 1.2, z: 0.2 },
      velocity: { x: 0, y: 0, z: -60 },
      spin: { x: 0, y: 0, z: 0 },
    },
    ballAcceleration: { x: 0, y: 0, z: 0 },
    glovePrimitive: glove(),
    ballRadiusMeters: 0.0366,
    pocketOffsetMeters: 0,
    bodyStability: 1,
    retentionParameters: retention(capacity),
  });

  it('keeps glove contact and secure possession as separate authoritative ticks', () => {
    const forecast = makeForecast()!;
    expect(forecast.contact.contactTick).toBe(2_002_167);
    expect(forecast.retention.outcome.kind).toBe('secured');
    if (forecast.retention.outcome.kind !== 'secured') return;
    expect(forecast.retention.outcome.secureTick).toBeGreaterThan(forecast.contact.contactTick);

    const contact = adoptThrowReceptionContactAtTick({
      forecast,
      currentTick: forecast.contact.contactTick,
      currentBall: forecast.contact.ball,
      currentGlove: forecast.contact.glove,
    });
    expect(contact.status).toBe('ADOPTED');
    if (contact.status !== 'ADOPTED') return;
    expect(contact.events.map((event) => event.kind)).toEqual(['GloveBallContactOccurred']);
    expect(contact.queueAfter.nextPendingTick).toBe(forecast.retention.outcome.secureTick);
    expect(contact.physicalAfter[0]?.kind).toBe('possession_transition');

    const secure = adoptSecurePossessionAtTick({
      forecast,
      currentTick: forecast.retention.outcome.secureTick,
      stillRetained: true,
    });
    expect(secure.status).toBe('ADOPTED');
    if (secure.status === 'ADOPTED') {
      expect(secure.events.map((event) => event.kind)).toEqual(['SecurePossessionEstablished']);
      expect(secure.queueAfter.nextPendingTick).toBeNull();
    }
  });

  it('invalidates secure possession if control was lost before the secure tick', () => {
    const forecast = makeForecast()!;
    expect(forecast.retention.outcome.kind).toBe('secured');
    if (forecast.retention.outcome.kind !== 'secured') return;
    expect(adoptSecurePossessionAtTick({
      forecast,
      currentTick: forecast.retention.outcome.secureTick,
      stillRetained: false,
    })).toMatchObject({ status: 'INVALIDATED', reason: 'POSSESSION_CHANGED' });
  });

  it('cannot establish secure possession without the matching adopted glove-contact event', () => {
    const forecast = makeForecast()!;
    expect(forecast.retention.outcome.kind).toBe('secured');
    if (forecast.retention.outcome.kind !== 'secured') return;
    expect(() => adoptSecurePossessionAtTick({
      forecast,
      currentTick: forecast.retention.outcome.secureTick,
      stillRetained: true,
      contactEvent: null,
    } as any)).toThrow('secure possession requires its adopted glove contact');
  });

  it('hands a failed catch back to live-ball physics at the contact tick', () => {
    const forecast = makeForecast(100)!;
    expect(forecast.retention.outcome.kind).toBe('live-ball');
    const result = adoptThrowReceptionContactAtTick({
      forecast,
      currentTick: forecast.contact.contactTick,
      currentBall: forecast.contact.ball,
      currentGlove: forecast.contact.glove,
    });
    expect(result.status).toBe('ADOPTED');
    if (result.status !== 'ADOPTED') return;
    expect(result.events.map((event) => event.kind)).toEqual(['GloveBallContactOccurred', 'CatchRetentionFailed']);
    expect(result.physicalAfter[0]?.kind).toBe('ball_motion');
    expect(result.queueAfter.nextPendingTick).toBeNull();
  });

  it('returns null when the supplied throw window never reaches the glove', () => {
    expect(forecastThrowReception({
      forecastId: 'miss',
      actionKey: 'throw-action',
      ballId: 'ball',
      receiverId: 'receiver',
      ball: {
        tick: 2_000_000,
        position: { x: 1, y: 1.2, z: 0.2 },
        velocity: { x: 0, y: 0, z: -60 },
        spin: { x: 0, y: 0, z: 0 },
      },
      ballAcceleration: { x: 0, y: 0, z: 0 },
      glovePrimitive: glove(),
      ballRadiusMeters: 0.0366,
      pocketOffsetMeters: 0,
      bodyStability: 1,
      retentionParameters: retention(),
    })).toBeNull();
  });
});

describe('controlled tag forecast and adoption', () => {
  const forecast = forecastControlledTag({
    forecastId: 'tag-1',
    actionKey: 'tag-action',
    defenderId: 'ss',
    runnerId: 'runner',
    possessionReadyTick: 2_160_000,
    tagActionStartTick: 2_200_000,
    taggerPrimitive: {
      tick: 2_200_000,
      center: { x: 0, y: 1, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      radius: 0.04,
    },
    runnerPrimitive: {
      tick: 2_200_000,
      center: { x: 0.2, y: 1, z: 0 },
      velocity: { x: -60, y: 0, z: 0 },
      radius: 0.03,
    },
    deltaTicks: 5_000,
    ticksPerSecond: 1_000_000,
  })!;

  it('derives and adopts the existing exact controlled-tag fact', () => {
    expect(forecast.dueTick).toBe(2_202_167);
    const result = adoptControlledTagAtTick({
      forecast,
      currentTick: forecast.dueTick,
      stillPossessed: true,
      currentTagger: forecast.expectedTagger,
      currentRunner: forecast.expectedRunner,
    });
    expect(result.status).toBe('ADOPTED');
    if (result.status === 'ADOPTED') {
      expect(result.events).toEqual([{
        kind: 'controlled_runner_tag',
        defenderId: 'ss',
        runnerId: 'runner',
        tick: 2_202_167,
      }]);
    }
  });

  it('invalidates tag evidence when possession or contact geometry changed', () => {
    expect(adoptControlledTagAtTick({
      forecast,
      currentTick: forecast.dueTick,
      stillPossessed: false,
      currentTagger: forecast.expectedTagger,
      currentRunner: forecast.expectedRunner,
    })).toMatchObject({ status: 'INVALIDATED', reason: 'POSSESSION_CHANGED' });
    expect(adoptControlledTagAtTick({
      forecast,
      currentTick: forecast.dueTick,
      stillPossessed: true,
      currentTagger: forecast.expectedTagger,
      currentRunner: { ...forecast.expectedRunner, center: { ...forecast.expectedRunner.center, y: 2 } },
    })).toMatchObject({ status: 'INVALIDATED', reason: 'PHYSICAL_STATE_CHANGED' });
  });
});
