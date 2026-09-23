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
  if (profile.canonicalRole === 'CONTINENTAL_CL'
    && input.finalFourHostCandidates === undefined) {
    throw new Error('continental CL edition requires a preselected final four host');
  }
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
