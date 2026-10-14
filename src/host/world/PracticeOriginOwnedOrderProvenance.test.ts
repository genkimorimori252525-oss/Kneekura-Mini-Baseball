import { afterEach, expect, it } from 'vitest';
import { practiceOriginOwnedOrderFixture } from './PracticeOriginOwnedOrder.test-support';
import type { practiceOriginBehaviorFixture } from './PracticeOriginDevelopmentBehavior.test-support';

const cleanup: (() => void)[] = [];
afterEach(() => { while (cleanup.length) cleanup.pop()!(); });

for (const route of ['Human', 'Manager'] as const) {
  for (const mutation of ['deleted', 'tampered'] as const) {
    for (const mode of ['live', 'reopened'] as const) {
      it.each(['read-decision', 'prepare-retry', 'first-issue', 'read-order', 'issue-retry'] as const)
        (`rejects ${mode} ${route} %s after its accepted practice origin is ${mutation}`, operation => {
          const f = practiceOriginOwnedOrderFixture(cleanup, route);
          const issued = operation === 'read-order' || operation === 'issue-retry' ? f.issue() : null;
          if (issued) {
            expect(f.owner.readOrder(issued.sourceId)).toEqual(issued);
            expect(f.issue()).toEqual(issued);
          }
          expect(f.f.base.count('world_roster_executions')).toBe(0);
          expect(f.f.base.count('world_player_workload_activities')).toBe(1);
          const original = f.f.base.owner.read(f.f.origin.completed.attemptId), before = f.snapshot();
          if (mutation === 'deleted') f.f.base.db.prepare('DELETE FROM world_development_practice_origins WHERE episode_id=?').run(f.f.packet.request.episodeId);
          else f.f.base.db.prepare("UPDATE world_development_practice_origins SET origin_json=json_set(origin_json,'$.appraisal.discovery.motifId','tampered-motif') WHERE episode_id=?")
            .run(f.f.packet.request.episodeId);
          if (mode === 'reopened') f.reopen();
          expect(() => f.f.episodes.read(f.f.packet.request.episodeId)).toThrow(/origin|source|corrupt|binding/i);
          expect(f.f.base.owner.read(f.f.origin.completed.attemptId)).toEqual(original);
          expect(f.f.base.sources.workload.readActivity(f.f.origin.result.activity.sourceEventId)).toEqual(f.f.origin.receipt);
          expect(f.snapshot()).toBe(before);
          expect(() => {
            if (operation === 'read-decision') f.readDecision();
            else if (operation === 'prepare-retry') f.prepare();
            else if (operation === 'read-order') f.owner.readOrder(issued!.sourceId);
            else f.issue();
          }).toThrow(/origin|source|corrupt|binding|evidence/i);
          expect(f.snapshot()).toBe(before);
        });
    }
  }

  it(`rolls back ${route} preparation when its writer-local INSERT removes the accepted origin`, () => {
    let preparedSource: ReturnType<typeof practiceOriginBehaviorFixture> | undefined;
    let before: string | undefined, failure: unknown;
    try {
      practiceOriginOwnedOrderFixture(cleanup, route, f => {
        preparedSource = f; before = f.developmentSnapshot();
        f.base.db.exec('CREATE TRIGGER corrupt_origin_order_prepare BEFORE INSERT ON pitch_practice_order_decisions BEGIN DELETE FROM world_development_practice_origins; END;');
      });
    } catch (error) { failure = error; }
    expect(preparedSource, 'the real origin and manager/control prerequisites must finish before injecting the fault').toBeDefined();
    expect(() => { if (failure !== undefined) throw failure; }).toThrow(/origin|source|corrupt|binding|evidence/i);
    expect(preparedSource!.developmentSnapshot()).toBe(before);
    expect(preparedSource!.base.count('pitch_practice_order_decisions')).toBe(0);
    expect(preparedSource!.base.count('world_player_workload_activities')).toBe(1);
  });

  it(`rolls back ${route} issuance when its writer-local INSERT removes the accepted origin`, () => {
    const f = practiceOriginOwnedOrderFixture(cleanup, route), before = f.snapshot(), origin = f.f.developmentSnapshot();
    f.f.base.db.exec('CREATE TRIGGER corrupt_origin_order_issue AFTER INSERT ON pitch_practice_orders BEGIN DELETE FROM world_development_practice_origins; END;');
    expect(() => f.issue()).toThrow(/origin|source|corrupt|binding|evidence/i);
    expect(f.snapshot()).toBe(before);
    expect(f.f.developmentSnapshot()).toBe(origin);
    expect(f.f.base.count('world_player_workload_activities')).toBe(1);
  });
}
