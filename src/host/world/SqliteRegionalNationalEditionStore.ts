import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { planRegionalNationalGroups, type RegionalNationalEdition } from '../../core/world/competition/RegionalNationalGroups';
import { assertRegionalNationalKnockoutEdition, type RegionalNationalKnockoutEdition } from '../../core/world/competition/RegionalNationalKnockout';
import { assertStandingsTiebreakPolicy } from '../../core/world/competition/OfficialStandings';
import { selectRegionalNationalHosts, type RegionalNationalHosting } from '../../core/world/competition/RegionalNationalHosting';
import type { DurableRegionalNationalDraw, SqliteRegionalNationalDrawStore } from './SqliteRegionalNationalDrawStore';
import type { DurableRegionalNationalHostCandidates, SqliteRegionalNationalHostCandidateStore } from './SqliteRegionalNationalHostCandidateStore';
import type { SqliteNationCompetitionRegionStore } from './SqliteNationCompetitionRegionStore';
import { createCompetitionSourceReader, withCompetitionSourceReadScope, withCompetitionSourceReadPhase } from './CompetitionSourceReadScope';

export type RegionalNationalEditionProfile = Readonly<{
  competitionId: string; formatVersion: string; ruleProfileVersion: string; gamePolicyVersion: string; hostingPolicyVersion: string;
  tiebreakPolicy: RegionalNationalEdition['tiebreakPolicy'];
  bestThirdPolicy: Omit<RegionalNationalEdition['bestThirdPolicy'], 'drawSeed'>;
  groupHostIndices: readonly number[];
  knockoutPolicy: Readonly<{ version: string; openingPairs: RegionalNationalKnockoutEdition['openingPairs'];
    openingHubIndices: readonly number[]; semifinalHubIndices: readonly number[];
    placementPolicy: Omit<RegionalNationalKnockoutEdition['placementPolicy'], 'drawSeed'> }>;
}>;
export type RegionalNationalEditionRequest = Readonly<{
  careerId: string; editionId: string; profile: RegionalNationalEditionProfile;
  bestThirdDrawSeed: string; placementDrawSeed: string;
}>;
export type DurableRegionalNationalEdition = Readonly<{
  snapshotId: string; edition: RegionalNationalEdition; knockoutEdition: RegionalNationalKnockoutEdition;
  hosting: RegionalNationalHosting; profile: RegionalNationalEditionProfile;
  source: Readonly<{ draw: DurableRegionalNationalDraw; candidates: DurableRegionalNationalHostCandidates }>;
}>;
export type SqliteRegionalNationalEditionStore = Readonly<{
  initialize(request: RegionalNationalEditionRequest): DurableRegionalNationalEdition;
  readSnapshot(careerId: string, editionId: string): DurableRegionalNationalEdition | null;
  readEdition(careerId: string, editionId: string): RegionalNationalEdition | null;
  readKnockoutEdition(careerId: string, editionId: string): RegionalNationalKnockoutEdition | null;
  close(): void;
}>;
type Row = { request_json: string; snapshot_json: string };
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value === value.trim();
const index = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const json = (value: unknown): string => JSON.stringify(cloneInert(value), (_key, item: unknown) =>
  item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
const freeze = <T>(value: T): T => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};

