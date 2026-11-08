import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { applyLivePhysicalRosterV1, getLiveInternalValueLimitsV82, type LivePhysicalRosterInputV1 } from './LivePhysicalRosterV1';
import { editLivePublicAbilityV1, projectLivePublicAbilitiesV1, type LivePublicAbilityReferenceV1 } from './LivePublicAbilitiesV1';
import { resolveLiveMatchPlayerPhysicalV98 } from './LiveBaseballMatchV1';
import { resolveFieldPracticePlayersV98 } from './FieldPracticeWorkbenchV98';
import { suggestLiveInternalValueV82 } from './MakerValueRecoveryV82';

const legacy = JSON.parse(readFileSync('docs/demos/live-game-roster-v98.json', 'utf8')) as LivePhysicalRosterInputV1;
const reference = JSON.parse(readFileSync('docs/demos/live-public-ability-reference-v1.json', 'utf8')) as LivePublicAbilityReferenceV1;
const withBuild = (value: number) => ({ ...legacy, entries: legacy.entries.map((e, i) => i ? e : {
  ...e, physical: { ...e.physical!, throwEffortBuildSecondsV103: value } }) });

it('resolves missing legacy charge to .60 without rewriting the packet or retaining prior edits', () => {
  const before = JSON.stringify(legacy), prior = applyLivePhysicalRosterV1({ players: reference.players, roster: withBuild(3) });
  expect(prior.players[0].physical.throwEffortBuildSecondsV103).toBe(3);
  const applied = applyLivePhysicalRosterV1({ players: prior.players, roster: legacy });
  expect(applied.players[0].physical.throwEffortBuildSecondsV103).toBe(.6);
  expect(applied.players[0].physical.transferDelayMaxSecondsV101 ?? 0).toBe(0);
  expect(resolveLiveMatchPlayerPhysicalV98(reference.players[0]).throwEffortBuildSecondsV103).toBe(.6);
  expect(resolveFieldPracticePlayersV98(applied.players)[0].physical.throwEffortBuildSecondsV103).toBe(.6);
  expect(JSON.stringify(legacy)).toBe(before);
});

it('accepts exactly 0..5 seconds, preserves precision and round trips independently of other authoring controls', () => {
  expect(getLiveInternalValueLimitsV82('throwEffortBuildSecondsV103')).toMatchObject({ minimum: 0, maximum: 5 });
  for (const value of [0, .123456789, .6, 5]) {
    const packet = withBuild(value), before = JSON.stringify(packet), applied = applyLivePhysicalRosterV1({ players: reference.players, roster: packet });
    expect(applied.players[0].physical.throwEffortBuildSecondsV103).toBe(value);
    expect(applied.players[0].physical.transferSeconds).toBe(legacy.entries[0].physical!.transferSeconds);
    expect(applied.players[0].physical.throwSpeedMps).toBe(legacy.entries[0].physical!.throwSpeedMps);
    expect(applied.players[0].physical.throwDirectionStdRadians).toBe(legacy.entries[0].physical!.throwDirectionStdRadians);
    expect(applied.players[0].traitProfile).toEqual(legacy.entries[0].traitProfile);
    expect(JSON.parse(JSON.stringify(packet))).toEqual(packet);
    expect(JSON.stringify(packet)).toBe(before);
  }
  for (const value of [-.001, 5.001, NaN, Infinity]) {
    expect(() => applyLivePhysicalRosterV1({ players: reference.players, roster: withBuild(value) })).toThrow();
    expect(() => resolveLiveMatchPlayerPhysicalV98({ ...reference.players[0], physical: {
      ...applyLivePhysicalRosterV1({ players: reference.players, roster: legacy }).players[0].physical,
      throwEffortBuildSecondsV103: value } })).toThrow();
  }
});

it('keeps shoulder 999 mapping and charge independent without adding a public ability', () => {
  const roster = withBuild(1.25), playerId = roster.entries[0].playerId, context = { roster, reference, playerId };
  const abilities = projectLivePublicAbilitiesV1(context).abilities;
  expect(abilities).toHaveLength(11);
  expect(abilities.find(a => a.id === 'arm')!.note).toContain('出力');
  expect(abilities.find(a => a.id === 'transfer')!.note).toContain('最短');
  for (const abilityId of ['arm', 'transfer', 'throwingAccuracy']) {
    const edited = editLivePublicAbilityV1({ ...context, abilityId, value: abilityId === 'arm' ? 999 : 80 });
    expect(edited.roster.entries[0].physical!.throwEffortBuildSecondsV103).toBe(1.25);
    if (abilityId === 'arm') {
      expect(edited.roster.entries[0].physical!.throwSpeedMps).toBeGreaterThan(120);
      expect(projectLivePublicAbilitiesV1({ ...context, roster: edited.roster }).abilities.find(a => a.id === 'arm')!.value).toBeCloseTo(999);
    }
  }
});

it('reuses the maker catalog defaults and bounded recovery without changing the older catalog', () => {
  const old = JSON.parse(readFileSync('docs/demos/live-game-roster-catalog-v101.json', 'utf8')),
    catalog = JSON.parse(readFileSync('docs/demos/live-game-roster-catalog-v103.json', 'utf8')),
    charge = catalog.fields.find((f: { path: string }) => f.path === 'throwEffortBuildSecondsV103');
  expect(catalog.players).toEqual(old.players);
  expect(catalog.fields).toHaveLength(old.fields.length + 1);
  expect(old.fields.some((f: { path: string }) => f.path === 'throwEffortBuildSecondsV103')).toBe(false);
  expect(charge).toMatchObject({ label: '全力で投げるための準備（秒）', default: .6, min: 0, max: 5, section: 'common' });
  const roster = withBuild(.6), playerId = roster.entries[0].playerId;
  for (const [value, suggestedValue] of [[6, 5], [-1, 0]]) {
    const result = suggestLiveInternalValueV82({ players: reference.players, roster, playerId,
      path: charge.path, value });
    expect(result).toMatchObject({ status: 'ADJUSTED', suggestedValue });
    expect(result.roster!.entries[0].physical!.throwEffortBuildSecondsV103).toBe(suggestedValue);
    expect(result.roster!.entries.slice(1)).toEqual(roster.entries.slice(1));
  }
});
