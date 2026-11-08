import { assertLegacyBallPhysicsConsumer, CONTINUOUS_AERO_GROUND_BATTED_FLIGHT_SOURCE_VERSION } from '../../core/sim/ball/VersionedBattedBallPhysics';
import type { SourceFreeBallDescriptorV2 } from '../../core/sim/ball/SourceFreeBallKernel';
import type { DurableBattedBallFlight } from './SqliteBattedBallFlightStore';
import type { DurableBattedWorldContact } from './SqliteBattedWorldContactStore';
import { assertSupportedBattedWorldConsumer } from './BattedWorldRunnerConsumerBoundary';

export const CONTINUOUS_AERO_GROUND_BATTED_WORLD_SOURCE_VERSION = 'batted_world_contact_aero_ground_continuous_v2';
export const CONTINUOUS_AERO_GROUND_TOUCH_SOURCE_VERSION = 'batted_first_touch_aero_ground_continuous_v2';
export const CONTINUOUS_AERO_GROUND_RESPONSE_SOURCE_VERSION = 'batted_response_aero_ground_continuous_v2';
export const CONTINUOUS_AERO_GROUND_CONTINUATION_SOURCE_VERSION = 'batted_continuation_aero_ground_continuous_v2';

/** The original contact owns the root clock and lattice, including across horizon extensions. */
export const battedWorldFlightSourceCurve = (flight: DurableBattedBallFlight): SourceFreeBallDescriptorV2 | undefined => {
  if (flight.source.sourceVersion !== CONTINUOUS_AERO_GROUND_BATTED_FLIGHT_SOURCE_VERSION) {
    assertLegacyBallPhysicsConsumer(flight.source.sourceVersion, flight.source.execution.ballPhysics, 'first_world_contact');
    return undefined;
  }
  if (!flight.source.execution.ballPhysics) throw new Error('continuous World flight profile is missing');
  const initial = flight.flight.initialBall;
  return { kind: 'aero_ground_continuous_source_kernel_v2', initial: { originTick: initial.tick, elapsedSeconds: 0, ball: initial },
    throughElapsedSeconds: flight.source.searchDurationTicks / flight.source.execution.ballFlightParameters.ticksPerSecond,
    profile: flight.source.execution.ballPhysics };
};

/** Only a consumer with its own exact opt-in Source can use the new curve.
 * Runner, field/custody, renewal and rule capabilities remain separate. */
export const battedWorldConsumerSourceCurve = (world: DurableBattedWorldContact, consumer: string,
  sourceVersion: string, requiredVersion: string): SourceFreeBallDescriptorV2 | undefined => {
  const curve = battedWorldFlightSourceCurve(world.flight);
  if ((curve !== undefined) !== (sourceVersion === requiredVersion)
    || curve && world.source.sourceVersion !== CONTINUOUS_AERO_GROUND_BATTED_WORLD_SOURCE_VERSION) {
    throw new Error(`nonlinear ${consumer} Source version differs`);
  }
  if (!curve) { assertSupportedBattedWorldConsumer(world, consumer); return undefined; }
  const frame = world.flight.physicalPitch.frame;
  if (world.source.kind === 'owned_runner_contact_v1' || frame.prePitchRunner
    || world.flight.physicalPitch.source.prePitchRunner || frame.world.runners.length
    || Object.values(frame.match.bases).some(playerId => playerId !== null)) {
    throw new Error(`unsupported original pre-pitch runner consumer: ${consumer}`);
  }
  return curve;
};
