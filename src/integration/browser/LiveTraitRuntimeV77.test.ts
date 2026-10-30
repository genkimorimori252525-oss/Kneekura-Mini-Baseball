import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getLiveTraitCatalogV77, migrateLiveTraitRosterV77, projectLiveTraitProfilesV77, resolveLiveExecutionPhysicalV77, setLiveTraitProfileV77 } from './LiveTraitRuntimeV77';
import { getLiveTraitCatalogV1, reconcileLiveTraitSourcesV54, setLiveTraitProfileV1, validateLiveTraitProfileV1, type LiveTraitRosterInputV1 } from './LiveTraitProfilesV1';
import { projectLivePublicAbilitiesV1, type LivePublicAbilityReferenceV1 } from './LivePublicAbilitiesV1';
import { applyLivePhysicalRosterV1 } from './LivePhysicalRosterV1';

const initial: LiveTraitRosterInputV1 = JSON.parse(readFileSync('docs/demos/live-game-roster-v62.json', 'utf8'));
const reference: LivePublicAbilityReferenceV1 = JSON.parse(readFileSync('docs/demos/live-public-ability-reference-v1.json', 'utf8'));
const playerId = initial.entries[0].playerId;
const publicValues = (roster: LiveTraitRosterInputV1) => projectLivePublicAbilitiesV1({ roster, reference, playerId }).abilities;
const edit = (roster: LiveTraitRosterInputV1, familyId: string, stateId: string | null, scale = 1) => setLiveTraitProfileV77({ roster, playerId, familyId, stateId,
  source: familyId === 'bad_ball_hitting' ? { badBallControl: .7, effectScale: scale } : ['pitch_approach', 'swing_mode_preference'].includes(familyId) ? {} : { effectScale: scale } }).roster;

