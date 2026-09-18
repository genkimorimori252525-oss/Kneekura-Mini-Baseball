import {
  fnv1a32,
} from '../rng/DeterministicRng';

type CanonicalEvidencePrimitive =
  | null
  | boolean
  | number
  | string;

const unsupported = (
  value: unknown,
): never => {
  const kind = typeof value;

  if (kind === 'undefined') {
    throw new Error(
      'canonical evidence does not support undefined',
    );
  }

  throw new Error(
    `canonical evidence does not support ${kind}`,
  );
};

const assertPlainObject = (
  value: object,
): void => {
  const prototype = Object.getPrototypeOf(value);
  if (
    prototype !== Object.prototype
    && prototype !== null
  ) {
    throw new Error(
      'canonical evidence supports plain objects only',
    );
  }
};

const serializePrimitive = (
  value: CanonicalEvidencePrimitive,
): string => {
  if (value === null) {
    return 'null';
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(
        'canonical evidence numbers must be finite',
      );
    }

    return Object.is(value, -0)
      ? '0'
      : String(value);
  }

  return JSON.stringify(value);
};

const serializeCanonicalValue = (
  value: unknown,
): string => {
  if (
    value === null
    || typeof value === 'boolean'
    || typeof value === 'number'
    || typeof value === 'string'
  ) {
    return serializePrimitive(value);
  }

  if (Array.isArray(value)) {
    return (
      '['
      + value.map(
        (entry) => serializeCanonicalValue(entry),
      ).join(',')
      + ']'
    );
  }

  if (typeof value !== 'object') {
    return unsupported(value);
  }

  assertPlainObject(value);

  const record = value as Record<
    string,
    unknown
  >;
  const keys = Object.keys(record).sort(
    (first, second) => {
      if (first < second) {
        return -1;
      }
      if (first > second) {
        return 1;
      }
      return 0;
    },
  );

  return (
    '{'
    + keys.map((key) => (
      JSON.stringify(key)
      + ':'
      + serializeCanonicalValue(record[key])
    )).join(',')
    + '}'
  );
};

const hex32 = (
  value: number,
): string => (
  (value >>> 0).toString(16).padStart(8, '0')
);

export const canonicalizeEvidence = (
  value: unknown,
): string => (
  serializeCanonicalValue(value)
);

export const createCanonicalEvidenceFingerprint = (
  value: unknown,
): string => {
  const serialized = canonicalizeEvidence(value);

  const first = fnv1a32(
    `kneekura-evidence-v1:a:${serialized}`,
  );
  const second = fnv1a32(
    `kneekura-evidence-v1:b:${serialized}`,
  );

  return hex32(first) + hex32(second);
};