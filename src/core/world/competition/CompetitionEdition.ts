import { requireRegisteredDrawPolicy, type CompetitionDrawPolicy,
  type CompetitionDrawPolicyRegistry } from './CompetitionDraw';
import { selectCompetitionHost, type HostCandidate,
  type HostSelection } from './HostSelection';

export type CompetitionFormatProfile = Readonly<{
  competitionId: string;
  formatVersion: string;
  ruleProfileVersion: string;
  hostingPolicyVersion: string;
  drawPolicyVersion: string;
  drawPolicy: CompetitionDrawPolicy;
  awardPolicyVersion: string;
  canonicalRole: string;
  reformEventId?: string;
  effectiveAfterEditionId?: string;
}>;

export type FinalFourPairingPolicy = Readonly<{
  version: string;
  semifinalPairs: readonly (readonly [number, number])[];
}>;
export type ClubWorldQuarterfinalPolicy = Readonly<{
  version: string;
  /** Winner group index selects a runner from a different group. */
  runnerGroupByWinnerGroup: readonly number[];
  /** Administrative batting order only; all four games use neutral venues. */
  groupWinnerBatsLast: boolean;
  venueIds: readonly string[];
}>;

export type CompetitionEditionInput = Readonly<{
  editionId: string;
  qualificationSnapshotId: string;
  participantIds: readonly string[];
  host: Readonly<{ nationId: string; cityIds: readonly string[]; venueIds: readonly string[] }>;
  calendarWindow: Readonly<{ startsOnDay: number; endsOnDay: number }>;
  drawSnapshotId: string;
  prestigeAtEdition: number;
  /** Evaluated once while creating the edition, before its games begin. */
  finalFourHostCandidates?: readonly HostCandidate[];
  finalFourPairingPolicy?: FinalFourPairingPolicy;
  clubWorldQuarterfinalPolicy?: ClubWorldQuarterfinalPolicy;
  groupHubs?: readonly Readonly<{ groupIndex: number; nationId: string;
    cityId: string; venueId: string }>[];
}>;

export type CompetitionEditionSnapshot = Readonly<CompetitionFormatProfile &
  Omit<CompetitionEditionInput, 'finalFourHostCandidates'> & Readonly<{
    finalFourHost?: HostSelection;
  }>>;

