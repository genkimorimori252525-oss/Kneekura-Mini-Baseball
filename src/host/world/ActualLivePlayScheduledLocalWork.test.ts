import { expect, it } from 'vitest';
import * as evidence from './ActualLivePlayEvidenceFromSqlite';
import type { ActualLivePhysicalLocalWork } from './ActualLivePlayScope';
import type { LivePlaySource } from '../../core/sim/liveAction/LivePlayRegistry';
const source = (sourceId: string): LivePlaySource => ({ sourceId, revision: 1, physical: [], intents: [], information: [], decisions: [], ruleWindows: [],
  queue: { sourceId, settledThroughTick: -1, nextPendingTick: 1 } });
// Inert projection fixtures, never accepted as physical or Native evidence.
it('preserves actual nested operation queues and every pending successor without inventing forecast events', () => {
  const operation = source('actual-operation'), custody = source('custody'), rule = source('rule');
  const history = [{ owner: 'batted_world_field_executions', sourceId: 'physical', revision: 1,
    work: { version: 'owned_scheduled_motion_live_work_v1', operation: { source: operation, handoffs: [{ source: custody }, { source: rule }] } } }] as unknown as ActualLivePhysicalLocalWork[];
  expect(evidence.actualLivePhysicalSources, 'source-local projection').toBeTypeOf('function');
  expect(evidence.actualLivePhysicalSources(history)).toEqual([operation, custody, rule]);
  expect(evidence.actualLivePhysicalSources([{ ...history[0], work: { ...history[0].work, operation: null } } as ActualLivePhysicalLocalWork])).toEqual([]);
  const original = source('legacy');
  const legacy = [{ ...history[0], work: { source: original, receipts: [], handoffs: [] } }] as unknown as ActualLivePhysicalLocalWork[];
  expect(evidence.actualLivePhysicalSources(legacy)).toEqual([original]);
});
it('exposes an authenticated paired scope and prefix on the existing same-connection owner', () => {
  // Construction is lazy. No SQL read or caller-supplied prefix is admitted here.
  const owner = evidence.actualLivePlayEvidenceFromSqlite({ prepare() { throw new Error('unexpected SQL'); } });
  expect(owner.deriveWithPhysicalPrefix).toBeTypeOf('function');
});
it('preserves the legacy latest-revision replacement for one scheduled-operation source', () => {
  const first = source('legacy-operation'), later = { ...first, revision: 2, queue: { ...first.queue!, settledThroughTick: 1, nextPendingTick: null } };
  const history = [first, later].map((source, i) => ({ owner: 'batted_world_field_executions', sourceId: `execution-${i}`, revision: i + 1,
    work: { source, receipts: [], handoffs: [] } })) as unknown as ActualLivePhysicalLocalWork[];
  expect(evidence.actualLivePhysicalSources(history)).toEqual([later]);
});
