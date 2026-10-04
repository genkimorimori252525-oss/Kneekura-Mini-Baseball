import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { BallWorldPlayerBaseContactSegment } from '../../core/sim/ball/BallWorldPlayerBaseContactHistory';
import { deriveFirstBattedWorldContact } from '../../core/sim/ball/BattedBallWorldContacts';
import { buildPrePitchRunnerController } from './PrePitchRunnerExecution';
import { originalBattedWorldActorKinematics } from './BattedWorldOriginalActorKinematics';
import type { DurableBattedWorldContact } from './SqliteBattedWorldContactStore';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

export type OriginalContactActorAuthority = Readonly<{
  owner: 'batted_world_contacts' | 'physical_pitch_progress_actions'; sourceId: string; sourceVersion: string; sourceHash: string;
  runnerSourceId?: string; runnerSourceHash?: string; acceptedThroughTick: number;
}>;
export type BattedWorldOriginalContactPrefix = Readonly<{
  version: 'owned_runner_original_contact_prefix_v1'; gameId: string; physicalPitchSourceId: string; worldContactSourceId: string;
  at: Readonly<{ originTick: number; elapsedSeconds: number; tick: number }>; ticksPerSecond: number;
  participants: readonly Readonly<{ playerId: string; personId: string; personLinkSourceId: string; role: 'batter' | 'defender' | 'runner';
    bindingHash: string; personHash: string; authority: OriginalContactActorAuthority }>[];
  segments: readonly BallWorldPlayerBaseContactSegment[];
  dependencyHashes: Readonly<{ physicalPitch: string; worldContact: string; model: string }>;
}>;
const roles = ['body', 'glove', 'left_foot', 'right_foot', 'tag_hand'];

