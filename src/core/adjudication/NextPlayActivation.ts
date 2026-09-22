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

export type NextLiveBallPlayActivationInput = Readonly<{
  match: CanonicalMatchState;
  physicalTimeline: CanonicalPlateAppearanceTimeline;
  adjudication: PlayAdjudicationLedger;
  nextStartedAtTick: number;
}>;

export type NextLiveBallPlayActivation = Readonly<{
  previousPlayId: number;
  closureId: string;
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
        if (typeof key !== 'string') {
          throw new Error(`${currentPath} must not contain symbol properties`);
        }
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

  const nextMatchState = deriveClosedLiveBallMatchState(
    request.match,
    request.physicalTimeline,
    request.adjudication,
  );
  const nextTimeline = createCanonicalPlateAppearanceTimeline(
    nextMatchState,
    request.nextStartedAtTick,
  );

  return Object.freeze({
    previousPlayId: request.match.playId,
    closureId: closure.closureId,
    nextMatchState,
    nextTimeline,
  });
};
