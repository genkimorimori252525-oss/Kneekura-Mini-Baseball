import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { replayClubEvents } from '../../core/world/club/ClubEvents';
import { assertWorldHostVenueEvent, type WorldHostVenueEvent } from
  '../../core/world/competition/CompetitionHostInfrastructure';
import type { MatchdayClubHistory } from '../../core/world/club/OfficialMatchdayRevenue';
import type { SqliteNationCompetitionRegionStore } from './SqliteNationCompetitionRegionStore';

export type AcceptedHostVenue = WorldHostVenueEvent & Readonly<{
  acceptedClubSource?: Readonly<{ clubId: string; revision: number; effectiveDay: number;
    stadiumId: string; homeCityId: string; capacity: number; quality: number; sourceSnapshotId: string }>;
}>;
export type WorldHostInfrastructureSources = Readonly<{
  nations: Pick<SqliteNationCompetitionRegionStore, 'readRegion'>;
  clubs?: Readonly<{ readClubHistory(careerId: string, clubId: string): MatchdayClubHistory | null }>;
}>;
export type SqliteWorldHostInfrastructureStore = Readonly<{
  record(event: WorldHostVenueEvent): WorldHostVenueEvent;
  readVenues(careerId: string, beforeDay: number): readonly AcceptedHostVenue[];
  close(): void;
}>;
type Row = { revision: number; effective_day: number; source_event_id: string;
  event_json: string; chain_hash: string };
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0
  && value === value.trim();
const day = (value: unknown): value is number => typeof value === 'number'
  && Number.isSafeInteger(value) && value >= 0;
