import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import { battedWorldFieldFixture } from './BattedWorldFieldFixtures.test-support';
import { battedWorldFieldExecutionFixture } from './BattedWorldFieldExecutionFixtures.test-support';
import { actualPlayerKinematicsFromPrefix } from './ActualPlayerKinematicsFromPrefix';
import { actualPlayerKinematicsEvidenceFromSqlite, openSqliteActualPlayerKinematicsReader,
  type ActualPlayerKinematicsCut } from './SqliteActualPlayerKinematicsReader';
import type { DurableBattedWorldFieldAction } from './SqliteBattedWorldFieldStore';
const cut = (baseField: DurableBattedWorldFieldAction): ActualPlayerKinematicsCut => ({ playerId: 'p2',
  physicalPitchSourceId: baseField.response.touch.worldContact.flight.source.physicalPitchSourceId,
  baseFieldSourceId: baseField.source.sourceId, executionSourceId: null, mode: 'original' });

it('retains original composition cleanup separately from declared pose through later raw-command rebases', () => {
  const x = battedWorldFieldFixture(undefined, true, false, undefined, { world(world) {
    const model = world.models.get(world.model.sourceId)!;
    world.models.set(model.sourceId, { ...model, actors: model.actors.map((a) => ({ ...a,
      primitives: a.primitives.map((p) => ({ ...p, offset: { ...p.offset, y: 5e-13 } })) })) });
    const source = world.sources.get(world.source.sourceId)!;
    world.sources.set(source.sourceId, { ...source, commands: source.commands.map((c) => ({ ...c,
      primitiveMotions: c.primitiveMotions.map((p) => ({ ...p,
        offsetVelocity: { x: 0, y: 5e-13, z: 0 }, offsetAcceleration: { x: 0, y: 2e-13, z: 0 } })) })) });
  } });
  try {
    const source = { ...x.source, throughTick: x.source.availableAtTick + 1000 };
    x.sources.set(source.sourceId, source); const firstField = x.fields.accept(source.sourceId);
    const own = actualPlayerKinematicsEvidenceFromSqlite(x.f.db), first = own.read(cut(firstField));
    const t = first.at.elapsedSeconds;
    expect(first.roles[0].declaredPose.offset.y).toBeCloseTo(5e-13 + 5e-13 * t + 1e-13 * t * t, 25);
    expect(first.roles[0].canonicalRoundingResidual.position.y).toBe(-5e-13 - 5e-13 * t);
    expect(first.roles[0].canonicalRoundingResidual.velocity.y).toBe(-5e-13);
    expect(first.roles[0].canonicalRoundingResidual.acceleration.y).toBe(0);
    expect(first.roles[0].relativeAcceleration.y).toBe(2e-13); // Later flattening does not clean.
    expect(first.roles[0].offset.y).toBeCloseTo(1e-13 * t * t, 25);
    const next = { ...source, sourceId: 'cleanup-rebase', previousFieldSourceId: source.sourceId,
      availableAtTick: first.at.tick, throughTick: first.at.tick + 1000,
      commands: source.commands.map((c) => ({ ...c, primitiveMotions: c.primitiveMotions.map((p) => ({ ...p,
        offsetAcceleration: { x: 0, y: 0.3, z: 0 } })) })) };
    x.sources.set(next.sourceId, next); const secondField = x.fields.accept(next.sourceId);
    const second = own.read(cut(secondField)), dt = second.at.elapsedSeconds - t;
    expect(second.roles[0].canonicalRoundingResidual.position.y).toBeCloseTo(-5e-13 - 5e-13 * second.at.elapsedSeconds, 25);
    expect(second.roles[0].offset.y).toBeCloseTo(first.roles[0].offset.y + first.roles[0].relativeVelocity.y * dt + 0.15 * dt * dt, 20);
    expect(second.roles[0].relativeVelocity.y).toBeCloseTo(first.roles[0].relativeVelocity.y + 0.3 * dt, 20);
    expect(second.roles[0].declaredPose.offset.y).not.toBe(second.roles[0].offset.y);
    expect(second.roles[0].canonicalActor.primitive.startCenter.y).toBeCloseTo(first.roles[0].offset.y, 25);
    expect(own.read(cut(firstField))).toEqual(first);
  } finally { x.f.close(); }
});

it('rejects unowned identities, arbitrary times, malformed cuts, accessors and altered dependency archives', () => {
  const x = battedWorldFieldExecutionFixture();
  try {
    const request = cut(x.baseField), reader = x.f.track(openSqliteActualPlayerKinematicsReader(x.f.path));
    const schema = x.f.db.prepare('SELECT name,sql FROM sqlite_master ORDER BY name').all();
    const original = reader.read({ ...request, mode: 'current' });
    for (const change of [{ playerId: 'foreign' }, { physicalPitchSourceId: 'foreign' }, { baseFieldSourceId: 'foreign' },
      { executionSourceId: 'missing' }, { mode: 'latest' }, { elapsedSeconds: 10 }, { root: { x: 0, y: 0, z: 0 } },
      { mode: undefined }, { 'playerId|mode': 'foreign' }]) {
      expect(() => reader.read({ ...request, ...change } as ActualPlayerKinematicsCut)).toThrow();
    }
    let invoked = false;
    expect(() => reader.read({ ...request, get playerId() { invoked = true; return 'p2'; } })).toThrow(/accessor/);
    expect(invoked).toBe(false);
    expect(x.f.db.prepare('SELECT name,sql FROM sqlite_master ORDER BY name').all()).toEqual(schema);
    const row = x.f.db.prepare('SELECT source_hash FROM batted_world_models WHERE source_id=?').get(original.modelSourceId)!;
    x.f.db.prepare("UPDATE batted_world_models SET source_hash='tampered' WHERE source_id=?").run(original.modelSourceId);
    expect(() => reader.read(request)).toThrow(/corrupt/);
    x.f.db.prepare('UPDATE batted_world_models SET source_hash=? WHERE source_id=?').run(row.source_hash!, original.modelSourceId);
    x.f.db.prepare('UPDATE batted_world_field_heads SET revision=revision+1').run();
    expect(() => reader.read(request)).toThrow(/head/);
    reader.close(); expect(() => reader.read(request)).toThrow(/closed/);
  } finally { x.f.close(); }
});

