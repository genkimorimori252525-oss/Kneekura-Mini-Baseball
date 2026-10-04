import { expect, it } from 'vitest';
import { actualLocomotionFixture as fixture } from './ActualLocomotionFixtures.test-support';
import type { AcceptedActualLocomotion } from './SqliteActualLocomotionStore';

it('rejects injected state, aliased keys, accessors and foreign dependency identity before persistence', () => {
  const x = fixture();
  try {
    const source = x.locomotionSource;
    for (const key of ['position', 'velocity', 'target', 'at', 'throughTick', 'command', 'self', 'availableAtTick', 'previousSourceId', 'success']) {
      x.locomotionSources.set(source.sourceId, { ...source, [key]: 0 });
      expect(() => x.locomotion.accept(source.sourceId), key).toThrow(/invalid/);
    }
    const alias = { ...source } as unknown as Record<string, unknown>;
    delete alias.playerId; delete alias.decisionSourceId; alias['playerId|decisionSourceId'] = 'p2';
    x.locomotionSources.set(source.sourceId, alias as AcceptedActualLocomotion);
    expect(() => x.locomotion.accept(source.sourceId)).toThrow(/invalid/);
    let called = false;
    x.locomotionSources.set(source.sourceId, { ...source, get decisionSourceId() { called = true; return source.decisionSourceId; } });
    expect(() => x.locomotion.accept(source.sourceId)).toThrow(/accessor/); expect(called).toBe(false);
    for (const key of ['playerId', 'physicalPitchSourceId', 'decisionSourceId', 'locomotionModelSourceId', 'baseFieldSourceId', 'executionSourceId']) {
      x.locomotionSources.set(source.sourceId, { ...source, [key]: 'foreign' });
      expect(() => x.locomotion.accept(source.sourceId), key).toThrow();
    }
    expect(x.f.db.prepare('SELECT count(*) AS n FROM actual_locomotion_receipts').get()).toEqual({ n: 0 });
  } finally { x.f.close(); }
});

