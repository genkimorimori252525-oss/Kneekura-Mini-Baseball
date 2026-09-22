import type { CanonicalMatchState } from '../model/CanonicalMatchState';
import {
  createCanonicalPlateAppearanceTimeline,
  type CanonicalPlateAppearanceTimeline,
} from '../sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import {
  applyStrikeoutPlateAppearanceToMatchState,
  applyWalkPlateAppearanceToMatchState,
} from '../sim/plateAppearance/PlateAppearanceMatchState';
import { resolveWalkForcedAdvancement } from '../rules/WalkAdvancementRule';
import {
  getOfficialPlayClosure,
  type OfficialGameplayRuling,
  type PlayAdjudicationLedger,
} from './PlayAdjudicationLedger';
import type { OfficialStateApplicationReceipt } from './NextPlayActivation';

export type NonLiveOfficialContext =
  | Readonly<{ kind: 'strikeout' }>
  | Readonly<{ kind: 'walk'; batterRunnerId: string }>;

export type DeriveClosedNonLiveMatchStateInput = Readonly<{
  match: CanonicalMatchState;
  timeline: CanonicalPlateAppearanceTimeline;
  adjudication: PlayAdjudicationLedger;
  context: NonLiveOfficialContext;
}>;

export type ConfirmDurableClosedNonLiveStateApplicationInput =
  DeriveClosedNonLiveMatchStateInput & Readonly<{
    persistedMatchState: CanonicalMatchState;
    applicationId: string;
    durableRevision: number;
  }>;

export type NextNonLivePlateAppearanceActivationInput =
  DeriveClosedNonLiveMatchStateInput & Readonly<{
    application: OfficialStateApplicationReceipt;
    nextStartedAtTick: number;
  }>;

export type NextNonLivePlateAppearanceActivation = Readonly<{
  previousPlayId: number;
  closureId: string;
  applicationId: string;
  durableRevision: number;
  nextMatchState: CanonicalMatchState;
  nextTimeline: CanonicalPlateAppearanceTimeline;
}>;

const cloneInertData = <T>(input: T, path = 'nonLiveOfficial'): T => {
  const ancestors = new Set<object>();
  let nodes = 0;

  const visit = (value: unknown, currentPath: string, depth: number): unknown => {
    nodes += 1;
    if (nodes > 100_000 || depth > 64) {
      throw new Error(`${currentPath} exceeds inert-data depth or size limits`);
    }
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw new Error(`${currentPath} must be finite`);
      return value === 0 ? 0 : value;
    }
    if (typeof value !== 'object') {
      throw new Error(`${currentPath} must contain inert data only`);
    }
    if (ancestors.has(value)) throw new Error(`${currentPath} must not contain cycles`);
    ancestors.add(value);

    let result: unknown;
    if (Array.isArray(value)) {
      if (Reflect.ownKeys(value).length !== value.length + 1) {
        throw new Error(`${currentPath} must be a dense inert array`);
      }
      const array: unknown[] = [];
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
          throw new Error(`${currentPath} must not contain active array properties`);
        }
        array.push(visit(descriptor.value, `${currentPath}[${index}]`, depth + 1));
      }
      result = array;
    } else {
      const prototype = Object.getPrototypeOf(value);
      if (prototype !== Object.prototype && prototype !== null) {
        throw new Error(`${currentPath} must be a plain inert object`);
      }
      const record: Record<string, unknown> = {};
      for (const key of Reflect.ownKeys(value)) {
        if (typeof key !== 'string') throw new Error(`${currentPath} must not contain symbol properties`);
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
          throw new Error(`${currentPath} must not contain active properties`);
        }
        Object.defineProperty(record, key, {
          value: visit(descriptor.value, `${currentPath}.${key}`, depth + 1),
          enumerable: true,
          writable: true,
          configurable: true,
        });
      }
      result = record;
    }

    ancestors.delete(value);
    return result;
  };

  return visit(input, path, 0) as T;
};

const nonEmptyId = (value: string, name: string): string => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${name} must not be empty`);
  }
  return value;
};

const nonNegativeSafeInteger = (value: number, name: string): number => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative safe integer`);
  }
  return value;
};

const sameBases = (
  first: CanonicalMatchState['bases'],
  second: CanonicalMatchState['bases'],
): boolean => (
  first.first === second.first
  && first.second === second.second
  && first.third === second.third
);

const sameStrings = (first: readonly string[], second: readonly string[]): boolean => (
  first.length === second.length
  && first.every((value, index) => value === second[index])
);

const sameRuling = (
  first: OfficialGameplayRuling,
  second: OfficialGameplayRuling,
): boolean => (
  first.outsAfter === second.outsAfter
  && sameBases(first.basesAfter, second.basesAfter)
  && sameStrings(first.scoredRunnerIds, second.scoredRunnerIds)
);

const sameMatchState = (
  first: CanonicalMatchState,
  second: CanonicalMatchState,
): boolean => (
  first.ruleProfileId === second.ruleProfileId
  && first.inning === second.inning
  && first.half === second.half
  && first.outs === second.outs
  && first.balls === second.balls
  && first.strikes === second.strikes
  && sameBases(first.bases, second.bases)
  && first.score.away === second.score.away
  && first.score.home === second.score.home
  && first.playId === second.playId
);

const freezeMatchState = (state: CanonicalMatchState): CanonicalMatchState => Object.freeze({
  ...state,
  bases: Object.freeze({ ...state.bases }),
  score: Object.freeze({ ...state.score }),
});

