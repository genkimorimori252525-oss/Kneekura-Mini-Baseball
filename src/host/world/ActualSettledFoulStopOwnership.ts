import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { AcceptedActualSettledFoulStopProduction } from './ActualSettledFoulStopProducer';
import type { DurableActualLivePlayRuntime } from './ActualLivePlayRuntime';
import { actualLivePlayFields as fields, actualLivePlayId as id } from './ActualLivePlayScope';
import { actorHash as hash, actorJson as json, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { sqliteJsonMetadataNodes as nodes, sqliteJsonMetadataProjection as projection,
  sqliteJsonMetadataMatches as matches, type SqliteJsonMetadataPath } from './SqliteOwnershipMetadata';
import { battedVenueLegalPolicyEvidenceFromSqlite } from './SqliteBattedVenueLegalPolicyStore';

export const settledFoulStopTable = 'actual_settled_foul_stop_productions';
export const settledFoulStopSource = (raw: AcceptedActualSettledFoulStopProduction, sourceId: string) => {
  const source = cloneInert(raw);
  if (!fields(source, ['sourceId', 'sourceVersion', 'capability', 'physicalPitchSourceId', 'runtimeSourceId',
    'policySourceId', 'baseFieldSourceId', 'executionSourceId']) || source.sourceId !== sourceId
    || source.capability !== 'actual_original_settled_foul_stop_producer_v1' || source.executionSourceId !== null
    || ![sourceId, source.sourceVersion, source.physicalPitchSourceId, source.runtimeSourceId,
      source.policySourceId, source.baseFieldSourceId].every(id)) throw new Error('invalid actual settled-foul producer Source');
  return freeze(source);
};
export type SettledFoulStopRow = {
  source_id: string; source_version: string; capability: string; physical_pitch_source_id: string;
  runtime_source_id: string; policy_source_id: string; base_field_source_id: string; execution_source_id: null;
  game_id: string; play_id: number; ownership_key: string; original_stop_key: string;
  source_json: string; source_hash: string; snapshot_json: string; snapshot_hash: string;
};
type Scalar = string | number | null;
type Scope = Pick<DurableActualLivePlayRuntime, 'gameId' | 'playId' | 'membership'> & { source: { sourceId: string; physicalPitchSourceId: string } };
const columns = ['source_id', 'source_version', 'capability', 'physical_pitch_source_id', 'runtime_source_id',
  'policy_source_id', 'base_field_source_id', 'execution_source_id', 'game_id', 'play_id', 'ownership_key',
  'original_stop_key', 'source_json', 'source_hash', 'snapshot_json', 'snapshot_hash'];

/** Discover metadata before decoding an event. Array alternatives and duplicate
 * keys remain visible; none of the paths traverses evidence/physicalContacts. */
export const settledFoulStopOwnership = (db: DatabaseSync) => {
  const installed = () => {
    const schema = db.prepare('SELECT name,type,sql FROM main.sqlite_master WHERE name=?').all(settledFoulStopTable);
    if (db.prepare("SELECT 1 FROM main.sqlite_master WHERE name IN ('actual_settled_foul_stop_production_heads','actual_settled_foul_stop_productions_heads')").get()) {
      throw new Error('immutable settled-foul producer cannot have a mutable head');
    }
    if (!schema.length) return false;
    if (schema.length !== 1 || schema[0].type !== 'table' || typeof schema[0].sql !== 'string'
      || !/CHECK\s*\(\s*execution_source_id\s+IS\s+NULL\s*\)/i.test(schema[0].sql)) throw new Error('settled-foul producer owner schema differs');
    const info = db.prepare('PRAGMA main.table_info(' + settledFoulStopTable + ')').all();
    if (json(info.map(c => c.name)) !== json(columns) || info.some(c => c.type !== (c.name === 'play_id' ? 'INTEGER' : 'TEXT')
      || c.pk !== (c.name === 'source_id' ? 1 : 0) || c.notnull !== (['source_id', 'execution_source_id'].includes(String(c.name)) ? 0 : 1))) {
      throw new Error('settled-foul producer owner columns differ');
    }
    const unique = db.prepare('PRAGMA main.index_list(' + settledFoulStopTable + ')').all().filter(i => i.unique === 1)
      .map(i => { if (typeof i.name !== 'string' || !/^[A-Za-z0-9_]+$/.test(i.name) || i.partial !== 0) throw new Error('settled-foul producer unique index differs');
        return db.prepare('PRAGMA main.index_info(' + i.name + ')').all().map(c => String(c.name)).join('|'); }).sort();
    if (json(unique) !== json(['source_id', 'physical_pitch_source_id', 'runtime_source_id', 'ownership_key', 'original_stop_key'].sort())) {
      throw new Error('settled-foul producer uniqueness schema differs');
    }
    return true;
  };
  const all = (): SettledFoulStopRow[] => installed() ? db.prepare('SELECT * FROM main.' + settledFoulStopTable).all() as SettledFoulStopRow[] : [];
  const values = (document: string, path: readonly string[]): Scalar[] => db.prepare(`
    WITH RECURSIVE metadata(depth,value,type,atom) AS (
      SELECT 0,CASE WHEN json_valid($document) THEN $document ELSE 'null' END,
        json_type(CASE WHEN json_valid($document) THEN $document ELSE 'null' END),NULL
      UNION ALL
      SELECT m.depth+CASE WHEN m.type='object' THEN 1 ELSE 0 END,c.value,c.type,c.atom
      FROM metadata m,json_each(CASE WHEN m.type IN ('object','array') THEN m.value ELSE '{}' END) c
      WHERE (m.type='object' AND m.depth<$length AND c.key=json_extract($path,'$['||m.depth||']'))
        OR (m.type='array' AND m.depth<=$length)
    ) SELECT atom FROM metadata WHERE depth=$length AND type NOT IN ('object','array')`)
    .all({ document, path: json(path), length: path.length }).map(r => r.atom as Scalar);
  type IdentityRow = Pick<SettledFoulStopRow, 'source_id' | 'source_json' | 'snapshot_json'>;
  const sourceValues = (row: IdentityRow, key: string) => [
    ...values(row.source_json, [key]), ...values(row.snapshot_json, ['source', key]), ...values(row.snapshot_json, ['history', key]),
  ];
  const sourceIds = (row: IdentityRow) => [row.source_id, ...sourceValues(row, 'sourceId')].filter((value): value is string => typeof value === 'string');
  const identities = (sourceId: string) => {
    if (!id(sourceId)) throw new Error('invalid settled-foul producer identity');
    const rows = all().filter(row => sourceIds(row).includes(sourceId));
    if (rows.length > 1 || rows.length === 1 && rows[0].source_id !== sourceId) throw new Error('settled-foul producer Source identity differs');
    if (!rows.length && db.prepare("SELECT 1 FROM main.sqlite_master WHERE type='table' AND name='actual_live_play_admissions'").get()
      && db.prepare('SELECT 1 FROM main.actual_live_play_admissions WHERE owner=? AND source_id=?').get(settledFoulStopTable, sourceId)) {
      throw new Error('settled-foul admission names a missing owner');
    }
    return rows[0] ?? null;
  };
  const journal = (runtimeId: string) => db.prepare('SELECT * FROM main.actual_live_play_admissions WHERE runtime_source_id=? ORDER BY sequence').all(runtimeId);
  const claims = (scope: Scope): SettledFoulStopRow[] => {
    const rows = all(), pitch = scope.source.physicalPitchSourceId, runtime = scope.source.sourceId;
    const admitted = journal(runtime).filter(r => r.owner === settledFoulStopTable).map(r => r.source_id);
    const selected = new Set<SettledFoulStopRow>(), known = new Set<Scalar>(admitted as Scalar[]);
    // Resolve original indexed dependency ownership before classifying a row as
    // foreign. In particular, a policy's pitch cache cannot hide its field anchor.
    const dependencies = new Map<string, Set<Scalar>>();
    const domains = [
      ['batted_ball_flights', null, null, null],
      ['batted_world_contacts', 'flightSourceId', null, 'batted_ball_flights'],
      ['batted_first_fielder_touches', 'worldContactSourceId', 'world_contact_source_id', 'batted_world_contacts'],
      ['batted_contact_responses', 'firstFielderTouchSourceId', 'first_fielder_touch_source_id', 'batted_first_fielder_touches'],
      ['batted_world_field_actions', 'responseSourceId', 'response_source_id', 'batted_contact_responses'],
      ['batted_venue_legal_policies', 'baseFieldSourceId', 'base_field_source_id', 'batted_world_field_actions'],
      ['actual_live_play_runtimes', null, null, null],
    ] as const;
    for (const [owner, link, column, parent] of domains) {
      const related = new Set<Scalar>(); dependencies.set(owner, related);
      if (!db.prepare("SELECT 1 FROM main.sqlite_master WHERE type='table' AND name=?").get(owner)) continue;
      const candidates = db.prepare(`SELECT * FROM main.${owner}`).all() as (IdentityRow & Record<string, unknown>)[];
      for (const candidate of candidates) {
        const direct = [candidate.physical_pitch_source_id, ...sourceValues(candidate, 'physicalPitchSourceId'),
          ...values(candidate.snapshot_json, ['physicalPitchSourceId'])];
        const linked = link ? [...sourceValues(candidate, link), ...(column ? [candidate[column]] : [])] : [];
        if (direct.includes(pitch) || linked.some(value => dependencies.get(parent!)?.has(value as Scalar))
          || owner === 'batted_contact_responses' && dependencies.get('batted_world_contacts')?.has(candidate.world_contact_source_id as Scalar)
          || owner === 'actual_live_play_runtimes' && candidate.game_id === scope.gameId && candidate.play_id === scope.playId) {
          for (const name of sourceIds(candidate)) related.add(name);
        }
      }
      for (;;) {
        const before = related.size;
        for (const candidate of candidates) if (sourceIds(candidate).some(value => related.has(value))) {
          for (const name of sourceIds(candidate)) related.add(name);
        }
        if (related.size === before) break;
      }
    }
    const references = (owner: string, ids: Scalar[]) => ids.some(value => dependencies.get(owner)?.has(value));
    for (const row of rows) {
      const pitches = [row.physical_pitch_source_id, ...sourceValues(row, 'physicalPitchSourceId'),
        ...values(row.snapshot_json, ['physicalPitchSourceId']), ...values(row.snapshot_json, ['basis', 'physicalPitchSourceId'])];
      const runtimes = [row.runtime_source_id, ...sourceValues(row, 'runtimeSourceId'), ...values(row.snapshot_json, ['runtimeSourceId']),
        ...values(row.snapshot_json, ['runtimeReference', 'sourceId'])];
      const policies = [row.policy_source_id, ...sourceValues(row, 'policySourceId'), ...values(row.snapshot_json, ['basis', 'policyReference', 'sourceId'])];
      const fields = [row.base_field_source_id, ...sourceValues(row, 'baseFieldSourceId'), ...values(row.snapshot_json, ['basis', 'physicalCut', 'baseFieldSourceId'])];
      const games = [row.game_id, ...values(row.snapshot_json, ['gameId']), ...values(row.snapshot_json, ['basis', 'gameId'])];
      const plays = [row.play_id, ...values(row.snapshot_json, ['playId']), ...values(row.snapshot_json, ['basis', 'playId'])];
      if (pitches.includes(pitch) || runtimes.includes(runtime) || games.includes(scope.gameId) && plays.includes(scope.playId)
        || values(row.snapshot_json, ['scopeId']).includes(scope.membership.scopeId)
        || references('actual_live_play_runtimes', runtimes) || references('batted_venue_legal_policies', policies)
        || references('batted_world_field_actions', fields) || sourceIds(row).some(v => known.has(v))) selected.add(row);
    }
    // A foreign-indexed alias can point at a selected owner's original name.
    for (;;) {
      const before = selected.size;
      for (const row of selected) for (const value of sourceIds(row)) known.add(value);
      for (const row of rows) if (sourceIds(row).some(value => known.has(value))) selected.add(row);
      if (selected.size === before) break;
    }
    if (admitted.some(sourceId => ![...selected].some(row => row.source_id === sourceId))) throw new Error('settled-foul admission names a missing owner');
    return [...selected];
  };
  const metadata = (row: SettledFoulStopRow, runtime: DurableActualLivePlayRuntime) => {
    const source = settledFoulStopSource(JSON.parse(row.source_json), row.source_id);
    const ownershipKey = json(['actual_original_settled_foul_stop_producer_v1', source.physicalPitchSourceId]);
    if (row.source_json !== json(source) || row.source_hash !== hash(source) || row.source_version !== source.sourceVersion
      || row.capability !== source.capability || row.physical_pitch_source_id !== source.physicalPitchSourceId
      || row.runtime_source_id !== source.runtimeSourceId || row.policy_source_id !== source.policySourceId
      || row.base_field_source_id !== source.baseFieldSourceId || row.execution_source_id !== null
      || row.game_id !== runtime.gameId || row.play_id !== runtime.playId || row.ownership_key !== ownershipKey
      || source.physicalPitchSourceId !== runtime.source.physicalPitchSourceId || source.runtimeSourceId !== runtime.source.sourceId) {
      throw new Error('settled-foul producer original ownership differs');
    }
    const container = (path: SqliteJsonMetadataPath, type: string, expected: Record<string, Scalar> = {}) => {
      const found = db.prepare(`SELECT count(*) AS n,sum(o.type=$type) AS typed,
        CASE WHEN o.type='object' THEN ${projection('o.value', Object.keys(expected))} END AS metadata
        FROM (${nodes('$document', path)}) o`).get({ document: row.snapshot_json, type });
      if (!found || found.n !== 1 || found.typed !== 1 || type === 'object' && !matches(found.metadata as string | null, expected)) {
        throw new Error('settled-foul producer ownership container differs');
      }
    };
    const sourceMirror = (path: SqliteJsonMetadataPath) => {
      const found = db.prepare(`SELECT count(*) AS n,sum(o.type='object' AND o.value=$source) AS matched
        FROM (${nodes('$document', path)}) o`).get({ document: row.snapshot_json, source: json(source) });
      if (!found || found.n !== 1 || found.matched !== 1) throw new Error('settled-foul producer Source mirror differs');
    };
    const objectKeys = (path: SqliteJsonMetadataPath, expected: readonly string[]) => {
      const actual = db.prepare(`SELECT child.key FROM (${nodes('$document', path)}) o,
        json_each(CASE WHEN o.type='object' THEN o.value ELSE '{}' END) child`).all({ document: row.snapshot_json });
      if (json(actual.map(r => r.key).sort()) !== json([...expected].sort())) throw new Error('settled-foul producer metadata keys differ');
    };
    container([], 'object', { revision: 1, gameId: runtime.gameId, playId: runtime.playId, physicalPitchSourceId: source.physicalPitchSourceId,
      scopeId: runtime.membership.scopeId, ownershipKey, originalStopKey: row.original_stop_key });
    objectKeys([], ['source', 'revision', 'history', 'gameId', 'playId', 'physicalPitchSourceId', 'scopeId', 'ownershipKey',
      'originalStopKey', 'runtimeReference', 'basis', 'event', 'successor']);
    sourceMirror(['source']); container(['history'], 'array'); sourceMirror(['history', { array: 'all' }]);
    container(['runtimeReference'], 'object', { owner: 'actual_live_play_runtimes', sourceId: source.runtimeSourceId, snapshotHash: hash(runtime) });
    objectKeys(['runtimeReference'], ['owner', 'sourceId', 'snapshotHash']);
    container(['basis'], 'object', { physicalPitchSourceId: source.physicalPitchSourceId, gameId: runtime.gameId, playId: runtime.playId });
    objectKeys(['basis'], ['version', 'gameId', 'playId', 'physicalPitchSourceId', 'fixtureEventId', 'venueId', 'ruleProfileId',
      'policyReference', 'physicalCut', 'physicalPrefixReference', 'physicalPrefixReferences', 'originalCount', 'evidence', 'contactOrigins']);
    const policy = battedVenueLegalPolicyEvidenceFromSqlite(db).read(source.policySourceId);
    if (!policy || policy.physicalPitchSourceId !== runtime.source.physicalPitchSourceId) throw new Error('settled-foul producer policy ownership differs');
    container(['basis', 'policyReference'], 'object', { owner: 'batted_venue_legal_policies', sourceId: source.policySourceId,
      sourceVersion: policy.source.sourceVersion, sourceHash: hash(policy.source), snapshotHash: hash(policy), ruleProfileHash: policy.ruleProfileHash });
    objectKeys(['basis', 'policyReference'], ['owner', 'sourceId', 'sourceVersion', 'sourceHash', 'snapshotHash', 'ruleProfileHash']);
    const field = db.prepare('SELECT physical_pitch_source_id,game_id,revision FROM main.batted_world_field_actions WHERE source_id=?').get(source.baseFieldSourceId);
    if (!field || field.physical_pitch_source_id !== source.physicalPitchSourceId || field.game_id !== runtime.gameId
      || typeof field.revision !== 'number' || !Number.isSafeInteger(field.revision) || field.revision < 1) throw new Error('settled-foul field metadata differs');
    container(['basis', 'physicalCut'], 'object', { baseFieldSourceId: source.baseFieldSourceId, baseFieldRevision: field.revision,
      executionSourceId: null, executionRevision: null });
    objectKeys(['basis', 'physicalCut'], ['baseFieldSourceId', 'baseFieldRevision', 'executionSourceId', 'executionRevision']);
    const stop = JSON.parse(row.original_stop_key) as unknown;
    if (!Array.isArray(stop) || stop.length !== 3 || stop[0] !== 'original_settled_foul_stop_v1' || stop[1] !== source.physicalPitchSourceId
      || typeof stop[2] !== 'string' || !/^[0-9a-f]{64}$/.test(stop[2]) || json(stop) !== row.original_stop_key) throw new Error('settled-foul stop identity differs');
    const admissions = db.prepare('SELECT * FROM main.actual_live_play_admissions WHERE (owner=? AND source_id=?) OR (runtime_source_id=? AND owner=?)')
      .all(settledFoulStopTable, source.sourceId, runtime.source.sourceId, settledFoulStopTable);
    if (admissions.length !== 1 || admissions[0].runtime_source_id !== runtime.source.sourceId || admissions[0].owner !== settledFoulStopTable
      || admissions[0].source_id !== source.sourceId || admissions[0].source_hash !== row.source_hash || admissions[0].snapshot_hash !== row.snapshot_hash
      || journal(runtime.source.sourceId).some((r, i) => r.sequence !== i + 1)) throw new Error('settled-foul producer admission differs');
    return { source, fieldRevision: field.revision };
  };
  return { installed, all, identities, claims, metadata, journal };
};
