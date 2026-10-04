import { assertDefensiveMetadataUnambiguous, defensiveMetadataId as claim } from './ActualDefensiveMetadata';
import { sqliteJsonMetadataNodes as nodes, sqliteJsonMetadataProjection as projection,
  sqliteJsonMetadataMatches as matches, type SqliteJsonMetadataPath } from './SqliteOwnershipMetadata';
import type { DurableBattedWorldFieldAction } from './SqliteBattedWorldFieldStore';
import type { DurableBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';

type Db = Pick<import('node:sqlite').DatabaseSync, 'prepare'>;
type Scalar = string | number | null;
type Row = Record<string, Scalar> & { source_id: string; physical_pitch_source_id: string; player_id: string;
  source_json: string; snapshot_json: string };
type Kind = 'motor' | 'decision' | 'observation' | 'plan';
const tables = { motor: 'actual_locomotion_receipts', decision: 'actual_defensive_decisions',
  observation: 'actual_field_observations', plan: 'actual_defensive_plans' } as const;
const heads = { motor: 'actual_locomotion_heads', decision: 'actual_defensive_decision_heads', observation: 'actual_field_observation_heads' } as const;
const common = { sourceId: 'source_id', physicalPitchSourceId: 'physical_pitch_source_id', playerId: 'player_id' };
const columns: Record<Kind, Record<string, string>> = {
  motor: { ...common, sourceVersion: 'source_version', capability: 'capability', decisionSourceId: 'decision_source_id',
    locomotionModelSourceId: 'locomotion_model_source_id', baseFieldSourceId: 'base_field_source_id', executionSourceId: 'execution_source_id' },
  decision: { ...common, sourceVersion: 'source_version', observationSourceId: 'observation_source_id',
    decisionModelSourceId: 'decision_model_source_id', planSourceId: 'plan_source_id', previousDecisionSourceId: 'previous_source_id' },
  observation: { ...common, baseFieldSourceId: 'base_field_source_id', executionSourceId: 'execution_source_id',
    observationModelSourceId: 'observation_model_source_id', previousObservationSourceId: 'previous_source_id' },
  plan: { ...common, sourceVersion: 'source_version', careerId: 'career_id', personLinkSourceId: 'person_link_source_id',
    fieldingModelSourceId: 'fielding_model_source_id', gameDay: 'game_day', observationSourceId: 'observation_source_id' },
};
const id = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v === v.trim();
const positive = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v > 0;
function fail(detail: string): never { throw new Error(`owned motion causal preflight: ${detail}`); }
const malformedMotorHistory = `(SELECT count(*)!=1 OR sum(history.type='array')!=1
  OR sum(CASE WHEN history.type='array' THEN json_array_length(history.value) ELSE -1 END)!=1
  FROM (${nodes('snapshot_json', ['history'])}) history)`;
const scopeClaim = (document: string, path: SqliteJsonMetadataPath = []) =>
  `EXISTS (SELECT 1 FROM (${nodes(document, path)}) scoped WHERE scoped.type='object'
    AND ${claim('scoped.value', ['physicalPitchSourceId'], '$pitch')} AND ${claim('scoped.value', ['playerId'], '$player')})`;
const expected = (kind: Kind, row: Row): Record<string, Scalar> => ({
  ...Object.fromEntries(Object.entries(columns[kind]).map(([key, column]) => [key, row[column]])),
  ...(kind === 'plan' ? { provenance: 'accepted_at_actual_observation' } : {}),
});

export type OwnedMotionCausalityInput = Readonly<{
  /** The physical owner supplies its already validated original field and predecessor prefix. */
  baseField: DurableBattedWorldFieldAction;
  executionPrefix: readonly DurableBattedWorldFieldExecution[];
  motorSourceIds: readonly string[];
  decisionSourceIds: readonly string[];
}>;

/** Prove a strictly decreasing physical dependency rank BEFORE creating/dereferencing a motor or
 * decision reader. This is metadata-only preflight, not provenance, payload validation, or a reader
 * evidence facade. The caller must subsequently rederive original dependencies and compare hashes.
 * Future ownership metadata remains checked, but future domain payload and physical cuts are never
 * replayed or borrowed into this bound. No reader factories or caller-supplied evidence callbacks.
 */
export const preflightOwnedMotionCausality = (db: Db, input: OwnedMotionCausalityInput): void => {
  for (const ids of [input.motorSourceIds, input.decisionSourceIds]) {
    if (!Array.isArray(ids) || ids.some(value => !id(value)) || new Set(ids).size !== ids.length) fail('duplicate or invalid selected identity');
  }
  const { baseField, executionPrefix } = input, baseId = baseField.source.sourceId;
  const pitch = baseField.response.touch.worldContact.flight.source.physicalPitchSourceId, game = baseField.response.model.gameId;
  const executionIds = new Map(executionPrefix.map(value => [value.source.sourceId, value]));
  if (executionIds.size !== executionPrefix.length || executionPrefix.some((value, index) => value.revision !== index + 1
    || value.source.baseFieldSourceId !== baseId || value.baseField.source.sourceId !== baseId
    || value.source.previousExecutionSourceId !== (executionPrefix[index - 1]?.source.sourceId ?? null))) fail('predecessor prefix identity differs');
  const predecessor = executionPrefix.at(-1)?.source.sourceId ?? null;
  const fieldIds = new Map(baseField.history.map((source, index) => [source.sourceId, { source, revision: index + 1 }]));
  if (fieldIds.size !== baseField.history.length || baseField.history.at(-1)?.sourceId !== baseId
    || baseField.revision !== baseField.history.length) fail('original field prefix identity differs');

  const valid = (document: string) => !!db.prepare('SELECT json_valid(?) AS valid').get(document)!.valid;
  const object = (document: string, path: SqliteJsonMetadataPath, values: Record<string, Scalar>, type = 'object') => {
    const result = db.prepare(`SELECT owner.type,${Object.keys(values).length
      ? projection("CASE WHEN owner.type='object' THEN owner.value ELSE 'null' END", Object.keys(values)) : "'[]'"} AS metadata
      FROM (${nodes('$document', path)}) owner`).all({ document });
    if (result.length !== 1 || result[0].type !== type || type === 'object' && !matches(result[0].metadata as string, values)) {
      fail('ambiguous, mistyped or mismatched identity metadata');
    }
  };
  const observationVersion = (document: string, path: SqliteJsonMetadataPath): string => {
    const result = db.prepare(`SELECT atom,type FROM (${nodes('$document', [...path, 'sourceVersion'])})`).all({ document });
    if (result.length !== 1 || result[0].type !== 'text' || !id(result[0].atom)) fail('observation version metadata differs');
    return result[0].atom as string;
  };
  const metadata = (kind: Kind, row: Row, prefix: readonly Row[], required: boolean) => {
    const sourceValid = valid(row.source_json), snapshotValid = valid(row.snapshot_json), own = expected(kind, row);
    for (const [key, value] of Object.entries(own)) {
      if (key === 'executionSourceId' || key.startsWith('previous')) { if (value !== null && !id(value)) fail('invalid indexed lineage'); }
      else if (key === 'gameDay') { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) fail('invalid indexed game day'); }
      else if (!id(value)) fail('invalid indexed identity');
    }
    if (required && (!sourceValid || !snapshotValid)) fail('selected ownership metadata is opaque');
    if (kind !== 'motor') assertDefensiveMetadataUnambiguous(db, kind, row.source_json, row.snapshot_json);
    if (sourceValid) {
      object(row.source_json, [], own);
      if (kind === 'observation') observationVersion(row.source_json, []);
    }
    if (!snapshotValid) return;
    object(row.snapshot_json, [], kind === 'plan' ? {} : { revision: kind === 'motor' ? 1 : row.revision });
    object(row.snapshot_json, ['source'], own);
    if (kind === 'observation') {
      const version = observationVersion(row.snapshot_json, ['source']);
      if (sourceValid && observationVersion(row.source_json, []) !== version) fail('observation version mirror differs');
    }
    if (kind === 'plan') { object(row.snapshot_json, ['binding'], { playerId: row.player_id }); return; }
    object(row.snapshot_json, ['history'], {}, 'array');
    const history = db.prepare(`SELECT entry.type,${projection("CASE WHEN entry.type='object' THEN entry.value ELSE 'null' END", Object.keys(own))} AS metadata,
      ${projection("CASE WHEN entry.type='object' THEN entry.value ELSE 'null' END", ['sourceVersion'])} AS version
      FROM (${nodes('$document', ['history'])}) container,json_each(container.value) entry ORDER BY CAST(entry.key AS INTEGER)`)
      .all({ document: row.snapshot_json });
    if (history.length !== prefix.length || history.some((entry, index) => entry.type !== 'object'
      || !matches(entry.metadata as string, expected(kind, prefix[index])))) fail('history identity metadata differs');
    if (kind === 'observation') for (const [index, entry] of history.entries()) {
      // Parse projected scalar metadata only, never a Source/view/receipt domain object.
      const version = JSON.parse(entry.version as string) as [string, string, unknown][];
      if (version.length !== 1 || version[0][0] !== 'sourceVersion' || version[0][1] !== 'text' || !id(version[0][2])) fail('observation history version type differs');
      const original = prefix[index], value = valid(original.source_json) ? observationVersion(original.source_json, [])
        : valid(original.snapshot_json) ? observationVersion(original.snapshot_json, ['source']) : version[0][2];
      if (version[0][2] !== value) fail('observation history version mirror differs');
    }
    if (kind === 'decision') {
      object(row.snapshot_json, ['receipt'], { originDecisionSourceId: prefix[0].source_id, originObservationSourceId: prefix[0].observation_source_id });
      object(row.snapshot_json, ['receipt', 'self'], { playerId: row.player_id });
    }
    if (kind === 'motor') {
      if (row.capability !== 'initial_defender_step_v1') fail('unsupported motor capability');
      object(row.snapshot_json, ['receipt'], {});
      object(row.snapshot_json, ['receipt', 'self'], { physicalPitchSourceId: row.physical_pitch_source_id, playerId: row.player_id });
      object(row.snapshot_json, ['receipt', 'self', 'cut'], { physicalPitchSourceId: row.physical_pitch_source_id, playerId: row.player_id,
        baseFieldSourceId: row.base_field_source_id, executionSourceId: row.execution_source_id, mode: 'original' });
      object(row.snapshot_json, ['receipt', 'command'], { playerId: row.player_id });
    }
  };
  const identity = (kind: Kind, sourceId: string): Row => {
    if (!id(sourceId)) fail('invalid dependency identity');
    const ownHistory = kind === 'plan' ? '' : ` OR ${claim('snapshot_json', ['history', { array: 'last' }, 'sourceId'], '$id')}
      ${kind === 'motor' ? `OR (${malformedMotorHistory} AND (${claim('snapshot_json', ['history', { array: 'all' }, 'sourceId'], '$id')}
        OR ${claim('snapshot_json', ['history', 'sourceId'], '$id')}))` : ''}`;
    const rows = db.prepare(`SELECT * FROM ${tables[kind]} WHERE source_id=$id
      OR ${claim('source_json', ['sourceId'], '$id')} OR ${claim('snapshot_json', ['source', 'sourceId'], '$id')}${ownHistory}`)
      .all({ id: sourceId }) as Row[];
    if (rows.length !== 1 || rows[0].source_id !== sourceId) fail('dependency Source identity ownership differs');
    return rows[0];
  };
  const scopes = new Map<string, readonly Row[]>();
  const scope = (kind: Kind, player: string): readonly Row[] => {
    const key = JSON.stringify([kind, pitch, player]), cached = scopes.get(key);
    if (cached) return cached;
    let owners = `(physical_pitch_source_id=$pitch AND player_id=$player) OR ${scopeClaim('source_json')}
      OR ${scopeClaim('snapshot_json', ['source'])}`;
    if (kind !== 'plan') owners += ` OR ${scopeClaim('snapshot_json', ['history', { array: 'all' }])}`;
    if (kind === 'decision' || kind === 'plan') owners += ` OR (${claim('snapshot_json', ['source', 'physicalPitchSourceId'], '$pitch')}
      AND ${claim('snapshot_json', [kind === 'plan' ? 'binding' : 'receipt', ...(kind === 'plan' ? [] : ['self']), 'playerId'], '$player')})
      OR EXISTS (SELECT 1 FROM actual_field_observations dependency WHERE dependency.physical_pitch_source_id=$pitch AND dependency.player_id=$player
        AND (dependency.source_id=${tables[kind]}.observation_source_id
          OR ${claim(`${tables[kind]}.source_json`, ['observationSourceId'], 'dependency.source_id')}
          OR ${claim(`${tables[kind]}.snapshot_json`, ['source', 'observationSourceId'], 'dependency.source_id')}
          ${kind === 'decision' ? `OR ${claim(`${tables[kind]}.snapshot_json`, ['receipt', 'originObservationSourceId'], 'dependency.source_id')}` : ''}))`;
    if (kind === 'motor') owners += ` OR (${malformedMotorHistory} AND ${scopeClaim('snapshot_json', ['history'])})
      OR ${scopeClaim('snapshot_json', ['receipt', 'self'])}
      OR ${scopeClaim('snapshot_json', ['receipt', 'self', 'cut'])}
      OR (${claim('snapshot_json', ['source', 'physicalPitchSourceId'], '$pitch')} AND ${claim('snapshot_json', ['receipt', 'command', 'playerId'], '$player')})
      OR EXISTS (SELECT 1 FROM actual_defensive_decisions dependency WHERE dependency.physical_pitch_source_id=$pitch AND dependency.player_id=$player
        AND (dependency.source_id=actual_locomotion_receipts.decision_source_id
          OR ${claim('actual_locomotion_receipts.source_json', ['decisionSourceId'], 'dependency.source_id')}
          OR ${claim('actual_locomotion_receipts.snapshot_json', ['source', 'decisionSourceId'], 'dependency.source_id')}
          OR ${claim('actual_locomotion_receipts.snapshot_json', ['history', { array: 'all' }, 'decisionSourceId'], 'dependency.source_id')}))`;
    const rows = db.prepare(`SELECT * FROM ${tables[kind]} WHERE ${owners}${kind === 'decision' || kind === 'observation' ? ' ORDER BY revision' : ''}`)
      .all({ pitch, player }) as Row[];
    if (!rows.length || (kind === 'motor' || kind === 'plan') && rows.length !== 1) fail('dependency owner scope differs');
    if (kind !== 'plan') {
      const found = db.prepare(`SELECT * FROM ${heads[kind]} WHERE (physical_pitch_source_id=$pitch AND player_id=$player)
        OR source_id IN (SELECT source_id FROM ${tables[kind]} WHERE ${owners})`).all({ pitch, player }) as Row[];
      if (found.length !== 1 || found[0].physical_pitch_source_id !== pitch || found[0].player_id !== player
        || found[0].source_id !== rows.at(-1)!.source_id || found[0].revision !== rows.length) fail('dependency head ownership differs');
    }
    let priorObservationRevision = 0, priorFieldRevision = 0, priorExecutionRevision = 0, executionBase: string | null = null;
    for (const [index, row] of rows.entries()) {
      if (row.physical_pitch_source_id !== pitch || row.player_id !== player) fail('dependency namespace differs');
      identity(kind, row.source_id);
      if ((kind === 'decision' || kind === 'observation') && (row.revision !== index + 1
        || row.previous_source_id !== (rows[index - 1]?.source_id ?? null))) fail('dependency predecessor lineage differs');
      metadata(kind, row, kind === 'motor' || kind === 'plan' ? [row] : rows.slice(0, index + 1), false);
      if (kind === 'decision') {
        if (row.plan_source_id !== rows[0].plan_source_id || row.decision_model_source_id !== rows[0].decision_model_source_id) fail('decision model/plan lineage differs');
        const observation = identity('observation', row.observation_source_id as string);
        if (observation.physical_pitch_source_id !== pitch || observation.player_id !== player || !positive(observation.revision)
          || observation.revision <= priorObservationRevision) fail('decision observation lineage differs');
        priorObservationRevision = observation.revision;
      }
      if (kind === 'observation') {
        if (row.observation_model_source_id !== rows[0].observation_model_source_id) fail('observation model lineage differs');
        const field = db.prepare('SELECT physical_pitch_source_id,revision,game_id FROM batted_world_field_actions WHERE source_id=?').get(row.base_field_source_id)!;
        if (!field || field.physical_pitch_source_id !== pitch || field.game_id !== game || !positive(field.revision)
          || field.revision < priorFieldRevision || executionBase !== null && row.base_field_source_id !== executionBase) fail('observation field lineage differs');
        priorFieldRevision = field.revision;
        if (row.execution_source_id !== null) {
          const execution = db.prepare('SELECT physical_pitch_source_id,base_field_source_id,revision,game_id FROM batted_world_field_executions WHERE source_id=?')
            .get(row.execution_source_id);
          if (!execution || execution.physical_pitch_source_id !== pitch || execution.base_field_source_id !== row.base_field_source_id
            || execution.game_id !== game || !positive(execution.revision) || execution.revision < priorExecutionRevision) fail('observation execution lineage differs');
          priorExecutionRevision = execution.revision; executionBase = row.base_field_source_id as string;
        } else if (priorExecutionRevision > 0) fail('observation execution lineage moved backward');
      }
    }
    scopes.set(key, rows); return rows;
  };
  const selected = (kind: Kind, sourceId: string, player?: string) => {
    const row = identity(kind, sourceId);
    if (row.physical_pitch_source_id !== pitch || player !== undefined && row.player_id !== player) fail('selected dependency namespace differs');
    const rows = scope(kind, row.player_id), bound = rows.findIndex(value => value.source_id === sourceId);
    if (bound < 0) fail('selected dependency is outside its owner prefix');
    metadata(kind, row, rows.slice(0, bound + 1), true);
    return { row, rows: rows.slice(0, bound + 1) };
  };
  const cut = (row: Row, exactPredecessor: boolean) => {
    if (exactPredecessor && (row.base_field_source_id !== baseId || row.execution_source_id !== predecessor)) fail('motor self cut differs from exact predecessor');
    const field = fieldIds.get(row.base_field_source_id as string);
    if (!field) fail('physical field anchor is outside original predecessor prefix');
    const indexed = db.prepare('SELECT physical_pitch_source_id,revision,game_id,response_source_id,geometry_source_id FROM batted_world_field_actions WHERE source_id=?')
      .get(row.base_field_source_id);
    if (!indexed || indexed.physical_pitch_source_id !== pitch || indexed.game_id !== game || indexed.revision !== field.revision
      || indexed.response_source_id !== field.source.responseSourceId || indexed.geometry_source_id !== field.source.geometrySourceId) fail('physical field anchor metadata differs');
    if (row.execution_source_id === null) return; // Exact original field, never current/latest.
    const execution = executionIds.get(row.execution_source_id as string);
    const indexedExecution = db.prepare('SELECT physical_pitch_source_id,base_field_source_id,revision,game_id FROM batted_world_field_executions WHERE source_id=?')
      .get(row.execution_source_id);
    if (!execution || row.base_field_source_id !== baseId || !indexedExecution || indexedExecution.physical_pitch_source_id !== pitch
      || indexedExecution.base_field_source_id !== baseId || indexedExecution.game_id !== game || indexedExecution.revision !== execution.revision) {
      fail('physical execution is not a strict predecessor member');
    }
  };
  const observations = new Map<string, readonly Row[]>(), provenObservations = new Set<string>();
  const observe = (sourceId: string, player: string): readonly Row[] => {
    const key = JSON.stringify([sourceId, player]), cached = observations.get(key);
    if (cached) return cached;
    const { rows } = selected('observation', sourceId, player);
    for (const [index, row] of rows.entries()) {
      if (provenObservations.has(row.source_id)) continue;
      metadata('observation', row, rows.slice(0, index + 1), true); cut(row, false);
      provenObservations.add(row.source_id);
    }
    observations.set(key, rows); return rows;
  };
  const decisions = new Set<string>();
  const decision = (sourceId: string, player?: string) => {
    const { row: selectedRow, rows } = selected('decision', sourceId, player);
    for (const [index, row] of rows.entries()) {
      if (decisions.has(row.source_id)) continue;
      metadata('decision', row, rows.slice(0, index + 1), true);
      const history = observe(row.observation_source_id as string, selectedRow.player_id);
      const plan = selected('plan', row.plan_source_id as string, selectedRow.player_id).row;
      observe(plan.observation_source_id as string, selectedRow.player_id);
      if (!history.some(value => value.source_id === plan.observation_source_id)) fail('plan origin is outside decision observation ancestry');
      decisions.add(row.source_id);
    }
  };
  for (const sourceId of input.motorSourceIds) {
    const row = selected('motor', sourceId).row;
    cut(row, true); decision(row.decision_source_id as string, row.player_id);
  }
  for (const sourceId of input.decisionSourceIds) decision(sourceId);
};
