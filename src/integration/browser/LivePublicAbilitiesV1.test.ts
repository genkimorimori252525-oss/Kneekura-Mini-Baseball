import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { projectLivePublicAbilitiesV1, editLivePublicAbilityV1, previewLivePublicLeagueV1, materializeLivePlateVisionV1, type LivePublicAbilityReferenceV1 } from './LivePublicAbilitiesV1';
import { resolveLivePlateVisionV1 } from './LivePhysicalRosterV1';
import type { LivePhysicalRosterInputV1 } from './LivePhysicalRosterV1';

const load = <T>(name: string): T => JSON.parse(readFileSync(new URL('../../../docs/demos/' + name, import.meta.url), 'utf8')) as T;
const reference = load<LivePublicAbilityReferenceV1>('live-public-ability-reference-v1.json');
const legacyRoster = load<LivePhysicalRosterInputV1>('live-game-roster-v2.json');
const roster = materializeLivePlateVisionV1({ roster: legacyRoster, reference }).roster;
const playerId = '1-b2';
const input = { roster, reference, playerId };
const entry = (data: LivePhysicalRosterInputV1, id = playerId) => data.entries.find(e => e.playerId === id)!;
const read = (data: LivePhysicalRosterInputV1, path: string, id = playerId) => (entry(data, id).physical as Record<string, unknown>)[path] as number;
const value = (data: LivePhysicalRosterInputV1, id: string, who = playerId) => projectLivePublicAbilitiesV1({ roster: data, reference, playerId: who }).abilities.find(a => a.id === id)!.value;

