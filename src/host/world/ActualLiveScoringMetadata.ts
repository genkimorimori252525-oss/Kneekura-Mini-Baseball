import type { ActualAdjudicationDb } from './ActualLiveAdjudicationFromSqlite';
import { sqliteJsonMetadataNodes as nodes, type SqliteJsonMetadataPath } from './SqliteOwnershipMetadata';

/** Only caller-owned schema paths occur in SQL; identity values stay bound. Raw
 * duplicate/escaped keys are enumerated before JSON.parse can discard a claim. */
type Mirror = readonly [column: string, path: SqliteJsonMetadataPath];
type Claim = Readonly<{ column: string; value: string | number; mirrors: readonly Mirror[] }>;
const scalarClaim = (document: string, path: SqliteJsonMetadataPath, parameter: string) =>
  `EXISTS(SELECT 1 FROM (${nodes(document, path)}) m WHERE m.atom=${parameter} AND m.type IN ('text','integer'))`;

export const scoringOwnershipRows = (db: ActualAdjudicationDb, table: string, claims: readonly (readonly Claim[])[]) => {
  const bindings: Record<string, string | number> = {};
  let index = 0;
  const predicate = claims.map(group => `(${group.map(claim => {
    const key = `identity${index++}`; bindings[key] = claim.value;
    return `(${claim.column}=$${key} OR ${claim.mirrors.map(([column, path]) => scalarClaim(column, path, `$${key}`)).join(' OR ') || '0'})`;
  }).join(' AND ')})`).join(' OR ');
  return db.prepare(`SELECT * FROM ${table} WHERE ${predicate}`).all(bindings);
};
const sourceMirrors: readonly Mirror[] = [
  ['source_json', ['sourceId']], ['source_json', ['evidence', 'sourceEventId']],
  ['proposal_json', ['source', 'sourceId']], ['proposal_json', ['source', 'evidence', 'sourceEventId']],
  ['proposal_json', ['expectedScoring', 'sourceEventId']], ['result_json', ['sourceEventId']],
];
export const actualScoringIdentityRow = (db: ActualAdjudicationDb, sourceId: string) => {
  const rows = scoringOwnershipRows(db, 'actual_live_scoring_sources', [[{ column: 'source_id', value: sourceId, mirrors: sourceMirrors }]]);
  if (rows.length > 1 || rows.length === 1 && rows[0].source_id !== sourceId) throw new Error('actual scoring Source identity ownership differs');
  const row = rows[0]; if (!row) return null;
  for (const [column, path] of sourceMirrors) {
    if (column === 'result_json' && row.result_json === null) continue;
    const metadata = db.prepare(`SELECT count(*) AS n,sum(m.type='text' AND m.atom=$id) AS matched FROM (${nodes('$document', path)}) m`)
      .get({ document: String(row[column]), id: sourceId });
    if (!metadata || metadata.n !== 1 || metadata.matched !== 1) throw new Error('actual scoring Source identity mirror differs');
  }
  return row;
};
export const assertActualScoringOwnership = (db: ActualAdjudicationDb, value: Readonly<{
  source: { sourceId: string; gameId: string; scoringApplicationId: string; closureReference: { sourceId: string } };
  playId: number; application: { applicationId: string };
}>, required: boolean) => {
  const s = value.source;
  const sourceClaim: Claim = { column: 'source_id', value: s.sourceId, mirrors: sourceMirrors };
  const scoringClaim: Claim = { column: 'scoring_application_id', value: s.scoringApplicationId, mirrors: [
    ['source_json', ['scoringApplicationId']], ['proposal_json', ['source', 'scoringApplicationId']],
    ['proposal_json', ['expectedScoring', 'scoringApplicationId']], ['result_json', ['scoringApplicationId']],
  ] };
  const closureClaim: Claim = { column: 'closure_id', value: s.closureReference.sourceId, mirrors: [
    ['source_json', ['closureReference', 'sourceId']], ['source_json', ['evidence', 'closureId']],
    ['proposal_json', ['source', 'closureReference', 'sourceId']], ['proposal_json', ['source', 'evidence', 'closureId']],
    ['proposal_json', ['closureReference', 'sourceId']], ['proposal_json', ['expectedScoring', 'closureId']],
    ['proposal_json', ['expectedScoring', 'record', 'closureId']],
    ['proposal_json', ['application', 'adjudication', 'events', { array: 'all' }, 'closureId']],
    ['proposal_json', ['originalReceipt', 'receipt', 'closureId']],
    ['proposal_json', ['originalReceipt', 'activation', 'closureId']], ['proposal_json', ['originalReceipt', 'result', 'closureId']],
    ['result_json', ['closureId']], ['result_json', ['record', 'closureId']],
  ] };
  const officialClaim: Claim = { column: 'official_application_id', value: value.application.applicationId, mirrors: [
    ['proposal_json', ['application', 'applicationId']], ['proposal_json', ['originalReceipt', 'receipt', 'applicationId']],
    ['proposal_json', ['originalReceipt', 'activation', 'applicationId']], ['proposal_json', ['originalReceipt', 'result', 'applicationId']],
    ['proposal_json', ['expectedScoring', 'officialApplicationId']], ['result_json', ['officialApplicationId']],
  ] };
  const gameClaim: Claim = { column: 'game_id', value: s.gameId, mirrors: [
    ['source_json', ['gameId']], ['proposal_json', ['source', 'gameId']], ['proposal_json', ['gameId']],
    ['proposal_json', ['application', 'matchId']], ['proposal_json', ['application', 'game', 'venueBinding', 'gameId']],
    ['proposal_json', ['originalReceipt', 'result', 'gameId']], ['proposal_json', ['originalReceipt', 'result', 'venueBinding', 'gameId']],
    ['proposal_json', ['expectedScoring', 'matchId']], ['result_json', ['matchId']],
  ] };
  const playClaim: Claim = { column: 'play_id', value: value.playId, mirrors: [
    ['source_json', ['evidence', 'playId']], ['proposal_json', ['source', 'evidence', 'playId']], ['proposal_json', ['playId']],
    ['proposal_json', ['application', 'match', 'playId']], ['proposal_json', ['application', 'adjudication', 'playId']],
    ['proposal_json', ['application', 'physicalTimeline', 'playId']],
    ['proposal_json', ['originalReceipt', 'receipt', 'previousPlayId']], ['proposal_json', ['originalReceipt', 'activation', 'previousPlayId']],
    ['proposal_json', ['expectedScoring', 'record', 'playId']], ['result_json', ['record', 'playId']],
  ] };
  const rows = scoringOwnershipRows(db, 'actual_live_scoring_sources', [[sourceClaim], [scoringClaim], [closureClaim], [officialClaim], [gameClaim, playClaim]]);
  if (rows.length !== (required ? 1 : 0) || required && rows[0].source_id !== s.sourceId) {
    throw new Error('actual scoring closure/application/play identity ownership differs');
  }
};
