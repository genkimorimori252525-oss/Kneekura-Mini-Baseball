export type CompetitionFormatProfile = Readonly<{
  competitionId: string;
  formatVersion: string;
  ruleProfileVersion: string;
  hostingPolicyVersion: string;
  drawPolicyVersion: string;
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
}>;

export type CompetitionEditionSnapshot = Readonly<CompetitionFormatProfile & CompetitionEditionInput>;

const nonempty = (name: string, value: string): void => {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${name} is required`);
};

export const createCompetitionEdition = (
  profile: CompetitionFormatProfile,
  input: CompetitionEditionInput,
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
  return Object.freeze({
    ...profile,
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
