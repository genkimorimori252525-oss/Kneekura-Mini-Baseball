import { expect, it } from 'vitest';
import { battedContactResponseFixture as fixture } from './BattedContactResponseFixtures.test-support';
import { openSqliteBattedContactResponseStore } from './SqliteBattedContactResponseStore';

it.each([
  ['body', 'rebound'], ['surface', 'rebound'], ['glove', 'capture_candidate'], ['failed_glove', 'rebound'],
  ['ground', 'ground'], ['airborne', 'airborne'], ['simultaneous', 'unresolved'],
] as const)('derives %s response from the actual Native World and reopens its own original archive', (kind, expected) => {
  const { f, responses, responseSource, touch, touches } = fixture(undefined, kind);
  try {
    const actual = responses.accept(responseSource.sourceId);
    expect(actual.result.kind).toBe(expected); expect(actual.touch).toEqual(touch);
    const reopened = f.track(openSqliteBattedContactResponseStore(f.path, touches));
    expect(reopened.read(responseSource.sourceId)).toEqual(actual);
    expect(reopened.accept(responseSource.sourceId)).toEqual(actual);
    expect(actual).not.toHaveProperty('match');
  } finally { f.close(); }
});
it.each(['gameId', 'careerId', 'fixtureEventId', 'venueId'] as const)('rejects wrong original response model %s scope', (field) => {
  const { f, responses, responseSource, responseModel, responseModels } = fixture();
  try {
    responseModels.set(responseModel.sourceId, { ...responseModel, [field]: 'wrong' });
    expect(() => responses.accept(responseSource.sourceId)).toThrow();
  } finally { f.close(); }
});
it('rejects unapproved outcomes, future calibration and wrong Person even on an unused registered actor', () => {
  const { f, responses, responseSource, responseModel, responseModels, responseSources, touch } = fixture();
  try {
    responseSources.set(responseSource.sourceId, { ...responseSource, catchResult: true } as typeof responseSource);
    expect(() => responses.accept(responseSource.sourceId)).toThrow();
    responseSources.set(responseSource.sourceId, responseSource);
    responseModels.set(responseModel.sourceId, { ...responseModel, availableAtDay: touch.worldContact.flight.physicalPitch.frame.batterActor!.binding.gameDay + 1 });
    expect(() => responses.accept(responseSource.sourceId)).toThrow();
    const active = new Set(touch.worldContact.actors.map((a) => a.playerId));
    const inactive = responseModel.actors.find((a) => !active.has(a.playerId))!;
    responseModels.set(responseModel.sourceId, { ...responseModel, actors: responseModel.actors.map((a) => a.playerId === inactive.playerId ? { ...a, personId: 'wrong' } : a) });
    expect(() => responses.accept(responseSource.sourceId)).toThrow();
  } finally { f.close(); }
});
it('rejects missing geometry calibration and malformed unused registered glove profile', () => {
  const { f, responses, responseSource, responseModel, responseModels } = fixture();
  try {
    responseModels.set(responseModel.sourceId, { ...responseModel, actors: responseModel.actors.slice(1) });
    expect(() => responses.accept(responseSource.sourceId)).toThrow();
    responseModels.set(responseModel.sourceId, { ...responseModel, actors: responseModel.actors.map((a, index) => index !== 0 ? a : { ...a,
      primitives: a.primitives.map((p) => p.role !== 'glove' ? p : { ...p, parameters: { ...p.parameters, captureDissipationPowerW: NaN } }) }) });
    expect(() => responses.accept(responseSource.sourceId)).toThrow();
  } finally { f.close(); }
});
it('keeps original model immutable and rejects source rebinding on identical retries', () => {
  const { f, responses, responseSource, responseSources } = fixture();
  try {
    responses.accept(responseSource.sourceId);
    responseSources.set(responseSource.sourceId, { ...responseSource, responseModelSourceId: 'other' });
    expect(() => responses.accept(responseSource.sourceId)).toThrow('frozen');
    responses.close(); expect(() => responses.read(responseSource.sourceId)).toThrow('closed');
  } finally { f.close(); }
});
