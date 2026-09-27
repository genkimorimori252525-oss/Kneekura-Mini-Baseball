import type { ClubWorldState } from '../club/ClubTypes';
import type { ScheduleGame } from '../competition/LeagueSchedule';
import type { OfficialGameVenueBinding } from '../competition/OfficialGameCompletion';
import { evaluateRosterParticipation } from '../roster/RosterQueries';
import type { RosterState } from '../roster/RosterTypes';
import { projectFanFavorite, type FanFavoriteInput } from './FanFavorite';

export type AttendanceDriverKind = 'CLUB_POPULARITY' | 'TEAM_PERFORMANCE'
  | 'STADIUM' | 'OPPONENT' | 'DAY_EVENT' | 'TICKET_ENVIRONMENT';
export type AttendanceDriverEvidence = Readonly<{
  kind: AttendanceDriverKind;
  careerId: string;
  gameId: string;
  subjectId: string;
  evidenceId: string;
  sourceCareerEventId: string;
  availableAtDay: number;
  /** Calibrated source estimate, 0–1. */
  value: number;
}>;
export type AnnouncedParticipant = Readonly<{
  gameId: string;
  playerId: string;
  personId: string;
  clubId: string;
  sourceEventId: string;
  availableAtDay: number;
}>;
export type AttendanceInterestPolicy = Readonly<{
  policyId: string;
  version: string;
  availableAtDay: number;
  baseline: number;
  driverWeights: Readonly<Record<AttendanceDriverKind, number>>;
  playerDrawWeight: number;
  awarenessWeight: number;
  favorabilityWeight: number;
}>;
export type AttendanceInterestInput = Readonly<{
  careerId: string;
  asOfDay: number;
  fixture: ScheduleGame;
  fixtureSourceId: string;
  venueBinding: OfficialGameVenueBinding;
  seasonId: string;
  homeClub: ClubWorldState;
  roster: RosterState;
  lineup: readonly AnnouncedParticipant[];
  audienceSources: readonly FanFavoriteInput[];
  drivers: readonly AttendanceDriverEvidence[];
}>;
export type AttendanceInterestProjection = Readonly<{
  boundary: 'CAREER_ATTENDANCE_INTEREST_ONLY';
  careerId: string;
  gameId: string;
  asOfDay: number;
  interestIndex: number;
  playerDraw: number;
  provenance: Readonly<{
    gameId: string;
    fixtureSourceId: string;
    homeClubId: string;
    clubRevision: number;
    rosterRevision: number;
    stadiumId: string;
    stadiumCapacity: number;
    policyId: string;
    policyVersion: string;
    driverEvidenceIds: readonly string[];
    lineupSourceEventIds: readonly string[];
    audienceEvidenceIds: readonly string[];
  }>;
}>;

const DRIVER_KINDS: readonly AttendanceDriverKind[] = [
  'CLUB_POPULARITY', 'TEAM_PERFORMANCE', 'STADIUM', 'OPPONENT',
  'DAY_EVENT', 'TICKET_ENVIRONMENT',
];
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value === value.trim();
const day = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const unit = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)
    && value >= 0 && value <= 1;
const unique = (values: readonly string[]): boolean =>
  new Set(values).size === values.length;
const exact = (value: unknown, keys: readonly string[]): boolean =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length
    && keys.every((key) => Object.hasOwn(value, key));

const validatePolicy = (policy: AttendanceInterestPolicy,
  asOfDay: number): void => {
  if (!exact(policy, ['policyId', 'version', 'availableAtDay', 'baseline',
    'driverWeights', 'playerDrawWeight', 'awarenessWeight', 'favorabilityWeight'])
    || !id(policy.policyId) || !id(policy.version)
    || !day(policy.availableAtDay) || policy.availableAtDay > asOfDay
    || !unit(policy.baseline) || !unit(policy.playerDrawWeight)
    || policy.baseline + policy.playerDrawWeight >= 1
    || !unit(policy.awarenessWeight) || !unit(policy.favorabilityWeight)
    || Math.abs(policy.awarenessWeight + policy.favorabilityWeight - 1) > 1e-12
    || !exact(policy.driverWeights, DRIVER_KINDS)
    || DRIVER_KINDS.some((kind) => !unit(policy.driverWeights[kind]))) {
    throw new Error('invalid versioned attendance interest calibration');
  }
};

