import { createRequire } from 'node:module';
import { changeHumanControl, createHumanControlState } from
  '../../core/world/control/HumanControl';
import type { HumanControlChange, HumanControlState } from
  '../../core/world/control/ControlTypes';

export type DurableWorldControlHead = Readonly<{
  careerId: string;
  worldRevision: number;
  control: HumanControlState;
}>;
export type SqliteWorldControlStore = Readonly<{
  initialize(input: DurableWorldControlHead): void;
  readHead(careerId: string): DurableWorldControlHead | null;
  changeControl(input: Readonly<{ careerId: string;
    expectedWorldRevision: number;
    change: HumanControlChange }>): DurableWorldControlHead;
  close(): void;
}>;
type HeadRow = { world_revision: number;
  control_revision: number; control_json: string };
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0
    && value === value.trim();
const revision = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;

/** A decision revision is a durable sequence, separate from season/Club revisions. */
export const openSqliteWorldControlStore = (
  databasePath: string,
): SqliteWorldControlStore => {
  if (!id(databasePath)) throw new Error('invalid world database path');
  const sqlite: typeof import('node:sqlite') =
    createRequire(import.meta.url)('node:sqlite');
  const db = new sqlite.DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_control_heads (
    career_id TEXT PRIMARY KEY,
    world_revision INTEGER NOT NULL,
    control_revision INTEGER NOT NULL,
    control_json TEXT NOT NULL,
    CHECK (world_revision >= 0),
    CHECK (control_revision >= 0)
  );
  CREATE TABLE IF NOT EXISTS world_decision_revision_events (
    career_id TEXT NOT NULL,
    world_revision INTEGER NOT NULL,
    source_kind TEXT NOT NULL,
    source_event_id TEXT NOT NULL,
    event_json TEXT NOT NULL,
    PRIMARY KEY (career_id, world_revision),
    UNIQUE (career_id, source_event_id)
  );`);
  const getHead = db.prepare(`SELECT world_revision,
    control_revision, control_json FROM world_control_heads
    WHERE career_id=?`);
  const getClub = db.prepare(`SELECT 1 FROM world_club_heads
    WHERE career_id=? AND club_id=?`);
  const getSeason = db.prepare(`SELECT revision FROM world_season_heads
    WHERE career_id=?`);
  const getClubRevisions = db.prepare(`SELECT revision
    FROM world_club_heads WHERE career_id=?`);
  const eventExtent = db.prepare(`SELECT COUNT(*) AS count,
    MIN(world_revision) AS first_revision,
    MAX(world_revision) AS last_revision
    FROM world_decision_revision_events WHERE career_id=?`);
  const row = (careerId: string): HeadRow | null =>
    (getHead.get(careerId) as HeadRow | undefined) ?? null;
  const parsedHead = (careerId: string,
    item: HeadRow): DurableWorldControlHead => {
    const control = createHumanControlState(
      JSON.parse(item.control_json));
    const events = eventExtent.get(careerId) as { count: number;
      first_revision: number | null; last_revision: number | null };
    if (!revision(item.world_revision)
      || control.revision !== item.control_revision
      || JSON.stringify(control) !== item.control_json
      || events.count !== item.world_revision
      || (item.world_revision > 0 && (events.first_revision !== 1
        || events.last_revision !== item.world_revision))) {
      throw new Error('corrupt durable world control head');
    }
    return Object.freeze({ careerId,
      worldRevision: item.world_revision, control });
  };
  const transaction = <T>(work: () => T): T => {
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = work();
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  };
  return Object.freeze({
    initialize(input: DurableWorldControlHead): void {
      if (!input || !id(input.careerId)
        || input.worldRevision !== 0) {
        throw new Error('invalid world control bootstrap');
      }
      const control = createHumanControlState(input.control);
      if (control.revision !== 0) {
        throw new Error('world control bootstrap requires revision zero');
      }
      const controlJson = JSON.stringify(control);
      transaction(() => {
        const seasons = getSeason.all(input.careerId) as
          { revision: number }[];
        const clubs = getClubRevisions.all(input.careerId) as
          { revision: number }[];
        const rosterTable = db.prepare(`SELECT 1 FROM sqlite_master
          WHERE type='table' AND name='world_roster_heads'`).get();
        const rosters = rosterTable
          ? db.prepare(`SELECT revision FROM world_roster_heads
            WHERE career_id=?`).all(input.careerId) as
              { revision: number }[]
          : [];
        if (seasons.length === 0 || clubs.length === 0
          || seasons.some((item) => item.revision !== 0)
          || clubs.some((item) => item.revision !== 0)
          || rosters.some((item) => item.revision !== 0)
          || (control.controlledClubId !== null
            && !getClub.get(input.careerId,
              control.controlledClubId))) {
          throw new Error('world control bootstrap source is absent');
        }
        const prior = row(input.careerId);
        if (prior) {
          if (prior.world_revision !== 0
            || prior.control_revision !== 0
            || prior.control_json !== controlJson) {
            throw new Error('world control head already initialized differently');
          }
          return;
        }
        db.prepare(`INSERT INTO world_control_heads
          (career_id, world_revision, control_revision, control_json)
          VALUES (?, 0, 0, ?)`).run(input.careerId, controlJson);
      });
    },
    readHead(careerId: string): DurableWorldControlHead | null {
      if (!id(careerId)) throw new Error('invalid careerId');
      const item = row(careerId);
      return item ? parsedHead(careerId, item) : null;
    },
    changeControl(input): DurableWorldControlHead {
      if (!input || !id(input.careerId)
        || !revision(input.expectedWorldRevision)) {
        throw new Error('invalid world control change');
      }
      return transaction(() => {
        const item = row(input.careerId);
        if (!item) throw new Error('world control head is absent');
        const current = parsedHead(input.careerId, item);
        if (current.worldRevision !== input.expectedWorldRevision) {
          throw new Error('stale durable world revision');
        }
        const changed = changeHumanControl(current.control,
          input.change);
        if (!changed.ok) {
          throw new Error(`${changed.reason.code}: control change`);
        }
        if (changed.events.length === 0) return current;
        if (current.worldRevision === Number.MAX_SAFE_INTEGER) {
          throw new Error('world revision overflow');
        }
        const nextRevision = current.worldRevision + 1;
        const updated = db.prepare(`UPDATE world_control_heads
          SET world_revision=?, control_revision=?, control_json=?
          WHERE career_id=? AND world_revision=?
            AND control_revision=? AND control_json=?`)
          .run(nextRevision, changed.state.revision,
            JSON.stringify(changed.state), input.careerId,
            current.worldRevision, current.control.revision,
            item.control_json);
        if (updated.changes !== 1) {
          throw new Error('stale durable world control head');
        }
        db.prepare(`INSERT INTO world_decision_revision_events
          (career_id, world_revision, source_kind,
            source_event_id, event_json)
          VALUES (?, ?, 'CONTROL_CHANGE', ?, ?)`)
          .run(input.careerId, nextRevision,
            `control:${input.careerId}:${changed.state.revision}`,
            JSON.stringify(changed.events[0]));
        return Object.freeze({ careerId: input.careerId,
          worldRevision: nextRevision, control: changed.state });
      });
    },
    close(): void { db.close(); },
  });
};
