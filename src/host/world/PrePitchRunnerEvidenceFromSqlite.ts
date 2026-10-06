import type { DatabaseSync } from 'node:sqlite';
import type { CanonicalRunnerKinematics, RouteFollowingController } from '../../core/sim/running/RunnerLocomotionController';
import { buildPrePitchRunnerController, prePitchRunnerExecutionInput, type AcceptedPrePitchRunnerExecution } from './PrePitchRunnerExecution';
import { actorFreeze as freeze, type DurablePhysicalPlateAppearanceActor } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { readOfficialActorPersonLink } from './SqliteOfficialInitialWorldStore';
import type { OfficialParticipantBinding } from './SqliteOfficialParticipationStore';

export type DurablePrePitchRunnerExecution = Readonly<{
  source: AcceptedPrePitchRunnerExecution; binding: OfficialParticipantBinding; person: ReturnType<typeof readOfficialActorPersonLink>;
  canonical: CanonicalRunnerKinematics; controller: RouteFollowingController;
}>;

/** Original occupancy/binding evidence also supports prospective recipient ownership before a controller exists. */
export const readOriginalPrePitchRunnerRecipient = (db: Pick<DatabaseSync, 'prepare'>,
  actor: DurablePhysicalPlateAppearanceActor, playerId: string) => {
  const occupied = Object.values(actor.match.bases).filter(v => v !== null);
  const runner = actor.world.runners[0], battingSide = actor.match.half === 'top' ? 'AWAY' : 'HOME';
  if (occupied.length !== 1 || occupied[0] !== playerId || actor.world.runners.length !== 1 || runner.playerId !== playerId
    || playerId === actor.binding.playerId || actor.world.defenders.some(d => d.playerId === playerId)) {
    throw new Error('pre-pitch runner original actor, Match bases or World membership differs');
  }
  const row = db.prepare('SELECT binding_json FROM official_participant_bindings WHERE game_id=? AND player_id=?')
    .get(actor.source.gameId, playerId) as { binding_json: string } | undefined;
  const binding = row ? JSON.parse(row.binding_json) as OfficialParticipantBinding : null;
  if (!binding || JSON.stringify(binding) !== row!.binding_json || binding.gameId !== actor.source.gameId || binding.playerId !== playerId
    || binding.careerId !== actor.binding.careerId || binding.competitionEditionId !== actor.binding.competitionEditionId
    || binding.gameDay !== actor.binding.gameDay || binding.fixtureEventId !== actor.binding.fixtureEventId
    || binding.side !== battingSide || binding.clubId !== actor.binding.clubId
    || binding.clubId !== (battingSide === 'HOME' ? actor.worldFixture.game.homeClubId : actor.worldFixture.game.awayClubId)
    || !Number.isSafeInteger(binding.rosterRevision) || binding.rosterRevision < 0
    || [...actor.defenderBindings, actor.binding].some(b => b.playerId === binding.playerId || b.personId === binding.personId)) {
    throw new Error('pre-pitch runner original Player/Person/Club/fixture binding differs');
  }
  const person = readOfficialActorPersonLink(db, binding);
  if (person.acceptedAtDay > binding.gameDay || person.rosterRevision > binding.rosterRevision) throw new Error('pre-pitch runner Person was unavailable at registration');
  return freeze({ binding, person, runner });
};

/** The caller supplies the already rederived original actor, never current mutable Match outcomes. */
export const derivePrePitchRunnerExecution = (db: Pick<DatabaseSync, 'prepare'>, raw: AcceptedPrePitchRunnerExecution,
  actor: DurablePhysicalPlateAppearanceActor): DurablePrePitchRunnerExecution => {
  const source = prePitchRunnerExecutionInput(raw);
  if (source.gameId !== actor.source.gameId || source.physicalActorSourceId !== actor.source.sourceId) {
    throw new Error('pre-pitch runner original actor, Match bases or World membership differs');
  }
  const { binding, person, runner } = readOriginalPrePitchRunnerRecipient(db, actor, source.playerId);
  const canonical: CanonicalRunnerKinematics = { playerId: runner.playerId, tick: actor.world.tick,
    position: runner.position, velocity: runner.velocity, bodyMode: 'upright', motionRevision: source.motionRevision };
  const controller = buildPrePitchRunnerController(source, canonical);
  return freeze({ source, binding, person, canonical, controller });
};