/** Read-only prefix of the already owned original contact. It grants no field/renewal/rule authority. */
export const battedWorldOriginalContactPrefix = (raw: DurableBattedWorldContact): BattedWorldOriginalContactPrefix => {
  const world = cloneInert(raw), pitch = world.flight.physicalPitch, frame = pitch.frame, batter = frame.batterActor, runner = frame.prePitchRunner;
  const originTick = world.flight.flight.contact.tick, throughTick = originTick + world.flight.source.searchDurationTicks;
  const ticksPerSecond = world.flight.source.execution.ballFlightParameters.ticksPerSecond;
  if (world.source.kind !== 'owned_runner_contact_v1' || !batter || !runner
    || world.source.prePitchRunnerSourceId !== runner.source.sourceId || runner.source.physicalActorSourceId !== batter.source.sourceId
    || world.source.flightSourceId !== world.flight.source.sourceId || world.source.modelSourceId !== world.model.sourceId
    || world.flight.source.physicalPitchSourceId !== pitch.source.sourceId || pitch.source.gameId !== frame.gameId
    || world.model.gameId !== frame.gameId || batter.source.gameId !== frame.gameId || runner.source.gameId !== frame.gameId
    || runner.source.playerId !== runner.binding.playerId
    || json(pitch.source.prePitchRunner) !== json(runner.source) || json(batter.world) !== json(frame.world) || json(batter.match) !== json(frame.match)
    || frame.world.runners.length !== 1 || frame.world.runners[0].playerId !== runner.binding.playerId
    || Object.values(frame.match.bases).filter(p => p !== null).length !== 1 || !Object.values(frame.match.bases).includes(runner.binding.playerId)) {
    throw new Error('original contact runner ownership or frame differs');
  }
  const canonical = { playerId: frame.world.runners[0].playerId, tick: frame.world.tick, position: frame.world.runners[0].position,
    velocity: frame.world.runners[0].velocity, bodyMode: 'upright' as const, motionRevision: runner.source.motionRevision };
  if (json(runner.canonical) !== json(canonical) || json(runner.controller) !== json(buildPrePitchRunnerController(runner.source, canonical))) {
    throw new Error('original contact runner controller differs');
  }
  const bindings = [...batter.defenderBindings, batter.binding, runner.binding];
  if (bindings.length !== 11 || new Set(bindings.map(b => b.playerId)).size !== 11 || new Set(bindings.map(b => b.personId)).size !== 11
    || world.actors.length !== 55 || world.source.commands.length !== 10 || new Set(world.source.commands.map(c => c.playerId)).size !== 10
    || world.source.commands.some(c => ![...batter.defenderBindings, batter.binding].some(b => b.playerId === c.playerId))
    || world.actors.some(a => !bindings.some(b => b.playerId === a.playerId))) throw new Error('original contact participant coverage differs');
  const participants = bindings.map(binding => {
    const role = binding.playerId === runner.binding.playerId ? 'runner' as const : binding.playerId === batter.binding.playerId ? 'batter' as const : 'defender' as const;
    const person = role === 'runner' ? runner.person : role === 'batter' ? batter.person : batter.defenderPersons.find(p => p.playerId === binding.playerId);
    const model = world.model.actors.filter(a => a.playerId === binding.playerId), parts = world.actors.filter(a => a.playerId === binding.playerId);
    if (!person || binding.gameId !== frame.gameId || binding.fixtureEventId !== batter.binding.fixtureEventId
      || binding.careerId !== batter.binding.careerId || binding.competitionEditionId !== batter.binding.competitionEditionId || binding.gameDay !== batter.binding.gameDay
      || model.length !== 1 || model[0].personId !== binding.personId || person.personId !== binding.personId || person.sourceId !== binding.personLinkSourceId
      || world.modelActorEvidence.filter(e => json(e) === json({ binding, person })).length !== 1
      || parts.length !== 5 || parts.map(a => a.primitive.role).sort().join('|') !== roles.join('|')
      || model[0].primitives.map(p => p.role).sort().join('|') !== roles.join('|')) throw new Error('original contact Player/Person/body identity differs');
    const actual = originalBattedWorldActorKinematics(world, binding.playerId);
    if (actual.primitives.some(part => json(parts.find(p => p.primitive.role === part.primitive.role)) !== json(part))) {
      throw new Error('original contact canonical primitive differs');
    }
    const authority: OriginalContactActorAuthority = role === 'runner'
      ? { owner: 'physical_pitch_progress_actions', sourceId: pitch.source.sourceId, sourceVersion: pitch.source.sourceVersion,
        sourceHash: hash(pitch.source), runnerSourceId: runner.source.sourceId, runnerSourceHash: hash(runner.source), acceptedThroughTick: runner.source.coverageThroughTick }
      : { owner: 'batted_world_contacts', sourceId: world.source.sourceId, sourceVersion: world.source.sourceVersion,
        sourceHash: hash(world.source), acceptedThroughTick: throughTick };
    return { playerId: binding.playerId, personId: binding.personId, personLinkSourceId: binding.personLinkSourceId, role,
      bindingHash: hash(binding), personHash: hash(person), authority };
  });
  const actual = deriveFirstBattedWorldContact({ flight: world.flight.flight, parameters: world.flight.source.execution.ballFlightParameters,
    throughTick, actors: world.actors, surfaces: world.model.surfaces });
  if (json(actual) !== json(world.result)) throw new Error('original contact executed horizon or result differs');
  const tick = actual.kind === 'contact' ? actual.tick : actual.throughTick, elapsedSeconds = (tick - originTick) / ticksPerSecond;
  return freeze({ version: 'owned_runner_original_contact_prefix_v1', gameId: frame.gameId, physicalPitchSourceId: pitch.source.sourceId,
    worldContactSourceId: world.source.sourceId, at: { originTick, elapsedSeconds, tick }, ticksPerSecond, participants,
    segments: [{ originTick, startElapsedSeconds: 0, endElapsedSeconds: elapsedSeconds, actors: world.actors }],
    dependencyHashes: { physicalPitch: hash(pitch), worldContact: hash(world), model: hash(world.model) } });
};
