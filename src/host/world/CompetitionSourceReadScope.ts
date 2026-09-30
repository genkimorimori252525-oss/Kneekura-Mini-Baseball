type Entry = { pending: boolean; value?: unknown };
type Scope = Map<object, Map<string, Entry>>;
let currentScope: Scope | null = null;
const receiverNamespaces = new WeakMap<object, WeakMap<object, object>>();

/** Read-only synchronous evidence traversal; never retain entries between operations. */
export const withCompetitionSourceReadScope = <T>(read: () => T): T => {
  if (currentScope) return read();
  currentScope = new Map();
  try { return read(); } finally { currentScope = null; }
};

/** A writer phase must not consume or leave proof reads from before its commits. */
export const withCompetitionSourceReadPhase = <T>(phase: () => T): T => {
  const parent = currentScope;
  currentScope = new Map();
  try { return phase(); } finally { parent?.clear(); currentScope = parent; }
};

/** Native competition readers use identifier/day arguments and immutable source results. */
export const createCompetitionSourceReader = <Args extends readonly (string | number)[], T>(
  reader: (...args: Args) => T,
  receiver?: object,
): ((...args: Args) => T) => {
  let namespace: object = reader;
  if (receiver) {
    let namespaces = receiverNamespaces.get(reader);
    if (!namespaces) { namespaces = new WeakMap(); receiverNamespaces.set(reader, namespaces); }
    namespace = namespaces.get(receiver) ?? {};
    namespaces.set(receiver, namespace);
  }
  return (...args: Args): T => {
    if (!currentScope) return reader.call(receiver, ...args);
    let entries = currentScope.get(namespace);
    if (!entries) { entries = new Map(); currentScope.set(namespace, entries); }
    const key = JSON.stringify(args);
    const previous = entries.get(key);
    if (previous) {
      if (previous.pending) throw new Error('competition source dependency is cyclic');
      return previous.value as T;
    }
    const entry: Entry = { pending: true };
    entries.set(key, entry);
    try {
      const value = reader.call(receiver, ...args);
      entry.pending = false; entry.value = value;
      return value;
    } catch (error) { entries.delete(key); throw error; }
  };
};
