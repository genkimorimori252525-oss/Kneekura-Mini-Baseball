import { createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { defensiveMetadataId as claim } from './ActualDefensiveMetadata';
import { sqliteJsonMetadataNodes as nodes, type SqliteJsonMetadataPath as Path } from './SqliteOwnershipMetadata';
import type { ActualLivePlayClosureProposal } from './ActualLivePlayClosureEvidenceFromSqlite';

type Db = Pick<DatabaseSync, 'prepare'>;
type Scalar = string | number;
type Mirror = readonly [string, Path];
export type ParticipationReceiptRow = { receipt_id: string; game_id: string; player_id: string; receipt_json: string };
const fail = (message: string): never => { throw new Error(message); };
const installed = (db: Db, table: string) => !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table);
export const participationReceiptId = (gameId: string, playerId: string): string =>
  `official-participation:${createHash('sha256').update(JSON.stringify([gameId, playerId])).digest('hex')}`;

/** Metadata only, with decoded duplicate keys and ancestor containers retained by SQLite. */
export const assertParticipationMetadataNode = (db: Db, document: string, path: Path,
  type: string, value?: Scalar): void => {
  const found = db.prepare(`SELECT type,atom FROM (${nodes('$document', path)})`).all({ document });
  if (found.length !== 1 || found[0].type !== type || value !== undefined && found[0].atom !== value) {
    fail('participation ownership metadata differs');
  }
};
const absent = (db: Db, document: string, path: Path): void => {
  if (db.prepare(`SELECT 1 FROM (${nodes('$document', path)})`).get({ document })) fail('participation ownership metadata differs');
};
export const participationHasRawDiscriminator = (db: Db, document: string): boolean =>
  !!db.prepare(`SELECT 1 FROM (${nodes('$document', ['evidenceKind'])})`).get({ document });
export const assertParticipationV1Fields = (db: Db, document: string): void => {
  assertParticipationMetadataNode(db, document, [], 'object');
  const keys = db.prepare('SELECT key FROM json_each(?) ORDER BY key').all(document).map(row => row.key);
  const expected = ['evidenceKind', 'receiptId', 'binding', 'actorKind', 'closureSourceId', 'closureApplicationId',
    'closureProposalHash', 'playedPlayId', 'durableRevision'].sort();
  if (JSON.stringify(keys) !== JSON.stringify(expected)) fail('invalid ACTUAL_LIVE_V1 receipt fields');
  assertParticipationMetadataNode(db, document, ['evidenceKind'], 'text', 'ACTUAL_LIVE_V1');
  assertParticipationMetadataNode(db, document, ['binding'], 'object');
};
const receiptCandidates = (db: Db, receiptId: string, gameId?: string, playerId?: string) => {
  const scoped = gameId !== undefined && playerId !== undefined;
  return db.prepare(`SELECT * FROM official_participation_receipts WHERE receipt_id=$receipt
    OR ${claim('receipt_json', ['receiptId'], '$receipt')}
    ${scoped ? `OR ((game_id=$game OR ${claim('receipt_json', ['binding', 'gameId'], '$game')})
      AND (player_id=$player OR ${claim('receipt_json', ['binding', 'playerId'], '$player')}))` : ''}`)
    .all({ receipt: receiptId, ...(scoped ? { game: gameId!, player: playerId! } : {}) }) as ParticipationReceiptRow[];
};
/** Public ID reads expand to game/Player ownership after finding their indexed/raw ID owner. */
export const readOwnedParticipationReceiptRow = (db: Db, receiptId: string,
  gameId?: string, playerId?: string): ParticipationReceiptRow | null => {
  let rows = receiptCandidates(db, receiptId, gameId, playerId);
  if (!rows.length) return null;
  if (rows.length !== 1) fail('participation receipt ownership differs');
  const first = rows[0];
  if (gameId === undefined || playerId === undefined) {
    rows = receiptCandidates(db, receiptId, first.game_id, first.player_id);
  }
  if (rows.length !== 1 || first.receipt_id !== receiptId
    || gameId !== undefined && first.game_id !== gameId || playerId !== undefined && first.player_id !== playerId) {
    fail('participation receipt ownership differs');
  }
  assertParticipationMetadataNode(db, first.receipt_json, [], 'object');
  assertParticipationMetadataNode(db, first.receipt_json, ['receiptId'], 'text', receiptId);
  assertParticipationMetadataNode(db, first.receipt_json, ['binding'], 'object');
  assertParticipationMetadataNode(db, first.receipt_json, ['binding', 'gameId'], 'text', first.game_id);
  assertParticipationMetadataNode(db, first.receipt_json, ['binding', 'playerId'], 'text', first.player_id);
  return first;
};
export const readOwnedParticipationBindingJson = (db: Db, gameId: string, playerId: string): string | null => {
  const rows = db.prepare(`SELECT * FROM official_participant_bindings
    WHERE (game_id=$game OR ${claim('binding_json', ['gameId'], '$game')})
      AND (player_id=$player OR ${claim('binding_json', ['playerId'], '$player')})`)
    .all({ game: gameId, player: playerId });
  if (!rows.length) return null;
  if (rows.length !== 1 || rows[0].game_id !== gameId || rows[0].player_id !== playerId) fail('participation binding ownership differs');
  const document = String(rows[0].binding_json);
  assertParticipationMetadataNode(db, document, [], 'object');
  assertParticipationMetadataNode(db, document, ['gameId'], 'text', gameId);
  assertParticipationMetadataNode(db, document, ['playerId'], 'text', playerId);
  return document;
};