/** A demand signal only. Gate count remains an independently observed matchday fact. */
export const projectAttendanceInterest = (input: AttendanceInterestInput,
  policy: AttendanceInterestPolicy): AttendanceInterestProjection => {
  validatePolicy(policy, input.asOfDay);
  const { fixture, homeClub, roster } = input;
  const stadium = homeClub.institutional.stadium;
  if (!id(input.careerId) || !id(input.fixtureSourceId)
    || !id(input.seasonId) || !day(input.asOfDay)
    || !id(fixture.gameId) || !id(fixture.seriesId)
    || !day(fixture.day) || fixture.day < input.asOfDay
    || !id(fixture.homeClubId) || !id(fixture.awayClubId)
    || fixture.homeClubId === fixture.awayClubId
    || fixture.homeClubId !== homeClub.identity.clubId
    || !exact(input.venueBinding, ['gameId', 'venueId',
      'fixtureEventId', 'fixtureRevision'])
    || input.venueBinding.gameId !== fixture.gameId
    || input.venueBinding.venueId !== stadium.stadiumId
    || input.venueBinding.fixtureEventId !== input.fixtureSourceId
    || !day(input.venueBinding.fixtureRevision)
    || homeClub.careerId !== input.careerId
    || !day(homeClub.effectiveDay) || homeClub.effectiveDay > input.asOfDay
    || homeClub.season.plan.startsOnDay > fixture.day
    || !homeClub.season.plan.competitionEditionIds.includes(input.seasonId)
    || !id(stadium.stadiumId) || !Number.isSafeInteger(stadium.capacity)
    || stadium.capacity <= 0
    || roster.careerId !== input.careerId
    || !day(roster.effectiveDay) || roster.effectiveDay > input.asOfDay
    || !Array.isArray(input.lineup) || !Array.isArray(input.audienceSources)
    || !Array.isArray(input.drivers)) {
    throw new Error('attendance interest fixture or world source mismatch');
  }
  if (input.drivers.length !== DRIVER_KINDS.length
    || !unique(input.drivers.map((driver) => driver.kind))
    || !unique(input.drivers.map((driver) => driver.evidenceId))) {
    throw new Error('attendance interest requires six distinct demand drivers');
  }
  let interest = policy.baseline;
  for (const driver of input.drivers as readonly AttendanceDriverEvidence[]) {
    const expectedSubject = driver.kind === 'STADIUM' ? stadium.stadiumId
      : driver.kind === 'OPPONENT' ? fixture.awayClubId
      : driver.kind === 'DAY_EVENT' || driver.kind === 'TICKET_ENVIRONMENT'
        ? fixture.gameId : fixture.homeClubId;
    if (!exact(driver, ['kind', 'careerId', 'gameId', 'subjectId',
      'evidenceId', 'sourceCareerEventId',
      'availableAtDay', 'value'])
      || !DRIVER_KINDS.includes(driver.kind)
      || driver.careerId !== input.careerId
      || driver.gameId !== fixture.gameId
      || driver.subjectId !== expectedSubject
      || !id(driver.evidenceId) || !id(driver.sourceCareerEventId)
      || !day(driver.availableAtDay)
      || driver.availableAtDay > input.asOfDay
      || !unit(driver.value)) {
      throw new Error('attendance demand driver is unavailable or invalid');
    }
    interest += policy.driverWeights[driver.kind] * driver.value;
  }
  if (!unique(input.lineup.map((entry) => entry.playerId))
    || !unique(input.lineup.map((entry) => entry.personId))
    || !unique(input.lineup.map((entry) => entry.sourceEventId))
    || !unique(input.audienceSources.map((source) => source.personId))) {
    throw new Error('duplicate attendance participant or audience source');
  }
  const audienceByPerson = new Map(input.audienceSources.map((source) =>
    [source.personId, source]));
  const usedAudienceEvidenceIds = new Set<string>();
  let playerDraw = 0;
  for (const entry of input.lineup) {
    if (!exact(entry, ['gameId', 'playerId', 'personId', 'clubId',
      'sourceEventId', 'availableAtDay'])
      || entry.gameId !== fixture.gameId
      || !id(entry.playerId) || !id(entry.personId)
      || !id(entry.sourceEventId)
      || ![fixture.homeClubId, fixture.awayClubId].includes(entry.clubId)
      || !day(entry.availableAtDay)
      || entry.availableAtDay > input.asOfDay) {
      throw new Error('attendance player is not confirmed for this fixture');
    }
    const rosterGate = evaluateRosterParticipation(roster, {
      playerId: entry.playerId, clubId: entry.clubId,
      competitionEditionId: input.seasonId,
    });
    if (!rosterGate.eligible) {
      throw new Error('attendance player is not available in the roster');
    }
    const audienceSource = audienceByPerson.get(entry.personId);
    if (!audienceSource) continue;
    if (audienceSource.careerId !== input.careerId
      || audienceSource.asOfDay !== input.asOfDay) {
      throw new Error('attendance audience source has wrong time or career');
    }
    const standing = projectFanFavorite(audienceSource);
    if (standing.currentClubId !== entry.clubId) {
      throw new Error('attendance audience source has wrong player affiliation');
    }
    const clubFans = standing.audiences.find((item) =>
      item.audience.kind === 'CLUB_FANS'
      && item.audience.scopeId === entry.clubId);
    if (clubFans?.awareness === null || clubFans?.favorability === null
      || !clubFans) continue;
    const score = policy.awarenessWeight * clubFans.awareness
      + policy.favorabilityWeight * clubFans.favorability;
    playerDraw = Math.max(playerDraw, score);
    usedAudienceEvidenceIds.add(clubFans.awarenessEvidenceId!);
    usedAudienceEvidenceIds.add(clubFans.favorabilityEvidenceId!);
  }
  const interestIndex = Math.min(1, interest + policy.playerDrawWeight * playerDraw);
  return Object.freeze({ boundary: 'CAREER_ATTENDANCE_INTEREST_ONLY',
    careerId: input.careerId, gameId: fixture.gameId, asOfDay: input.asOfDay,
    interestIndex, playerDraw,
    provenance: Object.freeze({ gameId: fixture.gameId,
      fixtureSourceId: input.fixtureSourceId,
      homeClubId: fixture.homeClubId, clubRevision: homeClub.revision,
      rosterRevision: roster.revision, stadiumId: stadium.stadiumId,
      stadiumCapacity: stadium.capacity,
      policyId: policy.policyId, policyVersion: policy.version,
      driverEvidenceIds: Object.freeze(input.drivers.map((driver) =>
        driver.evidenceId).sort()),
      lineupSourceEventIds: Object.freeze(input.lineup.map((entry) =>
        entry.sourceEventId).sort()),
      audienceEvidenceIds: Object.freeze([...usedAudienceEvidenceIds].sort()),
    }) });
};
