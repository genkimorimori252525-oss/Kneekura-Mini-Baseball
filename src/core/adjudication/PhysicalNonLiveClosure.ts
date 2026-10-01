import { cloneInert } from './OfficialWindowPolicy';
import type { CanonicalMatchState } from '../model/CanonicalMatchState';
import type { CanonicalPlateAppearanceTimeline } from '../sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { resolvePitchCountRule, type PitchCountState } from '../rules/PitchCountRule';
import { resolveWalkForcedAdvancement } from '../rules/WalkAdvancementRule';
import { assessOfficialPhysicalPitchWorkload, type PhysicalPitchEffortPolicy } from '../world/development/OfficialPhysicalPitchWorkload';
import { closeOfficialPlay, createPlayAdjudicationLedger, recordCorrectRuleSnapshot } from './PlayAdjudicationLedger';
import { deriveClosedNonLiveMatchState, type NonLiveOfficialContext } from './NonLiveOfficialApplication';
import { classifyClosedPlayForOfficialScoring } from './OfficialScoring';

export type PhysicalNonLiveClosureInput = Readonly<{
  match: CanonicalMatchState; timeline: CanonicalPlateAppearanceTimeline; batterRunnerId: string | null;
  gameDay: number; effortPolicy: PhysicalPitchEffortPolicy; snapshotId: string; ruleTick: number; closureId: string; closureTick: number;
}>;
const id = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v === v.trim();
const tick = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const json = (v: unknown): string => JSON.stringify(v, (_key, item: unknown) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
const fields = (v: object, names: readonly string[]): boolean => Object.keys(v).sort().join('|') === [...names].sort().join('|');

const assertTerminalCount = (match: CanonicalMatchState, timeline: CanonicalPlateAppearanceTimeline): void => {
  let count: PitchCountState = { balls: match.balls, strikes: match.strikes }, contact: number | null = null;
  let terminal: Extract<ReturnType<typeof resolvePitchCountRule>, { kind: 'walk' | 'strikeout' }> | null = null;
  resolvePitchCountRule(count, { kind: 'ball_in_play' });
  for (const event of timeline.events) {
    if (terminal) throw new Error('physical terminal count is followed by another event');
    if (event.kind === 'PitchAdjudicated') {
      if (contact !== null || !fields(event.payload, ['countBefore', 'adjudication', 'result'])
        || !fields(event.payload.adjudication, ['kind']) || json(event.payload.countBefore) !== json(count)) throw new Error('physical closure count chain differs');
      const expected = resolvePitchCountRule(count, event.payload.adjudication);
      if (json(expected) !== json(event.payload.result) || expected.kind === 'ball_in_play') throw new Error('physical closure count result differs');
      if (expected.kind === 'continue') count = expected.count; else terminal = expected;
    } else if (event.kind === 'BatBallContact') {
      if (contact !== null || json(event.payload.countBefore) !== json(count)) throw new Error('physical closure contact count differs');
      contact = event.tick;
    } else if (event.kind === 'FoulBattedBallResolved') {
      const result = event.payload.resolution;
      if (contact === null || event.payload.contactTick !== contact || result.kind !== 'uncaught_foul'
        || !fields(event.payload, ['contactTick', 'resolution']) || !fields(result, ['kind', 'ballDead', 'countResult'])
        || result.ballDead !== true || result.countResult.kind === 'ball_in_play'
        || !['foul', 'foul_bunt'].includes(result.countResult.cause)) throw new Error('physical closure foul count differs');
      const expected = resolvePitchCountRule(count, { kind: result.countResult.cause as 'foul' | 'foul_bunt' });
      if (json(expected) !== json(result.countResult) || expected.kind === 'ball_in_play' || expected.kind === 'walk') throw new Error('physical closure foul result differs');
      if (expected.kind === 'continue') count = expected.count; else terminal = expected;
      contact = null;
    } else if (event.kind === 'BattedBallDeclaredFair' || event.kind === 'LiveBallPlayEnded'
      || event.kind !== 'TakenPitchPlateCrossed' && event.kind !== 'SwingCompletedWithoutContact' && contact === null) {
      throw new Error('physical non-live closure contains an unresolved live ball');
    }
  }
  if (!terminal || contact !== null || !fields(timeline.status, ['kind', 'terminalCount'])
    || timeline.status.kind !== terminal.kind || !('terminalCount' in timeline.status)
    || json(timeline.status.terminalCount) !== json(terminal.terminalCount)) throw new Error('physical terminal status count differs');
};

/** Pure proposal from physical evidence; persistence, actors and adjudication authority remain Native responsibilities. */
export const derivePhysicalNonLiveClosure = (raw: PhysicalNonLiveClosureInput) => {
  const input = cloneInert(raw);
  if (!input || !fields(input, ['match', 'timeline', 'batterRunnerId', 'gameDay', 'effortPolicy', 'snapshotId', 'ruleTick', 'closureId', 'closureTick'])
    || !id(input.snapshotId) || !id(input.closureId) || !tick(input.ruleTick) || !tick(input.closureTick)
    || input.ruleTick < input.timeline.lastEventTick || input.closureTick < input.ruleTick) throw new Error('invalid physical non-live closure request');
  const effort = assessOfficialPhysicalPitchWorkload(input.timeline, input.effortPolicy, input.gameDay);
  if (!['walk', 'strikeout'].includes(input.timeline.status.kind)) throw new Error('actual physical play is not a terminal non-live plate appearance');
  assertTerminalCount(input.match, input.timeline);
  const walk = input.timeline.status.kind === 'walk';
  if (walk ? !id(input.batterRunnerId) : input.batterRunnerId !== null) throw new Error('physical closure batter context differs');
  const context: NonLiveOfficialContext = walk ? { kind: 'walk', batterRunnerId: input.batterRunnerId! } : { kind: 'strikeout' };
  const advancement = walk ? resolveWalkForcedAdvancement({ batterRunnerId: input.batterRunnerId!, bases: input.match.bases }) : null;
  let adjudication = createPlayAdjudicationLedger({ playId: input.match.playId, ruleProfileId: input.match.ruleProfileId, playEnd: null });
  adjudication = recordCorrectRuleSnapshot(adjudication, 0, { eventId: `physical-rule:${input.snapshotId}`, snapshotId: input.snapshotId,
    evidenceRevision: 1, tick: input.ruleTick, ruling: { outsAfter: input.match.outs + (walk ? 0 : 1),
      basesAfter: advancement?.bases ?? input.match.bases, scoredRunnerIds: advancement?.scoredRunnerIds ?? [] } });
  adjudication = closeOfficialPlay(adjudication, 1, { eventId: `physical-close:${input.closureId}`, closureId: input.closureId, tick: input.closureTick });
  const request = { match: input.match, timeline: input.timeline, adjudication, context };
  const nextMatch = deriveClosedNonLiveMatchState(request), classified = classifyClosedPlayForOfficialScoring({ ...request, kind: 'non_live' });
  if (classified.kind !== 'supported') throw new Error('physical non-live classification is unavailable');
  return Object.freeze({ context, adjudication, nextMatch, scoring: classified.record, effort });
};
