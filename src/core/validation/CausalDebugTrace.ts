import {
  canonicalizeEvidence,
  createCanonicalEvidenceFingerprint,
} from './CanonicalEvidenceFingerprint';

export type CausalDebugStage =
  | 'input'
  | 'perception'
  | 'strategy'
  | 'decision'
  | 'execution'
  | 'baserunning'
  | 'rules'
  | 'final_state';

export type CausalDebugTraceEntry = Readonly<{
  availableAtTick: number;
  sequence: number;
  stage: CausalDebugStage;
  kind: string;
  evidence: unknown;
}>;

export type CausalDebugTraceInput = Readonly<{
  scenarioId: string;
  matchSeed: number;
  playId: number;
  entries: readonly CausalDebugTraceEntry[];
}>;

export type CausalDebugTrace = Readonly<{
  version: 1;
  scenarioId: string;
  matchSeed: number;
  playId: number;
  entries: readonly CausalDebugTraceEntry[];
  fingerprint: string;
}>;

const validateNonNegativeSafeInteger = (
  name: string,
  value: number,
): void => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(
      `${name} must be a non-negative safe integer`,
    );
  }
};

const validateEntry = (
  entry: CausalDebugTraceEntry,
): void => {
  validateNonNegativeSafeInteger(
    'availableAtTick',
    entry.availableAtTick,
  );
  validateNonNegativeSafeInteger(
    'sequence',
    entry.sequence,
  );

  if (entry.kind.length === 0) {
    throw new Error(
      'causal debug trace kind must not be empty',
    );
  }

  canonicalizeEvidence(entry.evidence);
};

const assertOrdered = (
  entries: readonly CausalDebugTraceEntry[],
): void => {
  for (
    let index = 1;
    index < entries.length;
    index += 1
  ) {
    const previous = entries[index - 1];
    const current = entries[index];

    if (
      current.availableAtTick
        < previous.availableAtTick
      || (
        current.availableAtTick
          === previous.availableAtTick
        && current.sequence
          <= previous.sequence
      )
    ) {
      throw new Error(
        'causal debug trace entries must be ordered by tick then sequence',
      );
    }
  }
};

export const createCausalDebugTrace = (
  input: CausalDebugTraceInput,
): CausalDebugTrace => {
  if (input.scenarioId.length === 0) {
    throw new Error(
      'scenarioId must not be empty',
    );
  }
  if (!Number.isSafeInteger(input.matchSeed)) {
    throw new Error(
      'matchSeed must be a safe integer',
    );
  }
  validateNonNegativeSafeInteger(
    'playId',
    input.playId,
  );

  for (const entry of input.entries) {
    validateEntry(entry);
  }
  assertOrdered(input.entries);

  const base = {
    version: 1 as const,
    scenarioId: input.scenarioId,
    matchSeed: input.matchSeed,
    playId: input.playId,
    entries: input.entries.map((entry) => ({
      availableAtTick:
        entry.availableAtTick,
      sequence: entry.sequence,
      stage: entry.stage,
      kind: entry.kind,
      evidence: entry.evidence,
    })),
  };

  return {
    ...base,
    fingerprint:
      createCanonicalEvidenceFingerprint(base),
  };
};
