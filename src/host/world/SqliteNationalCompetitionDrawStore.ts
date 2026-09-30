import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { drawCompetitionGroups, requireRegisteredDrawPolicy, type CompetitionDraw,
  type CompetitionDrawPolicy, type CompetitionDrawPolicyRegistry } from
  '../../core/world/competition/CompetitionDraw';
import type { PremierTwelveRanking } from '../../core/world/competition/PremierTwelve';
import type { WbcBerthAllocation } from '../../core/world/competition/WbcBerths';
import type { WorldNationalRankingHistory } from '../../core/world/competition/WorldNationalRankingHistory';
import type { SqliteNationCompetitionRegionStore } from './SqliteNationCompetitionRegionStore';
import type { NationalCompetitionSelection, SqliteNationalCompetitionSelectionStore } from
  './SqliteNationalCompetitionSelectionStore';
import type { SqliteWbcBerthStore } from './SqliteWbcBerthStore';
import type { SqliteWorldNationalRankingHistoryStore } from './SqliteWorldNationalRankingHistoryStore';
import type { SqliteWorldNationalRankingSnapshotStore } from './SqliteWorldNationalRankingSnapshotStore';

export type NationalCompetitionDrawPolicy = CompetitionDrawPolicy & Readonly<{
  rematchLookbackDays: number;
}>;
export type NationalCompetitionDrawRequest = Readonly<{
  careerId: string;
  editionId: string;
  kind: 'WBC' | 'PREMIER_12';
  drawSeed: string;
  policy: NationalCompetitionDrawPolicy;
  registry: CompetitionDrawPolicyRegistry;
}>;
export type DurableNationalCompetitionDraw = Readonly<{
  drawSnapshotId: string;
  draw: CompetitionDraw;
  policy: NationalCompetitionDrawPolicy;
  source: Readonly<{
    selection: NationalCompetitionSelection;
    ranking: PremierTwelveRanking;
    berths: WbcBerthAllocation | null;
    rematchHistory: WorldNationalRankingHistory;
    participantRegions: readonly Readonly<{ nationId: string; region: string }>[];
  }>;
}>;
export type SqliteNationalCompetitionDrawStore = Readonly<{
  initialize(request: NationalCompetitionDrawRequest): DurableNationalCompetitionDraw;
  readDraw(careerId: string, editionId: string): DurableNationalCompetitionDraw | null;
  close(): void;
}>;
type Row = { request_json: string; draw_json: string };
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value === value.trim();
const day = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const canonicalJson = (value: unknown): string => JSON.stringify(
  cloneInert(value), (_key, item: unknown) =>
    item !== null && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([left], [right]) =>
        left < right ? -1 : left > right ? 1 : 0)) : item);

