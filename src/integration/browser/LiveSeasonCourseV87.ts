import { classifyPublicCourseV87, createNeutralBatterCourseProfileV87, projectBatterCourseProfileV79ToV87,
  PUBLIC_COURSE_IDS_V87, publicCourseIndexForInternalIdV87, validateBatterCourseProfileV87,
  type BatterCourseProfileV87, type PublicCourseIdV87 } from './BatterCourseProfileV87';
import { LIVE_COURSE_LEARNING_POLICY_V79, validateLiveSeasonStoreV79, type LiveCourseTallyV79, type LiveSeasonStoreV79, type LiveSeasonV79 } from './LiveSeasonV79';
import type { LivePitchSummaryV79 } from './LiveCourseScoringV79';

export type LiveCourseRegionTallyV87 = LiveCourseTallyV79 & Readonly<{ publicZoneId: PublicCourseIdV87 }>;
const fail = (message: string): never => { throw Error('live season course v87: ' + message); };
const cap = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value));
const boundedAverage = (value: number) => Math.max(0, Math.min(1, value));
const sum = (a: number, b: number) => { const n = a + b; if (!Number.isSafeInteger(n)) fail('count overflow'); return n; };
const empty = () => ({ ab: 0, h: 0, hr: 0, pending: 0, plateAppearances: 0 });
function finish(tally: ReturnType<typeof empty>): LiveCourseTallyV79 {
  const knownAverage = tally.ab ? tally.h / tally.ab : null, average = tally.pending ? null : knownAverage;
  return { ...tally, average, knownAverage, color: average === null ? 'gray' : average >= .3 ? 'red' : average <= .2 ? 'blue' : 'gray', complete: tally.pending === 0 };
}
function selected(store: LiveSeasonStoreV79, seasonId: string, playerId: string) {
  const index = store.seasons.findIndex(season => season.seasonId === seasonId);
  if (index < 0 || typeof playerId !== 'string' || !playerId || playerId !== playerId.trim() || playerId.length > 160) fail('season/player required');
  return { season: store.seasons[index], index };
}
function positionRegion(record: LivePitchSummaryV79): number | null {
  if (record.course.position === null) return null;
  if (record.course.zone === undefined) return fail('validated course zone required');
  return classifyPublicCourseV87({ position: record.course.position, zone: record.course.zone }).courseIndex;
}

/** Reprojects validated historical positions without modifying the V79 store.
 * Estimated plane crossings remain explicitly labelled and missing positions are never assigned. */
export function getLiveSeasonReportV87(input: Readonly<{ store: LiveSeasonStoreV79; seasonId: string; playerId: string }>) {
  const store = validateLiveSeasonStoreV79(input.store), { season } = selected(store, input.seasonId, input.playerId),
    regions = Array.from({ length: 13 }, empty), missing = empty(), totals = empty(),
    provenance = { source_plate_crossing: 0, source_estimated_after_front_contact: 0, missing_source: 0 },
    counts = [0, 0, 0, 0, 0], homeRuns = [0, 0, 0, 0, 0];
  let fouls = 0, legacyOffGridPlateAppearances = 0;
  const add = (tally: ReturnType<typeof empty>, record: LivePitchSummaryV79) => {
    tally.plateAppearances = sum(tally.plateAppearances, 1);
    if (record.scoring.status !== 'confirmed') { tally.pending = sum(tally.pending, 1); return; }
    tally.ab = sum(tally.ab, record.scoring.ab!); tally.h = sum(tally.h, record.scoring.h!); tally.hr = sum(tally.hr, record.scoring.hr!);
  };
  for (const game of season.games) for (const record of game.records) if (record.batterPlayerId === input.playerId) {
    if (record.spray.foul) fouls = sum(fouls, 1);
    else if (record.spray.directionIndex !== null) {
      const i = record.spray.directionIndex; counts[i] = sum(counts[i], 1);
      if (record.spray.homeRun) homeRuns[i] = sum(homeRuns[i], 1);
    }
    if (!record.ended) continue;
    add(totals, record); provenance[record.course.provenance] = sum(provenance[record.course.provenance], 1);
    const region = positionRegion(record);
    if (region === null) add(missing, record); else {
      add(regions[region], record);
      if (record.course.courseId === null) legacyOffGridPlateAppearances = sum(legacyOffGridPlateAppearances, 1);
    }
  }
  const completed = regions.map((tally, i): LiveCourseRegionTallyV87 => ({ ...finish(tally), publicZoneId: PUBLIC_COURSE_IDS_V87[i] })), total = counts.reduce(sum, 0);
  return { version: 'live_season_report_v87' as const, seasonId: season.seasonId, playerId: input.playerId, status: season.status,
    regions: completed, inside: completed.slice(0, 9), outside: completed.slice(9), missing: finish(missing), totals: finish(totals),
    provenance, legacyOffGridPlateAppearances,
    spray: { counts, ratios: counts.map(n => total ? n / total : null), homeRuns, total, fouls },
    policyVersion: store.policyVersion, nativeAdmission: false as const };
}