describe('v77 independent trait execution', () => {
  it('does not turn an old SI-derived throwing grade into independent ownership', () => {
    const legacy = setLiveTraitProfileV1({ roster: initial, playerId, familyId: 'throw_accuracy', stateId: 'A' }).roster;
    const before = JSON.stringify(legacy), migrated = migrateLiveTraitRosterV77({ roster: legacy });
    expect(JSON.stringify(legacy)).toBe(before);
    expect(migrated.roster.entries[0].physical).toEqual(legacy.entries[0].physical);
    expect(publicValues(migrated.roster)).toEqual(publicValues(legacy));
    const row = projectLiveTraitProfilesV77({ roster: migrated.roster, playerId }).traits.find(t => t.familyId === 'throw_accuracy')!;
    expect(row).toMatchObject({ owned: null, stateId: null, status: 'UNASSESSED', editor: 'TECHNIQUE' });
    expect(migrated.roster.entries[0].traitProfile?.version).toBe('live_trait_profile_v2');
    expect(migrateLiveTraitRosterV77({ roster: migrated.roster }).roster).toEqual(migrated.roster);
  });
  it('keeps base SI and every public ability unchanged for all independently authored states and scales', () => {
    const migrated = migrateLiveTraitRosterV77({ roster: initial }).roster, expectedPublic = publicValues(migrated);
    expect(getLiveTraitCatalogV1()).toHaveLength(7);
    expect(getLiveTraitCatalogV1({ includeTechnical: true })).toHaveLength(13);
    expect(getLiveTraitCatalogV77()).toHaveLength(17);
    for (const definition of getLiveTraitCatalogV77()) for (const state of [null, ...definition.states.map(s => s.stateId)]) for (const scale of [0, 1, 2]) {
      const next = edit(migrated, definition.familyId, state, scale);
      expect(next.entries[0].physical).toEqual(migrated.entries[0].physical);
      expect(next.entries.slice(1)).toEqual(migrated.entries.slice(1));
      expect(publicValues(next)).toEqual(expectedPublic);
      expect(applyLivePhysicalRosterV1({ players: reference.players, roster: JSON.parse(JSON.stringify(next)) }).players).toHaveLength(20);
    }
  });
  it('applies throwing technique once at execution and preserves no-op identity', () => {
    const base = initial.entries[0].physical!;
    expect(resolveLiveExecutionPhysicalV77(base)).toBe(base);
    expect(resolveLiveExecutionPhysicalV77(base, { version: 'live_trait_profile_v1', selections: [] })).toBe(base);
    for (const [state, scale] of [[null, 1], ['D', 1], ['GOLD', 0]] as const) {
      const packet = edit(initial, 'throw_accuracy', state, scale);
      expect(resolveLiveExecutionPhysicalV77(packet.entries[0].physical!, packet.entries[0].traitProfile)).toBe(packet.entries[0].physical);
    }
    for (const [state, factor] of [['GOLD', .5], ['G', 2]] as const) {
      const packet = edit(initial, 'throw_accuracy', state), physical = packet.entries[0].physical!;
      const result = resolveLiveExecutionPhysicalV77(physical, packet.entries[0].traitProfile);
      expect(result.throwDirectionStdRadians).toBeCloseTo(base.throwDirectionStdRadians! * factor, 15);
      expect(physical).toEqual(base);
      expect(result.throwSpeedMps).toBe(physical.throwSpeedMps);
      expect(resolveLiveExecutionPhysicalV77(physical, packet.entries[0].traitProfile)).toEqual(result);
    }
  });
  it('restores saved legacy green baselines instead of inverting saturated effective values', () => {
    const source = structuredClone(initial) as unknown as { entries: { physical: Record<string, unknown> }[] };
    Object.assign(source.entries[0].physical, { baserunningSafetyMarginSeconds: .1, fieldingPursuitCostWeight: .25,
      swingDecision: { approach: 'AUTO', threshold: .03, aggressionWeight: .5 } });
    let legacy = source as unknown as LiveTraitRosterInputV1;
    for (const familyId of ['running_aggression', 'fielding_aggression', 'plate_aggression']) legacy = setLiveTraitProfileV1({ roster: legacy, playerId, familyId, stateId: 'AGGRESSIVE' }).roster;
    const oldPhysical = legacy.entries[0].physical!, migrated = migrateLiveTraitRosterV77({ roster: legacy }).roster, newEntry = migrated.entries[0];
    expect(newEntry.physical).toEqual(source.entries[0].physical);
    expect(resolveLiveExecutionPhysicalV77(newEntry.physical!, newEntry.traitProfile)).toEqual(oldPhysical);
    expect(publicValues(migrated)).toEqual(publicValues(legacy));
    expect(migrated.entries.slice(1).map(e => e.physical)).toEqual(initial.entries.slice(1).map(e => e.physical));
  });
  it('retains legacy bad-ball strength without changing general base SI on later toggles', () => {
    const legacy = setLiveTraitProfileV1({ roster: initial, playerId, familyId: 'bad_ball_hitting', stateId: 'LEARNED', source: { badBallControl: .73 } }).roster;
    const migrated = migrateLiveTraitRosterV77({ roster: legacy }).roster;
    const entry = migrated.entries[0];
    expect(resolveLiveExecutionPhysicalV77(entry.physical!, entry.traitProfile)).toEqual(legacy.entries[0].physical);
    const off = edit(migrated, 'bad_ball_hitting', null), restored = setLiveTraitProfileV77({ roster: off, playerId, familyId: 'bad_ball_hitting', stateId: 'LEARNED', source: { effectScale: 1 } }).roster;
    expect(off.entries[0].physical).toEqual(entry.physical);
    expect(resolveLiveExecutionPhysicalV77(off.entries[0].physical!, off.entries[0].traitProfile).badBallControl).toBe(0);
    expect(resolveLiveExecutionPhysicalV77(restored.entries[0].physical!, restored.entries[0].traitProfile).badBallControl).toBe(.7);
  });
  it('keeps independent ownership when detailed base SI is explicitly edited', () => {
    const original = edit(initial, 'running_aggression', 'AGGRESSIVE');
    const changed = structuredClone(original) as unknown as { entries: { physical: Record<string, unknown> }[] };
    changed.entries[0].physical.baserunningSafetyMarginSeconds = .9;
    const reconciled = reconcileLiveTraitSourcesV54({ roster: changed as unknown as LiveTraitRosterInputV1, playerId, changedPaths: ['physical.baserunningSafetyMarginSeconds'] });
    expect(reconciled.entries[0].traitProfile).toEqual(original.entries[0].traitProfile);
    expect(resolveLiveExecutionPhysicalV77(reconciled.entries[0].physical!, reconciled.entries[0].traitProfile).baserunningSafetyMarginSeconds).toBe(.65);
  });
  it('does not replace a directly forced take/swing with a green batting preference', () => {
    const next = edit(initial, 'plate_aggression', 'AGGRESSIVE');
    for (const approach of ['TAKE', 'SWING'] as const) {
      const physical = { ...next.entries[0].physical!, swingDecision: { approach, threshold: .4, aggressionWeight: .5 } };
      expect(resolveLiveExecutionPhysicalV77(physical, next.entries[0].traitProfile)).toBe(physical);
    }
  });
  it('rejects invalid profiles, sources and ambiguous owners atomically without invoking getters', () => {
    const next = edit(initial, 'throw_accuracy', 'A'), before = JSON.stringify(next), p = next.entries[0].traitProfile!;
    for (const source of [{ effectScale: -1 }, { effectScale: Infinity }, { effectScale: 2.01 }, { effectScale: 1, throwDirectionStdRadians: .001 }] as Readonly<Record<string, number>>[])
      expect(() => setLiveTraitProfileV77({ roster: next, playerId, familyId: 'throw_accuracy', stateId: 'A', source })).toThrow();
    expect(() => validateLiveTraitProfileV1({ ...p, selections: [...p.selections, ...p.selections] }, next.entries[0].physical!)).toThrow();
    let invoked = false;
    expect(() => migrateLiveTraitRosterV77({ roster: { ...next, get entries() { invoked = true; return next.entries; } } })).toThrow();
    expect(invoked).toBe(false);
    expect(JSON.stringify(next)).toBe(before);
    expect(() => setLiveTraitProfileV1({ roster: next, playerId, familyId: 'throw_accuracy', stateId: 'B' })).toThrow();
  });
});
