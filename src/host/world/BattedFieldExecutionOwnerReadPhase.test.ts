import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { ownedScheduledMotionFixture } from './OwnedScheduledMotionFixtures.test-support';
import * as physical from './SqliteBattedWorldFieldStore';
import * as execution from './OwnedScheduledMotionExecution';
import { openSqliteBattedWorldFieldExecutionStore } from './SqliteBattedWorldFieldExecutionStore';
import { witnessSqliteWrite } from './SqliteWriteWitness.test-support';

it('reuses completed acquisition ancestry only within each execution phase and rejects write/callback corruption', () => {
  const directory = mkdtempSync(join(tmpdir(), 'execution-owner-read-phase-'));
  const x = ownedScheduledMotionFixture(join(directory, 'state.sqlite'), 1000);
  const plan = x.plan('phase-plan');
  if (plan.execution.kind !== 'owned_acquisition_plan_v1') throw new Error('explicit acquisition fixture');
  const source = x.stepSource('phase-init', plan.source.sourceId,
    { kind: 'operation', planSourceId: plan.source.sourceId, throughElapsedSeconds: plan.execution.plan.contactMoment.elapsedSeconds });
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  let connection: import('node:sqlite').DatabaseSync | undefined, corruptInCallback = false, peers = 0;
  const fields = physical.battedWorldFieldEvidenceFromSqlite;
  const fieldWitness = vi.spyOn(physical, 'battedWorldFieldEvidenceFromSqlite').mockImplementation(db => {
    if (!(db instanceof DatabaseSync)) throw new Error('execution phase witness requires Native ownership');
    connection ??= db; return fields(db);
  });
  const phases: { frame: object | null; derives: string[] }[] = [];
  const create = execution.createOwnedScheduledMotionExecutionReplay;
  // Passive observation of the real execution service. Every derive, return
  // value and archive codec still belongs to the original production owner.
  const replayWitness = vi.spyOn(execution, 'createOwnedScheduledMotionExecutionReplay').mockImplementation(() => {
    const replay = create(), phase = { frame: physical.activeBattedWorldFieldReadFrame(connection!), derives: [] as string[] };
    phases.push(phase);
    return { ...replay, derive(...args) { phase.derives.push(args[0].sourceId); return replay.derive(...args); } };
  });
  const outsideReadPhase = () => {
    expect(connection!.isTransaction).toBe(false);
    expect(physical.activeBattedWorldFieldReadFrame(connection!)).toBeNull();
    expect(connection!.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
  };
  const store = x.f.track(openSqliteBattedWorldFieldExecutionStore(x.f.path, { read(id) {
    peers++; outsideReadPhase(); return x.fields.read(id);
  } }, { readAcceptedExecution() {
    outsideReadPhase();
    if (corruptInCallback) x.f.db.prepare("UPDATE batted_world_field_executions SET snapshot_hash='callback-corruption' WHERE source_id=?").run(plan.source.sourceId);
    return source;
  } }));
  const rows = () => ['batted_world_field_executions', 'batted_world_field_execution_heads']
    .map(table => x.f.db.prepare(`SELECT rowid,* FROM ${table} ORDER BY rowid`).all());
  try {
    const before = rows();
    x.f.db.exec(`CREATE TRIGGER corrupt_execution_predecessor AFTER INSERT ON batted_world_field_executions
      WHEN NEW.source_id='phase-init' BEGIN UPDATE batted_world_field_executions SET snapshot_hash='trigger-corruption' WHERE source_id='phase-plan'; END`);
    const written = witnessSqliteWrite('INSERT INTO batted_world_field_executions VALUES (?,?,?,?,?,?,?,?,?,?)', db =>
      db.prepare('SELECT snapshot_hash FROM batted_world_field_executions WHERE source_id=?').get(plan.source.sourceId)!.snapshot_hash === 'trigger-corruption');
    try {
      expect(() => store.accept(source.sourceId)).toThrow(/corrupt actual field execution snapshot/);
      expect(written.wasReached()).toBe(true);
    } finally { written.close(); }
    expect(rows()).toEqual(before);
    x.f.db.exec('DROP TRIGGER corrupt_execution_predecessor'); phases.length = 0;

    const saved = store.accept(source.sourceId);
    expect(phases.map(phase => phase.derives)).toEqual([
      ['phase-plan', 'phase-init'], ['phase-init'], ['phase-plan', 'phase-init'],
      ['phase-plan', 'phase-init'], ['phase-plan', 'phase-init'],
    ]);
    expect(phases.every(phase => phase.frame !== null)).toBe(true);
    expect(new Set(phases.map(phase => phase.frame)).size).toBe(3);
    expect(phases[0].frame).toBe(phases[1].frame);
    expect(phases[3].frame).toBe(phases[4].frame);
    expect(saved.execution.kind).toBe('owned_motion_v2');
    const accepted = rows(), firstFrames = phases.map(phase => phase.frame); phases.length = 0;
    expect(store.accept(source.sourceId)).toEqual(saved);
    expect(store.read(source.sourceId)).toEqual(saved);
    expect(phases.map(phase => phase.derives)).toEqual(Array.from({ length: 3 }, () => ['phase-plan', 'phase-init']));
    expect(new Set(phases.map(phase => phase.frame)).size).toBe(3);
    expect(phases.every(phase => phase.frame !== null && !firstFrames.includes(phase.frame))).toBe(true);
    expect(rows()).toEqual(accepted); expect(peers).toBe(2);

    corruptInCallback = true;
    expect(() => store.accept(source.sourceId)).toThrow(/corrupt actual field execution snapshot/);
    outsideReadPhase();
  } finally { replayWitness.mockRestore(); fieldWitness.mockRestore(); x.f.close(); rmSync(directory, { recursive: true, force: true }); }
}, 45_000);
