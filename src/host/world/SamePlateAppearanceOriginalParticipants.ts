import type { DatabaseSync } from 'node:sqlite';
import type { OfficialParticipantBinding } from './SqliteOfficialParticipationStore';
import { actorFreeze as freeze, actorJson as json, readPhysicalActorBinding, type DurablePhysicalPlateAppearanceActor } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { readOfficialActorPersonLink } from './SqliteOfficialInitialWorldStore';
import { assertNationalMatchBindings } from './NationalMatchOriginFromSqlite';
import { samePaStartingBaseCenters } from './SamePlateAppearanceLifecycleStartingGeometry';
export type SamePaOriginalParticipant = Readonly<{ binding: OfficialParticipantBinding; person: DurablePhysicalPlateAppearanceActor['person']; role: 'batter' | 'defender' | 'runner'; startingBase: null | 1 | 2 | 3 }>;
/** Internal same-connection composition of an already authenticated original
 * actor. No actor archive is expanded and no current body/position is inferred. */
export const readSamePaOriginalParticipants = (db: Pick<DatabaseSync, 'prepare'>, actor: DurablePhysicalPlateAppearanceActor): readonly SamePaOriginalParticipant[] => {
  const participants: SamePaOriginalParticipant[] = [{ binding: actor.binding, person: actor.person, role: 'batter', startingBase: null },
    ...actor.defenderBindings.map(binding => ({ binding, person: actor.defenderPersons.find(p => p.playerId === binding.playerId)!, role: 'defender' as const, startingBase: null }))];
  const bases = (['first', 'second', 'third'] as const).flatMap((key, i) => actor.match.bases[key] === null ? [] : [{ key, playerId: actor.match.bases[key]!, base: (i + 1) as 1 | 2 | 3 }]);
  if (actor.world.defenders.length !== 9 || actor.defenderBindings.length !== 9 || new Set(actor.world.defenders.map(p => p.playerId)).size !== 9
    || actor.defenderBindings.some(b => !actor.world.defenders.some(p => p.playerId === b.playerId))
    || actor.world.runners.length !== bases.length || new Set(bases.map(b => b.playerId)).size !== bases.length
    || new Set(actor.world.runners.map(r => r.playerId)).size !== bases.length
    || actor.world.runners.some(r => !bases.some(b => b.playerId === r.playerId))) throw new Error('same-PA original participant Match/World membership differs');
  if (bases.length) {
    const centers = samePaStartingBaseCenters(db, actor), battingSide = actor.match.half === 'top' ? 'AWAY' : 'HOME';
    const battingClub = battingSide === 'HOME' ? actor.worldFixture.game.homeClubId : actor.worldFixture.game.awayClubId;
    for (const base of bases) {
      const binding = readPhysicalActorBinding(db, actor.source.gameId, base.playerId), person = readOfficialActorPersonLink(db, binding);
      const runner = actor.world.runners.find(r => r.playerId === base.playerId)!;
      if (binding.side !== battingSide || binding.clubId !== battingClub || json(runner.position) !== json(centers[base.key])
        || json(runner.velocity) !== json({ x: 0, z: 0 })) throw new Error('same-PA original runner binding or setup differs');
      participants.push({ binding, person, role: 'runner', startingBase: base.base });
    }
    assertNationalMatchBindings(db, participants.map(p => p.binding));
  }
  if (new Set(participants.map(p => p.binding.playerId)).size !== participants.length || new Set(participants.map(p => p.binding.personId)).size !== participants.length
    || participants.some(({binding:b,person:p}) => b.careerId !== actor.binding.careerId || b.gameId !== actor.source.gameId || b.gameDay !== actor.binding.gameDay
      || b.fixtureEventId !== actor.binding.fixtureEventId || b.competitionEditionId !== actor.binding.competitionEditionId
      || !p || p.playerId !== b.playerId || p.personId !== b.personId || p.sourceId !== b.personLinkSourceId || p.careerId !== b.careerId)) throw new Error('same-PA original participant binding or Person differs');
  return freeze(participants);
};
