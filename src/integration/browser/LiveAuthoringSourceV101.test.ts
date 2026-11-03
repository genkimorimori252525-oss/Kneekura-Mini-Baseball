import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { getLiveTraitCatalogV77, projectLiveTraitProfilesV77, setLiveTraitProfileV77 } from './LiveTraitRuntimeV77';
import { projectLiveTraitProfilesV1, setLiveTraitProfileV1 } from './LiveTraitProfilesV1';
import { editLivePublicAbilityV1, type LivePublicAbilityReferenceV1 } from './LivePublicAbilitiesV1';
import type { LivePhysicalRosterInputV1 } from './LivePhysicalRosterV1';
import { markLiveAuthoringSourceV101 } from './LiveAuthoringSourceV101';

it('accepts a valid 200-character legacy provenance without discarding its origin binding', () => {
  const source = 'legacy-origin-' + 'x'.repeat(186);
  expect(source).toHaveLength(200);
  const marked = markLiveAuthoringSourceV101(source, 'public-edited');
  expect(marked.length).toBeLessThanOrEqual(160);
  expect(marked).toMatch(/^authoring-origin-[a-f0-9]{16}:public-edited$/);
  expect(markLiveAuthoringSourceV101(marked, 'public-edited')).toBe(marked);
  expect(markLiveAuthoringSourceV101(source.replace(/x$/, 'y'), 'public-edited')).not.toBe(marked);
});

it('bounds an old oversized revision token as well as the opaque origin', () => {
  const source = 'root:maker-edited-r' + '9'.repeat(130);
  expect(source.length).toBeLessThanOrEqual(160);
  const next = markLiveAuthoringSourceV101(source, 'public-edited');
  expect(next.length).toBeLessThanOrEqual(160);
  expect(markLiveAuthoringSourceV101(next, 'public-edited')).toBe(next);
});

it('projects and edits roster-valid 200-character sources before applying the bounded editor mark', () => {
  const input = JSON.parse(readFileSync('docs/demos/live-game-roster-v98.json', 'utf8')) as LivePhysicalRosterInputV1;
  const roster = { ...input, sourceId: 'r'.repeat(200), entries: input.entries.map((e, i) => i ? e : { ...e, sourceId: 'e'.repeat(200) }) }, playerId = input.entries[0].playerId;
  expect(() => projectLiveTraitProfilesV77({ roster, playerId })).not.toThrow();
  expect(() => projectLiveTraitProfilesV1({ roster, playerId })).not.toThrow();
  for (const edit of [setLiveTraitProfileV77, setLiveTraitProfileV1]) {
    const next = edit({ roster, playerId, familyId: 'bad_ball_hitting', stateId: null }).roster;
    expect(next.sourceId.length).toBeLessThanOrEqual(160);
    expect(next.entries[0].sourceId.length).toBeLessThanOrEqual(160);
    if (edit === setLiveTraitProfileV77) expect(next.entries[0].physical).toEqual(roster.entries[0].physical);
    expect(next.entries.slice(1)).toEqual(roster.entries.slice(1));
  }
  expect(roster.sourceId).toHaveLength(200);
});

it('edits an imported 155-character source repeatedly without losing player data or blocking on provenance length', () => {
  let roster = JSON.parse(readFileSync('docs/demos/live-game-roster-v98.json', 'utf8')) as LivePhysicalRosterInputV1;
  const reference = JSON.parse(readFileSync('docs/demos/live-public-ability-reference-v1.json', 'utf8')) as LivePublicAbilityReferenceV1;
  roster = { ...roster, sourceId: 'USER_APPROVED_PROVISIONAL_SI_V3_TRAIT_OWNERSHIP_20261018:release-geometry-v62:swing-edited-r8:public-edited:trait-edited:maker-edited-r37:swing-edited-r123' };
  expect(roster.sourceId).toHaveLength(155);
  const original = structuredClone(roster), playerId = roster.entries[0].playerId;
  for (let i = 0; i < 110; i++) {
    roster = setLiveTraitProfileV77({ roster, playerId, familyId: 'bad_ball_hitting', stateId: i % 2 ? null : getLiveTraitCatalogV77().find(t => t.familyId === 'bad_ball_hitting')!.states[0].stateId, source: { badBallControl: .45, effectScale: 1 } }).roster;
    roster = editLivePublicAbilityV1({ roster, reference, playerId, abilityId: 'contact', value: 70 + i % 2 }).roster;
    expect(roster.sourceId.length).toBeLessThanOrEqual(160);
    expect(roster.entries.slice(1)).toEqual(original.entries.slice(1));
    expect(roster.entries[0].playerId).toBe(playerId);
  }
  expect(original.sourceId).toHaveLength(155);
});
