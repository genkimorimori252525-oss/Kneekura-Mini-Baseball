import type { ControlRejection, ControlRejectionCode, ControlResult, DecisionActor, DecisionOpportunity,
  DecisionSubmission, ExecutedDecision } from './ControlTypes';

export class ControlValidationError extends Error {
  constructor(readonly path: string) { super(`Invalid control data at ${path}`); this.name = 'ControlValidationError'; }
}
export function invalid(path: string): never { throw new ControlValidationError(path); }
export function object(input: unknown, path: string): Record<string, unknown> {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) return invalid(path);
  const prototype: unknown = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) return invalid(path);
  return input as Record<string, unknown>;
}
export function id(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) return invalid(path);
  return value;
}
export function nullableId(value: unknown, path: string): string | null { return value === null ? null : id(value, path); }
export function revision(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) return invalid(path);
  return value;
}
export function boolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') return invalid(path);
  return value;
}
export function ids(value: unknown, path: string, sorted = false): readonly string[] {
  if (!Array.isArray(value)) return invalid(path);
  const result: string[] = []; const seen = new Set<string>();
  for (let i = 0; i < value.length; i++) {
    if (!Object.prototype.hasOwnProperty.call(value, i)) return invalid(`${path}[${i}]`);
    const entry = id(value[i], `${path}[${i}]`);
    if (seen.has(entry)) return invalid(`${path}[${i}]`);
    seen.add(entry); result.push(entry);
  }
  return Object.freeze(sorted ? result.sort() : result);
}
export function parseActor(value: unknown): DecisionActor {
  const input = object(value, 'actor');
  if (input.kind === 'HUMAN') return Object.freeze({ kind: 'HUMAN', controllerId: id(input.controllerId, 'actor.controllerId') });
  if (input.kind === 'MANAGER') return Object.freeze({ kind: 'MANAGER',
    managerId: id(input.managerId, 'actor.managerId'), appointmentId: id(input.appointmentId, 'actor.appointmentId'),
    traceId: id(input.traceId, 'actor.traceId') });
  return invalid('actor.kind');
}
export function parseOpportunity(value: unknown): DecisionOpportunity {
  const input = object(value, 'opportunity');
  return Object.freeze({ decisionId: id(input.decisionId, 'decisionId'), contextId: id(input.contextId, 'contextId'),
    worldRevision: revision(input.worldRevision, 'worldRevision'), clubId: id(input.clubId, 'clubId'),
    domainId: id(input.domainId, 'domainId'), managerId: id(input.managerId, 'managerId'),
    appointmentId: id(input.appointmentId, 'appointmentId'), legalActionIds: ids(input.legalActionIds, 'legalActionIds') });
}
export function parseSubmission(value: unknown): DecisionSubmission {
  const input = object(value, 'submission');
  return Object.freeze({ decisionId: id(input.decisionId, 'decisionId'), contextId: id(input.contextId, 'contextId'),
    expectedControlRevision: revision(input.expectedControlRevision, 'expectedControlRevision'),
    expectedWorldRevision: revision(input.expectedWorldRevision, 'expectedWorldRevision'),
    actionId: id(input.actionId, 'actionId'), actor: parseActor(input.actor) });
}
export function parseExecution(value: unknown): ExecutedDecision {
  const input = object(value, 'execution'); const eventIds = ids(input.eventIds, 'eventIds');
  if (eventIds.length === 0) return invalid('eventIds');
  return Object.freeze({ executionId: id(input.executionId, 'executionId'), decisionId: id(input.decisionId, 'decisionId'),
    contextId: id(input.contextId, 'contextId'), actionId: id(input.actionId, 'actionId'),
    worldRevision: revision(input.worldRevision, 'worldRevision'), eventIds });
}
export function rejection(code: ControlRejectionCode, path?: string): ControlRejection {
  return Object.freeze(path === undefined ? { code } : { code, path });
}
export function failure(code: ControlRejectionCode, path?: string): { readonly ok: false; readonly reason: ControlRejection } {
  return Object.freeze({ ok: false, reason: rejection(code, path) });
}
export function success<T>(value: T): ControlResult<T> { return Object.freeze({ ok: true, value }); }
export function validationFailure(error: unknown): { readonly ok: false; readonly reason: ControlRejection } {
  if (!(error instanceof ControlValidationError)) throw error;
  return failure('INVALID_INPUT', error.path);
}
