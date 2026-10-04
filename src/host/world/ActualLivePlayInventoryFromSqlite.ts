import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { defensiveMetadataId as claim } from './ActualDefensiveMetadata';
import { sqliteJsonMetadataNodes as nodes, sqliteJsonMetadataProjection as projection,
  sqliteJsonMetadataMatches as matches, type SqliteJsonMetadataPath } from './SqliteOwnershipMetadata';
import { ownedMotionKnownWorkFromSqlite } from './OwnedMotionKnownWorkFromSqlite';
import { actualLivePlayId as id, type ActualLivePlayScope } from './ActualLivePlayScope';

type Db = Pick<import('node:sqlite').DatabaseSync, 'prepare'>;
type Row = Record<string, string | number | null> & { source_id: string; physical_pitch_source_id: string; player_id: string; revision: number };
const configurations = [
  { owner: 'actual_field_observations', head: 'actual_field_observation_heads', previous: 'previousObservationSourceId', columns: {
    sourceId: 'source_id', sourceVersion: 'source_version', physicalPitchSourceId: 'physical_pitch_source_id', playerId: 'player_id', baseFieldSourceId: 'base_field_source_id',
    executionSourceId: 'execution_source_id', observationModelSourceId: 'observation_model_source_id', previousObservationSourceId: 'previous_source_id' } },
  { owner: 'actual_defensive_decisions', head: 'actual_defensive_decision_heads', previous: 'previousDecisionSourceId', columns: {
    sourceId: 'source_id', sourceVersion: 'source_version', physicalPitchSourceId: 'physical_pitch_source_id', playerId: 'player_id',
    observationSourceId: 'observation_source_id', decisionModelSourceId: 'decision_model_source_id', planSourceId: 'plan_source_id', previousDecisionSourceId: 'previous_source_id' } },
  { owner: 'actual_locomotion_receipts', head: 'actual_locomotion_heads', previous: null, columns: {
    sourceId: 'source_id', sourceVersion: 'source_version', capability: 'capability', physicalPitchSourceId: 'physical_pitch_source_id', playerId: 'player_id',
    decisionSourceId: 'decision_source_id', locomotionModelSourceId: 'locomotion_model_source_id', baseFieldSourceId: 'base_field_source_id', executionSourceId: 'execution_source_id' } },
] as const;
export type ActualLiveInventoryOwner = typeof configurations[number]['owner'];
export const actualLiveOwnerInstalled = (db: Db, owner: string, head?: string) => {
  const names = head ? [owner, head] : [owner];
  const rows = db.prepare(`SELECT name,type FROM sqlite_master WHERE name IN (${names.map(() => '?').join(',')})`).all(...names);
  if (rows.length !== 0 && (rows.length !== names.length || rows.some(r => r.type !== 'table'))) throw new Error('actual live-play owner tables differ');
  return rows.length === names.length;
};
const fail = (): never => { throw new Error('actual live-play producer ownership metadata/head scope differs'); };
const paths: readonly (readonly [string, SqliteJsonMetadataPath])[] = [['r.source_json', []], ['r.snapshot_json', ['source']],
  ['r.snapshot_json', ['history', { array: 'all' }]], ['r.snapshot_json', ['history']]];
/** Full membership comes from the scope. SQL finds claims to reconcile, never proof of absent generators.
 * Only metadata scalar projections cross an execution cut; later receipt/view/command payloads stay opaque. */
