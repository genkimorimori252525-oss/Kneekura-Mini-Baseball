import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import type { BatBallContactResult } from '../../core/sim/contact/BatBallContact';
import type { CanonicalPlateAppearanceEvent } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { continuousPitchFixture, continuousPitchAction } from './ContinuousPitchFixtures.test-support';
import { openSqlitePhysicalPitchProgressStore } from './SqlitePhysicalPitchProgressStore';
import { originalBattingIntentFixture } from './OriginalBattingIntentFixtures.test-support';
import type { SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { readNativeMeasuredOriginalPitchContactV183FromSqlite as read,
  selectOriginalPitchContactV183 as select } from './NativeMeasuredOriginalPitchContactV183';

const { constants } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
type ContactEvent = Extract<CanonicalPlateAppearanceEvent, { kind: 'BatBallContact' }>;
// Pure selection data only. No Native actor or prefix proof is manufactured.
const contact = (tick: number): BatBallContactResult => ({ tick, ballCenter: { x: 0, y: 1.2, z: 0 },
  point: { x: -0.1, y: 1.2, z: 0 }, batPoint: { x: -0.1, y: 1.2, z: 0 }, normal: { x: 1, y: 0, z: 0 },
  segmentT: 0.5, exitVelocity: { x: -17, y: 23, z: 31 }, exitSpin: { x: 47, y: -53, z: 61 } });
const event = (tick: number, sequence: number): ContactEvent => ({ tick, sequence, kind: 'BatBallContact',
  payload: { countBefore: { balls: 1, strikes: 2 }, contact: contact(tick) } });

it('OC183-S01 does not recount a prior contact or require an actor for a pitch without added contact', () => {
  const prior = event(7, 2), before = { events: [prior] }, after = { events: [prior] };
  expect(select(before, after, undefined)).toBeNull();
  expect(select({ events: [] }, { events: [] }, undefined)).toBeNull();
});

it('OC183-S02 refuses an added contact when no original batter actor can identify its person', () => {
  const prior = event(7, 2), added = event(23, 5), before = { events: [prior] }, after = { events: [prior, added] };
  const untouched = JSON.stringify({ before, after });
  expect(() => select(before, after, undefined)).toThrow(/original batter actor/);
  expect(JSON.stringify({ before, after })).toBe(untouched);
});

it('OC183-N01 authenticates a real original NoContact reference while rejecting forged refs without consuming caller state', () => {
  const f = continuousPitchFixture();
  try {
    const source = continuousPitchAction(f, 0, 0), store = f.track(openSqlitePhysicalPitchProgressStore(f.path,
      { matches: f.official, initialWorlds: f.initialWorlds, participation: f.participation, runtime: f.stores },
      { readAcceptedAction: id => id === source.sourceId ? source : null }));
    const pitch = store.accept(source.sourceId, 0);
    expect(pitch.frame.batterActor).toBeUndefined();
    const row = f.db.prepare('SELECT source_hash,snapshot_hash FROM main.physical_pitch_progress_actions WHERE source_id=?').get(source.sourceId)!;
    const ref: SamePaReference<'physical_pitch_progress_actions'> = { owner: 'physical_pitch_progress_actions', sourceId: source.sourceId,
      sourceHash: String(row.source_hash), snapshotHash: String(row.snapshot_hash) };
    const state = () => ({ transaction: f.db.isTransaction, queryOnly: f.db.prepare('PRAGMA query_only').get()!.query_only,
      changes: f.db.prepare('SELECT total_changes() n').get()!.n,
      mainSchema: f.db.prepare('PRAGMA main.schema_version').get()!.schema_version });
    f.db.setAuthorizer(code => code === constants.SQLITE_DELETE ? constants.SQLITE_DENY : constants.SQLITE_OK);
    try {
      f.db.exec('BEGIN'); f.db.exec('SAVEPOINT original_contact_caller');
      const before = state();
      expect(read(f.db, ref)).toBeNull();
      for (const invalid of [{ ...ref, sourceHash: 'a'.repeat(64) }, { ...ref, snapshotHash: 'b'.repeat(64) },
        { ...ref, owner: 'pa_physical_v1_resolutions' }, { ...ref, sourceId: 'missing-original' }, { ...ref, cachedActor: {} }]) {
        expect(() => read(f.db, invalid as typeof ref)).toThrow();
      }
      expect(state()).toEqual(before);
      expect(() => f.db.prepare('DELETE FROM main.physical_pitch_progress_actions WHERE 0')).toThrow(/authorized/i);
      f.db.exec('RELEASE original_contact_caller');
      expect(f.db.isTransaction).toBe(true); f.db.exec('ROLLBACK');
      expect(read(f.db, ref)).toBeNull();
      expect(f.db.isTransaction).toBe(false);
    } finally { if (f.db.isTransaction) f.db.exec('ROLLBACK'); f.db.setAuthorizer(null); }
  } finally { f.close(); }
});

it('OC183-N02 retains an authored ordinary_swing Native contact, person and original progress across two lossless reads', () => {
  const temporaryRoot = resolve(tmpdir()), directory = mkdtempSync(join(temporaryRoot, 'original-contact-v183-'));
  let x: ReturnType<typeof originalBattingIntentFixture> | undefined;
  try {
    // Existing explicitly authored bat placement. This proves the Native
    // measurement boundary, not normal AI timing or future-information access.
    x = originalBattingIntentFixture(join(directory, 'world.sqlite'));
    const source = x.withIntent('ordinary_swing');
    x.actions.set(source.sourceId, source);
    const pitch = x.pitches.accept(source.sourceId, 0), db = x.f.db;
    const rawEvent = pitch.result.pitch.resolution.timeline.events.slice(pitch.beforeTimeline.events.length)
      .find((item): item is ContactEvent => item.kind === 'BatBallContact');
    if (!rawEvent) throw new Error('authored ordinary swing did not produce an original contact');
    const row = db.prepare('SELECT source_hash,snapshot_hash FROM main.physical_pitch_progress_actions WHERE source_id=?').get(source.sourceId)!;
    const ref = { owner: 'physical_pitch_progress_actions' as const, sourceId: source.sourceId,
      sourceHash: String(row.source_hash), snapshotHash: String(row.snapshot_hash) }, originalRef = structuredClone(ref);
    const state = () => ({ rows: db.prepare('SELECT * FROM main.physical_pitch_progress_actions ORDER BY progress_revision').all(),
      heads: db.prepare('SELECT * FROM main.physical_pitch_progress_heads ORDER BY game_id,play_id').all(),
      changes: db.prepare('SELECT total_changes() n').get()!.n, transaction: db.isTransaction,
      queryOnly: db.prepare('PRAGMA query_only').get()!.query_only,
      mainSchema: db.prepare('PRAGMA main.schema_version').get()!.schema_version });
    const before = state(), first = read(db, ref);
    if (!first) throw new Error('original Native contact was returned as NoContact');
    expect(first.reference).toStrictEqual(originalRef); expect(first.reference).not.toBe(ref);
    expect(first.source).toStrictEqual(source); expect(first.actor.binding).toStrictEqual(x.actor.binding);
    expect(first.contactEvent).toStrictEqual(rawEvent);
    expect(first.contact.exitVelocity).toStrictEqual(rawEvent.payload.contact.exitVelocity);
    expect(first.contact.exitSpin).toStrictEqual(rawEvent.payload.contact.exitSpin);
    expect(first.contact).toStrictEqual(rawEvent.payload.contact); expect(first.progressRevision).toBe(1);
    expect(first.scope).toStrictEqual({ careerId: x.actor.binding.careerId, gameId: source.gameId,
      playId: pitch.frame.match.playId, physicalPitchSourceId: source.sourceId });
    ref.snapshotHash = '0'.repeat(64);
    expect(first.reference).toStrictEqual(originalRef);
    const second = read(db, originalRef);
    if (!second) throw new Error('repeated original Native contact was returned as NoContact');
    // toStrictEqual retains number identity, including -0; no JSON rounding.
    expect(second).toStrictEqual(first);
    const frozen = (value: unknown): void => {
      if (!value || typeof value !== 'object') return;
      expect(Object.isFrozen(value)).toBe(true); Object.values(value).forEach(frozen);
    };
    const detached = (left: unknown, right: unknown): void => {
      if (!left || typeof left !== 'object') return;
      expect(left).not.toBe(right);
      for (const key of Object.keys(left)) detached((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key]);
    };
    frozen(first); frozen(second); detached(first, second);
    expect(Reflect.set(first.contact.exitVelocity, 'x', 12345)).toBe(false);
    expect(Reflect.set(first.actor.binding, 'gameDay', 12345)).toBe(false);
    expect(state()).toStrictEqual(before);
  } finally {
    x?.f.close();
    expect(dirname(directory)).toBe(temporaryRoot);
    rmSync(directory, { recursive: true, force: true });
  }
});
