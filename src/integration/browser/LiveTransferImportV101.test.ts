import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { applyLivePhysicalRosterV1, type LivePhysicalRosterInputV1 } from './LivePhysicalRosterV1';
import type { LivePublicAbilityReferenceV1 } from './LivePublicAbilitiesV1';

it('restores missing legacy transfer width to zero even when players were previously projected with a width', () => {
  const legacy = JSON.parse(readFileSync('docs/demos/live-game-roster-v98.json', 'utf8')) as LivePhysicalRosterInputV1;
  const reference = JSON.parse(readFileSync('docs/demos/live-public-ability-reference-v1.json', 'utf8')) as LivePublicAbilityReferenceV1;
  const edited = { ...legacy, entries: legacy.entries.map((e, i) => i ? e : { ...e, physical: { ...e.physical!, transferDelayMaxSecondsV101: .15 } }) };
  const prior = applyLivePhysicalRosterV1({ players: reference.players, roster: edited });
  expect(prior.players[0].physical.transferDelayMaxSecondsV101).toBe(.15);
  const restored = applyLivePhysicalRosterV1({ players: prior.players, roster: legacy });
  expect(restored.players[0].physical.transferDelayMaxSecondsV101 ?? 0).toBe(0);
  expect(legacy.entries[0].physical?.transferDelayMaxSecondsV101).toBeUndefined();
});
