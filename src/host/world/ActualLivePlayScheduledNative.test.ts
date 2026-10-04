import { expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
import { ownedScheduledMotionFixture } from './OwnedScheduledMotionFixtures.test-support';
import { actualLivePlayEvidenceFromSqlite } from './ActualLivePlayEvidenceFromSqlite';
import { actualLivePlayQueueEvidenceFromSqlite } from './ActualLivePlayQueueEvidenceFromSqlite';
import { openSqliteActualLivePlayStore } from './SqliteActualLivePlayStore';
import { openSqliteActualLivePlayQueueStore, type AcceptedActualLivePlayQueue } from './SqliteActualLivePlayQueueStore';
import type { AcceptedActualLivePlayScope } from './ActualLivePlayScope';

it('rederives original ten-player v2 scope, actual capture events and immutable live archives', () => {
  const path = join(mkdtempSync(join(tmpdir(), 'native-live-bridge-recovery-')), 'state.sqlite');
  const x = ownedScheduledMotionFixture(path); let fixtureClosed = false;
  try {
    expect(x.f.db.prepare('PRAGMA journal_mode').get()!.journal_mode).toBe('wal');
    expect(x.f.db.prepare('PRAGMA database_list').all().find(r => r.name === 'main')!.file).toBe(path);
    const planned = x.plan('live-bridge-plan');
    if (planned.execution.kind !== 'owned_acquisition_plan_v1') throw new Error('owned plan fixture');
    const plan = planned.execution.plan;
    const cut = (executionSourceId: string, sourceId = 'live-bridge-scope'): AcceptedActualLivePlayScope => ({ sourceId, sourceVersion: 'v1',
      capability: 'actual_live_play_scope_v1', physicalPitchSourceId: x.baseField.response.touch.worldContact.flight.source.physicalPitchSourceId,
      cut: { kind: 'field_execution', baseFieldSourceId: x.baseField.source.sourceId, executionSourceId } });
    const evidence = actualLivePlayEvidenceFromSqlite(x.f.db), events = actualLivePlayQueueEvidenceFromSqlite(x.f.db);
    const plannedScope = evidence.derive(cut(planned.source.sourceId));
    expect(plannedScope.scope.at.elapsedSeconds).toBe(plan.contactMoment.elapsedSeconds);
    expect(plannedScope.physicalLocalHistory).toEqual([]); expect(events.derive(cut(planned.source.sourceId)).events).toEqual([]);
    const initialized = x.step('live-bridge-init', planned.source.sourceId,
      { kind: 'operation', planSourceId: planned.source.sourceId, throughElapsedSeconds: plan.contactMoment.elapsedSeconds });
    expect(events.derive(cut(initialized.source.sourceId)).events).toEqual([]);
    let last = initialized;
    for (let i = 0; i < 2; i++) {
      if (last.execution.kind !== 'owned_motion_v2' || last.execution.operation?.kind !== 'acquisition') throw new Error('capture progress');
      if (last.execution.operation.progress.kind === 'secured') break;
      last = x.step(`live-bridge-confirm-${i}`, last.source.sourceId,
        { kind: 'operation', planSourceId: planned.source.sourceId, throughElapsedSeconds: plan.fenceElapsedSeconds });
    }
    if (last.execution.kind !== 'owned_motion_v2' || last.execution.operation?.progress.kind !== 'secured') throw new Error('confirmed capture');
    const source = cut(last.source.sourceId), queueSource: AcceptedActualLivePlayQueue = { ...source, capability: 'actual_live_play_queue_v1' };
    const before = x.f.db.prepare('SELECT * FROM batted_world_field_executions ORDER BY revision').all();
    const scopes = x.f.track(openSqliteActualLivePlayStore(x.f.path, { readAcceptedScope: () => source }));
    const queues = x.f.track(openSqliteActualLivePlayQueueStore(x.f.path, { readAcceptedCheckpoint: () => queueSource }));
    const saved = scopes.accept(source.sourceId), queued = queues.accept(queueSource.sourceId);
    expect(saved.scope.participants).toHaveLength(10); expect(saved.scope.producers).toHaveLength(70);
    expect(saved.scope.participants.every(p => p.bodyModel?.primitiveRoles.length === 5)).toBe(true);
    expect(queued.queue.events).toHaveLength(1); expect(queued.queue.events[0].kind).toBe('acquisition_confirmed');
    expect(queued.queue.events[0].owner.sourceId).toBe(last.source.sourceId);
    expect(queued.queue.events[0].occurredAt.elapsedSeconds).toBe(plan.secureElapsedSeconds);
    expect(queued.queue.events[0].availableAt.elapsedSeconds).toBe(plan.fenceElapsedSeconds);
    expect(queued.queue.successors.map(s => [s.kind, s.status])).toEqual([['custody', 'pending'], ['rule_evidence', 'pending']]);
    expect(queued.queue.consumptions.every(c => c.successorKey === null)).toBe(true); expect(queued.queue.playEnd).toBeNull();
    expect(scopes.accept(source.sourceId)).toEqual(saved); expect(queues.accept(queueSource.sourceId)).toEqual(queued);
    x.f.close(); fixtureClosed = true;
    const reopenedScope = openSqliteActualLivePlayStore(path), reopenedQueue = openSqliteActualLivePlayQueueStore(path), reopenedDb = new DatabaseSync(path);
    try {
      expect(reopenedDb.prepare('PRAGMA journal_mode').get()!.journal_mode).toBe('wal');
      expect(reopenedScope.read(source.sourceId)).toEqual(saved); expect(reopenedQueue.read(queueSource.sourceId)).toEqual(queued);
      expect(reopenedDb.prepare('SELECT * FROM batted_world_field_executions ORDER BY revision').all()).toEqual(before);
    } finally { reopenedDb.close(); reopenedQueue.close(); reopenedScope.close(); }
  } finally { if (!fixtureClosed) x.f.close(); }
}, 600_000);
