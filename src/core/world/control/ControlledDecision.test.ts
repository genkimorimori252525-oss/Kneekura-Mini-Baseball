import { describe, it } from 'vitest';
import { strict as assert } from 'node:assert';
import { createHumanControlState, changeHumanControl, selectControlledDecision,
  restoreControlledDecision, attributeExecutedDecision, ControlValidationError } from './index';
import { seed, opportunity, humanSubmission, managerSubmission, execution } from './ControlFixtures.test-support';

function selectedHuman() {
  const result = selectControlledDecision(createHumanControlState(seed()), opportunity(), humanSubmission());
  assert.ok(result.ok); return result.value;
}
function selectedManager(autonomous = false) {
  const result = selectControlledDecision(createHumanControlState({ ...seed(), manualDomainIds: [] }),
    { ...opportunity(), clubId: autonomous ? 'club-B' : 'club-A' }, managerSubmission());
  assert.ok(result.ok); return result.value;
}

describe('Decision-time selection and attribution', () => {
  it('keeps the exact human action, current manager identity and immutable actor', () => {
    const record = selectedHuman();
    assert.equal(record.origin, 'HUMAN_OVERRIDE'); assert.equal(record.actionId, 'bunt');
    assert.equal(record.managerId, 'manager-A'); assert.equal(record.appointmentId, 'tenure-A-1');
    assert.ok(Object.isFrozen(record)); assert.ok(Object.isFrozen(record.actor));
    assert.equal('result' in record, false); assert.equal('learningUpdate' in record, false);
  });
  it('allows a one-shot human override on a delegated domain', () => {
    const result = selectControlledDecision(createHumanControlState(seed()), { ...opportunity(), domainId: 'BULLPEN' }, humanSubmission());
    assert.ok(result.ok); assert.equal(result.value.origin, 'HUMAN_OVERRIDE'); assert.equal(result.value.actionId, 'bunt');
  });
  it('records delegated manager choices with their actual decision-time trace', () => {
    const record = selectedManager(); assert.equal(record.origin, 'MANAGER_DELEGATED');
    assert.equal(record.actor.kind, 'MANAGER'); if (record.actor.kind === 'MANAGER') assert.equal(record.actor.traceId, 'trace-A-1');
  });
  it('records noncontrolled choices as manager autonomous', () => assert.equal(selectedManager(true).origin, 'MANAGER_AUTONOMOUS'));
  it('does not silently fall back to manager input on a manual domain', () => {
    const result = selectControlledDecision(createHumanControlState(seed()), opportunity(), managerSubmission());
    assert.equal(result.ok, false); if (!result.ok) assert.equal(result.reason.code, 'HUMAN_INPUT_REQUIRED');
  });
  for (const actor of ['HUMAN', 'MANAGER'] as const) {
    it(`uses the same legality gate for ${actor}`, () => {
      const result = selectControlledDecision(createHumanControlState({ ...seed(), manualDomainIds: [] }), opportunity(),
        { ...(actor === 'HUMAN' ? humanSubmission() : managerSubmission()), actionId: 'illegal-option' });
      assert.equal(result.ok, false); if (!result.ok) assert.equal(result.reason.code, 'ILLEGAL_ACTION');
    });
  }
  it('rejects foreign controllers', () => {
    const result = selectControlledDecision(createHumanControlState(seed()), opportunity(),
      { ...humanSubmission(), actor: { kind: 'HUMAN', controllerId: 'other-human' } });
    assert.equal(result.ok, false); if (!result.ok) assert.equal(result.reason.code, 'HUMAN_NOT_AUTHORIZED');
  });
  it('rejects human actions for a noncontrolled club', () => {
    const result = selectControlledDecision(createHumanControlState(seed()), { ...opportunity(), clubId: 'club-B' }, humanSubmission());
    assert.equal(result.ok, false); if (!result.ok) assert.equal(result.reason.code, 'HUMAN_NOT_AUTHORIZED');
  });
  it('rejects a decision pending before a control switch even after returning to that club', () => {
    const first = changeHumanControl(createHumanControlState(seed()), { expectedRevision: 0, controlledClubId: 'club-B', manualDomainIds: [] });
    assert.ok(first.ok);
    const second = changeHumanControl(first.state, { expectedRevision: 1, controlledClubId: 'club-A', manualDomainIds: ['LINEUP'] }); assert.ok(second.ok);
    const result = selectControlledDecision(second.state, opportunity(), humanSubmission());
    assert.equal(result.ok, false); if (!result.ok) assert.equal(result.reason.code, 'STALE_CONTROL_REVISION');
  });
  it('rejects stale world revision', () => {
    const result = selectControlledDecision(createHumanControlState(seed()), opportunity(), { ...humanSubmission(), expectedWorldRevision: 9 });
    assert.equal(result.ok, false); if (!result.ok) assert.equal(result.reason.code, 'STALE_WORLD_REVISION');
  });
  it('rejects proposals from a previous appointment even for the same manager', () => {
    const result = selectControlledDecision(createHumanControlState({ ...seed(), manualDomainIds: [] }),
      { ...opportunity(), appointmentId: 'tenure-A-2' }, managerSubmission());
    assert.equal(result.ok, false); if (!result.ok) assert.equal(result.reason.code, 'STALE_MANAGER_APPOINTMENT');
  });
  it('uses the replacement manager when a new delegated decision is made', () => {
    const submission = managerSubmission(); assert.equal(submission.actor.kind, 'MANAGER');
    const result = selectControlledDecision(createHumanControlState({ ...seed(), manualDomainIds: [] }),
      { ...opportunity(), managerId: 'manager-B', appointmentId: 'tenure-B' },
      { ...submission, actor: { kind: 'MANAGER', managerId: 'manager-B', appointmentId: 'tenure-B', traceId: 'trace-B' } });
    assert.ok(result.ok); assert.equal(result.value.managerId, 'manager-B');
  });
  it('rejects a manager proposal without a decision-time trace reference', () => {
    const result = selectControlledDecision(createHumanControlState({ ...seed(), manualDomainIds: [] }), opportunity(),
      { ...managerSubmission(), actor: { kind: 'MANAGER', managerId: 'manager-A', appointmentId: 'tenure-A-1' } });
    assert.equal(result.ok, false);
  });
  it('rejects unknown actor kinds and malformed requests without throwing', () => {
    for (const value of [null, {}, { ...humanSubmission(), actor: { kind: 'ADMIN' } }, { ...humanSubmission(), expectedWorldRevision: NaN }]) {
      assert.equal(selectControlledDecision(createHumanControlState(seed()), opportunity(), value).ok, false);
    }
  });
  it('ignores caller-supplied origin labels and derives authority', () => {
    const result = selectControlledDecision(createHumanControlState(seed()), opportunity(), { ...humanSubmission(), origin: 'MANAGER_AUTONOMOUS' });
    assert.ok(result.ok); assert.equal(result.value.origin, 'HUMAN_OVERRIDE');
  });
});

