import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import { actualFieldObservationFixture as fixture } from './ActualFieldObservationFixtures.test-support';

it('rolls back late WAL original/model/Person/own-source/head mutations and retries without changing physical archives', () => {
  const x = fixture(join(mkdtempSync(join(tmpdir(), 'actual-observation-wal-')), 'state.sqlite'));
  try {
    expect(x.f.db.prepare('PRAGMA journal_mode').get()).toEqual({ journal_mode: 'wal' });
    const tables = ['batted_world_field_actions', 'batted_world_field_executions', 'batted_world_field_execution_heads',
      'world_player_observation_models', 'world_player_person_links'];
    const archives = () => tables.map((table) => x.f.db.prepare(`SELECT * FROM ${table}`).all());
    const original = archives();
    const cases = [
      ["UPDATE batted_world_field_actions SET source_hash='changed'", 'actual_field_observations'],
      ["UPDATE batted_world_field_executions SET snapshot_hash='changed'", 'actual_field_observations'],
      ["UPDATE world_player_observation_models SET source_hash='changed'", 'actual_field_observations'],
      ["UPDATE world_player_person_links SET person_id='changed'", 'actual_field_observations'],
      ["UPDATE actual_field_observations SET source_hash='changed'", 'actual_field_observations'],
      ["UPDATE actual_field_observations SET player_id='foreign'", 'actual_field_observations'],
      ["UPDATE actual_field_observations SET snapshot_hash='changed'", 'actual_field_observations'],
      ['UPDATE actual_field_observation_heads SET revision=revision+1', 'actual_field_observation_heads'],
      ['UPDATE batted_world_field_execution_heads SET revision=revision+1', 'actual_field_observations'],
    ];
    for (const [sql, table] of cases) {
      x.f.db.exec(`CREATE TRIGGER mutate_observation AFTER INSERT ON ${table} BEGIN ${sql}; END`);
      expect(() => x.observations.accept(x.observationSource.sourceId), sql).toThrow();
      expect(x.f.db.prepare('SELECT count(*) AS n FROM actual_field_observations').get()).toEqual({ n: 0 });
      expect(x.f.db.prepare('SELECT count(*) AS n FROM actual_field_observation_heads').get()).toEqual({ n: 0 });
      expect(archives()).toEqual(original);
      x.f.db.exec('DROP TRIGGER mutate_observation');
    }
    expect(x.observations.accept(x.observationSource.sourceId).revision).toBe(1);
    expect(archives()).toEqual(original);
  } finally { x.f.close(); }
});

it('replays old receipts after workload recovery but rejects fresh stale actor observations', () => {
  const x = fixture(join(mkdtempSync(join(tmpdir(), 'actual-observation-wal-')), 'state.sqlite'));
  try {
    const first = x.observations.accept(x.observationSource.sourceId);
    const rest = { sourceEventId: 'observation-rest', sourceVersion: 'fixture-v1', evidenceId: 'actual-rest',
      careerId: 'career-a', playerId: 'p2', atDay: 11, kind: 'RECOVERY' as const, durationHours: 8, quality: 1, medicalAvailability: 1 };
    x.f.activities.set(rest.sourceEventId, rest); x.f.workload.apply(rest.sourceEventId, 0);
    expect(x.observations.read(first.source.sourceId)).toEqual(first);
    expect(x.observations.accept(first.source.sourceId)).toEqual(first);
    const source = { ...x.observationSource, sourceId: 'observation-after-recovery', previousObservationSourceId: first.source.sourceId };
    x.observationSources.set(source.sourceId, source);
    expect(() => x.observations.accept(source.sourceId)).toThrow(/workload/);
    expect(x.f.db.prepare('SELECT count(*) AS n FROM actual_field_observations').get()).toEqual({ n: 1 });
  } finally { x.f.close(); }
});
