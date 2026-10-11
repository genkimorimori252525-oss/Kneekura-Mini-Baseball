import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { openSqlitePlayerBatterRunTransitionModelStore } from './SqlitePlayerBatterRunTransitionModelStore';
import { openSqliteBatterSwingExitStateStore } from './SqliteBatterSwingExitStateStore';
import { openSqliteBatterRunPlanStore } from './SqliteBatterRunPlanStore';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const families = [
  { owner: 'world_player_batter_run_transition_models', dependent: 'world_batter_swing_exit_states',
    path: ['transitionModelReference'], open: openSqlitePlayerBatterRunTransitionModelStore },
  { owner: 'world_batter_swing_exit_states', dependent: 'world_batter_run_plans',
    path: ['exitStateReference'], open: openSqliteBatterSwingExitStateStore },
  { owner: 'world_batter_run_plans', dependent: 'pa_physical_v1_field_steps',
    path: ['action', 'planReference'], open: openSqliteBatterRunPlanStore },
] as const;
type Family = typeof families[number];
type Column = 'source_json' | 'snapshot_json';
const reference = (owner: string, sourceId = 'missing-original') => JSON.stringify({ owner, sourceId,
  sourceHash: 'a'.repeat(64), snapshotHash: 'b'.repeat(64) });
const wrap = (path: readonly string[], value: string): string => path.reduceRight((child, key) => `{${JSON.stringify(key)}:${child}}`, value);
const documents = (family: Family, column: Column, value: string): [string, string] => {
  const source = wrap(family.path, value);
  return column === 'source_json' ? [source, '{}'] : ['{}', `{"source":${source}}`];
};
const fixture = (family: Family) => {
  const directory = mkdtempSync(join(tmpdir(), 'batter-typed-claim-')), path = join(directory, 'state.sqlite');
  const db = new DatabaseSync(path);
  return { db, path,
    dependent() { db.exec(`CREATE TABLE ${family.dependent}(source_json TEXT,snapshot_json TEXT)`); },
    put(pair: [string, string]) { db.prepare(`DELETE FROM ${family.dependent}`).run();
      db.prepare(`INSERT INTO ${family.dependent} VALUES (?,?)`).run(...pair); },
    rows() { return db.prepare(`SELECT rowid,* FROM ${family.dependent}`).all(); },
    close() { db.close(); rmSync(directory, { recursive: true }); } };
};

// These raw descendants test missing-owner metadata fences, not complete
// lifecycle ancestry. In particular, throw checkpoints own physical step plans.
for (const family of families) for (const column of ['source_json', 'snapshot_json'] as const) {
  it(`BRA01 ${family.owner} ignores foreign ${column} references when installing and reading`, () => {
    const f = fixture(family); let store: ReturnType<Family['open']> | undefined;
    try {
      f.dependent(); f.put(documents(family, column, reference('pa_physical_v1_field_steps')));
      const before = f.rows(); store = family.open(f.path);
      expect(store.read('missing-original')).toBeNull();
      expect(f.db.prepare(`SELECT * FROM ${family.owner}`).all()).toEqual([]);
      expect(f.rows()).toEqual(before);
    } finally { store?.close(); f.close(); }
  });

  it(`BRA02 ${family.owner} preserves hidden typed ${column} claims and their original bytes`, () => {
    const f = fixture(family); const store = family.open(f.path);
    try {
      f.dependent();
      const pin = reference(family.owner), foreign = reference('pa_physical_v1_field_steps', 'other');
      const canonical = documents(family, column, pin);
      const leaf = family.path.at(-1)!, parent = family.path.slice(0, -1);
      const duplicateReference = wrap(parent, `{${JSON.stringify(leaf)}:${pin},${JSON.stringify(leaf)}:${foreign}}`);
      const variants: [string, string][] = [canonical,
        documents(family, column, pin.slice(0, -1) + ',"owner":"foreign"}'),
        documents(family, column, pin.slice(0, -1) + ',"sourceId":"other"}'),
        column === 'source_json' ? [duplicateReference, '{}'] : ['{}', `{"source":${duplicateReference}}`],
        column === 'source_json'
          ? [canonical[0].slice(0, -1) + `,${JSON.stringify(family.path[0])}:{}}`, '{}']
          : ['{}', canonical[1].slice(0, -1) + ',"source":{}}'],
      ];
      for (const pair of variants) {
        f.put(pair); const before = f.rows();
        expect(() => store.read('missing-original')).toThrow(/surviving typed dependent claim/);
        expect(store.read('unclaimed-original')).toBeNull();
        expect(f.rows()).toEqual(before);
      }
      f.db.exec(`DROP TABLE ${family.owner}`);
      const before = f.rows();
      expect(() => store.read('missing-original')).toThrow(/surviving typed dependent claim/);
      expect(() => family.open(f.path)).toThrow(/surviving typed dependent claim/);
      expect(f.db.prepare('SELECT 1 FROM sqlite_master WHERE name=?').get(family.owner)).toBeUndefined();
      expect(f.rows()).toEqual(before);
    } finally { store.close(); f.close(); }
  });

  it(`BRA03 ${family.owner} binds ${column} owner and identity within one reference`, () => {
    const f = fixture(family); const store = family.open(f.path);
    try {
      f.dependent();
      const leaf = family.path.at(-1)!, parent = family.path.slice(0, -1);
      const source = wrap(parent, `{${JSON.stringify(leaf)}:${reference(family.owner, 'other')},`
        + `${JSON.stringify(leaf)}:${reference('pa_physical_v1_field_steps')}}`);
      f.put(column === 'source_json' ? [source, '{}'] : ['{}', `{"source":${source}}`]);
      const before = f.rows();
      expect(store.read('missing-original')).toBeNull();
      expect(() => store.read('other')).toThrow(/surviving typed dependent claim/);
      expect(f.rows()).toEqual(before);
    } finally { store.close(); f.close(); }
  });
}
