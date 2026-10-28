import { existsSync } from 'node:fs';
import { originalBattingIntentFixture } from './OriginalBattingIntentFixtures.test-support';
import { createWorldBoundOriginalContactCalendarInitializer } from './WorldBoundOriginalContactV187.test-support';

/** Two independent Core-generated games in one fresh Native database. Contact placement
 * remains the authored fixture; this does not simulate completed intervening games or normal AI. */
export function createWorldBoundOriginalContactsV190(path: string) {
  if (existsSync(path)) throw new Error('V190 requires a new database path');
  const contacts = ([10, 11] as const).map(day => {
    const identity = { initialWorldSourceId: `v190-day-${day}-world`, actorSourceId: `v190-day-${day}-actor`,
      pitchSourcePrefix: `v190-day-${day}-pitch-`, outingId: `v190-day-${day}-outing` };
    const x = originalBattingIntentFixture(path, createWorldBoundOriginalContactCalendarInitializer(day), identity);
    try {
      const formal = x.f.calendarFixture; if (!formal) throw new Error('formal calendar missing');
      const action = x.withIntent('bunt'); x.actions.set(action.sourceId, action);
      const physical = x.pitches.accept(action.sourceId, 0), actor = physical.frame.batterActor;
      const event = physical.result.pitch.resolution.timeline.events.slice(physical.beforeTimeline.events.length).find(item => item.kind === 'BatBallContact');
      if (!actor || !event || event.kind !== 'BatBallContact') throw new Error('V190 requires a real original actor/contact');
      const row = x.f.db.prepare('SELECT source_hash,snapshot_hash FROM main.physical_pitch_progress_actions WHERE source_id=?').get(action.sourceId)!;
      return { reference: { owner: 'physical_pitch_progress_actions' as const, sourceId: action.sourceId, sourceHash: String(row.source_hash), snapshotHash: String(row.snapshot_hash) },
        scope: { careerId: actor.binding.careerId, playerId: actor.binding.playerId },
        gameId: physical.frame.gameId, playId: physical.frame.match.playId, seasonDay: x.f.gameDay,
        contact: event.payload.contact, workloadBefore: physical.frame.workload,
        inputWorkloadRevision: x.f.input.workloadRevision, careerCalendarEditionId: formal.careerCalendarEditionId,
        calendarOrigin: formal.calendarOrigin, careerCalendarSelection: formal.careerCalendarSelection };
    } finally { x.f.close(); }
  });
  return { scope: contacts[0]!.scope, contacts, careerCalendarEditionId: contacts[0]!.careerCalendarEditionId,
    fixtureAuthority: { kind: 'EXPLICIT_NATIVE_TWO_GAME_FORMAL_CONTACT_FIXTURE_V190', scheduleAndGameIdsGeneratedByCore: true,
      physicalTicksDerivedFromCalendar: false, normalAiProven: false, completedInterveningGamesProven: false,
      productionCalibrationProven: false, naturalCohortProven: false } };
}