describe('public authoring with individual SI profiles', () => {
  it('migrates the old individual public values once without changing SI, source IDs or existing absolute grades', () => {
    const before = JSON.stringify(legacyRoster), migrated = materializeLivePlateVisionV1({ roster: legacyRoster, reference });
    expect(migrated.migrations).toHaveLength(20);
    for (const anchor of reference.anchors) {
      const old = entry(legacyRoster, anchor.playerId), next = entry(migrated.roster, anchor.playerId);
      expect(next).toEqual({ ...old, physical: { ...old.physical, plateVision: anchor.ratings.vision } });
    }
    expect(migrated.roster.sourceId).toBe(legacyRoster.sourceId);
    expect(materializeLivePlateVisionV1({ roster: migrated.roster, reference })).toMatchObject({ roster: migrated.roster, migrations: [] });
    expect(JSON.stringify(legacyRoster)).toBe(before);
    const oldEdited = structuredClone(legacyRoster), selected = entry(oldEdited).physical as Record<string, unknown>;
    selected.zoneJudgmentStdMeters = .05;
    const derived = materializeLivePlateVisionV1({ roster: oldEdited, reference }).roster;
    expect(read(derived, 'plateVision')).toBeCloseTo(96 + 100 * Math.log(.026 / .051));
    expect(read(derived, 'zoneJudgmentStdMeters')).toBe(.05);
  });
  it('keeps absolute vision independent of reference ratings, supplied league and changes to other players', () => {
    const changedReference = structuredClone(reference) as unknown as { anchors: { leagueId: string; ratings: Record<string, number> }[] };
    changedReference.anchors.forEach(a => { a.ratings.vision = 1; a.leagueId = 'CUSTOM'; });
    const other = editLivePublicAbilityV1({ ...input, playerId: '0-b0', abilityId: 'vision', value: 1 }).roster;
    expect(value(other, 'vision')).toBe(96);
    expect(projectLivePublicAbilitiesV1({ ...input, reference: changedReference as unknown as LivePublicAbilityReferenceV1 })
      .abilities.find(a => a.id === 'vision')).toMatchObject({ value: 96, min: 1, max: 100, linkedPaths: ['plateVision', 'zoneJudgmentStdMeters'] });
    for (const leagueId of ['MLB', 'NLB', 'NPB', 'KBO', 'CUSTOM']) expect(previewLivePublicLeagueV1({ ...input, roster: other, leagueId })
      .metrics.find(m => m.id === 'vision')).toMatchObject({ value: 96, basis: 'ABSOLUTE_1_TO_100' });
  });
  it('uses bounded fixed legacy fallback at 45 and exact explicit values without a league population', () => {
    expect(resolveLivePlateVisionV1()).toBe(45);
    expect(resolveLivePlateVisionV1({ zoneJudgmentStdMeters: .025 })).toBe(45);
    expect(resolveLivePlateVisionV1({ zoneJudgmentStdMeters: 0 })).toBe(100);
    expect(resolveLivePlateVisionV1({ zoneJudgmentStdMeters: .6 })).toBe(1);
    expect(resolveLivePlateVisionV1({ plateVision: 73, zoneJudgmentStdMeters: .6 })).toBe(73);
    for (const plateVision of [0, 100.001, NaN, Infinity]) expect(() => resolveLivePlateVisionV1({ plateVision })).toThrow();
  });
  it('edits vision at both absolute endpoints and leaves zero-error legacy SI only on an exact no-op', () => {
    for (const target of [1, 100]) {
      const changed = editLivePublicAbilityV1({ ...input, abilityId: 'vision', value: target });
      expect(value(changed.roster, 'vision')).toBe(target);
      expect(read(changed.roster, 'zoneJudgmentStdMeters')).toBeGreaterThan(0);
      expect(editLivePublicAbilityV1({ ...input, roster: changed.roster, abilityId: 'vision', value: target }).roster).toEqual(changed.roster);
    }
    const zero = structuredClone(legacyRoster);
    (entry(zero).physical as Record<string, unknown>).zoneJudgmentStdMeters = 0;
    expect(editLivePublicAbilityV1({ ...input, roster: zero, abilityId: 'vision', value: 100 }).roster).toEqual(zero);
    const changed = editLivePublicAbilityV1({ ...input, roster: zero, abilityId: 'vision', value: 45 }).roster;
    expect(read(changed, 'plateVision')).toBe(45);
    expect(read(changed, 'zoneJudgmentStdMeters')).toBe(.025);
    for (const target of [0, 100.001, NaN, Infinity]) expect(() => editLivePublicAbilityV1({ ...input, abilityId: 'vision', value: target })).toThrow();
  });
  it('projects all 20 profiles without changing the packet and exact no-op edits preserve all bytes', () => {
    const before = JSON.stringify(roster);
    for (const anchor of reference.anchors) {
      const projection = projectLivePublicAbilitiesV1({ roster, reference, playerId: anchor.playerId });
      expect(projection.abilities).toHaveLength(10);
      for (const ability of projection.abilities) {
        if (ability.id !== 'maxSpeedKmh') expect(ability.value).toBe(anchor.ratings[ability.id]);
        expect(editLivePublicAbilityV1({ roster, reference, playerId: anchor.playerId, abilityId: ability.id, value: ability.value }).roster).toEqual(roster);
      }
    }
    expect(JSON.stringify(roster)).toBe(before);
  });
  it('moves bad-ball technique out of public numeric abilities while preserving legacy SI and reference anchors', () => {
    const before = JSON.stringify(roster), legacyReference = structuredClone(reference) as unknown as { anchors: { ratings: Record<string, number> }[] };
    legacyReference.anchors.forEach(anchor => { anchor.ratings.badBallControl = 99; });
    const projection = projectLivePublicAbilitiesV1({ ...input, reference: legacyReference as unknown as LivePublicAbilityReferenceV1 });
    expect(projection.abilities.some(ability => ability.id === 'badBallControl')).toBe(false);
    expect(projection.abilities.some(ability => ability.linkedPaths.includes('badBallControl'))).toBe(false);
    expect(() => editLivePublicAbilityV1({ ...input, abilityId: 'badBallControl', value: 99 })).toThrow();
    expect(JSON.stringify(roster)).toBe(before);
    expect(read(roster, 'badBallControl')).toBe(.95);
  });
  it('improves aim and timing together while preserving their individual offset-quality ratio', () => {
    const result = editLivePublicAbilityV1({ ...input, abilityId: 'contact', value: value(roster, 'contact') + 2 });
    expect(result.changes.map(c => c.path)).toEqual(['aimStdMeters', 'timingStdSeconds']);
    expect(read(result.roster, 'aimStdMeters')).toBeLessThan(read(roster, 'aimStdMeters'));
    expect(read(result.roster, 'timingStdSeconds')).toBeLessThan(read(roster, 'timingStdSeconds'));
    expect((read(result.roster, 'aimStdMeters') + .001) / (read(result.roster, 'timingStdSeconds') + .001))
      .toBeCloseTo((read(roster, 'aimStdMeters') + .001) / (read(roster, 'timingStdSeconds') + .001), 12);
    expect(read(result.roster, 'badBallControl')).toBe(read(roster, 'badBallControl'));
    expect(result.roster.entries.filter(e => e.playerId !== playerId)).toEqual(roster.entries.filter(e => e.playerId !== playerId));
  });
  it.each([
    ['power', ['targetSweetSpotSpeedMps', 'maximumSweetSpotSpeedMps']],
    ['run', ['topSpeedMps', 'accelerationMps2']],
    ['catching', ['gloveSpeedMps', 'retentionCapacityJ', 'captureDissipationPowerW']],
  ] as const)('changes %s by a common factor and restores the original profile on reversal', (id, paths) => {
    const start = value(roster, id), first = editLivePublicAbilityV1({ ...input, abilityId: id, value: start + 2 });
    const ratios = paths.map(path => read(first.roster, path) / read(roster, path));
    ratios.forEach(ratio => expect(ratio).toBeCloseTo(Math.exp(.02), 12));
    const reversed = editLivePublicAbilityV1({ ...input, roster: first.roster, abilityId: id, value: start });
    paths.forEach(path => expect(Math.abs(read(reversed.roster, path) - read(roster, path)) / Math.max(1, Math.abs(read(roster, path))))
      .toBeLessThan(32 * Number.EPSILON));
    expect(value(first.roster, id)).toBeCloseTo(start + 2, 10);
  });
  it('keeps distinct defensive profiles instead of assigning one identical SI row to equal public values', () => {
    const first = editLivePublicAbilityV1({ ...input, playerId: '0-b1', abilityId: 'field', value: 80 }).roster;
    const second = editLivePublicAbilityV1({ ...input, playerId: '1-b3', abilityId: 'field', value: 80 }).roster;
    expect(value(first, 'field', '0-b1')).toBeCloseTo(80);
    expect(value(second, 'field', '1-b3')).toBeCloseTo(80);
    expect(read(first, 'reactionSeconds', '0-b1')).not.toBe(read(second, 'reactionSeconds', '1-b3'));
    expect(read(first, 'gloveRadiusMeters', '0-b1')).toBe(read(roster, 'gloveRadiusMeters', '0-b1'));
  });
  it('changes sensory course error for vision without changing aggression, timing, aim or actual pitch', () => {
    const result = editLivePublicAbilityV1({ ...input, abilityId: 'vision', value: value(roster, 'vision') + 1 });
    expect(result.changes.map(c => c.path)).toEqual(['plateVision', 'zoneJudgmentStdMeters']);
    expect(read(result.roster, 'plateVision')).toBe(value(roster, 'vision') + 1);
    expect(read(result.roster, 'zoneJudgmentStdMeters')).toBeLessThan(.025);
    for (const path of ['timingStdSeconds', 'aimStdMeters', 'chaseMarginMeters', 'releaseSpeedMps']) expect(read(result.roster, path)).toBe(read(roster, path));
    expect(entry(result.roster).physical!.swingDecision).toEqual(entry(roster).physical!.swingDecision);
  });
  it('changes physical speed in km/h and preserves the baseline-release to maximum ratio', () => {
    const id = '1-p0', ratio = read(roster, 'releaseSpeedMps', id) / read(roster, 'maximumPitchSpeedMps', id);
    const result = editLivePublicAbilityV1({ ...input, playerId: id, abilityId: 'maxSpeedKmh', value: 155 }).roster;
    expect(read(result, 'maximumPitchSpeedMps', id)).toBeCloseTo(155 / 3.6);
    expect(read(result, 'releaseSpeedMps', id) / read(result, 'maximumPitchSpeedMps', id)).toBeCloseTo(ratio);
    expect(value(result, 'maxSpeedKmh', id)).toBeCloseTo(155);
  });
  it('rejects invalid edits atomically and does not silently clip an impossible physical request', () => {
    const before = JSON.stringify(roster);
    for (const n of [-1, 101, NaN, Infinity]) expect(() => editLivePublicAbilityV1({ ...input, abilityId: 'power', value: n })).toThrow();
    expect(() => editLivePublicAbilityV1({ ...input, abilityId: 'not-a-control', value: 70 })).toThrow();
    expect(() => editLivePublicAbilityV1({ ...input, playerId: 'missing', abilityId: 'power', value: 70 })).toThrow();
    const impossible = structuredClone(roster);
    const selected = entry(impossible).physical as Record<string, unknown>;
    selected.aimStdMeters = .35; selected.timingStdSeconds = 0;
    expect(() => editLivePublicAbilityV1({ ...input, roster: impossible, abilityId: 'contact', value: 100 })).toThrow();
    expect(JSON.stringify(roster)).toBe(before);
  });
  it('reprojects detailed SI imports and accepts original v40 packets with omitted sensory error', () => {
    const old = load<LivePhysicalRosterInputV1>('live-game-roster-v1.json'), before = JSON.stringify(old);
    const projection = projectLivePublicAbilitiesV1({ ...input, roster: old });
    expect(projection.abilities.every(a => Number.isFinite(a.value))).toBe(true);
    expect(projection.abilities.find(a => a.id === 'vision')!.value).toBe(45);
    for (const ability of projection.abilities) expect(editLivePublicAbilityV1({ ...input, roster: old, abilityId: ability.id, value: ability.value }).roster).toEqual(old);
    expect(JSON.stringify(old)).toBe(before);
  });
  it('does not accumulate revisions or compound edits when recomputing the current public value', () => {
    const first = editLivePublicAbilityV1({ ...input, abilityId: 'power', value: 95 }).roster;
    const projected = value(first, 'power');
    const second = editLivePublicAbilityV1({ ...input, roster: first, abilityId: 'power', value: projected }).roster;
    expect(second).toEqual(first);
    expect(first.sourceId.split(':public-edited')).toHaveLength(2);
    expect(entry(first).sourceId.split(':public-edited')).toHaveLength(2);
  });
  it('uses only the supplied league cohort for preview, excludes pitchers from batting and never mutates SI', () => {
    const before = JSON.stringify(roster);
    const mlb = previewLivePublicLeagueV1({ ...input, leagueId: 'MLB' });
    expect(mlb.sampleCount).toBe(10);
    expect(mlb.metrics.find(m => m.id === 'contact')!.sampleCount).toBe(9);
    expect(mlb.metrics.find(m => m.id === 'control')!.value).toBeNull();
    expect(mlb.basis).toBe('SUPPLIED_LOCAL_SAMPLE_NOT_OFFICIAL_LEAGUE_POPULATION');
    for (const leagueId of ['NLB', 'NPB', 'KBO', 'CUSTOM']) {
      const result = previewLivePublicLeagueV1({ ...input, leagueId });
      if (!['NLB'].includes(leagueId)) expect(result.metrics.filter(m => m.id !== 'vision').every(m => m.value === null)).toBe(true);
      expect(result.metrics.find(m => m.id === 'vision')).toMatchObject({ value: value(roster, 'vision'), basis: 'ABSOLUTE_1_TO_100' });
    }
    expect(JSON.stringify(roster)).toBe(before);
  });
  it('has no identity, affiliation or manager-result multipliers in the SI edit', () => {
    const renamed = structuredClone(reference) as unknown as { players: { name: string }[]; anchors: { leagueId: string }[] };
    renamed.players.forEach(p => p.name = 'renamed'); renamed.anchors.forEach(a => a.leagueId = 'CUSTOM');
    const expected = editLivePublicAbilityV1({ ...input, abilityId: 'power', value: 95 }).roster;
    const actual = editLivePublicAbilityV1({ ...input, reference: renamed as unknown as LivePublicAbilityReferenceV1, abilityId: 'power', value: 95 }).roster;
    expect(actual).toEqual(expected);
  });
});
