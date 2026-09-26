export const RELATIONSHIP_EVIDENCE_KINDS = [
  'SHARED_SUCCESS', 'MUTUAL_SUPPORT', 'JOINT_REPETITION',
  'JOINT_EXECUTION',
  'CONFLICT', 'TRUST_BREACH', 'ROLE_COMPETITION',
] as const;
export type RelationshipEvidenceKind =
  typeof RELATIONSHIP_EVIDENCE_KINDS[number];
export type RelationshipDimensions = Readonly<{
  affinity: number;
  trust: number;
  coordination: number;
}>;
export type RelationshipPolicy = Readonly<{
  policyId: string;
  version: string;
  availableAtDay: number;
  baseline: RelationshipDimensions;
  deltas: Readonly<Record<RelationshipEvidenceKind,
    RelationshipDimensions>>;
}>;
export type PlayerRelationshipLink = Readonly<{
  fromPlayerId: string;
  toPlayerId: string;
  affinity: number;
  trust: number;
  coordination: number;
  sharedSuccessMemory: number;
  conflictMemory: number;
  lastMeaningfulInteraction: number;
}>;
export type PlayerRelationshipEvidence = Readonly<{
  eventId: string;
  sourceEventId: string;
  atDay: number;
  fromPlayerId: string;
  toPlayerId: string;
  kind: RelationshipEvidenceKind;
}>;
export type PlayerRelationshipEvent = Readonly<{
  type: 'PLAYER_RELATIONSHIP_CHANGED';
  eventId: string;
  sourceEventId: string;
  careerId: string;
  atDay: number;
  beforeRevision: number;
  afterRevision: number;
  kind: RelationshipEvidenceKind;
  before: PlayerRelationshipLink | null;
  after: PlayerRelationshipLink;
}>;
export type PlayerRelationshipNetwork = Readonly<{
  careerId: string;
  revision: number;
  effectiveDay: number;
  policy: RelationshipPolicy;
  links: readonly PlayerRelationshipLink[];
  events: readonly PlayerRelationshipEvent[];
}>;
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0
    && value === value.trim();
const day = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const fields = (value: unknown, names: readonly string[]): boolean =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === names.length
    && names.every((name) => Object.hasOwn(value, name));
const dimensions = (value: unknown, signed: boolean): RelationshipDimensions => {
  if (!fields(value, ['affinity', 'trust', 'coordination'])) {
    throw new Error('invalid relationship dimensions');
  }
  const source = value as RelationshipDimensions;
  if ([source.affinity, source.trust, source.coordination].some((n) =>
    !Number.isSafeInteger(n) || n < (signed ? -100 : 0) || n > 100)) {
    throw new Error('invalid relationship dimension range');
  }
  return Object.freeze({ ...source });
};
const clamp = (value: number): number =>
  Math.max(0, Math.min(100, value));

/** Relationships are career histories, not season-reset team buffs. */
export const createPlayerRelationshipNetwork = (
  careerId: string,
  input: RelationshipPolicy,
): PlayerRelationshipNetwork => {
  if (!id(careerId) || !fields(input,
    ['policyId', 'version', 'availableAtDay', 'baseline', 'deltas'])
    || !id(input.policyId) || !id(input.version)
    || !day(input.availableAtDay)
    || !fields(input.deltas, RELATIONSHIP_EVIDENCE_KINDS)) {
    throw new Error('invalid relationship career or policy');
  }
  const baseline = dimensions(input.baseline, false);
  const deltas = Object.freeze(Object.fromEntries(
    RELATIONSHIP_EVIDENCE_KINDS.map((kind) => {
      const delta = dimensions(input.deltas[kind], true);
      if (kind !== 'JOINT_REPETITION' && kind !== 'JOINT_EXECUTION'
        && delta.coordination !== 0) {
        throw new Error('coordination requires joint repetition');
      }
      return [kind, delta];
    }))) as Record<RelationshipEvidenceKind, RelationshipDimensions>;
  return Object.freeze({ careerId, revision: 0,
    effectiveDay: input.availableAtDay,
    policy: Object.freeze({ policyId: input.policyId,
      version: input.version, availableAtDay: input.availableAtDay,
      baseline, deltas }),
    links: Object.freeze([]), events: Object.freeze([]),
  });
};

/** Applies authenticated pair evidence; no batting or fielding skill is modified. */
export const applyPlayerRelationshipEvidence = (
  state: PlayerRelationshipNetwork,
  expectedRevision: number,
  source: PlayerRelationshipEvidence,
): Readonly<{ state: PlayerRelationshipNetwork;
  event: PlayerRelationshipEvent }> => {
  if (expectedRevision !== state.revision) {
    throw new Error('stale relationship revision');
  }
  if (!Array.isArray(state.events)
    || state.revision !== state.events.length
    || !fields(source, ['eventId', 'sourceEventId',
      'atDay', 'fromPlayerId', 'toPlayerId', 'kind'])
    || !id(source.eventId) || !id(source.sourceEventId)
    || !id(source.fromPlayerId) || !id(source.toPlayerId)
    || source.fromPlayerId === source.toPlayerId
    || !day(source.atDay) || source.atDay < state.effectiveDay
    || !RELATIONSHIP_EVIDENCE_KINDS.includes(source.kind)) {
    throw new Error('invalid relationship evidence');
  }
  if (state.events.some((event) => event.eventId === source.eventId
    || (event.sourceEventId === source.sourceEventId
      && event.after.fromPlayerId === source.fromPlayerId
      && event.after.toPlayerId === source.toPlayerId))) {
    throw new Error('duplicate relationship evidence');
  }
  const before = state.links.find((link) =>
    link.fromPlayerId === source.fromPlayerId
      && link.toPlayerId === source.toPlayerId) ?? null;
  const values = before ?? { fromPlayerId: source.fromPlayerId,
    toPlayerId: source.toPlayerId, ...state.policy.baseline,
    sharedSuccessMemory: 0, conflictMemory: 0,
    lastMeaningfulInteraction: source.atDay };
  const delta = state.policy.deltas[source.kind];
  const after: PlayerRelationshipLink = Object.freeze({
    fromPlayerId: source.fromPlayerId,
    toPlayerId: source.toPlayerId,
    affinity: clamp(values.affinity + delta.affinity),
    trust: clamp(values.trust + delta.trust),
    coordination: clamp(values.coordination + delta.coordination),
    sharedSuccessMemory: values.sharedSuccessMemory
      + (source.kind === 'SHARED_SUCCESS' ? 1 : 0),
    conflictMemory: values.conflictMemory
      + (source.kind === 'CONFLICT' ? 1 : 0),
    lastMeaningfulInteraction: source.atDay,
  });
  if (!Number.isSafeInteger(after.sharedSuccessMemory)
    || !Number.isSafeInteger(after.conflictMemory)) {
    throw new Error('relationship memory overflow');
  }
  const event: PlayerRelationshipEvent = Object.freeze({
    type: 'PLAYER_RELATIONSHIP_CHANGED',
    eventId: source.eventId, sourceEventId: source.sourceEventId,
    careerId: state.careerId, atDay: source.atDay,
    beforeRevision: state.revision,
    afterRevision: state.revision + 1,
    kind: source.kind, before, after,
  });
  const next: PlayerRelationshipNetwork = Object.freeze({ ...state,
    revision: state.revision + 1, effectiveDay: source.atDay,
    links: Object.freeze(before
      ? state.links.map((link) => link === before ? after : link)
      : [...state.links, after]),
    events: Object.freeze([...state.events, event]),
  });
  return Object.freeze({ state: next, event });
};
