import { playerFieldingModelFixture } from './PlayerFieldingModelFixtures.test-support';
import { playerDecisionCalibrationFixture } from '../../core/sim/fielding/PlayerDecisionCalibrationFixtures.test-support';
import { openSqlitePlayerDecisionModelStore, type AcceptedPlayerDecisionModel } from './SqlitePlayerDecisionModelStore';

export const playerDecisionModelFixture = () => {
  const f = playerFieldingModelFixture(), fieldingModel = f.models.accept(f.source.sourceId);
  const source: AcceptedPlayerDecisionModel = {
    sourceId: 'decision-a', sourceVersion: 'synthetic-decision-v1', careerId: 'career-a', playerId: 'player-a',
    personLinkSourceId: f.person.sourceId, fieldingModelSourceId: fieldingModel.source.sourceId,
    acceptedAtDay: 11, calibration: playerDecisionCalibrationFixture(),
  };
  const sources = new Map([[source.sourceId, source]]), authority = { readAcceptedModel: (id: string) => sources.get(id) ?? null };
  const models = f.track(openSqlitePlayerDecisionModelStore(f.path, authority));
  return { ...f, fieldingModel, fieldingModels: f.models, source, sources, authority, models };
};
