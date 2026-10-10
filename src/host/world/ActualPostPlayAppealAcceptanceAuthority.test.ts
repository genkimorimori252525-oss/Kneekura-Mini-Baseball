import { expect, it } from 'vitest';
import { NPB_2026_RULE_PROFILE } from '../../core/rules/RuleProfile';
import { initializeActualPostPlayReview } from './ActualPostPlayReview';
import { intentFixture, reviewFixture } from './ActualPostPlayReviewContract.test-support';
import { actualPostPlayReviewEventInput, actualPostPlayReviewIntentInput } from './ActualPostPlayReviewSource';
import { capturePostPlayReviewAdmission, replayPostPlayReviewAdmission } from './ActualPostPlayReviewNativeAuthority';
import type { PostPlayReviewDb, PostPlayReviewNativeScope } from './ActualPostPlayReviewNativeScope';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

const reference = (sourceId = 'live-contact') => ({ owner: 'pa_physical_v1_field_steps' as const,
  sourceId, sourceHash: 'a'.repeat(64), snapshotHash: 'b'.repeat(64) });
const acceptanceAction = () => ({ kind: 'accept_live_appeal_result' as const,
  executionReferences: [reference()], callId: 'call', windowId: 'review',
  intentSourceId: 'official-intent:accept-appeal', basisSnapshotId: 'appeal-rule-snapshot', basisEvidenceRevision: 7 });
const officialIntent = () => ({ sourceId: 'official-intent:accept-appeal', sourceVersion: 'fixture-v1',
  capability: 'actual_post_play_review_official_intent_v1' as const,
  sessionSourceId: 'review-session', gameId: 'game', playId: 1, physicalPitchSourceId: 'pitch',
  callId: 'call', windowId: 'review', entitlementSourceId: 'entitlement:review', officialId: 'review-official',
  action: 'accept_live_appeal_result' as const, executionReferences: [reference()],
  basisSnapshotId: 'appeal-rule-snapshot', basisEvidenceRevision: 7 });
const requestIntent = () => {
  const { executionReferences: _references, basisSnapshotId: _snapshot, basisEvidenceRevision: _revision, ...source } = officialIntent();
  return { ...source, action: 'request' as const };
};
const initial = (assignment?: 'requesterIds' | 'reviewerIds') => {
  const fixture = reviewFixture({ noDeadline: true, truth: 'safe' });
  const opportunity = fixture.source.policy!.opportunities[0];
  opportunity.requesterIds = ['review-official'];
  if (assignment) opportunity[assignment] = ['another-official'];
  return initializeActualPostPlayReview(fixture);
};
const event = (previous: ReturnType<typeof initial>, action: unknown = acceptanceAction()) => ({
  sourceId: 'accept-appeal', sourceVersion: 'fixture-v1', capability: 'actual_post_play_review_event_v1',
  sessionSourceId: previous.source.sourceId, expectedRevision: previous.revision,
  parent: { sourceId: previous.headSourceId, snapshotHash: previous.headHash }, action,
});
const parseEvent = (action: unknown = acceptanceAction()) => actualPostPlayReviewEventInput(event(initial(), action), 'accept-appeal');
const parseIntent = (source: unknown = officialIntent()) => actualPostPlayReviewIntentInput(source, officialIntent().sourceId);
const scope: PostPlayReviewNativeScope = {
  version: 'actual_post_play_review_scope_v1', careerId: 'career', seasonId: 'season', gameDay: 1,
  fixtureEventId: 'fixture', gameId: 'game', playId: 1, physicalPitchSourceId: 'pitch',
  clubs: { HOME: 'club', AWAY: 'other-club' }, originalOfficialRevision: 0, originalActivationJson: null,
  originalMatch: { ruleProfileId: NPB_2026_RULE_PROFILE.id, inning: 1, half: 'top', outs: 0, balls: 0, strikes: 0,
    bases: { first: null, second: null, third: null }, score: { home: 0, away: 0 }, playId: 1 },
};

