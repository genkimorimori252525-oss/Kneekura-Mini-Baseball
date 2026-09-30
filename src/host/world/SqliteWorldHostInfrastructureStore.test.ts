import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import { applyClubCommand } from '../../core/world/club';
import { state, command } from '../../core/world/club/ClubFixtures.test-support';
import type { WorldHostVenueEvent } from '../../core/world/competition/CompetitionHostInfrastructure';
import { openSqliteNationCompetitionRegionStore } from './SqliteNationCompetitionRegionStore';
import { openSqliteWorldHostInfrastructureStore } from './SqliteWorldHostInfrastructureStore';

const { DatabaseSync }: typeof import('node:sqlite') = createRequire(import.meta.url)('node:sqlite');
const venue: WorldHostVenueEvent = { careerId: 'career-a', venueId: 'stadium-a', nationId: 'FR',
  cityId: 'city-origin', region: 'EUROPE', effectiveFromDay: 10, sourceEventId: 'venue-opened', sourceClubId: null,
  licensed: true, safe: true, metrics: { stadiumCapacity: 10000, stadiumQuality: 50,
    transportQuality: 50, accommodationCapacity: 10000, broadcastReadiness: 50, operationsQuality: 50 } };

it('replays accepted infrastructure at its cutoff, including source Club stadium changes', () => {
  const nations = openSqliteNationCompetitionRegionStore(':memory:');
  nations.record({ careerId: 'career-a', nationId: 'FR', region: 'EUROPE',
    effectiveFromDay: 0, sourceEventId: 'fr-region' });
  const checkpoint = state();
  const changed = applyClubCommand(checkpoint, { ...command([{ kind: 'REPLACE_STADIUM',
    stadium: { ...checkpoint.institutional.stadium, capacity: 12000, quality: 70 } }]), effectiveDay: 20 });
  if (!changed.ok) throw new Error('invalid test Club source');
  const differentProvenance = applyClubCommand(checkpoint, { ...changed.event.command,
    eventId: 'another-accepted-stadium-event', causeEventIds: ['another-accepted-cause'] });
  if (!differentProvenance.ok) throw new Error('invalid alternative test Club source');
  let alternateSource = false;
  const sources = { nations, clubs: { readClubHistory: () => ({ checkpoint,
    acceptedEvents: [alternateSource ? differentProvenance.event : changed.event] }) } };
  const path = `file:world-host-infra-${crypto.randomUUID()}?mode=memory&cache=shared`;
  let store = openSqliteWorldHostInfrastructureStore(path, sources);
  const db = new DatabaseSync(path);
  try {
    const accepted = { ...venue, sourceClubId: 'club-a' };
    expect(store.record(accepted)).toEqual(accepted);
    expect(store.record(accepted)).toEqual(accepted);
    expect(store.readVenues('career-a', 9)).toEqual([]);
    expect(store.readVenues('career-a', 15)[0].metrics.stadiumCapacity).toBe(10000);
    const later = store.readVenues('career-a', 20)[0];
    expect(later.metrics.stadiumCapacity).toBe(12000);
    expect(later.metrics.stadiumQuality).toBe(70);
    expect(later.acceptedClubSource?.revision).toBe(1);
    alternateSource = true;
    const alternate = store.readVenues('career-a', 20)[0];
    expect(alternate.metrics).toEqual(later.metrics);
    expect(alternate.acceptedClubSource).not.toEqual(later.acceptedClubSource);
    expect(store.readVenues('career-a', 15)[0].metrics.stadiumCapacity).toBe(10000);
    alternateSource = false;
    expect(() => store.record({ ...accepted, metrics: { ...accepted.metrics, stadiumCapacity: 1 } }))
      .toThrow('Club stadium');
    nations.record({ careerId: 'career-a', nationId: 'DE', region: 'EUROPE',
      effectiveFromDay: 0, sourceEventId: 'de-region' });
    expect(() => store.record({ ...venue, nationId: 'DE', venueId: 'second-venue',
      sourceEventId: 'wrong-city-nation' })).toThrow('city belongs to a different host nation');
    store.record({ ...accepted, effectiveFromDay: 30, sourceEventId: 'venue-unsafe', safe: false,
      metrics: { ...accepted.metrics, stadiumCapacity: 12000, stadiumQuality: 70 } });
    store.close();
    store = openSqliteWorldHostInfrastructureStore(path, sources);
    expect(store.readVenues('career-a', 15)[0].safe).toBe(true);
    expect(store.readVenues('career-a', 30)[0].safe).toBe(false);
    expect(() => store.record({ ...accepted, effectiveFromDay: 25, sourceEventId: 'backdated',
      metrics: { ...accepted.metrics, stadiumCapacity: 12000, stadiumQuality: 70 } }))
      .toThrow('backdated');
    db.prepare("UPDATE world_host_venue_events SET event_json='{}' WHERE source_event_id='venue-unsafe'").run();
    expect(store.readVenues('career-a', 15)[0].metrics.stadiumCapacity).toBe(10000);
    expect(() => store.readVenues('career-a', 30)).toThrow('corrupt');
  } finally { store.close(); db.close(); nations.close(); }
});
