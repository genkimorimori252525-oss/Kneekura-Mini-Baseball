import { playerObservationCalibrationFixture } from '../../core/sim/perception/PlayerObservationCalibrationFixtures.test-support';
import type { AcceptedActualFirstBaseUmpireSetup, AcceptedActualFirstBaseUmpireObservation, AcceptedActualFirstBaseUmpireCall } from './ActualFirstBaseUmpire';
import { openSqliteActualFirstBaseUmpireStore } from './SqliteActualFirstBaseUmpireStore';
import { battedWorldFieldRaceFixture } from './BattedWorldFieldRaceFixtures.test-support';

/** Explicit synthetic timing ranges, static pose and attention only. */
export const actualFirstBaseUmpireFixture = (configure?: (setup: AcceptedActualFirstBaseUmpireSetup) => AcceptedActualFirstBaseUmpireSetup,
  defenderSeconds = 0.04, batterSeconds = 0.08, throughSeconds = 0.1, databasePath?: string) => {
  const x = battedWorldFieldRaceFixture(databasePath, defenderSeconds, batterSeconds, throughSeconds);
  x.sources.set(x.source.sourceId, { ...x.source, action: { kind: 'first_base_race', custodyPolicy: 'release_exclusive_v1' } });
  const race = x.executions.accept(x.source.sourceId), world = x.baseField.response.touch.worldContact;
  const p = playerObservationCalibrationFixture(), center = x.geometry.geometry.baseGeometry.bases.first.region.center;
  const setup: AcceptedActualFirstBaseUmpireSetup = { sourceId: 'first-base-umpire-setup', sourceVersion: 'synthetic-v1',
    gameId: x.baseField.response.model.gameId, physicalPitchSourceId: world.flight.source.physicalPitchSourceId, umpireId: 'umpire-1',
    pose: { version: 'static_first_base_view_v1', position: { ...center, y: 20 }, forward: { x: 0, y: -1, z: 0 },
      validFromElapsedSeconds: 0, validThroughElapsedSeconds: 10 }, attention: { control: 1, touch: 1 },
    calibration: { version: 'first_base_timing_triangular_v1', perceptionAbility: 0.8, callDelaySeconds: 0,
      geometryParameters: { ...p.geometryParameters, fullQualityHalfAngleRadians: Math.PI - 0.01, maxVisibleHalfAngleRadians: Math.PI,
        fullQualityDistanceMeters: 100, maxObservableDistanceMeters: 1000, fullQualityRelativeSpeedMps: 100000, maxRelativeSpeedMps: 1000000 },
      qualityParameters: p.qualityParameters,
      timingErrorParameters: { minimumDetectionQuality: 0.1, minimumTimeErrorSeconds: 0, maximumTimeErrorSeconds: 0 } } };
  const selected = configure?.(setup) ?? setup, setups = new Map([[selected.sourceId, selected]]);
  const observation: AcceptedActualFirstBaseUmpireObservation = { sourceId: 'first-base-umpire-observation', sourceVersion: 'synthetic-v1',
    setupSourceId: selected.sourceId, ruleExecutionSourceId: race.source.sourceId };
  const observations = new Map([[observation.sourceId, observation]]);
  const call: AcceptedActualFirstBaseUmpireCall = { sourceId: 'first-base-umpire-call', sourceVersion: 'synthetic-v1',
    observationSourceId: observation.sourceId, currentExecutionSourceId: race.source.sourceId };
  const calls = new Map([[call.sourceId, call]]);
  const authority = { readAcceptedSetup: (id: string) => setups.get(id) ?? null,
    readAcceptedObservation: (id: string) => observations.get(id) ?? null, readAcceptedCall: (id: string) => calls.get(id) ?? null };
  const umpires = x.f.track(openSqliteActualFirstBaseUmpireStore(x.f.path, authority));
  return { ...x, race, setup: selected, observation, call, setups, observations, calls, authority, umpires };
};
