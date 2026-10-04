import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { defensiveMetadataId as claim } from './ActualDefensiveMetadata';
import { sqliteJsonMetadataNodes as nodes, sqliteJsonMetadataProjection as projection,
  sqliteJsonMetadataMatches as matches, type SqliteJsonMetadataPath } from './SqliteOwnershipMetadata';

type Db = Pick<import('node:sqlite').DatabaseSync, 'prepare'>;
export type OwnedMotionKnownWork = Readonly<{ playerId: string; decisionSourceId: string | null; motorSourceId: string | null }>;
type Metadata = Readonly<Record<string, string | number | null>>;
type Row = Record<string, string | number | null> & { source_id: string; physical_pitch_source_id: string; player_id: string };
const decisionTable = 'actual_defensive_decisions', decisionHeads = 'actual_defensive_decision_heads';
const motorTable = 'actual_locomotion_receipts', motorHeads = 'actual_locomotion_heads';
const decisionColumns = { sourceId: 'source_id', sourceVersion: 'source_version', physicalPitchSourceId: 'physical_pitch_source_id',
  playerId: 'player_id', observationSourceId: 'observation_source_id', decisionModelSourceId: 'decision_model_source_id',
  planSourceId: 'plan_source_id', previousDecisionSourceId: 'previous_source_id' } as const;
const motorColumns = { sourceId: 'source_id', sourceVersion: 'source_version', capability: 'capability',
  physicalPitchSourceId: 'physical_pitch_source_id', playerId: 'player_id', decisionSourceId: 'decision_source_id',
  locomotionModelSourceId: 'locomotion_model_source_id', baseFieldSourceId: 'base_field_source_id', executionSourceId: 'execution_source_id' } as const;
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.trim() === value;
const fail = (): never => { throw new Error('owned motion known-work ownership metadata differs'); };
const scopeClaim = (document: string, path: SqliteJsonMetadataPath = []) =>
  `EXISTS (SELECT 1 FROM (${nodes(document, path)}) scope_node WHERE scope_node.type='object'
    AND ${claim('scope_node.value', ['physicalPitchSourceId'], ':pitch')}
    AND ${claim('scope_node.value', ['playerId'], ':player')})`;
const sourcePaths: readonly (readonly [string, SqliteJsonMetadataPath])[] = [
  ['r.source_json', []], ['r.snapshot_json', ['source']], ['r.snapshot_json', ['history', { array: 'all' }]],
  // A malformed object history can still make an ownership claim. Never decode string-encoded objects.
  ['r.snapshot_json', ['history']],
];
const sourceClaim = (key: string, identity: string) => sourcePaths.map(([column, path]) => claim(column, [...path, key], identity)).join(' OR ');
const expectedSource = (row: Row, columns: Readonly<Record<string, string>>): Metadata =>
  Object.fromEntries(Object.entries(columns).map(([key, column]) => [key, row[column]]));

/** Source-local current admission metadata only. No receipt reader, payload rederivation,
 * deadline inference or physical advancement belongs here. Historical composition replay
 * must use its original pinned references instead of calling this current-head discovery.
 */
