import { createRosterState } from '../../core/world/roster/RosterState';
import type { RosterState } from '../../core/world/roster/RosterTypes';

const ROSTER_KEYS = 'careerId,effectiveDay,players,profiles,revision,units';
const sortedJson = (value: unknown): string => JSON.stringify(value, (_key, item: unknown) =>
  item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);

/**
 * Ordinary evidence retains 100k nodes. Complete Core-validated global rosters
 * have a separate 1M-node transport budget (the 234×50 fixture uses 212,668).
 * A composite has at most 4M nodes; these bounds are not League roster quotas.
 * No Source authority, accepted revision or identity is inferred by this codec.
 */
export const cloneRosterEvidence = <T>(input: T): T => {
  const ancestors = new Set<object>();
  const ordinary = { nodes: 0, limit: 100_000 };
  let total = 0;
  const data = (object: object, key: string): unknown => {
    const descriptor = Object.getOwnPropertyDescriptor(object, key);
    if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) throw new Error('roster evidence rejects accessors or sparse data');
    return descriptor.value;
  };
  const visit = (item: unknown, depth: number, budget = ordinary, withinRoster = false): unknown => {
    total += 1;
    if (total > 4_000_000 || depth > 64) throw new Error('roster evidence exceeds size limits');
    if (item === null || typeof item === 'string' || typeof item === 'boolean'
      || typeof item === 'number' && Number.isFinite(item)) {
      budget.nodes += 1;
      if (budget.nodes > budget.limit) throw new Error('roster evidence exceeds size limits');
      return item;
    }
    if (typeof item !== 'object' || ancestors.has(item)) throw new Error('roster evidence requires acyclic inert data');
    const array = Array.isArray(item);
    if (!array && Object.getPrototypeOf(item) !== Object.prototype && Object.getPrototypeOf(item) !== null) {
      throw new Error('roster evidence requires plain objects');
    }
    const keys = Reflect.ownKeys(item);
    if (array && keys.length !== item.length + 1) throw new Error('roster evidence requires dense arrays');
    for (const key of keys) {
      if (array && key === 'length') continue;
      if (typeof key !== 'string') throw new Error('roster evidence rejects symbols');
      data(item, key);
    }
    const roster = !withinRoster && !array && (keys as string[]).slice().sort().join(',') === ROSTER_KEYS;
    const local = roster ? { nodes: 0, limit: 1_000_000 } : budget;
    local.nodes += 1;
    if (local.nodes > local.limit) throw new Error('roster evidence exceeds size limits');
    // Count the roster reference in enclosing evidence, without sharing its population budget.
    if (roster && ++budget.nodes > budget.limit) throw new Error('roster evidence exceeds size limits');
    ancestors.add(item);
    let result: unknown;
    if (array) {
      const out: unknown[] = [];
      for (let index = 0; index < item.length; index += 1) out.push(visit(data(item, String(index)), depth + 1, local, withinRoster || roster));
      result = out;
    } else {
      result = Object.fromEntries((keys as string[]).sort().map((key) => [key, visit(data(item, key), depth + 1, local, withinRoster || roster)]));
    }
    ancestors.delete(item);
    if (roster) {
      const validated = createRosterState(result as RosterState);
      if (sortedJson(validated) !== sortedJson(result)) throw new Error('roster evidence does not match the complete Core schema');
    }
    return result;
  };
  return visit(input, 0) as T;
};

/** Same canonical bytes as existing small Native DTOs, including nested rosters. */
export const canonicalRosterEvidenceJson = (value: unknown): string => sortedJson(cloneRosterEvidence(value));
