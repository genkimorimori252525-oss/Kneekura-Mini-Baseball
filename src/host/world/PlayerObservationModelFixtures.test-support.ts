import { playerFieldingModelFixture } from './PlayerFieldingModelFixtures.test-support';
import { playerObservationCalibrationFixture } from '../../core/sim/perception/PlayerObservationCalibrationFixtures.test-support';
import { openSqlitePlayerObservationModelStore, type AcceptedPlayerObservationModel } from './SqlitePlayerObservationModelStore';

export const playerObservationModelFixture = () => {
  const f = playerFieldingModelFixture(), fieldingModel = f.models.accept(f.source.sourceId);
  const source: AcceptedPlayerObservationModel = {
    sourceId: 'observation-a', sourceVersion: 'synthetic-observation-v1', careerId: 'career-a', playerId: 'player-a',
    personLinkSourceId: f.person.sourceId, fieldingModelSourceId: fieldingModel.source.sourceId,
    acceptedAtDay: 11, calibration: playerObservationCalibrationFixture(),
  };
  const sources = new Map([[source.sourceId, source]]), authority = { readAcceptedModel: (id: string) => sources.get(id) ?? null };
  const models = f.track(openSqlitePlayerObservationModelStore(f.path, authority));
  return { ...f, fieldingModel, fieldingModels: f.models, source, sources, authority, models };
};
