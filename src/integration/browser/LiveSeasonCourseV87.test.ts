import { expect, it } from 'vitest';
import { createNeutralBatterCourseProfileV87, getRepresentativeCourseIdV87 } from './BatterCourseProfileV87';
import { createLiveGameStatisticsV79, summarizeLiveIssuedPitchV79 } from './LiveCourseScoringV79';
import { LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1 } from './LiveBaseballMatchV1';
import { scoringPitchV79, scoringPlayersV79 } from './LiveCourseScoringV79.test-support';
import { createLiveSeasonStoreV79, reduceLiveSeasonStoreV79, validateLiveSeasonStoreV79 } from './LiveSeasonV79';
import { deriveLiveCourseProfileV87, getLiveSeasonReportV87 } from './LiveSeasonCourseV87';

const create = () => reduceLiveSeasonStoreV79({ store: createLiveSeasonStoreV79(), command: { kind: 'create', seasonId: 's', name: 'S' } });
const game = (gameId: string, x: number | null, y: number, classification = 'home_run', estimated = false) => {
  const r = summarizeLiveIssuedPitchV79(scoringPitchV79(classification));
  const course = x === null ? { position: null, planeZ: .15 as const, provenance: 'missing_source' as const, sourceOriginTick: null, crossingElapsedSeconds: null }
    : { ...r.course, position: { x, y }, provenance: estimated ? 'source_estimated_after_front_contact' as const : 'source_plate_crossing' as const };
  return createLiveGameStatisticsV79({ gameId, seed: 1, players: scoringPlayersV79, records: [{ ...r, course }], finished: true });
};
it('reads V79 stores without rewriting them and aggregates actual positions including old off-grid coordinates', () => {
  let store = create();
  for (const g of [game('left', -4, 2), game('right', 4, 2, 'strikeout'), game('missing', null, 0), game('pending', -4, 2, 'live_ball'), game('estimate', -4, 2, 'home_run', true)])
    store = reduceLiveSeasonStoreV79({ store, command: { kind: 'record_game', seasonId: 's', game: g } });
  const before = JSON.stringify(store), report = getLiveSeasonReportV87({ store, seasonId: 's', playerId: 'b' });
  expect(report.regions).toHaveLength(13); expect(report.inside).toHaveLength(9); expect(report.outside).toHaveLength(4);
  expect(report.outside[0]).toMatchObject({ publicZoneId: 11, ab: 2, h: 2, pending: 1, average: null, knownAverage: 1, complete: false });
  expect(report.outside[1]).toMatchObject({ publicZoneId: 12, ab: 1, h: 0, average: 0, color: 'blue' });
  expect(report.missing).toMatchObject({ ab: 1, h: 1 });
  expect(report.provenance).toMatchObject({ source_plate_crossing: 3, source_estimated_after_front_contact: 1, missing_source: 1 });
  expect(report.totals).toMatchObject({ ab: 4, h: 3, pending: 1, average: null });
  expect(JSON.stringify(store)).toBe(before); expect(validateLiveSeasonStoreV79(JSON.parse(before))).toEqual(store);
});
it('keeps empty averages unknown and preserves pending and missing data outside learning', () => {
  let store = create();
  expect(getLiveSeasonReportV87({ store, seasonId: 's', playerId: 'b' }).regions.every(r => r.average === null && r.color === 'gray')).toBe(true);
  for (const g of [game('pending', 0, .8, 'live_ball'), game('missing', null, 0)])
    store = reduceLiveSeasonStoreV79({ store, command: { kind: 'record_game', seasonId: 's', game: g } });
  expect(deriveLiveCourseProfileV87({ store, seasonId: 's', playerId: 'b' })).toEqual(createNeutralBatterCourseProfileV87());
});
it('separates practice/current-season response, closed-season learning and author data', () => {
  const profile = { ...createNeutralBatterCourseProfileV87(), referenceAverages: Array(13).fill(.33) }, before = JSON.stringify(profile);
  let store = create();
  const practiced = reduceLiveSeasonStoreV79({ store, command: { kind: 'practice', practiceId: 'p', seasonId: 's', playerId: 'b', courseId: getRepresentativeCourseIdV87(11), attempts: 100, quality: 1 } });
  const active = deriveLiveCourseProfileV87({ store: practiced, seasonId: 's', playerId: 'b', profile });
  expect(active.referenceAverages[9]).toBeCloseTo(.34, 12); expect(active.referenceAverages.filter((v, i) => v !== profile.referenceAverages[i])).toHaveLength(1);
  const practiceClosed = reduceLiveSeasonStoreV79({ store: practiced, command: { kind: 'close', seasonId: 's' } });
  const practiceNext = reduceLiveSeasonStoreV79({ store: practiceClosed, command: { kind: 'create', seasonId: 'next', name: 'Next' } });
  expect(deriveLiveCourseProfileV87({ store: practiceNext, seasonId: 'next', playerId: 'b', profile })).toEqual(profile);
  for (let i = 0; i < 10; i++) store = reduceLiveSeasonStoreV79({ store, command: { kind: 'record_game', seasonId: 's', game: game('g' + i, -4, 2) } });
  expect(deriveLiveCourseProfileV87({ store, seasonId: 's', playerId: 'b', profile }).referenceAverages[9]).toBeGreaterThan(.33);
  const closed = reduceLiveSeasonStoreV79({ store, command: { kind: 'close', seasonId: 's' } });
  const next = reduceLiveSeasonStoreV79({ store: closed, command: { kind: 'create', seasonId: 'next', name: 'Next' } });
  const learned = deriveLiveCourseProfileV87({ store: next, seasonId: 'next', playerId: 'b', profile });
  expect(learned.referenceAverages[9]).toBeGreaterThan(.33); expect(learned.referenceAverages[9] - .33).toBeLessThan(.005);
  expect(JSON.stringify(profile)).toBe(before); expect(JSON.stringify(closed.seasons[0].games)).toBe(JSON.stringify(store.seasons[0].games));
});
it('retains the V87 author snapshot alongside the compatible V79 baseline and rejects forged profiles', () => {
  const profile = createNeutralBatterCourseProfileV87(), g = game('g', 0, .8);
  const players = scoringPlayersV79.map(p => p.playerId === 'b' ? { ...p, physical: { ...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, batterCourseProfileV87: profile } } : p);
  const saved = createLiveGameStatisticsV79({ ...g, players });
  expect(saved.players[0].courseProfileV87).toEqual(profile); expect(saved.players[0].courseProfile?.referenceAverages).toHaveLength(63);
  const store = reduceLiveSeasonStoreV79({ store: create(), command: { kind: 'record_game', seasonId: 's', game: saved } });
  expect(validateLiveSeasonStoreV79(JSON.parse(JSON.stringify(store)))).toEqual(store);
  expect(() => validateLiveSeasonStoreV79({ ...store, seasons: [{ ...store.seasons[0], games: [{ ...saved, players: [{ ...saved.players[0], courseProfileV87: { ...profile, referenceAverages: [] } }, saved.players[1]] }] }] })).toThrow();
});
it('uses H/AB rather than mean averages, keeps walks unknown, and bounds adaptation at large sample sizes', () => {
  let store = create();
  store = reduceLiveSeasonStoreV79({ store, command: { kind: 'record_game', seasonId: 's', game: game('walk', 4, 2, 'walk') } });
  expect(getLiveSeasonReportV87({ store, seasonId: 's', playerId: 'b' }).outside[1]).toMatchObject({ ab: 0, h: 0, average: null, plateAppearances: 1 });
  for (let i = 0; i < 100; i++) store = reduceLiveSeasonStoreV79({ store, command: { kind: 'record_game', seasonId: 's', game: game('g' + i, -4, 2, i < 20 ? 'home_run' : 'strikeout') } });
  expect(getLiveSeasonReportV87({ store, seasonId: 's', playerId: 'b' }).outside[0]).toMatchObject({ ab: 100, h: 20, average: .2, color: 'blue' });
  const profile = { ...createNeutralBatterCourseProfileV87(), referenceAverages: Array(13).fill(.99) };
  const effective = deriveLiveCourseProfileV87({ store, seasonId: 's', playerId: 'b', profile });
  expect(effective.referenceAverages[9]).toBeCloseTo(.95, 12);
  expect(effective.referenceAverages.every(v => v >= 0 && v <= 1)).toBe(true);
  const closed = reduceLiveSeasonStoreV79({ store, command: { kind: 'close', seasonId: 's' } });
  const next = reduceLiveSeasonStoreV79({ store: closed, command: { kind: 'create', seasonId: 'next', name: 'Next' } });
  const learned = deriveLiveCourseProfileV87({ store: next, seasonId: 'next', playerId: 'b', profile });
  expect(Math.abs(learned.referenceAverages[9] - profile.referenceAverages[9])).toBeLessThanOrEqual(.005);
  expect(getLiveSeasonReportV87({ store: next, seasonId: 'next', playerId: 'b' }).totals.ab).toBe(0);
});
