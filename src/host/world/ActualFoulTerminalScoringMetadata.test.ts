import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import type { DatabaseSync as Database, SQLOutputValue } from 'node:sqlite';
import { expect, it } from 'vitest';

type Scope = Readonly<{ terminalSourceId: string; applicationId?: string; matchId?: string; playId?: number }>;
type Claims = (db: Database, scope: Scope) => Record<string, SQLOutputValue>[];
const sourceId = 'metadata-terminal', applicationId = 'metadata-application';
const scoringId = JSON.stringify(['actual_foul_terminal_scoring_v1', sourceId]);
const scope = { terminalSourceId: sourceId, applicationId, matchId: 'metadata-game', playId: 7 };
const requireClaims = async (): Promise<Claims> => {
  const moduleId = './ActualFoulTerminalScoringEvidenceFromSqlite';
  const loaded: { foulTerminalScoringClaimRows?: Claims } = existsSync(new URL(moduleId + '.ts', import.meta.url))
    ? await import(/* @vite-ignore */ moduleId) : {};
  expect(typeof loaded.foulTerminalScoringClaimRows, 'TERMINAL_SCORING_RAW_CLAIM_DISCOVERY_MISSING').toBe('function');
  return loaded.foulTerminalScoringClaimRows!;
};
/** Deliberately invalid metadata, never genuine P/C/E or a second origin. */
const fixture = () => {
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE official_scoring_applications(
    scoring_application_id TEXT PRIMARY KEY, match_id TEXT NOT NULL, official_application_id TEXT NOT NULL,
    closure_id TEXT NOT NULL, source_event_id TEXT NOT NULL UNIQUE, request_json TEXT NOT NULL, result_json TEXT NOT NULL,
    UNIQUE(match_id,closure_id))`);
  const insert = (key: string, request = '{}', result = '{}', patch: Partial<Record<string, string>> = {}) => {
    const row = { scoring_application_id: key, match_id: key + '-game', official_application_id: key + '-application',
      closure_id: key + '-closure', source_event_id: key + '-event', request_json: request, result_json: result, ...patch };
    db.prepare('INSERT INTO official_scoring_applications VALUES(?,?,?,?,?,?,?)').run(row.scoring_application_id,
      row.match_id, row.official_application_id, row.closure_id, row.source_event_id, row.request_json, row.result_json);
    return row;
  };
  return { db, insert };
};
const origin = JSON.stringify({ owner: 'actual_foul_terminal_applications', sourceId });
const rawOrigins = [
  '{"input":{"officialApplication":{"origin":' + origin + '}}}',
  '{"input":{"officialApplication":{"origin":{"owner":"actual_foul_terminal_applications","sourceId":"metadata-terminal","sourceId":"foreign"}}}}',
  '{"input":{"officialApplication":{"origin":{"owner":"actual_foul_terminal_applications","source\\u0049d":"metadata-terminal"}}}}',
  '[{"input":[[{"officialApplication":[{"origin":[' + origin + ']}]}]]}]',
];

for (const [index, request] of rawOrigins.entries()) it('M01 raw origin encoding ' + ['plain', 'overwritten duplicate key', 'escaped key', 'nested ancestor arrays'][index], async () => {
  const f = fixture();
  try {
    const row = f.insert('foreign', request), claims = await requireClaims();
    expect(claims(f.db, { terminalSourceId: sourceId })).toEqual([row]);
  } finally { f.db.close(); }
});

for (const [label, request, result] of [
  ['request scoring ID', JSON.stringify({ input: { scoringApplicationId: scoringId } }), '{}'],
  ['result scoring ID', '{}', JSON.stringify({ scoringApplicationId: scoringId })],
  ['embedded scoring ID with nested whitespace', '{}', JSON.stringify({ scoringApplicationId: '[ "actual_foul_terminal_scoring_v1", "metadata-terminal" ]' })],
  ['non-live event ID', '{}', JSON.stringify({ sourceEventId: 'official-non-live:' + applicationId })],
  ['non-live timeline scope', JSON.stringify({ input: { officialApplication: { matchId: scope.matchId, timeline: { playId: scope.playId } } } }), '{}'],
  ['record scope', '{}', JSON.stringify({ matchId: scope.matchId, record: { playId: scope.playId } })],
] as const) it('M02 discovers sole raw terminal scoring linkage ' + label, async () => {
  const f = fixture();
  try { const row = f.insert('foreign', request, result), claims = await requireClaims(); expect(claims(f.db, scope)).toEqual([row]); }
  finally { f.db.close(); }
});

it('M03 follows transitive original-application aliases without parsing successful evidence', async () => {
  const f = fixture();
  try {
    const first = f.insert('alias-a', JSON.stringify({ input: { officialApplication: {
      origin: { owner: 'actual_foul_terminal_applications', sourceId }, applicationId: 'linked-only-application' } } }));
    const second = f.insert('alias-b', '{}', JSON.stringify({ officialApplicationId: 'linked-only-application' }));
    const claims = await requireClaims();
    expect(claims(f.db, { terminalSourceId: sourceId })).toEqual([first, second]);
  } finally { f.db.close(); }
});

it('M04 excludes unrelated earlier play and mismatched reference owner-source pairs', async () => {
  const f = fixture();
  try {
    f.insert('earlier', '{}', JSON.stringify({ matchId: scope.matchId, record: { playId: scope.playId - 1 } }));
    f.insert('cross-paired', JSON.stringify({ input: { officialApplication: { origin: [
      { owner: 'actual_foul_terminal_applications', sourceId: 'other-terminal' }, { owner: 'other-owner', sourceId },
    ] } } }));
    f.insert('wrong-domain', '{}', JSON.stringify({ scoringApplicationId: JSON.stringify(['other_scoring_v1', sourceId]) }));
    // This suffix belongs to the original application-ID domain, never the
    // terminal Source-ID domain, even when the text resembles another key.
    f.insert('wrong-event-domain', '{}', JSON.stringify({ sourceEventId: 'official-non-live:' + sourceId }));
    const claims = await requireClaims(); expect(claims(f.db, scope)).toEqual([]);
  } finally { f.db.close(); }
});

for (const direction of ['source-to-closure','closure-to-source'] as const) {
  it('M06 follows terminal Source and closure aliases ' + direction, async () => {
    const f = fixture();
    try {
      const origin = { input: { officialApplication: { origin: {
        owner: 'actual_foul_terminal_applications', sourceId: 'linked-terminal-alias' } } } };
      const first = direction === 'source-to-closure'
        ? f.insert(scoringId, JSON.stringify(origin))
        : f.insert(scoringId, '{}', '{}', { closure_id:'linked-terminal-alias' });
      const second = direction === 'source-to-closure'
        ? f.insert('foreign', '{}', '{}', { closure_id:'linked-terminal-alias' })
        : f.insert('foreign', JSON.stringify(origin));
      const claims = await requireClaims();
      expect(claims(f.db,{ terminalSourceId:sourceId })).toHaveLength(2);
      expect(claims(f.db,{ terminalSourceId:sourceId })).toEqual(expect.arrayContaining([first,second]));
    } finally { f.db.close(); }
  });
}

it('M05 retains a cached canonical scoring identity even when both JSON archives are malformed', async () => {
  const f = fixture();
  try {
    const row = f.insert(scoringId, '{', ']'), claims = await requireClaims();
    expect(claims(f.db, { terminalSourceId: sourceId })).toEqual([row]);
  } finally { f.db.close(); }
});
