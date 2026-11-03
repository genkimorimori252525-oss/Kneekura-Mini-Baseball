import { describe, expect, it } from 'vitest';
import { getLiveTraitCatalogV1, projectLiveTraitProfilesV1, setLiveTraitProfileV1, validateLiveTraitProfileV1,
  resolveLiveTraitPreferencesV54, reconcileLiveTraitSourcesV54, type LiveTraitRosterInputV1 } from './LiveTraitProfilesV1';

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
    expect(catalog.map(item => item.familyId)).toEqual(['bad_ball_hitting', 'throw_accuracy', 'plate_aggression',
      'running_aggression', 'fielding_aggression', 'pitch_approach', 'swing_mode_preference']);
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

describe('v54 source-backed trait authoring', () => {
  const row = (roster: LiveTraitRosterInputV1, familyId: string) =>
    projectLiveTraitProfilesV1({ roster, playerId: 'batter' }).traits.find(trait => trait.familyId === familyId)!;
  const change = (roster: LiveTraitRosterInputV1, familyId: string, stateId: string | null) =>
    setLiveTraitProfileV1({ roster, playerId: 'batter', familyId, stateId });
  const controls = () => {
    const roster = fixture();
    Object.assign(roster.entries[0].physical!, { throwDirectionStdRadians: .01, baserunningSafetyMarginSeconds: .8,
      fieldingPursuitCostWeight: 1.2, swingDecision: { approach: 'AUTO', threshold: .5, aggressionWeight: .7 } });
    return roster;
  };
  it('derives throw grades only from explicit SI and never saves a second tier or physical multiplier', () => {
    const missing = fixture(), before = JSON.stringify(missing);
    expect(row(missing, 'throw_accuracy')).toMatchObject({ status: 'UNASSESSED', sourceValue: null, stateId: null });
    expect(JSON.stringify(missing)).toBe(before);
    const first = change(missing, 'throw_accuracy', 'GOLD');
    expect(first.roster.entries[0].physical?.throwDirectionStdRadians).toBe(.0015);
    expect(first.roster.entries[0].traitProfile).toBeUndefined();
    expect(first.changes.map(item => item.path)).toEqual(['physical.throwDirectionStdRadians']);
    expect(row(first.roster, 'throw_accuracy')).toMatchObject({ status: 'DERIVED', stateId: 'GOLD', color: 'gold', editor: 'GRADE', availability: 'SOURCE_DERIVED' });
    const direct = structuredClone(first.roster);
    Object.assign(direct.entries[0].physical!, { throwDirectionStdRadians: .073 });
    expect(row(direct, 'throw_accuracy')).toMatchObject({ stateId: 'G', color: 'red' });
    expect(change(direct, 'throw_accuracy', 'G').roster).toEqual(direct);
    Object.assign(direct.entries[0].physical!, { throwDirectionStdRadians: 0 });
    expect(row(direct, 'throw_accuracy').stateId).toBe('GOLD');
    expect(() => change(direct, 'throw_accuracy', null)).toThrow();
    expect(() => validateLiveTraitProfileV1({ version: 'live_trait_profile_v1', selections: [
      { familyId: 'throw_accuracy', stateId: 'GOLD', source: { throwDirectionStdRadians: 0 } }] }, direct.entries[0].physical!)).toThrow();
    const tuned = setLiveTraitProfileV1({ roster: direct, playerId: 'batter', familyId: 'throw_accuracy', stateId: 'A', source: { throwDirectionStdRadians: .0027 } });
    expect(tuned.roster.entries[0].physical?.throwDirectionStdRadians).toBe(.0027);
    expect(() => setLiveTraitProfileV1({ roster: direct, playerId: 'batter', familyId: 'throw_accuracy', stateId: 'A', source: { throwDirectionStdRadians: .006 } })).toThrow();
  });
  it('applies each green baseline once and restores the original individual source for neutral', () => {
    const roster = controls(), before = JSON.stringify(roster), a = change(roster, 'running_aggression', 'AGGRESSIVE'),
      b = change(a.roster, 'fielding_aggression', 'AGGRESSIVE'), c = change(b.roster, 'plate_aggression', 'AGGRESSIVE');
    expect(c.roster.entries[0].physical).toMatchObject({ baserunningSafetyMarginSeconds: .55, fieldingPursuitCostWeight: .78,
      swingDecision: { approach: 'AUTO', threshold: .38, aggressionWeight: .7 }, badBallControl: .73 });
    expect(change(c.roster, 'fielding_aggression', 'AGGRESSIVE').changes).toEqual([]);
    expect(change(c.roster, 'running_aggression', 'AGGRESSIVE').roster).toEqual(c.roster);
    const cautious = change(c.roster, 'plate_aggression', 'CAUTIOUS');
    expect(cautious.roster.entries[0].physical?.swingDecision?.threshold).toBe(.62);
    let restored = change(cautious.roster, 'plate_aggression', 'BALANCED').roster;
    restored = change(restored, 'running_aggression', null).roster;
    restored = change(restored, 'fielding_aggression', 'BALANCED').roster;
    expect(restored.entries[0].physical).toEqual(roster.entries[0].physical);
    expect(restored.entries[1]).toEqual(roster.entries[1]);
    expect(c.roster.sourceId.split(':trait-edited')).toHaveLength(2);
    expect(JSON.stringify(roster)).toBe(before);
  });
  it('materializes existing execution defaults only when editing and bounds each tactical source', () => {
    const missing = fixture(), before = JSON.stringify(missing);
    delete (missing.entries[0].physical as { swingDecision?: unknown }).swingDecision;
    const omitted = JSON.stringify(missing);
    expect(row(missing, 'plate_aggression').status).toBe('UNASSESSED');
    expect(JSON.stringify(missing)).toBe(omitted);
    expect(change(missing, 'plate_aggression', 'AGGRESSIVE').roster.entries[0].physical?.swingDecision)
      .toEqual({ approach: 'AUTO', threshold: 0, aggressionWeight: .5 });
    expect(change(missing, 'running_aggression', 'AGGRESSIVE').roster.entries[0].physical?.baserunningSafetyMarginSeconds).toBeCloseTo(.1, 14);
    expect(change(missing, 'fielding_aggression', 'AGGRESSIVE').roster.entries[0].physical?.fieldingPursuitCostWeight).toBe(.65);
    const extremes = controls();
    Object.assign(extremes.entries[0].physical!, { baserunningSafetyMarginSeconds: .1, fieldingPursuitCostWeight: .25,
      swingDecision: { approach: 'AUTO', threshold: .96, aggressionWeight: 1 } });
    expect(change(extremes, 'running_aggression', 'AGGRESSIVE').roster.entries[0].physical?.baserunningSafetyMarginSeconds).toBe(0);
    expect(change(extremes, 'fielding_aggression', 'AGGRESSIVE').roster.entries[0].physical?.fieldingPursuitCostWeight).toBe(.25);
    expect(change(extremes, 'plate_aggression', 'CAUTIOUS').roster.entries[0].physical?.swingDecision?.threshold).toBe(1);
    expect(before).not.toBe(omitted);
  });
  it('rejects forced plate decisions, mismatched effective sources and unknown source fields', () => {
    for (const approach of ['TAKE', 'SWING'] as const) {
      const forced = controls(); Object.assign(forced.entries[0].physical!.swingDecision!, { approach });
      expect(() => change(forced, 'plate_aggression', 'AGGRESSIVE')).toThrow();
    }
    const active = change(controls(), 'running_aggression', 'AGGRESSIVE').roster, selected = active.entries[0], source = selected.traitProfile!.selections[0];
    expect(() => validateLiveTraitProfileV1(selected.traitProfile, { ...selected.physical, baserunningSafetyMarginSeconds: .8 })).toThrow();
    expect(() => validateLiveTraitProfileV1({ ...selected.traitProfile, selections: [{ ...source,
      source: { ...source.source, extra: 1 } }] }, selected.physical!)).toThrow();
    expect(() => change(active, 'running_aggression', 'GOLD')).toThrow();
    for (const [familyId, source] of [
      ['plate_aggression', { 'swingDecision.threshold': .3, 'swingDecision.aggressionWeight': .5, 'swingDecision.approach': 'SWING' }],
      ['running_aggression', { baserunningSafetyMarginSeconds: 3.001 }],
      ['fielding_aggression', { fieldingPursuitCostWeight: .249 }],
      ['pitch_approach', { weight: 2 }],
      ['swing_mode_preference', { power: 2 }],
    ] as const) expect(() => setLiveTraitProfileV1({ roster: controls(), playerId: 'batter', familyId,
      stateId: familyId === 'pitch_approach' ? 'FASTBALL' : familyId === 'swing_mode_preference' ? 'POWER' : 'AGGRESSIVE', source })).toThrow();
  });
  it('keeps virtual preferences out of physical abilities and resolves omitted and neutral values compatibly', () => {
    const roster = controls(), pitch = change(roster, 'pitch_approach', 'FASTBALL'), swing = change(pitch.roster, 'swing_mode_preference', 'CONTACT');
    expect(swing.roster.entries[0].physical).toEqual(roster.entries[0].physical);
    expect(swing.roster.entries[0].traitProfile?.selections.map(item => item.source)).toEqual([{}, {}]);
    expect(resolveLiveTraitPreferencesV54(swing.roster.entries[0].traitProfile)).toEqual({ pitchApproach: 'FASTBALL', swingMode: 'CONTACT' });
    expect(resolveLiveTraitPreferencesV54()).toEqual({ pitchApproach: 'BALANCED', swingMode: 'BALANCED' });
    const neutral = change(change(swing.roster, 'pitch_approach', null).roster, 'swing_mode_preference', 'BALANCED');
    expect(resolveLiveTraitPreferencesV54(neutral.roster.entries[0].traitProfile)).toEqual({ pitchApproach: 'BALANCED', swingMode: 'BALANCED' });
    expect(() => validateLiveTraitProfileV1({ version: 'live_trait_profile_v1', selections: [
      { familyId: 'pitch_approach', stateId: 'FASTBALL', source: { multiplier: 2 } }] }, roster.entries[0].physical!)).toThrow();
  });
  it('reconciles direct source edits without inferring ownership or retaining stale green baselines', () => {
    let roster = edit(controls(), 'LEARNED').roster;
    roster = change(change(roster, 'running_aggression', 'AGGRESSIVE').roster, 'fielding_aggression', 'AGGRESSIVE').roster;
    const noop = reconcileLiveTraitSourcesV54({ roster, playerId: 'batter', changedPaths: ['physical.baserunningSafetyMarginSeconds', 'fieldingPursuitCostWeight'] });
    expect(noop).toEqual(roster);
    const direct = structuredClone(roster); Object.assign(direct.entries[0].physical!, { badBallControl: .63, baserunningSafetyMarginSeconds: .9 });
    const fixed = reconcileLiveTraitSourcesV54({ roster: direct, playerId: 'batter', changedPaths: ['physical.badBallControl', 'baserunningSafetyMarginSeconds'] });
    expect(fixed.entries[0].physical).toEqual(direct.entries[0].physical);
    expect(row(fixed, 'bad_ball_hitting')).toMatchObject({ owned: true, sourceValue: .63 });
    expect(row(fixed, 'running_aggression')).toMatchObject({ status: 'UNASSESSED', effectiveSourceValue: .9 });
    expect(row(fixed, 'fielding_aggression')).toMatchObject({ owned: true, sourceValue: 1.2, effectiveSourceValue: .78 });
    expect(fixed.entries[1]).toEqual(roster.entries[1]);
    const plate = change(fixed, 'plate_aggression', 'CAUTIOUS').roster, editedPlate = structuredClone(plate);
    Object.assign(editedPlate.entries[0].physical!.swingDecision!, { threshold: .42 });
    const directPlate = reconcileLiveTraitSourcesV54({ roster: editedPlate, playerId: 'batter', changedPaths: ['swingDecision'] });
    expect(row(directPlate, 'plate_aggression').status).toBe('UNASSESSED');
    expect(row(directPlate, 'fielding_aggression').status).toBe('OWNED');
    expect(directPlate.entries[0].physical?.swingDecision?.threshold).toBe(.42);
    const off = edit(fixed, null).roster, untouched = reconcileLiveTraitSourcesV54({ roster: off, playerId: 'batter', changedPaths: ['badBallControl'] });
    expect(untouched.entries[0].traitProfile?.selections.find(item => item.familyId === 'bad_ball_hitting')?.source.badBallControl).toBe(.63);
    const invalid = structuredClone(off); Object.assign(invalid.entries[0].physical!, { badBallControl: .4 });
    expect(() => reconcileLiveTraitSourcesV54({ roster: invalid, playerId: 'batter', changedPaths: ['badBallControl'] })).toThrow();
  });
});
