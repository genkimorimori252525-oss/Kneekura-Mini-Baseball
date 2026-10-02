import { battedContactResponseFixture } from './BattedContactResponseFixtures.test-support';
import {
  openSqliteBattedPostResponseFlightStore,
  type AcceptedBattedPostResponseFlight,
} from './SqliteBattedPostResponseFlightStore';

export const battedPostResponseFlightFixture = (
  path?: string,
  kind:
    | 'body'
    | 'glove'
    | 'failed_glove'
    | 'ground'
    | 'surface'
    | 'airborne'
    | 'simultaneous' = 'body',
) => {
  const base = battedContactResponseFixture(path, kind);
  const {
    f,
    responses,
    responseSource,
  } = base;
  const response = responses.accept(responseSource.sourceId);
  const input: AcceptedBattedPostResponseFlight = {
    sourceId: 'post-response-flight',
    sourceVersion: 'fixture-v1',
    contactResponseSourceId: responseSource.sourceId,
    previousContinuationSourceId: null,
    searchDurationTicks: 100_000,
  };
  const accepted = new Map<string, AcceptedBattedPostResponseFlight>([
    [input.sourceId, input],
  ]);
  const continuations = f.track(
    openSqliteBattedPostResponseFlightStore(
      f.path,
      responses,
      {
        readAcceptedContinuation: (id) => accepted.get(id) ?? null,
      },
    ),
  );

  return {
    ...base,
    response,
    input,
    acceptedContinuations: accepted,
    continuations,
  };
};
