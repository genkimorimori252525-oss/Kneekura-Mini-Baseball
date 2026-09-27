/** Retrospective Career descriptor only. No Match ability or Manager action is derived here. */
export type StarRank = 'NONE' | 'STAR' | 'SUPERSTAR';
export type ScoredStarEvidence = Readonly<{
  value: number;
  sourceIds: readonly string[];
}>;
export type StarSeasonEvidence = Readonly<{
  seasonId: string;
  atDay: number;
  evidencePolicyVersion: string;
  prominence: ScoredStarEvidence;
  roleCentrality: ScoredStarEvidence;
  opponentAttention: ScoredStarEvidence;
  leagueAwareness: ScoredStarEvidence;
  crossAudienceRecognition: ScoredStarEvidence;
  historicalDominance: ScoredStarEvidence;
  iconicSalience: ScoredStarEvidence;
}>;
export type HighStageEventEvidence = Readonly<{
  eventId: string;
  atDay: number;
  seasonId: string;
  resultSourceId: string;
  successful: boolean;
}>;
/** Calibration is supplied and version pinned by the Career owner. No world quota is applied. */
export type StarStatusPolicy = Readonly<{
  policyId: string;
  version: string;
  effectiveDay: number;
  currentWindowDays: number;
  maxCurrentEvidenceAgeDays: number;
  minimumStarSeasons: number;
  minimumStarSpanDays: number;
  minimumProminence: number;
  minimumRoleCentrality: number;
  minimumOpponentAttention: number;
  minimumLeagueAwareness: number;
  minimumSuperstarSeasons: number;
  minimumSuperstarSpanDays: number;
  minimumEliteProminence: number;
  minimumCrossAudienceRecognition: number;
  minimumHistoricalDominance: number;
  minimumIconicSalience: number;
  minimumHighStageSuccesses: number;
  minimumHighStageSpanDays: number;
}>;
export type StarStatusInput = Readonly<{
  careerId: string;
  playerId: string;
  asOfDay: number;
  policy: StarStatusPolicy;
  seasons: readonly StarSeasonEvidence[];
  highStageEvents: readonly HighStageEventEvidence[];
}>;
export type StarStatusProjection = Readonly<{
  boundary: 'CAREER_STAR_STATUS_PROJECTION_ONLY';
  careerId: string;
  playerId: string;
  asOfDay: number;
  current: StarRank;
  legacy: StarRank;
  provenance: Readonly<{
    policy: Readonly<{ policyId: string; version: string }>;
    evaluatedSeasonIds: readonly string[];
    seasonEvidencePolicies: readonly Readonly<{ seasonId: string; version: string }>[];
    evidenceSourceIds: readonly string[];
    currentSeasonIds: readonly string[];
    highStageEventIds: readonly string[];
    exceptionalBasis: readonly ('HISTORICAL_DOMINANCE' | 'ICONIC_SALIENCE')[];
    legacyAsOfDay: number | null;
    legacySeasonIds: readonly string[];
  }>;
}>;

const metricNames = ['prominence', 'roleCentrality', 'opponentAttention',
  'leagueAwareness', 'crossAudienceRecognition', 'historicalDominance',
  'iconicSalience'] as const;
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value === value.trim();
const day = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const unit = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
const positiveUnit = (value: unknown): value is number =>
  unit(value) && value > 0;
const positive = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) > 0;
const unique = (values: readonly string[]): boolean =>
  values.length === new Set(values).size;

function validate(input: StarStatusInput): void {
  if (!id(input?.careerId) || !id(input.playerId) || !day(input.asOfDay)
    || !input.policy || !Array.isArray(input.seasons)
    || !Array.isArray(input.highStageEvents)) {
    throw new Error('invalid star status input');
  }
  const p = input.policy;
  if (!id(p.policyId) || !id(p.version) || !day(p.effectiveDay)
    || p.effectiveDay > input.asOfDay
    || !positive(p.currentWindowDays) || !positive(p.maxCurrentEvidenceAgeDays)
    || !positive(p.minimumStarSeasons) || p.minimumStarSeasons < 2
    || !positive(p.minimumStarSpanDays)
    || !positive(p.minimumSuperstarSeasons) || p.minimumSuperstarSeasons < 2
    || !positive(p.minimumSuperstarSpanDays)
    || !positive(p.minimumHighStageSuccesses)
    || p.minimumHighStageSuccesses < 2
    || !positive(p.minimumHighStageSpanDays)
    || !['minimumProminence', 'minimumRoleCentrality',
      'minimumOpponentAttention', 'minimumLeagueAwareness',
      'minimumEliteProminence', 'minimumCrossAudienceRecognition',
      'minimumHistoricalDominance', 'minimumIconicSalience']
      .every(name => positiveUnit(p[name as keyof StarStatusPolicy]))) {
    throw new Error('invalid star status policy');
  }
  if (!unique(input.seasons.map(s => s?.seasonId))
    || input.seasons.some(s => !id(s?.seasonId) || !day(s.atDay)
      || s.atDay > input.asOfDay || !id(s.evidencePolicyVersion)
      || metricNames.some(name => {
        const metric = s[name];
        return !metric || !unit(metric.value)
          || !Array.isArray(metric.sourceIds) || metric.sourceIds.length === 0
          || !unique(metric.sourceIds)
          || metric.sourceIds.some((source: string) => !id(source));
      }))) {
    throw new Error('invalid star season evidence');
  }
  const seasonDays = new Map(input.seasons.map(s => [s.seasonId, s.atDay]));
  if (!unique(input.highStageEvents.map(e => e?.eventId))
    || input.highStageEvents.some(e => !id(e?.eventId)
      || !id(e.resultSourceId) || !day(e.atDay)
      || e.atDay > input.asOfDay || !seasonDays.has(e.seasonId)
      || e.atDay < seasonDays.get(e.seasonId)!
      || typeof e.successful !== 'boolean')) {
    throw new Error('invalid high-stage evidence');
  }
}

