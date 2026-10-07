import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { expect, it, vi } from 'vitest';
import * as pitches from './PhysicalPitchEvidenceFromSqlite';
import * as actors from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import * as fences from './ActualLivePlayFence';
import { activeBattedWorldFieldReadFrame } from './SqliteBattedWorldFieldStore';
import { pairedPitchFixture, queryOnly, requirePairedReader, type PairedReader } from './BattedBallFlightPairedPitch.test-support';

const { DatabaseSync: Sqlite } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');

it('saved flight derive authenticates freshly after the real postwrite openFrame has succeeded', () => {
  const x = pairedPitchFixture();
  let db: DatabaseSync | undefined, writer = false, admitted = false, postwriteWorkloadReturned = false;
  let inject = true, mutated = false, savedQueryReached = false, savedPairs = 0, savedAuthentications = 0, allPairs = 0;
  const actorId = x.g.physical.frame.batterActor!.source.sourceId;
  const originalActorHash = x.db.prepare('SELECT source_hash FROM physical_plate_appearance_actors WHERE source_id=?').get(actorId)!.source_hash;
  try {
    const realPair = requirePairedReader();
    const attach = (raw: Pick<DatabaseSync, 'prepare'>) => {
      if (db) return;
      expect(raw).toBeInstanceOf(Sqlite); db = raw as DatabaseSync;
      const connection = db, exec = connection.exec.bind(connection), prepare = connection.prepare.bind(connection);
      x.restore(vi.spyOn(connection, 'exec').mockImplementation(sql => {
        const result = exec(sql);
        if (/^BEGIN IMMEDIATE\b/.test(sql)) writer = true;
        if (/^(COMMIT|ROLLBACK)\s*;?$/.test(sql)) writer = false;
        return result;
      }));
      x.restore(vi.spyOn(connection, 'prepare').mockImplementation(sql => {
        const statement = prepare(sql);
        if (sql === 'SELECT revision,state_json FROM world_player_workload_heads WHERE career_id=? AND player_id=?') {
          const get = statement.get;
          x.restore(vi.spyOn(statement, 'get').mockImplementation((...args: unknown[]) => {
            const row = Reflect.apply(get, statement, args) as ReturnType<typeof statement.get>;
            if (writer && admitted) postwriteWorkloadReturned = true;
            return row;
          }));
        }
        if (sql === 'SELECT * FROM batted_ball_flights WHERE source_id=?') {
          const get = statement.get;
          x.restore(vi.spyOn(statement, 'get').mockImplementation((...args: unknown[]) => {
            const row = Reflect.apply(get, statement, args) as ReturnType<typeof statement.get>;
            if (writer && inject && row?.source_id === x.g.input.sourceId) {
              // For a first-flight writer this exact read is after line 186 openFrame returns,
              // and before line 187's saved read derives anything. No openFrame is replaced.
              expect(admitted).toBe(true); expect(postwriteWorkloadReturned).toBe(true);
              expect(connection.isTransaction).toBe(true); expect(queryOnly(connection)).toBe(0);
              expect(activeBattedWorldFieldReadFrame(connection)).toBeNull();
              savedQueryReached = true; inject = false;
              connection.prepare("UPDATE physical_plate_appearance_actors SET source_hash='after-postwrite-openframe' WHERE source_id=?").run(actorId);
              mutated = true;
            }
            return row;
          }));
        }
        return statement;
      }));
    };
    const pairModule = pitches as unknown as { readOriginalPhysicalPitchWithRowsFromSqlite: PairedReader };
    x.restore(vi.spyOn(pairModule, 'readOriginalPhysicalPitchWithRowsFromSqlite').mockImplementation((...args) => {
      attach(args[0]);
      if (args[0] === db) { allPairs++; if (mutated) savedPairs++; }
      return realPair(...args);
    }));
    const actorRead = actors.readPhysicalPlateAppearanceActorFromSqlite;
    x.restore(vi.spyOn(actors, 'readPhysicalPlateAppearanceActorFromSqlite').mockImplementation((...args) => {
      if (mutated && args[0] === db && args[1] === actorId) savedAuthentications++;
      return actorRead(...args);
    }));
    const admission = fences.recordActualLivePlayAdmission;
    x.restore(vi.spyOn(fences, 'recordActualLivePlayAdmission').mockImplementation((...args) => {
      const result = admission(...args); if (args[0] === db) admitted = true; return result;
    }));

    expect(() => x.g.flights.accept(x.g.input.sourceId)).toThrow('corrupt original physical pitch prefix');
    expect(savedQueryReached).toBe(true); expect(mutated).toBe(true);
    expect(savedPairs).toBe(1); expect(savedAuthentications).toBe(1);
    expect(db!.isTransaction).toBe(false); expect(queryOnly(db!)).toBe(0); expect(activeBattedWorldFieldReadFrame(db!)).toBeNull();
    expect(x.db.prepare('SELECT count(*) AS n FROM batted_ball_flights').get()!.n).toBe(0);
    expect(x.db.prepare('SELECT source_hash FROM physical_plate_appearance_actors WHERE source_id=?').get(actorId)!.source_hash).toBe(originalActorHash);
    expect(actors.actorJson(x.rows())).toBe(x.beforeRows);

    mutated = false; admitted = false; postwriteWorkloadReturned = false;
    const beforeRetryPairs = allPairs, value = x.g.flights.accept(x.g.input.sourceId);
    expect(actors.actorJson(value)).toBe(x.expectedJson); expect(allPairs - beforeRetryPairs).toBe(3);
    expect(x.db.prepare('SELECT count(*) AS n FROM batted_ball_flights').get()!.n).toBe(1);
    expect(db!.isTransaction).toBe(false); expect(queryOnly(db!)).toBe(0); expect(activeBattedWorldFieldReadFrame(db!)).toBeNull();
  } finally { x.close(); }
});
