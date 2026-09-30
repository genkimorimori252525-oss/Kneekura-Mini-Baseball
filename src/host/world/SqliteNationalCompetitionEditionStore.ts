import { createCompetitionSourceReader, withCompetitionSourceReadScope } from './CompetitionSourceReadScope';
import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { selectNationalCompetitionHosts,
  type NationalCompetitionHostingInput, type NationalCompetitionHosting } from
  '../../core/world/competition/NationalCompetitionHosting';
import { assertPremierTwelvePairingPolicy, planPremierTwelveGroups,
  type PremierTwelveEdition } from '../../core/world/competition/PremierTwelve';
import { planWbcFinalsGroups, type WbcFinalsGroupEdition } from
  '../../core/world/competition/WbcFinalsGroups';
import { assertWbcKnockoutEdition, type WbcKnockoutEdition } from
  '../../core/world/competition/WbcFinalsKnockout';
import { assertStandingsTiebreakPolicy } from '../../core/world/competition/OfficialStandings';
import type { DurableNationalCompetitionDraw, SqliteNationalCompetitionDrawStore } from
  './SqliteNationalCompetitionDrawStore';

export type NationalHostCandidateSnapshot = NationalCompetitionHostingInput & Readonly<{
  snapshotId: string; asOfDay: number;
}>;
type Profile = Readonly<{ competitionId: string; formatVersion: string;
  ruleProfileVersion: string; gamePolicyVersion: string; hostingPolicyVersion: string }>;
export type NationalCompetitionEditionProfile = Profile & (Readonly<{
  kind: 'PREMIER_12'; tiebreakPolicy: PremierTwelveEdition['tiebreakPolicy'];
  finalFourPairingPolicy: PremierTwelveEdition['finalFourPairingPolicy'];
}> | Readonly<{
  kind: 'WBC'; groupTiebreakPolicy: WbcFinalsGroupEdition['groupTiebreakPolicy'];
  thirdPlacePolicy: WbcFinalsGroupEdition['thirdPlacePolicy'];
  knockoutPolicy: Pick<WbcKnockoutEdition, 'knockoutPolicyVersion' | 'roundOf16Pairs'
    | 'roundOf16HubIndices' | 'quarterfinalHubIndices'>;
}>);
export type NationalCompetitionEditionRequest = Readonly<{
  careerId: string; editionId: string; profile: NationalCompetitionEditionProfile;
}>;
type Basis = Readonly<{ hosting: NationalCompetitionHosting;
  source: Readonly<{ draw: DurableNationalCompetitionDraw; candidates: NationalHostCandidateSnapshot }> }>;
export type DurableNationalCompetitionEdition = Basis & (Readonly<{
  kind: 'PREMIER_12'; edition: PremierTwelveEdition;
}> | Readonly<{ kind: 'WBC'; edition: WbcFinalsGroupEdition; knockoutEdition: WbcKnockoutEdition }>);
export type SqliteNationalCompetitionEditionStore = Readonly<{
  initialize(request: NationalCompetitionEditionRequest): DurableNationalCompetitionEdition;
  readSnapshot(careerId: string, editionId: string): DurableNationalCompetitionEdition | null;
  readPremierEdition(careerId: string, editionId: string): PremierTwelveEdition | null;
  readWbcEdition(careerId: string, editionId: string): WbcFinalsGroupEdition | null;
  readWbcKnockoutEdition(careerId: string, editionId: string): WbcKnockoutEdition | null;
  close(): void;
}>;
export type NationalCompetitionEditionSources = Readonly<{
  draws: Pick<SqliteNationalCompetitionDrawStore, 'readDraw'>;
  hosts: Readonly<{ readCandidates(careerId: string, editionId: string,
    beforeDay: number): NationalHostCandidateSnapshot | null }>;
}>;

type Row = { request_json: string; snapshot_json: string };
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value === value.trim();
const canonicalJson = (value: unknown): string => JSON.stringify(
  cloneInert(value), (_key, item: unknown) =>
    item !== null && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([left], [right]) =>
        left < right ? -1 : left > right ? 1 : 0)) : item);