describe('Restoration and executed evidence', () => {
  it('round-trips a human record without changing attribution', () => {
    const record = selectedHuman(); assert.deepEqual(restoreControlledDecision(JSON.parse(JSON.stringify(record))), record);
  });
  it('round-trips both types of manager record', () => {
    for (const record of [selectedManager(), selectedManager(true)]) assert.deepEqual(restoreControlledDecision(JSON.parse(JSON.stringify(record))), record);
  });
  it('rejects a stored origin that contradicts the captured actor', () => {
    assert.throws(() => restoreControlledDecision({ ...selectedHuman(), origin: 'MANAGER_DELEGATED' }), ControlValidationError);
  });
  it('rejects a stored manager actor from another appointment', () => {
    const record = selectedManager(); assert.equal(record.actor.kind, 'MANAGER');
    assert.throws(() => restoreControlledDecision({ ...record, actor: { ...record.actor, appointmentId: 'wrong' } }), ControlValidationError);
  });
  it('retains real consequences of human choices without manager self-chosen evidence', () => {
    const result = attributeExecutedDecision(selectedHuman(), execution()); assert.ok(result.ok);
    assert.deepEqual(result.value.worldEvidence.eventIds, ['world-event-1']);
    assert.equal(result.value.worldEvidence.origin, 'HUMAN_OVERRIDE');
    assert.equal(result.value.managerSelfChosenEvidence, null);
  });
  for (const autonomous of [false, true]) {
    it(`routes ${autonomous ? 'autonomous' : 'delegated'} evidence to the historical manager`, () => {
      const record = selectedManager(autonomous);
      const result = attributeExecutedDecision(record, { ...execution(), actionId: 'swing' }); assert.ok(result.ok);
      assert.equal(result.value.managerSelfChosenEvidence?.managerId, 'manager-A');
      assert.equal(result.value.managerSelfChosenEvidence?.appointmentId, 'tenure-A-1');
      assert.equal(result.value.managerSelfChosenEvidence?.traceId, 'trace-A-1');
    });
  }
  it('keeps historical attribution independent of later control and manager changes', () => {
    const record = selectedHuman();
    const changed = changeHumanControl(createHumanControlState(seed()), { expectedRevision: 0, controlledClubId: 'club-B', manualDomainIds: [] }); assert.ok(changed.ok);
    const result = attributeExecutedDecision(restoreControlledDecision(JSON.parse(JSON.stringify(record))), execution()); assert.ok(result.ok);
    assert.equal(result.value.worldEvidence.managerId, 'manager-A'); assert.equal(result.value.managerSelfChosenEvidence, null);
  });
  for (const [key, value] of [['decisionId', 'other'], ['contextId', 'other'], ['actionId', 'other']] as const) {
    it(`rejects execution with mismatched ${key}`, () => {
      const result = attributeExecutedDecision(selectedHuman(), { ...execution(), [key]: value });
      assert.equal(result.ok, false); if (!result.ok) assert.equal(result.reason.code, 'EXECUTION_MISMATCH');
    });
  }
  it('rejects evidence that predates the decision', () => {
    const result = attributeExecutedDecision(selectedHuman(), { ...execution(), worldRevision: 9 });
    assert.equal(result.ok, false); if (!result.ok) assert.equal(result.reason.code, 'EXECUTION_PREDATES_DECISION');
  });
  for (const eventIds of [[], ['duplicate', 'duplicate'], new Array(1), ['']]) {
    it(`rejects invalid actual-event evidence ${JSON.stringify(eventIds)}`, () => {
      assert.equal(attributeExecutedDecision(selectedHuman(), { ...execution(), eventIds }).ok, false);
    });
  }
  it('does not manufacture consequences for a selected but unexecuted decision', () => {
    assert.equal(attributeExecutedDecision(selectedHuman(), null).ok, false);
  });
  it('detaches event receipts and produces replay-stable projections', () => {
    const record = selectedHuman(); const input = execution();
    const first = attributeExecutedDecision(record, input); assert.ok(first.ok);
    assert.deepEqual(attributeExecutedDecision(record, input), first);
    (input.eventIds as string[]).push('later-event');
    assert.deepEqual(first.value.worldEvidence.eventIds, ['world-event-1']);
    assert.ok(Object.isFrozen(first.value.worldEvidence.eventIds));
  });
  it('never turns 100 human bunts into self-chosen manager evidence or growing overlay state', () => {
    const state = createHumanControlState(seed()); const initial = JSON.stringify(state);
    for (let i = 0; i < 100; i++) {
      const chosen = selectControlledDecision(state, { ...opportunity(), decisionId: `decision-${i}` }, { ...humanSubmission(), decisionId: `decision-${i}` }); assert.ok(chosen.ok);
      const evidence = attributeExecutedDecision(chosen.value, { ...execution(), decisionId: `decision-${i}`, executionId: `execution-${i}` }); assert.ok(evidence.ok);
      assert.equal(evidence.value.managerSelfChosenEvidence, null);
    }
    assert.equal(JSON.stringify(state), initial);
  });
});

describe('Review regressions: bind submissions to their exact opportunity', () => {
  for (const key of ['decisionId', 'contextId'] as const) {
    it(`rejects another ${key} even when revisions, actor and legal action coincide`, () => {
      const result = selectControlledDecision(createHumanControlState(seed()), opportunity(),
        { ...humanSubmission(), decisionId: 'decision-1', contextId: 'context-1', [key]: 'other-opportunity' });
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.reason.code, 'DECISION_CONTEXT_MISMATCH');
    });
  }
});