const applicationPaths = [['receipt', 'applicationId'], ['activation', 'applicationId'], ['result', 'applicationId']] as const;
const closurePaths = [['receipt', 'closureId'], ['activation', 'closureId'], ['result', 'closureId']] as const;
const gamePaths = [['result', 'gameId'], ['result', 'venueBinding', 'gameId']] as const;
/** A globally owned application OR a game/closure pair in the SAME row; never game/play uniqueness. */
export const assertParticipationApplicationOwnership = (db: Db, p: ActualLivePlayClosureProposal): void => {
  const application = ['application_id=$application', ...applicationPaths.map(path => claim('result_json', path, '$application'))].join(' OR ');
  const game = ['match_id=$game', ...gamePaths.map(path => claim('result_json', path, '$game'))].join(' OR ');
  const closure = ['closure_id=$closure', ...closurePaths.map(path => claim('result_json', path, '$closure'))].join(' OR ');
  const rows = db.prepare(`SELECT * FROM applications WHERE (${application}) OR ((${game}) AND (${closure}))`)
    .all({ application: p.application.applicationId, game: p.gameId, closure: p.source.sourceId });
  if (rows.length !== 1 || rows[0].application_id !== p.application.applicationId
    || rows[0].match_id !== p.gameId || rows[0].closure_id !== p.source.sourceId) fail('actual-live participation application ownership differs');
  const document = String(rows[0].result_json), final = 'result' in p.expectedOfficial;
  assertParticipationMetadataNode(db, document, [], 'object');
  assertParticipationMetadataNode(db, document, ['receipt'], 'object');
  assertParticipationMetadataNode(db, document, ['receipt', 'applicationId'], 'text', p.application.applicationId);
  assertParticipationMetadataNode(db, document, ['receipt', 'closureId'], 'text', p.source.sourceId);
  assertParticipationMetadataNode(db, document, ['receipt', 'previousPlayId'], 'integer', p.playId);
  const branch = final ? 'result' : 'activation';
  assertParticipationMetadataNode(db, document, [branch], 'object');
  absent(db, document, [final ? 'activation' : 'result']);
  assertParticipationMetadataNode(db, document, [branch, 'applicationId'], 'text', p.application.applicationId);
  assertParticipationMetadataNode(db, document, [branch, 'closureId'], 'text', p.source.sourceId);
  assertParticipationMetadataNode(db, document, [branch, final ? 'gameId' : 'previousPlayId'], final ? 'text' : 'integer', final ? p.gameId : p.playId);
  if (final && 'result' in p.expectedOfficial && p.expectedOfficial.result.venueBinding !== undefined) {
    assertParticipationMetadataNode(db, document, ['result', 'venueBinding'], 'object');
    assertParticipationMetadataNode(db, document, ['result', 'venueBinding', 'gameId'], 'text', p.gameId);
  } else absent(db, document, ['result', 'venueBinding']);
};

