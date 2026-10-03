import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import { quantizeEventTick } from '../ExactEventTime';
import type { BallWorldPlayerBaseContactHistory } from './BallWorldPlayerBaseContactHistory';

export type BallWorldBaseControlWindow = Readonly<{ startElapsedSeconds: number; endElapsedSeconds: number; endInclusive: boolean }>;
export type BallWorldControlledBaseContact = Readonly<{ playerId: string; originTick: number; elapsedSeconds: number; tick: number }>;
const fields = (value: unknown, keys: readonly string[]) => !!value && typeof value === 'object' && !Array.isArray(value)
  && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());

/** Intersect actual both-foot relation with own secured possession. Its Native caller owns every control interval. */
export const findBallWorldControlledBaseContacts = (raw: Readonly<{ history: BallWorldPlayerBaseContactHistory;
  controlWindows: readonly BallWorldBaseControlWindow[] }>): readonly BallWorldControlledBaseContact[] => {
  const input = cloneInert(raw), h = input?.history;
  if (!fields(input, ['history', 'controlWindows']) || !h || typeof h.playerId !== 'string' || !h.playerId.length
    || !Number.isSafeInteger(h.originTick) || h.originTick < 0 || !Number.isSafeInteger(h.ticksPerSecond) || h.ticksPerSecond <= 0
    || ![h.startElapsedSeconds, h.endElapsedSeconds].every(Number.isFinite) || h.startElapsedSeconds < 0 || h.endElapsedSeconds < h.startElapsedSeconds
    || !Array.isArray(h.episodes) || !Array.isArray(input.controlWindows)) throw new Error('invalid actual controlled base history');
  const window = (w: Readonly<{ startElapsedSeconds: number; endElapsedSeconds: number }>) =>
    [w.startElapsedSeconds, w.endElapsedSeconds].every(Number.isFinite) && w.startElapsedSeconds >= h.startElapsedSeconds
    && w.endElapsedSeconds <= h.endElapsedSeconds && w.endElapsedSeconds >= w.startElapsedSeconds;
  if (h.episodes.some((e, index) => !fields(e, ['startElapsedSeconds', 'endElapsedSeconds']) || !window(e)
    || index > 0 && e.startElapsedSeconds <= h.episodes[index - 1].endElapsedSeconds)
    || input.controlWindows.some((w) => !fields(w, ['startElapsedSeconds', 'endElapsedSeconds', 'endInclusive']) || !window(w)
      || typeof w.endInclusive !== 'boolean')) throw new Error('actual controlled base window exceeds physical history');
  const pieces = input.controlWindows.flatMap((w) => h.episodes.flatMap((e) => {
    const start = Math.max(w.startElapsedSeconds, e.startElapsedSeconds), end = Math.min(w.endElapsedSeconds, e.endElapsedSeconds);
    return start > end || start === end && end === w.endElapsedSeconds && !w.endInclusive ? [] : [{ start, end }];
  })).sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: { start: number; end: number }[] = [];
  for (const piece of pieces) {
    const last = merged.at(-1);
    if (last && piece.start <= last.end) last.end = Math.max(last.end, piece.end);
    else merged.push({ ...piece });
  }
  return Object.freeze(merged.map((e) => Object.freeze({ playerId: h.playerId, originTick: h.originTick, elapsedSeconds: e.start,
    tick: quantizeEventTick(h.originTick, e.start, h.ticksPerSecond) })));
};
