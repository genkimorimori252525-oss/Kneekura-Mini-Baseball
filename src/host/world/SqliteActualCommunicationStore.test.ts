import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { expect, it, vi } from 'vitest';
import { actualFirstBaseUmpireFixture } from './ActualFirstBaseUmpireFixtures.test-support';
import { openSqliteActualCommunicationStore } from './SqliteActualCommunicationStore';
import * as api from './SqliteActualCommunicationStore';
import { actualCommunicationObservationAt, type AcceptedActualCommunicationModel, type AcceptedActualCallCommunication } from './ActualCallCommunication';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { installSyntheticObservation } from './ActualFieldObservationFixtures.test-support';
import type { AcceptedActualFieldObservation } from './ActualFieldObservation';
import { openSqliteActualFieldObservationStore } from './SqliteActualFieldObservationStore';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');

it('exports the transaction-local authenticated communication evidence reader', () => {
  expect(typeof (api as Record<string, unknown>).actualCommunicationEvidenceFromSqlite).toBe('function');
});

const fixture = () => {
  const path = join(mkdtempSync(join(tmpdir(), 'actual-call-communication-')), 'state.sqlite');
  const x = actualFirstBaseUmpireFixture(undefined, 0.04, 0.08, 0.1, path);
  const db = x.f.track(new DatabaseSync(path));
  expect(db.prepare('PRAGMA journal_mode').get()).toEqual({ journal_mode: 'wal' });
  expect(db.prepare('PRAGMA database_list').all().find(row => row.name === 'main')?.file).toBe(path);
  x.umpires.acceptSetup(x.setup.sourceId); x.umpires.observe(x.observation.sourceId);
  const call = x.umpires.advanceCall(x.call.sourceId);
  const originalPlayers = [call.observation.batterRunnerId, ...x.physical.frame.world.defenders.map(p => p.playerId)].sort();
  const conditions = { propagationDelayTicks: 2, recognitionBaseDelayTicks: 3, maxAdditionalRecognitionDelayTicks: 2,
    audibility: 0.9, recognition: 0.8, attention: 0.7, minimumRecognizableQuality: 0.1 };
  const model = { sourceId: 'communication-model', sourceVersion: 'synthetic-v1', gameId: call.observation.gameId,
    physicalPitchSourceId: call.observation.physicalPitchSourceId, parameters: {
      version: 'fixed_receiver_conditions_v1' as const, timing: 'exact_sent_plus_core_delay_ticks_v1' as const,
      receivers: originalPlayers.map(playerId => ({ playerId, conditions })) } };
  const source = { sourceId: 'communication-send', sourceVersion: 'synthetic-v1', callSourceId: call.source.sourceId,
    modelSourceId: model.sourceId, currentExecutionSourceId: x.race.source.sourceId, previousCommunicationSourceId: null };
  const models = new Map<string, AcceptedActualCommunicationModel>([[model.sourceId, model]]), sources = new Map<string, AcceptedActualCallCommunication>([[source.sourceId, source]]);
  const store = x.f.track(openSqliteActualCommunicationStore(path, { readAcceptedModel: (id: string) => models.get(id) ?? null,
    readAcceptedCommunication: (id: string) => sources.get(id) ?? null }));
  return { ...x, db, store, call, originalPlayers, model, communicationSource: source, models, communicationSources: sources };
};

