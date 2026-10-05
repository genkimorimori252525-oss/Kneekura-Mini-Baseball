import { afterEach, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { practiceHash, practiceJson } from './PitchPracticeAttempt';
import { witnessSqliteWrite } from './SqliteWriteWitness.test-support';
import { practiceOrderFixture, type IssuedPracticeOrderDecision, type OwnedPracticeOrder } from './OwnedPitchPracticeOrder.test-support';

const cleanup: (() => void)[] = [];
afterEach(() => { while (cleanup.length) cleanup.pop()!(); });
const fixture = () => practiceOrderFixture(cleanup);

// Produce an internally valid, differently admitted command on the actual writer.
// A checksum-only reader accepts it; the write must still retain its captured input.
function rewriteDecision(db: Pick<DatabaseSync, 'prepare'>, sourceId: string): IssuedPracticeOrderDecision {
  const row = db.prepare('SELECT * FROM pitch_practice_order_decisions WHERE source_id=?').get(sourceId) as {
    decision_json: string; frame_json: string; episode_json: string; heads_json: string; evidence_json: string;
  };
  const decision = JSON.parse(row.decision_json) as IssuedPracticeOrderDecision;
  decision.prescription.practiceSeed += 1;
  decision.hash = practiceHash({ request: decision.request, prescription: decision.prescription, opportunity: decision.opportunity,
    control: decision.control, frame: JSON.parse(row.frame_json), episode: JSON.parse(row.episode_json),
    heads: JSON.parse(row.heads_json), evidence: JSON.parse(row.evidence_json) });
  db.prepare('UPDATE pitch_practice_order_decisions SET decision_json=? WHERE source_id=?').run(practiceJson(decision), sourceId);
  return decision;
}

it('rejects a coherent post-INSERT decision substitution and rolls back the original admitted input', async () => {
  const f = await fixture(), request = f.request(), before = f.snapshot();
  let sawInsert = false, sawCoherentSubstitution = false;
  const witness = witnessSqliteWrite('INSERT INTO pitch_practice_order_decisions VALUES(?,?,?,?,?,?,?,?,?,?,?)', db => {
    sawInsert = db !== f.base.db && Boolean(db.prepare('SELECT 1 FROM pitch_practice_order_decisions WHERE source_id=?').get(request.sourceId));
    const changed = rewriteDecision(db, request.sourceId), read = f.owner.readOrderDecision(request.sourceId);
    sawCoherentSubstitution = read?.hash === changed.hash && read.prescription.practiceSeed === f.prescription.practiceSeed + 1;
    return sawInsert && sawCoherentSubstitution;
  });
  try {
    expect(() => f.owner.prepareOrderDecision(request)).toThrow(/admitted|changed|different|decision|source/i);
    expect(witness.wasReached()).toBe(true); expect(sawInsert).toBe(true); expect(sawCoherentSubstitution).toBe(true);
  } finally { witness.close(); }
  expect(f.snapshot()).toBe(before); expect(f.owner.readOrderDecision(request.sourceId)).toBeNull();
  expect(f.prepare(request).prescription).toEqual(f.prescription);
});

it('rejects a coherent post-INSERT order substitution even when its decision and World hash agree', async () => {
  const f = await fixture(), issued = f.prepare(), before = f.snapshot();
  let sawActualOrderAndWorld = false, sawCoherentSubstitution = false;
  const witness = witnessSqliteWrite("INSERT INTO world_decision_revision_events (career_id,world_revision,source_kind,source_event_id,event_json) VALUES(?,?,'PITCH_PRACTICE_ORDER',?,?)", db => {
    const row = db.prepare('SELECT * FROM pitch_practice_orders WHERE decision_source_id=?').get(issued.sourceId) as { source_id: string; order_json: string };
    const order = JSON.parse(row.order_json) as OwnedPracticeOrder;
    const world = db.prepare('SELECT event_json FROM world_decision_revision_events WHERE career_id=? AND world_revision=?')
      .get(order.opportunity.careerId, order.execution.worldRevision) as { event_json: string };
    sawActualOrderAndWorld = db !== f.base.db && Boolean(world);
    const changed = rewriteDecision(db, issued.sourceId);
    order.opportunity.practiceSeed = changed.prescription.practiceSeed;
    const { hash: previousHash, ...receipt } = order;
    order.hash = practiceHash({ receipt, decisionHash: changed.hash });
    if (order.hash === previousHash) throw new Error('coherent substitution did not change the order');
    db.prepare('UPDATE pitch_practice_orders SET order_json=?,order_hash=? WHERE source_id=?')
      .run(practiceJson(order), order.hash, order.sourceId);
    const event = JSON.parse(world.event_json) as { orderHash: string }; event.orderHash = order.hash;
    db.prepare('UPDATE world_decision_revision_events SET event_json=? WHERE career_id=? AND world_revision=?')
      .run(practiceJson(event), order.opportunity.careerId, order.execution.worldRevision);
    const read = f.owner.readOrder(order.sourceId);
    sawCoherentSubstitution = read?.hash === order.hash && read.opportunity.practiceSeed === f.prescription.practiceSeed + 1;
    return sawActualOrderAndWorld && sawCoherentSubstitution;
  });
  try {
    expect(() => f.issue(issued)).toThrow(/admitted|changed|different|order|source/i);
    expect(witness.wasReached()).toBe(true); expect(sawActualOrderAndWorld).toBe(true); expect(sawCoherentSubstitution).toBe(true);
  } finally { witness.close(); }
  expect(f.snapshot()).toBe(before); expect(f.owner.readOrderDecision(issued.sourceId)).toEqual(issued);
  expect(f.issue(issued).opportunity.practiceSeed).toBe(f.prescription.practiceSeed);
});

it('preserves an ordinary legacy accepted opportunity whose unrestricted Source ID uses the new prefix', async () => {
  const f = await fixture(), ordinary = { ...f.base.opportunity, sourceId: 'practice-order:legacy-accepted-source' };
  f.base.opportunities.set(ordinary.sourceId, ordinary);
  const attempt = f.base.complete(ordinary.sourceId); f.base.assess(attempt);
  expect(f.base.owner.settle(attempt.attemptId).kind).toBe('complete');
  const accepted = f.base.owner.read(attempt.attemptId);
  expect(f.owner.readOrder(ordinary.sourceId)).toBeNull();
  expect(f.rows('pitch_practice_orders')).toHaveLength(0);
  expect(f.control.readHead('career-a')!.worldRevision).toBe(1);
  f.clearAuthorities(); f.reopen();
  expect(f.base.owner.read(attempt.attemptId)).toEqual(accepted);
  expect(f.base.sources.episodes.read('episode')!.episode.practiceSourceEventIds).toHaveLength(1);
});

it('rejects a deleted owned order from its real World evidence and the begun attempt fingerprint', async () => {
  const f = await fixture(), issued = f.prepare(), order = f.issue(issued);
  f.base.opportunities.clear(); const begun = f.base.owner.begin(order.sourceId);
  f.base.db.prepare('DELETE FROM pitch_practice_orders WHERE source_id=?').run(order.sourceId);
  f.base.db.prepare('DELETE FROM pitch_practice_order_decisions WHERE source_id=?').run(issued.sourceId);
  expect(f.rows('world_decision_revision_events')).toHaveLength(2);
  const before = f.snapshot();
  expect(() => f.owner.readOrder(order.sourceId)).toThrow(/orphan|missing|order|evidence/i);
  expect(() => f.base.owner.read(begun.attemptId)).toThrow(/order|source|corrupt|evidence/i);
  expect(() => f.base.owner.advance(begun.attemptId, begun.revision, begun.plannedDelivery.timeline.followThroughEndUs))
    .toThrow(/order|source|corrupt|evidence/i);
  expect(f.snapshot()).toBe(before);
});
