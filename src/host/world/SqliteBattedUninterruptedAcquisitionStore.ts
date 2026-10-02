import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import {
  deriveBattedBallUninterruptedAcquisition,
  type BattedBallUninterruptedAcquisitionResult,
} from '../../core/sim/fielding/BattedBallUninterruptedAcquisition';
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

export type AcceptedBattedUninterruptedAcquisition = Readonly<{
  sourceId: string;
  sourceVersion: string;
  contactResponseSourceId: string;
}>;

export type BattedUninterruptedAcquisitionEvidence = Extract<
  BattedBallUninterruptedAcquisitionResult,
  { kind: 'acquired' }
>;

export type DurableBattedUninterruptedAcquisition = Readonly<{
  source: AcceptedBattedUninterruptedAcquisition;
  response: DurableBattedContactResponse;
  result: BattedUninterruptedAcquisitionEvidence;
}>;

export type SqliteBattedUninterruptedAcquisitionStore = Readonly<{
  accept(sourceId: string): DurableBattedUninterruptedAcquisition;
  read(sourceId: string): DurableBattedUninterruptedAcquisition | null;
  close(): void;
}>;

type Authority = Readonly<{
  readAcceptedAcquisition(
    sourceId: string,
  ): AcceptedBattedUninterruptedAcquisition | null;
}>;

type Row = {
  source_id: string;
  contact_response_source_id: string;
  physical_pitch_source_id: string;
  game_id: string;
  source_json: string;
  source_hash: string;
  snapshot_json: string;
  snapshot_hash: string;
};

const id = (value: unknown): value is string => (
  typeof value === 'string'
  && value.length > 0
  && value === value.trim()
);

const fields = (
  value: unknown,
  names: readonly string[],
): boolean => (
  value !== null
  && typeof value === 'object'
  && !Array.isArray(value)
  && Object.keys(value).sort().join('|') === [...names].sort().join('|')
);

const input = (
  raw: AcceptedBattedUninterruptedAcquisition,
  sourceId: string,
): AcceptedBattedUninterruptedAcquisition => {
  const value = cloneInert(raw);
  if (
    !fields(value, [
      'sourceId',
      'sourceVersion',
      'contactResponseSourceId',
    ])
    || value.sourceId !== sourceId
    || ![
      value.sourceId,
      value.sourceVersion,
      value.contactResponseSourceId,
    ].every(id)
  ) {
    throw new Error('invalid accepted batted acquisition Source');
  }
  return value;
};

const acquisitionWorld = (
  response: DurableBattedContactResponse,
) => {
  const worldContact = response.touch.worldContact;
  const parameters =
    worldContact.flight.source.execution.ballFlightParameters;
  return {
    flight: worldContact.flight.flight,
    parameters,
    throughTick: (
      worldContact.flight.flight.contact.tick
      + worldContact.flight.source.searchDurationTicks
    ),
    actors: worldContact.actors,
    surfaces: worldContact.model.surfaces,
  };
};

const derive = (
  ownResponses: ReturnType<typeof battedContactResponseEvidenceFromSqlite>,
  source: AcceptedBattedUninterruptedAcquisition,
): DurableBattedUninterruptedAcquisition => {
  const response = ownResponses.read(source.contactResponseSourceId);
  if (!response) {
    throw new Error('original batted contact response is missing');
  }
  if (response.result.kind !== 'capture_candidate') {
    throw new Error('batted acquisition requires actual capture candidate');
  }

  const result = deriveBattedBallUninterruptedAcquisition({
    response: response.result,
    world: acquisitionWorld(response),
  });

  if (result.kind === 'requires_world_extension') {
    throw new Error(
      `batted acquisition requires World extension through secure tick ${result.secureTick}`,
    );
  }
  if (result.kind !== 'acquired') {
    throw new Error(
      `batted acquisition unresolved from actual response: ${result.kind}`,
    );
  }

  return freeze({
    source,
    response,
    result,
  });
};

/**
 * Owns secure acquisition derived from the original response/World evidence.
 *
 * No caller possession/stillRetained flag is accepted. Fresh writes require the
 * original response chain to remain current; historical reads intentionally do
 * not require today's workload head.
 */
