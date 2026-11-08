import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { DEFAULT_BALL_FLIGHT_PARAMETERS } from '../../core/sim/ball/BallFlight';
import { REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS } from '../../core/sim/ball/BaseballAerodynamics';
import { createFairTerritoryWedge } from '../../core/sim/ball/FairTerritoryGeometry';
import { CONTINUOUS_AERO_GROUND_BATTED_FLIGHT_SOURCE_VERSION, type AeroGroundBallPhysicsV1 } from '../../core/sim/ball/VersionedBattedBallPhysics';
import { createWorldBoundOriginalContactsV190 } from './WorldBoundOriginalContactsV190.test-support';
import { readOriginalPhysicalPitchPrefixFromSqlite } from './PhysicalPitchEvidenceFromSqlite';
import { readNativeMeasuredOriginalPitchContactV183FromSqlite } from './NativeMeasuredOriginalPitchContactV183';
import type { NativeMeasuredOriginalPitchContactV183 } from './NativeMeasuredOriginalPitchContactV183';
import { battedBallFlightEvidenceFromSqlite, openSqliteBattedBallFlightStore, type AcceptedBattedBallFlight } from './SqliteBattedBallFlightStore';
import { withBattedVenueLegalReadSnapshot } from './SqliteBattedVenueLegalPolicyStore';
import { withSamePaLifecycleReadPhase } from './SamePlateAppearanceLifecycleFromSqlite';
import { openSqliteNativeBattingContactObservationStoreV188 } from './SqliteNativeBattingContactObservationStoreV188';

/** The display label is deliberately absent from this normal Native read path. */
export function readNativeLineDriveFlightV191(db: DatabaseSync, sourceId: string, reference: NativeMeasuredOriginalPitchContactV183['reference']) {
  return withBattedVenueLegalReadSnapshot(db, () => withSamePaLifecycleReadPhase(db, () => {
    const contact = readNativeMeasuredOriginalPitchContactV183FromSqlite(db, reference);
    const flight = battedBallFlightEvidenceFromSqlite(db).read(sourceId);
    if (!contact || !flight || flight.source.physicalPitchSourceId !== reference.sourceId) throw new Error('V191 original contact/flight is missing or differs');
    return Object.freeze({ contact, flight });
  }));
}

/** Authored Native placement plus the existing continuous Aero/ground profile.
 * The historical file name does not classify this bunt as a line drive or prove normal AI. */
export function prepareNativeLineDriveFlightV191(path: string) {
  const fixture = createWorldBoundOriginalContactsV190(path), chosen = fixture.contacts[0]!;
  const { DatabaseSync: Native } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new Native(path);
  let flights: ReturnType<typeof openSqliteBattedBallFlightStore> | undefined;
  let observations: ReturnType<typeof openSqliteNativeBattingContactObservationStoreV188> | undefined;
  try {
    const physical = withBattedVenueLegalReadSnapshot(db, () => readOriginalPhysicalPitchPrefixFromSqlite(db, chosen.reference.sourceId).at(-1));
    const initialWorld = physical?.frame.initialWorld;
    if (!physical || !initialWorld || !physical.frame.batterActor) throw new Error('V191 requires an original Native actor and initial World');
    const rawPitch = db.prepare('SELECT source_json,source_hash,snapshot_json,snapshot_hash FROM main.physical_pitch_progress_actions WHERE source_id=?').get(chosen.reference.sourceId)!;
    const venue = db.prepare('SELECT venue_id FROM main.official_fixtures WHERE game_id=?').get(chosen.gameId);
    if (!venue || typeof venue.venue_id !== 'string') throw new Error('V191 original venue is missing');
    const parameters = { ...DEFAULT_BALL_FLIGHT_PARAMETERS, groundRollingDecelerationMps2: 4 };
    // Values and contract match the existing VersionedBattedBallFlightSource Native fixture.
    const ballPhysics: AeroGroundBallPhysicsV1 = { kind: 'aero_ground_v1',
      air: { ticksPerSecond: parameters.ticksPerSecond, integrationStepTicks: parameters.integrationStepTicks,
        gravityY: parameters.gravityY, aerodynamics: REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS },
      ground: { ticksPerSecond: 1_000_000, gravityMps2: 9.81, radiusM: 0.0366, inertiaRatio: 0.378,
        restingVerticalSpeedMps: 0.15, material: { restitution: 0.4, slidingFriction: 0.25,
          rollingDecelerationMps2: 1, normalSpinDecayPerSecond: 0.5 } } };
    const ray = (point: { x: number; z: number }) => { const length = Math.hypot(point.x, point.z); return { x: point.x / length, z: point.z / length }; };
    const centers = initialWorld.source.worldSetup.baseCenters;
    const source: AcceptedBattedBallFlight = { sourceId: 'native-label-invariance-flight-v191', sourceVersion: CONTINUOUS_AERO_GROUND_BATTED_FLIGHT_SOURCE_VERSION,
      physicalPitchSourceId: chosen.reference.sourceId, previousFlightSourceId: null, searchDurationTicks: 2_000_000,
      execution: { venueId: venue.venue_id, availableAtDay: 1, field: createFairTerritoryWedge({ homePlate: { x: 0, z: 0 },
        firstBaseLineUnit: ray(centers.first), thirdBaseLineUnit: ray(centers.third) }), ballFlightParameters: parameters, ballPhysics } };
    flights = openSqliteBattedBallFlightStore(path, { readAcceptedPitch: id => withBattedVenueLegalReadSnapshot(db,
      () => readOriginalPhysicalPitchPrefixFromSqlite(db, id).at(-1) ?? null) }, { readAcceptedFlight: id => id === source.sourceId ? source : null });
    const accepted = flights.accept(source.sourceId), original = readNativeLineDriveFlightV191(db, source.sourceId, chosen.reference);
    observations = openSqliteNativeBattingContactObservationStoreV188(path);
    const captured = observations.capture(fixture.scope, { careerCalendarEditionId: fixture.careerCalendarEditionId });
    if (!captured || captured.receipts.length !== 2) throw new Error('V191 requires the two formal Native contacts registered for its display report');
    return { reference: chosen.reference, scope: chosen.scope, seed: physical.source.request.delivery.matchSeed, source,
      accepted, original, rawPitch, registeredObservationSource: captured.source, registeredReceiptHashes: captured.receipts.map(receipt => receipt.receiptHash),
      fixtureAuthority: { ...fixture.fixtureAuthority,
        kind: 'EXPLICIT_NATIVE_LABEL_INVARIANCE_FLIGHT_FIXTURE_V191', physicalContactPlacement: 'EXISTING_AUTHORED_BUNT',
        physicalFlightVersion: CONTINUOUS_AERO_GROUND_BATTED_FLIGHT_SOURCE_VERSION, flightHorizonSeconds: 2,
        flightTerritoryIsProjectedOnly: true, displayLabelHasPhysicalAuthority: false } };
  } finally { observations?.close(); flights?.close(); db.close(); }
}
