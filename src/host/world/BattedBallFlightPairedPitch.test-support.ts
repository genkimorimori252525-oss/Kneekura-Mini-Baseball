/** TEST ONLY: genuine three-action fixture and pass-through prefix witnesses. */
import type { DatabaseSync } from 'node:sqlite';
import { expect, vi } from 'vitest';
import * as pitches from './PhysicalPitchEvidenceFromSqlite';
import * as actors from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import * as continuous from './ContinuousPlayerPitchRuntime';
import { battedBallFlightFixture } from './BattedBallFlightFixtures.test-support';
import { battedBallFlightEvidenceFromSqlite } from './SqliteBattedBallFlightStore';
import { withBattedWorldPhysicalReadTraversal } from './SqliteBattedWorldFieldExecutionStore';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';
import type { DurablePhysicalPitch } from './SqlitePhysicalPitchProgressStore';
import { createBattedBallFlightEvidence } from '../../core/sim/ball/BattedBallFlightEvidence';
import { classifyFirstGroundContactTerritory } from '../../core/sim/ball/FirstGroundContactTerritory';

export type PairedPitch = Readonly<{ prefix: readonly DurablePhysicalPitch[];
  originalPitchRows: ReturnType<typeof pitches.captureOriginalPhysicalPitchRows> }>;
export type PairedReader = (db: Pick<DatabaseSync, 'prepare'>, sourceId: string) => PairedPitch;
// Deliberately optional only at the type boundary so the RED compiler can use unchanged production.
// Calling this accessor fails explicitly on the old source; it never skips or supplies evidence.
export const requirePairedReader = (): PairedReader => {
  const reader = (pitches as unknown as { readOriginalPhysicalPitchWithRowsFromSqlite?: PairedReader }).readOriginalPhysicalPitchWithRowsFromSqlite;
  expect(typeof reader, 'the reviewed paired Native owner API must exist').toBe('function');
  if (typeof reader !== 'function') throw new Error('paired Native owner API is missing');
  return reader;
};
export const ownedRead = <T>(db: DatabaseSync, work: () => T): T =>
  withSqliteReadTransaction(db, () => withBattedWorldPhysicalReadTraversal(db, work));
export const queryOnly = (db: DatabaseSync): number => Number(db.prepare('PRAGMA query_only').get()!.query_only);
export const ownedRowsSql = /^SELECT \* FROM physical_pitch_progress_actions WHERE game_id=\? AND play_id=\? AND progress_revision<=\? ORDER BY progress_revision$/;
export type RawPitchRow = ReturnType<ReturnType<DatabaseSync['prepare']>['all']>[number];

export const pairedPitchFixture = (path?: string) => {
  const g = battedBallFlightFixture(path, true, true, false, undefined, undefined, undefined, { precedingTakenPitches: 2 });
  const db = g.f.db, owner = battedBallFlightEvidenceFromSqlite(db), restorers: { mockRestore(): void }[] = [];
  const restore = <T extends { mockRestore(): void }>(value: T): T => { restorers.push(value); return value; };
  const close = () => {
    const errors: unknown[] = [];
    while (restorers.length) try { restorers.pop()!.mockRestore(); } catch (error) { errors.push(error); }
    try { if (db.isTransaction) db.exec('ROLLBACK'); } catch (error) { errors.push(error); }
    try { g.f.close(); } catch (error) { errors.push(error); }
    if (errors.length) throw new AggregateError(errors, 'paired-pitch test cleanup failed');
  };
  try {
  const rows = () => db.prepare('SELECT * FROM physical_pitch_progress_actions WHERE game_id=? AND play_id=? ORDER BY progress_revision')
    .all(g.physical.frame.gameId, g.physical.frame.match.playId);
  const beforeRows = actors.actorJson(rows());
  expect(g.physical.progressRevision).toBe(3);
  const legacyRows = pitches.captureOriginalPhysicalPitchRows(db, g.physical.source.sourceId);
  const event = g.physical.result.pitch.resolution.timeline.events.find(value => value.kind === 'BatBallContact');
  if (!event || event.kind !== 'BatBallContact') throw new Error('genuine fixture bat contact is missing');
  const flight = createBattedBallFlightEvidence({ contact: event.payload.contact,
    searchDurationTicks: g.input.searchDurationTicks, parameters: g.input.execution.ballFlightParameters });
  // Old durable shape, actual accepted pitch, and unchanged legacy capture are the byte oracle.
  const expectedJson = actors.actorJson({ source: g.input, revision: 1, physicalPitch: g.physical,
    originalPitchRows: legacyRows, flight, projectedGroundTerritory: classifyFirstGroundContactTerritory(flight, g.input.execution.field) });
  const observeReplay = (hooks: { afterActor?(): void; beforeExecution?(input: continuous.ContinuousPlayerPitchRequest): void } = {}) => {
    const counts = { authentications: 0, executions: [] as number[] };
    const actorRead = actors.readPhysicalPlateAppearanceActorFromSqlite;
    restore(vi.spyOn(actors, 'readPhysicalPlateAppearanceActorFromSqlite').mockImplementation((...args) => {
      const own = args[0] === db && args[1] === g.physical.frame.batterActor!.source.sourceId;
      if (own) counts.authentications++;
      const value = actorRead(...args); if (own) hooks.afterActor?.(); return value;
    }));
    const execute = continuous.resolveContinuousPlayerPitchAgainstBatterFromWorld;
    restore(vi.spyOn(continuous, 'resolveContinuousPlayerPitchAgainstBatterFromWorld').mockImplementation((...args) => {
      if (args[1].delivery.playId === g.physical.frame.match.playId) {
        counts.executions.push(args[1].delivery.pitchIndex); hooks.beforeExecution?.(args[1]);
      }
      return execute(...args);
    }));
    return counts;
  };
  const observeOwnedRows = (hook: (rows: RawPitchRow[], ordinal: number) => void) => {
    let ordinal = 0; const prepare = db.prepare.bind(db);
    restore(vi.spyOn(db, 'prepare').mockImplementation(sql => {
      const statement = prepare(sql);
      if (ownedRowsSql.test(sql)) {
        const all = statement.all;
        restore(vi.spyOn(statement, 'all').mockImplementation((...args: unknown[]) => {
          const result = Reflect.apply(all, statement, args) as ReturnType<typeof statement.all>;
          hook(result, ++ordinal); return result;
        }));
      }
      return statement;
    }));
    return () => ordinal;
  };
  return { g, db, owner, restore, rows, beforeRows, legacyRows, expectedJson, observeReplay, observeOwnedRows, close };
  } catch (error) {
    try { close(); } catch (cleanup) { throw new AggregateError([error, cleanup], 'paired-pitch fixture setup and cleanup failed', { cause: error }); }
    throw error;
  }
};
