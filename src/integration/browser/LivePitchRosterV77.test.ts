import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { applyLivePhysicalRosterV1, type LivePhysicalRosterInputV1 } from './LivePhysicalRosterV1';
import type { LivePlayerV1 } from './LiveBaseballMatchV1';

const initial: LivePhysicalRosterInputV1 = JSON.parse(readFileSync('docs/demos/live-game-roster-v62.json', 'utf8'));
const players: readonly LivePlayerV1[] = JSON.parse(readFileSync('docs/demos/live-game-roster-catalog-v62.json', 'utf8')).players;
const make = () => { const packet = structuredClone(initial) as unknown as { entries: { throws?: string; physical: Record<string, unknown> }[] };
  packet.entries[0].throws = 'L';
  Object.assign(packet.entries[0].physical, { pitchRepertoire: [{ pitchType: 'curve', releaseSpeedMps: 32, spinRadPerSecond: { x: -200, y: 15, z: 10 } }], pitchingMotion: { preparationMs: 1800, headMotionScale: .7 } });
  return packet;
};
it('preserves optional repertoire, motion and throwing hand through the existing roster adapter', () => {
  const roster = make(), before = JSON.stringify(roster), result = applyLivePhysicalRosterV1({ players, roster });
  expect(result.players[0].throws).toBe('L');
  expect(result.players[0].physical.pitchRepertoire).toEqual(roster.entries[0].physical.pitchRepertoire);
  expect(result.players[0].physical.pitchingMotion).toEqual(roster.entries[0].physical.pitchingMotion);
  expect(JSON.stringify(roster)).toBe(before);
  expect(result.audit.players[0].projected.some(p => p.inputPath === 'throws' && p.targetPath === 'throws')).toBe(true);
});
it('rejects invalid hand, duplicate/over-speed pitches and invalid motion atomically', () => {
  for (const mutate of [
    (packet: ReturnType<typeof make>) => { packet.entries[0].throws = 'S'; },
    (packet: ReturnType<typeof make>) => { const rows = packet.entries[0].physical.pitchRepertoire as unknown[]; rows.push(rows[0]); },
    (packet: ReturnType<typeof make>) => { (packet.entries[0].physical.pitchRepertoire as { releaseSpeedMps: number }[])[0].releaseSpeedMps = 86; },
    (packet: ReturnType<typeof make>) => { packet.entries[0].physical.maximumPitchSpeedMps = 30; },
    (packet: ReturnType<typeof make>) => { packet.entries[0].physical.pitchingMotion = { preparationMs: 100, headMotionScale: 1 }; },
  ]) {
    const roster = make(); mutate(roster); const before = JSON.stringify(roster);
    expect(() => applyLivePhysicalRosterV1({ players, roster })).toThrow(); expect(JSON.stringify(roster)).toBe(before);
  }
});
it('does not add optional pitch authoring fields or a hand when omitted from legacy input', () => {
  const result = applyLivePhysicalRosterV1({ players, roster: initial });
  expect(result.players[0].physical).not.toHaveProperty('pitchRepertoire');
  expect(result.players[0].physical).not.toHaveProperty('pitchingMotion');
  expect(result.players[0].throws).toBe(players[0].throws);
});