const nonempty = (name: string, value: string): void => {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${name} is required`);
};

export const createCompetitionEdition = (
  profile: CompetitionFormatProfile,
  input: CompetitionEditionInput,
  drawPolicyRegistry: CompetitionDrawPolicyRegistry,
): CompetitionEditionSnapshot => {
  for (const [name, value] of Object.entries({
    competitionId: profile.competitionId,
    formatVersion: profile.formatVersion,
    ruleProfileVersion: profile.ruleProfileVersion,
    hostingPolicyVersion: profile.hostingPolicyVersion,
    drawPolicyVersion: profile.drawPolicyVersion,
    awardPolicyVersion: profile.awardPolicyVersion,
    canonicalRole: profile.canonicalRole,
    editionId: input.editionId,
    qualificationSnapshotId: input.qualificationSnapshotId,
    drawSnapshotId: input.drawSnapshotId,
    hostNationId: input.host.nationId,
  })) nonempty(name, value);
  if (profile.drawPolicy?.version !== profile.drawPolicyVersion) {
    throw new Error('edition draw policy must match its versioned profile');
  }
  const drawPolicy = requireRegisteredDrawPolicy(drawPolicyRegistry,
    profile.drawPolicy);
  if (
    input.participantIds.length === 0
    || new Set(input.participantIds).size !== input.participantIds.length
    || input.participantIds.some((id) => typeof id !== 'string' || id.length === 0)
    || input.host.cityIds.length === 0 || input.host.venueIds.length === 0
    || new Set(input.host.venueIds).size !== input.host.venueIds.length
    || !Number.isSafeInteger(input.calendarWindow.startsOnDay)
    || !Number.isSafeInteger(input.calendarWindow.endsOnDay)
    || input.calendarWindow.endsOnDay < input.calendarWindow.startsOnDay
    || !Number.isFinite(input.prestigeAtEdition)
  ) throw new Error('invalid competition edition snapshot');
  if (
    profile.canonicalRole === 'NATIONAL_WORLD_CHAMPIONSHIP'
    && input.host.nationId !== 'US'
  ) throw new Error('WBC-class finals host nation must be United States');
  if (profile.effectiveAfterEditionId === input.editionId) {
    throw new Error('competition reform cannot rewrite its boundary edition');
  }
  if ((profile.canonicalRole === 'CONTINENTAL_CL'
    || profile.canonicalRole === 'AFBCL'
    || profile.canonicalRole === 'CLUB_WORLD')
    && input.finalFourHostCandidates === undefined) {
    throw new Error('continental CL edition requires a preselected final four host');
  }
  if ((profile.canonicalRole === 'CONTINENTAL_CL'
    || profile.canonicalRole === 'AFBCL'
    || profile.canonicalRole === 'CLUB_WORLD')
    && input.finalFourPairingPolicy === undefined) {
    throw new Error('continental CL edition requires preselected semifinal pairings');
  }
  const pairing = input.finalFourPairingPolicy;
  if (pairing !== undefined && (
    !pairing.version || !Array.isArray(pairing.semifinalPairs)
    || pairing.semifinalPairs.length !== 2
    || pairing.semifinalPairs.some((pair) =>
      !Array.isArray(pair) || pair.length !== 2
      || pair.some((slot) => !Number.isSafeInteger(slot)))
    || [...pairing.semifinalPairs.flat()].sort().join(',') !== '0,1,2,3'
    || (profile.canonicalRole === 'AFBCL'
      && pairing.semifinalPairs.some((pair) =>
        Math.floor(pair[0] / 2) === Math.floor(pair[1] / 2)))
  )) throw new Error('invalid edition semifinal pairing policy');
  if (profile.canonicalRole === 'AFBCL'
    && (!Array.isArray(input.groupHubs)
      || input.groupHubs.length !== 2)) {
    throw new Error('AfBCL edition requires two preselected group hubs');
  }
  if (profile.canonicalRole === 'CLUB_WORLD'
    && (!Array.isArray(input.groupHubs)
      || input.groupHubs.length !== 4)) {
    throw new Error('Club World edition requires four preselected group hubs');
  }
  const quarterfinal = input.clubWorldQuarterfinalPolicy;
  if (profile.canonicalRole === 'CLUB_WORLD' && (
    !quarterfinal || !quarterfinal.version
    || !Array.isArray(quarterfinal.runnerGroupByWinnerGroup)
    || quarterfinal.runnerGroupByWinnerGroup.length !== 4
    || new Set(quarterfinal.runnerGroupByWinnerGroup).size !== 4
    || quarterfinal.runnerGroupByWinnerGroup.some((runner, winner) =>
      !Number.isSafeInteger(runner) || runner < 0 || runner > 3
      || runner === winner)
    || typeof quarterfinal.groupWinnerBatsLast !== 'boolean'
    || !Array.isArray(quarterfinal.venueIds)
    || quarterfinal.venueIds.length !== 4
    || quarterfinal.venueIds.some((venueId) =>
      !input.host.venueIds.includes(venueId)))) {
    throw new Error('Club World edition requires versioned neutral quarterfinal pairings');
  }
  if (profile.canonicalRole !== 'CLUB_WORLD'
    && quarterfinal !== undefined) {
    throw new Error('Club World quarterfinal policy belongs to its edition');
  }
  if (input.groupHubs !== undefined && (
    (profile.canonicalRole !== 'AFBCL'
      && profile.canonicalRole !== 'CLUB_WORLD')
    || !Array.isArray(input.groupHubs)
    || input.groupHubs.length
      !== (profile.canonicalRole === 'CLUB_WORLD' ? 4 : 2)
    || input.groupHubs.some((hub, index) =>
      hub.groupIndex !== index || !hub.nationId || !hub.cityId
      || !hub.venueId || !input.host.cityIds.includes(hub.cityId)
      || !input.host.venueIds.includes(hub.venueId))
    || (profile.canonicalRole === 'CLUB_WORLD' && (
      input.groupHubs.some((hub) => hub.nationId !== input.host.nationId)
      || new Set(input.groupHubs.map((hub) => hub.cityId)).size !== 4
      || new Set(input.groupHubs.map((hub) => hub.venueId)).size !== 4))
  )) throw new Error('invalid versioned group hubs');
  const finalFourHost = input.finalFourHostCandidates === undefined
    ? undefined : selectCompetitionHost({ competitionKind: 'OTHER',
      policyVersion: profile.hostingPolicyVersion,
      candidates: input.finalFourHostCandidates });
  if (finalFourHost && (finalFourHost.selectedNationId !== input.host.nationId
    || !input.host.cityIds.includes(finalFourHost.selectedCityId)
    || !input.host.venueIds.includes(finalFourHost.selectedVenueId))) {
    throw new Error('final four host must be inside the edition host snapshot');
  }
  return Object.freeze({
    ...profile,
    drawPolicy,
    editionId: input.editionId,
    qualificationSnapshotId: input.qualificationSnapshotId,
    participantIds: Object.freeze([...input.participantIds]),
    host: Object.freeze({
      nationId: input.host.nationId,
      cityIds: Object.freeze([...input.host.cityIds]),
      venueIds: Object.freeze([...input.host.venueIds]),
    }),
    calendarWindow: Object.freeze({ ...input.calendarWindow }),
    drawSnapshotId: input.drawSnapshotId,
    prestigeAtEdition: input.prestigeAtEdition,
    ...(finalFourHost ? { finalFourHost } : {}),
    ...(pairing ? { finalFourPairingPolicy: Object.freeze({
      version: pairing.version,
      semifinalPairs: Object.freeze(pairing.semifinalPairs.map((pair) =>
        Object.freeze([pair[0], pair[1]] as const))),
    }) } : {}),
    ...(quarterfinal ? { clubWorldQuarterfinalPolicy: Object.freeze({
      version: quarterfinal.version,
      runnerGroupByWinnerGroup: Object.freeze([
        ...quarterfinal.runnerGroupByWinnerGroup]),
      groupWinnerBatsLast: quarterfinal.groupWinnerBatsLast,
      venueIds: Object.freeze([...quarterfinal.venueIds]),
    }) } : {}),
    ...(input.groupHubs ? { groupHubs: Object.freeze(input.groupHubs.map(
      (hub) => Object.freeze({ ...hub }))) } : {}),
  });
};

export const applyCompetitionReform = (
  profile: CompetitionFormatProfile,
  reform: Readonly<{
    eventId: string;
    effectiveAfterEditionId: string;
    newFormatVersion: string;
  }>,
): CompetitionFormatProfile => {
  nonempty('reform eventId', reform.eventId);
  nonempty('effectiveAfterEditionId', reform.effectiveAfterEditionId);
  nonempty('newFormatVersion', reform.newFormatVersion);
  if (reform.newFormatVersion === profile.formatVersion) {
    throw new Error('reform must create a new format version');
  }
  return Object.freeze({
    ...profile,
    formatVersion: reform.newFormatVersion,
    reformEventId: reform.eventId,
    effectiveAfterEditionId: reform.effectiveAfterEditionId,
  });
};