export const openSqliteBattedUninterruptedAcquisitionStore = (
  path: string,
  responses: Pick<SqliteBattedContactResponseStore, 'read'>,
  authority?: Authority,
): SqliteBattedUninterruptedAcquisitionStore => {
  if (
    !id(path)
    || typeof responses?.read !== 'function'
    || (
      authority !== undefined
      && typeof authority.readAcceptedAcquisition !== 'function'
    )
  ) {
    throw new Error('invalid batted acquisition sources');
  }

  const { DatabaseSync } = createRequire(import.meta.url)(
    'node:sqlite',
  ) as typeof import('node:sqlite');
  const db = new DatabaseSync(path);
  db.exec(
    'PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;',
  );
  db.exec(`CREATE TABLE IF NOT EXISTS batted_uninterrupted_acquisitions (
    source_id TEXT PRIMARY KEY,
    contact_response_source_id TEXT NOT NULL UNIQUE,
    physical_pitch_source_id TEXT NOT NULL,
    game_id TEXT NOT NULL,
    source_json TEXT NOT NULL,
    source_hash TEXT NOT NULL,
    snapshot_json TEXT NOT NULL,
    snapshot_hash TEXT NOT NULL);`,
  );

  let closed = false;
  const check = (sourceId: string): void => {
    if (closed || !id(sourceId)) {
      throw new Error('invalid or closed batted acquisition scope');
    }
  };
  const ownResponses = battedContactResponseEvidenceFromSqlite(db);

  const read = (
    sourceId: string,
  ): DurableBattedUninterruptedAcquisition | null => {
    const row = db.prepare(
      'SELECT * FROM batted_uninterrupted_acquisitions WHERE source_id=?',
    ).get(sourceId) as Row | undefined;
    if (!row) {
      return null;
    }

    const source = input(
      JSON.parse(row.source_json) as AcceptedBattedUninterruptedAcquisition,
      sourceId,
    );
    const value = derive(ownResponses, source);
    const world = value.response.touch.worldContact;

    if (
      row.contact_response_source_id !== source.contactResponseSourceId
      || row.physical_pitch_source_id
        !== world.flight.source.physicalPitchSourceId
      || row.game_id !== value.response.model.gameId
      || row.source_json !== json(source)
      || row.source_hash !== hash(source)
      || row.snapshot_json !== json(value)
      || row.snapshot_hash !== hash(value)
    ) {
      throw new Error('corrupt batted acquisition archive');
    }
    return value;
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
        authority?.readAcceptedAcquisition(sourceId)
        ?? null;
      const source = raw === null
        ? null
        : input(raw, sourceId);

      if (prior) {
        if (source && json(source) !== json(prior.source)) {
          throw new Error('batted acquisition Source is frozen differently');
        }
        const original = read(sourceId);
        if (!original || json(original) !== json(prior)) {
          throw new Error('batted acquisition original changed during retry');
        }
        return original;
      }

      if (!source) {
        throw new Error('accepted batted acquisition Source is missing');
      }

      const value = derive(ownResponses, source);
      ownResponses.current(value.response);
      const peer = responses.read(source.contactResponseSourceId);
      if (!peer || json(peer) !== json(value.response)) {
        throw new Error('batted acquisition peer response differs');
      }

      db.exec('BEGIN IMMEDIATE');
      try {
        ownResponses.current(value.response);
        if (json(derive(ownResponses, source)) !== json(value)) {
          throw new Error(
            'batted acquisition original changed before write',
          );
        }

        const world = value.response.touch.worldContact;
        db.prepare(
          'INSERT INTO batted_uninterrupted_acquisitions VALUES (?,?,?,?,?,?,?,?)',
        ).run(
          sourceId,
          source.contactResponseSourceId,
          world.flight.source.physicalPitchSourceId,
          value.response.model.gameId,
          json(source),
          hash(source),
          json(value),
          hash(value),
        );

        ownResponses.current(value.response);
        const saved = read(sourceId);
        if (!saved || json(saved) !== json(value)) {
          throw new Error('batted acquisition changed during write');
        }

        db.exec('COMMIT');
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
