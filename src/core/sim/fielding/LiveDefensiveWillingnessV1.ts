import type { EmotionKind, EmotionScope, EmotionState, EmotionTime } from '../../world/psychology/EmotionTypes';
import { getEmotionInfluence } from '../../world/psychology/EmotionState';
import { cloneInert } from '../../adjudication/OfficialWindowPolicy';

export type LiveDefensiveProjectionBindingV1 = Readonly<{
  scope: EmotionScope; time: EmotionTime; optionId: string; emotionRevision: number;
  appraisalId: string | null; sourceSnapshotId: string | null; emotionCandidateId: string | null;
  appraisalModelVersion: string | null; projectionModel: Readonly<{ modelId: string; version: string }>;
}>;
export type LiveVerifiedDefensiveProjectionV1 = Readonly<{
  schemaVersion: 1; binding: LiveDefensiveProjectionBindingV1; emotionState: EmotionState;
  availableAt: EmotionTime; validUntilTick: number; valueDelta: number; costDelta: number;
}>;
export type LiveDefensiveProjectionAuthorityV1 = Readonly<{ owner: 'APPRAISAL_WRAPPER_VERIFIER_V1' }>;
export type LiveDefensiveProjectionVerifierV1 = (offer: unknown, expected: LiveDefensiveProjectionBindingV1) => LiveVerifiedDefensiveProjectionV1 | null;
export type LiveDefensiveWillingnessInputV1 = Readonly<{
  schemaVersion: 1; stage: 'POST_TRAIT_CANDIDATE_VALUE_V1'; optionId: string; value: number; cost: number;
  psychology?: Readonly<{ connection: 'NOT_CONNECTED' }> | Readonly<{ connection: 'CONNECTED'; offer: unknown;
    expected: LiveDefensiveProjectionBindingV1 }>;
}>;
export type LiveDefensiveWillingnessV1 = Readonly<{
  kind: 'RESOLVED'; stage: 'POST_DEFENSIVE_WILLINGNESS_V1'; status: 'NOT_CONNECTED' | 'INACTIVE' | 'ACTIVE';
  optionId: string; value: number; cost: number; emotionalValueDelta: number; emotionalCostDelta: number;
  activeEmotion: EmotionKind | null; binding: LiveDefensiveProjectionBindingV1 | null;
}> | Readonly<{ kind: 'REJECTED'; reason: 'INVALID_INPUT' | 'AUTHORITY_REQUIRED' | 'PROJECTION_REJECTED' | 'BINDING_MISMATCH' }>;

const verifiers = new WeakMap<object, LiveDefensiveProjectionVerifierV1>();
const check = (condition: unknown): void => { if (!condition) throw Error('invalid live defensive willingness data'); };
const fields = (o: object, keys: readonly string[]): boolean => !!o && typeof o === 'object' && !Array.isArray(o)
  && Object.keys(o).length === keys.length && keys.every(k => Object.hasOwn(o, k));
const text = (s: string): boolean => typeof s === 'string' && s.trim().length > 0;
const nullableText = (s: string | null): boolean => s === null || text(s);
const count = (n: number): boolean => Number.isSafeInteger(n) && n >= 0;
const time = (t: EmotionTime): boolean => fields(t, ['tick', 'sequence']) && count(t.tick) && count(t.sequence);
const beforeOrAt = (a: EmotionTime, b: EmotionTime): boolean => a.tick < b.tick || a.tick === b.tick && a.sequence <= b.sequence;
const scopeKey = (s: EmotionScope): string => JSON.stringify([s.careerId, s.matchId, s.playerId]);
const freeze = <T>(o: T): T => { if (o && typeof o === 'object') { Object.values(o).forEach(freeze); Object.freeze(o); } return o; };
const validateBinding = (b: LiveDefensiveProjectionBindingV1): void => {
  check(fields(b, ['scope', 'time', 'optionId', 'emotionRevision', 'appraisalId', 'sourceSnapshotId', 'emotionCandidateId',
    'appraisalModelVersion', 'projectionModel']) && fields(b.scope, ['careerId', 'matchId', 'playerId'])
    && Object.values(b.scope).every(text) && time(b.time) && text(b.optionId) && count(b.emotionRevision)
    && [b.appraisalId, b.sourceSnapshotId, b.emotionCandidateId, b.appraisalModelVersion].every(nullableText)
    && fields(b.projectionModel, ['modelId', 'version']) && text(b.projectionModel.modelId) && text(b.projectionModel.version));
};
const bindingKey = (b: LiveDefensiveProjectionBindingV1): string => JSON.stringify([scopeKey(b.scope), b.time.tick, b.time.sequence,
  b.optionId, b.emotionRevision, b.appraisalId, b.sourceSnapshotId, b.emotionCandidateId, b.appraisalModelVersion,
  b.projectionModel.modelId, b.projectionModel.version]);

/** Trusted-owner seam, not a parser granting authority to arbitrary sidecars.
 * The future Appraisal wrapper must recompute source/model/selection and return
 * only its verified candidate projection. No production verifier or calibration
 * is installed here. Callbacks must be pure and must not trust receipt IDs alone.
 * The opaque object is process-local; copies/deserialized objects have no owner. */
