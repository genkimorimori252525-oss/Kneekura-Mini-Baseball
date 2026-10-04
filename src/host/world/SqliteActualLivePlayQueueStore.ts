import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { actualLivePlayScopeInput, type AcceptedActualLivePlayScope } from './ActualLivePlayScope';
import { actualLivePlayQueueArchiveEncoding } from './ActualLivePlayArchive';
import { actualLivePlayQueueEvidenceFromSqlite, type ActualLivePlayQueueEvidence } from './ActualLivePlayQueueEvidenceFromSqlite';
import { openActualLiveImmutableReceiptStore } from './ActualLiveImmutableReceiptStore';
import { actorFreeze as freeze, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

export type AcceptedActualLivePlayQueue = Omit<AcceptedActualLivePlayScope, 'capability'> & Readonly<{ capability: 'actual_live_play_queue_v1' }>;
const input = (raw: AcceptedActualLivePlayQueue, sourceId: string): AcceptedActualLivePlayQueue => {
  raw = cloneInert(raw);
  if (raw?.capability !== 'actual_live_play_queue_v1') throw new Error('invalid actual live queue capability');
  const scope = actualLivePlayScopeInput({ ...raw, capability: 'actual_live_play_scope_v1' }, sourceId);
  return freeze({ ...scope, capability: 'actual_live_play_queue_v1' });
};
export const openSqliteActualLivePlayQueueStore = (path: string,
  authority?: Readonly<{ readAcceptedCheckpoint(sourceId: string): AcceptedActualLivePlayQueue | null }>) => {
  if (authority != null && typeof authority.readAcceptedCheckpoint !== 'function') throw new Error('invalid actual live queue authority');
  return openActualLiveImmutableReceiptStore(path, 'actual_live_play_queue_checkpoints', db => ({ input, encode: actualLivePlayQueueArchiveEncoding,
    derive(source: AcceptedActualLivePlayQueue, current = false) {
      const queue = actualLivePlayQueueEvidenceFromSqlite(db).derive({ ...source, capability: 'actual_live_play_scope_v1' }, current);
      return freeze({ source, revision: 1 as const, history: [source], ownershipKey: json(['actual_live_play_queue_v1', source.sourceId]), queue });
    },
  }), authority && (sourceId => authority.readAcceptedCheckpoint(sourceId)));
};
export type DurableActualLivePlayQueue = Readonly<{ source: AcceptedActualLivePlayQueue; revision: 1;
  history: readonly AcceptedActualLivePlayQueue[]; ownershipKey: string; queue: ActualLivePlayQueueEvidence }>;
