import type { TimedMatchEvent } from '../../core/model/TimedMatchEvent';
import type { CanonicalPresentationSample, MiniPresentationFrame } from './model';

type LiveBattedBallPayload = Readonly<{ liveBattedBall?: boolean }>;

function isLiveBattedBallContact(event: TimedMatchEvent): boolean {
  if (event.kind !== 'BatBallContact') return false;
  if (typeof event.payload !== 'object' || event.payload === null) return false;
  return (event.payload as LiveBattedBallPayload).liveBattedBall === true;
}

function assertStrictlyIncreasingSamples(samples: readonly CanonicalPresentationSample[]): void {
  for (let index = 1; index < samples.length; index += 1) {
    if (samples[index - 1].world.tick >= samples[index].world.tick) {
      throw new Error('Presentation samples must have strictly increasing ticks.');
    }
  }
}

export function buildMiniPresentationTimeline(
  samples: readonly CanonicalPresentationSample[],
  events: readonly TimedMatchEvent[],
): readonly MiniPresentationFrame[] {
  assertStrictlyIncreasingSamples(samples);

  const sampleTicks = new Set(samples.map((sample) => sample.world.tick));
  for (const event of events) {
    if (isLiveBattedBallContact(event) && !sampleTicks.has(event.tick)) {
      throw new Error(`Missing exact canonical sample for live BatBallContact at tick ${event.tick}.`);
    }
  }

  const eventsByTick = new Map<number, TimedMatchEvent[]>();
  for (const event of events) {
    const list = eventsByTick.get(event.tick);
    if (list) list.push(event);
    else eventsByTick.set(event.tick, [event]);
  }

  const frames: MiniPresentationFrame[] = [];
  let cameraMode: MiniPresentationFrame['cameraMode'] = 'BATTER_POV';

  for (const sample of samples) {
    const tick = sample.world.tick;
    const tickEvents = eventsByTick.get(tick) ?? [];
    const liveContact = tickEvents.find(isLiveBattedBallContact);

    frames.push({
      tick,
      cameraMode,
      sample,
      events: tickEvents,
    });

    if (cameraMode === 'BATTER_POV' && liveContact) {
      cameraMode = 'FIELD_OVERHEAD';
      frames.push({
        tick,
        cameraMode,
        sample,
        events: tickEvents,
        cutReason: 'live_batted_ball_contact',
      });
    }
  }

  return frames;
}
