import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { drawCompetitionGroups, requireRegisteredDrawPolicy, type CompetitionDraw,
  type CompetitionDrawPolicy, type CompetitionDrawPolicyRegistry } from '../../core/world/competition/CompetitionDraw';
import type { WbcQualifierEligibility } from '../../core/world/competition/WbcGlobalQualifierSelection';
import type { WorldNationalRankingHistory } from '../../core/world/competition/WorldNationalRankingHistory';
import type { NationalCompetitionSelection, SqliteNationalCompetitionSelectionStore } from './SqliteNationalCompetitionSelectionStore';
import type { SqliteNationalRosterEligibilityStore } from './SqliteNationalRosterEligibilityStore';
import type { DurableRegionalNationalRanking, SqliteRegionalNationalRankingSnapshotStore } from './SqliteRegionalNationalRankingSnapshotStore';
import type { SqliteNationCompetitionRegionStore } from './SqliteNationCompetitionRegionStore';
import { selectRegionalNationalHosts } from '../../core/world/competition/RegionalNationalHosting';
import type { DurableRegionalNationalHostCandidates, SqliteRegionalNationalHostCandidateStore } from './SqliteRegionalNationalHostCandidateStore';
import { createCompetitionSourceReader, withCompetitionSourceReadScope, withCompetitionSourceReadPhase } from './CompetitionSourceReadScope';

export type RegionalNationalDrawPolicy = CompetitionDrawPolicy & Readonly<{ rematchLookbackDays: number;
  hostPot1CandidateRule?: 'RANKING_ONLY' | 'QUALIFIED_HOSTS_FIRST' }>;
export type RegionalNationalDrawRequest = Readonly<{
  careerId: string; editionId: string; eligibilitySnapshotId: string; drawSeed: string;
  policy: RegionalNationalDrawPolicy; registry: CompetitionDrawPolicyRegistry;
}>;
export type DurableRegionalNationalDraw = Readonly<{
  drawSnapshotId: string; draw: CompetitionDraw; policy: RegionalNationalDrawPolicy;
  source: Readonly<{ selection: NationalCompetitionSelection; eligibility: WbcQualifierEligibility;
    ranking: DurableRegionalNationalRanking; rematchHistory: WorldNationalRankingHistory;
    hosts?: DurableRegionalNationalHostCandidates;
    participantRegions: readonly Readonly<{ nationId: string; region: string }>[] }>;
}>;
export type SqliteRegionalNationalDrawStore = Readonly<{
  initialize(request: RegionalNationalDrawRequest): DurableRegionalNationalDraw;
  readDraw(careerId: string, editionId: string): DurableRegionalNationalDraw | null;
  close(): void;
}>;

type Row = { request_json: string; draw_json: string };
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value === value.trim();
const day = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const json = (value: unknown): string => JSON.stringify(cloneInert(value), (_key, item: unknown) =>
  item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
const freeze = <T>(value: T): T => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};

