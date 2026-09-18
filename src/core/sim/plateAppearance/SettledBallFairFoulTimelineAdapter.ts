import {
  resolveUntouchedSettledBattedBallTerritory,
  type UntouchedSettledBattedBallTerritoryResult,
} from '../../rules/FairFoulSettledBallRule';
import {
  findBattedBallSettlingEvidence,
  type BattedBallSettlingEvidence,
} from '../ball/BattedBallSettlingEvidence';
import type {
  BallFlightParameters,
} from '../ball/BallFlight';
import type {
  BattedBallFlightEvidence,
} from '../ball/BattedBallFlightEvidence';
import type {
  FairFoulBaseGateGeometry,
} from '../ball/FairFoulBaseGateGeometry';
import type {
  FairTerritoryWedge,
} from '../ball/FairTerritoryGeometry';
import {
  recordBattedBallSettlingEvidence,
  recordFairBattedBall,
  recordFoulBattedBall,
  type CanonicalPlateAppearanceTimeline,
} from './CanonicalPlateAppearanceTimeline';

export type SettledBallFairFoulTimelineInput = Readonly<{
  timeline: CanonicalPlateAppearanceTimeline;
  flight: BattedBallFlightEvidence;
  field: FairTerritoryWedge;
  bases: FairFoulBaseGateGeometry;
  searchDurationTicks: number;
  ballFlightParameters: BallFlightParameters;
  buntAttempt: boolean;
  noPriorFielderTouch: true;
  noPriorFirstOrThirdBaseTouch: true;
  noPriorBaseGatePassage: true;
}>;

export type SettledBallFairFoulTimelineResult =
  | Readonly<{
      kind: 'fair';
      timeline: CanonicalPlateAppearanceTimeline;
      settling: BattedBallSettlingEvidence;
      rule: UntouchedSettledBattedBallTerritoryResult;
    }>
  | Readonly<{
      kind: 'foul';
      timeline: CanonicalPlateAppearanceTimeline;
      settling: BattedBallSettlingEvidence;
      rule: UntouchedSettledBattedBallTerritoryResult;
    }>
  | Readonly<{
      kind: 'not_settled';
      timeline: CanonicalPlateAppearanceTimeline;
    }>;

const sameNumber = (
  first: number,
  second: number,
): boolean => (
  Math.abs(first - second) <= 1e-12
);

const sameVec3 = (
  first: Readonly<{ x: number; y: number; z: number }>,
  second: Readonly<{ x: number; y: number; z: number }>,
): boolean => (
  sameNumber(first.x, second.x)
  && sameNumber(first.y, second.y)
  && sameNumber(first.z, second.z)
);

const validateFlightMatchesTimeline = (
  timeline: CanonicalPlateAppearanceTimeline,
  flight: BattedBallFlightEvidence,
): void => {
  const contactEvent = [...timeline.events]
    .reverse()
    .find((event) => event.kind === 'BatBallContact');

  if (
    contactEvent === undefined
    || contactEvent.kind !== 'BatBallContact'
    || contactEvent.payload.contact.tick
      !== flight.contact.tick
    || !sameVec3(
      contactEvent.payload.contact.ballCenter,
      flight.contact.ballCenter,
    )
    || !sameVec3(
      contactEvent.payload.contact.exitVelocity,
      flight.contact.exitVelocity,
    )
    || !sameVec3(
      contactEvent.payload.contact.exitSpin,
      flight.contact.exitSpin,
    )
  ) {
    throw new Error(
      'batted-ball flight evidence must match the timeline BatBallContact',
    );
  }

  if (flight.firstGroundContact === null) {
    throw new Error(
      'settled-ball fair/foul resolution requires first-ground contact evidence',
    );
  }

  const groundEvent = [...timeline.events]
    .reverse()
    .find((event) => (
      event.kind === 'BattedBallFirstGroundContact'
    ));

  if (
    groundEvent === undefined
    || groundEvent.kind !== 'BattedBallFirstGroundContact'
    || groundEvent.payload.evidence.tick
      !== flight.firstGroundContact.tick
    || !sameNumber(
      groundEvent.payload.evidence.position.x,
      flight.firstGroundContact.state.position.x,
    )
    || !sameNumber(
      groundEvent.payload.evidence.position.z,
      flight.firstGroundContact.state.position.z,
    )
  ) {
    throw new Error(
      'batted-ball flight evidence must match the timeline first-ground contact',
    );
  }
};

export const resolveAndRecordSettledBeforeBaseTerritory = (
  input: SettledBallFairFoulTimelineInput,
): SettledBallFairFoulTimelineResult => {
  if (input.timeline.status.kind !== 'batted_ball_pending') {
    throw new Error(
      'settled-ball fair/foul resolution requires a pending batted ball',
    );
  }

  validateFlightMatchesTimeline(
    input.timeline,
    input.flight,
  );

  const settling = findBattedBallSettlingEvidence({
    flight: input.flight,
    field: input.field,
    searchDurationTicks: input.searchDurationTicks,
    parameters: input.ballFlightParameters,
  });

  if (settling === null) {
    return {
      kind: 'not_settled',
      timeline: input.timeline,
    };
  }

  const withSettling = recordBattedBallSettlingEvidence(
    input.timeline,
    settling,
  );
  const rule = resolveUntouchedSettledBattedBallTerritory({
    settling,
    field: input.field,
    bases: input.bases,
    ballRadiusMeters: input.flight.ballRadiusMeters,
    noPriorFielderTouch: input.noPriorFielderTouch,
    noPriorFirstOrThirdBaseTouch:
      input.noPriorFirstOrThirdBaseTouch,
    noPriorBaseGatePassage:
      input.noPriorBaseGatePassage,
  });

  if (rule.territory === 'fair') {
    return {
      kind: 'fair',
      settling,
      rule,
      timeline: recordFairBattedBall(
        withSettling,
        rule.decisiveTick,
      ),
    };
  }

  return {
    kind: 'foul',
    settling,
    rule,
    timeline: recordFoulBattedBall(
      withSettling,
      rule.decisiveTick,
      input.buntAttempt,
      null,
    ),
  };
};
