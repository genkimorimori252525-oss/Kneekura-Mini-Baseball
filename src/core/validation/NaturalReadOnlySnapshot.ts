import type {
  CanonicalMatchState,
} from '../model/CanonicalMatchState';
import type {
  CanonicalWorldSnapshot,
} from '../model/CanonicalWorldSnapshot';
import type {
  TimedMatchEvent,
} from '../model/TimedMatchEvent';
import {
  canonicalizeEvidence,
  createCanonicalEvidenceFingerprint,
} from './CanonicalEvidenceFingerprint';

export type NaturalReadOnlySnapshot = Readonly<{
  version: 1;
  match: CanonicalMatchState;
  world: CanonicalWorldSnapshot;
  events: readonly TimedMatchEvent[];
  publicMetadata: unknown | null;
  sourceFingerprint: string;
}>;

export type NaturalReadOnlySnapshotInput = Readonly<{
  match: CanonicalMatchState;
  world: CanonicalWorldSnapshot;
  events: readonly TimedMatchEvent[];
  publicMetadata?: unknown;
}>;

const cloneCanonical = <T>(
  value: T,
): T => (
  JSON.parse(
    canonicalizeEvidence(value),
  ) as T
);

const deepFreeze = <T>(
  value: T,
): T => {
  if (
    value === null
    || typeof value !== 'object'
    || Object.isFrozen(value)
  ) {
    return value;
  }

  const record = value as Record<
    string,
    unknown
  >;

  for (const key of Object.keys(record)) {
    deepFreeze(record[key]);
  }

  return Object.freeze(value);
};

export const createNaturalReadOnlySnapshot = (
  input: NaturalReadOnlySnapshotInput,
): NaturalReadOnlySnapshot => {
  const sourceEnvelope = {
    match: input.match,
    world: input.world,
    events: input.events,
  };

  const sourceFingerprint =
    createCanonicalEvidenceFingerprint(
      sourceEnvelope,
    );

  const match = cloneCanonical(input.match);
  const world = cloneCanonical(input.world);
  const events = cloneCanonical(input.events);
  const publicMetadata = (
    input.publicMetadata === undefined
      ? null
      : cloneCanonical(input.publicMetadata)
  );

  const snapshot: NaturalReadOnlySnapshot = {
    version: 1,
    match,
    world,
    events,
    publicMetadata,
    sourceFingerprint,
  };

  return deepFreeze(snapshot);
};
