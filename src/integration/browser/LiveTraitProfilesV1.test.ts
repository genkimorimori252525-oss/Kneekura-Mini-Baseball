import { describe, expect, it } from 'vitest';
import { getLiveTraitCatalogV1, projectLiveTraitProfilesV1, setLiveTraitProfileV1, validateLiveTraitProfileV1,
  type LiveTraitRosterInputV1 } from './LiveTraitProfilesV1';

const fixture = (control: number | undefined = .73): LiveTraitRosterInputV1 => ({
  version: 'live_physical_roster_v1', sourceId: 'trait-test', entries: [
    { playerId: 'batter', sourceId: 'batter-source', physical: { basis: 'EXPLICIT_AUTHORED_SI_V1',
      ...(control === undefined ? {} : { badBallControl: control }), aimStdMeters: .04, chaseMarginMeters: .12,
      swingDecision: { threshold: .5, aggressionWeight: .5, approach: 'AUTO' } }, traitLabels: ['悪球打ち', '架空の金特'] },
    { playerId: 'other', sourceId: 'other-source', physical: { basis: 'EXPLICIT_AUTHORED_SI_V1', badBallControl: .29 } },
  ],
});
const selected = (roster: LiveTraitRosterInputV1) => roster.entries[0];
const edit = (roster: LiveTraitRosterInputV1, stateId: 'LEARNED' | null, source?: { badBallControl: number }) =>
  setLiveTraitProfileV1({ roster, playerId: 'batter', familyId: 'bad_ball_hitting', stateId, ...(source ? { source } : {}) });

