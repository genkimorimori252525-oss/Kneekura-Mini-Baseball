import { createHash } from 'node:crypto';
import { ownedScheduledMotionArchiveEncoding } from './OwnedScheduledMotionArchive';
import { actorJson } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { AcceptedBattedWorldFieldExecution, DurableBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';
import type { DurableBattedWorldFieldAction } from './SqliteBattedWorldFieldStore';
import type { BattedWorldPiecewiseFieldAcquisitionPlan } from '../../core/sim/ball/BattedWorldPiecewiseFieldAcquisition';
import type { BattedWorldPiecewiseFieldThrowPlan } from '../../core/sim/ball/BattedWorldPiecewiseFieldThrow';

const genericEncoding = (value: unknown) => {
  const json = actorJson(value); return Object.freeze({ json, hash: createHash('sha256').update(json).digest('hex') });
};
type Encoding = Readonly<{ json: string; hash: string }>;
type EncodingRole = 'source' | 'baseField' | 'snapshot' | 'acquisition' | 'throw';
type EncodingScope = Readonly<{ identity: object; reusable: () => boolean;
  roles: Map<EncodingRole, WeakMap<object, Encoding>> }>;
let activeEncodingScope: EncodingScope | null = null;

/** Internal lexical byte-encoding scope, never a physical validation cache.
 * Only already codec-validated, deeply immutable identities can enter it. */
export const withOwnedScheduledMotionDependencyEncodingScope = <T>(identity: object | null,
  reusable: () => boolean, body: () => T): T => {
  const previous = activeEncodingScope;
  const scope = identity === null ? null : previous?.identity === identity ? previous
    : { identity, reusable, roles: new Map<EncodingRole, WeakMap<object, Encoding>>() };
  activeEncodingScope = scope;
  try { return body(); }
  finally { activeEncodingScope = previous; if (scope && scope !== previous) scope.roles.clear(); }
};
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
const encodingRole = <T extends object>(role: EncodingRole, encode: (value: T) => Encoding) => {
  const localValues = new WeakMap<object, Encoding>();
  return (value: T): Encoding => {
    const scope = activeEncodingScope;
    let values: WeakMap<object, Encoding> | undefined = localValues;
    if (scope) {
      if (!scope.reusable()) { scope.roles.clear(); values = undefined; }
      else {
        values = scope.roles.get(role);
        if (!values) { values = new WeakMap(); scope.roles.set(role, values); }
      }
    }
    const prior = values?.get(value); if (prior) return prior;
    const encoded = Object.freeze(encode(value));
    if (values && value !== null && typeof value === 'object' && deeplyImmutable(value)) values.set(value, encoded);
    return encoded;
  };
};
/** Internal pure encoding utility; callers cannot supply this to a Native reader. */
export const createOwnedScheduledMotionDependencyEncoding = () => Object.freeze({
  source: encodingRole<AcceptedBattedWorldFieldExecution>('source', genericEncoding),
  baseField: encodingRole<DurableBattedWorldFieldAction>('baseField', genericEncoding),
  snapshot: encodingRole<DurableBattedWorldFieldExecution>('snapshot', ownedScheduledMotionArchiveEncoding),
});

/** Pure comparison bytes only. Core plan/progress validation remains mandatory;
 * each caller owns fresh, separate acquisition/throw identity namespaces. */
export const createOwnedScheduledMotionPlanEncoding = () => Object.freeze({
  acquisition: encodingRole<BattedWorldPiecewiseFieldAcquisitionPlan>('acquisition', genericEncoding),
  throw: encodingRole<BattedWorldPiecewiseFieldThrowPlan>('throw', genericEncoding),
});
