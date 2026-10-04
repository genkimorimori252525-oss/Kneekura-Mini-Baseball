import { createHash } from 'node:crypto';
import { ownedScheduledMotionArchiveEncoding } from './OwnedScheduledMotionArchive';
import { actorJson } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { AcceptedBattedWorldFieldExecution, DurableBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';
import type { DurableBattedWorldFieldAction } from './SqliteBattedWorldFieldStore';

const genericEncoding = (value: unknown) => {
  const json = actorJson(value); return Object.freeze({ json, hash: createHash('sha256').update(json).digest('hex') });
};
type Encoding = Readonly<{ json: string; hash: string }>;
// Called only after the full role-specific codec succeeded. Traverse descriptors,
// never property values via ordinary access, and do not relax that codec's budget.
const deeplyImmutable = (root: object): boolean => {
  const pending = [root], seen = new WeakSet<object>();
  while (pending.length) {
    const value = pending.pop()!;
    if (seen.has(value)) continue;
    if (!Object.isFrozen(value)) return false;
    seen.add(value);
    for (const key of Reflect.ownKeys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !('value' in descriptor)) return false;
      if (descriptor.value !== null && typeof descriptor.value === 'object') pending.push(descriptor.value);
    }
  }
  return true;
};
const encodingRole = <T extends object>(encode: (value: T) => Encoding) => {
  const values = new WeakMap<T, Encoding>();
  return (value: T): Encoding => {
    const prior = values.get(value); if (prior) return prior;
    const encoded = Object.freeze(encode(value));
    if (value !== null && typeof value === 'object' && deeplyImmutable(value)) values.set(value, encoded);
    return encoded;
  };
};
/** Internal pure encoding utility; callers cannot supply this to a Native reader. */
export const createOwnedScheduledMotionDependencyEncoding = () => Object.freeze({
  source: encodingRole<AcceptedBattedWorldFieldExecution>(genericEncoding),
  baseField: encodingRole<DurableBattedWorldFieldAction>(genericEncoding),
  snapshot: encodingRole<DurableBattedWorldFieldExecution>(ownedScheduledMotionArchiveEncoding),
});
