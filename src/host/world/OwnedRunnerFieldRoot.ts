import type { BattedBallContactResponseInput } from '../../core/sim/ball/BattedBallContactResponse';
import { deriveBattedBallContactResponse } from '../../core/sim/ball/BattedBallContactResponse';
import { battedWorldOriginalContactPrefix } from './BattedWorldOriginalContactPrefix';
import type { DurableBattedWorldContact } from './SqliteBattedWorldContactStore';
import type { DurableBattedContactResponse } from './SqliteBattedContactResponseStore';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

export type OwnedRunnerFieldRootCapability = Readonly<{ kind?: never; prePitchRunnerSourceId?: never }>
  | Readonly<{ kind: 'owned_runner_field_root_v1'; prePitchRunnerSourceId: string }>;

/** Only the authenticated, unadvanced original contact can seed this field capability. */
export const assertOwnedRunnerFieldRoot = (world: DurableBattedWorldContact, prePitchRunnerSourceId: string): void => {
  const prefix = battedWorldOriginalContactPrefix(world), initial = world.flight.flight.initialBall;
  if (world.source.prePitchRunnerSourceId !== prePitchRunnerSourceId
    || world.flight.source.searchDurationTicks !== 0 || world.source.previousContactSourceId !== null
    || prefix.at.elapsedSeconds !== 0 || prefix.at.tick !== initial.tick
    || world.result.kind !== 'airborne' || world.result.throughTick !== initial.tick || json(world.result.ball) !== json(initial)) {
    throw new Error('owned runner field requires its unadvanced original contact and runner Source');
  }
};

/** Field-only calibration adapter. It grants no legacy continuation, custody or rule capability. */
export const ownedRunnerFieldResponseInput = (response: DurableBattedContactResponse): BattedBallContactResponseInput => {
  const world = response.touch.worldContact, source = response.source, touch = response.touch.source;
  if (source.kind !== 'owned_runner_field_root_v1' || touch.kind !== 'owned_runner_field_root_v1'
    || source.prePitchRunnerSourceId !== touch.prePitchRunnerSourceId || source.firstFielderTouchSourceId !== touch.sourceId
    || touch.worldContactSourceId !== world.source.sourceId || source.responseModelSourceId !== response.model.sourceId) {
    throw new Error('owned runner field response capability or original Source differs');
  }
  assertOwnedRunnerFieldRoot(world, source.prePitchRunnerSourceId);
  const input: BattedBallContactResponseInput = { world: { flight: world.flight.flight,
    parameters: world.flight.source.execution.ballFlightParameters, throughTick: world.flight.flight.initialBall.tick,
    actors: world.actors, surfaces: world.model.surfaces },
    actors: response.model.actors.filter(actor => world.actors.some(original => original.playerId === actor.playerId))
      .flatMap(actor => actor.primitives.map(profile => ({ playerId: actor.playerId, profile }))), surfaces: response.model.surfaces };
  const actual = deriveBattedBallContactResponse(input);
  if (actual.kind !== 'airborne' || json(actual) !== json(response.result)
    || response.touch.result.kind !== 'unresolved' || response.touch.result.reason !== 'airborne'
    || json(response.touch.result.timeline) !== json(world.timeline)) {
    throw new Error('owned runner field original response or timeline differs');
  }
  return input;
};
