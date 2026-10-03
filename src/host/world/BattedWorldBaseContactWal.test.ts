import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { basename, join, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, expect, it } from 'vitest';
import { battedWorldBaseGeometryFixture as geometryFixture } from './BattedWorldBaseGeometryFixtures.test-support';
import { battedWorldBaseContactFixture as contactFixture } from './BattedWorldBaseContactFixtures.test-support';
import { openSqliteBattedWorldBaseGeometryStore } from './SqliteBattedWorldBaseGeometryStore';
import { openSqliteBattedWorldExecutionStore } from './SqliteBattedWorldExecutionStore';

const directories: string[] = [];
const path = () => { const directory = mkdtempSync(join(tmpdir(), 'batted-base-wal-')); directories.push(directory); return join(directory, 'state.sqlite'); };
afterEach(() => {
  const root = realpathSync(tmpdir());
  for (const directory of directories.splice(0)) {
    const target = realpathSync(directory);
    if (!target.startsWith(`${root}${sep}`) || !basename(target).startsWith('batted-base-wal-')) throw new Error('base WAL cleanup escaped its own temporary directory');
    rmSync(target, { recursive: true, force: true });
  }
});
it.each([
  ['source', "UPDATE batted_world_base_geometries SET source_hash='changed';"],
  ['snapshot', "UPDATE batted_world_base_geometries SET snapshot_hash='changed';"],
  ['mirror', "UPDATE batted_world_base_geometries SET geometry_ref='changed';"],
  ['fixture', "UPDATE official_fixtures SET venue_id='changed';"],
  ['flight', "UPDATE batted_ball_flights SET snapshot_hash='changed';"],
])('rolls back late %s mutation after the actual geometry insert', (_kind, sql) => {
  const g = geometryFixture(path()); try {
    g.f.f.db.exec(`CREATE TRIGGER mutate_geometry AFTER INSERT ON batted_world_base_geometries BEGIN ${sql} END`);
    expect(() => g.store.accept(g.source.sourceId)).toThrow();
    expect(g.f.f.db.prepare('SELECT count(*) AS n FROM batted_world_base_geometries').get()).toEqual({ n: 0 });
    expect(g.f.flights.read(g.flight.source.sourceId)).toEqual(g.flight);
    g.f.f.db.exec('DROP TRIGGER mutate_geometry'); expect(g.store.accept(g.source.sourceId).geometry.bases).toEqual(g.source.bases);
  } finally { g.f.f.close(); }
});
it('revalidates the geometry original after a cached peer mutates it before the transaction', () => {
  const g = geometryFixture(path()); try {
    const store = g.f.f.track(openSqliteBattedWorldBaseGeometryStore(g.f.f.path, { read: () => {
      g.f.f.db.exec("UPDATE batted_ball_flights SET snapshot_hash='changed'"); return g.flight;
    } }, g.authority));
    expect(() => store.accept(g.source.sourceId)).toThrow();
    expect(g.f.f.db.prepare('SELECT count(*) AS n FROM batted_world_base_geometries').get()).toEqual({ n: 0 });
  } finally { g.f.f.close(); }
});
it('revalidates geometry after an identical retry Source callback mutates its own proof', () => {
  const g = geometryFixture(path()); try {
    g.store.accept(g.source.sourceId);
    const store = g.f.f.track(openSqliteBattedWorldBaseGeometryStore(g.f.f.path, g.f.flights, { readAcceptedGeometry: () => {
      g.f.f.db.exec("UPDATE batted_world_base_geometries SET snapshot_hash='changed'"); return g.source;
    } }));
    expect(() => store.accept(g.source.sourceId)).toThrow();
  } finally { g.f.f.close(); }
});
it.each([
  ['source', "UPDATE batted_world_base_geometries SET source_hash='changed';"],
  ['snapshot', "UPDATE batted_world_base_geometries SET snapshot_hash='changed';"],
  ['mirror', "UPDATE batted_world_base_geometries SET game_id='changed';"],
  ['fixture', "UPDATE official_fixtures SET venue_id='changed';"],
  ['archive', 'DELETE FROM batted_world_base_geometries;'],
])('rolls back late geometry %s mutation after the actual controlled contact insert', (_kind, sql) => {
  const g = contactFixture(path()); try {
    g.f.db.exec(`CREATE TRIGGER mutate_contact AFTER INSERT ON batted_world_execution_heads BEGIN ${sql} END`);
    expect(() => g.executions.accept(g.source.sourceId)).toThrow();
    expect(g.f.db.prepare('SELECT count(*) AS n FROM batted_world_executions').get()).toEqual({ n: 0 });
    expect(g.f.db.prepare('SELECT count(*) AS n FROM batted_world_execution_heads').get()).toEqual({ n: 0 });
    expect(g.geometries.read(g.geometry.source.sourceId)).toEqual(g.geometry);
    g.f.db.exec('DROP TRIGGER mutate_contact'); expect(g.executions.accept(g.source.sourceId).execution.kind).toBe('base_contact');
  } finally { g.f.close(); }
});
it('revalidates own geometry after a cached motion peer mutates it before the transaction', () => {
  const g = contactFixture(path()); try {
    const store = g.f.track(openSqliteBattedWorldExecutionStore(g.f.path, { read: () => {
      g.f.db.exec("UPDATE batted_world_base_geometries SET source_hash='changed'"); return g.motion;
    } }, g.authority));
    expect(() => store.accept(g.source.sourceId)).toThrow();
    expect(g.f.db.prepare('SELECT count(*) AS n FROM batted_world_executions').get()).toEqual({ n: 0 });
  } finally { g.f.close(); }
});
it('revalidates own geometry after an identical contact retry Source callback', () => {
  const g = contactFixture(path()); try {
    g.executions.accept(g.source.sourceId);
    const store = g.f.track(openSqliteBattedWorldExecutionStore(g.f.path, g.motions, { readAcceptedExecution: () => {
      g.f.db.exec("UPDATE batted_world_base_geometries SET snapshot_hash='changed'"); return g.source;
    } }));
    expect(() => store.accept(g.source.sourceId)).toThrow();
  } finally { g.f.close(); }
});