const canonicalJson = (value: unknown): string => JSON.stringify(cloneInert(value), (_key, item: unknown) =>
  item !== null && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
const digest = (prior: string, event: string): string =>
  createHash('sha256').update(JSON.stringify([prior, event])).digest('hex');
const freeze = <T>(value: T): T => {
  if (value !== null && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

/** City infrastructure is owned here; Club stadium metrics remain accepted Club projections. */
export const openSqliteWorldHostInfrastructureStore = (
  databasePath: string, sources: WorldHostInfrastructureSources,
): SqliteWorldHostInfrastructureStore => {
  if (!id(databasePath)) throw new Error('invalid World host infrastructure database path');
  const sqlite: typeof import('node:sqlite') = createRequire(import.meta.url)('node:sqlite');
  const db = new sqlite.DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_host_venue_events (
    career_id TEXT NOT NULL, venue_id TEXT NOT NULL, revision INTEGER NOT NULL,
    effective_day INTEGER NOT NULL, source_event_id TEXT NOT NULL,
    event_json TEXT NOT NULL, chain_hash TEXT NOT NULL,
    PRIMARY KEY (career_id, venue_id, revision), UNIQUE (career_id, source_event_id)
  );`);
  const rows = db.prepare(`SELECT revision, effective_day, source_event_id, event_json, chain_hash
    FROM world_host_venue_events WHERE career_id=? AND venue_id=? ORDER BY revision`);
  const eventById = db.prepare(`SELECT venue_id, event_json FROM world_host_venue_events
    WHERE career_id=? AND source_event_id=?`);
  const venues = db.prepare(`SELECT DISTINCT venue_id FROM world_host_venue_events
    WHERE career_id=? ORDER BY venue_id`);
  let closed = false;
  const assertScope = (careerId: string): void => {
    if (closed || !id(careerId)) throw new Error('invalid World host infrastructure Career scope');
  };
  const replay = (careerId: string, venueId: string, beforeDay = Number.MAX_SAFE_INTEGER):
    readonly WorldHostVenueEvent[] => {
    let hash = 'GENESIS';
    let prior: WorldHostVenueEvent | undefined;
    const accepted: WorldHostVenueEvent[] = [];
    for (const row of rows.all(careerId, venueId) as Row[]) {
      if (day(row.effective_day) && row.effective_day > beforeDay) break;
      try {
        const event = JSON.parse(row.event_json) as WorldHostVenueEvent;
        assertWorldHostVenueEvent(event);
        if (event.careerId !== careerId || event.venueId !== venueId
          || row.revision !== accepted.length + 1 || row.effective_day !== event.effectiveFromDay
          || row.source_event_id !== event.sourceEventId
          || (prior && (event.effectiveFromDay <= prior.effectiveFromDay
            || event.nationId !== prior.nationId || event.cityId !== prior.cityId))
          || sources.nations.readRegion(careerId, event.nationId, event.effectiveFromDay) !== event.region
          || canonicalJson(event) !== row.event_json || digest(hash, row.event_json) !== row.chain_hash) {
          throw new Error('World host venue history differs');
        }
        hash = row.chain_hash;
        prior = event;
        accepted.push(freeze(event));
      } catch (cause) { throw new Error(`corrupt World host infrastructure for ${venueId}`, { cause }); }
    }
    return Object.freeze(accepted);
  };
  const projectClub = (event: WorldHostVenueEvent, beforeDay: number):
    AcceptedHostVenue['acceptedClubSource'] | null => {
    if (event.sourceClubId === null) return null;
    const history = sources.clubs?.readClubHistory(event.careerId, event.sourceClubId);
    if (!history || history.checkpoint.careerId !== event.careerId
      || history.checkpoint.identity.clubId !== event.sourceClubId
      || history.checkpoint.effectiveDay > beforeDay || !Array.isArray(history.acceptedEvents)) {
      throw new Error('host venue lacks accepted Club stadium history');
    }
    const boundary = history.acceptedEvents.findIndex((entry) => entry.command.effectiveDay > beforeDay);
    const prefix = boundary === -1 ? history.acceptedEvents : history.acceptedEvents.slice(0, boundary);
    if (boundary !== -1 && history.acceptedEvents.slice(boundary).some((entry) =>
      entry.command.effectiveDay <= beforeDay)) throw new Error('host Club history is not chronological');
    const replayed = replayClubEvents(history.checkpoint, prefix);
    if (!replayed.ok) throw new Error('invalid accepted host Club stadium history');
    const club = replayed.value;
    const stadium = club.institutional.stadium;
    let sourceHash = digest('WORLD_HOST_CLUB_PREFIX', canonicalJson(history.checkpoint));
    for (const event of prefix) sourceHash = digest(sourceHash, canonicalJson(event));
    return Object.freeze({ clubId: event.sourceClubId, revision: club.revision, effectiveDay: club.effectiveDay,
      stadiumId: stadium.stadiumId, homeCityId: club.institutional.homeCityId,
      capacity: stadium.capacity, quality: stadium.quality, sourceSnapshotId: `club-host-prefix:${sourceHash}` });
  };
  return Object.freeze({
    record(rawEvent: WorldHostVenueEvent): WorldHostVenueEvent {
      const event = cloneInert(rawEvent);
      assertWorldHostVenueEvent(event);
      assertScope(event.careerId);
      if (sources.nations.readRegion(event.careerId, event.nationId, event.effectiveFromDay) !== event.region) {
        throw new Error('host venue requires accepted historical nation region');
      }
      const club = projectClub(event, event.effectiveFromDay);
      if (club && (club.stadiumId !== event.venueId || club.homeCityId !== event.cityId
        || club.capacity !== event.metrics.stadiumCapacity || club.quality !== event.metrics.stadiumQuality)) {
        throw new Error('host venue differs from accepted Club stadium');
      }
      const eventJson = canonicalJson(event);
      db.exec('BEGIN IMMEDIATE');
      try {
        const existing = eventById.get(event.careerId, event.sourceEventId) as
          { venue_id: string; event_json: string } | undefined;
        const accepted = replay(event.careerId, event.venueId);
        for (const { venue_id: venueId } of venues.all(event.careerId) as { venue_id: string }[]) {
          const other = replay(event.careerId, venueId).at(-1);
          if (other?.cityId === event.cityId && other.nationId !== event.nationId) {
            throw new Error('city belongs to a different host nation');
          }
        }
        if (existing) {
          if (existing.venue_id !== event.venueId || existing.event_json !== eventJson) {
            throw new Error('World host infrastructure event is already frozen differently');
          }
          const prior = accepted.find((entry) => entry.sourceEventId === event.sourceEventId);
          if (!prior) throw new Error('World host infrastructure event is absent from its history');
          db.exec('COMMIT');
          return prior;
        }
        const latest = accepted.at(-1);
        if (latest && event.effectiveFromDay <= latest.effectiveFromDay) {
          throw new Error('backdated World host infrastructure event');
        }
        if (latest && (event.nationId !== latest.nationId || event.cityId !== latest.cityId)) {
          throw new Error('World host venue location is immutable');
        }
        const latestRow = (rows.all(event.careerId, event.venueId) as Row[]).at(-1);
        db.prepare(`INSERT INTO world_host_venue_events
          (career_id, venue_id, revision, effective_day, source_event_id, event_json, chain_hash)
          VALUES (?, ?, ?, ?, ?, ?, ?)`).run(event.careerId, event.venueId, accepted.length + 1,
          event.effectiveFromDay, event.sourceEventId, eventJson, digest(latestRow?.chain_hash ?? 'GENESIS', eventJson));
        db.exec('COMMIT');
        return freeze(event);
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    readVenues(careerId: string, beforeDay: number): readonly AcceptedHostVenue[] {
      assertScope(careerId);
      if (!day(beforeDay)) throw new Error('invalid host infrastructure cutoff');
      const projected: AcceptedHostVenue[] = [];
      const cityNations = new Map<string, string>();
      for (const { venue_id: venueId } of venues.all(careerId) as { venue_id: string }[]) {
        const event = replay(careerId, venueId, beforeDay).at(-1);
        if (!event) continue;
        const cityNation = cityNations.get(event.cityId);
        if (cityNation && cityNation !== event.nationId) throw new Error('corrupt World host city location');
        cityNations.set(event.cityId, event.nationId);
        const club = projectClub(event, beforeDay);
        // A Club moving or replacing its stadium does not keep owning the old hosting venue.
        if (club && (club.stadiumId !== event.venueId || club.homeCityId !== event.cityId)) continue;
        const region = sources.nations.readRegion(careerId, event.nationId, beforeDay);
        if (!region) throw new Error('host venue lacks accepted cutoff nation region');
        projected.push(freeze({ ...event, region, metrics: { ...event.metrics,
          ...(club ? { stadiumCapacity: club.capacity, stadiumQuality: club.quality } : {}) },
        ...(club ? { acceptedClubSource: club } : {}) }));
      }
      return Object.freeze(projected);
    },
    close(): void { if (!closed) db.close(); closed = true; },
  });
};
