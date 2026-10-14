import assert from 'node:assert/strict';
import type { DatabaseSync } from 'node:sqlite';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { readActualRoleWorkloadState } from './ActualRoleWorkloadState';
import type { ReservedSamePlateAppearanceEnrollment } from './SamePlateAppearanceEnrollment';
import type { SqliteOfficialParticipationStore } from './SqliteOfficialParticipationStore';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';

type Enrollment = Pick<ReservedSamePlateAppearanceEnrollment, 'careerId' | 'gameId'> & Readonly<{
  participants: readonly Pick<ReservedSamePlateAppearanceEnrollment['participants'][number], 'binding' | 'state'>[];
  source: Pick<ReservedSamePlateAppearanceEnrollment['source'], 'participantBaselineReferences'>;
}>;

/** Authenticate the exact retained IFN workload context without replaying its
 * physical prefix. Return every original head for the unchanged final assertion. */
export const readIFN01RetainedWorkloadHeads = (db: DatabaseSync, enrollment: Enrollment,
  participation: Pick<SqliteOfficialParticipationStore, 'readPregameBinding'>) => withSqliteReadTransaction(db, () => {
  const originalHeads = db.prepare('SELECT * FROM world_player_workload_heads ORDER BY career_id,player_id').all();
  assert.equal(enrollment.participants.length, 10, 'IFN01 original enrolled set differs');
  assert.equal(new Set(enrollment.participants.map(p => p.binding.playerId)).size, 10, 'IFN01 repeated enrolled participant');
  // ContinuousPitchFixtures initializes both original pitchers before the PA.
  // The away pitcher is not one of this PA's ten reserved participants.
  const away = participation.readPregameBinding(enrollment.gameId, 'p-away');
  assert(away, 'IFN01 original independent away-pitcher binding missing');
  assert.equal(away.careerId, enrollment.careerId); assert.equal(away.side, 'AWAY');
  assert.equal(away.personLinkSourceId, 'intake-p-away');
  assert(!enrollment.participants.some(p => p.binding.playerId === away.playerId), 'IFN01 independent pitcher is enrolled');
  const expectedScopes = [...enrollment.participants.map(p => [p.binding.careerId, p.binding.playerId]), [away.careerId, away.playerId]];
  assert.deepEqual(originalHeads.map(h => [h.career_id, h.player_id]), expectedScopes.sort((a, b) => json(a) < json(b) ? -1 : json(a) > json(b) ? 1 : 0),
    'IFN01 original workload head census differs');
  const awayBaseline = db.prepare('SELECT * FROM world_player_workload_baselines WHERE source_id=?').get('workload-away');
  assert(awayBaseline, 'IFN01 original independent workload baseline missing');
  assert.equal(awayBaseline.career_id, away.careerId); assert.equal(awayBaseline.player_id, away.playerId);
  const awayState = readActualRoleWorkloadState(db, away.careerId, away.playerId, undefined, away.personLinkSourceId);
  assert(awayState, 'IFN01 independent workload owner missing');
  assert.equal(awayState.revision, 0, 'IFN01 independent workload head changed');
  assert.equal(json(awayState), awayBaseline.initial_json, 'IFN01 independent workload baseline changed');
  for (const participant of enrollment.participants) {
    const b = participant.binding;
    const state = readActualRoleWorkloadState(db, b.careerId, b.playerId, undefined, b.personLinkSourceId);
    assert.deepEqual(state, participant.state, 'IFN01 reserved participant head already changed');
    assert.equal(hash(state), enrollment.source.participantBaselineReferences.find(p => p.playerId === b.playerId)!.stateHash);
  }
  return originalHeads;
});