// Exercise the actual Native admission function's official branch only. A DB
// read is an error here; this is not a Native physical-receipt acceptance proof.
const noDatabaseReads: PostPlayReviewDb = { prepare: () => { throw new Error('unexpected database read'); } };

it('APA01 preserves the exact acceptance event and deeply freezes its immutable execution references', () => {
  const source = event(initial()), parsed = actualPostPlayReviewEventInput(source, source.sourceId);
  expect(parsed).toEqual(source);
  expect(JSON.stringify(parsed)).toBe(JSON.stringify(source));
  expect(Object.isFrozen(parsed)).toBe(true);
  expect(Object.isFrozen(parsed.action)).toBe(true);
  if (parsed.action.kind !== 'accept_live_appeal_result') throw new Error('expected explicit appeal acceptance action');
  const action = parsed.action;
  expect(Object.isFrozen(action.executionReferences)).toBe(true);
  expect(Object.isFrozen(action.executionReferences[0])).toBe(true);
});

it('APA02 preserves the exact assigned-official acceptance intent and freezes its reference collection', () => {
  const source = officialIntent(), parsed = parseIntent(source);
  expect(parsed).toEqual(source);
  expect(JSON.stringify(parsed)).toBe(JSON.stringify(source));
  expect(Object.isFrozen(parsed)).toBe(true);
  if (parsed.capability !== 'actual_post_play_review_official_intent_v1' || parsed.action !== 'accept_live_appeal_result') {
    throw new Error('expected explicit official appeal acceptance intent');
  }
  const intent = parsed;
  expect(Object.isFrozen(intent.executionReferences)).toBe(true);
  expect(Object.isFrozen(intent.executionReferences[0])).toBe(true);
});

it.each(['tick', 'receivedAt', 'elapsedSeconds', 'replacementRuling', 'ruling', 'facts', 'rights', 'decision'])(
  'APA03 rejects caller-supplied %s in acceptance event or official intent', key => {
    expect(() => parseEvent({ ...acceptanceAction(), [key]: {} })).toThrow();
    expect(() => parseIntent({ ...officialIntent(), [key]: {} })).toThrow();
  });

it.each(['control', 'submission', 'opportunity', 'managerId', 'controllerId', 'schedulerId'])(
  'APA04 rejects %s as a substitute authority on the official acceptance intent', key => {
    expect(() => parseIntent({ ...officialIntent(), [key]: {} })).toThrow();
  });

it.each(['pa_physical_v1_field_roots', 'actual_first_base_play_ends', 'pa_lifecycle_v1_execution_views'])(
  'APA05 rejects %s references at both acceptance parser boundaries', owner => {
    const executionReferences = [{ ...reference(), owner }];
    expect(() => parseEvent({ ...acceptanceAction(), executionReferences })).toThrow();
    expect(() => parseIntent({ ...officialIntent(), executionReferences })).toThrow();
  });

it.each([
  ['empty list', []], ['duplicate receipt', [reference(), reference()]],
  ['same receipt identity with substituted hash', [reference(), { ...reference(), snapshotHash: 'c'.repeat(64) }]],
  ['missing source hash', [{ owner: reference().owner, sourceId: 'live-contact', snapshotHash: 'b'.repeat(64) }]],
  ['invalid source hash', [{ ...reference(), sourceHash: 'not-a-hash' }]],
  ['invalid snapshot hash', [{ ...reference(), snapshotHash: 'C'.repeat(64) }]],
  ['blank identity', [{ ...reference(), sourceId: '' }]],
  ['caller time in receipt', [{ ...reference(), tick: 4010 }]],
] as const)('APA06 rejects %s in the bounded immutable execution collection', (_name, executionReferences) => {
  expect(() => parseEvent({ ...acceptanceAction(), executionReferences })).toThrow();
  expect(() => parseIntent({ ...officialIntent(), executionReferences })).toThrow();
});

