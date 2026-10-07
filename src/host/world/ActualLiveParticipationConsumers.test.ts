import { expect, it } from 'vitest';
import { SqliteOfficialParticipationStore, type OfficialParticipationReceipt,
  type ParticipationAuthority } from './SqliteOfficialParticipationStore';
import { officialPitchWorkloadFixture } from './OfficialPitchWorkloadFixtures.test-support';
import { nationalCallupFixture } from './NationalCallupFixtures.test-support';
import { openSqliteNationalCallupStore } from './SqliteNationalCallupStore';
import { healthRehabStoreFixture } from './HealthRehabFixtures.test-support';
import { openSqlitePlayerHealthRehabStore } from './SqlitePlayerHealthRehabStore';

const tags = ['ACTUAL_LIVE_V1', 'ACTUAL_LIVE', 'ACTUAL_LIVE_V2', null, false, 0] as const;

it('preserves genuine legacy bytes and reads them without a live participation authority', () => {
  const f = officialPitchWorkloadFixture(false), reopened = new SqliteOfficialParticipationStore(f.path);
  try {
    const receipt = f.participation.confirmPlayed('game-1', 'p2', 'DEFENDER', 'application-1', 'application-2');
    const before = f.db.prepare('SELECT * FROM official_participation_receipts').all();
    expect(reopened.readReceipt(receipt.receiptId)).toEqual(receipt);
    expect(reopened.readAcceptedPopularityEvent(receipt.receiptId)).toEqual(f.participation.readAcceptedPopularityEvent(receipt.receiptId));
    expect(reopened.confirmPlayed('game-1', 'p2', 'DEFENDER', 'application-1', 'application-2')).toEqual(receipt);
    expect(f.db.prepare('SELECT * FROM official_participation_receipts').all()).toEqual(before);
    expect(() => reopened.bindPregame(receipt.binding)).toThrow('requires an accepted source authority');
    expect(() => reopened.readPregameBinding('game-1', 'p2')).toThrow('requires an accepted source authority');
  } finally { reopened.close(); f.close(); }
});

it.each([null, {}, { readGame() { return null; } }])('rejects malformed supplied participation authority case %#: %j', authority => {
  expect(() => new SqliteOfficialParticipationStore(':memory:', authority as unknown as ParticipationAuthority)).toThrow('requires an accepted source authority');
});

it.each(tags)('dispatches a present legacy-shaped tag without fallback: %j', evidenceKind => {
  const f = officialPitchWorkloadFixture(false);
  try {
    const receipt = f.participation.confirmPlayed('game-1', 'p2', 'DEFENDER', 'application-1', 'application-2');
    const original = f.db.prepare('SELECT receipt_json FROM official_participation_receipts WHERE receipt_id=?').get(receipt.receiptId)!;
    const corrupt = JSON.stringify({ ...receipt, evidenceKind });
    f.db.prepare('UPDATE official_participation_receipts SET receipt_json=? WHERE receipt_id=?').run(corrupt, receipt.receiptId);
    expect(() => f.participation.readReceipt(receipt.receiptId)).toThrow();
    expect(() => f.participation.readAcceptedPopularityEvent(receipt.receiptId)).toThrow();
    expect(f.db.prepare('SELECT receipt_json FROM official_participation_receipts WHERE receipt_id=?').get(receipt.receiptId)!.receipt_json).toBe(corrupt);
    f.db.prepare('UPDATE official_participation_receipts SET receipt_json=? WHERE receipt_id=?').run(original.receipt_json, receipt.receiptId);
    expect(f.participation.readReceipt(receipt.receiptId)).toEqual(receipt);
  } finally { f.close(); }
});

it.each([...tags, undefined])('National rejects any public discriminator before its legacy scope reader: %j', evidenceKind => {
  const f = nationalCallupFixture();
  let gameReads = 0;
  const callups = openSqliteNationalCallupStore(f.path, { ...f.sources,
    participation: { readReceipt: () => ({ evidenceKind }) as unknown as OfficialParticipationReceipt },
    games: { readGame() { gameReads++; throw new Error('tagged receipt reached National game authority'); } },
  });
  try {
    expect(() => callups.adoptAppearance({ careerId: 'career-a', eventId: 'reject-tag', receiptId: 'negative-only', acceptedAtDay: 426 }))
      .toThrow('does not support tagged participation receipts');
    expect(gameReads).toBe(0);
    expect(callups.readRepresentation('career-a', 'p0', 426)).toEqual([]);
  } finally { callups.close(); f.close(); }
});

it.each([...tags, undefined])('public rehab rejects a tagged reader result independently of valid raw legacy proof: %j', evidenceKind => {
  const { f, health, sources, authority, prepareGame } = healthRehabStoreFixture();
  try {
    const { receipt } = prepareGame(), before = f.db.prepare('SELECT * FROM world_health_rehab_effects ORDER BY source_id').all();
    const guarded = f.track(openSqlitePlayerHealthRehabStore(f.path, { ...sources,
      participation: { readReceipt: () => ({ ...receipt, evidenceKind }) as unknown as OfficialParticipationReceipt },
    }, authority));
    expect(() => guarded.apply('game', 2)).toThrow('does not support tagged participation receipts');
    expect(f.db.prepare('SELECT * FROM world_health_rehab_effects ORDER BY source_id').all()).toEqual(before);
    expect(health.readHead('career-a', 'p2')!.revision).toBe(2);
    expect(health.apply('game', 2).phase).toBe('READY');
  } finally { f.close(); }
});

it.each([
  '"evidenceKind":"ACTUAL_LIVE_V1"', '"evidenceKind":null',
  '"evidenceKind":"ACTUAL_LIVE_V1","evidenceKind":"ACTUAL_LIVE_V2"',
  '"evidenc\\u0065Kind":false,"evidenceKind":"ACTUAL_LIVE_V1"',
])('raw rehab rejects tag metadata before legacy application reads: %s', tagFields => {
  const { f, health, prepareGame } = healthRehabStoreFixture();
  try {
    const { receipt } = prepareGame();
    const original = f.db.prepare('SELECT receipt_json FROM official_participation_receipts WHERE receipt_id=?').get(receipt.receiptId)!;
    // Removing activationApplicationId ensures a driver error cannot masquerade as the explicit tag boundary.
    const value = JSON.parse(String(original.receipt_json)); delete value.activationApplicationId;
    const corrupted = `{${tagFields},${JSON.stringify(value).slice(1)}`;
    f.db.prepare('UPDATE official_participation_receipts SET receipt_json=? WHERE receipt_id=?').run(corrupted, receipt.receiptId);
    const before = f.db.prepare('SELECT * FROM world_health_rehab_effects ORDER BY source_id').all();
    expect(() => health.apply('game', 2)).toThrow('does not support tagged participation receipts');
    expect(f.db.prepare('SELECT * FROM world_health_rehab_effects ORDER BY source_id').all()).toEqual(before);
    f.db.prepare('UPDATE official_participation_receipts SET receipt_json=? WHERE receipt_id=?').run(original.receipt_json, receipt.receiptId);
    expect(health.apply('game', 2).phase).toBe('READY');
  } finally { f.close(); }
});
