import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { continuousPitchAction } from './ContinuousPitchFixtures.test-support';
import { readOriginalPhysicalPitchPrefixFromSqlite } from './PhysicalPitchEvidenceFromSqlite';
import { originalBattingIntentFixture } from './OriginalBattingIntentFixtures.test-support';
import { deriveOriginalBattingIntentEvidence } from './OriginalBattingIntent';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
let directory: string, x: ReturnType<typeof originalBattingIntentFixture>, originalsClosed = false;
beforeEach(() => {
  originalsClosed = true;
  directory = mkdtempSync(join(tmpdir(), 'original-batting-intent-'));
  x = originalBattingIntentFixture(join(directory, 'world.sqlite'));
  originalsClosed = false;
  expect(x.f.db.prepare('SELECT count(*) AS n FROM physical_pitch_progress_actions').get()!.n).toBe(0);
  expect(x.expected.pitch.resolution.timeline.status.kind).toBe('batted_ball_pending');
}, 60_000);
afterEach(() => { if (!originalsClosed) x?.f.close(); if (directory) rmSync(directory, { recursive: true, force: true }); });
const rows = () => JSON.stringify(x.f.db.prepare('SELECT * FROM physical_pitch_progress_actions ORDER BY progress_revision').all());
const accept = (source: typeof x.action) => { x.actions.set(source.sourceId, source); return x.pitches.accept(source.sourceId, 0); };

it.each(['ordinary_swing', 'bunt'] as const)('owns explicit %s intent before the original physical pitch/contact executes', attempt => {
  const source = x.withIntent(attempt), value = accept(source), own = x.pitches.readAcceptedPitch(source.sourceId)!;
  expect(own).toEqual(value);
  expect(own.result).toEqual(x.expected);
  expect(own.result.pitch.resolution.timeline.status).toMatchObject({ kind: 'batted_ball_pending', count: { balls: 0, strikes: 0 } });
  const contact = own.result.pitch.resolution.timeline.events.find(event => event.kind === 'BatBallContact');
  if (!contact || contact.kind !== 'BatBallContact') throw new Error('accepted original contact disappeared');
  const result = deriveOriginalBattingIntentEvidence(own);
  expect(result).toEqual({ version: 'original_batting_intent_evidence_v1',
    physicalPitch: { owner: 'physical_pitch_progress_actions', sourceId: source.sourceId, sourceVersion: source.sourceVersion,
      sourceHash: hash(source), snapshotHash: hash(own), progressRevision: 1 },
    actor: { owner: 'physical_plate_appearance_actors', sourceId: x.actor.source.sourceId, sourceVersion: x.actor.source.sourceVersion,
      snapshotHash: hash(x.actor), bindingHash: hash(x.actor.binding), personHash: hash(x.actor.person) },
    contact: { tick: contact.tick, sequence: contact.sequence, eventHash: hash(contact), resultTimelineHash: hash(own.result.pitch.resolution.timeline) },
    intent: { kind: 'declared', version: 'original_batting_intent_v1', attempt } });
  expect(Object.isFrozen(result)).toBe(true);
  expect(x.f.official.getMatch('game-1')!.durableRevision).toBe(0);
  expect(own.result.pitch.resolution.timeline.events.some(event => event.kind === 'FoulBattedBallResolved')).toBe(false);
});

it.each(['ordinary_swing', 'bunt'] as const)('retains exact %s retries and a callback-free full disk close/reopen', attempt => {
  const source = x.withIntent(attempt), value = accept(source);
  const expected = deriveOriginalBattingIntentEvidence(x.pitches.readAcceptedPitch(source.sourceId)!);
  const before = rows(); x.actions.clear();
  expect(x.pitches.accept(source.sourceId, 0)).toEqual(value);
  expect(rows()).toBe(before);
  const path = x.f.path; x.f.close(); originalsClosed = true;
  expect(() => x.f.db.prepare('SELECT 1').get()).toThrow();
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    db.exec('BEGIN');
    const reopened = readOriginalPhysicalPitchPrefixFromSqlite(db, source.sourceId).at(-1)!;
    expect(deriveOriginalBattingIntentEvidence(reopened)).toEqual(expected);
    expect(JSON.stringify(db.prepare('SELECT * FROM physical_pitch_progress_actions ORDER BY progress_revision').all())).toBe(before);
    db.exec('COMMIT');
  } finally { if (db.isTransaction) db.exec('ROLLBACK'); db.close(); }
});