it('APA07 accepts multiple distinct immutable receipts without reordering them', () => {
  const executionReferences = [reference('second-contact'), reference('first-contact')];
  expect(parseEvent({ ...acceptanceAction(), executionReferences }).action).toEqual({ ...acceptanceAction(), executionReferences });
  expect(parseIntent({ ...officialIntent(), executionReferences })).toEqual({ ...officialIntent(), executionReferences });
});

it.each(['callId', 'windowId', 'intentSourceId', 'basisSnapshotId', 'basisEvidenceRevision', 'executionReferences'])(
  'APA08 rejects a missing %s in the acceptance action', field => {
    const action: Record<string, unknown> = acceptanceAction();
    delete action[field];
    expect(() => parseEvent(action)).toThrow();
  });

it.each([-1, 0.5, Number.MAX_SAFE_INTEGER + 1, '7', null])(
  'APA09 rejects invalid evidence revision %s in event and intent', basisEvidenceRevision => {
    expect(() => parseEvent({ ...acceptanceAction(), basisEvidenceRevision })).toThrow();
    expect(() => parseIntent({ ...officialIntent(), basisEvidenceRevision })).toThrow();
  });

it('APA10 preserves the old official request shape and refuses acceptance-only fields on it', () => {
  const source = requestIntent();
  expect(parseIntent(source)).toEqual(source);
  for (const field of ['executionReferences', 'basisSnapshotId', 'basisEvidenceRevision'] as const) {
    expect(() => parseIntent({ ...source, [field]: officialIntent()[field] })).toThrow();
  }
});

it('APA11 captures and replays assigned-official acceptance authority without reading control or Club rows', () => {
  const previous = initial(), source = parseEvent(), intent = parseIntent();
  const admission = capturePostPlayReviewAdmission(noDatabaseReads, scope, previous, source, intent);
  expect(admission.kind).toBe('admitted');
  if (admission.kind !== 'admitted') throw new Error('expected explicit official acceptance admission');
  expect(admission.evidence).toEqual({ version: 'actual_post_play_review_admission_v1', kind: 'official',
    careerId: scope.careerId, gameId: scope.gameId, playId: scope.playId, policyHash: hash(previous.source.policy),
    actorId: 'review-official', clubId: 'club', inputs: null, inputHashes: null });
  expect(replayPostPlayReviewAdmission(scope, previous, source, intent, admission.evidence)).toEqual(admission.evidence);
});

it.each(['requesterIds', 'reviewerIds'] as const)(
  'APA12 requires assigned membership in %s before Native acceptance admission', assignment => {
    const previous = initial(assignment), source = actualPostPlayReviewEventInput(event(previous), 'accept-appeal');
    expect(() => capturePostPlayReviewAdmission(noDatabaseReads, scope, previous, source, parseIntent()))
      .toThrow(/official|assign|entitle/);
  });

it.each([
  ['sessionSourceId', 'other-session'], ['gameId', 'other-game'], ['playId', 2],
  ['physicalPitchSourceId', 'other-pitch'], ['callId', 'other-call'], ['windowId', 'other-window'],
  ['entitlementSourceId', 'other-entitlement'], ['officialId', 'other-official'],
] as const)('APA13 rejects a changed %s in the official acceptance authority', (field, value) => {
  const intent = parseIntent({ ...officialIntent(), [field]: value });
  expect(() => capturePostPlayReviewAdmission(noDatabaseReads, scope, initial(), parseEvent(), intent))
    .toThrow(/scope|official|entitle|assign/);
});

it('APA14 binds the exact accepted intent identity without consulting mutable authority', () => {
  const source = parseEvent({ ...acceptanceAction(), intentSourceId: 'another-intent' });
  expect(() => capturePostPlayReviewAdmission(noDatabaseReads, scope, initial(), source, parseIntent())).toThrow(/scope|intent/);
});

