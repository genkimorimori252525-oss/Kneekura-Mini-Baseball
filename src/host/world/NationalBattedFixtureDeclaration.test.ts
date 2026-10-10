import { describe, expect, it } from 'vitest';
import { NPB_2026_RULE_PROFILE } from '../../core/rules/RuleProfile';
import { match, worldSetup } from './OfficialParticipationPlayFixtures.test-support';
import { declareNationalBattedFixture, checkNationalBattedFixture, type NationalBattedFixtureScope } from './NationalBattedFixtureDeclaration.test-support';
const scope = (): NationalBattedFixtureScope => ({ gameId: 'national-fixture-game', careerId: 'career-a', fixtureEventId: 'national-fixture',
  venueId: 'national-venue', gameDay: 121, roster: Array.from({ length: 19 }, (_, i) => ({ playerId: `p${i}`, personId: `person-${i}` })),
  match: match({ ruleProfileId: NPB_2026_RULE_PROFILE.id }), setup: { ...worldSetup('p0'), defenders: worldSetup('p0').defenders.map((d, i) => ({ ...d, playerId: `p${i}` })) } });
describe('prospective original National two-play declaration', () => {
  it('checks the real planned foul stop and next first-base ground/capture before any Native admission', () => {
    const declared = declareNationalBattedFixture(scope()), checked = checkNationalBattedFixture(declared);
    expect(declared.model.actors).toHaveLength(19);
    expect(checked.foul.commands).toHaveLength(10);
    expect(checked.firstBase.commands).toHaveLength(10);
    expect(checked.foul.history.at(-1)!.motion.world).toMatchObject({ kind: 'boundary', contacts: [{ kind: 'rolling_stop' }] });
    expect(checked.firstBase.history.at(-1)!.motion.response.kind).toBe('capture_candidate');
    expect(checked.translatedFirstBase.history.at(-1)!.motion.response.kind).toBe('capture_candidate');
  });
  it.each(['missing reserve', 'response identity', 'second model ID', 'base geometry', 'first flight owner', 'response calibration'] as const)('rejects the incompatible whole-game declaration: %s', mutation => {
    const d = structuredClone(declareNationalBattedFixture(scope()));
    if (mutation === 'missing reserve') (d.model.actors as unknown[]).pop();
    if (mutation === 'response identity') Object.assign(d.responseModel.actors[10], { personId: 'wrong-person' });
    if (mutation === 'second model ID') Object.assign(d.model, { sourceId: 'national-live:world-model' });
    if (mutation === 'base geometry') Object.assign(d.baseSource.bases.first.region, { center: { x: 28, z: 0 } });
    if (mutation === 'first flight owner') Object.assign(d.baseSource, { flightSourceId: 'national-live:flight' });
    if (mutation === 'response calibration') {
      const glove = d.responseModel.actors[0].primitives.find(p => p.role === 'glove')!;
      if (glove.role === 'glove') Object.assign(glove.parameters, { captureDissipationPowerW: 1000 });
    }
    expect(() => checkNationalBattedFixture(d)).toThrow();
  });
  it('rejects the former foul-only glove geometry even when both Source IDs match', () => {
    const d = structuredClone(declareNationalBattedFixture(scope()));
    Object.assign(d.model.actors.find(a => a.playerId === 'p0')!.primitives.find(p => p.role === 'glove')!, { offset: { x: 0, y: .9, z: 0 } });
    expect(() => checkNationalBattedFixture(d)).toThrow();
  });
});
