import { afterEach, expect, it } from 'vitest';
import { practiceOrderFixture } from './OwnedPitchPracticeOrder.test-support';

const cleanup: (() => void)[] = [];
afterEach(() => { while (cleanup.length) cleanup.pop()!(); });

it('retains an unbegun World order claim hidden behind a duplicate JSON Source key', async () => {
  const f = await practiceOrderFixture(cleanup), order = f.issue(f.prepare());
  expect(f.rows('pitch_practice_attempts')).toHaveLength(0);
  const original = f.base.db.prepare('SELECT event_json FROM world_decision_revision_events WHERE career_id=? AND world_revision=?')
    .get(order.opportunity.careerId, order.execution.worldRevision) as { event_json: string };
  const duplicated = '{"sourceId":"unrelated-json-source",' + original.event_json.slice(1);
  expect(JSON.parse(duplicated)).toEqual(JSON.parse(original.event_json));
  expect(JSON.parse(duplicated).sourceId).toBe(order.sourceId);
  f.base.db.prepare('DELETE FROM pitch_practice_orders WHERE source_id=?').run(order.sourceId);
  f.base.db.prepare('DELETE FROM pitch_practice_order_decisions WHERE source_id=?').run(order.decisionSourceId);
  f.base.db.prepare('UPDATE world_decision_revision_events SET source_kind=?,source_event_id=?,event_json=? WHERE career_id=? AND world_revision=?')
    .run('unrelated-sql-kind', 'unrelated-sql-source', duplicated, order.opportunity.careerId, order.execution.worldRevision);
  const firstKey = f.base.db.prepare("SELECT json_extract(event_json,'$.sourceId') AS source_id FROM world_decision_revision_events WHERE career_id=? AND world_revision=?")
    .get(order.opportunity.careerId, order.execution.worldRevision) as { source_id: string };
  expect(firstKey.source_id).toBe('unrelated-json-source');
  // No actual attempt exists yet, so its physical fingerprint cannot rescue
  // the missing ownership check. A live callback must not turn this order into
  // an ordinary accepted opportunity with the same unrestricted Source ID.
  f.base.opportunities.set(order.sourceId, order.opportunity);
  const before = f.snapshot();
  expect(() => f.base.owner.begin(order.sourceId)).toThrow(/owned|order|source|evidence/i);
  expect(() => f.owner.readOrder(order.sourceId)).toThrow(/owned|order|source|evidence/i);
  expect(f.snapshot()).toBe(before);
  expect(f.rows('pitch_practice_attempts')).toHaveLength(0);
  expect(f.rows('world_player_workload_activities')).toHaveLength(0);
});
