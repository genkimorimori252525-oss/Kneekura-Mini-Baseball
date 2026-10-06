import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { AcceptedActualFoulRuleConsumption } from './ActualFoulRuleConsumption';
import type { DurableActualLivePlayRuntime } from './ActualLivePlayRuntime';
import { actualLivePlayFields as fields, actualLivePlayId as id } from './ActualLivePlayScope';
import { actorHash as hash, actorJson as json, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { sqliteJsonMetadataNodes as nodes, sqliteJsonMetadataProjection as projection,
  sqliteJsonMetadataMatches as matches, type SqliteJsonMetadataPath } from './SqliteOwnershipMetadata';
import { settledFoulStopOwnership, settledFoulStopTable } from './ActualSettledFoulStopOwnership';
import { actualLiveEventKey, actualLiveSuccessorKey } from './ActualLivePlayQueueEvidenceFromSqlite';
import { readOriginalPhysicalPitchPrefixFromSqlite } from './PhysicalPitchEvidenceFromSqlite';
import { deriveOriginalBattingIntentEvidence } from './OriginalBattingIntent';
import { battedVenueOriginalContactCount } from './BattedVenueLegalEvidenceFromSqlite';
import { battedWorldFieldEvidenceFromSqlite } from './SqliteBattedWorldFieldStore';

export const foulRuleConsumptionTable = 'actual_foul_rule_consumptions';
export const foulRuleConsumptionSource = (raw: AcceptedActualFoulRuleConsumption, sourceId: string) => {
  const source = cloneInert(raw);
  if (!fields(source, ['sourceId', 'sourceVersion', 'capability', 'runtimeSourceId', 'stopProductionSourceId'])
    || source.sourceId !== sourceId || source.capability !== 'actual_original_settled_foul_rule_consumption_v1'
    || ![sourceId, source.sourceVersion, source.runtimeSourceId, source.stopProductionSourceId].every(id)) {
    throw new Error('invalid actual foul rule consumption Source');
  }
  return freeze(source);
};
export type FoulRuleConsumptionRow = {
  source_id: string; source_version: string; capability: string; physical_pitch_source_id: string;
  runtime_source_id: string; stop_production_source_id: string; game_id: string; play_id: number;
  first_physical_pitch_source_id: string; scope_id: string; ownership_key: string; consumed_successor_key: string;
  source_json: string; source_hash: string; snapshot_json: string; snapshot_hash: string;
};
type Scalar = string | number | null;
const columns = ['source_id', 'source_version', 'capability', 'physical_pitch_source_id', 'runtime_source_id',
  'stop_production_source_id', 'game_id', 'play_id', 'first_physical_pitch_source_id', 'scope_id', 'ownership_key',
  'consumed_successor_key', 'source_json', 'source_hash', 'snapshot_json', 'snapshot_hash'];

/** Scope discovery uses raw metadata, including duplicate/escaped keys, before
 * decoding any count consequence or composed timeline. Every call is fresh. */
export const foulRuleConsumptionOwnership = (db: DatabaseSync) => {
  const stop = settledFoulStopOwnership(db), { values, sourceValues, sourceIds } = stop;
  const installed = () => {
    const schema = db.prepare('SELECT name,type FROM main.sqlite_master WHERE name=?').all(foulRuleConsumptionTable);
    if (db.prepare("SELECT 1 FROM main.sqlite_master WHERE name IN ('actual_foul_rule_consumption_heads','actual_foul_rule_consumptions_heads')").get()) {
      throw new Error('immutable foul consumption cannot have a mutable head');
    }
    if (!schema.length) return false;
    if (schema.length !== 1 || schema[0].type !== 'table') throw new Error('foul consumption owner schema differs');
    const info = db.prepare('PRAGMA main.table_info(' + foulRuleConsumptionTable + ')').all();
    if (json(info.map(c => c.name)) !== json(columns) || info.some(c => c.type !== (c.name === 'play_id' ? 'INTEGER' : 'TEXT')
      || c.pk !== (c.name === 'source_id' ? 1 : 0) || c.notnull !== 1)) throw new Error('foul consumption owner columns differ');
    const unique = db.prepare('PRAGMA main.index_list(' + foulRuleConsumptionTable + ')').all().filter(i => i.unique === 1)
      .map(i => { if (typeof i.name !== 'string' || !/^[A-Za-z0-9_]+$/.test(i.name) || i.partial !== 0) throw new Error('foul consumption unique index differs');
        return db.prepare('PRAGMA main.index_info(' + i.name + ')').all().map(c => String(c.name)).join('|'); }).sort();
    if (json(unique) !== json(['source_id', 'physical_pitch_source_id', 'runtime_source_id', 'stop_production_source_id',
      'ownership_key', 'consumed_successor_key'].sort())) throw new Error('foul consumption uniqueness schema differs');
    return true;
  };
  const all = (): FoulRuleConsumptionRow[] => installed() ? db.prepare('SELECT * FROM main.' + foulRuleConsumptionTable).all() as FoulRuleConsumptionRow[] : [];
  const identities = (sourceId: string) => {
    if (!id(sourceId)) throw new Error('invalid foul consumption identity');
    const rows = all().filter(row => sourceIds(row).includes(sourceId));
    if (rows.length > 1 || rows.length === 1 && rows[0].source_id !== sourceId) throw new Error('foul consumption Source identity differs');
    if (!rows.length && db.prepare("SELECT 1 FROM main.sqlite_master WHERE type='table' AND name='actual_live_play_admissions'").get()
      && db.prepare('SELECT 1 FROM main.actual_live_play_admissions WHERE owner=? AND source_id=?').get(foulRuleConsumptionTable, sourceId)) {
      throw new Error('foul consumption admission names a missing owner');
    }
    return rows[0] ?? null;
  };
  // Keep owner/source pairing inside each raw reference object. Array alternatives,
  // duplicate containers and escaped duplicate keys remain visible before decoding.
  const prefixFieldIds = (document: string): Scalar[] => db.prepare(`
    WITH RECURSIVE references_metadata(depth,value,type) AS (
      SELECT 0,CASE WHEN json_valid($document) THEN $document ELSE 'null' END,
        json_type(CASE WHEN json_valid($document) THEN $document ELSE 'null' END)
      UNION ALL
      SELECT parent.depth+CASE WHEN parent.type='object' THEN 1 ELSE 0 END,child.value,child.type
      FROM references_metadata parent,
        json_each(CASE WHEN parent.type IN ('object','array') THEN parent.value ELSE '{}' END) child
      WHERE (parent.type='object' AND parent.depth<$length AND child.key=json_extract($path,'$['||parent.depth||']'))
        OR (parent.type='array' AND parent.depth<=$length)
    ) SELECT value FROM references_metadata WHERE depth=$length AND type='object'`)
    .all({ document, path: json(['countEvidence', 'basis', 'physicalPrefixReferences']), length: 3 }).flatMap(row =>
      typeof row.value === 'string' && values(row.value, ['owner']).includes('batted_world_field_actions')
        ? values(row.value, ['sourceId']) : []);
  const claims = (runtime: DurableActualLivePlayRuntime) => {
    const rows = all(), pitch = runtime.source.physicalPitchSourceId, runtimeId = runtime.source.sourceId;
    const dependencies = stop.dependenciesFor(runtime), producers = stop.claims(runtime);
    const producerIds = new Set(producers.flatMap(row => sourceIds(row)));
    const admitted = stop.journal(runtimeId).filter(row => row.owner === foulRuleConsumptionTable).map(row => row.source_id);
    const selected = new Set<FoulRuleConsumptionRow>(), known = new Set<Scalar>(admitted as Scalar[]);
    const references = (owner: string, ids: Scalar[]) => ids.some(value => dependencies.get(owner)?.has(value));
    for (const row of rows) {
      const pitches = [row.physical_pitch_source_id, ...sourceValues(row, 'physicalPitchSourceId'),
        ...values(row.snapshot_json, ['physicalPitchSourceId']), ...values(row.snapshot_json, ['countEvidence', 'basis', 'physicalPitchSourceId']),
        ...values(row.snapshot_json, ['countEvidence', 'battingIntent', 'physicalPitch', 'sourceId']),
        ...values(row.snapshot_json, ['countEvidence', 'basis', 'originalCount', 'physicalPitchSourceId'])];
      const runtimes = [row.runtime_source_id, ...sourceValues(row, 'runtimeSourceId'), ...values(row.snapshot_json, ['runtimeReference', 'sourceId'])];
      const stops = [row.stop_production_source_id, ...sourceValues(row, 'stopProductionSourceId'), ...values(row.snapshot_json, ['producerReference', 'sourceId'])];
      const policies = values(row.snapshot_json, ['countEvidence', 'basis', 'policyReference', 'sourceId']);
      const fields = [...values(row.snapshot_json, ['countEvidence', 'basis', 'physicalCut', 'baseFieldSourceId']),
        ...prefixFieldIds(row.snapshot_json)];
      const games = [row.game_id, ...values(row.snapshot_json, ['gameId']), ...values(row.snapshot_json, ['countEvidence', 'basis', 'gameId'])];
      const plays = [row.play_id, ...values(row.snapshot_json, ['playId']), ...values(row.snapshot_json, ['countEvidence', 'basis', 'playId'])];
      if (pitches.includes(pitch) || runtimes.includes(runtimeId) || stops.some(v => typeof v === 'string' && producerIds.has(v))
        || games.includes(runtime.gameId) && plays.includes(runtime.playId) || row.scope_id === runtime.membership.scopeId
        || values(row.snapshot_json, ['scopeId']).includes(runtime.membership.scopeId)
        || references('actual_live_play_runtimes', runtimes) || references('batted_venue_legal_policies', policies)
        || references('batted_world_field_actions', fields) || sourceIds(row).some(v => known.has(v))) selected.add(row);
    }
    for (;;) {
      const before = selected.size;
      for (const row of selected) for (const value of sourceIds(row)) known.add(value);
      for (const row of rows) if (sourceIds(row).some(value => known.has(value))) selected.add(row);
      if (selected.size === before) break;
    }
    if (admitted.some(sourceId => ![...selected].some(row => row.source_id === sourceId))) throw new Error('foul consumption admission names a missing owner');
    return [...selected];
  };
  const metadata = (row: FoulRuleConsumptionRow, runtime: DurableActualLivePlayRuntime) => {
    const source = foulRuleConsumptionSource(JSON.parse(row.source_json), row.source_id);
    const producer = stop.identities(source.stopProductionSourceId), producerClaims = stop.claims(runtime);
    if (!producer || producerClaims.length !== 1 || producerClaims[0].source_id !== producer.source_id) {
      throw new Error('foul consumption original producer ownership differs');
    }
    const { source: producerSource, fieldRevision } = stop.metadata(producer, runtime);
    const localSuccessor = json(['settled_foul_rule_evidence_v1', producer.original_stop_key]);
    const successorKey = actualLiveSuccessorKey(settledFoulStopTable, producer.source_id, localSuccessor);
    const eventKey = actualLiveEventKey(settledFoulStopTable, producer.source_id, json(['settled_foul_stop_v1', producer.original_stop_key]));
    const pitchId = runtime.source.physicalPitchSourceId;
    const prefix = readOriginalPhysicalPitchPrefixFromSqlite(db, pitchId), pitch = prefix.at(-1)!;
    const firstPitchId = prefix[0].source.sourceId, intent = deriveOriginalBattingIntentEvidence(pitch);
    const ownershipKey = json(['actual_original_settled_foul_rule_consumption_v1', pitchId, successorKey]);
    const receiptId = json(['actual_foul_rule_consumption_receipt_v1', ownershipKey, source.sourceId]);
    if (row.source_json !== json(source) || row.source_hash !== hash(source) || row.source_version !== source.sourceVersion
      || row.capability !== source.capability || row.physical_pitch_source_id !== pitchId
      || row.runtime_source_id !== source.runtimeSourceId || row.stop_production_source_id !== source.stopProductionSourceId
      || row.first_physical_pitch_source_id !== firstPitchId || row.scope_id !== runtime.membership.scopeId
      || row.game_id !== runtime.gameId || row.play_id !== runtime.playId || row.ownership_key !== ownershipKey
      || row.consumed_successor_key !== successorKey || source.runtimeSourceId !== runtime.source.sourceId) {
      throw new Error('foul consumption original ownership differs');
    }
    const container = (path: SqliteJsonMetadataPath, type: string, expected: Record<string, Scalar> = {}) => {
      const found = db.prepare(`SELECT count(*) AS n,sum(o.type=$type) AS typed,
        CASE WHEN o.type='object' THEN ${projection('o.value', Object.keys(expected))} END AS metadata
        FROM (${nodes('$document', path)}) o`).get({ document: row.snapshot_json, type });
      if (!found || found.n !== 1 || found.typed !== 1 || type === 'object' && !matches(found.metadata as string | null, expected)) {
        throw new Error('foul consumption ownership container differs');
      }
    };
    const exact = (path: SqliteJsonMetadataPath, value: unknown) => {
      const found = db.prepare(`SELECT count(*) AS n,sum(o.type=$type AND o.value=$value) AS matched
        FROM (${nodes('$document', path)}) o`).get({ document: row.snapshot_json,
          type: Array.isArray(value) ? 'array' : 'object', value: json(value) });
      if (!found || found.n !== 1 || found.matched !== 1) throw new Error('foul consumption original metadata mirror differs');
    };
    const keys = (path: SqliteJsonMetadataPath, expected: readonly string[]) => {
      const actual = db.prepare(`SELECT child.key FROM (${nodes('$document', path)}) o,
        json_each(CASE WHEN o.type='object' THEN o.value ELSE '{}' END) child`).all({ document: row.snapshot_json });
      if (json(actual.map(r => r.key).sort()) !== json([...expected].sort())) throw new Error('foul consumption metadata keys differ');
    };
    container([], 'object', { revision: 1, gameId: runtime.gameId, playId: runtime.playId, physicalPitchSourceId: pitchId,
      firstPhysicalPitchSourceId: firstPitchId, scopeId: runtime.membership.scopeId, ownershipKey });
    keys([], ['source', 'revision', 'history', 'gameId', 'playId', 'physicalPitchSourceId', 'firstPhysicalPitchSourceId', 'scopeId',
      'ownershipKey', 'runtimeReference', 'producerReference', 'countEvidence', 'disposition', 'consumption', 'successor']);
    exact(['source'], source); container(['history'], 'array'); exact(['history', { array: 'all' }], source);
    exact(['runtimeReference'], { owner: 'actual_live_play_runtimes', sourceId: source.runtimeSourceId, snapshotHash: hash(runtime) });
    exact(['producerReference'], { owner: settledFoulStopTable, sourceId: source.stopProductionSourceId, snapshotHash: producer.snapshot_hash });
    container(['countEvidence'], 'object', { version: 'batted_venue_foul_count_evidence_v1' });
    keys(['countEvidence'], ['version', 'basis', 'battingIntent', 'countConsequence']);
    container(['countEvidence', 'basis'], 'object', { version: 'batted_venue_legal_evidence_v1', physicalPitchSourceId: pitchId,
      gameId: runtime.gameId, playId: runtime.playId });
    keys(['countEvidence', 'basis'], ['version', 'gameId', 'playId', 'physicalPitchSourceId', 'fixtureEventId', 'venueId', 'ruleProfileId',
      'policyReference', 'physicalCut', 'physicalPrefixReference', 'physicalPrefixReferences', 'originalCount', 'evidence', 'contactOrigins']);
    // These are already authenticated producer metadata. Copy only the reference
    // containers; the producer's future contacts/evidence are never decoded here.
    for (const key of ['policyReference', 'physicalCut'] as const) {
      const reference = db.prepare(`SELECT o.value FROM (${nodes('$document', ['basis', key])}) o`)
        .get({ document: producer.snapshot_json });
      if (!reference || typeof reference.value !== 'string') throw new Error('foul consumption original basis reference missing');
      exact(['countEvidence', 'basis', key], JSON.parse(reference.value));
    }
    exact(['countEvidence', 'battingIntent'], intent);
    exact(['countEvidence', 'basis', 'originalCount'], battedVenueOriginalContactCount(pitch));
    // Authenticate only the original field-prefix references here. The saved
    // future count consequence, composed timeline and producer contacts stay opaque.
    const fieldOwner = battedWorldFieldEvidenceFromSqlite(db), originalField = fieldOwner.read(producerSource.baseFieldSourceId);
    if (!originalField || originalField.revision !== fieldRevision
      || originalField.response.touch.worldContact.flight.physicalPitch.source.sourceId !== pitchId) {
      throw new Error('foul consumption original physical prefix differs');
    }
    const originalReferences = fieldOwner.scope(originalField, originalField.source.sourceId).map(value => ({
      owner: 'batted_world_field_actions', sourceId: value.source.sourceId, sourceVersion: value.source.sourceVersion,
      revision: value.revision, sourceHash: hash(value.source), snapshotHash: hash(value),
    }));
    exact(['countEvidence', 'basis', 'physicalPrefixReferences'], originalReferences);
    container(['consumption'], 'object', { kind: 'settled_foul_rule_consumption', status: 'consumed', receiptId,
      eventKey, successorKey, proofScope: 'one_original_untouched_foul_rule_consumer' });
    keys(['consumption'], ['kind', 'status', 'receiptId', 'eventKey', 'successorKey', 'occurredAt', 'eventAvailableAt', 'availableAt', 'proofScope']);
    container(['successor'], 'object', { kind: 'settled_foul_disposition', status: 'pending', basisReceiptId: receiptId,
      successorKey: json(['actual_foul_disposition_successor_v1', receiptId]) });
    keys(['successor'], ['kind', 'status', 'basisReceiptId', 'successorKey', 'pendingReason']);
    const admissions = db.prepare('SELECT * FROM main.actual_live_play_admissions WHERE (owner=? AND source_id=?) OR (runtime_source_id=? AND owner=?)')
      .all(foulRuleConsumptionTable, source.sourceId, runtime.source.sourceId, foulRuleConsumptionTable);
    if (admissions.length !== 1 || admissions[0].runtime_source_id !== runtime.source.sourceId || admissions[0].owner !== foulRuleConsumptionTable
      || admissions[0].source_id !== source.sourceId || admissions[0].source_hash !== row.source_hash || admissions[0].snapshot_hash !== row.snapshot_hash
      || stop.journal(runtime.source.sourceId).some((r, i) => r.sequence !== i + 1)) throw new Error('foul consumption admission differs');
    return { source, producerSource, fieldRevision };
  };
  return { installed, all, identities, claims, metadata };
};