const sourceMirrors: readonly Mirror[] = [
  ['source_json', ['sourceId']], ['source_json', ['finalScoring', 'closureSourceId']],
  ['proposal_json', ['source', 'sourceId']], ['proposal_json', ['source', 'finalScoring', 'closureSourceId']],
  ['proposal_json', ['application', 'adjudication', 'closure', 'closureId']],
  ['proposal_json', ['controllerReset', 'sourceId']], ['result_json', ['sourceId']], ['result_json', ['controllerReset', 'sourceId']],
  ...closurePaths.map(path => ['proposal_json', ['expectedOfficial', ...path]] as const),
  ...closurePaths.map(path => ['result_json', ['official', ...path]] as const),
];
const closureApplicationMirrors: readonly Mirror[] = [
  ['source_json', ['applicationId']], ['proposal_json', ['source', 'applicationId']], ['proposal_json', ['application', 'applicationId']],
  ...applicationPaths.map(path => ['proposal_json', ['expectedOfficial', ...path]] as const),
  ...applicationPaths.map(path => ['result_json', ['official', ...path]] as const),
];
const closureGameMirrors: readonly Mirror[] = [
  ['source_json', ['finalScoring', 'gameId']], ['source_json', ['finalScoring', 'venueBinding', 'gameId']],
  ['proposal_json', ['gameId']], ['proposal_json', ['source', 'finalScoring', 'gameId']],
  ['proposal_json', ['source', 'finalScoring', 'venueBinding', 'gameId']], ['proposal_json', ['application', 'matchId']],
  ['proposal_json', ['application', 'game', 'venueBinding', 'gameId']], ['proposal_json', ['fixture', 'game_id']],
  ['proposal_json', ['seasonFixture', 'game', 'gameId']],
  ...gamePaths.map(path => ['proposal_json', ['expectedOfficial', ...path]] as const),
  ...gamePaths.map(path => ['result_json', ['official', ...path]] as const),
];
const closurePlayMirrors: readonly Mirror[] = [
  ['source_json', ['finalScoring', 'playId']], ['proposal_json', ['playId']], ['proposal_json', ['source', 'finalScoring', 'playId']],
  ['proposal_json', ['application', 'match', 'playId']], ['proposal_json', ['controllerReset', 'previousPlayId']],
  ['result_json', ['controllerReset', 'previousPlayId']],
  ...['receipt', 'activation'].flatMap(branch => [
    ['proposal_json', ['expectedOfficial', branch, 'previousPlayId']], ['result_json', ['official', branch, 'previousPlayId']],
  ] as const),
];
/** Existing closure readers cover Source/application claims; this adds the remaining relevant raw mirrors. */
export const assertParticipationClosureOwnership = (db: Db, p: ActualLivePlayClosureProposal): void => {
  const claims = (mirrors: readonly Mirror[], parameter: string) => mirrors.map(([column, path]) => claim(column, path, parameter));
  const source = ['source_id=$source', ...claims(sourceMirrors, '$source')].join(' OR ');
  const application = ['application_id=$application', ...claims(closureApplicationMirrors, '$application')].join(' OR ');
  const game = ['game_id=$game', ...claims(closureGameMirrors, '$game')].join(' OR ');
  const play = ['play_id=$play', ...closurePlayMirrors.map(([column, path]) =>
    `EXISTS(SELECT 1 FROM (${nodes(column, path)}) p WHERE p.atom=$play OR (p.type='text' AND p.atom=CAST($play AS TEXT)))`)].join(' OR ');
  const rows = db.prepare(`SELECT * FROM actual_live_play_closures WHERE (${source}) OR (${application}) OR ((${game}) AND (${play}))`)
    .all({ source: p.source.sourceId, application: p.application.applicationId, game: p.gameId, play: p.playId });
  if (rows.length !== 1 || rows[0].source_id !== p.source.sourceId || rows[0].application_id !== p.application.applicationId
    || rows[0].game_id !== p.gameId || rows[0].play_id !== p.playId) fail('actual-live participation closure ownership differs');
  // Whole selected-row source/proposal/result canonical bytes are rederived by the original closure owner.
  // Validate each present schema-backed mirror too, retaining duplicates and their true types.
  for (const [mirrors, type, value] of [[sourceMirrors, 'text', p.source.sourceId],
    [closureApplicationMirrors, 'text', p.application.applicationId], [closureGameMirrors, 'text', p.gameId],
    [closurePlayMirrors, 'integer', p.playId]] as const) {
    for (const [column, path] of mirrors) {
      const document = String(rows[0][column]);
      if (db.prepare(`SELECT 1 FROM (${nodes('$document', path)})`).get({ document })) {
        assertParticipationMetadataNode(db, document, path, type, value);
      }
    }
  }
};

/** A relevant tournament registration is outside the initial Club-season-only V1 contract. */
export const assertParticipationDomesticSeason = (db: Db, careerId: string, editionId: string): void => {
  const tables = [
    ['world_national_competition_editions', ['editionId'], [['edition', 'editionId'], ['knockoutEdition', 'editionId']], true],
    ['world_regional_national_editions', ['editionId'], [['edition', 'editionId'], ['knockoutEdition', 'editionId']], true],
    ['world_wbc_qualifier_editions', ['qualifierEditionId'], [['edition', 'editionId']], true],
    ['world_competition_editions', ['input', 'editionId'], [['editionId']], false],
  ] as const;
  for (const [table, requestPath, snapshotPaths, requestCareer] of tables) {
    if (!installed(db, table)) continue;
    const career = ['career_id=$career', ...(requestCareer ? [claim('request_json', ['careerId'], '$career')] : [])].join(' OR ');
    const edition = ['edition_id=$edition', claim('request_json', requestPath, '$edition'),
      ...snapshotPaths.map(path => claim('snapshot_json', path, '$edition'))].join(' OR ');
    if (db.prepare(`SELECT 1 FROM ${table} WHERE (${career}) AND (${edition})`).get({ career: careerId, edition: editionId })) {
      fail('actual-live participation requires domestic season ownership');
    }
  }
};
