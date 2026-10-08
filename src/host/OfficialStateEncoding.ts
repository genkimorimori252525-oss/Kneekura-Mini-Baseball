import { createHash } from 'node:crypto';

const stable = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stable);
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = Object.create(null);
    for (const key of Object.keys(value).sort()) result[key] = stable((value as Record<string, unknown>)[key]);
    return result;
  }
  return value;
};

const serialized = (value: unknown): string => JSON.stringify(stable(value));
const hash = (value: unknown): string => createHash('sha256').update(serialized(value)).digest('hex');

export { serialized as officialStateSerialized, hash as officialStateHash };
