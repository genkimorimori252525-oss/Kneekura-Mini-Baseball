import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import { assertNoSamePaCatchReviewSeal } from './SamePlateAppearanceCatchReviewSeal';
import { assertNoPostPlayClosureReservation } from './ActualPostPlayReviewNativeMetadata';
import type { PostPlayReviewNativeScope } from './ActualPostPlayReviewNativeScope';
import { samePaCatchReviewSeedInput } from './SamePlateAppearanceCatchReviewSource';
import { actualPostPlayReviewSessionInput } from './ActualPostPlayReviewSource';
import { samePaLifecycleOutcomeInput } from './SamePlateAppearanceLifecycleOutcome';
const Native = (createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync;
const ref = (owner: string) => ({ owner, sourceId: owner + ':source', sourceHash: 'a'.repeat(64), snapshotHash: 'b'.repeat(64) });

it('reserved review accepts references only and never a supplied physical end, ledger or legacy owner', () => {
  const source = { sourceId: 'seed', sourceVersion: 'fixture-v1', capability: 'same_pa_catch_review_seed_v1', policy: null,
    viewReference: ref('pa_lifecycle_v1_execution_views'), catchWorkReference: ref('pa_catch_v1_work'), physicalOperationReference: ref('pa_physical_v1_field_steps') };
  expect(samePaCatchReviewSeedInput(source)).toEqual(source);
  for (const extra of [{ ledger: {} }, { physicalEnd: {} }, { ready: true }]) expect(() => samePaCatchReviewSeedInput({ ...source, ...extra })).toThrow();
  expect(() => samePaCatchReviewSeedInput({ ...source, physicalOperationReference: ref('actual_first_base_play_ends') })).toThrow();
  const session = { sourceId: 'session', sourceVersion: 'fixture-v1', capability: 'actual_post_play_review_session_v1',
    adjudicationSourceId: 'seed', adjudicationSnapshotHash: 'c'.repeat(64), officialPolicy: null, policy: null, reservedCatchSeed: source };
  expect(actualPostPlayReviewSessionInput(session, 'session')).toEqual(session);
  expect(() => actualPostPlayReviewSessionInput({ ...session, adjudicationSourceId: 'other' }, 'session')).toThrow();
  const outcome = { sourceId: 'outcome', sourceVersion: 'fixture-v1', capability: 'same_pa_lifecycle_outcome_v1', kind: 'fair_catch',
    enrollmentReference: ref('same_pa_enrollments'), viewReference: source.viewReference, catchWorkReference: source.catchWorkReference,
    physicalOperationReference: source.physicalOperationReference, rulePolicy: null, officialPolicy: null,
    official: { sourceId: 'scheduler-source', sourceVersion: 'fixture-v1', schedulerId: 'scheduler', events: [
      { sourceId: 'fence', sourceVersion: 'fixture-v1', schedulerId: 'scheduler', kind: 'next_play_fence' }] },
    postPlayReviewReference: { sessionSourceId: 'session', revision: 2, headSourceId: 'decision', headHash: 'c'.repeat(64) } };
  expect(samePaLifecycleOutcomeInput(outcome)).toEqual(outcome);
  for (const invalid of [null, {}, { ...outcome.postPlayReviewReference, revision: -1 }, { ...outcome.postPlayReviewReference, ledger: {} }])
    expect(() => samePaLifecycleOutcomeInput({ ...outcome, postPlayReviewReference: invalid })).toThrow();
});

it('physical seal discovers raw numeric game/play ownership when indexed scope is moved', () => {
  const db = new Native(':memory:');
  try {
    db.exec('CREATE TABLE actual_post_play_review_sessions(source_id TEXT,game_id TEXT,play_id INTEGER,snapshot_json TEXT)');
    expect(() => assertNoSamePaCatchReviewSeal(db, 'game', 7)).not.toThrow();
    for (const snapshot of [{ scope: { gameId: 'game', playId: 7 } }, { value: { seed: { gameId: 'game', playId: 7 } } }]) {
      db.prepare('INSERT INTO actual_post_play_review_sessions VALUES(?,?,?,?)').run('session', 'moved', 999, JSON.stringify(snapshot));
      expect(() => assertNoSamePaCatchReviewSeal(db, 'game', 7)).toThrow(/sealed/);
      expect(() => assertNoSamePaCatchReviewSeal(db, 'game', 8)).not.toThrow();
      db.exec('DELETE FROM actual_post_play_review_sessions');
    }
  } finally { db.close(); }
});

it('a prior foul outcome does not fence review of a later pitch in the same PA; the exact catch outcome does', () => {
  const db = new Native(':memory:');
  const scope = { gameId: 'game', playId: 7, physicalPitchSourceId: 'catch-pitch' } as PostPlayReviewNativeScope;
  try {
    db.exec('CREATE TABLE pa_lifecycle_v1_outcomes(source_id TEXT,game_id TEXT,play_id INTEGER,physical_pitch_source_id TEXT,snapshot_json TEXT)');
    db.prepare('INSERT INTO pa_lifecycle_v1_outcomes VALUES(?,?,?,?,?)').run('old-foul', 'game', 7, 'foul-pitch', '{}');
    expect(() => assertNoPostPlayClosureReservation(db, 'seed', scope)).not.toThrow();
    db.prepare('INSERT INTO pa_lifecycle_v1_outcomes VALUES(?,?,?,?,?)').run('catch', 'moved', 999, 'moved', JSON.stringify({
      lineage: { gameId: 'game', playId: 7 }, fairCatch: { physicalPitchReference: { sourceId: 'catch-pitch' } } }));
    expect(() => assertNoPostPlayClosureReservation(db, 'seed', scope)).toThrow(/same-PA lifecycle outcome/);
  } finally { db.close(); }
});