it('checks both execution tables and bounded historical payloads while validating current ownership', () => {
  const x = battedWorldFieldExecutionFixture();
  try {
    const request = cut(x.baseField), own = actualPlayerKinematicsEvidenceFromSqlite(x.f.db), first = own.read(request);
    x.f.db.exec('ALTER TABLE batted_world_field_execution_heads RENAME TO absent_heads');
    expect(() => own.read(request)).toThrow(/tables/);
    x.f.db.exec('ALTER TABLE batted_world_field_executions RENAME TO absent_executions');
    expect(own.read(request)).toEqual(first);
    x.f.db.exec('ALTER TABLE absent_heads RENAME TO batted_world_field_execution_heads');
    expect(() => own.read(request)).toThrow(/tables/);
    x.f.db.exec('ALTER TABLE absent_executions RENAME TO batted_world_field_executions');
    const later = x.executions.accept(x.source.sourceId);
    expect(() => own.read({ ...request, mode: 'current' })).toThrow(/stale/);
    const current = own.read({ ...request, executionSourceId: later.source.sourceId, mode: 'current' });
    expect(current.at.elapsedSeconds).toBeGreaterThan(first.at.elapsedSeconds);
    x.f.db.prepare("UPDATE batted_world_field_executions SET source_json='invalid-future-payload',snapshot_json='invalid-future-payload' WHERE source_id=?").run(later.source.sourceId);
    expect(own.read(request)).toEqual(first);
    expect(() => own.read({ ...request, executionSourceId: later.source.sourceId })).toThrow();
    x.f.db.prepare('UPDATE batted_world_field_execution_heads SET revision=revision+1').run();
    expect(() => own.read(request)).toThrow(/head/);
  } finally { x.f.close(); }
});

it('rejects nonfinite arithmetic and role/clock/radius mismatches without weakening canonical tolerances', () => {
  const x = battedWorldFieldExecutionFixture();
  try {
    for (const change of [(a: { acceleration: { x: number } }) => { a.acceleration.x = Infinity; },
      (a: { acceleration: { x: number } }) => { a.acceleration.x = Number.MAX_VALUE; },
      (a: { radius: number }) => { a.radius += 0.001; }, (a: { ticksPerSecond: number }) => { a.ticksPerSecond += 1; }]) {
      const bad = structuredClone(x.baseField), actor = bad.field.motion.actors.find((a) => a.playerId === 'p2')!;
      change(actor.primitive);
      expect(() => actualPlayerKinematicsFromPrefix('p2', { baseField: bad, fields: [bad], executions: [] })).toThrow();
    }
    const bad = structuredClone(x.baseField), source = bad.source.commands.find((c) => c.playerId === 'p2')!;
    (source.bodyAcceleration as { x: number }).x = Number.MAX_VALUE;
    source.primitiveMotions.forEach((p) => { (p.offsetAcceleration as { x: number }).x = Number.MAX_VALUE; });
    expect(() => actualPlayerKinematicsFromPrefix('p2', { baseField: bad, fields: [bad], executions: [] })).toThrow(/canonical/);
  } finally { x.f.close(); }
});

it('sees post-insert dependency corruption inside the supplied writer transaction', () => {
  const directory = mkdtempSync(join(tmpdir(), 'actual-player-kinematics-wal-'));
  const x = battedWorldFieldExecutionFixture(join(directory, 'state.sqlite'));
  try {
    expect(x.f.db.prepare('PRAGMA journal_mode').get()).toEqual({ journal_mode: 'wal' });
    const request = cut(x.baseField), own = actualPlayerKinematicsEvidenceFromSqlite(x.f.db);
    const reader = x.f.track(openSqliteActualPlayerKinematicsReader(x.f.path)), original = reader.read(request);
    x.f.db.exec(`CREATE TABLE kinematics_writer_probe (id INTEGER);
      CREATE TRIGGER corrupt_kinematics_dependency AFTER INSERT ON kinematics_writer_probe BEGIN
        UPDATE batted_world_field_actions SET source_hash='uncommitted-trigger-mutation';
      END;`);
    x.f.db.exec('BEGIN IMMEDIATE');
    try {
      x.f.db.prepare('INSERT INTO kinematics_writer_probe VALUES (?)').run(1);
      expect(() => own.read(request)).toThrow(/corrupt/);
      // A separate path reader sees the last committed WAL snapshot, so it cannot substitute for writer revalidation.
      expect(reader.read(request)).toEqual(original);
    } finally { x.f.db.exec('ROLLBACK'); }
    expect(own.read(request)).toEqual(original);
  } finally { x.f.close(); rmSync(directory, { recursive: true, force: true }); }
});
