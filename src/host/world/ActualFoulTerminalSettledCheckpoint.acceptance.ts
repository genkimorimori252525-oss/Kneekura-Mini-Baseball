import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { rawCensus, schemaCensus, fileHash } from './ActualFoulTerminalAcknowledgementCutover.test-support';
import { prepareRetainedTerminalSettledCopy, noSettledCheckpointSidecars, assertRetainedSettledExactRows } from './ActualFoulTerminalSettledCheckpoint.test-support';
import { openSqliteActualFoulTerminalRoleWorkloadStore } from './SqliteActualFoulTerminalRoleWorkloadStore';
import { openSqlitePlayerPersonLinkStore } from './SqlitePlayerPersonLinkStore';
import { observeTerminalWorkloadConnectionChanges } from './ActualFoulTerminalRoleWorkloadFixture.test-support';

it('CP-G01 current original owners authenticate closed old W02 effects with zero-write freeze retry and reopen', () => {
  const f = prepareRetainedTerminalSettledCopy();
  let store: ReturnType<typeof openSqliteActualFoulTerminalRoleWorkloadStore> | undefined;
  let links: ReturnType<typeof openSqlitePlayerPersonLinkStore> | undefined;
  let observer: typeof f.db | undefined = f.db;
  let accounting: ReturnType<typeof observeTerminalWorkloadConnectionChanges> | undefined;
  try {
    const before = rawCensus(observer), schema = schemaCensus(observer);
    accounting = observeTerminalWorkloadConnectionChanges();
    links = openSqlitePlayerPersonLinkStore(f.path);
    // No accepted-input callback and no settle call: replay must authenticate
    // the ten existing activities without acceptance, repair, or a new charge.
    store = openSqliteActualFoulTerminalRoleWorkloadStore(f.path, links);
    const complete = store.readSettlement(f.sourceId);
    expect(complete.kind).toBe('complete');
    if (complete.kind !== 'complete') throw new Error('GENUINE_ALL_TEN_SETTLED_PREREQUISITE_MISSING');
    expect(complete.participants).toHaveLength(10);
    expect(complete.participants.every(p => p.applied && p.activity.kind === 'MATCH')).toBe(true);
    expect(complete.participants.map(p => p.playerId)).toEqual([...complete.participants.map(p => p.playerId)].sort());
    expect(new Set(complete.participants.map(p => p.playerId)).size).toBe(10);
    expect(new Set(complete.participants.map(p => p.personId)).size).toBe(10);
    const settled = observer.prepare('SELECT * FROM actual_role_workload_settlements WHERE closure_source_id=?').get(f.sourceId)!;
    const frozen = { ...complete, kind:'frozen', participants:complete.participants.map(({ applied: _applied, ...p }) => p) };
    expect(settled.plan_json).toBe(json(frozen)); expect(settled.plan_hash).toBe(hash(frozen));
    const effects = complete.participants.map(p => {
      const rows = observer!.prepare('SELECT * FROM world_player_workload_activities WHERE source_id=?').all(p.activity.sourceEventId);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toEqual({ source_id:p.activity.sourceEventId, career_id:complete.careerId, player_id:p.playerId,
        before_revision:p.before.revision, after_revision:p.after.revision, source_json:json(p.activity), before_json:json(p.before), after_json:json(p.after) });
      return { playerId:p.playerId, activitySourceId:p.activity.sourceEventId, beforeRevision:p.before.revision,
        afterRevision:p.after.revision, activityHash:hash(p.activity), afterHash:hash(p.after) };
    });
    assertRetainedSettledExactRows(observer, f.originalRows, complete);
    expect(store.freeze(f.sourceId)).toEqual(complete);
    expect(rawCensus(observer)).toEqual(before); expect(schemaCensus(observer)).toEqual(schema); accounting.assertUnchanged();
    accounting.close(); accounting = undefined;
    store.close(); store = undefined; links.close(); links = undefined; observer.close(); observer = undefined;
    noSettledCheckpointSidecars(f.path);
    const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
    accounting = observeTerminalWorkloadConnectionChanges();
    observer = new DatabaseSync(f.path); links = openSqlitePlayerPersonLinkStore(f.path);
    store = openSqliteActualFoulTerminalRoleWorkloadStore(f.path, links);
    expect(store.readSettlement(f.sourceId)).toEqual(complete);
    expect(rawCensus(observer)).toEqual(before); expect(schemaCensus(observer)).toEqual(schema); accounting.assertUnchanged();
    accounting.close(); accounting = undefined;
    store.close(); store = undefined; links.close(); links = undefined; observer.close(); observer = undefined;
    noSettledCheckpointSidecars(f.path); noSettledCheckpointSidecars(f.settledSourcePath);
    expect(fileHash(f.settledSourcePath)).toBe(f.settledSourceSha256); expect(fileHash(f.retainedPath)).toBe(f.retainedSha256);
    writeFileSync(join(f.directory,'settled-current-read-receipt.json'), JSON.stringify({
      version:'terminal_settled_current_read_qualification_v1', sourceProductionCommit:f.input.sourceProductionCommitByExactBytes,
      sourceArtifact:f.input.artifact, destinationPath:f.path, destinationSha256:fileHash(f.path), sourceId:f.sourceId,
      originalAcknowledgedSha256:f.retainedSha256, rowsHash:hash(before), schemaHash:hash(schema), planHash:settled.plan_hash,
      participantEffects:effects, read:true, freezeRetry:true, reopenRead:true, settleRetry:false, noWrites:true,
    },null,2), { flag:'wx' });
  } finally { try { store?.close(); } finally { try { links?.close(); } finally {
    try { observer?.close(); } finally { accounting?.close(); }
  } } }
}, 1_200_000);
