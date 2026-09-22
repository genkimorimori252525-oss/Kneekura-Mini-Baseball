import type { CanonicalMatchState } from '../model/CanonicalMatchState';
import {
  createCanonicalPlateAppearanceTimeline,
  type CanonicalPlateAppearanceTimeline,
} from '../sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import {
  deriveClosedLiveBallMatchState,
  getOfficialPlayClosure,
  type PlayAdjudicationLedger,
} from './PlayAdjudicationLedger';

export type OfficialStateApplicationReceipt = Readonly<{
  applicationId: string;
  closureId: string;
  previousPlayId: number;
  durableRevision: number;
  appliedMatchState: CanonicalMatchState;
}>;

export type ConfirmDurableClosedLiveBallStateApplicationInput = Readonly<{
  match: CanonicalMatchState;
  physicalTimeline: CanonicalPlateAppearanceTimeline;
  adjudication: PlayAdjudicationLedger;
  persistedMatchState: CanonicalMatchState;
  applicationId: string;
  durableRevision: number;
}>;

export type NextLiveBallPlayActivationInput = Readonly<{
  match: CanonicalMatchState;
  physicalTimeline: CanonicalPlateAppearanceTimeline;
  adjudication: PlayAdjudicationLedger;
  application: OfficialStateApplicationReceipt;
  nextStartedAtTick: number;
}>;

export type NextLiveBallPlayActivation = Readonly<{
  previousPlayId: number;
  closureId: string;
  applicationId: string;
  durableRevision: number;
  nextMatchState: CanonicalMatchState;
  nextTimeline: CanonicalPlateAppearanceTimeline;
}>;

const cloneInertData = <T>(input: T, path = 'nextPlayActivation'): T => {
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
    if (typeof value !== 'object') throw new Error(`${currentPath} must contain inert data only`);
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
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${name} must not be empty`);
  return value;
};

const nonNegativeRevision = (value: number, name: string): number => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative safe integer`);
  }
  return value;
};

const sameMatchState = (first: CanonicalMatchState, second: CanonicalMatchState): boolean => (
  first.ruleProfileId === second.ruleProfileId
  && first.inning === second.inning
  && first.half === second.half
  && first.outs === second.outs
  && first.balls === second.balls
  && first.strikes === second.strikes
  && first.bases.first === second.bases.first
  && first.bases.second === second.bases.second
  && first.bases.third === second.bases.third
  && first.score.away === second.score.away
  && first.score.home === second.score.home
  && first.playId === second.playId
);

const freezeMatchState = (state: CanonicalMatchState): CanonicalMatchState => Object.freeze({
  ...state,
  bases: Object.freeze({ ...state.bases }),
  score: Object.freeze({ ...state.score }),
});

const validateReceipt = (input: OfficialStateApplicationReceipt): OfficialStateApplicationReceipt => {
  const receipt = cloneInertData(input, 'nextPlayActivation.application');
  return Object.freeze({
    applicationId: nonEmptyId(receipt.applicationId, 'applicationId'),
    closureId: nonEmptyId(receipt.closureId, 'closureId'),
    previousPlayId: nonNegativeRevision(receipt.previousPlayId, 'previousPlayId'),
    durableRevision: nonNegativeRevision(receipt.durableRevision, 'durableRevision'),
    appliedMatchState: freezeMatchState(receipt.appliedMatchState),
  });
};

export const confirmDurableClosedLiveBallStateApplication = (
  input: ConfirmDurableClosedLiveBallStateApplicationInput,
): OfficialStateApplicationReceipt => {
  const request = cloneInertData(input, 'durableOfficialStateApplication');
  const closure = getOfficialPlayClosure(request.adjudication);
  if (closure === null) {
    throw new Error('official play must be closed before confirming durable MatchState application');
  }
  const expected = deriveClosedLiveBallMatchState(
    request.match,
    request.physicalTimeline,
    request.adjudication,
  );
  if (!sameMatchState(expected, request.persistedMatchState)) {
    throw new Error('persisted MatchState must match the officially derived state');
  }
  return Object.freeze({
    applicationId: nonEmptyId(request.applicationId, 'applicationId'),
    closureId: closure.closureId,
    previousPlayId: request.match.playId,
    durableRevision: nonNegativeRevision(request.durableRevision, 'durableRevision'),
    appliedMatchState: freezeMatchState(request.persistedMatchState),
  });
};

export const activateNextLiveBallPlay = (
  input: NextLiveBallPlayActivationInput,
): NextLiveBallPlayActivation => {
  const request = cloneInertData(input);
  const closure = getOfficialPlayClosure(request.adjudication);
  if (closure === null) {
    throw new Error('official play must be closed before activating the next play');
  }
  if (!Number.isSafeInteger(request.nextStartedAtTick) || request.nextStartedAtTick < 0) {
    throw new Error('nextStartedAtTick must be a non-negative safe integer tick');
  }
  if (request.nextStartedAtTick < closure.closedAtTick) {
    throw new Error('next play cannot start before OfficialPlayClosure');
  }
  if (request.application === null || request.application === undefined) {
    throw new Error('durable official MatchState application is required');
  }

  const application = validateReceipt(request.application);
  if (
    application.closureId !== closure.closureId
    || application.previousPlayId !== request.match.playId
  ) {
    throw new Error('durable application receipt does not match OfficialPlayClosure');
  }

  const expected = deriveClosedLiveBallMatchState(
    request.match,
    request.physicalTimeline,
    request.adjudication,
  );
  if (!sameMatchState(expected, application.appliedMatchState)) {
    throw new Error('durable application receipt does not match the officially derived MatchState');
  }

  const nextMatchState = application.appliedMatchState;
  const nextTimeline = createCanonicalPlateAppearanceTimeline(
    nextMatchState,
    request.nextStartedAtTick,
  );

  return Object.freeze({
    previousPlayId: request.match.playId,
    closureId: closure.closureId,
    applicationId: application.applicationId,
    durableRevision: application.durableRevision,
    nextMatchState,
    nextTimeline,
  });
};