/** Edition identities, entrants and venues come from accepted organizers, never caller-filled metadata. */
export const openSqliteRegionalNationalEditionStore = (databasePath: string, sources: Readonly<{
  draws: Pick<SqliteRegionalNationalDrawStore, 'readDraw'>;
  hosts: Pick<SqliteRegionalNationalHostCandidateStore, 'readCandidates'>;
  nations: Pick<SqliteNationCompetitionRegionStore, 'authority'>;
}>): SqliteRegionalNationalEditionStore => {
  if (!id(databasePath)) throw new Error('invalid regional national Edition database path');
  const readDraw = createCompetitionSourceReader(sources.draws.readDraw, sources.draws);
  const readCandidates = createCompetitionSourceReader(sources.hosts.readCandidates, sources.hosts);
  const readAuthority = createCompetitionSourceReader(sources.nations.authority, sources.nations);
  const { DatabaseSync }: typeof import('node:sqlite') = createRequire(import.meta.url)('node:sqlite');
  const db = new DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_regional_national_editions (
    career_id TEXT NOT NULL, edition_id TEXT NOT NULL, request_json TEXT NOT NULL, snapshot_json TEXT NOT NULL,
    PRIMARY KEY(career_id, edition_id)
  ); CREATE TABLE IF NOT EXISTS world_regional_national_edition_profiles (
    career_id TEXT NOT NULL, competition_id TEXT NOT NULL, format_version TEXT NOT NULL, profile_json TEXT NOT NULL,
    PRIMARY KEY(career_id, competition_id, format_version)
  );`);
  let closed = false;
  const scope = (careerId: string, editionId: string): void => {
    if (closed || !id(careerId) || !id(editionId)) throw new Error('invalid regional national Edition scope');
  };
  const row = (careerId: string, editionId: string): Row | undefined => db.prepare(
    'SELECT request_json, snapshot_json FROM world_regional_national_editions WHERE career_id=? AND edition_id=?')
    .get(careerId, editionId) as Row | undefined;
  const project = (request: RegionalNationalEditionRequest): DurableRegionalNationalEdition => {
    if (!request || Object.keys(request).sort().join('|') !== 'bestThirdDrawSeed|careerId|editionId|placementDrawSeed|profile'
      || ![request.careerId, request.editionId, request.bestThirdDrawSeed, request.placementDrawSeed].every(id)) throw new Error('invalid regional Edition request');
    const profile = request.profile;
    if (!profile || Object.keys(profile).sort().join('|') !== 'bestThirdPolicy|competitionId|formatVersion|gamePolicyVersion|groupHostIndices|hostingPolicyVersion|knockoutPolicy|ruleProfileVersion|tiebreakPolicy'
      || ![profile.competitionId, profile.formatVersion, profile.ruleProfileVersion, profile.gamePolicyVersion, profile.hostingPolicyVersion].every(id)
      || !profile.bestThirdPolicy || Object.keys(profile.bestThirdPolicy).sort().join('|') !== 'criteria|version'
      || !profile.knockoutPolicy || Object.keys(profile.knockoutPolicy).sort().join('|') !== 'openingHubIndices|openingPairs|placementPolicy|semifinalHubIndices|version'
      || !profile.knockoutPolicy.placementPolicy || Object.keys(profile.knockoutPolicy.placementPolicy).sort().join('|') !== 'criteria|version') {
      throw new Error('invalid regional Edition profile');
    }
    assertStandingsTiebreakPolicy(profile.tiebreakPolicy);
    const draw = readDraw(request.careerId, request.editionId);
    if (!draw || draw.draw.editionId !== request.editionId || draw.source.selection.editionId !== request.editionId
      || draw.source.selection.kind !== 'REGIONAL_NATIONAL' || !draw.source.selection.region) throw new Error('regional Edition requires accepted Native draw');
    const selection = draw.source.selection;
    const candidates = readCandidates(request.careerId, request.editionId, selection.qualificationCutoff.day);
    if (!candidates || !id(candidates.snapshotId) || candidates.asOfDay !== selection.qualificationCutoff.day
      || candidates.region !== selection.region || candidates.policy.version !== profile.hostingPolicyVersion
      || json(candidates.source.selection) !== json(selection)
      || (draw.source.hosts && json(draw.source.hosts) !== json(candidates))) throw new Error('regional Edition requires matching accepted hosting candidates');
    const hosting = selectRegionalNationalHosts(candidates);
    if (!Array.isArray(profile.groupHostIndices) || profile.groupHostIndices.length !== draw.draw.groups.length
      || profile.groupHostIndices.some((value) => !index(value) || value >= hosting.groupHosts.length)
      || new Set(profile.groupHostIndices).size !== hosting.groupHosts.length) throw new Error('invalid regional group host mapping');
    const hubVenues = (values: readonly number[]): readonly string[] => {
      if (!Array.isArray(values) || values.some((value) => !index(value) || value >= hosting.knockoutHubs.length)) {
        throw new Error('invalid regional knockout host mapping');
      }
      return values.map((value) => hosting.knockoutHubs[value].selectedVenueId);
    };
    const edition: RegionalNationalEdition = { competitionId: profile.competitionId, editionId: request.editionId,
      canonicalRole: 'REGIONAL_NATIONAL_CHAMPIONSHIP', region: selection.region!, formatVersion: profile.formatVersion,
      ruleProfileVersion: profile.ruleProfileVersion, gamePolicyVersion: profile.gamePolicyVersion, hostingPolicyVersion: profile.hostingPolicyVersion,
      qualificationSnapshotId: draw.source.eligibility.snapshotId, drawSnapshotId: draw.drawSnapshotId,
      tiebreakPolicy: profile.tiebreakPolicy, bestThirdPolicy: { ...profile.bestThirdPolicy, drawSeed: request.bestThirdDrawSeed },
      hostNationIds: hosting.hostNationIds, calendarWindow: selection.calendarWindow,
      groups: draw.draw.groups.map((group, groupIndex) => {
        const host = hosting.groupHosts[profile.groupHostIndices[groupIndex]];
        return { groupIndex, nationIds: group.map((participant) => participant.teamId), hostNationId: host.selectedNationId,
          hostCityId: host.selectedCityId, hostVenueId: host.selectedVenueId };
      }) };
    planRegionalNationalGroups(edition, readAuthority(request.careerId));
    const knockoutEdition: RegionalNationalKnockoutEdition = { competitionId: edition.competitionId, editionId: edition.editionId,
      region: edition.region, formatVersion: edition.formatVersion, ruleProfileVersion: edition.ruleProfileVersion, gamePolicyVersion: edition.gamePolicyVersion,
      qualificationSnapshotId: edition.qualificationSnapshotId, groupDrawSnapshotId: edition.drawSnapshotId,
      knockoutPolicyVersion: profile.knockoutPolicy.version, openingPairs: profile.knockoutPolicy.openingPairs,
      openingVenueIds: hubVenues(profile.knockoutPolicy.openingHubIndices), semifinalVenueIds: hubVenues(profile.knockoutPolicy.semifinalHubIndices),
      finalVenueId: hosting.finalFourHost.selectedVenueId,
      placementPolicy: { ...profile.knockoutPolicy.placementPolicy, drawSeed: request.placementDrawSeed } };
    assertRegionalNationalKnockoutEdition(edition, edition.groups.length === 2 ? 4 : 8, knockoutEdition);
    const basis = { edition, knockoutEdition, hosting, profile, source: { draw, candidates } };
    return freeze(cloneInert({ snapshotId: `regional-national-edition:${createHash('sha256').update(json(basis)).digest('hex')}`, ...basis }));
  };
  const profileRow = (careerId: string, profile: RegionalNationalEditionProfile): { profile_json: string } | undefined =>
    db.prepare('SELECT profile_json FROM world_regional_national_edition_profiles WHERE career_id=? AND competition_id=? AND format_version=?')
      .get(careerId, profile.competitionId, profile.formatVersion) as { profile_json: string } | undefined;
  const replay = (careerId: string, editionId: string, stored: Row): DurableRegionalNationalEdition => {
    try {
      const request = JSON.parse(stored.request_json) as RegionalNationalEditionRequest;
      const saved = JSON.parse(stored.snapshot_json) as DurableRegionalNationalEdition;
      const profile = profileRow(careerId, request.profile);
      if (request.careerId !== careerId || request.editionId !== editionId || json(request) !== stored.request_json
        || json(saved) !== stored.snapshot_json || !profile || profile.profile_json !== json(request.profile)) throw new Error('regional Edition metadata or format profile differs');
      const expected = project(request);
      if (json(expected) !== stored.snapshot_json) throw new Error('regional Edition Source replay differs');
      return expected;
    } catch (cause) { throw new Error(`corrupt regional national Edition for ${careerId}`, { cause }); }
  };
  const readSnapshot = (careerId: string, editionId: string): DurableRegionalNationalEdition | null => withCompetitionSourceReadScope(() => {
    scope(careerId, editionId);
    const stored = row(careerId, editionId); return stored ? replay(careerId, editionId, stored) : null;
  });
  return Object.freeze({
    initialize(raw: RegionalNationalEditionRequest): DurableRegionalNationalEdition {
      return withCompetitionSourceReadPhase(() => {
        scope(raw?.careerId, raw?.editionId);
        const request = cloneInert(raw);
        db.exec('BEGIN IMMEDIATE');
        try {
          const stored = row(request.careerId, request.editionId);
          if (stored) {
            const prior = replay(request.careerId, request.editionId, stored);
            if (json(request) !== stored.request_json) throw new Error('regional national Edition is frozen differently');
            db.exec('COMMIT'); return prior;
          }
          const snapshot = project(request);
          const profile = profileRow(request.careerId, request.profile);
          if (profile && profile.profile_json !== json(request.profile)) throw new Error('regional format profile is frozen differently');
          if (!profile) db.prepare('INSERT INTO world_regional_national_edition_profiles VALUES (?, ?, ?, ?)')
            .run(request.careerId, request.profile.competitionId, request.profile.formatVersion, json(request.profile));
          db.prepare('INSERT INTO world_regional_national_editions VALUES (?, ?, ?, ?)')
            .run(request.careerId, request.editionId, json(request), json(snapshot));
          db.exec('COMMIT'); return snapshot;
        } catch (error) { db.exec('ROLLBACK'); throw error; }
      });
    },
    readSnapshot,
    readEdition: (careerId: string, editionId: string) => readSnapshot(careerId, editionId)?.edition ?? null,
    readKnockoutEdition: (careerId: string, editionId: string) => readSnapshot(careerId, editionId)?.knockoutEdition ?? null,
    close() { if (!closed) db.close(); closed = true; },
  });
};
