import assert from 'node:assert/strict';
import { originalBattingIntentFixture } from '../../src/host/world/OriginalBattingIntentFixtures.test-support';
export { readNativeMeasuredOriginalPitchContactV183FromSqlite as read } from '../../src/host/world/NativeMeasuredOriginalPitchContactV183';

/** Existing authored Native fixture only; this does not model normal AI anticipation. */
export function createCase(databasePath: string) {
  const x = originalBattingIntentFixture(databasePath);
  try {
    const source = x.withIntent('bunt');
    x.actions.set(source.sourceId, source);
    const pitch = x.pitches.accept(source.sourceId, 0);
    const row = x.f.db.prepare('SELECT source_hash,snapshot_hash,snapshot_json FROM main.physical_pitch_progress_actions WHERE source_id=?').get(source.sourceId)!;
    const stored = JSON.parse(String(row.snapshot_json)) as typeof pitch;
    const contacts = pitch.result.pitch.resolution.timeline.events.slice(pitch.beforeTimeline.events.length)
      .filter(event => event.kind === 'BatBallContact');
    assert.equal(contacts.length, 1); assert(pitch.frame.batterActor);
    return {
      reference: { owner: 'physical_pitch_progress_actions' as const, sourceId: source.sourceId,
        sourceHash: String(row.source_hash), snapshotHash: String(row.snapshot_hash) },
      expected: { source: stored.source, actor: stored.frame.batterActor, contactEvent: contacts[0],
        contact: contacts[0]!.payload.contact, progressRevision: pitch.progressRevision,
        scope: { careerId: pitch.frame.workload.careerId, gameId: pitch.frame.gameId,
          playId: pitch.frame.match.playId, physicalPitchSourceId: source.sourceId } },
      fixtureAuthority: 'EXPLICIT_NATIVE_FIXTURE_NOT_NORMAL_AI_MASTERY_CALENDAR_OR_COHORT',
    };
  } finally { x.f.close(); }
}
