import { describe, it } from 'vitest';
import { strict as assert } from 'node:assert';
import { createHumanControlState, changeHumanControl, resolveDecisionAuthority, ControlValidationError } from './index';
import { seed, opportunity } from './ControlFixtures.test-support';

describe('Human control state', () => {
  it('detaches and freezes policy without owning a Manager Agent or history', () => {
    const input = seed(); const state = createHumanControlState(input);
    (input.domainIds as string[]).push('OTHER');
    assert.equal(state.domainIds.includes('OTHER'), false);
    assert.ok(Object.isFrozen(state)); assert.ok(Object.isFrozen(state.domainIds));
    assert.ok(Object.isFrozen(state.manualDomainIds));
    assert.deepEqual(Object.keys(state).sort(), ['schemaVersion', 'revision', 'controllerId', 'controlledClubId', 'domainIds', 'manualDomainIds'].sort());
  });
  it('round-trips saved state without changing its revision', () => {
    const state = createHumanControlState({ ...seed(), revision: 8 });
    assert.deepEqual(createHumanControlState(JSON.parse(JSON.stringify(state))), state);
  });
  it('normalizes domain sets deterministically', () => {
    const state = createHumanControlState(seed());
    assert.deepEqual(state.domainIds, ['BULLPEN', 'IN_GAME_COMMAND', 'LINEUP', 'PROMOTION_DEMOTION']);
  });
  for (const [name, patch] of [
    ['negative revision', { revision: -1 }], ['fractional revision', { revision: 0.5 }],
    ['unsafe revision', { revision: Number.MAX_SAFE_INTEGER + 1 }], ['NaN revision', { revision: NaN }],
    ['blank controller', { controllerId: ' ' }], ['duplicate domains', { domainIds: ['LINEUP', 'LINEUP'] }],
    ['unknown manual domain', { manualDomainIds: ['MOOD_BUTTON'] }],
    ['manual policy without a club', { controlledClubId: null }],
    ['unsupported schema', { schemaVersion: 2 }], ['sparse domain list', { domainIds: new Array(1) }],
    ['duplicate manual domains', { manualDomainIds: ['LINEUP', 'LINEUP'] }],
  ] as const) {
    it(`rejects ${name}`, () => assert.throws(() => createHumanControlState({ ...seed(), ...patch }), ControlValidationError));
  }
  it('does not use domain IDs as object prototype keys', () => {
    const state = createHumanControlState({ ...seed(), domainIds: ['__proto__'], manualDomainIds: ['__proto__'] });
    assert.ok(resolveDecisionAuthority(state, { ...opportunity(), domainId: '__proto__' }).ok);
  });
});

describe('Atomic control policy changes', () => {
  it('switches club and policy while preserving identity and emitting detached evidence', () => {
    const before = createHumanControlState(seed());
    const change = { expectedRevision: 0, controlledClubId: 'club-B', manualDomainIds: ['BULLPEN'] };
    const result = changeHumanControl(before, change); assert.ok(result.ok);
    assert.equal(before.controlledClubId, 'club-A'); assert.equal(result.state.controlledClubId, 'club-B');
    assert.equal(result.state.revision, 1); assert.equal(result.state.controllerId, 'human-1');
    assert.equal(result.events.length, 1); assert.equal(result.events[0].previousClubId, 'club-A');
    change.manualDomainIds.push('LINEUP'); assert.deepEqual(result.state.manualDomainIds, ['BULLPEN']);
    assert.ok(Object.isFrozen(result.events)); assert.ok(Object.isFrozen(result.events[0]));
  });
  it('removes the overlay explicitly without deleting world state', () => {
    const state = createHumanControlState(seed());
    const result = changeHumanControl(state, { expectedRevision: 0, controlledClubId: null, manualDomainIds: [] });
    assert.ok(result.ok); assert.equal(result.state.controlledClubId, null);
    const route = resolveDecisionAuthority(result.state, opportunity()); assert.ok(route.ok);
    assert.equal(route.value.kind, 'MANAGER');
    if (route.value.kind === 'MANAGER') assert.equal(route.value.origin, 'MANAGER_AUTONOMOUS');
  });
  it('rejects stale updates without partial change or success events', () => {
    const state = createHumanControlState(seed());
    const result = changeHumanControl(state, { expectedRevision: 3, controlledClubId: 'club-B', manualDomainIds: [] });
    assert.equal(result.ok, false); assert.equal(result.state, state); assert.deepEqual(result.events, []);
    if (!result.ok) assert.equal(result.reason.code, 'STALE_CONTROL_REVISION');
  });
  it('rejects invalid replacement policy atomically', () => {
    const state = createHumanControlState(seed());
    const result = changeHumanControl(state, { expectedRevision: 0, controlledClubId: 'club-B', manualDomainIds: ['UNKNOWN'] });
    assert.equal(result.ok, false); assert.equal(result.state, state); assert.deepEqual(result.events, []);
  });
  it('leaves a no-op at the same revision with no event', () => {
    const state = createHumanControlState(seed());
    const result = changeHumanControl(state, { expectedRevision: 0, controlledClubId: 'club-A', manualDomainIds: ['LINEUP'] });
    assert.ok(result.ok); assert.equal(result.state, state); assert.deepEqual(result.events, []);
  });
  it('rejects revision overflow rather than losing stale-write protection', () => {
    const state = createHumanControlState({ ...seed(), revision: Number.MAX_SAFE_INTEGER });
    const result = changeHumanControl(state, { expectedRevision: state.revision, controlledClubId: null, manualDomainIds: [] });
    assert.equal(result.ok, false); if (!result.ok) assert.equal(result.reason.code, 'REVISION_EXHAUSTED');
  });
});

