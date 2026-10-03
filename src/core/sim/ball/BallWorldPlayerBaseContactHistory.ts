import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import type { BaseTouchRegion } from '../running/BaseTouch';
import { quantizeEventTick } from '../ExactEventTime';
import type { BallWorldMotionActor } from './BallWorldContinuation';
import { findBallWorldFootBaseContactIntervals } from './BallWorldFootBaseContact';

/** An executed window, not the requested future motor horizon. Its Native owner proves provenance. */
export type BallWorldPlayerBaseContactSegment = Readonly<{
  originTick: number; startElapsedSeconds: number; endElapsedSeconds: number; actors: readonly BallWorldMotionActor[];
}>;
export type BallWorldPlayerBaseContactHistory = Readonly<{
  playerId: string; originTick: number; ticksPerSecond: number; startElapsedSeconds: number; endElapsedSeconds: number;
  contactAtStart: boolean; contactAtHorizon: boolean;
  episodes: readonly Readonly<{ startElapsedSeconds: number; endElapsedSeconds: number }>[];
  events: readonly Readonly<{ kind: 'touch' | 'departure'; originTick: number; elapsedSeconds: number; tick: number }>[];
}>;
type Input = Readonly<{ segments: readonly BallWorldPlayerBaseContactSegment[]; playerId: string;
  base: BaseTouchRegion; baseSurfaceHeightMeters: number }>;
const fields = (value: unknown, keys: readonly string[]) => !!value && typeof value === 'object' && !Array.isArray(value)
  && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
const feet = (segment: BallWorldPlayerBaseContactSegment, playerId: string) => {
  if (!fields(segment, ['originTick', 'startElapsedSeconds', 'endElapsedSeconds', 'actors']) || !Array.isArray(segment.actors)) {
    throw new Error('actual player/base executed window is missing');
  }
  const result = segment.actors.filter((actor) => actor?.playerId === playerId
    && (actor.primitive?.role === 'left_foot' || actor.primitive?.role === 'right_foot'));
  if (result.length !== 2 || new Set(result.map((a) => a.primitive.role)).size !== 2) throw new Error('actual player/base feet are incomplete');
  return result;
};
const sample = (actor: BallWorldMotionActor, segment: BallWorldPlayerBaseContactSegment, elapsed: number) => {
  const s = actor.primitive, local = elapsed - ((s.startTick - segment.originTick) / s.ticksPerSecond + (actor.startElapsedSeconds ?? 0));
  const result = (['x', 'y', 'z'] as const).flatMap((axis) => [
    s.startCenter[axis] + s.startVelocity[axis] * local + 0.5 * s.acceleration[axis] * local * local,
    s.startVelocity[axis] + s.acceleration[axis] * local,
  ]);
  if (!result.every(Number.isFinite)) throw new Error('actual player/base continuity arithmetic overflow');
  return result;
};
const sameNumber = (a: number, b: number) => Math.abs(a - b) <= Number.EPSILON * Math.max(1, Math.abs(a), Math.abs(b)) * 32;

/** Both-foot union over one complete continuous prefix. A horizon never proves departure or PlayEnd. */
export const deriveBallWorldPlayerBaseContactHistory = (raw: Input): BallWorldPlayerBaseContactHistory => {
  const input = cloneInert(raw);
  if (!fields(input, ['segments', 'playerId', 'base', 'baseSurfaceHeightMeters']) || !Array.isArray(input.segments)
    || !input.segments.length || typeof input.playerId !== 'string' || !input.playerId.length || input.playerId !== input.playerId.trim()) {
    throw new Error('invalid actual player/base history scope');
  }
  const first = input.segments[0], firstFeet = feet(first, input.playerId), ticksPerSecond = firstFeet[0].primitive.ticksPerSecond;
  const pieces: { startElapsedSeconds: number; endElapsedSeconds: number }[] = [];
  let previous: BallWorldPlayerBaseContactSegment | null = null;
  for (const segment of input.segments) {
    const actualFeet = feet(segment, input.playerId);
    if (segment.originTick !== first.originTick || actualFeet.some((a) => a.primitive.ticksPerSecond !== ticksPerSecond)) {
      throw new Error('actual player/base original clock differs');
    }
    // Validate every foot/window before checking whether an observation is redundant.
    const intervals = actualFeet.flatMap((actor) => findBallWorldFootBaseContactIntervals({ actor, originTick: segment.originTick,
      searchStartElapsedSeconds: segment.startElapsedSeconds, searchEndElapsedSeconds: segment.endElapsedSeconds,
      base: input.base, baseSurfaceHeightMeters: input.baseSurfaceHeightMeters }));
    if (previous) {
      if (JSON.stringify(segment) === JSON.stringify(previous)) continue;
      if (segment.startElapsedSeconds !== previous.endElapsedSeconds) throw new Error('actual player/base execution has a gap or overlap');
      const priorFeet = feet(previous, input.playerId);
      for (const actor of actualFeet) {
        const prior = priorFeet.find((a) => a.primitive.role === actor.primitive.role)!;
        const oldState = sample(prior, previous, previous.endElapsedSeconds), newState = sample(actor, segment, segment.startElapsedSeconds);
        if (!oldState.every((value, index) => sameNumber(value, newState[index]))) throw new Error('actual player/base rebase is discontinuous');
      }
    }
    pieces.push(...intervals.map(({ startElapsedSeconds, endElapsedSeconds }) => ({ startElapsedSeconds, endElapsedSeconds })));
    previous = segment;
  }
  pieces.sort((a, b) => a.startElapsedSeconds - b.startElapsedSeconds || a.endElapsedSeconds - b.endElapsedSeconds);
  const episodes: { startElapsedSeconds: number; endElapsedSeconds: number }[] = [];
  for (const piece of pieces) {
    const last = episodes.at(-1);
    if (last && piece.startElapsedSeconds <= last.endElapsedSeconds) last.endElapsedSeconds = Math.max(last.endElapsedSeconds, piece.endElapsedSeconds);
    else episodes.push({ ...piece });
  }
  const endElapsedSeconds = previous!.endElapsedSeconds;
  const events: BallWorldPlayerBaseContactHistory['events'][number][] = [];
  const event = (kind: 'touch' | 'departure', elapsedSeconds: number) => Object.freeze({ kind, originTick: first.originTick, elapsedSeconds,
    tick: quantizeEventTick(first.originTick, elapsedSeconds, ticksPerSecond) });
  for (const episode of episodes) {
    events.push(event('touch', episode.startElapsedSeconds));
    if (episode.endElapsedSeconds < endElapsedSeconds) events.push(event('departure', episode.endElapsedSeconds));
  }
  return Object.freeze({ playerId: input.playerId, originTick: first.originTick, ticksPerSecond,
    startElapsedSeconds: first.startElapsedSeconds, endElapsedSeconds,
    contactAtStart: episodes[0]?.startElapsedSeconds === first.startElapsedSeconds,
    contactAtHorizon: episodes.at(-1)?.endElapsedSeconds === endElapsedSeconds,
    episodes: Object.freeze(episodes.map((episode) => Object.freeze(episode))), events: Object.freeze(events) });
};
