import { expect } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { SamePaExecutedPitch } from './SamePlateAppearanceDispatchExecution';
import type { openSqliteSamePlateAppearanceDispatchStore } from './SqliteSamePlateAppearanceDispatchStore';

/** The original occupied helper's exact sixteen-table, row-order-sensitive view. */
export const samePaOccupiedPitchBytes = (db: Pick<DatabaseSync, 'prepare'>) => json([
  'same_pa_enrollments','same_pa_participant_reservations','reserved_pa_work_prefixes','reserved_pa_total_assessments','reserved_pa_execution_views',
  'world_same_pa_occupied_runner_holds','pa_dispatch_v1_action_plans','pa_dispatch_v1_execution_calibrations','pa_dispatch_v1_consumer_sets','pa_dispatch_v1_episodes',
  'pa_dispatch_v1_rights','pa_dispatch_v1_consumer_actions','pa_dispatch_v1_pitch_actions','pa_dispatch_v1_pitch_heads','pa_dispatch_v1_consumptions','pa_dispatch_v1_episode_admissions',
].map(table=>db.prepare('SELECT * FROM main.'+table+' ORDER BY rowid').all()));

/** Only the two original assertions after the separately completed retry.
 * The owner read both authenticates the pitch and performs its original readback.
 * No writer or already-completed fixture context is needed at this boundary. */
export const finishSamePaOccupiedPitchReadback = (
  reopened: Pick<ReturnType<typeof openSqliteSamePlateAppearanceDispatchStore>, 'readPhysicalPitch'>,
  pitch: SamePaExecutedPitch, bytes: () => string, saved: string,
) => {
  expect(reopened.readPhysicalPitch(pitch.source.sourceId)).toEqual(pitch);
  expect(bytes()).toBe(saved);
};
