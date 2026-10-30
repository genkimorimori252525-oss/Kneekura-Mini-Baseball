import { expect, it } from 'vitest';
import { createLiveBaseballMatchV1, LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, type LiveMatchInputV1 } from './LiveBaseballMatchV1';
import { liveMatchFixture } from './LiveBaseballMatchV1.test-support';
import type { LiveTraitProfileV1 } from './LiveTraitProfilesV1';

const profile = (stateId: string | null, badBallControl = .73): LiveTraitProfileV1 => ({
  version: 'live_trait_profile_v1', selections: [{ familyId: 'bad_ball_hitting', stateId, source: { badBallControl } }],
});
const directInput = (control: number | undefined, traitProfile?: LiveTraitProfileV1): LiveMatchInputV1 => {
  const fixture = liveMatchFixture(2468);
  return { ...fixture, players: fixture.players.map(player => ({ ...player,
    physical: { ...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, ...(control === undefined ? {} : { badBallControl: control }) },
    ...(traitProfile === undefined ? {} : { traitProfile }) })) };
};

it('validates trait profiles against direct Host physical inputs without a roster adapter', () => {
  expect(() => createLiveBaseballMatchV1(directInput(.73, profile('LEARNED')))).not.toThrow();
  expect(() => createLiveBaseballMatchV1(directInput(0, profile(null)))).not.toThrow();
  expect(() => createLiveBaseballMatchV1(directInput(undefined))).not.toThrow();
  for (const input of [directInput(.72, profile('LEARNED')), directInput(.73, profile(null)),
    directInput(undefined, profile('LEARNED')), directInput(.73, profile('GOLD'))]) {
    const before = JSON.stringify(input);
    expect(() => createLiveBaseballMatchV1(input)).toThrow(/trait profile|family state/);
    expect(JSON.stringify(input)).toBe(before);
  }
  const duplicate = profile('LEARNED');
  expect(() => createLiveBaseballMatchV1(directInput(.73, { ...duplicate,
    selections: [...duplicate.selections, ...duplicate.selections] }))).toThrow(/duplicate trait family/);
});

it('does not multiply a technical source again when trait metadata accompanies an actual contact play', () => {
  const sourceOnly = directInput(.73), labeled = directInput(.73, profile('LEARNED')),
    beforeSource = JSON.stringify(sourceOnly), beforeLabeled = JSON.stringify(labeled),
    one = createLiveBaseballMatchV1(sourceOnly), two = createLiveBaseballMatchV1(labeled);
  let contacts = 0;
  for (let index = 0; index < 16 && contacts === 0; index++) {
    const command = { batting: 'balanced' as const, managedTeam: 0 as const, pitchType: 'auto', location: 'auto' },
      a = one.issuePitch(command), b = two.issuePitch(command);
    expect(b).toEqual(a);
    if (a.play.contact !== null) {
      expect(a.play.contactMoment).not.toBeNull();
      expect(a.play.outgoingBallMoment).not.toBeNull();
      expect(a.play.field).not.toBeNull();
      expect(a.frames.some(frame => frame.ballKind === 'batted')).toBe(true);
      contacts++;
    }
  }
  expect(contacts).toBeGreaterThan(0);
  expect(JSON.stringify(sourceOnly)).toBe(beforeSource);
  expect(JSON.stringify(labeled)).toBe(beforeLabeled);
}, 30000);