const freeze = <T>(value: T): T => {
  if (value !== null && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

/** Assemble edition identities from accepted qualification/draw and organizer host sources. */
export const openSqliteNationalCompetitionEditionStore = (
  databasePath: string, sources: NationalCompetitionEditionSources,
): SqliteNationalCompetitionEditionStore => {
  if (!id(databasePath)) throw new Error('invalid national edition database path');
  const readDraw = createCompetitionSourceReader(sources.draws.readDraw, sources.draws);
  const readCandidates = createCompetitionSourceReader(sources.hosts.readCandidates, sources.hosts);
  const sqlite: typeof import('node:sqlite') = createRequire(import.meta.url)('node:sqlite');
  const db = new sqlite.DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_national_competition_editions (
    career_id TEXT NOT NULL, edition_id TEXT NOT NULL,
    request_json TEXT NOT NULL, snapshot_json TEXT NOT NULL,
    PRIMARY KEY (career_id, edition_id)
  );`);
  const get = db.prepare(`SELECT request_json, snapshot_json FROM world_national_competition_editions
    WHERE career_id=? AND edition_id=?`);
  const row = (careerId: string, editionId: string): Row | null =>
    (get.get(careerId, editionId) as Row | undefined) ?? null;
  const project = (request: NationalCompetitionEditionRequest): DurableNationalCompetitionEdition => {
    const { profile } = request;
    if (!id(request.careerId) || !id(request.editionId) || !profile
      || !['WBC', 'PREMIER_12'].includes(profile.kind)
      || ![profile.competitionId, profile.formatVersion, profile.ruleProfileVersion,
        profile.gamePolicyVersion, profile.hostingPolicyVersion].every(id)) {
      throw new Error('invalid national edition request');
    }
    const draw = readDraw(request.careerId, request.editionId);
    if (!draw || draw.draw.editionId !== request.editionId
      || draw.source.selection.editionId !== request.editionId
      || draw.source.selection.kind !== profile.kind) {
      throw new Error('national edition requires accepted draw and World selection');
    }
    const selection = draw.source.selection;
    const rawCandidates = readCandidates(request.careerId, request.editionId,
      selection.qualificationCutoff.day);
    if (!rawCandidates || !id(rawCandidates.snapshotId)
      || rawCandidates.asOfDay !== selection.qualificationCutoff.day
      || rawCandidates.kind !== profile.kind
      || rawCandidates.policyVersion !== profile.hostingPolicyVersion) {
      throw new Error('national edition requires accepted cutoff host candidates');
    }
    const candidates = cloneInert(rawCandidates);
    const hosting = selectNationalCompetitionHosts(candidates);
    const common = { competitionId: profile.competitionId, editionId: request.editionId,
      formatVersion: profile.formatVersion, ruleProfileVersion: profile.ruleProfileVersion,
      gamePolicyVersion: profile.gamePolicyVersion, hostingPolicyVersion: profile.hostingPolicyVersion,
      drawSnapshotId: draw.drawSnapshotId, calendarWindow: selection.calendarWindow };
    const host = (value: NationalCompetitionHosting['finalFourHost']) => ({
      nationId: value.selectedNationId, cityId: value.selectedCityId, venueId: value.selectedVenueId });
    const source = { draw: cloneInert(draw), candidates };
    if (profile.kind === 'PREMIER_12') {
      assertStandingsTiebreakPolicy(profile.tiebreakPolicy);
      assertPremierTwelvePairingPolicy(profile.finalFourPairingPolicy);
      const edition: PremierTwelveEdition = {
        ...common, canonicalRole: 'PREMIER_12',
        rankingPolicyVersion: draw.source.ranking.policyVersion,
        qualificationCutoffSnapshotId: selection.qualificationCutoff.snapshotId,
        rankingSnapshotId: draw.source.ranking.snapshotId,
        tiebreakPolicy: profile.tiebreakPolicy, finalFourPairingPolicy: profile.finalFourPairingPolicy,
        hostNationIds: hosting.hostNationIds,
        groupHosts: hosting.groupHosts.map((value, groupIndex) => ({ groupIndex, ...host(value) })),
        finalFourHost: host(hosting.finalFourHost),
        groups: draw.draw.groups.map((group, groupIndex) => ({ groupIndex,
          nationIds: group.map((participant) => participant.teamId) })),
      };
      planPremierTwelveGroups(edition, { editionCutoff: () => selection.qualificationCutoff,
        worldNationalRanking: () => draw.source.ranking });
      return freeze({ kind: 'PREMIER_12', edition, hosting, source });
    }
    if (!draw.source.berths) throw new Error('WBC edition requires accepted berths');
    assertStandingsTiebreakPolicy(profile.groupTiebreakPolicy);
    const edition: WbcFinalsGroupEdition = {
      ...common, canonicalRole: 'NATIONAL_WORLD_CHAMPIONSHIP', hostNationId: 'US',
      qualificationSnapshotId: draw.source.berths.qualificationSnapshotId,
      drawPolicyVersion: draw.policy.version, groupTiebreakPolicy: profile.groupTiebreakPolicy,
      thirdPlacePolicy: profile.thirdPlacePolicy,
      groups: draw.draw.groups.map((group, groupIndex) => ({ groupIndex,
        hostCityId: hosting.groupHosts[groupIndex].selectedCityId,
        hostVenueId: hosting.groupHosts[groupIndex].selectedVenueId,
        nationIds: group.map((participant) => participant.teamId) })),
    };
    planWbcFinalsGroups(edition, draw.source.berths);
    const knockoutEdition: WbcKnockoutEdition = {
      competitionId: edition.competitionId, editionId: edition.editionId,
      canonicalRole: edition.canonicalRole, hostNationId: 'US',
      qualificationSnapshotId: edition.qualificationSnapshotId,
      groupDrawSnapshotId: edition.drawSnapshotId,
      ruleProfileVersion: edition.ruleProfileVersion, gamePolicyVersion: edition.gamePolicyVersion,
      ...profile.knockoutPolicy,
      knockoutHubs: hosting.knockoutHubs.map((value) => ({ cityId: value.selectedCityId,
        venueId: value.selectedVenueId })),
      finalFourHost: { cityId: hosting.finalFourHost.selectedCityId,
        venueId: hosting.finalFourHost.selectedVenueId },
    };
    assertWbcKnockoutEdition(knockoutEdition, edition);
    return freeze({ kind: 'WBC', edition, knockoutEdition, hosting, source });
  };
  const parse = (careerId: string, editionId: string, stored: Row): DurableNationalCompetitionEdition => {
    try {
      const request = JSON.parse(stored.request_json) as NationalCompetitionEditionRequest;
      const snapshot = JSON.parse(stored.snapshot_json) as DurableNationalCompetitionEdition;
      const replayed = project(request);
      if (request.careerId !== careerId || request.editionId !== editionId
        || canonicalJson(request) !== stored.request_json
        || canonicalJson(snapshot) !== stored.snapshot_json
        || canonicalJson(replayed) !== stored.snapshot_json) throw new Error('national edition replay differs');
      return replayed;
    } catch (cause) { throw new Error(`corrupt national competition edition for ${careerId}`, { cause }); }
  };
  let closed = false;
  const readSnapshot = createCompetitionSourceReader((careerId: string, editionId: string): DurableNationalCompetitionEdition | null => {
    if (closed || !id(careerId) || !id(editionId)) throw new Error('invalid national edition Career scope');
    const stored = row(careerId, editionId);
    return withCompetitionSourceReadScope(() => stored ? parse(careerId, editionId, stored) : null);
  });
  return Object.freeze({
    initialize(rawRequest: NationalCompetitionEditionRequest): DurableNationalCompetitionEdition {
      if (closed) throw new Error('national edition store is closed');
      const request = cloneInert(rawRequest);
      const snapshot = project(request);
      const requestJson = canonicalJson(request);
      db.exec('BEGIN IMMEDIATE');
      try {
        const stored = row(request.careerId, request.editionId);
        if (stored) {
          const prior = parse(request.careerId, request.editionId, stored);
          if (requestJson !== stored.request_json) throw new Error('national edition is already frozen differently');
          db.exec('COMMIT');
          return prior;
        }
        db.prepare(`INSERT INTO world_national_competition_editions
          (career_id, edition_id, request_json, snapshot_json) VALUES (?, ?, ?, ?)`)
          .run(request.careerId, request.editionId, requestJson, canonicalJson(snapshot));
        db.exec('COMMIT');
        return snapshot;
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    readSnapshot,
    readPremierEdition(careerId: string, editionId: string): PremierTwelveEdition | null {
      const snapshot = readSnapshot(careerId, editionId);
      return snapshot?.kind === 'PREMIER_12' ? snapshot.edition : null;
    },
    readWbcEdition(careerId: string, editionId: string): WbcFinalsGroupEdition | null {
      const snapshot = readSnapshot(careerId, editionId);
      return snapshot?.kind === 'WBC' ? snapshot.edition : null;
    },
    readWbcKnockoutEdition(careerId: string, editionId: string): WbcKnockoutEdition | null {
      const snapshot = readSnapshot(careerId, editionId);
      return snapshot?.kind === 'WBC' ? snapshot.knockoutEdition : null;
    },
    close(): void { if (!closed) db.close(); closed = true; },
  });
};
