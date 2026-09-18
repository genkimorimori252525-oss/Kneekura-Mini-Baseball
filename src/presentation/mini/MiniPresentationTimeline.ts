import type { TimedMatchEvent } from '../../core/model/TimedMatchEvent';
import type {
  CanonicalPresentationSample,
  MiniPresentationFrame,
} from './model';

function isFairBattedBallDeclaration(
  event: TimedMatchEvent,
): boolean {
  return event.kind === 'BattedBallDeclaredFair';
}

function assertStrictlyIncreasingSamples(
  samples: readonly CanonicalPresentationSample[],
): void {
  for (let index = 1; index < samples.length; index += 1) {
    if (
      samples[index - 1].world.tick
      >= samples[index].world.tick
    ) {
      throw new Error(
        'Presentation samples must have strictly increasing ticks.',
      );
    }
  }
}

const assertScheduleTick = (
  name: string,
  tick: number,
): void => {
  if (!Number.isSafeInteger(tick) || tick < 0) {
    throw new Error(
      `${name} must be a non-negative safe integer tick.`,
    );
  }
};

export function createMiniPresentationSampleSchedule(
  startTick: number,
  endTick: number,
  cadenceTicks: number,
  events: readonly TimedMatchEvent[],
): readonly number[] {
  assertScheduleTick('startTick', startTick);
  assertScheduleTick('endTick', endTick);

  if (endTick < startTick) {
    throw new Error(
      'Presentation schedule endTick must be at or after startTick.',
    );
  }
  if (
    !Number.isSafeInteger(cadenceTicks)
    || cadenceTicks <= 0
  ) {
    throw new Error(
      'Presentation cadenceTicks must be a positive safe integer.',
    );
  }

  const ticks = new Set<number>();
  ticks.add(startTick);
  ticks.add(endTick);

  let tick = startTick;
  while (tick + cadenceTicks < endTick) {
    tick += cadenceTicks;
    ticks.add(tick);
  }

  for (const event of events) {
    assertScheduleTick('event.tick', event.tick);
    if (
      event.tick >= startTick
      && event.tick <= endTick
    ) {
      ticks.add(event.tick);
    }
  }

  return [...ticks].sort(
    (first, second) => first - second,
  );
}

export function buildMiniPresentationTimeline(
  samples: readonly CanonicalPresentationSample[],
  events: readonly TimedMatchEvent[],
): readonly MiniPresentationFrame[] {
  assertStrictlyIncreasingSamples(samples);

  const sampleTicks = new Set(
    samples.map((sample) => sample.world.tick),
  );
  for (const event of events) {
    if (
      isFairBattedBallDeclaration(event)
      && !sampleTicks.has(event.tick)
    ) {
      throw new Error(
        `Missing exact canonical sample for BattedBallDeclaredFair at tick ${event.tick}.`,
      );
    }
  }

  const eventsByTick =
    new Map<number, TimedMatchEvent[]>();
  for (const event of events) {
    const list = eventsByTick.get(event.tick);
    if (list) list.push(event);
    else eventsByTick.set(event.tick, [event]);
  }

  const frames: MiniPresentationFrame[] = [];
  let cameraMode: MiniPresentationFrame['cameraMode'] =
    'BATTER_POV';

  for (const sample of samples) {
    const tick = sample.world.tick;
    const tickEvents = eventsByTick.get(tick) ?? [];
    const fairDeclaration = tickEvents.find(
      isFairBattedBallDeclaration,
    );

    frames.push({
      tick,
      cameraMode,
      sample,
      events: tickEvents,
    });

    if (
      cameraMode === 'BATTER_POV'
      && fairDeclaration
    ) {
      cameraMode = 'FIELD_OVERHEAD';
      frames.push({
        tick,
        cameraMode,
        sample,
        events: tickEvents,
        cutReason: 'fair_batted_ball_declared',
      });
    }
  }

  return frames;
}