it('keeps an absent legacy intent absent and unresolved without treating its generic swing as non-bunt', () => {
  const own = accept(x.action), before = rows();
  expect(own.source).not.toHaveProperty('battingIntent');
  expect(deriveOriginalBattingIntentEvidence(x.pitches.readAcceptedPitch(x.action.sourceId)!).intent)
    .toEqual({ kind: 'unresolved', reason: 'original_batting_intent_missing' });
  expect(rows()).toBe(before);
  expect(x.pitches.accept(x.action.sourceId, 0)).toEqual(own);
});

it('rejects attaching intent after a legacy pitch/contact was already accepted', () => {
  accept(x.action); const before = rows();
  x.actions.set(x.action.sourceId, x.withIntent('ordinary_swing'));
  expect(() => x.pitches.accept(x.action.sourceId, 0)).toThrow();
  expect(rows()).toBe(before);
});

it.each(['ordinary_swing', 'bunt'] as const)('rejects changing the original %s declaration on the same accepted Source', attempt => {
  const source = x.withIntent(attempt); accept(source); const before = rows();
  x.actions.set(source.sourceId, x.withIntent(attempt === 'bunt' ? 'ordinary_swing' : 'bunt'));
  expect(() => x.pitches.accept(source.sourceId, 0)).toThrow();
  expect(rows()).toBe(before);
});

it('rejects a declared attempt attributed to a foreign original batter actor', () => {
  const source = x.withIntent('bunt');
  expect(() => accept({ ...source, battingIntent: { ...source.battingIntent, actorSourceId: 'foreign-actor' } } as never)).toThrow();
  expect(rows()).toBe('[]');
});
it('rejects a take action carrying a declared batting attempt', () => {
  const source = { ...continuousPitchAction(x.f, 0, 0), battingIntent: x.withIntent('bunt').battingIntent };
  expect(() => accept(source as never)).toThrow(); expect(rows()).toBe('[]');
});
it.each(['version', 'attempt', 'actorSourceId'] as const)('rejects an unsupported or empty original intent %s', key => {
  const source = x.withIntent('bunt');
  expect(() => accept({ ...source, battingIntent: { ...source.battingIntent, [key]: key === 'actorSourceId' ? '' : 'unsupported' } } as never)).toThrow();
  expect(rows()).toBe('[]');
});
it.each(['count', 'out', 'buntAttempt'] as const)('rejects caller-supplied %s result data inside intent', key => {
  const source = x.withIntent('bunt');
  expect(() => accept({ ...source, battingIntent: { ...source.battingIntent, [key]: true } } as never)).toThrow();
  expect(rows()).toBe('[]');
});
it('rejects a getter inside intent without evaluating it', () => {
  const source = x.withIntent('bunt'); let calls = 0;
  const intent = Object.defineProperty({ ...source.battingIntent }, 'attempt', { enumerable: true,
    get: () => { calls += 1; return 'bunt'; } });
  expect(() => accept({ ...source, battingIntent: intent } as never)).toThrow();
  expect(calls).toBe(0); expect(rows()).toBe('[]');
});
it('does not manufacture contact intent evidence for a genuinely taken pitch', () => {
  const own = accept(continuousPitchAction(x.f, 0, 0) as never);
  expect(own.result.pitch.resolution.timeline.events.some(event => event.kind === 'BatBallContact')).toBe(false);
  expect(() => deriveOriginalBattingIntentEvidence(own)).toThrow();
});
it.each(['source_json', 'snapshot_json'] as const)('rejects a persisted intent mutation in %s during original-owner revalidation', column => {
  const source = x.withIntent('bunt'); accept(source);
  const row = x.f.db.prepare('SELECT * FROM physical_pitch_progress_actions WHERE source_id=?').get(source.sourceId)!;
  const document = JSON.parse(String(row[column]));
  const intent = column === 'source_json' ? document.battingIntent : document.source.battingIntent;
  intent.attempt = 'ordinary_swing';
  x.f.db.prepare(`UPDATE physical_pitch_progress_actions SET ${column}=? WHERE source_id=?`).run(JSON.stringify(document), source.sourceId);
  try { expect(() => x.pitches.readAcceptedPitch(source.sourceId)).toThrow(); }
  finally { x.f.db.prepare(`UPDATE physical_pitch_progress_actions SET ${column}=? WHERE source_id=?`).run(row[column]!, source.sourceId); }
});
