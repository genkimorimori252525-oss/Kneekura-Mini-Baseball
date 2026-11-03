/** Internal ownership check for caches populated after cloneInert + validation
 * + recursive freeze. A frozen shell, mutable knot, accessor, inherited value
 * or non-inert member cannot become a trusted numerical parameter. This is
 * only performed at registration, never at each integration stage. */
export function assertDeepFrozenInertPhysicsV98(input: unknown): void {
  const ancestors = new Set<object>();
  let nodes = 0;
  const invalid = () => { throw new Error('immutable physics cache requires deeply frozen inert data'); };
  const visit = (value: unknown, depth: number): void => {
    nodes++;
    if (nodes > 100_000 || depth > 64) invalid();
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
    if (typeof value === 'number' && Number.isFinite(value)) return;
    if (typeof value !== 'object' || value === null || ancestors.has(value) || !Object.isFrozen(value)) invalid();
    const object = value as object, array = Array.isArray(object), prototype = Object.getPrototypeOf(object);
    if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) invalid();
    const keys = Reflect.ownKeys(object);
    if (array && keys.length !== (object as unknown[]).length + 1) invalid();
    ancestors.add(object);
    for (const key of keys) {
      if (array && key === 'length') continue;
      const descriptor = Object.getOwnPropertyDescriptor(object, key);
      if (typeof key !== 'string' || !descriptor || !descriptor.enumerable || !('value' in descriptor)) invalid();
      if (array && (typeof key !== 'string' || !/^(0|[1-9]\d*)$/.test(key)
        || Number(key) >= (object as unknown[]).length)) invalid();
      visit(descriptor!.value, depth + 1);
    }
    ancestors.delete(object);
  };
  visit(input, 0);
}