describe('Current authority routing', () => {
  it('waits for human input on a manual domain', () => {
    const result = resolveDecisionAuthority(createHumanControlState(seed()), opportunity()); assert.ok(result.ok);
    assert.deepEqual(result.value, { kind: 'HUMAN_REQUIRED', controllerId: 'human-1' });
  });
  it('delegates other domains to the current underlying manager', () => {
    const result = resolveDecisionAuthority(createHumanControlState(seed()), { ...opportunity(), domainId: 'BULLPEN' });
    assert.ok(result.ok); assert.deepEqual(result.value, { kind: 'MANAGER', origin: 'MANAGER_DELEGATED', managerId: 'manager-A', appointmentId: 'tenure-A-1' });
  });
  it('routes other clubs autonomously even when the same domain is manual at the controlled club', () => {
    const result = resolveDecisionAuthority(createHumanControlState(seed()), { ...opportunity(), clubId: 'club-B' });
    assert.ok(result.ok); assert.equal(result.value.kind, 'MANAGER');
    if (result.value.kind === 'MANAGER') assert.equal(result.value.origin, 'MANAGER_AUTONOMOUS');
  });
  it('uses a replacement manager, never the original manager from overlay activation', () => {
    const state = createHumanControlState(seed());
    const result = resolveDecisionAuthority(state, { ...opportunity(), domainId: 'BULLPEN', managerId: 'manager-new', appointmentId: 'tenure-new' });
    assert.ok(result.ok); assert.equal(result.value.kind, 'MANAGER');
    if (result.value.kind === 'MANAGER') assert.equal(result.value.managerId, 'manager-new');
  });
  it('rejects an unregistered domain', () => {
    const result = resolveDecisionAuthority(createHumanControlState(seed()), { ...opportunity(), domainId: 'UNKNOWN' });
    assert.equal(result.ok, false); if (!result.ok) assert.equal(result.reason.code, 'UNKNOWN_DOMAIN');
  });
  it('rejects a sparse legal-action set without throwing', () => {
    const result = resolveDecisionAuthority(createHumanControlState(seed()), { ...opportunity(), legalActionIds: new Array(1) });
    assert.equal(result.ok, false);
  });
});

describe('Review regression: compare opaque domain IDs structurally', () => {
  it('does not confuse different policies with the same delimiter-joined text', () => {
    const state = createHumanControlState({ ...seed(), domainIds: ['A', 'B', 'A\0B'], manualDomainIds: ['A', 'B'] });
    const result = changeHumanControl(state, { expectedRevision: 0, controlledClubId: 'club-A', manualDomainIds: ['A\0B'] });
    assert.ok(result.ok); assert.equal(result.state.revision, 1); assert.deepEqual(result.state.manualDomainIds, ['A\0B']);
  });
});
