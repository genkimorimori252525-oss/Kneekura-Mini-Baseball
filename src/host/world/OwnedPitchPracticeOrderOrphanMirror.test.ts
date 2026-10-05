import { afterEach, expect, it } from 'vitest';
import { practiceOrderFixture } from './OwnedPitchPracticeOrder.test-support';

const cleanup: (() => void)[] = [];
afterEach(() => { while (cleanup.length) cleanup.pop()!(); });

it.each(['source_kind', 'source_event_id'] as const)('rejects an orphan owned order whose %s mirror hides the original JSON identity', async mirror => {
  const f = await practiceOrderFixture(cleanup), order = f.issue(f.prepare());
  f.base.opportunities.clear(); const begun = f.base.owner.begin(order.sourceId);
  const event = f.base.db.prepare('SELECT event_json FROM world_decision_revision_events WHERE career_id=? AND world_revision=?')
    .get(order.opportunity.careerId, order.execution.worldRevision) as { event_json: string };
  expect(JSON.parse(event.event_json)).toMatchObject({ kind: 'PracticeOpportunityIssued', sourceId: order.sourceId });
  f.base.db.prepare('DELETE FROM pitch_practice_orders WHERE source_id=?').run(order.sourceId);
  f.base.db.prepare('DELETE FROM pitch_practice_order_decisions WHERE source_id=?').run(order.decisionSourceId);
  f.base.db.prepare(`UPDATE world_decision_revision_events SET ${mirror}=? WHERE career_id=? AND world_revision=?`)
    .run('unrelated-mirror', order.opportunity.careerId, order.execution.worldRevision);
  const changed = f.base.db.prepare('SELECT event_json FROM world_decision_revision_events WHERE career_id=? AND world_revision=?')
    .get(order.opportunity.careerId, order.execution.worldRevision) as { event_json: string };
  expect(changed.event_json).toBe(event.event_json);
  const before = f.snapshot();
  expect(() => f.owner.readOrder(order.sourceId)).toThrow(/orphan|missing|order|evidence/i);
  expect(() => f.base.owner.read(begun.attemptId)).toThrow(/order|source|corrupt|evidence/i);
  expect(() => f.base.owner.advance(begun.attemptId, begun.revision, begun.plannedDelivery.timeline.followThroughEndUs))
    .toThrow(/order|source|corrupt|evidence/i);
  expect(f.snapshot()).toBe(before);
});
