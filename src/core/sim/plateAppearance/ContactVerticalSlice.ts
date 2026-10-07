import type {
  BaserunnerWorldState,
  CanonicalWorldSnapshot,
  DefenderWorldState,
} from '../../model/CanonicalWorldSnapshot';
import type { TimedMatchEvent } from '../../model/TimedMatchEvent';
import type { Vec3 } from '../../model/geometry';
import {
  DEFAULT_CONTACT_PARAMETERS,
  resolveBatBallContact,
  type BatBallContactResult,
  type BatterSwingState,
  type BattedBallInitialState,
  type ContactParameters,
  type PitchWorldState,
} from '../contact/BatBallContact';
import {
  DEFAULT_BALL_FLIGHT_PARAMETERS,
  sampleBallFlight,
  type BallFlightParameters,
} from '../ball/BallFlight';

export type BatBallContactEventPayload = Readonly<{
  point: Vec3;
  liveBattedBall: true;
}>;

export type ContactVerticalSliceInput = Readonly<{
  pitch: PitchWorldState;
  swing: BatterSwingState;
  defenders: readonly DefenderWorldState[];
  runners: readonly BaserunnerWorldState[];
  durationTicks: number;
  cadenceTicks: number;
  contactParameters?: ContactParameters;
  ballFlightParameters?: BallFlightParameters;
}>;

export type ContactVerticalSliceResult = Readonly<{
  contact: BatBallContactResult;
  initialBall: BattedBallInitialState;
  snapshots: readonly CanonicalWorldSnapshot[];
  events: readonly TimedMatchEvent<'BatBallContact', BatBallContactEventPayload>[];
}>;

export const simulateContactVerticalSlice = (
  input: ContactVerticalSliceInput,
): ContactVerticalSliceResult => {
  const contact = resolveBatBallContact(
    input.pitch,
    input.swing,
    input.contactParameters ?? DEFAULT_CONTACT_PARAMETERS,
  );

  if (contact === null) {
    throw new Error('contact vertical slice requires a physical bat-ball contact');
  }

  const initialBall: BattedBallInitialState = {
    tick: input.pitch.tick,
    position: input.pitch.position,
    velocity: contact.exitVelocity,
    spin: contact.exitSpin,
  };

  const flightSamples = sampleBallFlight(
    initialBall,
    input.durationTicks,
    input.cadenceTicks,
    input.ballFlightParameters ?? DEFAULT_BALL_FLIGHT_PARAMETERS,
  );

  const snapshots: CanonicalWorldSnapshot[] = flightSamples.map((sample) => ({
    tick: sample.tick,
    defenders: input.defenders,
    runners: input.runners,
    ball: {
      position: sample.position,
      velocity: sample.velocity,
      spin: sample.spin,
    },
  }));

  const event: TimedMatchEvent<'BatBallContact', BatBallContactEventPayload> = {
    tick: contact.tick,
    sequence: 0,
    kind: 'BatBallContact',
    payload: {
      point: contact.point,
      liveBattedBall: true,
    },
  };

  return {
    contact,
    initialBall,
    snapshots,
    events: [event],
  };
};
