import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { battedPostResponseFlightFixture as fixture } from './BattedPostResponseFlightFixtures.test-support';
import { openSqliteBattedPostResponseFlightStore } from './SqliteBattedPostResponseFlightStore';

it.each([
  ['response', "UPDATE batted_contact_responses SET snapshot_hash='changed';"],
  ['response_model', "UPDATE batted_contact_response_models SET source_hash='changed';"],
  ['world', "UPDATE batted_world_contacts SET snapshot_hash='changed';"],
  ['flight', "UPDATE batted_ball_flights SET snapshot_hash='changed';"],
  ['workload', 'UPDATE world_player_workload_heads SET revision=revision+1;'],
  ['own_source', "UPDATE batted_post_response_flights SET source_hash='changed';"],
  ['own_archive', 'DELETE FROM batted_post_response_flights;'],
] as const)(
  'rolls back a late %s mutation on the continuation writer connection',
  (_name, sql) => {
    const {
      f,
      continuations,
      input,
      response,
    } = fixture(
      join(
        mkdtempSync(join(tmpdir(), 'batted-post-response-wal-')),
        'state.sqlite',
      ),
    );
    try {
      f.db.exec(`CREATE TRIGGER alter_continuation
        AFTER INSERT ON batted_post_response_flights
        BEGIN ${sql} END`);
      expect(() => continuations.accept(input.sourceId)).toThrow();
      expect(
        f.db.prepare(
          'SELECT count(*) AS n FROM batted_post_response_flights',
        ).get(),
      ).toEqual({ n: 0 });
      expect(
        f.db.prepare(
          'SELECT count(*) AS n FROM batted_post_response_flight_heads',
        ).get(),
      ).toEqual({ n: 0 });
      f.db.exec('DROP TRIGGER alter_continuation');
      expect(
        continuations.accept(input.sourceId).response,
      ).toEqual(response);
    } finally {
      f.close();
    }
  },
);

it('rejects a stale peer response that mutates the owned original before the transaction', () => {
  const {
    f,
    input,
    response,
    continuationAuthority,
  } = (() => {
    const base = fixture(
      join(
        mkdtempSync(join(tmpdir(), 'batted-post-response-peer-')),
        'state.sqlite',
      ),
    );
    return {
      ...base,
      continuationAuthority: {
        readAcceptedContinuation: (id: string) =>
          base.acceptedContinuations.get(id) ?? null,
      },
    };
  })();

  try {
    const changed = f.track(
      openSqliteBattedPostResponseFlightStore(
        f.path,
        {
          read: () => {
            f.db.prepare(
              "UPDATE batted_contact_responses SET snapshot_hash='changed'",
            ).run();
            return response;
          },
        },
        continuationAuthority,
      ),
    );
    expect(() => changed.accept(input.sourceId)).toThrow();
    expect(
      f.db.prepare(
        'SELECT count(*) AS n FROM batted_post_response_flights',
      ).get(),
    ).toEqual({ n: 0 });
  } finally {
    f.close();
  }
});

it('revalidates originals when an identical-retry callback mutates the saved response', () => {
  const {
    f,
    continuations,
    responses,
    input,
    acceptedContinuations,
  } = fixture(
    join(
      mkdtempSync(join(tmpdir(), 'batted-post-response-retry-')),
      'state.sqlite',
    ),
  );
  try {
    continuations.accept(input.sourceId);
    const changed = f.track(
      openSqliteBattedPostResponseFlightStore(
        f.path,
        responses,
        {
          readAcceptedContinuation: (id) => {
            f.db.prepare(
              "UPDATE batted_contact_responses SET snapshot_hash='changed'",
            ).run();
            return acceptedContinuations.get(id) ?? null;
          },
        },
      ),
    );
    expect(() => changed.accept(input.sourceId)).toThrow();
  } finally {
    f.close();
  }
});