describe('local trait authoring with one numerical source', () => {
  it('does not infer possession from legacy continuous values or display labels', () => {
    for (const control of [0, .01, .73, 1]) {
      const roster = fixture(control), before = JSON.stringify(roster), result = projectLiveTraitProfilesV1({ roster, playerId: 'batter' });
      expect(result.boundary).toBe('LOCAL_TRAIT_AUTHORING_ONLY');
      expect(result.traits[0]).toMatchObject({ familyId: 'bad_ball_hitting', status: 'UNASSESSED', owned: null,
        stateId: null, effectiveSourceValue: control });
      expect(JSON.stringify(roster)).toBe(before);
    }
  });
  it('retains the individual technique source across ON/OFF and never changes aggression or other people', () => {
    const roster = fixture(), before = JSON.stringify(roster), on = edit(roster, 'LEARNED');
    expect(selected(on.roster).physical?.badBallControl).toBe(.73);
    expect(on.projection.traits[0]).toMatchObject({ status: 'OWNED', owned: true, color: 'blue', sourceValue: .73, effectiveSourceValue: .73 });
    const off = edit(on.roster, null);
    expect(off.changes.find(change => change.path === 'traitProfile')?.before).toEqual(selected(on.roster).traitProfile);
    expect(selected(off.roster).physical?.badBallControl).toBe(0);
    expect(selected(off.roster).traitProfile?.selections[0]).toMatchObject({ stateId: null, source: { badBallControl: .73 } });
    expect(off.projection.traits[0]).toMatchObject({ status: 'ABSENT', owned: false, sourceValue: .73, effectiveSourceValue: 0 });
    const restored = edit(off.roster, 'LEARNED');
    expect(selected(restored.roster).physical).toEqual(selected(roster).physical);
    expect(restored.roster.entries[1]).toEqual(roster.entries[1]);
    expect(selected(restored.roster).traitLabels).toEqual(selected(roster).traitLabels);
    expect(JSON.stringify(roster)).toBe(before);
  });
  it('requires an explicit source on first enabling missing or zero source rather than inventing mastery', () => {
    const zero = fixture(0), missing = fixture();
    delete (missing.entries[0].physical as { badBallControl?: number }).badBallControl;
    for (const roster of [zero, missing]) {
      expect(() => edit(roster, 'LEARNED')).toThrow();
      expect(selected(edit(roster, 'LEARNED', { badBallControl: .61 }).roster).physical?.badBallControl).toBe(.61);
    }
    // A caller may explicitly author zero current execution. The label does
    // not manufacture ability or claim authentic persistent Native mastery.
    const explicitZero = edit(zero, 'LEARNED', { badBallControl: 0 }).roster;
    expect(selected(explicitZero).physical?.badBallControl).toBe(0);
    expect(edit(explicitZero, 'LEARNED').roster).toEqual(explicitZero);
  });
  it('keeps exact no-op bytes and does not compound a label into another physical effect', () => {
    const first = edit(fixture(), 'LEARNED'), again = edit(first.roster, 'LEARNED');
    expect(JSON.stringify(again.roster)).toBe(JSON.stringify(first.roster));
    expect(again.changes).toEqual([]);
    expect(first.roster.sourceId.split(':trait-edited')).toHaveLength(2);
    expect(selected(first.roster).sourceId.split(':trait-edited')).toHaveLength(2);
    expect(selected(first.roster).physical?.aimStdMeters).toBe(.04);
    expect(selected(first.roster).physical?.chaseMarginMeters).toBe(.12);
    expect(selected(first.roster).physical?.swingDecision).toEqual(selected(fixture()).physical?.swingDecision);
  });
  it('rejects duplicate families, unsupported Gold, malformed sources and contradictory source values atomically', () => {
    const on = edit(fixture(), 'LEARNED').roster, p = selected(on).traitProfile!, before = JSON.stringify(on);
    expect(() => validateLiveTraitProfileV1({ ...p, selections: [p.selections[0], p.selections[0]] }, selected(on).physical!)).toThrow();
    expect(() => validateLiveTraitProfileV1({ ...p, selections: [{ ...p.selections[0], stateId: 'GOLD' }] }, selected(on).physical!)).toThrow();
    expect(() => validateLiveTraitProfileV1(p, { badBallControl: .72 })).toThrow();
    expect(() => validateLiveTraitProfileV1({ ...p, selections: [{ ...p.selections[0], source: { badBallControl: .73, power: 99 } }] }, selected(on).physical!)).toThrow();
    for (const value of [-.01, 1.01, NaN, Infinity]) expect(() => edit(on, 'LEARNED', { badBallControl: value })).toThrow();
    expect(() => setLiveTraitProfileV1({ roster: on, playerId: 'batter', familyId: 'made_up', stateId: 'LEARNED' })).toThrow();
    expect(() => setLiveTraitProfileV1({ roster: on, playerId: 'missing', familyId: 'bad_ball_hitting', stateId: null })).toThrow();
    expect(JSON.stringify(on)).toBe(before);
  });
  it('uses the existing workbench owner without creating a conflicting second physical source', () => {
    const roster = fixture(), workbench = { traits: { badBallControl: .64, labels: ['悪球打ち'] } };
    const entry = { playerId: 'maker', sourceId: 'maker-source', workbenchPlayer: workbench } as unknown as LiveTraitRosterInputV1['entries'][number];
    const packet = { ...roster, entries: [entry] }, changed = setLiveTraitProfileV1({ roster: packet, playerId: 'maker', familyId: 'bad_ball_hitting', stateId: null });
    expect(changed.roster.entries[0].physical).toBeUndefined();
    expect(changed.roster.entries[0].workbenchPlayer?.traits.badBallControl).toBe(0);
    expect(changed.projection.traits[0].sourcePath).toBe('workbenchPlayer.traits.badBallControl');
  });
  it('keeps the catalogue limited to an implemented source owner and deeply immutable', () => {
    const catalog = getLiveTraitCatalogV1();
    expect(catalog).toHaveLength(1);
    expect(catalog[0]).toMatchObject({ familyId: 'bad_ball_hitting', label: '悪球打ち', sourceRoute: 'SOURCE_EXECUTION' });
    expect(catalog[0].states.map(state => state.stateId)).toEqual(['LEARNED']);
    expect(Object.isFrozen(catalog)).toBe(true);
    expect(Object.isFrozen(catalog[0].states)).toBe(true);
  });
  it('rejects getters and ambiguous owners without evaluating user code', () => {
    let called = false; const raw = { version: 'live_trait_profile_v1', get selections() { called = true; return []; } };
    expect(() => validateLiveTraitProfileV1(raw, { badBallControl: .73 })).toThrow(); expect(called).toBe(false);
    const roster = fixture();
    const ambiguous = { ...roster, entries: [{ ...roster.entries[0], workbenchPlayer: { traits: { badBallControl: .73 } } }] } as unknown as LiveTraitRosterInputV1;
    expect(() => edit(ambiguous, 'LEARNED')).toThrow();
  });
});