const validateContextMatchesTimeline = (
  context: NonLiveOfficialContext,
  timeline: CanonicalPlateAppearanceTimeline,
): void => {
  if (context.kind === 'strikeout') {
    if (timeline.status.kind !== 'strikeout') {
      throw new Error('non-live application context must match the terminal timeline');
    }
    return;
  }
  if (context.kind === 'walk') {
    nonEmptyId(context.batterRunnerId, 'batterRunnerId');
    if (timeline.status.kind !== 'walk') {
      throw new Error('non-live application context must match the terminal timeline');
    }
    return;
  }
  throw new Error('unknown non-live official application context');
};

const expectedRuling = (
  match: CanonicalMatchState,
  context: NonLiveOfficialContext,
): OfficialGameplayRuling => {
  if (context.kind === 'strikeout') {
    return Object.freeze({
      outsAfter: match.outs + 1,
      basesAfter: Object.freeze({ ...match.bases }),
      scoredRunnerIds: Object.freeze([]),
    });
  }

  const advancement = resolveWalkForcedAdvancement({
    batterRunnerId: context.batterRunnerId,
    bases: match.bases,
  });
  return Object.freeze({
    outsAfter: match.outs,
    basesAfter: Object.freeze({ ...advancement.bases }),
    scoredRunnerIds: Object.freeze([...advancement.scoredRunnerIds]),
  });
};

const deriveValidated = (
  input: DeriveClosedNonLiveMatchStateInput,
): Readonly<{
  request: DeriveClosedNonLiveMatchStateInput;
  closureId: string;
  closedAtTick: number;
  derived: CanonicalMatchState;
}> => {
  const request = cloneInertData(input, 'nonLiveOfficial.derive');
  const closure = getOfficialPlayClosure(request.adjudication);
  if (closure === null) {
    throw new Error('official play must be closed before deriving non-live MatchState');
  }
  if (closure.playEnd !== null) {
    throw new Error('non-live official application requires playEnd: null');
  }
  if (
    request.match.playId !== request.timeline.playId
    || request.match.playId !== request.adjudication.playId
  ) {
    throw new Error('non-live playId must match MatchState, timeline, and adjudication ledger');
  }
  if (request.match.ruleProfileId !== request.adjudication.ruleProfileId) {
    throw new Error('non-live adjudication rule profile must match CanonicalMatchState');
  }
  validateContextMatchesTimeline(request.context, request.timeline);

  const canonicalRuling = expectedRuling(request.match, request.context);
  if (!sameRuling(canonicalRuling, closure.finalRuling.gameplay)) {
    throw new Error('OfficialPlayClosure does not match the canonical non-live rule result');
  }

  const derived = request.context.kind === 'strikeout'
    ? applyStrikeoutPlateAppearanceToMatchState(request.match, request.timeline)
    : applyWalkPlateAppearanceToMatchState(
        request.match,
        request.timeline,
        request.context.batterRunnerId,
      );

  return Object.freeze({
    request,
    closureId: closure.closureId,
    closedAtTick: closure.closedAtTick,
    derived: freezeMatchState(derived),
  });
};

export const deriveClosedNonLiveMatchState = (
  input: DeriveClosedNonLiveMatchStateInput,
): CanonicalMatchState => deriveValidated(input).derived;

export const confirmDurableClosedNonLiveStateApplication = (
  input: ConfirmDurableClosedNonLiveStateApplicationInput,
): OfficialStateApplicationReceipt => {
  const request = cloneInertData(input, 'nonLiveOfficial.confirm');
  const validated = deriveValidated(request);
  if (!sameMatchState(validated.derived, request.persistedMatchState)) {
    throw new Error('persisted MatchState must match the officially derived state');
  }
  return Object.freeze({
    applicationId: nonEmptyId(request.applicationId, 'applicationId'),
    closureId: validated.closureId,
    previousPlayId: request.match.playId,
    durableRevision: nonNegativeSafeInteger(request.durableRevision, 'durableRevision'),
    appliedMatchState: freezeMatchState(request.persistedMatchState),
  });
};

export const activateNextNonLivePlateAppearance = (
  input: NextNonLivePlateAppearanceActivationInput,
): NextNonLivePlateAppearanceActivation => {
  const request = cloneInertData(input, 'nonLiveOfficial.activate');
  const validated = deriveValidated(request);

  if (!Number.isSafeInteger(request.nextStartedAtTick) || request.nextStartedAtTick < 0) {
    throw new Error('nextStartedAtTick must be a non-negative safe integer tick');
  }
  if (request.nextStartedAtTick < validated.closedAtTick) {
    throw new Error('next plate appearance cannot start before OfficialPlayClosure');
  }
  if (request.application === null || request.application === undefined) {
    throw new Error('durable official MatchState application is required');
  }
  const application = cloneInertData(request.application, 'nonLiveOfficial.application');
  nonEmptyId(application.applicationId, 'applicationId');
  nonEmptyId(application.closureId, 'closureId');
  nonNegativeSafeInteger(application.previousPlayId, 'previousPlayId');
  nonNegativeSafeInteger(application.durableRevision, 'durableRevision');

  if (
    application.closureId !== validated.closureId
    || application.previousPlayId !== request.match.playId
  ) {
    throw new Error('durable application receipt does not match OfficialPlayClosure');
  }
  if (!sameMatchState(validated.derived, application.appliedMatchState)) {
    throw new Error('durable application receipt does not match the officially derived MatchState');
  }

  const nextMatchState = freezeMatchState(application.appliedMatchState);
  const nextTimeline = createCanonicalPlateAppearanceTimeline(
    nextMatchState,
    request.nextStartedAtTick,
  );
  return Object.freeze({
    previousPlayId: request.match.playId,
    closureId: validated.closureId,
    applicationId: application.applicationId,
    durableRevision: application.durableRevision,
    nextMatchState,
    nextTimeline,
  });
};
