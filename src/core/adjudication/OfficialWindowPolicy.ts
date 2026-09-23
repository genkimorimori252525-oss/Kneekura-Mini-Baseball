import type { RuleProfile } from '../rules/RuleProfile';
import {
  closeOfficialStateWindow,
  getOfficialStateWindows,
  openOfficialStateWindow,
  type OfficialStateWindow,
  type OfficialStateWindowKind,
  type PlayAdjudicationLedger,
} from './PlayAdjudicationLedger';

export type ProfiledWindowOpenInput = Readonly<{
  profile: RuleProfile;
  eventId: string;
  tick: number;
  windowId: string;
  windowKind: OfficialStateWindowKind;
}>;

export type OfficialWindowBoundary = 'next_play_fence' | 'defense_left_field' | 'expiration';

export type ProfiledWindowBoundaryInput = Readonly<{
  profile: RuleProfile;
  boundary: OfficialWindowBoundary;
  tick: number;
  eventIdPrefix: string;
  inningEnding: boolean;
}>;

export type ProfiledWindowTiming = 'timely' | 'expired' | 'simultaneous_unresolved';

const cloneInert = <T>(input: T): T => {
  const ancestors = new Set<object>();
  let nodes = 0;
  const visit = (value: unknown, depth: number): unknown => {
    nodes += 1;
    if (nodes > 100_000 || depth > 64) throw new Error('official window input exceeds size limits');
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw new Error('official window input must be finite');
      return value;
    }
    if (typeof value !== 'object') throw new Error('official window input must contain inert data only');
    if (ancestors.has(value)) throw new Error('official window input must not contain cycles');
    ancestors.add(value);
    const result: unknown = Array.isArray(value) ? [] : {};
    if (!Array.isArray(value)) {
      const prototype = Object.getPrototypeOf(value);
      if (prototype !== Object.prototype && prototype !== null) {
        throw new Error('official window input must be a plain inert object');
      }
    } else if (Reflect.ownKeys(value).length !== value.length + 1) {
      throw new Error('official window input must be a dense inert array');
    }
    for (const key of Reflect.ownKeys(value)) {
      if (Array.isArray(value) && key === 'length') continue;
      if (typeof key !== 'string') throw new Error('official window input must not contain symbols');
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
        throw new Error('official window input must not contain accessors');
      }
      Object.defineProperty(result, key, {
        value: visit(descriptor.value, depth + 1), enumerable: true, writable: true, configurable: true,
      });
    }
    ancestors.delete(value);
    return result;
  };
  return visit(input, 0) as T;
};

const tick = (value: number): number => {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('official window tick must be a non-negative safe integer');
  return value;
};

const requireProfile = (ledger: PlayAdjudicationLedger, profile: RuleProfile): void => {
  if (ledger.ruleProfileId !== profile.id) throw new Error('RuleProfile id must match adjudication ledger');
};

const policyFor = (profile: RuleProfile, kind: OfficialStateWindowKind): {
  available: boolean;
  expiresAfterTicks?: number;
} => {
  const policy = profile.officialWindows?.[kind];
  if (policy?.available !== true) throw new Error('official-state window is not configured by RuleProfile');
  if ('expiresAfterTicks' in policy && policy.expiresAfterTicks !== undefined) {
    if (!Number.isSafeInteger(policy.expiresAfterTicks) || policy.expiresAfterTicks <= 0) {
      throw new Error('official-state window expiration must be a positive safe integer');
    }
  }
  return policy;
};

const deadlineFor = (stateWindow: OfficialStateWindow, profile: RuleProfile): number | null => {
  const duration = policyFor(profile, stateWindow.windowKind).expiresAfterTicks;
  if (duration === undefined) return null;
  const deadline = stateWindow.openedAtTick + duration;
  if (!Number.isSafeInteger(deadline)) throw new Error('official-state window expiration overflows tick');
  return deadline;
};

const timingAtClosure = (stateWindow: OfficialStateWindow, profile: RuleProfile): ProfiledWindowTiming => {
  if (stateWindow.closeReason === 'expired') return 'expired';
  if (stateWindow.windowKind !== 'appeal') return 'simultaneous_unresolved';
  const sameTick = profile.appeal.sameTickWindowCloseResolution;
  return sameTick === 'appeal_wins' ? 'timely'
    : sameTick === 'window_close_wins' ? 'expired' : 'simultaneous_unresolved';
};