/** Pots consume cutoff ranking, qualification and historical regions; no ability input exists. */
export const openSqliteNationalCompetitionDrawStore = (
  databasePath: string,
  sources: Readonly<{
    selections: Pick<SqliteNationalCompetitionSelectionStore, 'readSelection'>;
    rankings: Pick<SqliteWorldNationalRankingSnapshotStore, 'readRanking'>;
    history: Pick<SqliteWorldNationalRankingHistoryStore, 'readHistory'>;
    nations: Pick<SqliteNationCompetitionRegionStore, 'readRegion'>;
    wbcBerths?: Pick<SqliteWbcBerthStore, 'readAllocation'>;
  }>,
): SqliteNationalCompetitionDrawStore => {
  if (!id(databasePath)) throw new Error('invalid national draw database path');
  const sqlite: typeof import('node:sqlite') = createRequire(import.meta.url)('node:sqlite');
  const db = new sqlite.DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_national_draw_policies (
    career_id TEXT NOT NULL, policy_version TEXT NOT NULL, policy_json TEXT NOT NULL,
    PRIMARY KEY (career_id, policy_version)
  );
  CREATE TABLE IF NOT EXISTS world_national_draws (
    career_id TEXT NOT NULL, edition_id TEXT NOT NULL,
    request_json TEXT NOT NULL, draw_json TEXT NOT NULL,
    PRIMARY KEY (career_id, edition_id)
  );`);
  const get = db.prepare(`SELECT request_json, draw_json FROM world_national_draws
    WHERE career_id=? AND edition_id=?`);
  const getPolicy = db.prepare(`SELECT policy_json FROM world_national_draw_policies
    WHERE career_id=? AND policy_version=?`);
  const row = (careerId: string, editionId: string): Row | null =>
    (get.get(careerId, editionId) as Row | undefined) ?? null;
  const project = (request: NationalCompetitionDrawRequest): DurableNationalCompetitionDraw => {
    if (!id(request?.careerId) || !id(request.editionId) || !id(request.drawSeed)
      || !['WBC', 'PREMIER_12'].includes(request.kind)
      || !day(request.policy?.rematchLookbackDays)) {
      throw new Error('invalid national draw request or policy');
    }
    const policy = requireRegisteredDrawPolicy(request.registry, request.policy);
    const selection = sources.selections.readSelection(request.careerId, request.editionId);
    if (!selection || selection.editionId !== request.editionId || selection.kind !== request.kind
      || !day(selection.qualificationCutoff.day)
      || selection.qualificationCutoff.day >= selection.calendarWindow.startsOnDay) {
      throw new Error('national draw requires accepted World selection');
    }
    const cutoffDay = selection.qualificationCutoff.day;
    const ranking = sources.rankings.readRanking(request.careerId, cutoffDay);
    if (!ranking || ranking.asOfDay !== cutoffDay) {
      throw new Error('national draw requires accepted cutoff ranking');
    }
    const berths = request.kind === 'WBC'
      ? sources.wbcBerths?.readAllocation(request.careerId, request.editionId) ?? null : null;
    if (request.kind === 'WBC' && (!berths || berths.editionId !== request.editionId
      || berths.cutoffSnapshotId !== selection.qualificationCutoff.snapshotId
      || berths.entrantNationIds.length !== 24 || new Set(berths.entrantNationIds).size !== 24)) {
      throw new Error('national draw requires accepted 24 WBC berths');
    }
    const entrants = request.kind === 'WBC' ? ranking.orderedNationIds
      .filter((nationId) => berths!.entrantNationIds.includes(nationId))
      : ranking.orderedNationIds.slice(0, 12);
    const expectedCount = request.kind === 'WBC' ? 24 : 12;
    if (entrants.length !== expectedCount || new Set(entrants).size !== expectedCount) {
      throw new Error('national draw ranking does not contain all qualified nations');
    }
    const groupCount = request.kind === 'WBC' ? 6 : 2;
    const participantRegions = entrants.map((nationId) => {
      const region = sources.nations.readRegion(request.careerId, nationId, cutoffDay);
      if (!region) throw new Error('national draw requires historical nation region');
      return Object.freeze({ nationId, region });
    });
    const history = sources.history.readHistory(request.careerId, cutoffDay);
    const rematchHistory: WorldNationalRankingHistory = Object.freeze({
      editions: Object.freeze(history.editions.filter((edition) =>
        edition.completedAtDay >= Math.max(0, cutoffDay - request.policy.rematchLookbackDays))) });
    const entrantSet = new Set(entrants);
    const pairs = new Map<string, readonly [string, string]>();
    for (const edition of rematchHistory.editions) for (const game of edition.games) {
      if (entrantSet.has(game.homeNationId) && entrantSet.has(game.awayNationId)) {
        const pair = [game.homeNationId, game.awayNationId].sort() as [string, string];
        pairs.set(JSON.stringify(pair), pair);
      }
    }
    const draw = drawCompetitionGroups({ editionId: request.editionId,
      profile: { drawPolicyVersion: policy.version, drawPolicy: policy },
      drawSeed: request.drawSeed, groupCount,
      participants: participantRegions.map(({ nationId, region }, index) => ({
        teamId: nationId, pot: Math.floor(index / groupCount) + 1,
        // A national representative is its own affiliation; domestic Club/League is irrelevant.
        leagueId: JSON.stringify(['national-team', nationId]), regionId: region })),
      rematchPairs: [...pairs.values()] }, request.registry);
    const source = cloneInert({ selection, ranking, berths, rematchHistory, participantRegions });
    const snapshot = { draw, source, policy: cloneInert(request.policy) };
    const drawSnapshotId = `national-draw:${createHash('sha256')
      .update(canonicalJson(snapshot)).digest('hex')}`;
    return Object.freeze({ drawSnapshotId, ...snapshot });
  };
  const replay = (careerId: string, editionId: string, stored: Row): DurableNationalCompetitionDraw => {
    try {
      const request = JSON.parse(stored.request_json) as NationalCompetitionDrawRequest;
      const saved = JSON.parse(stored.draw_json) as DurableNationalCompetitionDraw;
      if (request.careerId !== careerId || request.editionId !== editionId
        || canonicalJson(request) !== stored.request_json || canonicalJson(saved) !== stored.draw_json) {
        throw new Error('national draw serialization differs');
      }
      const policyRow = getPolicy.get(careerId, request.policy.version) as { policy_json: string } | undefined;
      if (!policyRow || policyRow.policy_json !== canonicalJson(request.policy)) {
        throw new Error('national draw policy differs');
      }
      const draw = project(request);
      if (canonicalJson(draw) !== stored.draw_json) throw new Error('national draw replay differs');
      return draw;
    } catch (cause) {
      throw new Error(`corrupt national draw for ${careerId}`, { cause });
    }
  };
  let closed = false;
  const assertScope = (careerId: string, editionId: string): void => {
    if (closed || !id(careerId) || !id(editionId)) throw new Error('invalid national draw scope');
  };
  return Object.freeze({
    initialize(rawRequest: NationalCompetitionDrawRequest): DurableNationalCompetitionDraw {
      assertScope(rawRequest?.careerId, rawRequest?.editionId);
      const request = cloneInert(rawRequest);
      db.exec('BEGIN IMMEDIATE');
      try {
        const stored = row(request.careerId, request.editionId);
        if (stored) {
          const prior = replay(request.careerId, request.editionId, stored);
          if (canonicalJson(request) !== stored.request_json) throw new Error('national draw is frozen differently');
          db.exec('COMMIT');
          return prior;
        }
        const draw = project(request);
        const policyRow = getPolicy.get(request.careerId, request.policy.version) as
          { policy_json: string } | undefined;
        if (policyRow && policyRow.policy_json !== canonicalJson(request.policy)) {
          throw new Error('national draw policy version is frozen differently');
        }
        if (!policyRow) db.prepare(`INSERT INTO world_national_draw_policies
          (career_id, policy_version, policy_json) VALUES (?, ?, ?)`)
          .run(request.careerId, request.policy.version, canonicalJson(request.policy));
        db.prepare(`INSERT INTO world_national_draws
          (career_id, edition_id, request_json, draw_json) VALUES (?, ?, ?, ?)`)
          .run(request.careerId, request.editionId, canonicalJson(request), canonicalJson(draw));
        db.exec('COMMIT');
        return draw;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    readDraw(careerId: string, editionId: string): DurableNationalCompetitionDraw | null {
      assertScope(careerId, editionId);
      const stored = row(careerId, editionId);
      return stored ? replay(careerId, editionId, stored) : null;
    },
    close(): void {
      if (!closed) db.close();
      closed = true;
    },
  });
};
