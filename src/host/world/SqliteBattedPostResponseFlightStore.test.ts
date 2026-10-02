import { expect, it } from 'vitest';
import { battedPostResponseFlightFixture as fixture } from './BattedPostResponseFlightFixtures.test-support';
import { openSqliteBattedPostResponseFlightStore } from './SqliteBattedPostResponseFlightStore';

it.each([
  ['body', 'flight_projection'],
  ['surface', 'flight_projection'],
  ['failed_glove', 'flight_projection'],
  ['ground', 'flight_projection'],
  ['glove', 'requires_acquisition'],
  ['airborne', 'requires_world_extension'],
  ['simultaneous', 'unresolved'],
] as const)(
  'derives %s continuation from the owned Native response as %s',
  (kind, expected) => {
    const {
      f,
      continuations,
      input,
      responses,
    } = fixture(undefined, kind);
    try {
      const actual = continuations.accept(input.sourceId);
      expect(actual.result.kind).toBe(expected);
      expect(actual.response.source.sourceId).toBe(
        input.contactResponseSourceId,
      );

      const reopened = f.track(
        openSqliteBattedPostResponseFlightStore(
          f.path,
          responses,
        ),
      );
      expect(reopened.read(input.sourceId)).toEqual(actual);
      expect(reopened.accept(input.sourceId)).toEqual(actual);
    } finally {
      f.close();
    }
  },
);

it('extends only a prior physical flight projection and keeps one owned prefix', () => {
  const {
    f,
    continuations,
    input,
    acceptedContinuations,
  } = fixture();
  try {
    const first = continuations.accept(input.sourceId);
    expect(first.revision).toBe(1);
    expect(first.result.kind).toBe('flight_projection');

    const next = {
      ...input,
      sourceId: 'post-response-flight-2',
      previousContinuationSourceId: input.sourceId,
      searchDurationTicks: 200_000,
    };
    acceptedContinuations.set(next.sourceId, next);
    const second = continuations.accept(next.sourceId);

    expect(second.revision).toBe(2);
    expect(second.source.previousContinuationSourceId).toBe(
      input.sourceId,
    );
    expect(
      f.db.prepare(
        'SELECT source_id,revision FROM batted_post_response_flight_heads WHERE contact_response_source_id=?',
      ).get(input.contactResponseSourceId),
    ).toEqual({
      source_id: next.sourceId,
      revision: 2,
    });
  } finally {
    f.close();
  }
});

it('does not extend a capture candidate before acquisition exists', () => {
  const {
    f,
    continuations,
    input,
    acceptedContinuations,
  } = fixture(undefined, 'glove');
  try {
    expect(
      continuations.accept(input.sourceId).result.kind,
    ).toBe('requires_acquisition');
    const next = {
      ...input,
      sourceId: 'illegal-after-candidate',
      previousContinuationSourceId: input.sourceId,
      searchDurationTicks: 200_000,
    };
    acceptedContinuations.set(next.sourceId, next);
    expect(() => continuations.accept(next.sourceId)).toThrow(
      'predecessor',
    );
  } finally {
    f.close();
  }
});

it('rejects caller outcome injection and frozen Source rebinding', () => {
  const {
    f,
    continuations,
    input,
    acceptedContinuations,
  } = fixture();
  try {
    acceptedContinuations.set(
      input.sourceId,
      {
        ...input,
        outcome: 'OUT',
      } as typeof input,
    );
    expect(() => continuations.accept(input.sourceId)).toThrow();

    acceptedContinuations.set(input.sourceId, input);
    continuations.accept(input.sourceId);
    acceptedContinuations.set(
      input.sourceId,
      {
        ...input,
        contactResponseSourceId: 'other-response',
      },
    );
    expect(() => continuations.accept(input.sourceId)).toThrow(
      'frozen',
    );
  } finally {
    f.close();
  }
});

it('preserves an original projection after later recovery but fences a fresh extension', () => {
  const {
    f,
    continuations,
    input,
    acceptedContinuations,
  } = fixture();
  try {
    const original = continuations.accept(input.sourceId);
    const rest = {
      sourceEventId: 'post-response-rest',
      sourceVersion: 'fixture-v1',
      evidenceId: 'actual-rest',
      careerId: 'career-a',
      playerId: 'p2',
      atDay: 11,
      kind: 'RECOVERY' as const,
      durationHours: 8,
      quality: 1,
      medicalAvailability: 1,
    };
    f.activities.set(rest.sourceEventId, rest);
    f.workload.apply(rest.sourceEventId, 0);

    expect(continuations.read(input.sourceId)).toEqual(original);
    const next = {
      ...input,
      sourceId: 'post-response-after-recovery',
      previousContinuationSourceId: input.sourceId,
      searchDurationTicks: 200_000,
    };
    acceptedContinuations.set(next.sourceId, next);
    expect(() => continuations.accept(next.sourceId)).toThrow(
      'workload',
    );
  } finally {
    f.close();
  }
});

it('rejects corrupted continuation archive and closed access', () => {
  const {
    f,
    continuations,
    input,
  } = fixture();
  try {
    continuations.accept(input.sourceId);
    f.db.prepare(
      "UPDATE batted_post_response_flights SET snapshot_hash='changed'",
    ).run();
    expect(() => continuations.read(input.sourceId)).toThrow(
      'archive',
    );
  } finally {
    f.close();
  }
});