export const openRuleProfileOfficialStateWindow = (
  ledger: PlayAdjudicationLedger,
  expectedRevision: number,
  input: ProfiledWindowOpenInput,
): PlayAdjudicationLedger => {
  const safeLedger = cloneInert(ledger);
  const request = cloneInert(input);
  requireProfile(safeLedger, request.profile);
  policyFor(request.profile, request.windowKind);
  return openOfficialStateWindow(safeLedger, expectedRevision, {
    eventId: request.eventId,
    tick: request.tick,
    windowId: request.windowId,
    windowKind: request.windowKind,
  });
};

export const advanceRuleProfileOfficialWindows = (
  ledger: PlayAdjudicationLedger,
  expectedRevision: number,
  input: ProfiledWindowBoundaryInput,
): PlayAdjudicationLedger => {
  const safeLedger = cloneInert(ledger);
  const request = cloneInert(input);
  requireProfile(safeLedger, request.profile);
  tick(request.tick);
  if (typeof request.eventIdPrefix !== 'string' || request.eventIdPrefix.length === 0) {
    throw new Error('eventIdPrefix must not be empty');
  }
  if (typeof request.inningEnding !== 'boolean') throw new Error('inningEnding must be boolean');
  if (request.boundary !== 'next_play_fence' && request.boundary !== 'defense_left_field' && request.boundary !== 'expiration') {
    throw new Error('unknown official window boundary');
  }
  const windows = getOfficialStateWindows(safeLedger);
  if (safeLedger.revision !== expectedRevision) throw new Error('stale adjudication ledger revision');
  const lastTick = safeLedger.events.at(-1)?.tick ?? safeLedger.playEnd?.tick ?? 0;
  if (request.tick < lastTick) throw new Error('official window boundary cannot precede ledger history');
  let next = safeLedger;
  for (const stateWindow of windows) {
    if (stateWindow.closedAtTick !== null) continue;
    const deadline = deadlineFor(stateWindow, request.profile);
    let reason: 'expired' | 'next_play_fence' | 'defense_left_field' | null = null;
    if (deadline !== null && request.tick > deadline) reason = 'expired';
    else if (request.boundary === 'next_play_fence' && stateWindow.windowKind === 'appeal'
      && request.profile.appeal.nextPitchOrPlayClosesWindow) reason = 'next_play_fence';
    else if (request.boundary === 'defense_left_field' && stateWindow.windowKind === 'appeal'
      && request.inningEnding && request.profile.appeal.defenseLeavingFieldClosesInningEndingWindow) {
      reason = 'defense_left_field';
    }
    if (reason === null && request.boundary === 'next_play_fence') {
      throw new Error('official-state window remains open under RuleProfile');
    }
    if (reason !== null) {
      next = closeOfficialStateWindow(next, next.revision, {
        eventId: `${request.eventIdPrefix}:${stateWindow.windowId}`,
        tick: request.tick,
        windowId: stateWindow.windowId,
        reason,
      });
    }
  }
  return next;
};

export const evaluateRuleProfileOfficialWindowTiming = (
  ledger: PlayAdjudicationLedger,
  profileInput: RuleProfile,
  windowId: string,
  attemptTick: number,
): ProfiledWindowTiming => {
  const safeLedger = cloneInert(ledger);
  const profile = cloneInert(profileInput);
  requireProfile(safeLedger, profile);
  tick(attemptTick);
  const stateWindow = getOfficialStateWindows(safeLedger).find((candidate) => candidate.windowId === windowId);
  if (stateWindow === undefined) throw new Error('official-state window does not exist');
  if (attemptTick < stateWindow.openedAtTick) throw new Error('attempt cannot precede official-state window');
  const deadline = deadlineFor(stateWindow, profile);
  if (stateWindow.closedAtTick !== null && (deadline === null || stateWindow.closedAtTick <= deadline)) {
    if (attemptTick > stateWindow.closedAtTick) return 'expired';
    if (attemptTick === stateWindow.closedAtTick) return timingAtClosure(stateWindow, profile);
  }
  if (deadline !== null && attemptTick > deadline) return 'expired';
  if (deadline !== null && attemptTick === deadline) return 'simultaneous_unresolved';
  if (stateWindow.closedAtTick === null || attemptTick < stateWindow.closedAtTick) return 'timely';
  if (attemptTick > stateWindow.closedAtTick) return 'expired';
  return timingAtClosure(stateWindow, profile);
};
