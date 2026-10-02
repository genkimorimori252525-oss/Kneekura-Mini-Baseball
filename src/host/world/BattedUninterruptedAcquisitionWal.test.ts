import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { battedUninterruptedAcquisitionFixture as fixture } from './BattedUninterruptedAcquisitionFixtures.test-support';
import { openSqliteBattedUninterruptedAcquisitionStore } from './SqliteBattedUninterruptedAcquisitionStore';

it.each([
  ['response', "UPDATE batted_contact_responses SET snapshot_hash='changed';"],
  ['response_model', "UPDATE batted_contact_response_models SET source_hash='changed';"],
  ['touch', "UPDATE batted_first_fielder_touches SET snapshot_hash='changed';"],
  ['world', "UPDATE batted_world_contacts SET snapshot_hash='changed';"],
  ['flight', "UPDATE batted_ball_flights SET snapshot_hash='changed';"],
  ['physical', "UPDATE physical_pitch_progress_actions SET source_hash='changed';"],
  ['workload', 'UPDATE world_player_workload_heads SET revision=revision+1;'],
  ['own_source', "UPDATE batted_uninterrupted_acquisitions SET source_hash='changed';"],
  ['own_mirror', "UPDATE batted_uninterrupted_acquisitions SET physical_pitch_source_id='missing';"],
  ['own_archive', 'DELETE FROM batted_uninterrupted_acquisitions;'],
] as const)(
  'rolls back late %s mutation and leaves no false acquisition',
  (_name, sql) => {
    const {
      f,
      acquisitions,
      input,
      response,
      responses,
    } = fixture(
      join(
        mkdtempSync(join(tmpdir(), 'batted-acquisition-wal-')),
        'state.sqlite',
      ),
    );
    try {
      f.db.exec(`CREATE TRIGGER alter_acquisition
        AFTER INSERT ON batted_uninterrupted_acquisitions
        BEGIN ${sql} END`);

      expect(() => acquisitions.accept(input.sourceId)).toThrow();
      expect(
        f.db.prepare(
          'SELECT count(*) AS n FROM batted_uninterrupted_acquisitions',
        ).get(),
      ).toEqual({ n: 0 });
      expect(
        responses.read(response.source.sourceId),
      ).toEqual(response);

      f.db.exec('DROP TRIGGER alter_acquisition');
      expect(
        acquisitions.accept(input.sourceId).result.kind,
      ).toBe('acquired');
    } finally {
      f.close();
    }
  },
);

it('rejects stale peer response after its getter mutates the owned original', () => {
  const {
    f,
    input,
    response,
    acquisitionAuthority,
  } = fixture(
    join(
      mkdtempSync(join(tmpdir(), 'batted-acquisition-peer-')),
      'state.sqlite',
    ),
  );

  try {
    const changed = f.track(
      openSqliteBattedUninterruptedAcquisitionStore(
        f.path,
        {
          read: () => {
            f.db.prepare(
              "UPDATE batted_contact_responses SET snapshot_hash='changed'",
            ).run();
            return response;
          },
        },
        acquisitionAuthority,
      ),
    );

    expect(() => changed.accept(input.sourceId)).toThrow();
    expect(
      f.db.prepare(
        'SELECT count(*) AS n FROM batted_uninterrupted_acquisitions',
      ).get(),
    ).toEqual({ n: 0 });
  } finally {
    f.close();
  }
});

it('revalidates original response after an identical retry callback mutates it', () => {
  const {
    f,
    acquisitions,
    responses,
    input,
    acceptedAcquisitions,
  } = fixture(
    join(
      mkdtempSync(join(tmpdir(), 'batted-acquisition-retry-')),
      'state.sqlite',
    ),
  );
  try {
    acquisitions.accept(input.sourceId);
    const changed = f.track(
      openSqliteBattedUninterruptedAcquisitionStore(
        f.path,
        responses,
        {
          readAcceptedAcquisition: (id) => {
            f.db.prepare(
              "UPDATE batted_contact_responses SET snapshot_hash='changed'",
            ).run();
            return acceptedAcquisitions.get(id) ?? null;
          },
        },
      ),
    );

    expect(() => changed.accept(input.sourceId)).toThrow();
  } finally {
    f.close();
  }
});
