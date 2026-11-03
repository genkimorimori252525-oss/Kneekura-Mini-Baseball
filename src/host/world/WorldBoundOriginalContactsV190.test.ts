import { createRequire } from 'node:module';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, sep } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { createWorldBoundOriginalContactsV190 } from './WorldBoundOriginalContactsV190.test-support';
import { openSqliteNativeBattingContactObservationStoreV188 as open } from './SqliteNativeBattingContactObservationStoreV188';
import { readNativeBattingContactTraitProjectionV189FromSqlite as read } from './NativeBattingContactTraitProjectionV189';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const directories: string[] = [];
afterEach(() => {
  const root = realpathSync(tmpdir());
  for (const directory of directories.splice(0)) {
    const target = realpathSync(directory);
    if (!target.startsWith(root + sep) || !basename(target).startsWith('two-game-contact-v190-')) throw new Error('V190 cleanup escaped its directory');
    rmSync(target, { recursive: true, force: true });
  }
});
it('N01 classifies true contacts from two formal days using the shared authenticated workload', () => {
  const directory = mkdtempSync(join(tmpdir(), 'two-game-contact-v190-')); directories.push(directory);
  const path = join(directory, 'world.sqlite'), fixture = createWorldBoundOriginalContactsV190(path), [first, second] = fixture.contacts;
  expect(first!.gameId).not.toBe(second!.gameId); expect(first!.scope).toEqual(second!.scope);
  expect(fixture.contacts.map(c => c.seasonDay)).toEqual([10, 11]);
  // Contacts are still pending; only official closure writes global workload.
  expect(fixture.contacts.map(c => c.inputWorkloadRevision)).toEqual([0, 0]);
  expect(first!.workloadBefore.revision).toBe(0); expect(second!.workloadBefore).toEqual(first!.workloadBefore);
  const store = open(path);
  const captured = (() => { try { return store.capture(fixture.scope, { careerCalendarEditionId: fixture.careerCalendarEditionId }); } finally { store.close(); } })();
  expect(captured).not.toBeNull(); expect(captured!.receipts).toHaveLength(2);
  expect(captured!.receipts.map(r => r.calendarDateISO)).toEqual(['2032-02-28', '2032-02-29']);
  expect(captured!.observations.map(o => o.time.day)).toEqual([424, 425]);
  expect(new Set(captured!.receipts.map(r => r.episodeId)).size).toBe(2);
  // An explicit synthetic rule exercises composition; it does not calibrate a production line-drive definition.
  const model = { modelId: 'v190-native-integration-only', version: '1', minimumEpisodes: 2, minimumDays: 1, windowDays: 10,
    maximumSourceAgeDays: 0, rule: { familyId: 'line_drive' as const, lowerAngleDeg: 10, upperAngleDeg: 30, minimumFraction: .6 } },
    policy = { policyId: 'v190-integration-only', version: '1', families: [{ familyId: 'line_drive', modelId: model.modelId,
      modelVersion: model.version, minimumRecognitionEpisodes: 2, minimumRecognitionDays: 1 }] };
  const db = new DatabaseSync(path);
  try {
    const result = read(db, { scope: fixture.scope, classificationId: 'v190-classification', projectionId: 'v190-projection', worldRevision: 0, model, policy });
    expect(result.status).toBe('READY'); expect(result.classification?.episodeCount).toBe(2); expect(result.classification?.evidenceSpanDays).toBe(1);
    const expectedFraction = fixture.contacts.filter(c => {
      const v = c.contact.exitVelocity, angle = Math.atan2(v.y, Math.hypot(v.x, v.z)) * 180 / Math.PI;
      return angle >= 10 && angle < 30;
    }).length / 2;
    expect(result.classification?.metrics.find(m => m.key === 'lineDriveFraction')?.value).toBe(expectedFraction);
    expect(result.projection?.entries.find(e => e.familyId === 'line_drive')?.status).toBe(expectedFraction >= .6 ? 'PRESENT' : 'ABSENT');
  } finally { db.close(); }
});
