import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import type { BatBallContactResult } from '../../core/sim/contact/BatBallContact';
import type { CanonicalPlateAppearanceEvent } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import type { SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { readNativeMeasuredBattingContactV182FromSqlite as read, selectAddedBattingContactV182 as select } from './NativeMeasuredBattingContactV182';

const { DatabaseSync, constants } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
type ContactEvent = Extract<CanonicalPlateAppearanceEvent, { kind: 'BatBallContact' }>;
// Synthetic selection inputs only. These carry no Native ownership proof.
const contact = (tick: number): BatBallContactResult => ({ tick, ballCenter: { x: -0.1, y: 1.2, z: 0.3 },
  point: { x: -0.13, y: 1.21, z: 0.31 }, batPoint: { x: -0.14, y: 1.22, z: 0.32 },
  normal: { x: -0.2, y: 0.3, z: 0.4 }, segmentT: 0.7,
  exitVelocity: { x: -17, y: 23, z: 31 }, exitSpin: { x: 47, y: -53, z: 61 } });
const event = (tick: number, sequence: number): ContactEvent => ({ tick, sequence, kind: 'BatBallContact',
  payload: { countBefore: { balls: 1, strikes: 2 }, contact: contact(tick) } });

it('MC182-S01 selects the added contact while retaining its original vectors and local event identity', () => {
  const prior = event(7, 2), added = event(23, 5), launch = { events: [prior] }, resolution = { events: [prior, added] };
  const before = JSON.stringify({ launch, resolution });
  const result = select(launch, resolution);
  expect(result).toEqual(added);
  expect(result?.payload.contact.exitVelocity).toEqual({ x: -17, y: 23, z: 31 });
  expect(result?.payload.contact.exitSpin).toEqual({ x: 47, y: -53, z: 61 });
  expect(result?.tick).toBe(23); expect(result?.sequence).toBe(5);
  expect(select(launch, resolution)).toEqual(result);
  expect(JSON.stringify({ launch, resolution })).toBe(before);
});

it('MC182-S02 returns no contact when only an earlier pitch contact remains in the resolution timeline', () => {
  const prior = event(7, 2);
  expect(select({ events: [prior] }, { events: [prior] })).toBeNull();
  expect(select({ events: [] }, { events: [] })).toBeNull();
});

const ref: SamePaReference<'pa_physical_v1_resolutions'> = { owner: 'pa_physical_v1_resolutions', sourceId: 'missing-resolution',
  sourceHash: 'a'.repeat(64), snapshotHash: 'b'.repeat(64) };
it('MC182-S03 rejects absent and forged Native references without writing or consuming the caller snapshot', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.setAuthorizer(code => code === constants.SQLITE_ATTACH || code === constants.SQLITE_DETACH
      ? constants.SQLITE_DENY : constants.SQLITE_OK);
    for (const queryOnly of [0, 1]) {
      db.exec('BEGIN'); db.exec('PRAGMA query_only=' + queryOnly);
      try {
        const before = { changes: db.prepare('SELECT total_changes() n').get()!.n,
          schema: db.prepare('PRAGMA main.schema_version').get()!.schema_version };
        for (const invalid of [ref, { ...ref, snapshotHash: 'c'.repeat(64) },
          { ...ref, owner: 'pa_physical_v1_launches' }, { ...ref, cachedProof: event(23, 5) }]) {
          expect(() => read(db, invalid as typeof ref)).toThrow();
        }
        expect(db.isTransaction).toBe(true);
        expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(queryOnly);
        expect(db.prepare('SELECT total_changes() n').get()!.n).toBe(before.changes);
        expect(db.prepare('PRAGMA main.schema_version').get()!.schema_version).toBe(before.schema);
        expect(() => db.exec("ATTACH ':memory:' AS foreign_owner")).toThrow(/authorized/i);
      } finally { db.exec('ROLLBACK'); db.exec('PRAGMA query_only=0'); }
    }
  } finally { db.setAuthorizer(null); db.close(); }
});
