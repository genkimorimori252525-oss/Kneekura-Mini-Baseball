import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { openSqliteWbcQualifierHostAccessStore } from './SqliteWbcQualifierHostAccessStore';

it('replays draw-bound World access facts through the requested cutoff and freezes full prefix provenance', () => {
  const directory = mkdtempSync(join(tmpdir(), 'qualifier-host-access-'));
  const path = join(directory, 'world.sqlite');
  let store = openSqliteWbcQualifierHostAccessStore(path);
  const event = { careerId: 'career-1', qualifierEditionId: 'qualifier-2040', drawSnapshotId: 'mixed-pods-2040',
    podIndex: 0, venueId: 'venue-jp', sourceEventId: 'world-access-jp-390', effectiveFromDay: 390,
    geographySuitability: 3, travelCost: 10, neutralAccessibility: 5, developingOpportunity: 1 };
  try {
    expect(store.record(event)).toEqual(event);
    expect(store.record(event)).toEqual(event);
    expect(() => store.record({ ...event, travelCost: 11 })).toThrow('frozen differently');
    expect(() => store.record({ ...event, sourceEventId: 'negative-cost', travelCost: -1 })).toThrow('invalid');
    const saved = store.readAccess('career-1', event.qualifierEditionId, event.drawSnapshotId, 400);
    expect(saved.assessments).toHaveLength(1);
    expect(saved.asOfDay).toBe(400);
    expect(Object.isFrozen(saved.assessments[0])).toBe(true);
    store.record({ ...event, effectiveFromDay: 410, sourceEventId: 'world-access-jp-410', travelCost: 8 });
    expect(store.readAccess('career-1', event.qualifierEditionId, event.drawSnapshotId, 400)).toEqual(saved);
    expect(store.readAccess('career-1', event.qualifierEditionId, event.drawSnapshotId, 410).assessments[0].travelCost).toBe(8);
    expect(store.readAccess('career-1', event.qualifierEditionId, 'other-pods', 400).assessments).toEqual([]);
    store.close(); store = openSqliteWbcQualifierHostAccessStore(path);
    expect(store.readAccess('career-1', event.qualifierEditionId, event.drawSnapshotId, 400)).toEqual(saved);
    const { DatabaseSync }: typeof import('node:sqlite') = createRequire(import.meta.url)('node:sqlite');
    const db = new DatabaseSync(path);
    try { db.prepare("UPDATE world_wbc_qualifier_host_access_events SET event_json='{}' WHERE effective_day=410").run(); }
    finally { db.close(); }
    expect(store.readAccess('career-1', event.qualifierEditionId, event.drawSnapshotId, 400)).toEqual(saved);
    expect(() => store.readAccess('career-1', event.qualifierEditionId, event.drawSnapshotId, 410)).toThrow('corrupt');
    const tamper = new DatabaseSync(path);
    try { tamper.prepare("UPDATE world_wbc_qualifier_host_access_events SET event_json='{}' WHERE effective_day=390").run(); }
    finally { tamper.close(); }
    expect(() => store.readAccess('career-1', event.qualifierEditionId, event.drawSnapshotId, 400)).toThrow('corrupt');
  } finally { store.close(); rmSync(directory, { recursive: true, force: true }); }
});
