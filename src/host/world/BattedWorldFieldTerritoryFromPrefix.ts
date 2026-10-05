import { deriveBallWorldFieldTerritory } from '../../core/rules/BallWorldFieldTerritory';
import type { BallWorldFieldTerritoryInput } from '../../core/rules/BallWorldFieldTerritory';
import type { BallWorldBattedRuleContact, BallWorldBattedRuleContactFrame } from '../../core/rules/BallWorldBattedRuleEvidence';
import type { BallWorldBaseBoundaryContact } from '../../core/sim/ball/BallWorldBaseBoundary';
import type { DurableBattedWorldFieldAction } from './SqliteBattedWorldFieldStore';
import { actorJson as json, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { assertSupportedBattedWorldConsumer } from './BattedWorldRunnerConsumerBoundary';

/** Native supplies only the own rederived prefix through the requested immutable action. */
export const battedWorldFieldTerritoryFromPrefix = (prefix: readonly DurableBattedWorldFieldAction[]) => {
  const value = prefix.at(-1);
  if (!value || prefix.length !== value.revision) throw new Error('actual field territory prefix is incomplete');
  const world = value.response.touch.worldContact, flight = world.flight, batter = flight.physicalPitch.frame.batterActor!;
  assertSupportedBattedWorldConsumer(world, 'field_territory');
  const contacts: BallWorldBattedRuleContactFrame[] = [], baseContacts: BallWorldBaseBoundaryContact[] = [];
  const groundSegments: NonNullable<BallWorldFieldTerritoryInput['groundSegments']>[number][] = [];
  const parameters = flight.source.execution.ballFlightParameters;
  for (const [index, action] of prefix.entries()) {
    if (action.revision !== index + 1 || action.source.previousFieldSourceId !== (prefix[index - 1]?.source.sourceId ?? null)
      || json(action.response) !== json(value.response) || json(action.geometry) !== json(value.geometry)) {
      throw new Error('actual field territory original scope differs');
    }
    const boundary = action.field.motion.world;
    const preceding = prefix[index - 1]?.field.motion.cursor?.moment;
    if (preceding && action.field.motion.carrierPlayerId === null && 'phase' in boundary && boundary.phase !== 'resting'
      && contacts.some((frame) => frame.contacts.some((c) => c.kind === 'ground'))) {
      groundSegments.push({ moment: preceding, throughElapsedSeconds: boundary.moment.elapsedSeconds,
        rollingDecelerationMps2: boundary.phase === 'airborne' ? 0 : parameters.groundRollingDecelerationMps2,
        ...(boundary.phase === 'airborne' ? { gravityY: parameters.gravityY } : {}) });
    }
    if (boundary.kind !== 'boundary') continue;
    const normalized: BallWorldBattedRuleContact[] = boundary.contacts.map((c) => c.kind === 'actor'
      ? { kind: 'actor', playerId: c.playerId, role: c.role } : c.kind === 'surface'
        ? { kind: 'surface', surfaceId: c.surfaceId } : { kind: c.kind });
    const previous = contacts.at(-1);
    if (previous?.moment.elapsedSeconds === boundary.moment.elapsedSeconds) {
      if (previous.moment.originTick !== boundary.moment.originTick || json(previous.moment.ball.position) !== json(boundary.moment.ball.position)) {
        throw new Error('coincident actual field positions differ');
      }
      const extra = normalized.filter((c) => !previous.contacts.some((old) => json(old) === json(c)));
      if (extra.length && json(previous.moment) !== json(boundary.moment)) throw new Error('coincident new actual field states differ');
      contacts[contacts.length - 1] = { moment: previous.moment, contacts: [...previous.contacts, ...extra] };
    } else contacts.push({ moment: boundary.moment, contacts: normalized });
    for (const contact of action.field.baseContacts) {
      if (!baseContacts.some((old) => old.baseId === contact.baseId && old.moment.elapsedSeconds === contact.moment.elapsedSeconds)) baseContacts.push(contact);
    }
  }
  for (const binding of [batter.binding, ...batter.defenderBindings]) {
    if (!world.modelActorEvidence.some((actor) => json(actor.binding) === json(binding))) throw new Error('actual field territory Player scope differs');
  }
  const geometry = value.geometry.geometry.baseGeometry;
  const horizon = value.field.motion.world.moment;
  const territory = deriveBallWorldFieldTerritory({ evidence: { batterRunnerId: batter.binding.playerId,
    defenderIds: batter.defenderBindings.map((binding) => binding.playerId), field: geometry.field, bases: geometry.gates,
    ballRadiusMeters: parameters.ballRadius, originTick: flight.flight.initialBall.tick, ticksPerSecond: parameters.ticksPerSecond,
    horizon, contacts, acquisitions: [] }, baseContacts, groundSegments });
  return freeze({ fieldSourceId: value.source.sourceId, responseSourceId: value.response.source.sourceId,
    physicalPitchSourceId: flight.source.physicalPitchSourceId, geometrySourceId: value.geometry.source.sourceId, horizon, territory });
};
