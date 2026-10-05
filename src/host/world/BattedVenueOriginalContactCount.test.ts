import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { nativeThirdPitchContactFixture } from './BattedVenueOriginalCountFixtures.test-support';
import { battedVenueOriginalContactCount } from './BattedVenueLegalEvidenceFromSqlite';

let directory: string, x: ReturnType<typeof nativeThirdPitchContactFixture>;
beforeAll(() => {
  directory = mkdtempSync(join(tmpdir(), 'venue-original-count-'));
  x = nativeThirdPitchContactFixture(join(directory, 'world.sqlite'));
  console.info('VENUE_ORIGINAL_COUNT_DIAGNOSTIC ' + JSON.stringify({
    sourceId: x.third.source.sourceId, progressRevision: x.third.progressRevision,
    originalMatchCount: { balls: x.third.frame.match.balls, strikes: x.third.frame.match.strikes },
    firstStatus: x.first.result.pitch.resolution.timeline.status,
    secondStatus: x.second.result.pitch.resolution.timeline.status,
    beforeStatus: x.third.beforeTimeline.status, resultStatus: x.third.result.pitch.resolution.timeline.status,
    contactEvents: x.third.result.pitch.resolution.timeline.events.filter(event => event.kind === 'BatBallContact'),
    acceptedBatterAction: x.third.source.request.batter.action,
  }));
  expect(x.third.frame.match.strikes).toBe(0);
  expect(x.third.beforeTimeline.status).toEqual({ kind: 'active', count: { balls: 0, strikes: 2 } });
  expect(x.third.result.pitch.resolution.timeline.status).toMatchObject({ kind: 'batted_ball_pending', count: { balls: 0, strikes: 2 } });
}, 60_000);
afterAll(() => { x?.f.close(); if (directory) rmSync(directory, { recursive: true, force: true }); });

it('reads the actual third-pitch contact count instead of the stale frozen Match count', () => {
  const own = x.pitches.readAcceptedPitch(x.third.source.sourceId)!;
  const timeline = own.result.pitch.resolution.timeline;
  const contact = timeline.events.find(event => event.kind === 'BatBallContact');
  if (!contact || contact.kind !== 'BatBallContact') throw new Error('actual third-pitch contact is missing');
  expect(contact.payload.countBefore).toEqual({ balls: 0, strikes: 2 });
  expect(battedVenueOriginalContactCount(own)).toEqual({ version: 'batted_venue_original_count_v1',
    physicalPitchSourceId: own.source.sourceId, progressRevision: 3, contactTick: contact.tick,
    contactSequence: contact.sequence, count: { balls: 0, strikes: 2 },
    beforeTimelineHash: hash(own.beforeTimeline), resultTimelineHash: hash(timeline) });
});

it.each(['before_count', 'contact_count', 'result_count', 'not_batted'] as const)(
  'rejects inconsistent original count evidence %s', kind => {
    const original = x.third, resultTimeline = original.result.pitch.resolution.timeline;
    const wrongCount = { balls: 0, strikes: 1 };
    const changed = kind === 'before_count' ? { ...original,
      beforeTimeline: { ...original.beforeTimeline, status: { kind: 'active', count: wrongCount } } }
      : { ...original, result: { ...original.result, pitch: { ...original.result.pitch,
        resolution: { ...original.result.pitch.resolution, timeline: { ...resultTimeline,
          ...(kind === 'contact_count' ? { events: resultTimeline.events.map(event => event.kind !== 'BatBallContact' ? event
            : { ...event, payload: { ...event.payload, countBefore: wrongCount } }) }
            : { status: kind === 'not_batted' ? { kind: 'active', count: { balls: 0, strikes: 2 } }
              : { ...resultTimeline.status, count: wrongCount } }) } } } } };
    expect(() => battedVenueOriginalContactCount(changed as never)).toThrow();
  });