it('checks every Source/snapshot/head mirror and discovers duplicate JSON identity claims under foreign indexed scope', () => {
  const x = fixture();
  try {
    const saved = x.locomotion.accept(x.locomotionSource.sourceId), sid = saved.source.sourceId;
    const original = x.f.db.prepare('SELECT * FROM actual_locomotion_receipts WHERE source_id=?').get(sid)!;
    for (const [column, value] of [['source_hash', 'bad'], ['snapshot_hash', 'bad'], ['source_version', 'bad'],
      ['capability', 'bad'], ['decision_source_id', 'bad'], ['locomotion_model_source_id', 'bad'], ['base_field_source_id', 'bad'], ['execution_source_id', 'bad']] as const) {
      x.f.db.prepare(`UPDATE actual_locomotion_receipts SET ${column}=? WHERE source_id=?`).run(value, sid);
      expect(() => x.locomotion.read(sid), column).toThrow();
      x.f.db.prepare(`UPDATE actual_locomotion_receipts SET ${column}=? WHERE source_id=?`).run(original[column], sid);
    }
    for (const [column, path, value] of [['source_json', '$.sourceId', 'wrong'], ['snapshot_json', '$.history[0].playerId', 'wrong'],
      ['snapshot_json', '$.receipt.self.cut.executionSourceId', 'wrong'], ['snapshot_json', '$.receipt.command.playerId', 'wrong'],
      ['snapshot_json', '$.revision', true], ['snapshot_json', '$.history', '{}']] as const) {
      x.f.db.prepare(`UPDATE actual_locomotion_receipts SET ${column}=json_set(${column},?,?) WHERE source_id=?`).run(path, typeof value === 'boolean' ? 1 : value, sid);
      expect(() => x.locomotion.read(sid), path).toThrow();
      x.f.db.prepare(`UPDATE actual_locomotion_receipts SET ${column}=? WHERE source_id=?`).run(original[column], sid);
    }
    const text = original.source_json as string;
    for (const replacement of [text.replace('"playerId":"p2"', '"playerId":"foreign","playerId":"p2"'),
      text.replace('"playerId":"p2"', '"playerId":"p2","playerId":"foreign"'),
      text.replace('"sourceId":', '"sourceId":"hidden","sourceId":')]) {
      x.f.db.prepare('UPDATE actual_locomotion_receipts SET source_json=? WHERE source_id=?').run(replacement, sid);
      expect(() => x.locomotion.read(sid)).toThrow(/metadata|scope/);
    }
    x.f.db.prepare('UPDATE actual_locomotion_receipts SET source_json=? WHERE source_id=?').run(original.source_json, sid);
    x.f.db.exec('UPDATE actual_locomotion_heads SET revision=revision+1');
    expect(() => x.locomotion.read(sid)).toThrow(/head/); x.f.db.exec('UPDATE actual_locomotion_heads SET revision=1');
    x.f.db.prepare(`INSERT INTO actual_locomotion_receipts SELECT 'hidden',source_version,capability,'foreign-pitch','foreign-player','foreign-decision',
      locomotion_model_source_id,base_field_source_id,execution_source_id,
      json_set(source_json,'$.sourceId','hidden','$.physicalPitchSourceId','foreign-pitch','$.playerId','foreign-player'),source_hash,
      snapshot_json,snapshot_hash FROM actual_locomotion_receipts WHERE source_id=?`).run(sid);
    expect(() => x.locomotion.read(sid)).toThrow(/scope/);
    x.f.db.exec("DELETE FROM actual_locomotion_receipts WHERE source_id='hidden'");
    // Even foreign indexed and Player mirrors cannot hide a duplicate claim to this Player's owned decision.
    const hiddenSource = { ...saved.source, sourceId: 'hidden', physicalPitchSourceId: 'foreign-pitch', playerId: 'foreign-player' };
    const hiddenSnapshot = { ...saved, source: hiddenSource, history: [hiddenSource], receipt: { ...saved.receipt,
      self: { ...saved.receipt.self, physicalPitchSourceId: 'foreign-pitch', playerId: 'foreign-player',
        cut: { ...saved.receipt.self.cut, physicalPitchSourceId: 'foreign-pitch', playerId: 'foreign-player' } },
      command: { ...saved.receipt.command, playerId: 'foreign-player' } } };
    x.f.db.prepare(`INSERT INTO actual_locomotion_receipts SELECT 'hidden',source_version,capability,'foreign-pitch','foreign-player','foreign-decision',
      locomotion_model_source_id,base_field_source_id,execution_source_id,?,source_hash,?,snapshot_hash
      FROM actual_locomotion_receipts WHERE source_id=?`).run(JSON.stringify(hiddenSource), JSON.stringify(hiddenSnapshot), sid);
    expect(() => x.locomotion.read(sid)).toThrow(/scope/);
  } finally { x.f.close(); }
});

it('replays the frozen original through later physical truth and observations without parsing future domain payloads', () => {
  const x = fixture();
  try {
    const saved = x.locomotion.accept(x.locomotionSource.sourceId), start = saved.receipt.segment.startTick;
    const later = { ...x.source, sourceId: 'later-physical-truth', previousExecutionSourceId: x.executed.source.sourceId,
      action: { kind: 'motion' as const, availableAtTick: start, throughTick: start + 5,
        commands: x.fieldSource.commands.map(c => c.playerId === 'p2' ? c : { ...c, bodyAcceleration: { x: 0.3, y: c.bodyAcceleration.y, z: 0.2 } }) } };
    x.sources.set(later.sourceId, later); x.executions.accept(later.sourceId);
    const observation = { ...x.observationSource, sourceId: 'later-unconsumed-observation', executionSourceId: later.sourceId,
      previousObservationSourceId: x.observationSource.sourceId };
    x.observationSources.set(observation.sourceId, observation); x.observations.accept(observation.sourceId);
    expect(x.locomotion.read(saved.source.sourceId)).toEqual(saved);
    x.f.db.prepare("UPDATE batted_world_field_executions SET source_json='unread-future',snapshot_json='unread-future' WHERE source_id=?").run(later.sourceId);
    x.f.db.prepare("UPDATE actual_field_observations SET source_json='unread-future',snapshot_json='unread-future' WHERE source_id=?").run(observation.sourceId);
    expect(x.locomotion.read(saved.source.sourceId)).toEqual(saved);
    x.f.db.exec('UPDATE batted_world_field_execution_heads SET revision=revision+1');
    expect(() => x.locomotion.read(saved.source.sourceId)).toThrow(/head/);
  } finally { x.f.close(); }
});
