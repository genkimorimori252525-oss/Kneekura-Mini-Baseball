import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { projectLivePublicAbilitiesV1, editLivePublicAbilityV1, type LivePublicAbilityReferenceV1 } from './LivePublicAbilitiesV1';
import type { LivePhysicalRosterInputV1 } from './LivePhysicalRosterV1';
const reference = JSON.parse(readFileSync('docs/demos/live-public-ability-reference-v1.json', 'utf8')) as LivePublicAbilityReferenceV1;
const roster = JSON.parse(readFileSync('docs/demos/live-game-roster-v98.json', 'utf8')) as LivePhysicalRosterInputV1;
const context = { reference, roster, playerId: '1-b2' };
it('exposes independent transfer using existing SI and legacy anchor without changing authored data', () => {
  const before = JSON.stringify(context), abilities = projectLivePublicAbilitiesV1(context).abilities;
  expect(abilities.find(a => a.id === 'transfer')).toMatchObject({ label: '送球動作', linkedPaths: ['transferSeconds'] });
  expect(abilities.find(a => a.id === 'field')!.linkedPaths).not.toContain('transferSeconds');
  expect(JSON.stringify(context)).toBe(before);
});
it('keeps transfer, arm and accuracy unchanged when editing field, and changes only transfer for its own control', () => {
  const abilities = projectLivePublicAbilitiesV1(context).abilities, physical = roster.entries.find(e => e.playerId === context.playerId)!.physical!;
  const field = editLivePublicAbilityV1({ ...context, abilityId: 'field', value: abilities.find(a => a.id === 'field')!.value + 5 });
  expect(field.changes.map(c => c.path)).not.toContain('transferSeconds');
  expect(field.roster.entries.find(e => e.playerId === context.playerId)!.physical!.transferSeconds).toBe(physical.transferSeconds);
  const control = abilities.find(a => a.id === 'transfer');
  expect(control).toBeDefined();
  const transfer = editLivePublicAbilityV1({ ...context, abilityId: 'transfer', value: control!.value + 10 });
  expect(transfer.changes.map(c => c.path)).toEqual(['transferSeconds']);
  expect(transfer.roster.entries.find(e => e.playerId === context.playerId)!.physical!.transferSeconds).toBeLessThan(physical.transferSeconds!);
});
