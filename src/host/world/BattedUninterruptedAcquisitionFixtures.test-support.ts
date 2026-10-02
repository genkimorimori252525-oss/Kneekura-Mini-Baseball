import { battedContactResponseFixture } from './BattedContactResponseFixtures.test-support';
import {
  openSqliteBattedUninterruptedAcquisitionStore,
  type AcceptedBattedUninterruptedAcquisition,
} from './SqliteBattedUninterruptedAcquisitionStore';

export const battedUninterruptedAcquisitionFixture = (
  path?: string,
  kind:
    | 'body'
    | 'glove'
    | 'failed_glove'
    | 'ground'
    | 'surface'
    | 'airborne'
    | 'simultaneous' = 'glove',
  captureDissipationPowerW = 1000,
) => {
  const base = battedContactResponseFixture(path, kind);
  const {
    f,
    responseModel,
    responseModels,
    responseSource,
    responses,
  } = base;

  if (captureDissipationPowerW !== 1000) {
    responseModels.set(responseModel.sourceId, {
      ...responseModel,
      actors: responseModel.actors.map((actor) => ({
        ...actor,
        primitives: actor.primitives.map((primitive) => (
          primitive.role === 'glove'
            ? {
                ...primitive,
                parameters: {
                  ...primitive.parameters,
                  captureDissipationPowerW,
                },
              }
            : primitive
        )),
      })),
    });
  }

  const response = responses.accept(responseSource.sourceId);
  const input: AcceptedBattedUninterruptedAcquisition = {
    sourceId: 'batted-acquisition',
    sourceVersion: 'fixture-v1',
    contactResponseSourceId: responseSource.sourceId,
  };
  const accepted = new Map<
    string,
    AcceptedBattedUninterruptedAcquisition
  >([[input.sourceId, input]]);
  const acquisitionAuthority = {
    readAcceptedAcquisition: (id: string) => accepted.get(id) ?? null,
  };
  const acquisitions = f.track(
    openSqliteBattedUninterruptedAcquisitionStore(
      f.path,
      responses,
      acquisitionAuthority,
    ),
  );

  return {
    ...base,
    response,
    input,
    acceptedAcquisitions: accepted,
    acquisitionAuthority,
    acquisitions,
  };
};
