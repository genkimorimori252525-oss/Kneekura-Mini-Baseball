import { beginActualLivePitchWrite, recordActualLivePlayAdmission, assertActualLivePlayWriteUnchanged } from './ActualLivePlayFence';
import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import {
  deriveBattedBallPostResponseFlight,
  type BattedBallPostResponseFlightResult,
} from '../../core/sim/ball/BattedBallPostResponseFlight';
import {
  actorFreeze as freeze,
  actorHash as hash,
  actorJson as json,
} from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import {
  battedContactResponseEvidenceFromSqlite,
  type DurableBattedContactResponse,
  type SqliteBattedContactResponseStore,
} from './SqliteBattedContactResponseStore';

export type AcceptedBattedPostResponseFlight = Readonly<{
  sourceId: string;
  sourceVersion: string;
  contactResponseSourceId: string;
  previousContinuationSourceId: string | null;
  searchDurationTicks: number;
}>;

export type DurableBattedPostResponseFlight = Readonly<{
  source: AcceptedBattedPostResponseFlight;
  revision: number;
  response: DurableBattedContactResponse;
  result: BattedBallPostResponseFlightResult;
}>;

export type SqliteBattedPostResponseFlightStore = Readonly<{
  accept(sourceId: string): DurableBattedPostResponseFlight;
  read(sourceId: string): DurableBattedPostResponseFlight | null;
  close(): void;
}>;

type Authority = Readonly<{
  readAcceptedContinuation(
    sourceId: string,
  ): AcceptedBattedPostResponseFlight | null;
}>;

type Row = {
  source_id: string;
  contact_response_source_id: string;
  game_id: string;
  revision: number;
  previous_source_id: string | null;
  source_json: string;
  source_hash: string;
  snapshot_json: string;
  snapshot_hash: string;
};

const id = (value: unknown): value is string =>
  typeof value === 'string'
  && value.length > 0
  && value === value.trim();

const integer = (value: unknown): value is number =>
  typeof value === 'number'
  && Number.isSafeInteger(value)
  && value >= 0;

const fields = (
  value: unknown,
  names: readonly string[],
): boolean =>
  value !== null
  && typeof value === 'object'
  && !Array.isArray(value)
  && Object.keys(value).sort().join('|') === [...names].sort().join('|');

const input = (
  raw: AcceptedBattedPostResponseFlight,
  sourceId: string,
): AcceptedBattedPostResponseFlight => {
  const value = cloneInert(raw);
  if (
    !fields(value, [
      'sourceId',
      'sourceVersion',
      'contactResponseSourceId',
      'previousContinuationSourceId',
      'searchDurationTicks',
    ])
    || value.sourceId !== sourceId
    || ![
      value.sourceId,
      value.sourceVersion,
      value.contactResponseSourceId,
    ].every(id)
    || (
      value.previousContinuationSourceId !== null
      && (
        !id(value.previousContinuationSourceId)
        || value.previousContinuationSourceId === sourceId
      )
    )
    || !integer(value.searchDurationTicks)
  ) {
    throw new Error('invalid accepted batted post-response continuation Source');
  }
  return value;
};

/**
 * Owns a post-response ball-flight projection from the original response archive.
 *
 * The saved projection is not absence-of-contact proof. A later World geometry owner
 * must clip or confirm it before any possession/rule/result consumer may use it.
 */