it.each([
  ['basisSnapshotId', 'another-rule-snapshot'], ['basisEvidenceRevision', 8],
  ['executionReferences', [reference('another-contact')]],
  ['executionReferences', [{ ...reference(), sourceHash: 'c'.repeat(64) }]],
  ['executionReferences', [{ ...reference(), snapshotHash: 'd'.repeat(64) }]],
  ['executionReferences', [reference(), reference('extra-contact')]],
] as const)('APA15 binds the action and official intent to the same %s', (field, value) => {
  const intent = parseIntent({ ...officialIntent(), [field]: value });
  expect(() => capturePostPlayReviewAdmission(noDatabaseReads, scope, initial(), parseEvent(), intent))
    .toThrow(/official|action|basis|execution|differ/);
});

it('APA16 refuses request intent for acceptance and acceptance intent for an official request', () => {
  const previous = initial(), request = parseIntent(requestIntent());
  expect(() => capturePostPlayReviewAdmission(noDatabaseReads, scope, previous, parseEvent(), request)).toThrow(/official|action|intent/);
  const source = parseEvent({ kind: 'official_request', callId: 'call', windowId: 'review', intentSourceId: officialIntent().sourceId });
  expect(() => capturePostPlayReviewAdmission(noDatabaseReads, scope, previous, source, parseIntent())).toThrow(/official|action|intent/);
});

it('APA17 rejects a missing official intent without falling back to scheduler authority', () => {
  expect(() => capturePostPlayReviewAdmission(noDatabaseReads, scope, initial(), parseEvent(), null)).toThrow(/scope|intent/);
});

it.each([
  ['gameId', 'other-game'], ['playId', 2], ['physicalPitchSourceId', 'other-pitch'],
] as const)('APA18 rejects Native scope with a different %s', (field, value) => {
  expect(() => capturePostPlayReviewAdmission(noDatabaseReads, { ...scope, [field]: value }, initial(), parseEvent(), parseIntent()))
    .toThrow(/scope/);
});

it('APA19 rejects an opportunity outside the original Native fixture sides', () => {
  expect(() => capturePostPlayReviewAdmission(noDatabaseReads, { ...scope, clubs: { HOME: 'foreign-home', AWAY: 'foreign-away' } },
    initial(), parseEvent(), parseIntent())).toThrow(/fixture side/);
});

it('APA20 replays authority against the selected original action and refuses archive substitution', () => {
  const previous = initial(), source = parseEvent(), intent = parseIntent();
  const admission = capturePostPlayReviewAdmission(noDatabaseReads, scope, previous, source, intent);
  if (admission.kind !== 'admitted') throw new Error('expected explicit official acceptance admission');
  for (const changes of [{ actorId: 'other-official' }, { clubId: 'other-club' }, { policyHash: 'f'.repeat(64) }, { kind: 'scheduler' as const }]) {
    expect(() => replayPostPlayReviewAdmission(scope, previous, source, intent, { ...admission.evidence, ...changes }))
      .toThrow(/archive differs/);
  }
  expect(() => replayPostPlayReviewAdmission(scope, previous, source,
    parseIntent({ ...officialIntent(), basisEvidenceRevision: 8 }), admission.evidence)).toThrow(/official|basis|differ/);
});

it('APA21 refuses controlled intent as authority for explicit official appeal acceptance', () => {
  const controlled = parseIntent({ ...intentFixture(), sourceId: officialIntent().sourceId });
  expect(() => capturePostPlayReviewAdmission(noDatabaseReads, scope, initial(), parseEvent(), controlled))
    .toThrow(/official/);
});

it.each(['executionReferences', 'basisSnapshotId', 'basisEvidenceRevision'])(
  'APA22 refuses acceptance intent without %s', field => {
    const source: Record<string, unknown> = officialIntent();
    delete source[field];
    expect(() => parseIntent(source)).toThrow();
  });