it('owns called content, every original pending/dropped/future recipient, then actual receptions and perception without changing truth', () => {
  const x = fixture(); let closed = false;
  try {
    const originalRace = JSON.stringify(x.race);
    const originalCallBytes = x.db.prepare('SELECT source_json,snapshot_json FROM actual_first_base_umpire_calls WHERE source_id=?').get(x.call.source.sourceId);
    const receivers = x.model.parameters.receivers.slice(1).map((r, i) => i === 0
      ? { ...r, conditions: { ...r.conditions, audibility: 0 } } : r);
    x.models.set(x.model.sourceId, { ...x.model, parameters: { ...x.model.parameters, receivers } });
    x.store.acceptModel(x.model.sourceId);
    const value = x.store.accept(x.communicationSource.sourceId);
    expect(value).toMatchObject({ source: x.communicationSource, revision: 1, emitted: { content: { onFieldCall: x.call.onFieldCall } } });
    expect(value.recipients.map(r => r.playerId)).toEqual(x.originalPlayers);
    expect(value.recipients[0]).toMatchObject({ playerId: x.originalPlayers[0], kind: 'pending', reason: 'receiver_conditions_unavailable' });
    expect(value.recipients[1]).toMatchObject({ playerId: x.originalPlayers[1], kind: 'dropped', reason: 'not_recognizable' });
    expect(value.recipients.slice(2).every(r => r.kind === 'scheduled' && r.receiverPosition === null)).toBe(true);
    expect(value).not.toHaveProperty('playEnd'); expect(value).not.toHaveProperty('retirement');
    const playerId = x.originalPlayers[2], before = installSyntheticObservation(x, playerId, x.race.source.sourceId);
    const beforeSource: AcceptedActualFieldObservation = { ...before.observationSource, communicationSourceId: value.source.sourceId };
    before.observationSources.set(beforeSource.sourceId, beforeSource);
    const beforeObserved = before.observations.accept(beforeSource.sourceId);
    expect(beforeObserved.receipt.perceived.communications).toEqual([]);
    expect(beforeObserved.receipt.communicationEvidence?.result.kind).toBe('scheduled');
    expect(JSON.stringify(beforeObserved.receipt.communicationEvidence)).not.toContain('onFieldCall');
    const originalBytes = x.db.prepare('SELECT source_json,snapshot_json FROM actual_call_communications WHERE source_id=?').get(value.source.sourceId);
    if (x.move.action.kind !== 'motion') throw new Error('synthetic actual motion');
    const nextExecution = { ...x.move, sourceId: 'communication-reception-clock', previousExecutionSourceId: x.race.source.sourceId,
      action: { ...x.move.action, availableAtTick: x.call.advancedThrough.tick, throughTick: x.call.advancedThrough.tick + 20 } };
    x.sources.set(nextExecution.sourceId, nextExecution); const moved = x.executions.accept(nextExecution.sourceId);
    const advancedSource: AcceptedActualCallCommunication = { ...x.communicationSource, sourceId: 'communication-received',
      currentExecutionSourceId: moved.source.sourceId, previousCommunicationSourceId: value.source.sourceId };
    // The communication authority has its own Source inventory, independent of physical commands.
    const communicationSources = new Map<string, AcceptedActualCallCommunication>([[x.communicationSource.sourceId, x.communicationSource], [advancedSource.sourceId, advancedSource]]);
    const advancedOwner = x.f.track(openSqliteActualCommunicationStore(x.f.path, {
      readAcceptedModel: id => x.models.get(id) ?? null, readAcceptedCommunication: id => communicationSources.get(id) ?? null }));
    const priorRows = x.db.prepare('SELECT * FROM actual_call_communications ORDER BY revision').all();
    const priorHeads = x.db.prepare('SELECT * FROM actual_call_communication_heads').all();
    const corruptAtBegin = (when: 'pre-BEGIN' | 'post-BEGIN', dependencyId: string, operation: () => unknown, error: RegExp) => {
      const row = x.db.prepare('SELECT snapshot_hash FROM actual_call_communications WHERE source_id=?').get(dependencyId)!;
      const originalExec = DatabaseSync.prototype.exec; let changed = false;
      const mutate = (db: import('node:sqlite').DatabaseSync) => db.prepare('UPDATE actual_call_communications SET snapshot_hash=? WHERE source_id=?')
        .run('corrupt-test-hash', dependencyId);
      const spy = vi.spyOn(DatabaseSync.prototype, 'exec').mockImplementation(function(this: import('node:sqlite').DatabaseSync, sql: string) {
        if (sql !== 'BEGIN IMMEDIATE' || changed) return originalExec.call(this, sql);
        changed = true;
        if (when === 'pre-BEGIN') { expect(this).not.toBe(x.db); mutate(x.db); }
        const result = originalExec.call(this, sql);
        if (when === 'post-BEGIN') mutate(this);
        return result;
      });
      try {
        expect(operation).toThrow(error); expect(changed).toBe(true);
        if (when === 'post-BEGIN') expect(x.db.prepare('SELECT snapshot_hash FROM actual_call_communications WHERE source_id=?').get(dependencyId)).toEqual(row);
      } finally {
        spy.mockRestore(); x.db.prepare('UPDATE actual_call_communications SET snapshot_hash=? WHERE source_id=?').run(row.snapshot_hash, dependencyId);
      }
    };
    for (const when of ['pre-BEGIN', 'post-BEGIN'] as const) {
      corruptAtBegin(when, value.source.sourceId, () => advancedOwner.accept(advancedSource.sourceId), /prior rows changed before admission/);
      expect(x.db.prepare('SELECT * FROM actual_call_communications ORDER BY revision').all()).toEqual(priorRows);
      expect(x.db.prepare('SELECT * FROM actual_call_communication_heads').all()).toEqual(priorHeads);
    }
    const changedSource = { ...value.source, sourceVersion: 'coherent-test-rewrite' };
    const changed = { ...value, source: changedSource, history: [changedSource] };
    const q = (s: string) => `'${s.replaceAll("'", "''")}'`;
    for (const mutation of ['delete', 'rewrite'] as const) {
      const sql = mutation === 'delete' ? `DELETE FROM actual_call_communications WHERE source_id=${q(value.source.sourceId)}`
        : `UPDATE actual_call_communications SET source_version=${q(changedSource.sourceVersion)},
          source_json=${q(json(changedSource))},source_hash=${q(hash(changedSource))},snapshot_json=${q(json(changed))},snapshot_hash=${q(hash(changed))}
          WHERE source_id=${q(value.source.sourceId)}`;
      x.db.exec(`CREATE TRIGGER mutate_prior_communication AFTER INSERT ON actual_call_communications
        WHEN NEW.source_id=${q(advancedSource.sourceId)} BEGIN ${sql}; END;`);
      try {
        expect(() => advancedOwner.accept(advancedSource.sourceId)).toThrow(/prior rows changed after insert/);
        expect(x.db.prepare('SELECT * FROM actual_call_communications ORDER BY revision').all()).toEqual(priorRows);
        expect(x.db.prepare('SELECT * FROM actual_call_communication_heads').all()).toEqual(priorHeads);
      } finally { x.db.exec('DROP TRIGGER mutate_prior_communication'); }
    }
    const advanced = advancedOwner.accept(advancedSource.sourceId);
    expect(advanced.recipients.slice(2).every(r => r.kind === 'received' && r.receiverPosition !== null)).toBe(true);
    const recipient = advanced.recipients.find(r => r.playerId === playerId)!;
    if (recipient.kind !== 'received') throw new Error('actual reception fixture');
    expect(recipient.reception.received.event).toEqual(value.emitted);
    for (const earlier of value.recipients) {
      if (earlier.kind === 'scheduled') expect(advanced.recipients.find(r => r.playerId === earlier.playerId)).toMatchObject({ reception: earlier.reception });
    }
    expect(recipient.reception.receivedAtElapsedSeconds).toBeGreaterThan(value.sentAt!.elapsedSeconds);
    expect(actualCommunicationObservationAt(advanced, playerId, value.evaluatedThrough).kind).toBe('scheduled');
    const afterSource: AcceptedActualFieldObservation = { ...beforeSource, sourceId: 'observation-after-call-reception',
      previousObservationSourceId: beforeSource.sourceId, executionSourceId: moved.source.sourceId, communicationSourceId: advanced.source.sourceId };
    before.observationSources.set(afterSource.sourceId, afterSource);
    const beforeObservationRows = x.db.prepare('SELECT * FROM actual_field_observations ORDER BY source_id').all();
    const beforeObservationHeads = x.db.prepare('SELECT * FROM actual_field_observation_heads ORDER BY player_id').all();
    for (const when of ['pre-BEGIN', 'post-BEGIN'] as const) {
      corruptAtBegin(when, advanced.source.sourceId, () => before.observations.accept(afterSource.sourceId), /communication|corrupt/);
      expect(x.db.prepare('SELECT * FROM actual_field_observations ORDER BY source_id').all()).toEqual(beforeObservationRows);
      expect(x.db.prepare('SELECT * FROM actual_field_observation_heads ORDER BY player_id').all()).toEqual(beforeObservationHeads);
    }
    const afterObserved = before.observations.accept(afterSource.sourceId);
    expect(afterObserved.receipt.communicationEvidence?.result.kind).toBe('received');
    expect(afterObserved.receipt.perceived.communications).toEqual([recipient.reception.received]);
    expect(afterObserved.receipt.communicationEvidence?.snapshotHash).toBe(hash(advanced));
    expect(x.db.prepare('SELECT source_json,snapshot_json FROM actual_call_communications WHERE source_id=?').get(value.source.sourceId)).toEqual(originalBytes);
    expect(JSON.stringify(x.executions.read(x.race.source.sourceId))).toBe(originalRace);
    expect(x.db.prepare('SELECT source_json,snapshot_json FROM actual_first_base_umpire_calls WHERE source_id=?').get(x.call.source.sourceId)).toEqual(originalCallBytes);
    expect(x.umpires.readCall(x.call.source.sourceId)).toEqual(x.call);
    x.f.close(); closed = true;
    const reopened = openSqliteActualCommunicationStore(x.f.path), reopenedObservations = openSqliteActualFieldObservationStore(x.f.path), disk = new DatabaseSync(x.f.path);
    try {
      expect(disk.prepare('PRAGMA journal_mode').get()).toEqual({ journal_mode: 'wal' });
      expect(disk.prepare('PRAGMA database_list').all().find(row => row.name === 'main')?.file).toBe(x.f.path);
      expect(reopened.read(value.source.sourceId)).toEqual(value);
      expect(reopened.accept(advanced.source.sourceId)).toEqual(advanced);
      expect(reopenedObservations.read(beforeSource.sourceId)).toEqual(beforeObserved);
      expect(reopenedObservations.read(afterSource.sourceId)).toEqual(afterObserved);
    } finally { disk.close(); reopenedObservations.close(); reopened.close(); }
  } finally { if (!closed) x.f.close(); }
});
