import { createRequire } from 'node:module';
import type { DatabaseSync as Database } from 'node:sqlite';
import { expect, it } from 'vitest';
import { rawCensus, schemaCensus } from './ActualFoulTerminalAcknowledgementCutover.test-support';
import { prepareTerminalWorkloadSettledCopy } from './ActualFoulTerminalRoleWorkloadSettled.test-support';
import { requireTerminalWorkload, cleanupTerminalWorkload, observeTerminalWorkloadConnectionChanges } from './ActualFoulTerminalRoleWorkloadFixture.test-support';
it('R01 completed retry checks all accepted Sources without redundant per-player writer acquisitions', async () => {
  const { f, packet, complete } = await prepareTerminalWorkloadSettledCopy();
  const api = await requireTerminalWorkload(), requested: string[] = [];
  const store = api.open(f.path, f.links, { readAcceptedAssessment(id) { requested.push(id); return packet.assessments.get(id) ?? null; } });
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  let acquisitions = 0;
  const before = rawCensus(f.db), schema = schemaCensus(f.db), accounting = observeTerminalWorkloadConnectionChanges();
  // Install above accounting and restore in the reverse order.
  const accountingExec = Object.getOwnPropertyDescriptor(DatabaseSync.prototype, 'exec')!;
  const observedExec = accountingExec.value as Database['exec'];
  const installed = { ...accountingExec, value: function(this: Database, sql: string) {
    if (sql === 'BEGIN IMMEDIATE' && ++acquisitions > 1) throw new Error('REDUNDANT_COMPLETED_PARTICIPANT_WRITER_ACQUISITION');
    return Reflect.apply(observedExec, this, [sql]);
  } };
  Object.defineProperty(DatabaseSync.prototype, 'exec', installed);
  try {
    let result;
    try { result = store.settle(f.sourceId); }
    catch (error) {
      if (acquisitions > 1) throw new Error('REDUNDANT_COMPLETED_PARTICIPANT_WRITER_ACQUISITION', { cause: error });
      throw error;
    }
    expect(result).toEqual(complete);
    expect(acquisitions).toBe(1); expect(requested).toEqual(complete.participants.map(p => p.assessmentSourceId));
    expect(rawCensus(f.db)).toEqual(before); expect(schemaCensus(f.db)).toEqual(schema); accounting.assertUnchanged();
  } finally {
    if (Object.getOwnPropertyDescriptor(DatabaseSync.prototype, 'exec')?.value !== installed.value) throw new Error('later retry interceptor preserved');
    Object.defineProperty(DatabaseSync.prototype, 'exec', accountingExec); accounting.close(); cleanupTerminalWorkload(f, store);
  }
}, 2_400_000);

it('R02 completed retry rejects changed accepted effort before skipping the changed participant', async () => {
  const { f, packet, complete } = await prepareTerminalWorkloadSettledCopy();
  const api = await requireTerminalWorkload();
  const id = complete.participants.at(-1)!.assessmentSourceId, source = packet.assessments.get(id)!;
  packet.assessments.set(id, { ...source, effortUnits: source.effortUnits + 1 });
  const store = api.open(f.path, f.links, packet.authority);
  const before = rawCensus(f.db), schema = schemaCensus(f.db), accounting = observeTerminalWorkloadConnectionChanges();
  try {
    expect(() => store.settle(f.sourceId)).toThrow(/assessment changed/);
    expect(rawCensus(f.db)).toEqual(before); expect(schemaCensus(f.db)).toEqual(schema); accounting.assertUnchanged();
  } finally { accounting.close(); cleanupTerminalWorkload(f, store); }
}, 2_400_000);

const rejectsDamagedCompletedChain = async (fault: 'current' | 'archived') => {
  const { f, complete } = await prepareTerminalWorkloadSettledCopy();
  const api = await requireTerminalWorkload(), store = api.open(f.path, f.links);
  const p = complete.participants.at(-1)!;
  const changed = fault === 'current'
    ? f.db.prepare('UPDATE world_player_workload_heads SET revision=revision+1 WHERE career_id=? AND player_id=?').run(f.reference.careerId, p.playerId)
    : f.db.prepare("UPDATE world_player_workload_activities SET after_json='{}' WHERE source_id=?").run(p.activity.sourceEventId);
  expect(changed.changes).toBe(1);
  const before = rawCensus(f.db), schema = schemaCensus(f.db), accounting = observeTerminalWorkloadConnectionChanges();
  try {
    expect(() => store.settle(f.sourceId)).toThrow();
    expect(rawCensus(f.db)).toEqual(before); expect(schemaCensus(f.db)).toEqual(schema); accounting.assertUnchanged();
  } finally { accounting.close(); cleanupTerminalWorkload(f, store); }
};
it('R03 completed retry still authenticates the current head of every original participant', () => rejectsDamagedCompletedChain('current'), 2_400_000);
it('R04 completed retry still authenticates every archived original activity effect', () => rejectsDamagedCompletedChain('archived'), 2_400_000);

it('R05 completed retry retains reverse legacy exclusion without a per-player writer call', async () => {
  const { f } = await prepareTerminalWorkloadSettledCopy();
  const api = await requireTerminalWorkload(), store = api.open(f.path, f.links);
  const pitcher = f.actors.find(a => a.registeredPosition === 'P')!;
  expect(pitcher).toBeDefined();
  f.db.exec(`CREATE TABLE IF NOT EXISTS official_pitch_workload_sources (
    source_id TEXT PRIMARY KEY, career_id TEXT NOT NULL, player_id TEXT NOT NULL, game_id TEXT NOT NULL,
    played_play_id INTEGER NOT NULL CHECK(played_play_id >= 0), scoring_application_id TEXT NOT NULL UNIQUE,
    policy_source_id TEXT NOT NULL, request_json TEXT NOT NULL, source_json TEXT NOT NULL, proof_json TEXT NOT NULL,
    UNIQUE(career_id, game_id, played_play_id, player_id))`);
  f.db.prepare('INSERT INTO official_pitch_workload_sources VALUES(?,?,?,?,?,?,?,?,?,?)').run('completed-retry-legacy-fault',
    f.reference.careerId, pitcher.binding.playerId, f.reference.gameId, f.reference.playId,
    'completed-retry-legacy-score', 'unaccepted-legacy-policy', '{}', '{}', '{invalid');
  const before = rawCensus(f.db), schema = schemaCensus(f.db), accounting = observeTerminalWorkloadConnectionChanges();
  try {
    expect(() => store.settle(f.sourceId)).toThrow(/legacy.*workload.*charge/);
    expect(rawCensus(f.db)).toEqual(before); expect(schemaCensus(f.db)).toEqual(schema); accounting.assertUnchanged();
  } finally { accounting.close(); cleanupTerminalWorkload(f, store); }
}, 2_400_000);
