import { expect, it } from 'vitest';
import { asRuleProfileId } from '../../core/model/RuleProfileRef';
import { battedVenuePlayableWallPolicyInput, type AcceptedBattedVenuePlayableWallPolicy } from './BattedVenuePlayableWallPolicy';
const source = (): AcceptedBattedVenuePlayableWallPolicy => ({ sourceId: 'wall-policy', sourceVersion: 'accepted-v1',
  version: 'batted_venue_playable_wall_policy_v1', gameId: 'game', playId: 3, physicalPitchSourceId: 'pitch',
  fixtureEventId: 'fixture', venueId: 'venue', baseFieldSourceId: 'field', worldModelSourceId: 'world',
  worldModelSourceVersion: 'model-v1', availableAtDay: 1,
  rulePolicy: { version: 'grounded_fair_playable_wall_v1', ruleProfileId: asRuleProfileId('npb-2026'), rulesRevision: '2026', surfaceIds: ['wall'] } });
it('WALL-S01 accepts only explicit immutable venue and policy configuration with no physical results', () => {
  const input = source(), result = battedVenuePlayableWallPolicyInput(input);
  expect(result).toEqual(input); expect(result).not.toBe(input);
  expect(Object.isFrozen(result)).toBe(true); expect(Object.isFrozen(result.rulePolicy.surfaceIds)).toBe(true);
  expect(result).not.toHaveProperty('contacts'); expect(result).not.toHaveProperty('fair');
});
it.each(['version', 'sourceId', 'worldModelSourceVersion', 'availableAtDay', 'playId', 'result', 'contact', 'ruleRevision', 'surface', 'getter'] as const)(
  'WALL-S02 rejects %s contract widening or missing identity', kind => {
    const input = source();
    if (kind === 'version') Object.assign(input, { version: 'anything' });
    if (kind === 'sourceId') Object.assign(input, { sourceId: '   ' });
    if (kind === 'worldModelSourceVersion') Object.assign(input, { worldModelSourceVersion: '' });
    if (kind === 'availableAtDay') Object.assign(input, { availableAtDay: -1 });
    if (kind === 'playId') Object.assign(input, { playId: 1.5 });
    if (kind === 'result') Object.assign(input, { officialRuling: 'fair' });
    if (kind === 'contact') Object.assign(input, { physicalContacts: [] });
    if (kind === 'ruleRevision') Object.assign(input.rulePolicy, { rulesRevision: 'unregistered' });
    if (kind === 'surface') Object.assign(input.rulePolicy, { surfaceIds: [] });
    if (kind === 'getter') Object.defineProperty(input, 'venueId', { enumerable: true, get() { throw new Error('getter executed'); } });
    expect(() => battedVenuePlayableWallPolicyInput(input)).toThrow();
  });