export const openSqliteBattedPostResponseFlightStore = (
  path: string,
  responses: Pick<SqliteBattedContactResponseStore, 'read'>,
  authority?: Authority,
): SqliteBattedPostResponseFlightStore => {
  if (
    !id(path)
    || typeof responses?.read !== 'function'
    || (
      authority !== undefined
      && typeof authority.readAcceptedContinuation !== 'function'
    )
  ) {
    throw new Error('invalid batted post-response continuation sources');
  }

  const { DatabaseSync } = createRequire(import.meta.url)(
    'node:sqlite',
  ) as typeof import('node:sqlite');
  const db = new DatabaseSync(path);
  db.exec(
    'PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;',
  );
  db.exec(`CREATE TABLE IF NOT EXISTS batted_post_response_flights (
    source_id TEXT PRIMARY KEY,
    contact_response_source_id TEXT NOT NULL,
    game_id TEXT NOT NULL,
    revision INTEGER NOT NULL,
    previous_source_id TEXT,
    source_json TEXT NOT NULL,
    source_hash TEXT NOT NULL,
    snapshot_json TEXT NOT NULL,
    snapshot_hash TEXT NOT NULL,
    UNIQUE(contact_response_source_id,revision));
    CREATE TABLE IF NOT EXISTS batted_post_response_flight_heads (
      contact_response_source_id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL,
      revision INTEGER NOT NULL);`,
  );

  let closed = false;
  const check = (sourceId: string): void => {
    if (closed || !id(sourceId)) {
      throw new Error('invalid or closed batted post-response continuation scope');
    }
  };

  const ownResponses = battedContactResponseEvidenceFromSqlite(db);

  const read = (
    sourceId: string,
    seen = new Set<string>(),
  ): DurableBattedPostResponseFlight | null => {
    if (!id(sourceId)) {
      throw new Error('invalid batted post-response continuation scope');
    }
    if (seen.has(sourceId)) {
      throw new Error('cyclic batted post-response continuation archive');
    }
    seen.add(sourceId);

    const row = db.prepare(
      'SELECT * FROM batted_post_response_flights WHERE source_id=?',
    ).get(sourceId) as Row | undefined;
    if (!row) {
      return null;
    }

    const source = input(
      JSON.parse(row.source_json) as AcceptedBattedPostResponseFlight,
      sourceId,
    );
    const response = ownResponses.read(source.contactResponseSourceId);
    if (!response) {
      throw new Error('original batted contact response is missing');
    }
    const parent = source.previousContinuationSourceId === null
      ? null
      : read(source.previousContinuationSourceId, seen);

    if (
      source.previousContinuationSourceId === null
        ? parent !== null
        : (
            !parent
            || parent.source.sourceId !== source.previousContinuationSourceId
            || parent.source.contactResponseSourceId
              !== source.contactResponseSourceId
            || parent.result.kind !== 'flight_projection'
            || source.searchDurationTicks
              <= parent.source.searchDurationTicks
          )
    ) {
      throw new Error(
        'batted post-response continuation predecessor differs',
      );
    }

    const parameters =
      response.touch.worldContact.flight.source.execution.ballFlightParameters;
    const result = deriveBattedBallPostResponseFlight({
      response: response.result,
      parameters,
      searchDurationTicks: source.searchDurationTicks,
    });
    const value = freeze({
      source,
      revision: (parent?.revision ?? 0) + 1,
      response,
      result,
    });

    if (
      row.contact_response_source_id !== source.contactResponseSourceId
      || row.game_id !== response.model.gameId
      || row.revision !== value.revision
      || row.previous_source_id !== source.previousContinuationSourceId
      || row.source_json !== json(source)
      || row.source_hash !== hash(source)
      || row.snapshot_json !== json(value)
      || row.snapshot_hash !== hash(value)
    ) {
      throw new Error('corrupt batted post-response continuation archive');
    }
    return value;
  };

  const head = (contactResponseSourceId: string) => {
    const current = db.prepare(
      'SELECT source_id,revision FROM batted_post_response_flight_heads WHERE contact_response_source_id=?',
    ).get(contactResponseSourceId);
    const last = db.prepare(
      'SELECT source_id,revision FROM batted_post_response_flights WHERE contact_response_source_id=? ORDER BY revision DESC LIMIT 1',
    ).get(contactResponseSourceId);
    const count = db.prepare(
      'SELECT count(*) AS n,min(revision) AS first_revision FROM batted_post_response_flights WHERE contact_response_source_id=?',
    ).get(contactResponseSourceId) as {
      n: number;
      first_revision: number | null;
    };

    if (
      json(current ?? null) !== json(last ?? null)
      || count.n !== (current?.revision ?? 0)
      || (
        current
        && (
          !integer(current.revision)
          || count.first_revision !== 1
        )
      )
    ) {
      throw new Error('batted post-response continuation head or prefix differs');
    }
    return current as { source_id: string; revision: number } | undefined;
  };

  const predecessor = (
    source: AcceptedBattedPostResponseFlight,
  ): DurableBattedPostResponseFlight | null => {
    const current = head(source.contactResponseSourceId);
    if (
      (current?.source_id ?? null)
      !== source.previousContinuationSourceId
    ) {
      throw new Error(
        'batted post-response continuation current predecessor differs',
      );
    }
    return current ? read(current.source_id) : null;
  };

  const derive = (
    source: AcceptedBattedPostResponseFlight,
    parent: DurableBattedPostResponseFlight | null,
  ): DurableBattedPostResponseFlight => {
    const response = ownResponses.read(source.contactResponseSourceId);
    if (!response) {
      throw new Error('original batted contact response is missing');
    }
    if (
      source.previousContinuationSourceId === null
        ? parent !== null
        : (
            !parent
            || parent.source.sourceId !== source.previousContinuationSourceId
            || parent.source.contactResponseSourceId
              !== source.contactResponseSourceId
            || parent.result.kind !== 'flight_projection'
            || source.searchDurationTicks
              <= parent.source.searchDurationTicks
          )
    ) {
      throw new Error(
        'batted post-response continuation predecessor differs',
      );
    }
    const parameters =
      response.touch.worldContact.flight.source.execution.ballFlightParameters;
    const result = deriveBattedBallPostResponseFlight({
      response: response.result,
      parameters,
      searchDurationTicks: source.searchDurationTicks,
    });
    return freeze({
      source,
      revision: (parent?.revision ?? 0) + 1,
      response,
      result,
    });
  };

  return Object.freeze({
    read(sourceId) {
      check(sourceId);
      return read(sourceId);
    },
    accept(sourceId) {
      check(sourceId);
      const prior = read(sourceId);
      const raw =
        authority?.readAcceptedContinuation(sourceId)
        ?? null;
      const source = raw === null
        ? null
        : input(raw, sourceId);

      if (prior) {
        if (source && json(source) !== json(prior.source)) {
          throw new Error(
            'batted post-response continuation Source is frozen differently',
          );
        }
        const original = read(sourceId);
        if (!original || json(original) !== json(prior)) {
          throw new Error(
            'batted post-response continuation original changed during retry',
          );
        }
        return original;
      }
      if (!source) {
        throw new Error(
          'accepted batted post-response continuation Source is missing',
        );
      }

      const value = derive(source, predecessor(source));
      ownResponses.current(value.response);
      const peer = responses.read(source.contactResponseSourceId);
      if (!peer || json(peer) !== json(value.response)) {
        throw new Error(
          'batted post-response continuation peer response differs',
        );
      }

      db.exec('BEGIN IMMEDIATE');
      try {
        const liveFence = beginActualLivePitchWrite(db, value.response.touch.worldContact.flight.source.physicalPitchSourceId, { owner: 'batted_post_response_flights', sourceId });
        ownResponses.current(value.response);
        if (
          json(derive(source, predecessor(source)))
          !== json(value)
        ) {
          throw new Error(
            'batted post-response continuation original changed before write',
          );
        }
        db.prepare(
          'INSERT INTO batted_post_response_flights VALUES (?,?,?,?,?,?,?,?,?)',
        ).run(
          sourceId,
          source.contactResponseSourceId,
          value.response.model.gameId,
          value.revision,
          source.previousContinuationSourceId,
          json(source),
          hash(source),
          json(value),
          hash(value),
        );
        db.prepare(`INSERT INTO batted_post_response_flight_heads
          VALUES (?,?,?)
          ON CONFLICT(contact_response_source_id)
          DO UPDATE SET source_id=excluded.source_id,revision=excluded.revision`,
        ).run(
          source.contactResponseSourceId,
          sourceId,
          value.revision,
        );

        recordActualLivePlayAdmission(db, liveFence);
        ownResponses.current(value.response);
        const saved = read(sourceId);
        const current = head(source.contactResponseSourceId);
        if (
          !saved
          || json(saved) !== json(value)
          || json(current) !== json({
            source_id: sourceId,
            revision: value.revision,
          })
        ) {
          throw new Error(
            'batted post-response continuation changed during write',
          );
        }
        assertActualLivePlayWriteUnchanged(db, liveFence); db.exec('COMMIT');
        return saved;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    close() {
      if (!closed) {
        db.close();
        closed = true;
      }
    },
  });
};