export const actualLivePlayInventoryFromSqlite = (db: Db, scope: ActualLivePlayScope) => {
  const pitch = scope.physicalPitchSourceId, players = scope.participants.map(p => p.playerId);
  const installed: Partial<Record<ActualLiveInventoryOwner, boolean>> = {}, all: Partial<Record<ActualLiveInventoryOwner, Row[]>> = {};
  for (const config of configurations) {
    const { owner, head } = config;
    installed[owner] = actualLiveOwnerInstalled(db, owner, head); all[owner] = [];
    if (!installed[owner]) continue;
    const columns = config.columns as Readonly<Record<string, string>>;
    const byPitch = paths.map(([column, path]) => claim(column, [...path, 'physicalPitchSourceId'], ':pitch')).join(' OR ');
    const byId = paths.map(([column, path]) => claim(column, [...path, 'sourceId'], 'own.source_id')).join(' OR ');
    const relevant = `r.physical_pitch_source_id=:pitch OR ${byPitch}
      OR ${claim('r.snapshot_json', ['receipt', 'self', 'physicalPitchSourceId'], ':pitch')}
      OR ${claim('r.snapshot_json', ['receipt', 'self', 'cut', 'physicalPitchSourceId'], ':pitch')}
      OR EXISTS (SELECT 1 FROM ${head} h WHERE h.physical_pitch_source_id=:pitch AND h.source_id=r.source_id)
      OR EXISTS (SELECT 1 FROM ${owner} own WHERE own.physical_pitch_source_id=:pitch AND (${byId}))`;
    const selected = [...new Set(Object.values(columns))].map(c => owner === 'actual_field_observations' && c === 'source_version'
      ? "CASE WHEN json_valid(r.source_json) THEN json_extract(r.source_json,'$.sourceVersion') END AS source_version" : `r.${c}`).join(',');
    const rows = db.prepare(`SELECT ${selected},${config.previous === null ? '1' : 'r.revision'} AS revision FROM ${owner} r WHERE ${relevant} ORDER BY r.player_id,revision`).all({ pitch }) as Row[];
    const heads = db.prepare(`SELECT h.* FROM ${head} h WHERE h.physical_pitch_source_id=:pitch
      OR h.source_id IN (SELECT r.source_id FROM ${owner} r WHERE ${relevant})`).all({ pitch });
    if (rows.some(r => r.physical_pitch_source_id !== pitch || !players.includes(r.player_id))
      || heads.some(h => h.physical_pitch_source_id !== pitch || !players.includes(String(h.player_id)))) fail();
    for (const player of players) {
      const ownRows = rows.filter(r => r.player_id === player), ownHeads = heads.filter(h => h.player_id === player);
      if (!ownRows.length) { if (ownHeads.length) fail(); continue; }
      const last = ownRows.at(-1)!;
      if (ownHeads.length !== 1 || ownHeads[0].source_id !== last.source_id || ownHeads[0].revision !== ownRows.length
        || config.previous === null && ownRows.length !== 1) fail();
      const expected = (row: Row) => Object.fromEntries(Object.entries(columns).map(([key, column]) => [key, row[column]]));
      const check = (row: Row, column: string, path: SqliteJsonMetadataPath, type: string, values: Record<string, string | number | null> = {}) => {
        const data = db.prepare(`SELECT (SELECT json_group_array(json_array(o.type,
          CASE WHEN o.type='object' THEN (${projection('o.value', Object.keys(values))})||'' END))
          FROM (${nodes(column, path)}) o) AS entries FROM ${owner} r WHERE r.source_id=$sourceId`).get({ sourceId: row.source_id });
        const entries = JSON.parse(String(data?.entries)) as [string, string | null][];
        if (entries.length !== 1 || entries[0][0] !== type || type === 'object' && Object.keys(values).length && !matches(entries[0][1], values)) fail();
      };
      for (const [i, row] of ownRows.entries()) {
        const value = expected(row);
        if (row.revision !== i + 1 || Object.entries(value).some(([k, v]) => !['executionSourceId', config.previous].includes(k) && !id(v))
          || config.previous !== null && value[config.previous] !== (ownRows[i - 1]?.source_id ?? null)) fail();
        check(row, 'r.source_json', [], 'object', value); check(row, 'r.snapshot_json', [], 'object', { revision: row.revision });
        check(row, 'r.snapshot_json', ['source'], 'object', value); check(row, 'r.snapshot_json', ['history'], 'array');
        const saved = db.prepare(`SELECT (SELECT json_group_array(json_array(o.type,
          CASE WHEN o.type='object' THEN (${projection('o.value', Object.keys(columns))})||'' END))
          FROM (${nodes('r.snapshot_json', ['history', { array: 'all' }])}) o) AS entries FROM ${owner} r WHERE r.source_id=?`).get(row.source_id)!;
        const history = JSON.parse(String(saved.entries)) as [string, string | null][];
        if (history.length !== i + 1 || history.some(([type, metadata], j) => type !== 'object' || !matches(metadata, expected(ownRows[j])))) fail();
      }
    }
    all[owner] = rows;
  }
  // Additional cross-owner/receipt claims, including hidden origin references and motor command ownership.
  ownedMotionKnownWorkFromSqlite(db, pitch, players);
  const observationRows = all.actual_field_observations!;
  let fieldBound = 0, executionBound = 0;
  if (scope.cut.kind === 'field_execution') {
    const field = db.prepare('SELECT revision FROM batted_world_field_actions WHERE source_id=?').get(scope.cut.baseFieldSourceId)!;
    fieldBound = Number(field.revision);
    if (scope.cut.executionSourceId !== null) executionBound = Number(db.prepare('SELECT revision FROM batted_world_field_executions WHERE source_id=?').get(scope.cut.executionSourceId)!.revision);
  }
  const cutRank = (row: Row) => {
    const field = db.prepare('SELECT physical_pitch_source_id,revision,game_id FROM batted_world_field_actions WHERE source_id=?').get(row.base_field_source_id!);
    if (!field || field.physical_pitch_source_id !== pitch || field.game_id !== scope.gameId || !Number.isSafeInteger(field.revision) || Number(field.revision) < 1) return fail();
    let executionRevision = 0;
    if (row.execution_source_id !== null) {
      if (!id(row.execution_source_id) || !actualLiveOwnerInstalled(db, 'batted_world_field_executions', 'batted_world_field_execution_heads')) return fail();
      const execution = db.prepare('SELECT physical_pitch_source_id,base_field_source_id,revision,game_id FROM batted_world_field_executions WHERE source_id=?').get(row.execution_source_id);
      if (!execution || execution.physical_pitch_source_id !== pitch || execution.game_id !== scope.gameId || execution.base_field_source_id !== row.base_field_source_id
        || !Number.isSafeInteger(execution.revision) || Number(execution.revision) < 1) return fail();
      executionRevision = Number(execution.revision);
    }
    return { fieldRevision: Number(field.revision), executionRevision };
  };
  for (const player of players) {
    let previous = { fieldRevision: 0, executionRevision: 0 };
    const playerRows = observationRows.filter(r => r.player_id === player);
    for (const row of playerRows) {
      if (row.observation_model_source_id !== playerRows[0].observation_model_source_id) fail();
      const rank = cutRank(row);
      if (rank.fieldRevision < previous.fieldRevision || rank.executionRevision < previous.executionRevision
        || previous.executionRevision > 0 && rank.fieldRevision !== previous.fieldRevision) fail();
      previous = rank;
    }
  }
  const within = (row: Row) => {
    const rank = cutRank(row);
    return scope.cut.kind === 'field_execution' && rank.fieldRevision <= fieldBound && rank.executionRevision <= executionBound;
  };
  // Every installed motor's cut remains ownership metadata, even outside the payload bound.
  for (const motor of all.actual_locomotion_receipts!) cutRank(motor);
  const observations = observationRows.filter(within), observationIds = new Set(observations.map(r => r.source_id));
  const decisions = all.actual_defensive_decisions!.filter(r => observationIds.has(String(r.observation_source_id)));
  const decisionIds = new Set(decisions.map(r => r.source_id));
  const motors = all.actual_locomotion_receipts!.filter(r => decisionIds.has(String(r.decision_source_id)) && within(r));
  return { installed, observations, decisions, motors, metadataHash: hash({ installed, rows: all }) };
};
