import type { CanonicalMatchState } from '../model/CanonicalMatchState';
import type { BallWorldPlayerBaseContactHistory } from '../sim/ball/BallWorldPlayerBaseContactHistory';
import type { ActualFairFieldTimelineInput } from '../sim/plateAppearance/ActualFairFieldTimeline';

/** Native authenticates each original hold and reconstructs the complete
 * executed zero-motion prefix. References and contact histories alone do not
 * establish Source ownership, stationary motion, producer completion or PlayEnd. */
export type ActualFairCatchStationaryOccupiedRunners = Readonly<{
  kind: 'same_pa_stationary_occupied_runners_v1';
  runners: readonly Readonly<{
    playerId: string; startingBase: 'first' | 'second' | 'third';
    holdReference: Readonly<{ owner: 'world_same_pa_occupied_runner_holds'; sourceId: string; sourceHash: string; snapshotHash: string }>;
    history: BallWorldPlayerBaseContactHistory;
  }>[];
}>;
export type ActualFairCatchScoringInput = ActualFairFieldTimelineInput & Readonly<{
  occupiedRunners?: ActualFairCatchStationaryOccupiedRunners;
}>;
export type ActualFairCatchAppealApplicability = 'no_original_tag_up_participant' | 'original_runners_never_left_original_bases';

const fields = (v: unknown, keys: readonly string[]) => !!v && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const text = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v === v.trim();
const hash = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const bases = ['first', 'second', 'third'] as const;

/** Validate the independently owned end's stationary sidecar against this exact
 * original occupancy and horizon. This pure check never creates an end proof. */
export const validateActualFairCatchStationaryRunners = (input: Readonly<{
  originalMatch: CanonicalMatchState; batterRunnerId: string;
  originTick: number; ticksPerSecond: number; endElapsedSeconds: number;
  occupiedRunners?: ActualFairCatchStationaryOccupiedRunners;
}>): ActualFairCatchAppealApplicability => {
  const { originalMatch: match, batterRunnerId, originTick, ticksPerSecond, endElapsedSeconds, occupiedRunners: proof } = input;
  if (!fields(match.bases, bases) || !text(batterRunnerId) || !Number.isSafeInteger(originTick) || originTick < 0
    || !Number.isSafeInteger(ticksPerSecond) || ticksPerSecond <= 0 || !Number.isFinite(endElapsedSeconds) || endElapsedSeconds < 0
    || bases.some(base => match.bases[base] !== null && (!text(match.bases[base]) || match.bases[base] === batterRunnerId))) {
    throw new Error('fair catch stationary original occupancy or clock differs');
  }
  const occupied = bases.filter(base => match.bases[base] !== null);
  if (new Set(occupied.map(base => match.bases[base])).size !== occupied.length) throw new Error('fair catch original runners are duplicated');
  if (!occupied.length) {
    if (proof !== undefined) throw new Error('fair catch stationary runner proof has no original participant');
    return 'no_original_tag_up_participant';
  }
  if (!proof || !fields(proof, ['kind', 'runners']) || proof.kind !== 'same_pa_stationary_occupied_runners_v1'
    || !Array.isArray(proof.runners) || proof.runners.length !== occupied.length) {
    throw new Error('fair catch requires its owned complete stationary runner proof');
  }
  const players = new Set<string>(), holds = new Set<string>();
  const runners: ActualFairCatchStationaryOccupiedRunners['runners'] = proof.runners;
  for (const runner of runners) {
    if (!fields(runner, ['playerId', 'startingBase', 'holdReference', 'history']) || !text(runner.playerId)
      || !occupied.includes(runner.startingBase) || match.bases[runner.startingBase] !== runner.playerId
      || players.has(runner.playerId)) throw new Error('fair catch stationary runner membership differs');
    const pin = runner.holdReference, history = runner.history;
    if (!fields(pin, ['owner', 'sourceId', 'sourceHash', 'snapshotHash']) || pin.owner !== 'world_same_pa_occupied_runner_holds'
      || !text(pin.sourceId) || !hash(pin.sourceHash) || !hash(pin.snapshotHash) || holds.has(pin.sourceId)) {
      throw new Error('fair catch stationary original hold reference differs');
    }
    if (!fields(history, ['playerId', 'originTick', 'ticksPerSecond', 'startElapsedSeconds', 'endElapsedSeconds',
      'contactAtStart', 'contactAtHorizon', 'episodes', 'events']) || history.playerId !== runner.playerId
      || history.originTick !== originTick || history.ticksPerSecond !== ticksPerSecond || history.startElapsedSeconds !== 0
      || history.endElapsedSeconds !== endElapsedSeconds || history.contactAtStart !== true || history.contactAtHorizon !== true
      || !Array.isArray(history.episodes) || history.episodes.length !== 1
      || !fields(history.episodes[0], ['startElapsedSeconds', 'endElapsedSeconds'])
      || history.episodes[0].startElapsedSeconds !== 0 || history.episodes[0].endElapsedSeconds !== endElapsedSeconds
      || !Array.isArray(history.events) || history.events.length !== 1
      || !fields(history.events[0], ['kind', 'originTick', 'elapsedSeconds', 'tick']) || history.events[0].kind !== 'touch'
      || history.events[0].originTick !== originTick || history.events[0].elapsedSeconds !== 0 || history.events[0].tick !== originTick) {
      throw new Error('fair catch stationary runners must never leave original bases throughout the exact physical prefix');
    }
    players.add(runner.playerId); holds.add(pin.sourceId);
  }
  return 'original_runners_never_left_original_bases';
};