export function createLiveDefensiveProjectionAuthorityV1(verify: LiveDefensiveProjectionVerifierV1): LiveDefensiveProjectionAuthorityV1 {
  check(typeof verify === 'function');
  const authority = Object.freeze({ owner: 'APPRAISAL_WRAPPER_VERIFIER_V1' as const });
  verifiers.set(authority, verify); return authority;
}

/** Consumes already trait-resolved candidate values. It never applies a trait,
 * appraises, selects an emotion, changes ability, issues a motor or certifies a
 * catch. Rejection is not a neutral update and leaves caller state untouched.
 * The output stage prevents feeding an already augmented result back as base. */
export function resolveLiveDefensiveWillingnessV1(input: LiveDefensiveWillingnessInputV1,
  authority?: LiveDefensiveProjectionAuthorityV1): LiveDefensiveWillingnessV1 {
  const rejected = (reason: Extract<LiveDefensiveWillingnessV1, { kind: 'REJECTED' }>['reason']): LiveDefensiveWillingnessV1 =>
    Object.freeze({ kind: 'REJECTED', reason });
  let i: LiveDefensiveWillingnessInputV1;
  try {
    i = cloneInert(input);
    check(fields(i, ['schemaVersion', 'stage', 'optionId', 'value', 'cost', ...(Object.hasOwn(i, 'psychology') ? ['psychology'] : [])])
      && i.schemaVersion === 1 && i.stage === 'POST_TRAIT_CANDIDATE_VALUE_V1' && text(i.optionId)
      && Number.isFinite(i.value) && Number.isFinite(i.cost));
    if (i.psychology) {
      check(i.psychology.connection === 'NOT_CONNECTED' ? fields(i.psychology, ['connection'])
        : i.psychology.connection === 'CONNECTED' && fields(i.psychology, ['connection', 'offer', 'expected']));
      if (i.psychology.connection === 'CONNECTED') validateBinding(i.psychology.expected);
    } else check(!Object.hasOwn(i, 'psychology'));
  } catch { return rejected('INVALID_INPUT'); }
  const resolved = (status: 'NOT_CONNECTED' | 'INACTIVE' | 'ACTIVE', valueDelta = 0, costDelta = 0,
    activeEmotion: EmotionKind | null = null, binding: LiveDefensiveProjectionBindingV1 | null = null): LiveDefensiveWillingnessV1 => {
    const value = valueDelta === 0 ? i.value : i.value + valueDelta, cost = costDelta === 0 ? i.cost : i.cost + costDelta;
    if (!Number.isFinite(value) || !Number.isFinite(cost)) return rejected('PROJECTION_REJECTED');
    return freeze({ kind: 'RESOLVED', stage: 'POST_DEFENSIVE_WILLINGNESS_V1', status, optionId: i.optionId, value, cost,
      emotionalValueDelta: valueDelta, emotionalCostDelta: costDelta, activeEmotion, binding });
  };
  if (!i.psychology || i.psychology.connection === 'NOT_CONNECTED') return resolved('NOT_CONNECTED');
  const verify = authority && verifiers.get(authority);
  if (!verify) return rejected('AUTHORITY_REQUIRED');
  try {
    const expected = freeze(i.psychology.expected);
    if (expected.optionId !== i.optionId) return rejected('BINDING_MISMATCH');
    const raw = verify(freeze(i.psychology.offer), expected);
    if (!raw) return rejected('PROJECTION_REJECTED');
    const p = cloneInert(raw);
    check(fields(p, ['schemaVersion', 'binding', 'emotionState', 'availableAt', 'validUntilTick', 'valueDelta', 'costDelta'])
      && p.schemaVersion === 1 && time(p.availableAt) && count(p.validUntilTick)
      && Number.isFinite(p.valueDelta) && Number.isFinite(p.costDelta));
    validateBinding(p.binding);
    if (bindingKey(p.binding) !== bindingKey(expected) || !beforeOrAt(p.availableAt, expected.time)
      || expected.time.tick >= p.validUntilTick) return rejected('BINDING_MISMATCH');
    const influence = getEmotionInfluence(p.emotionState);
    if (!influence.ok) return rejected('PROJECTION_REJECTED');
    const gate = influence.value, a = p.emotionState.lastAppraisal;
    if (scopeKey(gate.scope) !== scopeKey(expected.scope) || gate.revision !== expected.emotionRevision
      || (gate.time && !beforeOrAt(gate.time, expected.time)) || (a?.appraisalId ?? null) !== expected.appraisalId
      || (a?.sourceSnapshotId ?? null) !== expected.sourceSnapshotId || (a?.appraisalModelVersion ?? null) !== expected.appraisalModelVersion
      || (gate.source?.candidateId ?? null) !== expected.emotionCandidateId) return rejected('BINDING_MISMATCH');
    // Candidate potential is not an effect before the single emotion gate.
    return gate.activeEmotion === null ? resolved('INACTIVE', 0, 0, null, p.binding)
      : resolved('ACTIVE', p.valueDelta, p.costDelta, gate.activeEmotion, p.binding);
  } catch { return rejected('PROJECTION_REJECTED'); }
}
