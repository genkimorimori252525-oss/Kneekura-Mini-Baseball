import { expect, it, vi } from 'vitest';
import { canonical } from './PrePitchRunnerFixtures.test-support';
import { prePitchRunnerContactFixture } from './PrePitchRunnerContactFixtures.test-support';
import { battedWorldContactEvidenceFromSqlite } from './SqliteBattedWorldContactStore';
const state = vi.hoisted(() => ({ flight: null as any }));
vi.mock('./SqliteBattedBallFlightStore', () => ({ battedBallFlightEvidenceFromSqlite: () => ({ read: () => state.flight }) }));
const fixture = () => { const x = prePitchRunnerContactFixture(); state.flight = x.flight; return x; };

it('connects the owned runner to eleven participants and 55 primitives in the real ball/contact kernel', () => {
  const { db, source, model } = fixture();
  try {
    const value = battedWorldContactEvidenceFromSqlite(db).derive(source, model, null);
    expect(value.actors).toHaveLength(55); expect(new Set(value.actors.map(a => a.playerId)).size).toBe(11);
    expect(value.result).toMatchObject({ kind: 'contact', contacts: [{ kind: 'actor', playerId: 'runner', role: 'body' }] });
    expect(value.timeline).toEqual(state.flight.physicalPitch.result.pitch.resolution.timeline);
    expect(value).not.toHaveProperty('playEnd'); expect(value).not.toHaveProperty('interference');
  } finally { db.close(); }
});

it.each(['missing_owner', 'wrong_owner', 'legacy_contact', 'extra_command', 'second_runner', 'boundary'])
('rejects %s without broadening the old ten-player path', kind => {
  const { db, source: original, model } = fixture(), source = structuredClone(original) as any;
  try {
    if (kind === 'missing_owner') delete state.flight.physicalPitch.frame.prePitchRunner;
    if (kind === 'wrong_owner') source.prePitchRunnerSourceId = 'other';
    if (kind === 'legacy_contact') { delete source.kind; delete source.prePitchRunnerSourceId; }
    if (kind === 'extra_command') source.commands.push({ ...source.commands[0], playerId: 'runner' });
    if (kind === 'second_runner') state.flight.physicalPitch.frame.world.runners.push({ playerId: 'other', position: canonical.position, velocity: canonical.velocity });
    if (kind === 'boundary') state.flight.source.searchDurationTicks = 2_000_000;
    expect(() => battedWorldContactEvidenceFromSqlite(db).derive(source, model, null)).toThrow();
  } finally { db.close(); }
});