function countsFor(season: LiveSeasonV79, playerId: string) {
  const counts = Array.from({ length: 13 }, () => ({ ab: 0, h: 0 }));
  for (const game of season.games) for (const record of game.records) {
    if (record.batterPlayerId !== playerId || !record.ended || record.scoring.status !== 'confirmed') continue;
    const index = positionRegion(record); if (index === null) continue;
    counts[index].ab = sum(counts[index].ab, record.scoring.ab!); counts[index].h = sum(counts[index].h, record.scoring.h!);
  }
  return counts;
}
function authoredIn(season: LiveSeasonV79, playerId: string): BatterCourseProfileV87 {
  const player = season.games.find(game => game.players.some(player => player.playerId === playerId))?.players.find(player => player.playerId === playerId);
  return player?.courseProfileV87 ? validateBatterCourseProfileV87(player.courseProfileV87)
    : player?.courseProfile ? projectBatterCourseProfileV79ToV87(player.courseProfile) : createNeutralBatterCourseProfileV87();
}

/** V87 view of the existing evidence-backed local learning policy.
 * Current games/practice affect this season; only closed-season confirmed H/AB
 * contribute to long-term response. This does not roll hits or rewrite authored data. */
export function deriveLiveCourseProfileV87(input: Readonly<{ store: LiveSeasonStoreV79; seasonId: string; playerId: string; profile?: BatterCourseProfileV87 }>): BatterCourseProfileV87 {
  const store = validateLiveSeasonStoreV79(input.store), { season, index } = selected(store, input.seasonId, input.playerId),
    baseline = input.profile === undefined ? createNeutralBatterCourseProfileV87() : validateBatterCourseProfileV87(input.profile),
    p = LIVE_COURSE_LEARNING_POLICY_V79, longTerm = Array(13).fill(0);
  // Recompute a separate 13-region view from unchanged historical records.
  // The persisted 63-cell evidence and its validator remain backward compatible.
  for (let s = 0; s < index; s++) if (store.seasons[s].status === 'closed') {
    const previous = store.seasons[s], counts = countsFor(previous, input.playerId), authored = authoredIn(previous, input.playerId);
    for (let i = 0; i < 13; i++) if (counts[i].ab > 0) {
      const { ab, h } = counts[i], reference = boundedAverage(authored.referenceAverages[i] + longTerm[i]),
        evaluated = (h + p.longTermPriorK * reference) / (ab + p.longTermPriorK), eta = p.longTermRate * ab / (ab + p.longTermPriorK);
      longTerm[i] += cap(eta * (evaluated - reference), p.longTermSeasonLimit);
    }
  }
  const counts = countsFor(season, input.playerId), attempts = Array(13).fill(0), weightedQuality = Array(13).fill(0);
  for (const practice of season.practices) if (practice.playerId === input.playerId) {
    const i = publicCourseIndexForInternalIdV87(practice.courseId);
    attempts[i] = sum(attempts[i], practice.attempts); weightedQuality[i] += (2 * practice.quality - 1) * practice.attempts;
    if (!Number.isFinite(weightedQuality[i])) fail('practice accumulation overflow');
  }
  const referenceAverages = baseline.referenceAverages.map((authored, i) => {
    const reference = boundedAverage(authored + longTerm[i]), { ab, h } = counts[i], evaluated = (h + p.seasonPriorK * reference) / (ab + p.seasonPriorK),
      gameDelta = ab ? cap(p.seasonStrength * (evaluated - reference), p.seasonGameLimit) : 0,
      practiceDelta = cap(p.practiceStrength * weightedQuality[i] / (attempts[i] + p.practicePriorAttempts), p.practiceLimit);
    return boundedAverage(reference + cap(gameDelta + practiceDelta, p.combinedSeasonLimit));
  });
  return validateBatterCourseProfileV87({ ...baseline, referenceAverages });
}
