import { sqliteMetadataGet } from './SqliteMetadataStatementScope';
import { sqliteJsonMetadataNodes as nodes, sqliteJsonMetadataProjection as projection, type SqliteJsonMetadataPath } from './SqliteOwnershipMetadata';
import type { DefensiveDb } from './ActualDefensiveContext';

/** Caller-owned schema paths/SQL only; identity values remain bound parameters or indexed column references. */
export const defensiveMetadataId = (document: string, path: SqliteJsonMetadataPath, identity = '?') =>
  `EXISTS (SELECT 1 FROM (${nodes(document, path)}) defensive_id_node WHERE defensive_id_node.type='text' AND defensive_id_node.atom=${identity})`;
export const defensiveMetadataScope = (document: string, path: SqliteJsonMetadataPath = []) =>
  `EXISTS (SELECT 1 FROM (${nodes(document, path)}) defensive_scope_node WHERE defensive_scope_node.type='object'
    AND ${defensiveMetadataId('defensive_scope_node.value', ['physicalPitchSourceId'])}
    AND ${defensiveMetadataId('defensive_scope_node.value', ['playerId'])})`;

type Kind = 'plan' | 'decision' | 'observation';
const sourceKeys = {
  plan: ['sourceId', 'sourceVersion', 'provenance', 'physicalPitchSourceId', 'careerId', 'playerId', 'personLinkSourceId',
    'fieldingModelSourceId', 'gameDay', 'observationSourceId'],
  decision: ['sourceId', 'sourceVersion', 'physicalPitchSourceId', 'playerId', 'observationSourceId', 'decisionModelSourceId', 'planSourceId', 'previousDecisionSourceId'],
  observation: ['sourceId', 'sourceVersion', 'physicalPitchSourceId', 'playerId', 'baseFieldSourceId', 'executionSourceId', 'observationModelSourceId', 'previousObservationSourceId'],
} satisfies Record<Kind, readonly string[]>;
type Rule = readonly [SqliteJsonMetadataPath, readonly string[]];
const ambiguous = (document: string, [path, keys]: Rule) =>
  `EXISTS (SELECT 1 FROM (${nodes(document, path)}) metadata_container WHERE metadata_container.type='object'
    AND EXISTS (SELECT 1 FROM json_each(${projection('metadata_container.value', keys)}) metadata_tuple
      GROUP BY json_extract(metadata_tuple.value,'$[0]') HAVING count(*)>1))`;

/** Reject duplicate ownership keys/containers only in already relevant rows. The SQL projection contains
 * metadata scalar tuples only: no future candidate, timing, view or receipt domain payload is parsed in JS.
 * Required metadata containers retain their actual JSON types; string-encoded objects are never reinterpreted.
 * Each original owner still validates exact scalar identities, index mirrors and bounded domain payloads.
 */
export const assertDefensiveMetadataUnambiguous = (db: DefensiveDb, kind: Kind, sourceJson: string, snapshotJson: string): void => {
  const snapshot: Rule[] = [[[], kind === 'plan' ? ['source', 'binding'] : kind === 'decision' ? ['source', 'history', 'revision', 'receipt']
    : ['source', 'history', 'revision']], [['source'], sourceKeys[kind]]];
  if (kind === 'plan') snapshot.push([['binding'], ['playerId']]);
  else snapshot.push([['history', { array: 'all' }], sourceKeys[kind]]);
  if (kind === 'decision') snapshot.push([['receipt'], ['self', 'originObservationSourceId', 'originDecisionSourceId']], [['receipt', 'self'], ['playerId']]);
  const shape = (document: string, path: SqliteJsonMetadataPath, type: string) =>
    `(SELECT count(*)!=1 OR sum(metadata_shape.type='${type}')!=1 FROM (${nodes(document, path)}) metadata_shape)`;
  const required: readonly (readonly [SqliteJsonMetadataPath, string])[] = kind === 'plan'
    ? [[[], 'object'], [['source'], 'object'], [['binding'], 'object']]
    : [[[], 'object'], [['source'], 'object'], [['history'], 'array'], [['revision'], 'integer'],
      ...(kind === 'decision' ? [[['receipt'], 'object'], [['receipt', 'self'], 'object']] as const : [])];
  for (const [document, rules, shapes, isSnapshot] of [[sourceJson, [[[], sourceKeys[kind]]] as Rule[], [[[], 'object']] as const, false],
    [snapshotJson, snapshot, required, true]] as const) {
    const expressions = [...rules.map(rule => ambiguous('ownership_document.document', rule)),
      ...shapes.map(([path, type]) => shape('ownership_document.document', path, type))];
    if (isSnapshot && kind !== 'plan') expressions.push(`EXISTS (SELECT 1 FROM
      (${nodes('ownership_document.document', ['history', { array: 'all' }])}) history_entry WHERE history_entry.type!='object')`);
    const row = sqliteMetadataGet(db, `WITH ownership_document(document) AS (VALUES(?))
      SELECT CASE WHEN json_valid(document) THEN (${expressions.join(' OR ')}) ELSE 0 END AS ambiguous FROM ownership_document`, document)!;
    if (row.ambiguous) throw new Error('ambiguous or mistyped actual defensive ownership metadata');
  }
};