/** Draws the accepted roster-capable cohort; larger pools require a separate approved qualifier. */
export const openSqliteRegionalNationalDrawStore = (databasePath: string, sources: Readonly<{
  selections: Pick<SqliteNationalCompetitionSelectionStore, 'readSelection'>;
  eligibility: Pick<SqliteNationalRosterEligibilityStore, 'readEligibilityForEdition'>;
  rankings: Pick<SqliteRegionalNationalRankingSnapshotStore, 'readSnapshot'>;
  nations: Pick<SqliteNationCompetitionRegionStore, 'readRegion'>;
  hosts?: Pick<SqliteRegionalNationalHostCandidateStore, 'readCandidates'>;
}>): SqliteRegionalNationalDrawStore => {
  if (!id(databasePath)) throw new Error('invalid regional national draw database path');
  const readSelection = createCompetitionSourceReader(sources.selections.readSelection, sources.selections);
  const readEligibility = createCompetitionSourceReader(sources.eligibility.readEligibilityForEdition, sources.eligibility);
  const readRanking = createCompetitionSourceReader(sources.rankings.readSnapshot, sources.rankings);
  const readRegion = createCompetitionSourceReader(sources.nations.readRegion, sources.nations);
  const readHosts = sources.hosts ? createCompetitionSourceReader(sources.hosts.readCandidates, sources.hosts) : undefined;
  const { DatabaseSync }: typeof import('node:sqlite') = createRequire(import.meta.url)('node:sqlite');
  const db = new DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_regional_national_draws (
    career_id TEXT NOT NULL, edition_id TEXT NOT NULL, request_json TEXT NOT NULL, draw_json TEXT NOT NULL,
    PRIMARY KEY(career_id, edition_id)
  ); CREATE TABLE IF NOT EXISTS world_regional_national_draw_policies (
    career_id TEXT NOT NULL, policy_version TEXT NOT NULL, policy_json TEXT NOT NULL,
    PRIMARY KEY(career_id, policy_version)
  );`);
  let closed = false;
  const scope = (careerId: string, editionId: string): void => {
    if (closed || !id(careerId) || !id(editionId)) throw new Error('invalid regional national draw scope');
  };
  const row = (careerId: string, editionId: string): Row | undefined => db.prepare(
    'SELECT request_json, draw_json FROM world_regional_national_draws WHERE career_id=? AND edition_id=?')
    .get(careerId, editionId) as Row | undefined;
  const project = (request: RegionalNationalDrawRequest): DurableRegionalNationalDraw => {
    if (!request || Object.keys(request).sort().join('|') !== 'careerId|drawSeed|editionId|eligibilitySnapshotId|policy|registry'
      || !id(request.careerId) || !id(request.editionId) || !id(request.eligibilitySnapshotId) || !id(request.drawSeed)
      || !request.policy || !['relaxationOrder|rematchLookbackDays|version', 'hostPot1CandidateRule|relaxationOrder|rematchLookbackDays|version']
        .includes(Object.keys(request.policy).sort().join('|'))
      || (request.policy.hostPot1CandidateRule !== undefined && !['RANKING_ONLY', 'QUALIFIED_HOSTS_FIRST'].includes(request.policy.hostPot1CandidateRule))
      || !day(request.policy.rematchLookbackDays)) throw new Error('invalid regional national draw request or policy');
    const policy = requireRegisteredDrawPolicy(request.registry, request.policy);
    const selection = readSelection(request.careerId, request.editionId);
    if (!selection || selection.kind !== 'REGIONAL_NATIONAL' || !selection.region || selection.editionId !== request.editionId
      || !day(selection.qualificationCutoff.day) || selection.qualificationCutoff.day >= selection.calendarWindow.startsOnDay) {
      throw new Error('regional national draw requires accepted World selection');
    }
    const cutoffDay = selection.qualificationCutoff.day;
    const eligibility = readEligibility(request.careerId, request.editionId, request.eligibilitySnapshotId);
    if (!eligibility || eligibility.snapshotId !== request.eligibilitySnapshotId || eligibility.asOfDay !== cutoffDay
      || !Array.isArray(eligibility.eligibleNationIds) || ![8, 12, 16].includes(eligibility.eligibleNationIds.length)
      || eligibility.eligibleNationIds.some((nation) => !id(nation))
      || new Set(eligibility.eligibleNationIds).size !== eligibility.eligibleNationIds.length) {
      throw new Error('regional national draw requires accepted cutoff roster cohort of 8, 12 or 16 nations');
    }
    const ranking = readRanking(request.careerId, selection.region, cutoffDay);
    if (!ranking || ranking.ranking.kind !== 'REGIONAL_NATIONAL' || ranking.ranking.region !== selection.region
      || ranking.ranking.asOfDay !== cutoffDay || !id(ranking.ranking.snapshotId)
      || !Array.isArray(ranking.ranking.orderedNationIds)
      || new Set(ranking.ranking.orderedNationIds).size !== ranking.ranking.orderedNationIds.length) {
      throw new Error('regional national draw requires accepted regional cutoff ranking');
    }
    let entrants = ranking.ranking.orderedNationIds.filter((nation) => eligibility.eligibleNationIds.includes(nation));
    if (entrants.length !== eligibility.eligibleNationIds.length) throw new Error('regional ranking omits qualified nations');
    const hosts = request.policy.hostPot1CandidateRule === undefined ? null : readHosts?.(request.careerId, request.editionId, cutoffDay) ?? null;
    if (request.policy.hostPot1CandidateRule !== undefined) {
      if (!hosts || !id(hosts.snapshotId) || hosts.asOfDay !== cutoffDay || hosts.region !== selection.region
        || json(hosts.source.selection) !== json(selection)) throw new Error('regional draw requires accepted regional hosts at cutoff');
      const hosting = selectRegionalNationalHosts(hosts);
      if (request.policy.hostPot1CandidateRule === 'QUALIFIED_HOSTS_FIRST') {
        // Only nations already in the accepted cohort are candidates for this administrative pot priority.
        entrants = [...entrants.filter((nation) => hosting.hostNationIds.includes(nation)),
          ...entrants.filter((nation) => !hosting.hostNationIds.includes(nation))];
      }
    }
    const participantRegions = entrants.map((nationId) => {
      const region = readRegion(request.careerId, nationId, cutoffDay);
      if (region !== selection.region) throw new Error('regional draw entrant is outside the accepted region');
      return { nationId, region };
    });
    // Only the verified regional results backing this ranking can supply rematch evidence.
    const rematchHistory = { editions: ranking.source.history.editions.filter((edition) =>
      edition.tier === 'REGIONAL' && edition.completedAtDay <= cutoffDay
      && edition.completedAtDay >= Math.max(0, cutoffDay - request.policy.rematchLookbackDays)) };
    const pairs = new Map<string, readonly [string, string]>();
    for (const edition of rematchHistory.editions) for (const game of edition.games) {
      if (entrants.includes(game.homeNationId) && entrants.includes(game.awayNationId)) {
        const pair = [game.homeNationId, game.awayNationId].sort() as [string, string];
        pairs.set(json(pair), pair);
      }
    }
    const groupCount = entrants.length / 4;
    const draw = drawCompetitionGroups({ editionId: request.editionId, drawSeed: request.drawSeed, groupCount,
      profile: { drawPolicyVersion: policy.version, drawPolicy: policy },
      participants: participantRegions.map(({ nationId, region }, index) => ({ teamId: nationId,
        pot: Math.floor(index / groupCount) + 1, leagueId: json(['national-team', nationId]), regionId: region })),
      rematchPairs: [...pairs.values()] }, request.registry);
    const snapshot = { draw, policy: request.policy, source: { selection, eligibility, ranking, rematchHistory, participantRegions,
      ...(hosts ? { hosts } : {}) } };
    return freeze(cloneInert({ drawSnapshotId: `regional-national-draw:${createHash('sha256').update(json(snapshot)).digest('hex')}`, ...snapshot }));
  };
  const replay = (careerId: string, editionId: string, stored: Row): DurableRegionalNationalDraw => {
    try {
      const request = JSON.parse(stored.request_json) as RegionalNationalDrawRequest;
      const saved = JSON.parse(stored.draw_json) as DurableRegionalNationalDraw;
      const policy = db.prepare('SELECT policy_json FROM world_regional_national_draw_policies WHERE career_id=? AND policy_version=?')
        .get(careerId, request.policy.version) as { policy_json: string } | undefined;
      if (request.careerId !== careerId || request.editionId !== editionId || json(request) !== stored.request_json
        || json(saved) !== stored.draw_json || !policy || policy.policy_json !== json(request.policy)) throw new Error('regional draw metadata or policy differs');
      const expected = project(request);
      if (json(expected) !== stored.draw_json) throw new Error('regional draw Source replay differs');
      return expected;
    } catch (cause) { throw new Error(`corrupt regional national draw for ${careerId}`, { cause }); }
  };
  return Object.freeze({
    initialize(raw: RegionalNationalDrawRequest): DurableRegionalNationalDraw {
      return withCompetitionSourceReadPhase(() => {
        scope(raw?.careerId, raw?.editionId);
        const request = cloneInert(raw);
        db.exec('BEGIN IMMEDIATE');
        try {
          const stored = row(request.careerId, request.editionId);
          if (stored) {
            const prior = replay(request.careerId, request.editionId, stored);
            if (json(request) !== stored.request_json) throw new Error('regional national draw is frozen differently');
            db.exec('COMMIT'); return prior;
          }
          const snapshot = project(request);
          const policy = db.prepare('SELECT policy_json FROM world_regional_national_draw_policies WHERE career_id=? AND policy_version=?')
            .get(request.careerId, request.policy.version) as { policy_json: string } | undefined;
          if (policy && policy.policy_json !== json(request.policy)) throw new Error('regional national draw policy is frozen differently');
          if (!policy) db.prepare('INSERT INTO world_regional_national_draw_policies VALUES (?, ?, ?)')
            .run(request.careerId, request.policy.version, json(request.policy));
          db.prepare('INSERT INTO world_regional_national_draws VALUES (?, ?, ?, ?)')
            .run(request.careerId, request.editionId, json(request), json(snapshot));
          db.exec('COMMIT'); return snapshot;
        } catch (error) { db.exec('ROLLBACK'); throw error; }
      });
    },
    readDraw(careerId: string, editionId: string): DurableRegionalNationalDraw | null {
      return withCompetitionSourceReadScope(() => { scope(careerId, editionId);
        const stored = row(careerId, editionId); return stored ? replay(careerId, editionId, stored) : null; });
    },
    close() { if (!closed) db.close(); closed = true; },
  });
};
