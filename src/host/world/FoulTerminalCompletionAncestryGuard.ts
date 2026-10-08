type Owner = 'actual_foul_terminal_applications' | 'actual_live_play_closures';
type Scope = Readonly<{ owner:Owner; sourceId: string; gameId: string; playId: number }>;
const scopes = new WeakMap<object, Scope[]>(), readers = new WeakMap<object, Set<string>>();
const id = (value: string) => typeof value === 'string' && value.length > 0 && value === value.trim();
/** Reader entry and dependency scope are deliberately separate: the immutable
 * acknowledgement and completion phases may reconstruct the same original
 * scope, but a completion reader must never recursively read its own owner. */
export const withFoulTerminalCompletionReader = <T>(db: object, sourceId: string, body: () => T): T => {
  if (!id(sourceId)) throw new Error('invalid terminal completion reader identity');
  const active = readers.get(db) ?? new Set<string>();
  if (active.has(sourceId)) throw new Error('terminal completion reader re-entry');
  readers.set(db, active); active.add(sourceId);
  try { return body(); } finally { active.delete(sourceId); if (!active.size) readers.delete(db); }
};
const withOriginalScope = <T>(db: object, owner:Owner, sourceId: string, gameId: string, playId: number, body: () => T): T => {
  if (!id(sourceId) || !id(gameId) || !Number.isSafeInteger(playId) || playId < 0) throw new Error('invalid terminal ancestry scope');
  const stack = scopes.get(db) ?? [], parent = stack.at(-1);
  if (stack.some(s => s.owner === owner && s.sourceId === sourceId && (s.gameId !== gameId || s.playId !== playId))
    || parent && (parent.gameId !== gameId || playId > parent.playId || playId === parent.playId && (parent.owner !== owner || parent.sourceId !== sourceId))) {
    throw new Error('terminal ancestry scope is not an earlier original play');
  }
  stack.push({ owner, sourceId, gameId, playId }); scopes.set(db, stack);
  try { return body(); } finally { stack.pop(); if (!stack.length) scopes.delete(db); }
};
export const withFoulTerminalOriginalScope = <T>(db: object, sourceId: string, gameId: string, playId: number, body: () => T): T =>
  withOriginalScope(db,'actual_foul_terminal_applications',sourceId,gameId,playId,body);
/** A prior live archive reconstructs its own original actor/pitch frame. Only
 * an existing terminal ancestry traversal needs this dependency frame; the
 * ordinary live reader keeps its established behavior when no frame is active. */
export const withFoulTerminalPriorLiveScope = <T>(db: object, sourceId: string, gameId: string, playId: number, body: () => T): T =>
  scopes.get(db)?.length ? withOriginalScope(db,'actual_live_play_closures',sourceId,gameId,playId,body) : body();
/** Call before dispatching an activation dependency, and again against its
 * authenticated activation. With no original proof in flight it is a no-op. */
export const assertFoulTerminalPriorActivation = (db: object, gameId: string, previousPlayId: number, nextPlayId: number): void => {
  const stack = scopes.get(db); if (!stack?.length) return;
  if (!Number.isSafeInteger(previousPlayId) || previousPlayId < 0 || !Number.isSafeInteger(nextPlayId)
    || nextPlayId !== previousPlayId + 1 || stack.some(s => s.gameId !== gameId || previousPlayId >= s.playId)
    || nextPlayId !== stack.at(-1)!.playId) throw new Error('terminal ancestry activation self/forward/foreign or consuming frame differs');
};
/** A census may authenticate only predecessor scopes, never its active owner. */
export const assertFoulTerminalPriorCensusScope = (db: object, gameId: string, playId: number): void => {
  if (scopes.get(db)?.some(s => s.gameId !== gameId || playId >= s.playId)) throw new Error('terminal ancestry census includes active or forward scope');
};