export const ownedMotionKnownWorkFromSqlite = (db: Db, physicalPitchSourceId: string, rawPlayerIds: readonly string[]): readonly OwnedMotionKnownWork[] => {
  const playerIds = cloneInert(rawPlayerIds);
  if (!id(physicalPitchSourceId) || !Array.isArray(playerIds) || !playerIds.length || !playerIds.every(id)
    || new Set(playerIds).size !== playerIds.length) throw new Error('invalid owned motion known-work scope');
  const installed = (table: string, heads: string) => {
    const result = db.prepare("SELECT count(*) AS n,sum(type='table') AS tables FROM sqlite_master WHERE name IN (?,?)").get(table, heads)!;
    if (result.n !== 0 && (result.n !== 2 || result.tables !== 2)) throw new Error('owned motion known-work owner tables differ');
    return result.n === 2;
  };
  const decisionsInstalled = installed(decisionTable, decisionHeads), motorsInstalled = installed(motorTable, motorHeads);
  const observationsInstalled = db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name='actual_field_observations'").get()!.n === 1;

  // Only scalar index columns and configured scalar metadata projections cross into JS.
  // In particular, future scheduling, targets, motor commands and receipt bodies stay in SQLite.
  const containers = (table: string, sourceId: string, column: string, path: SqliteJsonMetadataPath, keys: readonly string[]) => {
    const fields = keys.length ? projection('owner.value', keys) : 'NULL';
    const result = db.prepare(`SELECT (SELECT json_group_array(json_array(owner.type,
      CASE WHEN owner.type='object' THEN (${fields})||'' END)) FROM (${nodes(column, path)}) owner) AS metadata
      FROM ${table} WHERE source_id=?`).get(sourceId);
    if (!result || typeof result.metadata !== 'string') return fail();
    return JSON.parse(result.metadata) as [string, string | null][];
  };
  const check = (table: string, row: Row, column: string, path: SqliteJsonMetadataPath, type: string, expected: Metadata = {}) => {
    const values = containers(table, row.source_id, column, path, Object.keys(expected));
    if (values.length !== 1 || values[0][0] !== type || Object.keys(expected).length && !matches(values[0][1], expected)) fail();
  };
  const checkHistory = (table: string, row: Row, expected: readonly Metadata[]) => {
    check(table, row, 'snapshot_json', ['history'], 'array');
    const values = containers(table, row.source_id, 'snapshot_json', ['history', { array: 'all' }], Object.keys(expected[0]));
    if (values.length !== expected.length || values.some(([type, metadata], i) => type !== 'object' || !matches(metadata, expected[i]))) fail();
  };
  const rowsFor = (table: string, heads: string, columns: Readonly<Record<string, string>>, pitch: string, player: string, extra: string) => {
    const owners = `(r.physical_pitch_source_id=:pitch AND r.player_id=:player)
      OR ${sourcePaths.map(([column, path]) => scopeClaim(column, path)).join(' OR ')}
      OR EXISTS (SELECT 1 FROM ${heads} h WHERE h.physical_pitch_source_id=:pitch AND h.player_id=:player AND h.source_id=r.source_id)
      OR EXISTS (SELECT 1 FROM ${table} own WHERE own.physical_pitch_source_id=:pitch AND own.player_id=:player
        AND (${sourceClaim('sourceId', 'own.source_id')}${table === decisionTable
          ? ` OR ${claim('r.snapshot_json', ['receipt', 'originDecisionSourceId'], 'own.source_id')}` : ''}))
      OR ${extra}`;
    const selected = [...new Set(Object.values(columns)), ...(table === decisionTable ? ['revision'] : [])].map(c => `r.${c}`).join(',');
    const rows = db.prepare(`SELECT ${selected} FROM ${table} r WHERE ${owners}${table === decisionTable ? ' ORDER BY r.revision' : ''}`)
      .all({ pitch, player }) as Row[];
    const relevantHeads = db.prepare(`SELECT h.physical_pitch_source_id,h.player_id,h.source_id,h.revision FROM ${heads} h
      WHERE (h.physical_pitch_source_id=:pitch AND h.player_id=:player)
        OR h.source_id IN (SELECT r.source_id FROM ${table} r WHERE ${owners})`).all({ pitch, player }) as Row[];
    if (!rows.length) { if (relevantHeads.length) fail(); return rows; }
    const head = relevantHeads[0], last = rows.at(-1)!;
    if (relevantHeads.length !== 1 || head.physical_pitch_source_id !== pitch || head.player_id !== player
      || head.source_id !== last.source_id || head.revision !== rows.length
      || rows.some(row => row.physical_pitch_source_id !== pitch || row.player_id !== player)
      || new Set(rows.map(row => row.source_id)).size !== rows.length) fail();
    return rows;
  };

  return Object.freeze(playerIds.map(playerId => {
    const pitch = physicalPitchSourceId, player = playerId;
    const decisionExtra = `(${claim('r.snapshot_json', ['source', 'physicalPitchSourceId'], ':pitch')}
      AND ${claim('r.snapshot_json', ['receipt', 'self', 'playerId'], ':player')})${observationsInstalled ? `
      OR EXISTS (SELECT 1 FROM actual_field_observations o WHERE o.physical_pitch_source_id=:pitch AND o.player_id=:player
        AND (r.observation_source_id=o.source_id OR ${sourceClaim('observationSourceId', 'o.source_id')}
          OR ${claim('r.snapshot_json', ['receipt', 'originObservationSourceId'], 'o.source_id')}))` : ''}`;
    const decisions = decisionsInstalled ? rowsFor(decisionTable, decisionHeads, decisionColumns, pitch, player, decisionExtra) : [];
    let observationRevision = 0;
    for (const [i, row] of decisions.entries()) {
      const expected = expectedSource(row, decisionColumns);
      if (Object.entries(expected).some(([key, value]) => key !== 'previousDecisionSourceId' && !id(value))
        || row.revision !== i + 1 || row.previous_source_id !== (decisions[i - 1]?.source_id ?? null)
        || row.decision_model_source_id !== decisions[0].decision_model_source_id || row.plan_source_id !== decisions[0].plan_source_id) fail();
      check(decisionTable, row, 'source_json', [], 'object', expected);
      check(decisionTable, row, 'snapshot_json', [], 'object', { revision: i + 1 });
      check(decisionTable, row, 'snapshot_json', ['source'], 'object', expected);
      checkHistory(decisionTable, row, decisions.slice(0, i + 1).map(r => expectedSource(r, decisionColumns)));
      check(decisionTable, row, 'snapshot_json', ['receipt'], 'object', {
        originDecisionSourceId: decisions[0].source_id, originObservationSourceId: decisions[0].observation_source_id });
      check(decisionTable, row, 'snapshot_json', ['receipt', 'self'], 'object', { playerId });
      if (!observationsInstalled) fail();
      const observation = db.prepare('SELECT physical_pitch_source_id,player_id,revision FROM actual_field_observations WHERE source_id=?')
        .get(row.observation_source_id);
      if (!observation || observation.physical_pitch_source_id !== pitch || observation.player_id !== player
        || !Number.isSafeInteger(observation.revision) || Number(observation.revision) <= observationRevision) fail();
      observationRevision = Number(observation!.revision);
    }
    const decisionSourceId = decisions.at(-1)?.source_id ?? null;
    const motorExtra = `${scopeClaim('r.snapshot_json', ['receipt', 'self'])}
      OR ${scopeClaim('r.snapshot_json', ['receipt', 'self', 'cut'])}
      OR (${claim('r.snapshot_json', ['source', 'physicalPitchSourceId'], ':pitch')}
        AND ${claim('r.snapshot_json', ['receipt', 'command', 'playerId'], ':player')})${decisionsInstalled ? `
      OR EXISTS (SELECT 1 FROM ${decisionTable} d WHERE d.physical_pitch_source_id=:pitch AND d.player_id=:player
        AND (r.decision_source_id=d.source_id OR ${sourceClaim('decisionSourceId', 'd.source_id')}))` : ''}`;
    const motors = motorsInstalled ? rowsFor(motorTable, motorHeads, motorColumns, pitch, player, motorExtra) : [];
    if (motors.length > 1) fail();
    const motor = motors[0];
    if (motor) {
      const expected = expectedSource(motor, motorColumns);
      if (Object.entries(expected).some(([key, value]) => key !== 'executionSourceId' && !id(value))
        || motor.execution_source_id !== null && !id(motor.execution_source_id)
        || motor.capability !== 'initial_defender_step_v1' || motor.decision_source_id !== decisionSourceId) fail();
      check(motorTable, motor, 'source_json', [], 'object', expected);
      check(motorTable, motor, 'snapshot_json', [], 'object', { revision: 1 });
      check(motorTable, motor, 'snapshot_json', ['source'], 'object', expected);
      checkHistory(motorTable, motor, [expected]);
      check(motorTable, motor, 'snapshot_json', ['receipt'], 'object');
      check(motorTable, motor, 'snapshot_json', ['receipt', 'self'], 'object', { physicalPitchSourceId: pitch, playerId });
      check(motorTable, motor, 'snapshot_json', ['receipt', 'self', 'cut'], 'object', {
        physicalPitchSourceId: pitch, playerId, baseFieldSourceId: motor.base_field_source_id, executionSourceId: motor.execution_source_id, mode: 'original' });
      check(motorTable, motor, 'snapshot_json', ['receipt', 'command'], 'object', { playerId });
    }
    return Object.freeze({ playerId, decisionSourceId, motorSourceId: motor?.source_id ?? null });
  }));
};
