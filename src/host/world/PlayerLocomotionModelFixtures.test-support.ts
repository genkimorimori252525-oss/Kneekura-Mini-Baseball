import { playerFieldingModelFixture } from './PlayerFieldingModelFixtures.test-support';
import { playerLocomotionCalibrationFixture } from '../../core/sim/fielding/PlayerLocomotionCalibrationFixtures.test-support';
import { openSqlitePlayerLocomotionModelStore, type AcceptedPlayerLocomotionModel } from './SqlitePlayerLocomotionModelStore';

export const playerLocomotionModelFixture = () => {
  const f = playerFieldingModelFixture();
  f.sources.set(f.source.sourceId, { ...f.source, ratings: { ...f.source.ratings, acceleration: 0.25, routeEfficiency: 0.75 } });
  const fieldingModel = f.models.accept(f.source.sourceId);
  const source: AcceptedPlayerLocomotionModel = {
    sourceId: 'locomotion-a', capability: 'defender_locomotion_v1', sourceVersion: 'synthetic-locomotion-v1', careerId: 'career-a', playerId: 'player-a',
    personLinkSourceId: f.person.sourceId, fieldingModelSourceId: fieldingModel.source.sourceId,
    acceptedAtDay: 11, calibration: playerLocomotionCalibrationFixture(),
  };
  const sources = new Map([[source.sourceId, source]]), authority = { readAcceptedModel: (id: string) => sources.get(id) ?? null };
  const models = f.track(openSqlitePlayerLocomotionModelStore(f.path, authority));
  return { ...f, fieldingModel, fieldingModels: f.models, source, sources, authority, models };
};
