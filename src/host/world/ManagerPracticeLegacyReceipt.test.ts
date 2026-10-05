import { createHash } from 'node:crypto';
import { afterEach, expect, it } from 'vitest';
import { selectControlledDecision } from '../../core/world/control/ControlledDecision';
import { attributeExecutedDecision } from '../../core/world/control/DecisionEvidence';
import { canonicalRosterEvidenceJson as json } from './RosterEvidenceJson';
import { practiceOrderFixture } from './OwnedPitchPracticeOrder.test-support';

const cleanup: (() => void)[] = [];
afterEach(() => { while (cleanup.length) cleanup.pop()!(); });
const hash = (value: unknown) => createHash('sha256').update(json(value)).digest('hex');

it('preserves the original Human receipt schema and hash inputs byte for byte through issuance and reopen', async () => {
  const f = await practiceOrderFixture(cleanup), request = f.request(), control = f.control.readHead('career-a')!.control;
  const decision = f.prepare(request), raw = f.base.db.prepare('SELECT * FROM pitch_practice_order_decisions WHERE source_id=?').get(request.sourceId)!;
  const read = (name: string) => JSON.parse(String(raw[name]));
  // This is the legacy on-disk contract from c44181e's unchanged Human owner.
  // No route tag, absent optional field or Manager evidence enters its hash.
  const opportunity = { decisionId: request.decisionId, contextId: request.contextId, worldRevision: request.expected.worldRevision,
    clubId: request.clubId, domainId: 'PITCH_PRACTICE', managerId: 'manager-a', appointmentId: 'appointment-a', legalActionIds: [request.actionId] };
  const legacyHash = hash({ request, prescription: f.prescription, opportunity, control,
    frame: read('frame_json'), episode: read('episode_json'), heads: read('heads_json'), evidence: read('evidence_json') });
  const legacyDecision = { sourceId: request.sourceId, request, prescription: f.prescription, opportunity, control, hash: legacyHash };
  expect(raw.decision_json).toBe(json(legacyDecision)); expect(decision).toEqual(legacyDecision);
  expect(Object.hasOwn(decision.request, 'managerSelection')).toBe(false);
  expect(Object.hasOwn(decision.prescription, 'managerAction')).toBe(false);

  const executionId = 'legacy-human-execution', order = f.issue(decision, executionId);
  const selected = selectControlledDecision(control, opportunity, f.submission(decision));
  if (!selected.ok) throw new Error('original Human control contract is unavailable');
  const sourceId = `practice-order:${hash([request.careerId, executionId])}`;
  const execution = { executionId, decisionId: request.decisionId, contextId: request.contextId, actionId: request.actionId,
    worldRevision: request.expected.worldRevision + 1, eventIds: [sourceId] };
  const projection = attributeExecutedDecision(selected.value, execution);
  if (!projection.ok) throw new Error('original Human attribution contract is unavailable');
  expect(projection.value.managerSelfChosenEvidence).toBeNull();
  const legacyReceipt = { sourceId, decisionSourceId: request.sourceId, prescriptionSourceId: f.prescription.sourceId,
    opportunity: order.opportunity, decision: selected.value, execution, projection: projection.value };
  const legacyOrder = { ...legacyReceipt, hash: hash({ receipt: legacyReceipt, decisionHash: legacyHash }) };
  const saved = f.base.db.prepare('SELECT order_json FROM pitch_practice_orders WHERE source_id=?').get(sourceId)!;
  expect(saved.order_json).toBe(json(legacyOrder)); expect(order).toEqual(legacyOrder);
  const before = f.snapshot(); f.clearAuthorities(); f.reopen();
  expect(f.owner.readOrderDecision(request.sourceId)).toEqual(legacyDecision);
  expect(f.owner.readOrder(sourceId)).toEqual(legacyOrder); expect(f.issue(decision, executionId)).toEqual(legacyOrder);
  expect(f.snapshot()).toBe(before);
});
