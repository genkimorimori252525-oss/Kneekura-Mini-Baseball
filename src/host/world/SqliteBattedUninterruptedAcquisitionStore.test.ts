import { expect, it } from 'vitest';
import { battedUninterruptedAcquisitionFixture as fixture } from './BattedUninterruptedAcquisitionFixtures.test-support';
import { openSqliteBattedUninterruptedAcquisitionStore } from './SqliteBattedUninterruptedAcquisitionStore';

it('derives and reopens secure acquisition from original Native response and World evidence', () => {
  const {
    f,
    acquisitions,
    input,
    response,
    responses,
  } = fixture();
  try {
    const actual = acquisitions.accept(input.sourceId);
    expect(actual.response).toEqual(response);
    expect(actual.result).toMatchObject({
      kind: 'acquired',
      fielderId: 'p2',
    });
    expect(actual).not.toHaveProperty('possession');
    expect(actual).not.toHaveProperty('out');
    expect(actual).not.toHaveProperty('match');

    const reopened = f.track(
      openSqliteBattedUninterruptedAcquisitionStore(
        f.path,
        responses,
      ),
    );
    expect(reopened.read(input.sourceId)).toEqual(actual);
    expect(reopened.accept(input.sourceId)).toEqual(actual);
  } finally {
    f.close();
  }
});

it('does not persist acquisition when the original World interval ends before secure possession', () => {
  const {
    f,
    acquisitions,
    input,
  } = fixture(undefined, 'glove', 0.1);
  try {
    expect(() => acquisitions.accept(input.sourceId)).toThrow(
      'requires World extension',
    );
    expect(
      f.db.prepare(
        'SELECT count(*) AS n FROM batted_uninterrupted_acquisitions',
      ).get(),
    ).toEqual({ n: 0 });
  } finally {
    f.close();
  }
});

it.each([
  'body',
  'failed_glove',
  'ground',
  'surface',
  'airborne',
  'simultaneous',
] as const)(
  'rejects %s response instead of manufacturing acquisition',
  (kind) => {
    const {
      f,
      acquisitions,
      input,
    } = fixture(undefined, kind);
    try {
      expect(() => acquisitions.accept(input.sourceId)).toThrow(
        'capture candidate',
      );
      expect(
        f.db.prepare(
          'SELECT count(*) AS n FROM batted_uninterrupted_acquisitions',
        ).get(),
      ).toEqual({ n: 0 });
    } finally {
      f.close();
    }
  },
);

it('rejects caller possession authority and source rebinding', () => {
  const {
    f,
    acquisitions,
    input,
    acceptedAcquisitions,
  } = fixture();
  try {
    acceptedAcquisitions.set(
      input.sourceId,
      {
        ...input,
        stillRetained: true,
      } as typeof input,
    );
    expect(() => acquisitions.accept(input.sourceId)).toThrow(
      'invalid accepted batted acquisition Source',
    );

    acceptedAcquisitions.set(input.sourceId, input);
    acquisitions.accept(input.sourceId);
    acceptedAcquisitions.set(input.sourceId, {
      ...input,
      contactResponseSourceId: 'other-response',
    });
    expect(() => acquisitions.accept(input.sourceId)).toThrow(
      'frozen',
    );
  } finally {
    f.close();
  }
});

it('keeps historical acquisition readable after legitimate later recovery', () => {
  const {
    f,
    acquisitions,
    input,
    responses,
  } = fixture();
  try {
    const original = acquisitions.accept(input.sourceId);
    const rest = {
      sourceEventId: 'acquisition-rest',
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

    expect(acquisitions.read(input.sourceId)).toEqual(original);
    const reopened = f.track(
      openSqliteBattedUninterruptedAcquisitionStore(
        f.path,
        responses,
      ),
    );
    expect(reopened.accept(input.sourceId)).toEqual(original);
  } finally {
    f.close();
  }
});

it('detects archive corruption and enforces store lifecycle', () => {
  const {
    f,
    acquisitions,
    input,
  } = fixture();
  try {
    acquisitions.accept(input.sourceId);
    f.db.prepare(
      "UPDATE batted_uninterrupted_acquisitions SET snapshot_hash='changed'",
    ).run();
    expect(() => acquisitions.read(input.sourceId)).toThrow(
      'archive',
    );
    acquisitions.close();
    expect(() => acquisitions.read(input.sourceId)).toThrow(
      'closed',
    );
  } finally {
    f.close();
  }
});
