import { EMOTIONS, type EmotionAppraisal, type EmotionCandidate, type EmotionDecisionEffects,
  type EmotionIssue, type EmotionIssueCode, type EmotionPolicy, type EmotionResult,
  type EmotionScope, type EmotionTime } from './EmotionTypes';

class InvalidEmotionData extends Error {
  constructor(readonly issue: EmotionIssue) { super(issue.code + ': ' + issue.path); }
}
export function fail(code: EmotionIssueCode, path: string): never { throw new InvalidEmotionData({ code, path }); }
export function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child); Object.freeze(value);
  }
  return value;
}
export function attempt<T>(run: () => T): EmotionResult<T> {
  try { return Object.freeze({ ok: true, value: freeze(run()) }); }
  catch (error) {
    if (!(error instanceof InvalidEmotionData)) throw error;
    return Object.freeze({ ok: false, reason: Object.freeze(error.issue) });
  }
}
export function obj(input: unknown, keys: readonly string[], path: string): Record<string, unknown> {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) fail('INVALID_INPUT', path);
  const proto = Object.getPrototypeOf(input);
  if (proto !== Object.prototype && proto !== null) fail('INVALID_INPUT', path);
  const own = Reflect.ownKeys(input);
  if (own.length !== keys.length || keys.some(k => !Object.hasOwn(input, k))) fail('INVALID_INPUT', path);
  for (const k of own) {
    const d = Object.getOwnPropertyDescriptor(input, k)!;
    if (typeof k !== 'string' || !d.enumerable || !('value' in d)) fail('INVALID_INPUT', path);
  }
  return input as Record<string, unknown>;
}
export function text(input: unknown, path: string): string {
  if (typeof input !== 'string' || input.trim().length === 0) fail('INVALID_INPUT', path); return input;
}
export function integer(input: unknown, path: string, signed = false): number {
  if (typeof input !== 'number' || !Number.isSafeInteger(input) || (!signed && input < 0)) fail('INVALID_INPUT', path);
  return input === 0 ? 0 : input;
}
export function fraction(input: unknown, path: string, signed = false): number {
  if (typeof input !== 'number' || !Number.isFinite(input) || input < (signed ? -1 : 0) || input > 1)
    fail('INVALID_INPUT', path);
  return input === 0 ? 0 : input;
}
export function list<T>(input: unknown, read: (item: unknown, path: string) => T, path: string): T[] {
  if (!Array.isArray(input) || Reflect.ownKeys(input).length !== input.length + 1) fail('INVALID_INPUT', path);
  const result: T[] = [];
  for (let i = 0; i < input.length; i += 1) {
    const d = Object.getOwnPropertyDescriptor(input, String(i));
    if (!d || !('value' in d) || !d.enumerable) fail('INVALID_INPUT', path);
    result.push(read(d.value, path + '[' + i + ']'));
  }
  return result;
}
export function readKind(input: unknown, path: string): typeof EMOTIONS[number] {
  if (!EMOTIONS.includes(input as typeof EMOTIONS[number])) fail('INVALID_INPUT', path);
  return input as typeof EMOTIONS[number];
}
const order = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
export function readScope(input: unknown, path: string): EmotionScope {
  const v = obj(input, ['careerId','matchId','playerId'], path);
  return { careerId: text(v.careerId,path+'.careerId'), matchId: text(v.matchId,path+'.matchId'), playerId: text(v.playerId,path+'.playerId') };
}
export function readTime(input: unknown, path: string): EmotionTime {
  const v = obj(input, ['tick','sequence'], path);
  return { tick: integer(v.tick,path+'.tick'), sequence: integer(v.sequence,path+'.sequence') };
}
/** Sequence orders appraisal evidence, not physical outcomes on an equal tick. */
export const compareTime = (a: EmotionTime, b: EmotionTime): number => a.tick - b.tick || a.sequence - b.sequence;
export function readPolicy(input: unknown, path: string): EmotionPolicy {
  const v = obj(input, ['policyId','version','clearAfterCalmEvents','thresholds'],path);
  const thresholds = list(v.thresholds,(item,p) => {
    const t = obj(item,['emotion','activation','sustain'],p);
    const activation = fraction(t.activation,p+'.activation'), sustain = fraction(t.sustain,p+'.sustain');
    if (activation <= sustain) fail('INVALID_INPUT',p+'.activation');
    return { emotion: readKind(t.emotion,p+'.emotion'), activation, sustain };
  },path+'.thresholds');
  if (thresholds.length !== 5 || new Set(thresholds.map(x => x.emotion)).size !== 5) fail('INVALID_INPUT',path+'.thresholds');
  const clearAfterCalmEvents = integer(v.clearAfterCalmEvents,path+'.clearAfterCalmEvents');
  if (clearAfterCalmEvents === 0) fail('INVALID_INPUT',path+'.clearAfterCalmEvents');
  return { policyId: text(v.policyId,path+'.policyId'), version: text(v.version,path+'.version'),
    clearAfterCalmEvents, thresholds: thresholds.sort((a,b) => order(a.emotion,b.emotion)) };
}
export function readEffects(input: unknown, path: string): EmotionDecisionEffects {
  const v = obj(input,['swingDecisionShiftTicks','throwIntentShiftTicks','defenseReplanShiftTicks',
    'swingAggressionDelta','throwAggressionDelta','runningRiskDelta'],path);
  return { swingDecisionShiftTicks: integer(v.swingDecisionShiftTicks,path+'.swingDecisionShiftTicks',true),
    throwIntentShiftTicks: integer(v.throwIntentShiftTicks,path+'.throwIntentShiftTicks',true),
    defenseReplanShiftTicks: integer(v.defenseReplanShiftTicks,path+'.defenseReplanShiftTicks',true),
    swingAggressionDelta: fraction(v.swingAggressionDelta,path+'.swingAggressionDelta',true),
    throwAggressionDelta: fraction(v.throwAggressionDelta,path+'.throwAggressionDelta',true),
    runningRiskDelta: fraction(v.runningRiskDelta,path+'.runningRiskDelta',true) };
}
export const hasEffect = (effects: EmotionDecisionEffects): boolean => Object.values(effects).some(v => v !== 0);
export function readCandidate(input: unknown, path: string): EmotionCandidate {
  const v = obj(input,['emotion','candidateId','pressure','behavioralImpact','effects'],path);
  const effects = readEffects(v.effects,path+'.effects'), behavioralImpact = fraction(v.behavioralImpact,path+'.behavioralImpact');
  if (hasEffect(effects) !== (behavioralImpact > 0)) fail('INVALID_INPUT',path+'.behavioralImpact');
  return { emotion: readKind(v.emotion,path+'.emotion'), candidateId: text(v.candidateId,path+'.candidateId'),
    pressure: fraction(v.pressure,path+'.pressure'), behavioralImpact, effects };
}
export function readAppraisal(input: unknown, path: string): EmotionAppraisal {
  const v = obj(input,['scope','policyRef','appraisalId','contextId','appraisalModelVersion','sourceSnapshotId',
    'evidenceEventIds','expectedRevision','time','candidates'],path);
  const ref = obj(v.policyRef,['policyId','version'],path+'.policyRef');
  const candidates = list(v.candidates,readCandidate,path+'.candidates');
  if (candidates.length !== 5 || new Set(candidates.map(x => x.emotion)).size !== 5
    || new Set(candidates.map(x => x.candidateId)).size !== 5) fail('INVALID_INPUT',path+'.candidates');
  const evidenceEventIds = list(v.evidenceEventIds,text,path+'.evidenceEventIds');
  if (!evidenceEventIds.length || new Set(evidenceEventIds).size !== evidenceEventIds.length) fail('INVALID_INPUT',path+'.evidenceEventIds');
  return { scope: readScope(v.scope,path+'.scope'), policyRef: { policyId: text(ref.policyId,path+'.policyRef.policyId'),
    version: text(ref.version,path+'.policyRef.version') }, appraisalId: text(v.appraisalId,path+'.appraisalId'),
    contextId: text(v.contextId,path+'.contextId'), appraisalModelVersion: text(v.appraisalModelVersion,path+'.appraisalModelVersion'),
    sourceSnapshotId: text(v.sourceSnapshotId,path+'.sourceSnapshotId'), evidenceEventIds,
    expectedRevision: integer(v.expectedRevision,path+'.expectedRevision'), time: readTime(v.time,path+'.time'),
    candidates: candidates.sort((a,b) => order(a.emotion,b.emotion)) };
}
/** Compares parsed inert records; never traverses external getters. */
export function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const left = Object.keys(a), right = Object.keys(b);
  return left.length === right.length && left.every(k => Object.hasOwn(b,k)
    && same((a as Record<string,unknown>)[k],(b as Record<string,unknown>)[k]));
}
