import { closeSync, fsyncSync, openSync, writeSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { dirname } from 'node:path';

type State = { fd: number; started: number; sequence: number; spans: number[]; counts: Record<string, number>;
  events: number; maxEvents: number; ioMilliseconds: number; errors: string[]; suppressed: boolean };
let state: State | null = null;
const describe = (error: unknown) => { try { return error instanceof Error ? String(error.message) : String(error); } catch { return 'unavailable error metadata'; } };
const emit = (value: object) => {
  const s = state; if (!s) return;
  const at = performance.now();
  try {
    const bytes = Buffer.from(JSON.stringify({ schema: 'episode_field_diagnostic_event_v1', elapsedMilliseconds: at - s.started,
      observerIoMilliseconds: s.ioMilliseconds, ...value }) + '\n');
    let offset = 0; while (offset < bytes.length) offset += writeSync(s.fd, bytes, offset, bytes.length - offset);
    fsyncSync(s.fd);
  } catch (error) { s.errors.push(describe(error)); }
  finally { s.ioMilliseconds += performance.now() - at; }
};
export const beginFieldDiagnostic = (path: string, metadata: object, maxEvents = 6000) => {
  if (state) throw new Error('diagnostic observer already active');
  if (!Number.isSafeInteger(maxEvents) || maxEvents < 1) throw new Error('invalid diagnostic span budget');
  state = { fd: openSync(path, 'wx'), started: performance.now(), sequence: 0, spans: [], counts: {},
    events: 0, maxEvents, ioMilliseconds: 0, errors: [], suppressed: false };
  emit({ event: 'start', metadata });
  const directory = openSync(dirname(path), 'r'); try { fsyncSync(directory); } finally { closeSync(directory); }
  if (state.errors.length) { const errors = [...state.errors]; closeSync(state.fd); state = null; throw new AggregateError(errors, 'diagnostic start failed'); }
};
export const fieldDiagnosticEvent = (event: string, metadata: object) => emit({ event, metadata });
export const endFieldDiagnostic = () => {
  const s = state; if (!s) throw new Error('diagnostic observer absent');
  emit({ event: 'finish', counts: s.counts, openSpans: s.spans, observerErrors: s.errors });
  try { fsyncSync(s.fd); } finally { closeSync(s.fd); state = null; }
  if (s.errors.length) throw new AggregateError(s.errors, 'diagnostic observer I/O failed');
  return { counts: s.counts, events: s.events, observerIoMilliseconds: s.ioMilliseconds, suppressed: s.suppressed };
};
/** Observation only: the original function's exact return value or error escapes. */
export const fieldDiagnosticPhase = <T>(name: string, metadata: () => unknown, work: () => T): T => {
  const s = state; if (!s) return work();
  const id = ++s.sequence, parent = s.spans.at(-1) ?? null;
  s.counts[name] = (s.counts[name] ?? 0) + 1;
  let info: unknown;
  try { info = metadata(); } catch (error) { info = { metadataError: describe(error) }; }
  const recorded = s.events < s.maxEvents;
  if (recorded) { s.events++; emit({ event: 'begin', id, parent, name, occurrence: s.counts[name], metadata: info }); }
  else if (!s.suppressed) {
    s.suppressed = true; emit({ event: 'event-budget-summary', id, parent, name, counts: s.counts });
  }
  s.spans.push(id); const start = performance.now(), ioStart = s.ioMilliseconds;
  try {
    const value = work();
    if (recorded) emit({ event: 'return', id, parent, name, inclusiveMilliseconds: performance.now() - start,
      nestedObserverIoMilliseconds: s.ioMilliseconds - ioStart });
    return value;
  } catch (error) {
    if (recorded) emit({ event: 'throw', id, parent, name, inclusiveMilliseconds: performance.now() - start,
      nestedObserverIoMilliseconds: s.ioMilliseconds - ioStart, error: describe(error) });
    throw error;
  } finally { s.spans.pop(); }
};

export const fieldDiagnosticCoreInput = (raw: unknown, constrained?: unknown, exactThroughElapsedSeconds?: number) => {
  const value = raw as any, constraint = constrained as any;
  const elapsed = value?.moment?.elapsedSeconds;
  const result = fieldDiagnosticInput(raw);
  return { ...result, constrainedThroughElapsedSeconds: constraint?.throughElapsedSeconds, exactThroughElapsedSeconds,
    coreDurationSeconds: exactThroughElapsedSeconds !== undefined ? exactThroughElapsedSeconds - elapsed
      : constraint ? constraint.throughElapsedSeconds - elapsed : result.effectiveHorizonSeconds };
};

/** The same absolute-to-relative interval used by Core, recorded without changing it. */
export const fieldDiagnosticInput = (raw: unknown, original?: unknown) => {
  const value = raw as any, root = original as any;
  const moment = value?.moment ?? value?.cursor?.moment;
  const response = value?.response ?? root?.response;
  const parameters = value?.parameters ?? response?.world?.parameters ?? response?.touch?.worldContact?.flight?.source?.execution?.ballFlightParameters;
  const initial = response?.world?.flight?.initialBall ?? response?.touch?.worldContact?.flight?.flight?.initialBall;
  const throughTick = value?.throughTick ?? value?.source?.throughTick;
  const originTick = moment?.originTick ?? initial?.tick;
  const elapsedSeconds = moment?.elapsedSeconds ?? (initial ? 0 : undefined);
  const ticksPerSecond = parameters?.ticksPerSecond;
  const actors = value?.actors ?? response?.world?.actors ?? response?.touch?.worldContact?.actors;
  return { sourceId: value?.sourceId ?? value?.source?.sourceId, rootKind: root?.rootKind ?? value?.rootKind,
    physicalPitchSourceId: response?.touch?.worldContact?.flight?.source?.physicalPitchSourceId,
    bindingSourceId: (root?.episodeFieldBinding ?? value?.episodeFieldBinding)?.source?.sourceId,
    throughTick, availableAtTick: value?.availableAtTick ?? value?.source?.availableAtTick,
    originTick, ballTick: moment?.ball?.tick ?? initial?.tick, elapsedSeconds, ticksPerSecond,
    effectiveHorizonSeconds: [throughTick, originTick, elapsedSeconds, ticksPerSecond].every(v => typeof v === 'number' && Number.isFinite(v)) && ticksPerSecond > 0
      ? Math.max(0, (throughTick - originTick) / ticksPerSecond - elapsedSeconds) : undefined,
    actorCount: Array.isArray(actors) ? actors.length : undefined };
};
