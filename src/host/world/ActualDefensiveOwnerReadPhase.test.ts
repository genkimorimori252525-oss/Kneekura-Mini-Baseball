import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { actualDefensiveDecisionFixture } from './ActualDefensiveDecisionFixtures.test-support';
import * as physical from './SqliteBattedWorldFieldStore';
import * as responses from './SqliteBattedContactResponseStore';
import { openSqliteActualDefensivePlanStore } from './SqliteActualDefensivePlanStore';
import { openSqliteActualDefensiveDecisionStore } from './SqliteActualDefensiveDecisionStore';
import { witnessSqliteWrite } from './SqliteWriteWitness.test-support';

it.each(['plan', 'decision'] as const)('shares completed original roots only within defensive %s phases', kind => {
  const directory = mkdtempSync(join(tmpdir(), `defensive-${kind}-phase-`));
  const x = actualDefensiveDecisionFixture(join(directory, 'state.sqlite'));
  if (kind === 'decision') x.plans.accept(x.planSource.sourceId);
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  let connection: import('node:sqlite').DatabaseSync | undefined, responseReads = 0, corruptInCallback = false;
  const reads: { frame: object | null; roots: number }[] = [];
  const responseOwner = responses.battedContactResponseEvidenceFromSqlite;
  // Passive original-owner calls, never substitute results or authority.
  const responseWitness = vi.spyOn(responses, 'battedContactResponseEvidenceFromSqlite').mockImplementation(db => {
    const own = responseOwner(db);
    return { ...own, read(id: string) { responseReads++; return own.read(id); } };
  });
  const fieldOwner = physical.battedWorldFieldEvidenceFromSqlite;
  const fieldWitness = vi.spyOn(physical, 'battedWorldFieldEvidenceFromSqlite').mockImplementation(db => {
    if (!(db instanceof DatabaseSync)) throw new Error('defensive phase witness requires Native ownership');
    connection ??= db;
    const own = fieldOwner(db);
    return { ...own, read(id: string) {
      const before = responseReads, frame = physical.activeBattedWorldFieldReadFrame(db);
      const value = own.read(id); reads.push({ frame, roots: responseReads - before }); return value;
    } };
  });
  const outsidePhase = () => {
    expect(connection!.isTransaction).toBe(false);
    expect(physical.activeBattedWorldFieldReadFrame(connection!)).toBeNull();
    expect(connection!.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
  };
  const authority = () => {
    outsidePhase();
    if (corruptInCallback) x.f.db.prepare("UPDATE batted_contact_responses SET snapshot_hash='callback-corruption' WHERE source_id=?")
      .run(x.baseField.response.source.sourceId);
  };
  const store = x.f.track(kind === 'plan'
    ? openSqliteActualDefensivePlanStore(x.f.path, { readAcceptedPlan() { authority(); return x.planSource; } })
    : openSqliteActualDefensiveDecisionStore(x.f.path, { readAcceptedDecision() { authority(); return x.decisionSource; } }));
  const source = kind === 'plan' ? x.planSource : x.decisionSource;
  const table = kind === 'plan' ? 'actual_defensive_plans' : 'actual_defensive_decisions';
  const rows = () => ['actual_defensive_plans', 'actual_defensive_decisions', 'actual_defensive_decision_heads',
    'actual_field_observations', 'actual_field_observation_heads', 'batted_world_field_actions', 'batted_contact_responses']
    .map(name => x.f.db.prepare(`SELECT rowid,* FROM ${name} ORDER BY rowid`).all());
  const threeFreshRoots = () => {
    expect(reads.every(read => read.frame !== null)).toBe(true);
    const frames = [...new Set(reads.map(read => read.frame))];
    expect(frames).toHaveLength(3);
    const phases = frames.map(frame => reads.filter(read => read.frame === frame));
    expect(phases.map(phase => phase.reduce((sum, read) => sum + read.roots, 0))).toEqual([1, 1, 1]);
    expect(phases.every(phase => phase.length > 1 && phase.some(read => read.roots === 0))).toBe(true);
    return frames;
  };
  try {
    const before = rows();
    x.f.db.exec(`CREATE TRIGGER corrupt_defensive_original AFTER INSERT ON ${table}
      BEGIN UPDATE batted_contact_responses SET snapshot_hash='trigger-corruption'; END`);
    const written = witnessSqliteWrite(`INSERT INTO ${table} VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`, db =>
      db.prepare('SELECT snapshot_hash FROM batted_contact_responses WHERE source_id=?').get(x.baseField.response.source.sourceId)!.snapshot_hash === 'trigger-corruption');
    try {
      expect(() => store.accept(source.sourceId)).toThrow(/corrupt original batted response archive/);
      expect(written.wasReached()).toBe(true);
    } finally { written.close(); }
    expect(rows()).toEqual(before);
    x.f.db.exec('DROP TRIGGER corrupt_defensive_original'); reads.length = 0;

    const saved = store.accept(source.sourceId);
    expect(saved.source).toEqual(source);
    const firstFrames = threeFreshRoots(), accepted = rows(); reads.length = 0;
    expect(store.accept(source.sourceId)).toEqual(saved);
    expect(store.read(source.sourceId)).toEqual(saved);
    const laterFrames = threeFreshRoots();
    expect(laterFrames.every(frame => !firstFrames.includes(frame))).toBe(true);
    expect(rows()).toEqual(accepted);

    corruptInCallback = true;
    expect(() => store.accept(source.sourceId)).toThrow(/corrupt original batted response archive/);
    outsidePhase();
  } finally {
    fieldWitness.mockRestore(); responseWitness.mockRestore(); x.f.close();
    rmSync(directory, { recursive: true, force: true });
  }
}, 45_000);
