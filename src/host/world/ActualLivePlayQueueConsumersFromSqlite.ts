import { actualLivePlayQueueEvidenceFromSqlite } from './ActualLivePlayQueueEvidenceFromSqlite';
import { actualLiveRuleConsumptionEvidenceFromSqlite,
  type DurableActualLiveRuleConsumption } from './ActualLiveRuleConsumptionFromSqlite';
import { actualLiveOwnerInstalled } from './ActualLivePlayInventoryFromSqlite';
import type { AcceptedActualLivePlayScope } from './ActualLivePlayScope';
import { defensiveMetadataId as claim } from './ActualDefensiveMetadata';
import { sqliteJsonMetadataNodes as nodes, sqliteJsonMetadataProjection as projection, sqliteJsonMetadataMatches as matches } from './SqliteOwnershipMetadata';
import { actorJson as json, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

type Db = Pick<import('node:sqlite').DatabaseSync, 'prepare'>;
/** Current consumer view of an immutable physical cut. New acknowledgements never
 * rewrite an old queue checkpoint. Future receipt payloads stay outside this cut. */
export const actualLivePlayQueueConsumersFromSqlite = (db: Db) => ({ derive(source: AcceptedActualLivePlayScope) {
  const queue = actualLivePlayQueueEvidenceFromSqlite(db).derive(source);
  const accepted: DurableActualLiveRuleConsumption[] = [];
  if (actualLiveOwnerInstalled(db, 'actual_live_rule_consumptions')) {
    for (const successor of queue.successors.filter(s => s.kind === 'rule_evidence')) {
      const ownershipKey = json(['actual_first_base_rule_consumption_v1', queue.scope.scope.physicalPitchSourceId, successor.successorKey]);
      const rows = db.prepare(`SELECT source_id FROM actual_live_rule_consumptions
        WHERE ownership_key=$ownershipKey OR ${claim('snapshot_json', ['ownershipKey'], '$ownershipKey')} OR ${claim('source_json', ['captureExecutionSourceId'], '$capture')}
        OR ${claim('snapshot_json', ['source', 'captureExecutionSourceId'], '$capture')}
        OR ${claim('snapshot_json', ['history', { array: 'all' }, 'captureExecutionSourceId'], '$capture')}
        OR ${claim('snapshot_json', ['history', 'captureExecutionSourceId'], '$capture')}
        OR ${claim('snapshot_json', ['consumption', 'capture', 'sourceId'], '$capture')}`).all({ capture: successor.owner.sourceId, ownershipKey });
      if (rows.length > 1) throw new Error('duplicate actual first-base rule consumer ownership');
      for (const row of rows) {
        const evidence = actualLiveRuleConsumptionEvidenceFromSqlite(db);
        const metadata = evidence.readMetadata(String(row.source_id), ownershipKey);
        if (!metadata) throw new Error('actual rule consumer metadata disappeared');
        const { source: input, row: archive } = metadata;
        evidence.assertUnique(input, ownershipKey, 1);
        if (input.captureExecutionSourceId !== successor.owner.sourceId) {
          throw new Error('actual rule consumer Source metadata differs');
        }
        // Ownership metadata is inspected even when the rule observer is beyond this cut.
        // Its actual rule-result payload is never replayed into this earlier prefix.
        const receiptId = json(['actual_live_rule_consumption_receipt_v1', ownershipKey, input.sourceId]);
        const ruleIdentity = { owner: 'batted_world_field_executions', sourceId: input.ruleExecutionSourceId };
        for (const [path, expected] of [[[], { physicalPitchSourceId: queue.scope.scope.physicalPitchSourceId, scopeId: queue.scope.scope.scopeId }],
          [['consumption'], { kind: 'first_base_rule_consumption', status: 'consumed', receiptId,
            eventKey: successor.basisEventKey, successorKey: successor.successorKey }],
          [['consumption', 'capture'], successor.owner], [['consumption', 'rule'], ruleIdentity],
          [['successor'], { kind: 'first_base_rule_result', status: 'pending', pendingReason: 'next_rule_consumer_unowned',
            basisReceiptId: receiptId, successorKey: json(['actual_live_rule_result_successor_v1', receiptId]) }],
          [['successor', 'rule'], ruleIdentity]] as const) {
          const metadata = db.prepare(`SELECT count(*) AS n,sum(o.type='object') AS typed,
            CASE WHEN o.type='object' THEN ${projection('o.value', Object.keys(expected))} END AS metadata
            FROM (${nodes('$document', path)}) o`).get({ document: archive.snapshot_json });
          if (!metadata || metadata.n !== 1 || metadata.typed !== 1 || !matches(metadata.metadata as string | null, expected)) {
            throw new Error('actual rule consumer snapshot ownership metadata differs');
          }
        }
        const ruleOwner = db.prepare('SELECT physical_pitch_source_id,base_field_source_id,revision FROM batted_world_field_executions WHERE source_id=?').get(input.ruleExecutionSourceId);
        if (!ruleOwner || ruleOwner.physical_pitch_source_id !== queue.scope.scope.physicalPitchSourceId
          || queue.scope.scope.cut.kind !== 'field_execution' || ruleOwner.base_field_source_id !== queue.scope.scope.cut.baseFieldSourceId
          || !Number.isSafeInteger(ruleOwner.revision)) throw new Error('actual rule consumer observer metadata scope differs');
        if (!queue.scope.scope.physicalReferences.some(r => r.owner === 'batted_world_field_executions' && r.sourceId === input.ruleExecutionSourceId)) continue;
        const receipt = actualLiveRuleConsumptionEvidenceFromSqlite(db).read(input.sourceId);
        if (!receipt || receipt.consumption.successorKey !== successor.successorKey || receipt.scopeId !== queue.scope.scope.scopeId
          || receipt.consumption.availableAt.originTick !== queue.scope.scope.at.originTick
          || receipt.consumption.availableAt.elapsedSeconds > queue.scope.scope.at.elapsedSeconds) throw new Error('actual rule consumer cut differs');
        accepted.push(receipt);
      }
    }
  }
  return freeze({ version: 'actual_live_play_queue_consumers_v1' as const, queue, acceptedConsumptions: accepted,
    successors: queue.successors.map(s => ({ original: s,
      consumption: accepted.find(a => a.consumption.successorKey === s.successorKey)?.consumption
        ?? queue.consumptions.find(c => c.successorKey === s.successorKey) ?? null })),
    ruleResultSuccessors: accepted.map(a => a.successor), generation: 'event_generation_coverage_pending' as const,
    closureFence: 'not_installed' as const, playEnd: null });
} });
