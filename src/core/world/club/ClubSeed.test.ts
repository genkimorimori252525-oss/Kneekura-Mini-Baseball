import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { createClubFromSeed, restoreClubState } from './index';
import { bootstrap, state, value } from './ClubFixtures.test-support';

describe('club creation and persistence boundary', () => {
  it('creates causal layers while money and geometry remain independently supplied', () => {
    const s = state();
    assert.equal(s.identity.clubId, 'club-a');
    assert.equal(s.revision, 0);
    assert.equal(s.institutional.capital.financingAccess, 90);
    assert.equal(s.institutional.capital.brandCapital, 80);
    assert.equal(s.institutional.facilities.academyQuality, 70);
    assert.equal(s.institutional.facilities.scoutingInfrastructure, 60);
    assert.equal(s.institutional.stadium.quality, 50);
    assert.equal(s.institutional.stadium.geometryRef, 'geometry-a');
    assert.equal(s.institutional.stadium.capacity, 10000);
    assert.equal(s.live.finance.cash, 1000);
    assert.equal(s.live.finance.debt, 200);
  });
  it('pins versions and sources and initializes opening manager as a historical value', () => {
    const s = state();
    assert.equal(s.initialSeed.metadata.datasetVersion, 'dataset-v1');
    assert.equal(s.initialSeed.transformVersion, 'club-seed-direct-v1');
    assert.equal(s.initialSeed.financeNormalizationVersion, 'test-money-v1');
    assert.deepEqual(s.initialSeed.metadata.sourceSnapshotIds, ['source-snapshot-a']);
    assert.deepEqual(s.season.openingManager, { managerId: 'manager-a', appointmentId: 'appointment-a' });
  });
  it('does not use club name to generate extra strength or money', () => {
    const input = bootstrap(); input.initial.brand.displayName = 'A famous name';
    const s = value(createClubFromSeed(input));
    assert.deepEqual(s.institutional.capital, state().institutional.capital);
    assert.deepEqual(s.live.finance, state().live.finance);
  });
  it('different initial finance target does not fabricate cash or borrowing', () => {
    const input = bootstrap(); input.seed.targets.finance = 5;
    const s = value(createClubFromSeed(input));
    assert.equal(s.institutional.capital.financingAccess, 5);
    assert.equal(s.live.finance.cash, 1000);
    assert.equal(s.live.finance.debt, 200);
  });
  it('detaches and deeply freezes state without freezing caller data', () => {
    const input = bootstrap(); const s = value(createClubFromSeed(input));
    input.seed.targets.finance = 0; input.initial.references.playerClubStateRefs[0]!.stateRef = 'different';
    assert.equal(s.initialSeed.targets.finance, 90);
    assert.equal(s.live.references.playerClubStateRefs[0]!.stateRef, 'player-club-a');
    assert.ok(Object.isFrozen(s)); assert.ok(Object.isFrozen(s.institutional.capital));
    assert.ok(Object.isFrozen(s.live.references.playerClubStateRefs[0]));
    assert.ok(!Object.isFrozen(input));
  });
  it('restores JSON without consulting a new external seed', () => {
    const original = state(); const restored = value(restoreClubState(JSON.parse(JSON.stringify(original))));
    assert.deepEqual(restored, original); assert.notEqual(restored, original);
  });
  it('refuses initialization in an already running career', () => {
    const input = { ...bootstrap(), context: { ...bootstrap().context, phase: 'RUNNING' as const } };
    const result = createClubFromSeed(input); assert.ok(!result.ok); assert.equal(result.reason.code, 'CAREER_ALREADY_RUNNING');
  });
  it('refuses a club that already exists in the creation registry', () => {
    const input = bootstrap(); input.context.existingClubIds = ['club-a'];
    const result = createClubFromSeed(input); assert.ok(!result.ok); assert.equal(result.reason.code, 'CLUB_ALREADY_EXISTS');
  });
  for (const score of [-1, 101, Number.NaN, Number.POSITIVE_INFINITY]) {
    it('rejects an invalid initial axis ' + String(score), () => {
      const input = bootstrap(); input.seed.targets.finance = score;
      assert.ok(!createClubFromSeed(input).ok);
    });
  }
  it('rejects unsupported confidence and absent source provenance', () => {
    const input = bootstrap(); input.seed.metadata.sourceSnapshotIds = [];
    assert.ok(!createClubFromSeed(input).ok);
    assert.ok(!createClubFromSeed({ ...bootstrap(), seed: { ...bootstrap().seed,
      metadata: { ...bootstrap().seed.metadata, confidenceClass: 'TRUST_ME' } } }).ok);
  });
  it('rejects wrong-year financial profiles', () => {
    const input = bootstrap(); input.initial.season.financialProfile.season = 2;
    assert.ok(!createClubFromSeed(input).ok);
  });
  it('rejects creation before its initial season period', () => {
    const input = bootstrap(); input.context.effectiveDay = 9;
    assert.ok(!createClubFromSeed(input).ok);
  });
  it('rejects duplicate active manager roles and duplicate player references', () => {
    const input = bootstrap(); input.initial.references.staffRoleLinks.push({ roleId: 'second', roleKind: 'MANAGER', personId: 'other', appointmentId: 'other-appointment' });
    assert.ok(!createClubFromSeed(input).ok);
    const other = bootstrap(); other.initial.references.playerClubStateRefs.push({ playerId: 'player-a', stateRef: 'copy' });
    assert.ok(!createClubFromSeed(other).ok);
  });
  it('allows no current manager without inventing one', () => {
    const input = bootstrap(); input.initial.references.staffRoleLinks = [];
    assert.equal(value(createClubFromSeed(input)).season.openingManager, null);
  });
  it('rejects sparse input lists instead of throwing', () => {
    const input = bootstrap(); input.initial.references.playerClubStateRefs = new Array(1);
    assert.ok(!createClubFromSeed(input).ok);
  });
  it('keeps historical rivalry and current threat as separate references', () => {
    const s = state();
    assert.deepEqual(s.live.references.rivalryStateRefs, [{ fromClubId: 'club-a', toClubId: 'club-b', stateRef: 'rivalry-a-b' }]);
    assert.deepEqual(s.live.references.competitiveThreatRefs, ['threat-b-a']);
  });
  it('rejects a rivalry edge owned by another club or a self edge', () => {
    const input = bootstrap(); input.initial.references.rivalryStateRefs[0]!.fromClubId = 'club-b';
    assert.ok(!createClubFromSeed(input).ok);
    input.initial.references.rivalryStateRefs[0]!.fromClubId = 'club-a';
    input.initial.references.rivalryStateRefs[0]!.toClubId = 'club-a';
    assert.ok(!createClubFromSeed(input).ok);
  });
  it('rejects derived labels and copied player objects in persisted causal state', () => {
    assert.ok(!restoreClubState({ ...state(), giant: true }).ok);
    const s = state();
    assert.ok(!restoreClubState({ ...s, institutional: { ...s.institutional, economicBand: 'MEGA' } }).ok);
    assert.ok(!restoreClubState({ ...s, live: { ...s.live, playerAbilities: { power: 100 } } }).ok);
  });
  it('rejects incoherent persisted cash and unsupported schema versions', () => {
    const s = state();
    assert.ok(!restoreClubState({ ...s, live: { ...s.live, finance: { ...s.live.finance, cash: 9999 } } }).ok);
    assert.ok(!restoreClubState({ ...s, schemaVersion: 2 }).ok);
  });
  for (const cash of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1, Number.NaN]) {
    it('rejects nonrepresentable money ' + String(cash), () => {
      const input = bootstrap(); input.initial.cash = cash;
      assert.ok(!createClubFromSeed(input).ok);
    });
  }
});
