import { expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { officialPitchWorkloadFixture } from './OfficialPitchWorkloadFixtures.test-support';
import { assertParticipationApplicationOwnership, assertParticipationDomesticSeason,
  readOwnedParticipationReceiptRow, readOwnedParticipationBindingJson } from './ActualLiveParticipationMetadata';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
type Proposal = Parameters<typeof assertParticipationApplicationOwnership>[1];
/** Metadata predicates only: these genuine legacy owner outputs are not actual-live closure provenance. */
const applicationFixture = () => {
  const f = officialPitchWorkloadFixture(false, true);
  const first = f.official.applyAndActivate(f.firstInput);
  const proposal = { application: f.firstInput, gameId: 'game-1', source: { sourceId: 'application-1' },
    playId: 7, expectedOfficial: first } as unknown as Proposal;
  return { f, proposal };
};
const foreign = (f: ReturnType<typeof applicationFixture>['f'], document: string) => {
  f.db.prepare('INSERT INTO applications VALUES (?, ?, ?, ?, ?)').run('foreign-app', 'foreign-game', 'foreign-closure', 'negative-only', document);
};

it('allows a genuine different application of the same game and does not discover by previousPlayId', () => {
  const { f, proposal } = applicationFixture();
  try {
    f.play(); // Adds a second application through the real existing official owner.
    expect(() => assertParticipationApplicationOwnership(f.db, proposal)).not.toThrow();
    foreign(f, JSON.stringify({ receipt: { applicationId: 'foreign-app', closureId: 'foreign-closure', previousPlayId: 7 } }));
    expect(() => assertParticipationApplicationOwnership(f.db, proposal)).not.toThrow();
  } finally { f.close(); }
});

it.each(['receipt', 'activation', 'result'])('discovers a foreign raw application alias in %s', branch => {
  const { f, proposal } = applicationFixture();
  try {
    foreign(f, JSON.stringify({ [branch]: { applicationId: 'application-1' } }));
    expect(() => assertParticipationApplicationOwnership(f.db, proposal)).toThrow('application ownership differs');
  } finally { f.close(); }
});

const closureBranches = ['sql', 'receipt', 'activation', 'result'] as const;
const gameBranches = ['sql', 'result', 'venueBinding'] as const;
it.each(closureBranches.flatMap(closure => gameBranches.map(game => [closure, game] as const))
  .filter(([closure, game]) => closure !== 'sql' || game !== 'sql'))(
  'pairs closure %s and game %s inside the same foreign row without an application alias', (closure, game) => {
    const { f, proposal } = applicationFixture();
    try {
      const raw: Record<string, Record<string, unknown>> = { receipt: { applicationId: 'foreign-app' }, activation: {}, result: {} };
      if (closure !== 'sql') raw[closure].closureId = 'application-1';
      if (game === 'result') raw.result.gameId = 'game-1';
      if (game === 'venueBinding') raw.result.venueBinding = { gameId: 'game-1' };
      f.db.prepare('INSERT INTO applications VALUES (?, ?, ?, ?, ?)').run('foreign-app', game === 'sql' ? 'game-1' : 'foreign-game',
        closure === 'sql' ? 'application-1' : 'foreign-closure', 'negative-only', JSON.stringify(raw));
      expect(() => assertParticipationApplicationOwnership(f.db, proposal)).toThrow('application ownership differs');
    } finally { f.close(); }
  },
);

it.each([
  '{"receipt":{"applicationId":"application-1"},"receipt":{"applicationId":"foreign-app"}}',
  '{"receipt":{"applicationId":"foreign-app"},"receipt":{"applicationId":"application-1"}}',
  '{"receipt":{"applicationId":"foreign-app","application\\u0049d":"application-1"}}',
  '{"result":{"venueBinding":{"gameId":"game-1"},"venueBinding":{"gameId":"foreign-game"},"closureId":"application-1"}}',
])('discovers duplicate and escaped alias metadata without last-key-wins parsing: %s', document => {
  const { f, proposal } = applicationFixture();
  try { foreign(f, document); expect(() => assertParticipationApplicationOwnership(f.db, proposal)).toThrow('application ownership differs'); }
  finally { f.close(); }
});

it.each(['null', '[]', '"encoded-object"', '{"applicationId":7}', '{"applicationId":"application-1","applicationId":"application-1"}'])(
  'rejects selected application receipt metadata %s', receipt => {
    const { f, proposal } = applicationFixture();
    try {
      const saved = JSON.parse(String(f.db.prepare('SELECT result_json FROM applications WHERE application_id=?').get('application-1')!.result_json));
      delete saved.receipt;
      f.db.prepare('UPDATE applications SET result_json=? WHERE application_id=?').run(`{"receipt":${receipt},${JSON.stringify(saved).slice(1)}`, 'application-1');
      expect(() => assertParticipationApplicationOwnership(f.db, proposal)).toThrow('ownership metadata differs');
    } finally { f.close(); }
  },
);

it('does not combine a foreign row game claim with a different row closure claim', () => {
  const { f, proposal } = applicationFixture();
  try {
    f.db.prepare('INSERT INTO applications VALUES (?, ?, ?, ?, ?)').run('foreign-a', 'game-1', 'foreign-a', 'negative-only', '{}');
    f.db.prepare('INSERT INTO applications VALUES (?, ?, ?, ?, ?)').run('foreign-b', 'foreign-game', 'application-1', 'negative-only', '{}');
    expect(() => assertParticipationApplicationOwnership(f.db, proposal)).not.toThrow();
  } finally { f.close(); }
});

it('ignores malformed wholly unrelated application JSON', () => {
  const { f, proposal } = applicationFixture();
  try { foreign(f, '{unrelated future format'); expect(() => assertParticipationApplicationOwnership(f.db, proposal)).not.toThrow(); }
  finally { f.close(); }
});

it('discovers receipt and binding aliases hidden behind different SQL scope', () => {
  const f = officialPitchWorkloadFixture(false);
  try {
    const receipt = f.participation.confirmPlayed('game-1', 'p2', 'DEFENDER', 'application-1', 'application-2');
    expect(readOwnedParticipationReceiptRow(f.db, receipt.receiptId)?.receipt_id).toBe(receipt.receiptId);
    f.db.prepare('INSERT INTO official_participant_bindings VALUES (?, ?, ?)').run('foreign-game', 'foreign-player', JSON.stringify(receipt.binding));
    expect(() => readOwnedParticipationBindingJson(f.db, 'game-1', 'p2')).toThrow('binding ownership differs');
    f.db.prepare('INSERT INTO official_participation_receipts VALUES (?, ?, ?, ?)').run('foreign-receipt', 'foreign-game', 'foreign-player', JSON.stringify(receipt));
    expect(() => readOwnedParticipationReceiptRow(f.db, receipt.receiptId)).toThrow('receipt ownership differs');
  } finally { f.close(); }
});

it.each([
  ['world_national_competition_editions', 'editionId'], ['world_regional_national_editions', 'editionId'],
  ['world_wbc_qualifier_editions', 'qualifierEditionId'], ['world_competition_editions', 'input'],
] as const)('excludes relevant registered tournament ownership from Club-season V1: %s', (table, requestKey) => {
  const db = new DatabaseSync(':memory:');
  try {
    expect(() => assertParticipationDomesticSeason(db, 'career-a', 'league-season-1')).not.toThrow();
    db.exec(`CREATE TABLE ${table}(career_id TEXT, edition_id TEXT, request_json TEXT, snapshot_json TEXT)`);
    const generic = requestKey === 'input';
    const request = generic ? { input: { editionId: 'league-season-1' } } : { careerId: 'career-a', [requestKey]: 'league-season-1' };
    db.prepare(`INSERT INTO ${table} VALUES(?,?,?,?)`).run(generic ? 'career-a' : 'foreign-career', 'foreign-edition', JSON.stringify(request), '{}');
    expect(() => assertParticipationDomesticSeason(db, 'career-a', 'league-season-1')).toThrow('domestic season ownership');
    expect(() => assertParticipationDomesticSeason(db, 'unrelated-career', 'league-season-1')).not.toThrow();
  } finally { db.close(); }
});
