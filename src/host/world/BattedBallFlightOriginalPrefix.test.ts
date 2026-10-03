import { expect, it } from 'vitest';
import { battedBallFlightFixture } from './BattedBallFlightFixtures.test-support';
import { battedBallFlightEvidenceFromSqlite } from './SqliteBattedBallFlightStore';
import { physicalPlateAppearanceActorFixture } from './PhysicalPlateAppearanceActorFixtures.test-support';
import { readOriginalPhysicalPitchPrefixFromSqlite } from './PhysicalPitchEvidenceFromSqlite';

it('reconstructs an existing Native flight without an unbounded future-pitch replay while retaining full current-write proof', () => {
  const g = battedBallFlightFixture(); try {
    const saved = g.flights.accept(g.input.sourceId);
    // A future whole-pitch reader can depend on flight. Block that recursive direction for historical proof.
    const historicalDb = { prepare: (sql: string) => {
      if (/SELECT \* FROM physical_pitch_progress_actions WHERE game_id=\? AND play_id=\? ORDER BY progress_revision/.test(sql)) {
        throw new Error('unbounded future-pitch replay crossed original flight boundary');
      }
      return g.f.db.prepare(sql);
    } };
    const own = battedBallFlightEvidenceFromSqlite(historicalDb);
    expect(own.read(g.input.sourceId)).toEqual(saved);
    // This same boundary must not turn historical replay into authorization to append a new flight.
    expect(() => own.openFrame(saved.physicalPitch)).toThrow('corrupt physical pitch progress history');
    expect(g.flights.read(g.input.sourceId)).toEqual(saved);
  } finally { g.f.close(); }
});
it('retains a legitimately earlier pitch proof while refusing its stale head as new-write authority', () => {
  const g = physicalPlateAppearanceActorFixture(); try {
    g.actors.accept(g.source.sourceId);
    const first = g.pitch(0, 0), second = g.pitch(1, first.result.pitch.resolution.timeline.lastEventTick);
    expect(readOriginalPhysicalPitchPrefixFromSqlite(g.f.db, first.source.sourceId)).toEqual([first]);
    const own = battedBallFlightEvidenceFromSqlite(g.f.db);
    expect(() => own.openFrame(first)).toThrow('current physical pitch head');
    expect(() => own.openFrame(second)).not.toThrow();
  } finally { g.f.close(); }
});