type Assessment = Readonly<{
  rank: StarRank;
  seasons: readonly StarSeasonEvidence[];
  highStageEvents: readonly HighStageEventEvidence[];
  exceptionalBasis: readonly ('HISTORICAL_DOMINANCE' | 'ICONIC_SALIENCE')[];
}>;

function assess(input: StarStatusInput, atDay: number): Assessment {
  const p = input.policy;
  const inWindow = input.seasons.filter(s => s.atDay <= atDay
    && atDay - s.atDay <= p.currentWindowDays)
    .sort((a, b) => a.atDay - b.atDay || a.seasonId.localeCompare(b.seasonId));
  const latest = inWindow[inWindow.length - 1];
  const star = (s: StarSeasonEvidence): boolean =>
    s.prominence.value >= p.minimumProminence
    && s.roleCentrality.value >= p.minimumRoleCentrality
    && s.opponentAttention.value >= p.minimumOpponentAttention
    && s.leagueAwareness.value >= p.minimumLeagueAwareness;
  const qualified = inWindow.filter(star);
  const sustained = (seasons: readonly StarSeasonEvidence[], count: number,
    span: number): boolean => seasons.length >= count
    && seasons[seasons.length - 1]!.atDay - seasons[0]!.atDay >= span;
  const empty = { rank: 'NONE' as StarRank, seasons: [],
    highStageEvents: [], exceptionalBasis: [] };
  if (!latest || atDay - latest.atDay > p.maxCurrentEvidenceAgeDays
    || !star(latest) || !sustained(qualified, p.minimumStarSeasons,
      p.minimumStarSpanDays)) return empty;
  const starAssessment: Assessment = { rank: 'STAR', seasons: qualified,
    highStageEvents: [], exceptionalBasis: [] };
  const elite = qualified.filter(s => s.prominence.value >= p.minimumEliteProminence
    && s.crossAudienceRecognition.value >= p.minimumCrossAudienceRecognition);
  if (!elite.includes(latest)
    || !sustained(elite, p.minimumSuperstarSeasons,
      p.minimumSuperstarSpanDays)) return starAssessment;
  const eliteIds = new Set(elite.map(s => s.seasonId));
  const successes = input.highStageEvents.filter(e => e.successful
    && e.atDay <= atDay && atDay - e.atDay <= p.currentWindowDays
    && eliteIds.has(e.seasonId))
    .sort((a, b) => a.atDay - b.atDay || a.eventId.localeCompare(b.eventId));
  if (successes.length < p.minimumHighStageSuccesses
    || successes[successes.length - 1]!.atDay - successes[0]!.atDay
      < p.minimumHighStageSpanDays) return starAssessment;
  const basis: ('HISTORICAL_DOMINANCE' | 'ICONIC_SALIENCE')[] = [];
  if (elite.filter(s => s.historicalDominance.value
    >= p.minimumHistoricalDominance).length >= p.minimumSuperstarSeasons)
    basis.push('HISTORICAL_DOMINANCE');
  if (elite.filter(s => s.iconicSalience.value
    >= p.minimumIconicSalience).length >= p.minimumSuperstarSeasons)
    basis.push('ICONIC_SALIENCE');
  if (!basis.length) return starAssessment;
  return { rank: 'SUPERSTAR', seasons: elite,
    highStageEvents: successes, exceptionalBasis: basis };
}

/** Reprojects current and historical peak from certified Career evidence. */
export function projectStarStatus(input: StarStatusInput): StarStatusProjection {
  validate(input);
  const current = assess(input, input.asOfDay);
  let legacy = current;
  let legacyAsOfDay: number | null = current.rank === 'NONE' ? null : input.asOfDay;
  const rank = (value: StarRank): number =>
    value === 'SUPERSTAR' ? 2 : value === 'STAR' ? 1 : 0;
  const cutoffs = [...new Set([...input.seasons.map(s => s.atDay),
    ...input.highStageEvents.map(e => e.atDay)])].sort((a, b) => a - b);
  for (const cutoff of cutoffs) {
    const candidate = assess(input, cutoff);
    if (rank(candidate.rank) > rank(legacy.rank)) {
      legacy = candidate;
      legacyAsOfDay = cutoff;
    }
  }
  const sourceIds = new Set<string>();
  for (const season of input.seasons) {
    for (const name of metricNames) {
      for (const sourceId of season[name].sourceIds) sourceIds.add(sourceId);
    }
  }
  for (const event of input.highStageEvents) sourceIds.add(event.resultSourceId);
  return {
    boundary: 'CAREER_STAR_STATUS_PROJECTION_ONLY',
    careerId: input.careerId, playerId: input.playerId, asOfDay: input.asOfDay,
    current: current.rank, legacy: legacy.rank,
    provenance: {
      policy: { policyId: input.policy.policyId, version: input.policy.version },
      evaluatedSeasonIds: [...input.seasons.map(s => s.seasonId)].sort(),
      seasonEvidencePolicies: input.seasons.map(s => ({
        seasonId: s.seasonId, version: s.evidencePolicyVersion,
      })).sort((a, b) => a.seasonId.localeCompare(b.seasonId)),
      evidenceSourceIds: [...sourceIds].sort(),
      currentSeasonIds: current.seasons.map(s => s.seasonId),
      highStageEventIds: current.highStageEvents.map(e => e.eventId),
      exceptionalBasis: current.exceptionalBasis,
      legacyAsOfDay,
      legacySeasonIds: legacy.seasons.map(s => s.seasonId),
    },
  };
}
