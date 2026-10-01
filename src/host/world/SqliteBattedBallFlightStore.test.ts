import { expect, it } from 'vitest';
import { battedBallFlightFixture as fixture } from './BattedBallFlightFixtures.test-support';
import { openSqliteBattedBallFlightStore } from './SqliteBattedBallFlightStore';

it('continues actual Native bat contact flight after offline reopen without turning a predicted ground into a ruling', () => {
  const { f, input, physical, acceptedFlights, flights, pitches } = fixture();
  try {
    expect(physical.result.pitch.resolution.timeline.status.kind).toBe('batted_ball_pending');
    const first = flights.accept(input.sourceId);
    expect(first.physicalPitch.frame.batterActor!.binding.playerId).toBe('away-1');
    expect(first.flight.firstGroundContact).toBeNull();
    expect(first.physicalPitch.result.pitch.resolution.timeline).toEqual(physical.result.pitch.resolution.timeline);
    const next = { ...input, sourceId: 'flight-2', previousFlightSourceId: input.sourceId, searchDurationTicks: 2_000_000 };
    acceptedFlights.set(next.sourceId, next);
    const extended = flights.accept(next.sourceId);
    expect(extended.revision).toBe(2);
    expect(extended.flight.firstGroundContact!.tick).toBeGreaterThan(extended.flight.contact.tick);
    expect(extended.flight.firstGroundContact!.state.position.y).toBeCloseTo(input.execution.ballFlightParameters.ballRadius, 4);
    expect(extended.physicalPitch.result.pitch.resolution.timeline.status.kind).toBe('batted_ball_pending');
    expect(f.official.getMatch('game-1')!.durableRevision).toBe(0);
    expect(f.workload.readHead('career-a', 'p2')!.revision).toBe(0);
    acceptedFlights.clear();
    const offline = f.track(openSqliteBattedBallFlightStore(f.path, pitches));
    expect(offline.accept(input.sourceId)).toEqual(first);
    expect(offline.read(next.sourceId)).toEqual(extended);
  } finally { f.close(); }
});

it('rejects missing actual batter identity instead of inventing a player for contact', () => {
  const { f, input, flights } = fixture(undefined, false);
  try { expect(() => flights.accept(input.sourceId)).toThrow('batter'); } finally { f.close(); }
});

it('does not produce a batted flight from a physical taken pitch', () => {
  const { f, input, flights } = fixture(undefined, true, false);
  try { expect(() => flights.accept(input.sourceId)).toThrow('contact'); } finally { f.close(); }
});

it('requires the actual previous flight, unchanged physical execution and a longer search horizon', () => {
  const { f, input, acceptedFlights, flights } = fixture();
  try {
    flights.accept(input.sourceId);
    for (const next of [
      { ...input, sourceId: 'other-initial' },
      { ...input, sourceId: 'missing-parent', previousFlightSourceId: 'missing', searchDurationTicks: 1 },
      { ...input, sourceId: 'same-horizon', previousFlightSourceId: input.sourceId },
      { ...input, sourceId: 'different-physics', previousFlightSourceId: input.sourceId, searchDurationTicks: 1,
        execution: { ...input.execution, ballFlightParameters: { ...input.execution.ballFlightParameters, gravityY: -1 } } },
    ]) { acceptedFlights.set(next.sourceId, next); expect(() => flights.accept(next.sourceId)).toThrow(); }
    acceptedFlights.set(input.sourceId, { ...input, sourceVersion: 'changed' });
    expect(() => flights.accept(input.sourceId)).toThrow('frozen');
    expect(f.db.prepare('SELECT count(*) AS n FROM batted_ball_flights').get()).toEqual({ n: 1 });
  } finally { f.close(); }
});

it('rejects caller results, a different fixture, future execution and incompatible ball/time parameters', () => {
  const { f, input, acceptedFlights, flights } = fixture();
  try {
    const cases = [
      { ...input, result: { kind: 'fair' } },
      { ...input, physicalPitchSourceId: 'missing' },
      { ...input, execution: { ...input.execution, venueId: 'other' } },
      { ...input, execution: { ...input.execution, availableAtDay: 11 } },
      { ...input, execution: { ...input.execution, ballFlightParameters: { ...input.execution.ballFlightParameters, ballRadius: 1 } } },
      { ...input, execution: { ...input.execution, ballFlightParameters: { ...input.execution.ballFlightParameters, ticksPerSecond: 1 } } },
    ];
    for (const value of cases) {
      acceptedFlights.set(input.sourceId, value);
      expect(() => flights.accept(input.sourceId)).toThrow();
      expect(f.db.prepare('SELECT count(*) AS n FROM batted_ball_flights').get()).toEqual({ n: 0 });
    }
  } finally { f.close(); }
});

it('rejects a horizon whose absolute end cannot be represented as an exact event tick', () => {
  const { f, input, acceptedFlights, flights } = fixture();
  try {
    acceptedFlights.set(input.sourceId, { ...input, searchDurationTicks: Number.MAX_SAFE_INTEGER });
    expect(() => flights.accept(input.sourceId)).toThrow();
    expect(f.db.prepare('SELECT count(*) AS n FROM batted_ball_flights').get()).toEqual({ n: 0 });
  } finally { f.close(); }
});
