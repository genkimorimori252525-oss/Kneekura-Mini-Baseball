import { expect, it } from 'vitest';
import { SqliteOfficialParticipationStore } from './SqliteOfficialParticipationStore';
import { isSupportedParticipationKind } from './TaggedParticipationEvidenceFromSqlite';
import { officialPitchWorkloadFixture } from './OfficialPitchWorkloadFixtures.test-support';
import { nationalCallupFixture } from './NationalCallupFixtures.test-support';
import { openSqliteNationalCallupStore } from './SqliteNationalCallupStore';

it.each(['NATIONAL_ACTUAL_LIVE_V1', 'NATIONAL_FOUL_TERMINAL_V1'])('recognizes the separate original National format %s', kind => {
  expect(isSupportedParticipationKind(kind)).toBe(true);
  expect(isSupportedParticipationKind(kind.replace('_V1', '_V2'))).toBe(false);
});

it('does not reinterpret an existing legacy game/Player receipt as either National format', () => {
  const f = officialPitchWorkloadFixture(false);
  try {
    const legacy = f.participation.confirmPlayed('game-1', 'p2', 'DEFENDER', 'application-1', 'application-2');
    const before = f.db.prepare('SELECT * FROM official_participation_receipts').all();
    const reopened = f.track(new SqliteOfficialParticipationStore(f.path));
    expect(() => reopened.confirmNationalActualLivePlayed('game-1', 'p2', 'close')).toThrow('recorded differently');
    expect(() => reopened.confirmNationalFoulTerminalPlayed('game-1', 'p2', 'close')).toThrow('recorded differently');
    expect(reopened.readReceipt(legacy.receiptId)).toEqual(legacy);
    expect(f.db.prepare('SELECT * FROM official_participation_receipts').all()).toEqual(before);
  } finally { f.close(); }
});

it.each(['NATIONAL_ACTUAL_LIVE_V1', 'NATIONAL_FOUL_TERMINAL_V1'])('requires private original proof rather than a peer National tag: %s', evidenceKind => {
  const f = nationalCallupFixture(); let reads = 0;
  const callups = openSqliteNationalCallupStore(f.path, { ...f.sources,
    participation: { readReceipt: () => ({ evidenceKind } as never) },
    games: { readGame() { reads++; throw new Error('peer fixture must not establish original proof'); } },
  });
  try {
    expect(() => callups.adoptAppearance({ careerId: 'career-a', eventId: 'reject', receiptId: 'missing', acceptedAtDay: 426 }))
      .toThrow('Native original receipt is missing');
    expect(reads).toBe(0);
    expect(callups.readRepresentation('career-a', 'p0', 426)).toEqual([]);
  } finally { callups.close(); f.close(); }
});
